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

    // Đồng bộ permissions mặc định
    await ensureDefaultPermissions();
  } catch (error: any) {
    console.error(`⚠️  [Auto-Seed] Không thể tạo tài khoản Admin mặc định:`, error.message);
  }
}

export const PERMISSIONS = [
  // TESTCASE
  { key: 'testcase:create', name: 'Tạo Test Case', category: 'TESTCASE', description: 'Tạo mới Test Case' },
  { key: 'testcase:read', name: 'Xem Test Case', category: 'TESTCASE', description: 'Xem danh sách và chi tiết Test Case' },
  { key: 'testcase:update', name: 'Sửa Test Case', category: 'TESTCASE', description: 'Cập nhật Test Case' },
  { key: 'testcase:delete', name: 'Xóa Test Case', category: 'TESTCASE', description: 'Xóa Test Case' },
  { key: 'testcase:execute', name: 'Thực hiện Test Case', category: 'TESTCASE', description: 'Chạy/Kết quả Test Case' },
  { key: 'testcase:import', name: 'Nhập Test Case', category: 'TESTCASE', description: 'Nhập từ Excel/JSON' },
  { key: 'testcase:generate', name: 'Sinh Test Case bằng AI', category: 'TESTCASE', description: 'Tự động sinh Test Case từ tài liệu' },
  { key: 'testcase:export', name: 'Xuất Excel', category: 'TESTCASE', description: 'Xuất Test Suite ra file Excel' },
  // EXECUTION HISTORY
  { key: 'execution:read-own', name: 'Xem lịch sử thực thi của mình', category: 'TESTCASE', description: 'Chỉ xem lịch sử thực thi do chính mình thực hiện' },
  { key: 'execution:read-all', name: 'Xem lịch sử thực thi của tất cả', category: 'TESTCASE', description: 'Xem lịch sử thực thi của tất cả thành viên trong team' },

  // DASHBOARD / STATS
  { key: 'dashboard:user-stats:read', name: 'Xem thống kê test cá nhân', category: 'DASHBOARD', description: 'Xem thống kê kết quả test cá nhân trên Dashboard' },
  { key: 'dashboard:user-stats:read-all', name: 'Xem thống kê test toàn đội', category: 'DASHBOARD', description: 'Xem thống kê kết quả test của tất cả Admin và Tester trên Dashboard' },

  // TESTSUITE
  { key: 'testsuite:create', name: 'Tạo Test Suite', category: 'TESTSUITE', description: 'Tạo mới Test Suite' },
  { key: 'testsuite:read', name: 'Xem Test Suite', category: 'TESTSUITE', description: 'Xem danh sách và chi tiết Test Suite' },
  { key: 'testsuite:update', name: 'Sửa Test Suite', category: 'TESTSUITE', description: 'Cập nhật Test Suite' },
  { key: 'testsuite:delete', name: 'Xóa Test Suite', category: 'TESTSUITE', description: 'Xóa Test Suite' },

  // SETTINGS
  { key: 'settings:ai:read', name: 'Xem cấu hình AI', category: 'SETTINGS', description: 'Xem danh sách cấu hình AI' },
  { key: 'settings:ai:write', name: 'Cấu hình AI', category: 'SETTINGS', description: 'Thêm/Sửa/Xóa cấu hình AI' },
  { key: 'settings:prompt:read', name: 'Xem System Prompt', category: 'SETTINGS', description: 'Xem System Prompt AI' },
  { key: 'settings:prompt:write', name: 'Sửa System Prompt', category: 'SETTINGS', description: 'Chỉnh sửa System Prompt AI' },
  { key: 'settings:env:read', name: 'Xem môi trường', category: 'SETTINGS', description: 'Xem danh sách Server/OS' },
  { key: 'settings:env:write', name: 'Cấu hình môi trường', category: 'SETTINGS', description: 'Thêm/Sửa/Xóa Server/OS' },

  // USERS
  { key: 'users:read', name: 'Xem người dùng', category: 'USERS', description: 'Xem danh sách người dùng' },
  { key: 'users:create', name: 'Tạo người dùng', category: 'USERS', description: 'Tạo tài khoản mới' },
  { key: 'users:update', name: 'Sửa người dùng', category: 'USERS', description: 'Cập nhật thông tin người dùng' },
  { key: 'users:delete', name: 'Xóa người dùng', category: 'USERS', description: 'Xóa tài khoản' },
  { key: 'users:status', name: 'Khóa/Mở khóa tài khoản', category: 'USERS', description: 'Thay đổi trạng thái Active/Inactive' },
];

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: PERMISSIONS.map(p => p.key),
  TESTER: [
    'testcase:create', 'testcase:read', 'testcase:update', 'testcase:execute',
    'testcase:import', 'testcase:generate', 'testcase:export',
    'execution:read-own',
    'dashboard:user-stats:read',
    'testsuite:create', 'testsuite:read', 'testsuite:update',
  ],
  VIEWER: [
    'testcase:read', 'testcase:export',
    'execution:read-own',
    'dashboard:user-stats:read',
    'testsuite:read',
  ],
};

export async function ensureDefaultPermissions(): Promise<void> {
  try {
    // 1. Create / Update permissions
    for (const perm of PERMISSIONS) {
      await prisma.permission.upsert({
        where: { key: perm.key },
        update: { name: perm.name, category: perm.category, description: perm.description },
        create: perm,
      });
    }

    // 2. Ensure role-permission mappings
    for (const role of ['ADMIN', 'TESTER', 'VIEWER'] as const) {
      const keys = ROLE_PERMISSIONS[role] || [];
      for (const permKey of keys) {
        const perm = await prisma.permission.findUnique({ where: { key: permKey } });
        if (!perm) continue;
        await prisma.rolePermission.upsert({
          where: {
            role_permissionId: {
              role,
              permissionId: perm.id,
            },
          },
          update: {},
          create: {
            role,
            permissionId: perm.id,
          },
        });
      }
    }
    console.log(`🛡️ [Auto-Seed] Đã đồng bộ ${PERMISSIONS.length} permissions & role-permissions.`);
  } catch (error: any) {
    console.error(`⚠️ [Auto-Seed] Lỗi đồng bộ permissions:`, error.message);
  }
}
