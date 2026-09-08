import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ProposalNotificationService } from '../services/proposalNotificationService';

export class ProposalNotificationController {
  /**
   * Lấy danh sách thông báo của user
   */
  static async getNotifications(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { unreadOnly, page, limit } = req.query;

      const result = await ProposalNotificationService.getNotifications(userId, {
        unreadOnly: unreadOnly === 'true',
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      return res.json(result);
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi lấy danh sách thông báo' });
    }
  }

  /**
   * Đếm số thông báo chưa đọc
   */
  static async getUnreadCount(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const count = await ProposalNotificationService.getUnreadCount(userId);
      return res.json({ unreadCount: count });
    } catch (error: any) {
      console.error('Error getting unread count:', error);
      return res.status(500).json({ message: error.message || 'Lỗi khi lấy số thông báo chưa đọc' });
    }
  }

  /**
   * Đánh dấu 1 thông báo đã đọc
   */
  static async markAsRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      await ProposalNotificationService.markAsRead(id, userId);
      return res.json({ message: 'Đã đánh dấu thông báo là đã đọc' });
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi cập nhật trạng thái đã đọc' });
    }
  }

  /**
   * Đánh dấu tất cả thông báo đã đọc
   */
  static async markAllAsRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;

      await ProposalNotificationService.markAllAsRead(userId);
      return res.json({ message: 'Đã đánh dấu tất cả thông báo là đã đọc' });
    } catch (error: any) {
      console.error('Error marking all notifications as read:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi cập nhật tất cả đã đọc' });
    }
  }

  /**
   * Xóa một thông báo
   */
  static async deleteNotification(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      await ProposalNotificationService.deleteNotification(id, userId);
      return res.json({ message: 'Đã xóa thông báo thành công' });
    } catch (error: any) {
      console.error('Error deleting notification:', error);
      return res.status(400).json({ message: error.message || 'Lỗi khi xóa thông báo' });
    }
  }
}
