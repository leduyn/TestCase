import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { NotificationService } from '../services/notificationService';

export class NotificationController {
  /**
   * GET /api/notifications
   * Lấy danh sách thông báo phân trang của user hiện tại
   */
  static async getNotifications(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Chưa xác thực người dùng' });
      }

      const { unreadOnly, page, limit } = req.query;

      const result = await NotificationService.getNotifications(userId, {
        unreadOnly: unreadOnly === 'true',
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      });

      return res.json(result);
    } catch (error: any) {
      console.error('Error in NotificationController.getNotifications:', error);
      return res.status(500).json({ message: 'Lỗi tải danh sách thông báo', error: error.message });
    }
  }

  /**
   * GET /api/notifications/unread-count
   * Đếm số lượng thông báo chưa đọc
   */
  static async getUnreadCount(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Chưa xác thực người dùng' });
      }

      const count = await NotificationService.getUnreadCount(userId);
      return res.json({ unreadCount: count });
    } catch (error: any) {
      console.error('Error in NotificationController.getUnreadCount:', error);
      return res.status(500).json({ message: 'Lỗi lấy số lượng thông báo chưa đọc', error: error.message });
    }
  }

  /**
   * PUT /api/notifications/:id/read
   * Đánh dấu 1 thông báo đã đọc
   */
  static async markAsRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({ message: 'Chưa xác thực người dùng' });
      }

      await NotificationService.markAsRead(id, userId);
      return res.json({ message: 'Đã đánh dấu thông báo là đã đọc' });
    } catch (error: any) {
      console.error('Error in NotificationController.markAsRead:', error);
      return res.status(400).json({ message: 'Lỗi cập nhật trạng thái đã đọc', error: error.message });
    }
  }

  /**
   * PUT /api/notifications/read-all
   * Đánh dấu tất cả thông báo đã đọc
   */
  static async markAllAsRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'Chưa xác thực người dùng' });
      }

      await NotificationService.markAllAsRead(userId);
      return res.json({ message: 'Đã đánh dấu tất cả thông báo là đã đọc' });
    } catch (error: any) {
      console.error('Error in NotificationController.markAllAsRead:', error);
      return res.status(400).json({ message: 'Lỗi cập nhật tất cả đã đọc', error: error.message });
    }
  }

  /**
   * DELETE /api/notifications/:id
   * Xóa một thông báo
   */
  static async deleteNotification(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        return res.status(401).json({ message: 'Chưa xác thực người dùng' });
      }

      await NotificationService.deleteNotification(id, userId);
      return res.json({ message: 'Đã xóa thông báo thành công' });
    } catch (error: any) {
      console.error('Error in NotificationController.deleteNotification:', error);
      return res.status(400).json({ message: 'Lỗi khi xóa thông báo', error: error.message });
    }
  }
}
