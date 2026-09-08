import prisma from '../config/database';
import { NotificationType, Prisma } from '@prisma/client';
import { emitToUser } from '../socket';

export interface CreateNotificationDto {
  recipientId: string;
  type: NotificationType;
  title: string;
  content: string;
  testCaseId?: string | null;
  executionId?: string | null;
  taskId?: string | null;
  proposalId?: string | null;
  metadata?: any;
}

function truncateText(text: string, maxLength: number = 120): string {
  if (!text) return '';
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.substring(0, maxLength) + '...';
}

function parseJsonArray(field: any): string[] {
  if (!field) return [];
  if (Array.isArray(field)) {
    return field.map((item) => (typeof item === 'object' && item?.id ? String(item.id) : String(item)));
  }
  if (typeof field === 'string') {
    try {
      const parsed = JSON.parse(field);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => (typeof item === 'object' && item?.id ? String(item.id) : String(item)));
      }
    } catch {
      return [];
    }
  }
  return [];
}

export class NotificationService {
  /**
   * Tạo 1 thông báo đơn lẻ, lưu DB và bắn Socket.IO realtime
   */
  static async createNotification(data: CreateNotificationDto) {
    const notification = await prisma.notification.create({
      data: {
        recipientId: data.recipientId,
        type: data.type,
        title: data.title,
        content: data.content,
        testCaseId: data.testCaseId || null,
        executionId: data.executionId || null,
        taskId: data.taskId || null,
        proposalId: data.proposalId || null,
        metadata: data.metadata || {},
      },
      include: {
        testCase: {
          select: { id: true, testCaseCode: true, title: true },
        },
        execution: {
          select: { id: true, status: true, testCaseId: true },
        },
        task: {
          select: { id: true, name: true, status: true },
        },
        proposal: {
          select: { id: true, title: true, status: true },
        },
      },
    });

    // Bắn realtime qua Socket.IO
    emitToUser(data.recipientId, 'notification:new', notification);

    // Bắn cập nhật số lượng unread
    const unreadCount = await this.getUnreadCount(data.recipientId);
    emitToUser(data.recipientId, 'notification:unread_count', { unreadCount });

    return notification;
  }

  /**
   * Tạo batch nhiều thông báo (cho nhiều recipients), lưu DB và bắn Socket.IO
   */
  static async createBatchNotifications(items: CreateNotificationDto[]) {
    if (!items || items.length === 0) return [];

    // Tạo các records trong transaction
    const createdList = await prisma.$transaction(
      items.map((item) =>
        prisma.notification.create({
          data: {
            recipientId: item.recipientId,
            type: item.type,
            title: item.title,
            content: item.content,
            testCaseId: item.testCaseId || null,
            executionId: item.executionId || null,
            taskId: item.taskId || null,
            proposalId: item.proposalId || null,
            metadata: item.metadata || {},
          },
          include: {
            testCase: {
              select: { id: true, testCaseCode: true, title: true },
            },
            execution: {
              select: { id: true, status: true, testCaseId: true },
            },
            task: {
              select: { id: true, name: true, status: true },
            },
            proposal: {
              select: { id: true, title: true, status: true },
            },
          },
        })
      )
    );

    // Phát socket cho từng recipient
    for (const notif of createdList) {
      emitToUser(notif.recipientId, 'notification:new', notif);
      this.getUnreadCount(notif.recipientId)
        .then((unreadCount) => {
          emitToUser(notif.recipientId, 'notification:unread_count', { unreadCount });
        })
        .catch(() => {});
    }

    return createdList;
  }

