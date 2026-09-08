import { io, Socket } from 'socket.io-client';
import type { AppNotification } from '../types/notification';

let socket: Socket | null = null;

/**
 * Lấy instance socket hiện tại
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * Khởi tạo hoặc tái sử dụng kết nối Socket.IO tới Server
 */
export function connectSocket(token?: string): Socket {
  const authToken = token || localStorage.getItem('auth_token');

  if (socket) {
    if (socket.connected) {
      return socket;
    }
    socket.disconnect();
    socket = null;
  }

  // Kết nối tới origin hiện tại (thông qua proxy Vite dev hoặc domain production)
  socket = io(window.location.origin, {
    path: '/socket.io',
    auth: {
      token: authToken,
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
    timeout: 20000,
  });

  socket.on('connect', () => {
    console.log(`🔌 [Socket.IO Client] Connected successfully (id: ${socket?.id})`);
  });

  socket.on('connect_error', (error) => {
    console.warn('⚠️ [Socket.IO Client] Connection error:', error.message);
  });

  socket.on('disconnect', (reason) => {
    console.log(`❌ [Socket.IO Client] Disconnected: ${reason}`);
  });

  return socket;
}

/**
 * Ngắt kết nối Socket.IO (khi logout)
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('🛑 [Socket.IO Client] Socket explicitly disconnected');
  }
}

/**
 * Đăng ký lắng nghe thông báo mới
 */
export function onNotificationNew(callback: (notification: AppNotification) => void): () => void {
  if (!socket) {
    connectSocket();
  }
  socket?.on('notification:new', callback);
  return () => {
    socket?.off('notification:new', callback);
  };
}

/**
 * Đăng ký lắng nghe cập nhật số lượng thông báo chưa đọc
 */
export function onNotificationUnreadCount(callback: (data: { unreadCount: number }) => void): () => void {
  if (!socket) {
    connectSocket();
  }
  socket?.on('notification:unread_count', callback);
  return () => {
    socket?.off('notification:unread_count', callback);
  };
}

/**
 * Đăng ký lắng nghe trạng thái đã đọc từ tab khác
 */
export function onNotificationRead(callback: (data: { id?: string; all?: boolean }) => void): () => void {
  if (!socket) {
    connectSocket();
  }
  socket?.on('notification:read', callback);
  return () => {
    socket?.off('notification:read', callback);
  };
}
