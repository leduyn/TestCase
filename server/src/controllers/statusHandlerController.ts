import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../config/database';
import {
  getStatusHandlers,
  getStatusesForUser,
  assignStatusHandler,
  removeStatusHandler,
} from '../services/statusHandlerService';

const VALID_STATUSES = ['UNTESTED', 'PASSED', 'FAILED', 'BLOCKED', 'RETEST'];

export class StatusHandlerController {
  // Danh sách user được gán xử lý một trạng thái (cho dropdown giao việc)
  static async getHandlersByStatus(req: AuthRequest, res: Response) {
    try {
      const { status } = req.params;
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
      }
      const users = await getStatusHandlers(status);
      return res.json({ status, users });
    } catch (error: any) {
      console.error('Get status handlers error:', error);
      return res.status(500).json({ message: 'Lỗi lấy danh sách xử lý trạng thái', error: error.message });
    }
  }

  // Các trạng thái mà user hiện tại được gán xử lý
  static async getMyStatuses(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Chưa đăng nhập' });
      }
      const statuses = await getStatusesForUser(req.user.id);
      return res.json({ statuses });
    } catch (error: any) {
      console.error('Get my statuses error:', error);
      return res.status(500).json({ message: 'Lỗi lấy trạng thái được gán', error: error.message });
    }
  }

  // Gán user xử lý một trạng thái
  static async assignHandler(req: AuthRequest, res: Response) {
    try {
      const { status, userId } = req.body;
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
      }
      if (!userId) {
        return res.status(400).json({ message: 'Thiếu userId' });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, fullName: true, email: true, status: true },
      });
      if (!user) {
        return res.status(404).json({ message: 'Không tìm thấy người dùng' });
      }
      if (user.status !== 'ACTIVE') {
        return res.status(400).json({ message: 'Chỉ có thể gán người dùng đang hoạt động' });
      }

      await assignStatusHandler(status, userId);
      return res.json({ message: 'Phân công xử lý trạng thái thành công', status, user });
    } catch (error: any) {
      console.error('Assign status handler error:', error);
      return res.status(500).json({ message: 'Lỗi phân công xử lý trạng thái', error: error.message });
    }
  }

  // Gỡ user khỏi xử lý một trạng thái
  static async removeHandler(req: AuthRequest, res: Response) {
    try {
      const { status, userId } = req.params;
      if (!VALID_STATUSES.includes(status)) {
        return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
      }
      if (!userId) {
        return res.status(400).json({ message: 'Thiếu userId' });
      }

      await removeStatusHandler(status, userId);
      return res.json({ message: 'Đã gỡ phân công xử lý trạng thái', status, userId });
    } catch (error: any) {
      console.error('Remove status handler error:', error);
      return res.status(500).json({ message: 'Lỗi gỡ phân công xử lý trạng thái', error: error.message });
    }
  }
}
