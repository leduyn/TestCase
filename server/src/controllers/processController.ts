import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ProcessService } from '../services/processService';

export class ProcessController {
  static async createProcess(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { name, description, managerId, watcherIds, steps } = req.body;

      if (!name) {
        return res.status(400).json({ message: 'Tên quy trình không được để trống' });
      }

      const effectiveManagerId = managerId || userId;

      const process = await ProcessService.createProcess(
        {
          name,
          description,
          managerId: effectiveManagerId,
          watcherIds,
          steps,
        },
        userId
      );

      return res.status(201).json({
        message: 'Tạo quy trình thành công',
        process,
      });
    } catch (error: any) {
      console.error('Error creating process:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi tạo quy trình' });
    }
  }

  static async getProcesses(req: AuthRequest, res: Response) {
    try {
      const { search, managerId, page, limit } = req.query;

      const result = await ProcessService.getProcesses({
        search: search as string,
        managerId: managerId as string,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      return res.json(result);
    } catch (error: any) {
      console.error('Error fetching processes:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi lấy danh sách quy trình' });
    }
  }

  static async getProcessById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const process = await ProcessService.getProcessById(id);

      if (!process) {
        return res.status(404).json({ message: 'Không tìm thấy quy trình' });
      }

      return res.json(process);
    } catch (error: any) {
      console.error('Error getting process by id:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi lấy chi tiết quy trình' });
    }
  }

  static async updateProcess(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { name, description, managerId, watcherIds } = req.body;

      const updated = await ProcessService.updateProcess(
        id,
        { name, description, managerId, watcherIds },
        userId
      );

      return res.json({
        message: 'Cập nhật quy trình thành công',
        process: updated,
      });
    } catch (error: any) {
      console.error('Error updating process:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi cập nhật quy trình' });
    }
  }

  static async deleteProcess(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      await ProcessService.deleteProcess(id, userId);

      return res.json({ message: 'Xóa quy trình thành công' });
    } catch (error: any) {
      console.error('Error deleting process:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi xóa quy trình' });
    }
  }

  static async addStep(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { name, executorIds, timeLimitHours, order, instructions } = req.body;

      if (!name) {
        return res.status(400).json({ message: 'Tên bước không được để trống' });
      }

      const step = await ProcessService.addStep(
        id,
        { name, executorIds, timeLimitHours, order, instructions },
        userId
      );

      return res.status(201).json({
        message: 'Thêm bước thành công',
        step,
      });
    } catch (error: any) {
      console.error('Error adding step:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi thêm bước' });
    }
  }

  static async updateStep(req: AuthRequest, res: Response) {
    try {
      const { stepId } = req.params;
      const userId = req.user!.id;
      const { name, executorIds, timeLimitHours, order, instructions } = req.body;

      const step = await ProcessService.updateStep(
        stepId,
        { name, executorIds, timeLimitHours, order, instructions },
        userId
      );

      return res.json({
        message: 'Cập nhật bước thành công',
        step,
      });
    } catch (error: any) {
      console.error('Error updating step:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi cập nhật bước' });
    }
  }

  static async deleteStep(req: AuthRequest, res: Response) {
    try {
      const { stepId } = req.params;

      await ProcessService.deleteStep(stepId);

      return res.json({ message: 'Xóa bước thành công' });
    } catch (error: any) {
      console.error('Error deleting step:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi xóa bước' });
    }
  }
}
