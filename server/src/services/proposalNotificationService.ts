import prisma from '../config/database';
import { ProposalNotificationType } from '@prisma/client';

/**
 * ProposalNotificationService - Quản lý thông báo và kiểm tra hạn chót (Scheduler) cho module đề xuất.
 */
export class ProposalNotificationService {
  /**
   * Lấy danh sách thông báo của user
   */
  static async getNotifications(
    userId: string,
    options?: { unreadOnly?: boolean; page?: number; limit?: number }
  ) {
    const { unreadOnly = false, page = 1, limit = 20 } = options || {};

    const where: any = { recipientId: userId };
    if (unreadOnly) where.isRead = false;

    const [notifications, total] = await Promise.all([
      prisma.proposalNotification.findMany({
        where,
        include: {
          proposal: {
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              proposalTypeId: true,
              creator: {
                select: { id: true, fullName: true, email: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.proposalNotification.count({ where }),
    ]);

    return { notifications, total, page, limit };
  }

  /**
   * Đánh dấu thông báo đã đọc
   */
  static async markAsRead(notificationId: string, userId: string) {
    return prisma.proposalNotification.updateMany({
      where: { id: notificationId, recipientId: userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Đánh dấu tất cả thông báo đã đọc
   */
  static async markAllAsRead(userId: string) {
    return prisma.proposalNotification.updateMany({
      where: { recipientId: userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * Đếm số thông báo chưa đọc
   */
  static async getUnreadCount(userId: string): Promise<number> {
    return prisma.proposalNotification.count({
      where: { recipientId: userId, isRead: false },
    });
  }

  /**
   * Xóa một thông báo
   */
  static async deleteNotification(notificationId: string, userId: string) {
    return prisma.proposalNotification.deleteMany({
      where: { id: notificationId, recipientId: userId },
    });
  }

  /**
   * Tạo thông báo mới thủ công
   */
  static async createNotification(data: {
    proposalId: string;
    recipientId: string;
    type: ProposalNotificationType;
    title: string;
    content: string;
  }) {
    return prisma.proposalNotification.create({
      data: {
        proposalId: data.proposalId,
        recipientId: data.recipientId,
        type: data.type,
        title: data.title,
        content: data.content,
      },
    });
  }

  /**
   * Tạo thông báo nhắc nhở cho đề xuất sắp hết hạn
   */
  static async sendReminder(proposalId: string, approverId: string, message: string) {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      select: { title: true },
    });

    if (!proposal) return;

    await prisma.$transaction([
      prisma.proposalNotification.create({
        data: {
          proposalId,
          recipientId: approverId,
          type: 'REMINDER',
          title: `Nhắc nhở: Đề xuất "${proposal.title}" cần phê duyệt`,
          content: message,
        },
      }),
      prisma.proposalApproval.updateMany({
        where: { proposalId, approverId, action: 'PENDING' },
        data: {
          reminderSentAt: new Date(),
          reminderCount: { increment: 1 },
        },
      }),
    ]);
  }

  /**
   * Kiểm tra và xử lý deadline cho tất cả đề xuất đang chờ duyệt.
   * Xử lý quá hạn (EXPIRED) và gửi nhắc nhở theo các mốc (50%, 75%, 90%).
   * Được gọi định kỳ bởi Cron Job.
   */
  static async checkDeadlines() {
    const now = new Date();

    // 1. Xử lý đề xuất quá hạn (deadline < now)
    const expiredProposals = await prisma.proposal.findMany({
      where: {
        status: { in: ['PENDING', 'IN_REVIEW'] },
        deadline: { lt: now },
      },
      include: { proposalType: true },
    });

    for (const proposal of expiredProposals) {
      try {
        await prisma.$transaction(async (tx) => {
          await tx.proposal.update({
            where: { id: proposal.id },
            data: { status: 'EXPIRED' },
          });

          // Hủy tất cả pending approvals
          await tx.proposalApproval.updateMany({
            where: { proposalId: proposal.id, action: 'PENDING' },
            data: { action: 'CANCELLED' },
          });

          // Ghi lịch sử
          const historyCount = await tx.proposalHistory.count({ where: { proposalId: proposal.id } });
          await tx.proposalHistory.create({
            data: {
              proposalId: proposal.id,
              version: historyCount + 1,
              changeType: 'CANCELLED',
              changeDescription: 'Đề xuất đã quá hạn xử lý và tự động hết hạn',
              snapshot: { reason: 'EXPIRED', deadline: proposal.deadline },
            },
          });

          // Thông báo cho người tạo
          await tx.proposalNotification.create({
            data: {
              proposalId: proposal.id,
              recipientId: proposal.creatorId,
              type: 'REMINDER',
              title: `Đề xuất "${proposal.title}" đã quá hạn`,
              content: 'Đề xuất của bạn đã quá thời hạn phê duyệt và tự động chuyển sang trạng thái Hết hạn.',
            },
          });
        });
      } catch (error) {
        console.error(`Error processing expired proposal ${proposal.id}:`, error);
      }
    }

    // 2. Nhắc nhở đề xuất sắp hết hạn (50%, 75%, 90% thời gian)
    const pendingProposals = await prisma.proposal.findMany({
      where: {
        status: { in: ['PENDING', 'IN_REVIEW'] },
        deadline: { gt: now },
      },
      include: {
        proposalType: { select: { approvalWorkflow: true } },
        approvals: {
          where: { action: 'PENDING' },
          orderBy: { order: 'asc' },
        },
      },
    });

    let remindersSent = 0;

    for (const proposal of pendingProposals) {
      if (!proposal.deadline || !proposal.submittedAt) continue;

      const totalDuration = proposal.deadline.getTime() - proposal.submittedAt.getTime();
      if (totalDuration <= 0) continue;

      const elapsed = now.getTime() - proposal.submittedAt.getTime();
      const progressPercent = (elapsed / totalDuration) * 100;
      const remainingHours = Math.max(1, Math.ceil((proposal.deadline.getTime() - now.getTime()) / (1000 * 60 * 60)));

      // Đối với SEQUENTIAL, chỉ nhắc người duyệt đầu tiên đang PENDING (đang đến lượt)
      const isSequential = proposal.proposalType.approvalWorkflow === 'SEQUENTIAL';
      const targetApprovals = isSequential && proposal.approvals.length > 0
        ? [proposal.approvals[0]]
        : proposal.approvals;

      for (const approval of targetApprovals) {
        let shouldRemind = false;
        let reminderMessage = '';

        if (progressPercent >= 90 && approval.reminderCount < 3) {
          shouldRemind = true;
          reminderMessage = `[KHẨN CẤP] Đề xuất đã trôi qua 90% thời hạn xử lý. Chỉ còn khoảng ${remainingHours} giờ để phê duyệt!`;
        } else if (progressPercent >= 75 && approval.reminderCount < 2) {
          shouldRemind = true;
          reminderMessage = `Đề xuất đã trôi qua 75% thời hạn xử lý. Còn khoảng ${remainingHours} giờ trước khi hết hạn.`;
        } else if (progressPercent >= 50 && approval.reminderCount < 1) {
          shouldRemind = true;
          reminderMessage = `Đề xuất đã trôi qua 50% thời hạn xử lý. Vui lòng xem xét phê duyệt sớm.`;
        }

        if (shouldRemind) {
          await this.sendReminder(proposal.id, approval.approverId, reminderMessage);
          remindersSent++;
        }
      }
    }

    return {
      expired: expiredProposals.length,
      pendingChecked: pendingProposals.length,
      remindersSent,
    };
  }
}
