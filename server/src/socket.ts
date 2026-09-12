import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import { getRedisPubSub, onRedisReady } from './config/redis';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_testcase_ai_2026';

let io: Server | null = null;

/**
 * Khởi tạo Socket.IO Server và gắn vào HTTP Server
 */
export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Middleware xác thực JWT token cho kết nối Socket
  io.use((socket: Socket, next) => {
    try {
      const authHeader = socket.handshake.headers?.authorization;
      const token =
        socket.handshake.auth?.token ||
        (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader) ||
        socket.handshake.query?.token;

      if (!token || typeof token !== 'string') {
        return next(new Error('Authentication token missing'));
      }

      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const userId = decoded.id || decoded.userId;

      if (!userId) {
        return next(new Error('Invalid token payload: missing userId'));
      }

      socket.data.userId = userId;
      socket.data.user = decoded;
      next();
    } catch (err: any) {
      console.warn(`[Socket.IO] Auth error: ${err.message}`);
      return next(new Error(`Authentication failed: ${err.message}`));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    if (userId) {
      const userRoom = `user:${userId}`;
      socket.join(userRoom);
      console.log(`🔌 [Socket.IO] User ${userId} connected (socket ID: ${socket.id}) -> Joined ${userRoom}`);
    }

    socket.on('disconnect', (reason) => {
      console.log(`❌ [Socket.IO] User ${userId} disconnected: ${reason}`);
    });
  });

  attachRedisAdapter(io);

  console.log('✅ [Socket.IO] Server initialized successfully.');
  return io;
}

/**
 * Gắn Redis adapter để rooms/events đồng bộ cross-instance (HA).
 * Không có Redis (hoặc Redis down) thì chạy local như cũ — không chặn boot.
 */
function attachRedisAdapter(server: Server): void {
  const tryAttach = () => {
    const pubSub = getRedisPubSub();
    if (!pubSub) return false;
    try {
      server.adapter(createAdapter(pubSub.pub, pubSub.sub));
      console.log('✅ [Socket.IO] Redis adapter attached (cross-instance emit enabled).');
      return true;
    } catch (err: any) {
      console.warn(`⚠️ [Socket.IO] Redis adapter attach failed, staying local: ${err?.message || err}`);
      return false;
    }
  };

  if (!tryAttach()) {
    onRedisReady(() => {
      tryAttach();
    });
  }
}

/**
 * Lấy instance Server Socket.IO hiện tại
 */
export function getIO(): Server | null {
  return io;
}

/**
 * Gửi event đến phòng riêng của một user cụ thể
 */
export function emitToUser(userId: string, event: string, data: any): void {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

/**
 * Gửi event đến nhiều user (khử trùng lặp ID)
 */
export function emitToUsers(userIds: string[], event: string, data: any): void {
  if (!io || !userIds || userIds.length === 0) return;
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  uniqueIds.forEach((uid) => {
    io!.to(`user:${uid}`).emit(event, data);
  });
}
