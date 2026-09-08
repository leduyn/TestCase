/**
 * Browser Notification Helper (Web Notification API)
 * Quản lý xin quyền và hiển thị thông báo popup của hệ điều hành
 */

export type NotificationPermissionStatus = NotificationPermission | 'unsupported';

/**
 * Kiểm tra trạng thái cấp quyền hiện tại
 */
export function getNotificationPermission(): NotificationPermissionStatus {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Yêu cầu người dùng cấp quyền hiển thị thông báo trình duyệt
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (err) {
      console.warn('Lỗi khi xin quyền Notification:', err);
      return false;
    }
  }

  return false;
}

export interface BrowserNotificationOptions {
  body?: string;
  icon?: string;
  tag?: string;
  onlyWhenHidden?: boolean; // Mặc định chỉ hiển thị popup khi tab đang ẩn / chạy ngầm
  onClick?: () => void;
}

/**
 * Gửi thông báo ra cửa sổ trình duyệt / màn hình OS
 */
export function sendBrowserNotification(
  title: string,
  options?: BrowserNotificationOptions
): Notification | null {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }

  if (Notification.permission !== 'granted') {
    return null;
  }

  const onlyWhenHidden = options?.onlyWhenHidden !== false;
  const isHidden = document.hidden || document.visibilityState === 'hidden';

  // Nếu cấu hình onlyWhenHidden và tab đang hiển thị trước mặt user -> không cần bật OS popup (đã có In-App UI)
  if (onlyWhenHidden && !isHidden) {
    return null;
  }

  try {
    const notification = new Notification(title, {
      body: options?.body || '',
      icon: options?.icon || '/favicon.ico',
      tag: options?.tag, // Giúp gộp các thông báo cùng ngữ cảnh, tránh spam
    });

    notification.onclick = () => {
      // Focus tab trình duyệt
      window.focus();

      if (options?.onClick) {
        options.onClick();
      }

      notification.close();
    };

    return notification;
  } catch (error) {
    console.warn('Không thể hiển thị Browser Notification:', error);
    return null;
  }
}
