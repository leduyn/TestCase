import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { WorkflowReportService } from '../services/workflowReportService';

export class WorkflowReportController {
  static async getTasksByStatus(_req: AuthRequest, res: Response) {
    try {
      const data = await WorkflowReportService.getTasksByStatus();
      return res.json(data);
    } catch (error: any) {
      console.error('Error getting tasks by status:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi lấy thống kê theo trạng thái' });
    }
  }

  static async getTasksByProcess(_req: AuthRequest, res: Response) {
    try {
      const data = await WorkflowReportService.getTasksByProcess();
      return res.json(data);
    } catch (error: any) {
      console.error('Error getting tasks by process:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi lấy thống kê theo quy trình' });
    }
  }

  static async getTasksByExecutor(_req: AuthRequest, res: Response) {
    try {
      const data = await WorkflowReportService.getTasksByExecutor();
      return res.json(data);
    } catch (error: any) {
      console.error('Error getting tasks by executor:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi lấy thống kê theo người thực thi' });
    }
  }

  static async getOverdueTasks(_req: AuthRequest, res: Response) {
    try {
      const data = await WorkflowReportService.getOverdueTasks();
      return res.json(data);
    } catch (error: any) {
      console.error('Error getting overdue tasks:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi lấy danh sách nhiệm vụ quá hạn' });
    }
  }
}