  /**
   * Lấy danh sách thông báo phân trang của user
   */
  static async getNotifications(
    userId: string,
    options?: { unreadOnly?: boolean; page?: number; limit?: number }
  ) {
    const { unreadOnly = false, page = 1, limit = 20 } = options || {};
    const where: Prisma.NotificationWhereInput = { recipientId: userId };
    if (unreadOnly) {
      where.isRead = false;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          testCase: {
            select: { id: true, testCaseCode: true, title: true, module: true },
          },
          execution: {
            select: { id: true, status: true, server: true, os: true, executedAt: true },
          },
          task: {
            select: { id: true, name: true, status: true, deadline: true },
          },
          proposal: {
            select: { id: true, title: true, status: true, priority: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      notifications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Đếm số lượng thông báo chưa đọc
   */
  static async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { recipientId: userId, isRead: false },
    });
  }

  /**
   * Đánh dấu 1 thông báo đã đọc
   */
  static async markAsRead(notificationId: string, userId: string) {
    const result = await prisma.notification.updateMany({
      where: { id: notificationId, recipientId: userId },
      data: { isRead: true, readAt: new Date() },
    });

    const unreadCount = await this.getUnreadCount(userId);
    emitToUser(userId, 'notification:read', { id: notificationId });
    emitToUser(userId, 'notification:unread_count', { unreadCount });

    return result;
  }

  /**
   * Đánh dấu tất cả thông báo của user đã đọc
   */
  static async markAllAsRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: { recipientId: userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    emitToUser(userId, 'notification:read', { all: true });
    emitToUser(userId, 'notification:unread_count', { unreadCount: 0 });

    return result;
  }

  /**
   * Xóa 1 thông báo
   */
  static async deleteNotification(notificationId: string, userId: string) {
    const result = await prisma.notification.deleteMany({
      where: { id: notificationId, recipientId: userId },
    });

    const unreadCount = await this.getUnreadCount(userId);
    emitToUser(userId, 'notification:unread_count', { unreadCount });

    return result;
  }

  // =========================================================================
  // TRIGGER EVENT HANDLERS
  // =========================================================================

  /**
   * 1. Khi nội dung Test Case được cập nhật
   */
  static async onTestCaseUpdated(
    testCaseId: string,
    updaterUserId: string,
    changeDescription?: string
  ) {
    try {
      const [testCase, updater] = await Promise.all([
        prisma.testCase.findUnique({
          where: { id: testCaseId },
          include: {
            executions: {
              select: {
                executedById: true,
                createdById: true,
                watchers: { select: { userId: true } },
              },
            },
          },
        }),
        prisma.user.findUnique({
          where: { id: updaterUserId },
          select: { id: true, fullName: true, email: true },
        }),
      ]);

      if (!testCase) return;

      const updaterName = updater?.fullName || updater?.email || 'Một người dùng';

      // Thu thập recipients: tester đang thực thi, người tạo execution, watchers
      const recipientSet = new Set<string>();
      for (const exec of testCase.executions) {
        if (exec.executedById) recipientSet.add(exec.executedById);
        if (exec.createdById) recipientSet.add(exec.createdById);
        if (Array.isArray(exec.watchers)) {
          exec.watchers.forEach((w) => {
            if (w.userId) recipientSet.add(w.userId);
          });
        }
      }

      // Loại trừ người vừa cập nhật
      recipientSet.delete(updaterUserId);

      if (recipientSet.size === 0) return;

      const items: CreateNotificationDto[] = Array.from(recipientSet).map((recipientId) => ({
        recipientId,
        type: 'TESTCASE_UPDATED',
        title: `Test Case ${testCase.testCaseCode} vừa được cập nhật`,
        content: `${updaterName} vừa cập nhật nội dung Test Case "${testCase.title}". ${
          changeDescription ? `(${changeDescription}) ` : ''
        }Vui lòng kiểm tra lại kịch bản kiểm thử.`,
        testCaseId: testCase.id,
        metadata: {
          testCaseCode: testCase.testCaseCode,
          updaterId: updaterUserId,
          updaterName,
        },
      }));

      await this.createBatchNotifications(items);
    } catch (error) {
      console.error('Error in onTestCaseUpdated notification:', error);
    }
  }

  /**
   * 2. Khi Test Case được kiểm duyệt (Review status = REVIEWED)
   */
  static async onTestCaseReviewed(testCaseId: string, reviewerUserId: string) {
    try {
      const [testCase, reviewer] = await Promise.all([
        prisma.testCase.findUnique({
          where: { id: testCaseId },
          include: {
            executions: {
              select: {
                executedById: true,
                createdById: true,
              },
            },
          },
        }),
        prisma.user.findUnique({
          where: { id: reviewerUserId },
          select: { id: true, fullName: true, email: true },
        }),
      ]);

      if (!testCase) return;

      const reviewerName = reviewer?.fullName || reviewer?.email || 'Kiểm duyệt viên';

      const recipientSet = new Set<string>();
      for (const exec of testCase.executions) {
        if (exec.executedById) recipientSet.add(exec.executedById);
        if (exec.createdById) recipientSet.add(exec.createdById);
      }

      recipientSet.delete(reviewerUserId);

      if (recipientSet.size === 0) return;

      const items: CreateNotificationDto[] = Array.from(recipientSet).map((recipientId) => ({
        recipientId,
        type: 'TESTCASE_REVIEWED',
        title: `Test Case ${testCase.testCaseCode} đã được phê duyệt`,
        content: `${reviewerName} đã phê duyệt kiểm duyệt Test Case "${testCase.title}".`,
        testCaseId: testCase.id,
        metadata: {
          testCaseCode: testCase.testCaseCode,
          reviewerId: reviewerUserId,
          reviewerName,
        },
      }));

      await this.createBatchNotifications(items);
    } catch (error) {
      console.error('Error in onTestCaseReviewed notification:', error);
    }
  }

  /**
   * 3. Khi kiểm duyệt hàng loạt nhiều Test Cases (Bulk Review)
   */
  static async onTestCaseBulkReviewed(testCaseIds: string[], reviewerUserId: string) {
    try {
      if (!testCaseIds || testCaseIds.length === 0) return;

      const [testCases, reviewer] = await Promise.all([
        prisma.testCase.findMany({
          where: { id: { in: testCaseIds } },
          include: {
            executions: {
              select: { executedById: true, createdById: true },
            },
          },
        }),
        prisma.user.findUnique({
          where: { id: reviewerUserId },
          select: { id: true, fullName: true, email: true },
        }),
      ]);

      const reviewerName = reviewer?.fullName || reviewer?.email || 'Kiểm duyệt viên';

      // Nhóm theo recipient để mỗi recipient chỉ nhận 1 thông báo tổng hợp
      const recipientToTestCases = new Map<string, string[]>();

      for (const tc of testCases) {
        const uniqueRecipients = new Set<string>();
        for (const exec of tc.executions) {
          if (exec.executedById) uniqueRecipients.add(exec.executedById);
          if (exec.createdById) uniqueRecipients.add(exec.createdById);
        }
        uniqueRecipients.delete(reviewerUserId);

        uniqueRecipients.forEach((uid) => {
          if (!recipientToTestCases.has(uid)) {
            recipientToTestCases.set(uid, []);
          }
          recipientToTestCases.get(uid)!.push(tc.testCaseCode);
        });
      }

      const items: CreateNotificationDto[] = [];
      recipientToTestCases.forEach((codes, recipientId) => {
        const count = codes.length;
        const codeSample = codes.slice(0, 3).join(', ') + (count > 3 ? ` và ${count - 3} Test Case khác` : '');
        items.push({
          recipientId,
          type: 'TESTCASE_REVIEWED',
          title: `Đã phê duyệt ${count} Test Case`,
          content: `${reviewerName} đã kiểm duyệt và phê duyệt ${count} Test Case liên quan đến bạn (${codeSample}).`,
          testCaseId: testCases[0]?.id || null,
          metadata: {
            reviewerId: reviewerUserId,
            reviewerName,
            testCaseCodes: codes,
            count,
          },
        });
      });

      if (items.length > 0) {
        await this.createBatchNotifications(items);
      }
    } catch (error) {
      console.error('Error in onTestCaseBulkReviewed notification:', error);
    }
  }

  /**
   * 4. Khi kết quả thực thi Test Execution chuyển trạng thái hoặc bàn giao người xử lý
   */
  static async onExecutionStatusChanged(
    executionId: string,
    actorUserId: string,
    newStatus: string,
    note?: string,
    targetHandlerId?: string | null
  ) {
    try {
      const [execution, actor] = await Promise.all([
        prisma.testExecution.findUnique({
          where: { id: executionId },
          include: {
            testCase: {
              select: { id: true, testCaseCode: true, title: true },
            },
            watchers: {
              select: { userId: true },
            },
          },
        }),
        prisma.user.findUnique({
          where: { id: actorUserId },
          select: { id: true, fullName: true, email: true },
        }),
      ]);

      if (!execution) return;

      const actorName = actor?.fullName || actor?.email || 'Người thực thi';
      const tcCode = execution.testCase?.testCaseCode || 'Test Case';

      const recipientSet = new Set<string>();

      // Người được bàn giao xử lý tiếp theo
      if (targetHandlerId) recipientSet.add(targetHandlerId);
      if (execution.executedById) recipientSet.add(execution.executedById);
      if (execution.beforeExecutedId) recipientSet.add(execution.beforeExecutedId);
      if (execution.createdById) recipientSet.add(execution.createdById);

      // Danh sách người theo dõi
      if (Array.isArray(execution.watchers)) {
        execution.watchers.forEach((w) => {
          if (w.userId) recipientSet.add(w.userId);
        });
      }

      recipientSet.delete(actorUserId);

      if (recipientSet.size === 0) return;

      const statusLabels: Record<string, string> = {
        PASSED: 'Đạt (PASSED)',
        FAILED: 'Lỗi (FAILED)',
        BLOCKED: 'Bị chặn (BLOCKED)',
        RETEST: 'Cần kiểm thử lại (RETEST)',
        UNTESTED: 'Chưa kiểm thử (UNTESTED)',
      };
      const statusText = statusLabels[newStatus] || newStatus;

      const items: CreateNotificationDto[] = Array.from(recipientSet).map((recipientId) => {
        const isAssigned = targetHandlerId && recipientId === targetHandlerId && targetHandlerId !== actorUserId;
        const type: NotificationType = isAssigned ? 'EXECUTION_ASSIGNED' : 'EXECUTION_STATUS_CHANGED';
        const title = isAssigned
          ? `Bạn được bàn giao Test Case ${tcCode}`
          : `Kết quả thực thi Test Case ${tcCode}: ${statusText}`;

        let content = `${actorName} đã cập nhật trạng thái sang [${statusText}].`;
        if (note && note.trim()) {
          content += ` Ghi chú: ${truncateText(note, 80)}`;
        }

        return {
          recipientId,
          type,
          title,
          content,
          executionId: execution.id,
          testCaseId: execution.testCaseId,
          metadata: {
            actorId: actorUserId,
            actorName,
            status: newStatus,
            isAssigned,
          },
        };
      });

      await this.createBatchNotifications(items);
    } catch (error) {
      console.error('Error in onExecutionStatusChanged notification:', error);
    }
  }

  /**
   * 5. Khi có bình luận mới trong lượt thực thi Test Execution
   */
  static async onExecutionCommentCreated(
    executionId: string,
    commentUserId: string,
    commentContent: string
  ) {
    try {
      const [execution, commenter] = await Promise.all([
        prisma.testExecution.findUnique({
          where: { id: executionId },
          include: {
            testCase: {
              select: { id: true, testCaseCode: true, title: true },
            },
            watchers: {
              select: { userId: true },
            },
          },
        }),
        prisma.user.findUnique({
          where: { id: commentUserId },
          select: { id: true, fullName: true, email: true },
        }),
      ]);

      if (!execution) return;

      const commenterName = commenter?.fullName || commenter?.email || 'Một thành viên';
      const tcCode = execution.testCase?.testCaseCode || 'Test Case';

      const recipientSet = new Set<string>();
      if (execution.executedById) recipientSet.add(execution.executedById);
      if (execution.createdById) recipientSet.add(execution.createdById);
      if (Array.isArray(execution.watchers)) {
        execution.watchers.forEach((w) => {
          if (w.userId) recipientSet.add(w.userId);
        });
      }

      recipientSet.delete(commentUserId);

      if (recipientSet.size === 0) return;

      const items: CreateNotificationDto[] = Array.from(recipientSet).map((recipientId) => ({
        recipientId,
        type: 'EXECUTION_COMMENT',
        title: `Bình luận mới tại Test Execution: ${tcCode}`,
        content: `${commenterName}: "${truncateText(commentContent, 100)}"`,
        executionId: execution.id,
        testCaseId: execution.testCaseId,
        metadata: {
          commenterId: commentUserId,
          commenterName,
        },
      }));

      await this.createBatchNotifications(items);
    } catch (error) {
      console.error('Error in onExecutionCommentCreated notification:', error);
    }
  }

  /**
   * 6. Khi có bình luận mới trong Nhiệm vụ (Task Workflow)
   */
  static async onTaskCommentCreated(
    taskId: string,
    commentUserId: string,
    commentContent: string
  ) {
    try {
      const [task, commenter] = await Promise.all([
        prisma.task.findUnique({
          where: { id: taskId },
          select: {
            id: true,
            name: true,
            createdById: true,
            executorIds: true,
            watcherIds: true,
          },
        }),
        prisma.user.findUnique({
          where: { id: commentUserId },
          select: { id: true, fullName: true, email: true },
        }),
      ]);

      if (!task) return;

      const commenterName = commenter?.fullName || commenter?.email || 'Một thành viên';

      const recipientSet = new Set<string>();
      if (task.createdById) recipientSet.add(task.createdById);

      // Parse executors và watchers (Json arrays)
      const executorIds = parseJsonArray(task.executorIds);
      const watcherIds = parseJsonArray(task.watcherIds);

      executorIds.forEach((id) => recipientSet.add(id));
      watcherIds.forEach((id) => recipientSet.add(id));

      // Không gửi cho người vừa comment
      recipientSet.delete(commentUserId);

      if (recipientSet.size === 0) return;

      const items: CreateNotificationDto[] = Array.from(recipientSet).map((recipientId) => ({
        recipientId,
        type: 'TASK_COMMENT',
        title: `Bình luận mới trong nhiệm vụ: ${task.name}`,
        content: `${commenterName}: "${truncateText(commentContent, 100)}"`,
        taskId: task.id,
        metadata: {
          commenterId: commentUserId,
          commenterName,
        },
      }));

      await this.createBatchNotifications(items);
    } catch (error) {
      console.error('Error in onTaskCommentCreated notification:', error);
    }
  }

  /**
   * 7. Khi có bình luận mới trong Đề xuất (Proposal)
   */
  static async onProposalCommentCreated(
    proposalId: string,
    commentUserId: string,
    commentContent: string
  ) {
    try {
      const [proposal, commenter] = await Promise.all([
        prisma.proposal.findUnique({
          where: { id: proposalId },
          select: {
            id: true,
            title: true,
            creatorId: true,
            approvals: {
              select: { approverId: true },
            },
            followers: {
              select: { userId: true },
            },
          },
        }),
        prisma.user.findUnique({
          where: { id: commentUserId },
          select: { id: true, fullName: true, email: true },
        }),
      ]);

      if (!proposal) return;

      const commenterName = commenter?.fullName || commenter?.email || 'Một thành viên';

      const recipientSet = new Set<string>();
      if (proposal.creatorId) recipientSet.add(proposal.creatorId);

      if (Array.isArray(proposal.approvals)) {
        proposal.approvals.forEach((a) => {
          if (a.approverId) recipientSet.add(a.approverId);
        });
      }

      if (Array.isArray(proposal.followers)) {
        proposal.followers.forEach((f) => {
          if (f.userId) recipientSet.add(f.userId);
        });
      }

      recipientSet.delete(commentUserId);

      if (recipientSet.size === 0) return;

      const items: CreateNotificationDto[] = Array.from(recipientSet).map((recipientId) => ({
        recipientId,
        type: 'PROPOSAL_COMMENT',
        title: `Bình luận mới trong đề xuất: ${proposal.title}`,
        content: `${commenterName}: "${truncateText(commentContent, 100)}"`,
        proposalId: proposal.id,
        metadata: {
          commenterId: commentUserId,
          commenterName,
        },
      }));

      await this.createBatchNotifications(items);
    } catch (error) {
      console.error('Error in onProposalCommentCreated notification:', error);
    }
  }
}
