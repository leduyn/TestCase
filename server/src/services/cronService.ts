import cron, { ScheduledTask } from 'node-cron';
import prisma from '../config/database';
import { TaskStatus, TaskHistoryChangeType } from '@prisma/client';
import { ProposalNotificationService } from './proposalNotificationService';

export class CronService {
  private static task: ScheduledTask | null = null;

  /**
   * Khởi động các Cron Jobs
   */
  static init() {
    console.log('⏰ Khởi tạo Cron Jobs cho hệ thống Workflow...');

    // Chạy kiểm tra Overdue & Deadline mỗi 15 phút ('*/15 * * * *')
    this.task = cron.schedule('*/15 * * * *', async () => {
      await this.checkOverdueTasks();
      await this.checkProposalDeadlines();
    });

    // Chạy ngay 1 lần khi server vừa khởi động (sau 10s để DB ổn định)
    setTimeout(() => {
      this.checkOverdueTasks().catch((err) =>
        console.error('Lỗi khi chạy quét overdue lần đầu:', err)
      );
      this.checkProposalDeadlines().catch((err) =>
        console.error('Lỗi khi chạy quét proposal deadline lần đầu:', err)
      );
    }, 10000);
  }

  /**
   * Quét và cập nhật trạng thái các nhiệm vụ đã quá hạn (deadline < now)
   */
  static async checkOverdueTasks() {
    try {
      const now = new Date();

      const overdueTasks = await prisma.task.findMany({
        where: {
          status: TaskStatus.IN_PROGRESS,
          deadline: { lt: now },
        },
        include: {
          histories: { orderBy: { version: 'desc' }, take: 1 },
          process: { select: { id: true, name: true } },
          currentStep: true,
          todos: true,
          comments: true,
        },
      });

      if (overdueTasks.length === 0) {
        return;
      }

      console.log(`🔍 Cron: Tìm thấy ${overdueTasks.length} nhiệm vụ quá hạn, đang xử lý...`);

      for (const task of overdueTasks) {
        const nextVersion = (task.histories[0]?.version || 1) + 1;

        await prisma.$transaction(async (tx) => {
          // 1. Cập nhật trạng thái Task sang OVERDUE
          const updated = await tx.task.update({
            where: { id: task.id },
            data: {
              status: TaskStatus.OVERDUE,
            },
          });

          // 2. Tạo Snapshot
          const fullTask = await tx.task.findUnique({
            where: { id: task.id },
            include: {
              process: { select: { id: true, name: true } },
              currentStep: true,
              todos: true,
              comments: true,
            },
          });

          const snapshot = fullTask ? JSON.parse(JSON.stringify(fullTask)) : {};

          // 3. Ghi log TaskHistory
          await tx.taskHistory.create({
            data: {
              taskId: task.id,
              version: nextVersion,
              changeType: TaskHistoryChangeType.UPDATED,
              changeDescription: `Hệ thống tự động chuyển trạng thái sang QUÁ HẠN (Hạn chót: ${new Date(
                task.deadline
              ).toLocaleString('vi-VN')})`,
              snapshot,
              createdById: null,
            },
          });
        });

        console.log(`⚠️ Đã đánh dấu quá hạn nhiệm vụ: [${task.id}] ${task.name}`);
      }

      console.log(`✅ Cron: Đã hoàn tất cập nhật ${overdueTasks.length} nhiệm vụ quá hạn.`);
    } catch (error) {
      console.error('❌ Lỗi trong Cron Job checkOverdueTasks:', error);
    }
  }

  /**
   * Quét và xử lý hạn chót cũng như gửi nhắc nhở cho module Đề xuất
   */
  static async checkProposalDeadlines() {
    try {
      const result = await ProposalNotificationService.checkDeadlines();
      if (result.expired > 0 || result.remindersSent > 0) {
        console.log(
          `🔔 Cron Proposal: Đã cập nhật ${result.expired} đề xuất hết hạn, gửi ${result.remindersSent} thông báo nhắc nhở.`
        );
      }
    } catch (error) {
      console.error('❌ Lỗi trong Cron Job checkProposalDeadlines:', error);
    }
  }

  /**
   * Dừng Cron Job khi cần
   */
  static stop() {
    if (this.task) {
      this.task.stop();
      console.log('🛑 Đã dừng Cron Jobs.');
    }
  }
}
