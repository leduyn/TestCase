import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { TaskService } from '../services/taskService';
import { TaskStatus } from '@prisma/client';

export class TaskController {
  static async createTask(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const {
        processId,
        name,
        content,
        customFields,
        executorIds,
        watcherIds,
        deadline,
        fileUploads,
      } = req.body;

      if (!processId || !name) {
        return res.status(400).json({ message: 'Quy trình và tên nhiệm vụ là bắt buộc' });
      }

      const task = await TaskService.createTask(
        {
          processId,
          name,
          content,
          customFields,
          executorIds,
          watcherIds,
          deadline,
          fileUploads,
        },
        userId
      );

      return res.status(201).json({
        message: 'Tạo nhiệm vụ thành công',
        task,
      });
    } catch (error: any) {
      console.error('Error creating task:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi tạo nhiệm vụ' });
    }
  }

  static async getTasks(req: AuthRequest, res: Response) {
    try {
      const { search, processId, status, executorId, createdById, overdue, page, limit } =
        req.query;

      const result = await TaskService.getTasks({
        search: search as string,
        processId: processId as string,
        status: status as TaskStatus,
        executorId: executorId as string,
        createdById: createdById as string,
        overdue: overdue === 'true',
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      return res.json(result);
    } catch (error: any) {
      console.error('Error getting tasks:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi lấy danh sách nhiệm vụ' });
    }
  }

  static async getTaskById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const task = await TaskService.getTaskById(id);

      if (!task) {
        return res.status(404).json({ message: 'Không tìm thấy nhiệm vụ' });
      }

      return res.json(task);
    } catch (error: any) {
      console.error('Error getting task by id:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi lấy chi tiết nhiệm vụ' });
    }
  }

  static async updateTask(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const {
        name,
        content,
        customFields,
        executorIds,
        watcherIds,
        deadline,
        fileUploads,
        status,
        changeDescription,
      } = req.body;

      const updated = await TaskService.updateTask(
        id,
        {
          name,
          content,
          customFields,
          executorIds,
          watcherIds,
          deadline,
          fileUploads,
          status,
          changeDescription,
        },
        userId
      );

      return res.json({
        message: 'Cập nhật nhiệm vụ thành công',
        task: updated,
      });
    } catch (error: any) {
      console.error('Error updating task:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi cập nhật nhiệm vụ' });
    }
  }

  static async transitionStep(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { targetStepId, executorIds, customExecutors, deadline, changeDescription, customFields } =
        req.body;

      const updated = await TaskService.transitionStep(id, userId, {
        targetStepId,
        customExecutors: executorIds || customExecutors,
        deadline,
        changeDescription,
        customFields,
      });

      return res.json({
        message:
          updated.status === TaskStatus.COMPLETED
            ? 'Đã hoàn thành toàn bộ quy trình nhiệm vụ'
            : 'Chuyển bước thành công',
        task: updated,
      });
    } catch (error: any) {
      console.error('Error transitioning step:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi chuyển bước' });
    }
  }

  static async completeTask(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { description } = req.body;

      const task = await TaskService.completeTask(id, userId, description);

      return res.json({
        message: 'Hoàn thành nhiệm vụ thành công',
        task,
      });
    } catch (error: any) {
      console.error('Error completing task:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi hoàn thành nhiệm vụ' });
    }
  }

  static async cancelTask(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { reason } = req.body;

      const task = await TaskService.cancelTask(id, userId, reason);

      return res.json({
        message: 'Hủy nhiệm vụ thành công',
        task,
      });
    } catch (error: any) {
      console.error('Error cancelling task:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi hủy nhiệm vụ' });
    }
  }

  static async getTaskHistory(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const histories = await TaskService.getTaskHistories(id);
      return res.json(histories);
    } catch (error: any) {
      console.error('Error getting task histories:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi lấy lịch sử nhiệm vụ' });
    }
  }

  static async getTaskHistoryVersion(req: AuthRequest, res: Response) {
    try {
      const { id, version } = req.params;
      const history = await TaskService.getTaskHistorySnapshot(id, Number(version));
      return res.json(history);
    } catch (error: any) {
      console.error('Error getting task history version:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi lấy snapshot version' });
    }
  }
}
