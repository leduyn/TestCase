import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_testcase_ai_2026';

export enum UserRole {
  ADMIN = 'ADMIN',
  TESTER = 'TESTER',
  VIEWER = 'VIEWER',
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    status: string;
  };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Vui lòng đăng nhập để tiếp tục' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn' });
  }
};

export const optionalAuthenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = decoded;
    }
  } catch {
    // Ignore invalid token in optional authentication
  }
  next();
};

export const authorize = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ message: 'Bạn không có quyền truy cập recurso này' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Bạn không có quyền truy cập recurso này' });
    }

    next();
  };
};
