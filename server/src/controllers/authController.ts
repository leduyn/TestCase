import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { UserRole } from '../Models/UserModel';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_testcase_ai_2026';

export class AuthController {
  static async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;

      if (!email || !email.trim()) {
        return res.status(400).json({ message: 'Vui lòng nhập địa chỉ email của bạn' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

      if (!user) {
        return res.status(404).json({ message: 'Không tìm thấy tài khoản với địa chỉ email này' });
      }

      if (user.status === 'PENDING') {
        return res.status(403).json({ message: 'Tài khoản đang chờ phê duyệt. Vui lòng liên hệ quản trị viên.' });
      }

      const token = crypto.randomBytes(32).toString('hex');
      const resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 phút

      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetPasswordToken: token,
          resetPasswordExpires,
        },
      });

      const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
      const resetUrl = `${origin}/reset-password?token=${token}`;

      return res.json({
        message: 'Yêu cầu đặt lại mật khẩu đã được tiếp nhận.',
        resetUrl,
        token,
      });
    } catch (error: any) {
      console.error('ForgotPassword error:', error);
      return res.status(500).json({ message: 'Lỗi máy chủ khi xử lý quên mật khẩu', error: error.message });
    }
  }

  static async verifyResetToken(req: Request, res: Response) {
    try {
      const token = (req.query.token || req.body.token) as string;

      if (!token) {
        return res.status(400).json({ valid: false, message: 'Mã token không được để trống' });
      }

      const user = await prisma.user.findFirst({
        where: {
          resetPasswordToken: token,
          resetPasswordExpires: { gt: new Date() },
        },
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      });

      if (!user) {
        return res.status(400).json({
          valid: false,
          message: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng thực hiện yêu cầu mới.',
        });
      }

      return res.json({
        valid: true,
        email: user.email,
        fullName: user.fullName,
      });
    } catch (error: any) {
      console.error('VerifyResetToken error:', error);
      return res.status(500).json({ valid: false, message: 'Lỗi máy chủ khi xác thực token', error: error.message });
    }
  }

  static async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ message: 'Vui lòng cung cấp mã token và mật khẩu mới' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'Mật khẩu mới phải có tối thiểu 6 ký tự' });
      }

      const user = await prisma.user.findFirst({
        where: {
          resetPasswordToken: token,
          resetPasswordExpires: { gt: new Date() },
        },
      });

      if (!user) {
        return res.status(400).json({
          message: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng thực hiện lại.',
        });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          resetPasswordToken: null,
          resetPasswordExpires: null,
          failedLoginAttempts: 0,
          ...(user.status === 'INACTIVE' ? { status: 'ACTIVE' } : {}),
        },
      });

      return res.json({
        message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.',
      });
    } catch (error: any) {
      console.error('ResetPassword error:', error);
      return res.status(500).json({ message: 'Lỗi máy chủ khi đặt lại mật khẩu', error: error.message });
    }
  }
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
          status: 'PENDING',
        },
      });

      return res.status(201).json({
        message: 'Đăng ký tài khoản thành công. Tài khoản đang chờ quản trị viên phê duyệt.',
        user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, status: user.status },
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

      // Kiểm tra trạng thái tài khoản trước khi cho phép đăng nhập
      if (user.status === 'PENDING') {
        return res.status(403).json({ message: 'Tài khoản đang chờ phê duyệt. Vui lòng liên hệ quản trị viên.' });
      }
      if (user.status === 'INACTIVE') {
        return res.status(403).json({ message: 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.' });
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        // Increment failed login attempts
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: { increment: 1 },
            ...(user.failedLoginAttempts >= 3 ? { status: 'INACTIVE' } : {}),
          },
        });
        return res.status(401).json({ message: 'Email hoặc mật khẩu không chính xác' });
      }

      // Reset failed login attempts on successful login
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lastLogin: new Date(),
        },
      });

      const token = jwt.sign(
        { id: user.id, email: user.email, fullName: user.fullName, role: user.role, status: user.status },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        message: 'Đăng nhập thành công',
        token,
        user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, status: user.status },
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
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          department: true,
          managerId: true,
          manager: {
            select: { id: true, fullName: true, email: true, department: true },
          },
          createdAt: true,
          lastLogin: true,
        },
      });

      if (!user) {
        return res.status(404).json({ message: 'Không tìm thấy người dùng' });
      }

      return res.json({ user });
    } catch (error: any) {
      return res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
    }
  }

  static async updateProfile(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Chưa đăng nhập' });
      }

      const { fullName, password } = req.body;
      const updateData: any = {};

      if (fullName) {
        updateData.fullName = fullName;
      }

      if (password) {
        updateData.passwordHash = await bcrypt.hash(password, 10);
      }

      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: updateData,
        select: { id: true, email: true, fullName: true, role: true, status: true },
      });

      return res.json({ message: 'Cập nhật thông tin thành công', user });
    } catch (error: any) {
      console.error('Update profile error:', error);
      return res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật', error: error.message });
    }
  }

  static async disableAccount(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Chưa đăng nhập' });
      }

      // Users can only disable their own account, admins can disable any
      await prisma.user.update({
        where: { id: req.user.id },
        data: { status: 'INACTIVE' },
      });

      return res.json({ message: 'Tài khoản đã bị vô hiệu hóa' });
    } catch (error: any) {
      console.error('Disable account error:', error);
      return res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
    }
  }

  static async toggleAccountStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;

      // Chỉ admin mới được phép kích hoạt/khóa tài khoản khác
      if (req.user?.role !== UserRole.ADMIN) {
        return res.status(403).json({ message: 'Chỉ quản trị viên mới được phép thực hiện hành động này' });
      }

      const { status } = req.body;
      if (!status || !['ACTIVE', 'INACTIVE', 'PENDING'].includes(status)) {
        return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
      }

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return res.status(404).json({ message: 'Không tìm thấy người dùng' });
      }

      await prisma.user.update({
        where: { id },
        data: { status },
      });

      return res.json({ message: `Tài khoản đã được ${status === 'ACTIVE' ? 'kích hoạt' : 'khóa'}`, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, status: user.status } });
    } catch (error: any) {
      console.error('Toggle account status error:', error);
      return res.status(500).json({ message: 'Lỗi máy chủ', error: error.message });
    }
  }
}
