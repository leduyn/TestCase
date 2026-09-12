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
      const batchSize = Number(process.env.CRON_BATCH_SIZE || 100);
      const concurrency = Number(process.env.CRON_CONCURRENCY || 10);
      const startedAt = Date.now();

      const overdueTasks = await prisma.task.findMany({
        where: {
          status: TaskStatus.IN_PROGRESS,
          deadline: { lt: now },
        },
        select: {
          id: true,
          name: true,
          deadline: true,
          processId: true,
          currentStepId: true,
          histories: { orderBy: { version: 'desc' }, take: 1, select: { version: true } },
          process: { select: { id: true, name: true } },
          currentStep: { select: { id: true, name: true } },
        },
        orderBy: { deadline: 'asc' },
        take: batchSize,
      });

      if (overdueTasks.length === 0) {
        return;
      }

      console.log(`🔍 Cron: Tìm thấy ${overdueTasks.length} nhiệm vụ quá hạn, xử lý theo batch (concurrency=${concurrency})...`);

      for (let i = 0; i < overdueTasks.length; i += concurrency) {
        const chunk = overdueTasks.slice(i, i + concurrency);
        await Promise.allSettled(
          chunk.map(async (task) => {
            const nextVersion = (task.histories[0]?.version || 0) + 1;
            const snapshot = JSON.parse(JSON.stringify(task));
            await prisma.$transaction(async (tx) => {
              await tx.task.update({
                where: { id: task.id },
                data: { status: TaskStatus.OVERDUE },
              });
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
          })
        );
      }

      console.log(
        `✅ Cron: Đã hoàn tất cập nhật ${overdueTasks.length} nhiệm vụ quá hạn trong ${Date.now() - startedAt}ms.`
      );
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
