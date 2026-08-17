import bcrypt from 'bcryptjs';
import prisma from '../config/database';

export const DEFAULT_ADMIN = {
  fullName: 'lê Đuyn',
  email: 'it@tanthinh68.vn',
  password: '123456',
  role: 'ADMIN' as const,
  status: 'ACTIVE' as const,
};

/**
 * Tự động kiểm tra và khởi tạo/cập nhật tài khoản Admin mặc định
 */
export async function ensureDefaultAdmin(): Promise<void> {
  try {
    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN.password, 10);

    const existingAdmin = await prisma.user.findUnique({
      where: { email: DEFAULT_ADMIN.email },
    });

    if (!existingAdmin) {
      await prisma.user.create({
        data: {
          email: DEFAULT_ADMIN.email,
          fullName: DEFAULT_ADMIN.fullName,
          passwordHash,
          role: DEFAULT_ADMIN.role,
          status: DEFAULT_ADMIN.status,
        },
      });
      console.log(`👤 [Auto-Seed] Đã tạo tài khoản Admin mặc định: ${DEFAULT_ADMIN.email}`);
    } else {
      // Cập nhật thông tin nếu đã tồn tại để đảm bảo role ADMIN và mật khẩu chính xác
      await prisma.user.update({
        where: { email: DEFAULT_ADMIN.email },
        data: {
          fullName: DEFAULT_ADMIN.fullName,
          passwordHash,
          role: DEFAULT_ADMIN.role,
          status: DEFAULT_ADMIN.status,
          failedLoginAttempts: 0,
        },
      });
      console.log(`👤 [Auto-Seed] Đã cập nhật/đồng bộ tài khoản Admin: ${DEFAULT_ADMIN.email}`);
    }
  } catch (error: any) {
    console.error(`⚠️  [Auto-Seed] Không thể tạo tài khoản Admin mặc định:`, error.message);
  }
}
