import { api } from './api';
import type { NotificationListResponse, NotificationUnreadCountResponse } from '../types/notification';

export interface GetNotificationsParams {
  unreadOnly?: boolean;
  page?: number;
  limit?: number;
}

export const notificationApi = {
  /**
   * Lấy danh sách thông báo phân trang
   */
  getNotifications: (params?: GetNotificationsParams) =>
    api.get<NotificationListResponse>('/notifications', { params }),

  /**
   * Đếm số thông báo chưa đọc
   */
  getUnreadCount: () =>
    api.get<NotificationUnreadCountResponse>('/notifications/unread-count'),

  /**
   * Đánh dấu 1 thông báo là đã đọc
   */
  markAsRead: (id: string) =>
    api.put<{ message: string }>(`/notifications/${id}/read`),

  /**
   * Đánh dấu tất cả thông báo là đã đọc
   */
  markAllAsRead: () =>
    api.put<{ message: string }>('/notifications/read-all'),

  /**
   * Xóa một thông báo
   */
  deleteNotification: (id: string) =>
    api.delete<{ message: string }>(`/notifications/${id}`),
};
