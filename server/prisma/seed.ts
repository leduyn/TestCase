import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

const PERMISSIONS = [
  // TESTCASE
  { key: 'testcase:create', name: 'Tạo Test Case', category: 'TESTCASE', description: 'Tạo mới kịch bản Test Case' },
  { key: 'testcase:read', name: 'Xem Test Case', category: 'TESTCASE', description: 'Xem danh sách và chi tiết Test Case' },
  { key: 'testcase:update', name: 'Sửa Test Case', category: 'TESTCASE', description: 'Cập nhật nội dung đặc tả Test Case' },
  { key: 'testcase:delete', name: 'Xóa Test Case', category: 'TESTCASE', description: 'Xóa kịch bản Test Case' },
  { key: 'testcase:execute', name: 'Thực hiện Test Case', category: 'TESTCASE', description: 'Ghi nhận và điều chỉnh kết quả kiểm thử' },
  { key: 'testcase:import', name: 'Nhập Test Case', category: 'TESTCASE', description: 'Nhập kịch bản từ file Excel/JSON' },
  { key: 'testcase:generate', name: 'Sinh Test Case bằng AI', category: 'TESTCASE', description: 'Tự động sinh Test Case từ tài liệu đặc tả' },
  { key: 'testcase:export', name: 'Xuất Excel', category: 'TESTCASE', description: 'Xuất Test Suite ra file Excel' },

  // EXECUTION HISTORY
  { key: 'execution:read-own', name: 'Xem lịch sử test cá nhân', category: 'TESTCASE', description: 'Xem lịch sử thực thi do chính mình thực hiện' },
  { key: 'execution:read-all', name: 'Xem lịch sử test toàn đội', category: 'TESTCASE', description: 'Xem lịch sử thực thi của tất cả thành viên trong team' },

  // DASHBOARD / STATS
  { key: 'dashboard:read', name: 'Xem Dashboard', category: 'DASHBOARD', description: 'Truy cập trang tổng quan Dashboard' },
  { key: 'dashboard:user-stats:read', name: 'Xem thống kê test cá nhân', category: 'DASHBOARD', description: 'Xem biểu đồ và thống kê kết quả test cá nhân' },
  { key: 'dashboard:user-stats:read-all', name: 'Xem thống kê test toàn đội', category: 'DASHBOARD', description: 'Xem thống kê kết quả test của tất cả thành viên trên Dashboard' },

  // TESTSUITE
  { key: 'testsuite:create', name: 'Tạo Test Suite', category: 'TESTSUITE', description: 'Tạo mới bộ Test Suite' },
  { key: 'testsuite:read', name: 'Xem Test Suite', category: 'TESTSUITE', description: 'Xem danh sách và chi tiết bộ Test Suite' },
  { key: 'testsuite:update', name: 'Sửa Test Suite', category: 'TESTSUITE', description: 'Cập nhật thông tin bộ Test Suite' },
  { key: 'testsuite:delete', name: 'Xóa Test Suite', category: 'TESTSUITE', description: 'Xóa bộ Test Suite' },

  // SETTINGS
  { key: 'settings:ai:read', name: 'Xem cấu hình AI', category: 'SETTINGS', description: 'Xem danh sách các model và cấu hình AI' },
  { key: 'settings:ai:write', name: 'Cấu hình AI', category: 'SETTINGS', description: 'Thêm/Sửa/Xóa cấu hình kết nối AI' },
  { key: 'settings:prompt:read', name: 'Xem System Prompt', category: 'SETTINGS', description: 'Xem System Prompt hướng dẫn sinh Test Case' },
  { key: 'settings:prompt:write', name: 'Sửa System Prompt', category: 'SETTINGS', description: 'Chỉnh sửa System Prompt AI' },
  { key: 'settings:env:read', name: 'Xem môi trường', category: 'SETTINGS', description: 'Xem danh sách Server và Hệ điều hành (OS)' },
  { key: 'settings:env:write', name: 'Cấu hình môi trường', category: 'SETTINGS', description: 'Thêm/Sửa/Xóa Server và Hệ điều hành (OS)' },
  { key: 'settings:storage:read', name: 'Xem cấu hình lưu trữ', category: 'SETTINGS', description: 'Xem thông tin lưu trữ ảnh Local/Google Drive/SMB/FTP' },
  { key: 'settings:storage:write', name: 'Cấu hình lưu trữ', category: 'SETTINGS', description: 'Thay đổi và kiểm tra kết nối lưu trữ ảnh minh chứng' },

  // USERS & PERMISSIONS
  { key: 'users:read', name: 'Xem người dùng', category: 'USERS', description: 'Xem danh sách người dùng trong hệ thống' },
  { key: 'users:create', name: 'Tạo người dùng', category: 'USERS', description: 'Tạo tài khoản người dùng mới' },
  { key: 'users:update', name: 'Sửa người dùng', category: 'USERS', description: 'Cập nhật thông tin và vai trò người dùng' },
  { key: 'users:delete', name: 'Xóa người dùng', category: 'USERS', description: 'Xóa tài khoản người dùng' },
  { key: 'users:status', name: 'Khóa/Mở khóa tài khoản', category: 'USERS', description: 'Thay đổi trạng thái kích hoạt tài khoản' },
  { key: 'permissions:read', name: 'Xem ma trận phân quyền', category: 'USERS', description: 'Xem danh sách và cấu hình phân quyền theo vai trò' },
  { key: 'permissions:update', name: 'Cập nhật phân quyền', category: 'USERS', description: 'Chỉnh sửa quyền hạn cho các vai trò (Roles)' },
];

const ROLE_PERMISSIONS: Record<Role, string[]> = {
  ADMIN: PERMISSIONS.map((p) => p.key),
  TESTER: [
    'testcase:create',
    'testcase:read',
    'testcase:update',
    'testcase:execute',
    'testcase:import',
    'testcase:generate',
    'testcase:export',
    'execution:read-own',
    'dashboard:read',
    'dashboard:user-stats:read',
    'testsuite:create',
    'testsuite:read',
    'testsuite:update',
  ],
  VIEWER: [
    'testcase:read',
    'testcase:export',
    'execution:read-own',
    'dashboard:read',
    'dashboard:user-stats:read',
    'testsuite:read',
  ],
};

async function main() {
  console.log('🌱 Seeding permissions and role-permissions...');

  // 1. Create permissions
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: { name: perm.name, category: perm.category, description: perm.description },
      create: perm,
    });
  }
  console.log(`✅ Created/updated ${PERMISSIONS.length} permissions`);

  // 2. Create role-permission mappings
  for (const role of Object.keys(ROLE_PERMISSIONS) as Role[]) {
    const permissionKeys = ROLE_PERMISSIONS[role];
    for (const permKey of permissionKeys) {
      const permission = await prisma.permission.findUnique({ where: { key: permKey } });
      if (!permission) {
        console.warn(`⚠️ Permission not found: ${permKey}`);
        continue;
      }
      await prisma.rolePermission.upsert({
        where: {
          role_permissionId: {
            role,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          role,
          permissionId: permission.id,
        },
      });
    }
    console.log(`✅ Role ${role}: ${permissionKeys.length} permissions`);
  }

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });