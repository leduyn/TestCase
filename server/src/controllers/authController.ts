import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_testcase_ai_2026';

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      const { email, password, fullName } = req.body;

      if (!email || !password || !fullName) {
        return res.status(400).json({ message: 'Vui lòng điền đầy đủ Họ tên, Email và Mật khẩu' });
      }

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ message: 'Email đã được đăng ký trong hệ thống' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          fullName,
          role: 'TESTER',
        },
      });

      const token = jwt.sign(
        { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.status(201).json({
        message: 'Đăng ký tài khoản thành công',
        token,
        user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
      });
    } catch (error: any) {
      console.error('Register error:', error);
      return res.status(500).json({ message: 'Lỗi máy chủ khi đăng ký', error: error.message });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'Vui lòng nhập Email và Mật khẩu' });
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(401).json({ message: 'Email hoặc mật khẩu không chính xác' });
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ message: 'Email hoặc mật khẩu không chính xác' });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        message: 'Đăng nhập thành công',
        token,
        user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
      });
    } catch (error: any) {
      console.error('Login error:', error);
      return res.status(500).json({ message: 'Lỗi máy chủ khi đăng nhập', error: error.message });
    }
  }

  static async getMe(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Chưa đăng nhập' });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, email: true, fullName: true, role: true, createdAt: true },
      });

      if (!user) {
        return res.status(404).json({ message: 'Không tìm thấy người dùng' });
      }

      return res.json({ user });
    } catch (error: any) {
      return res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
    }
  }
}
