-- ============================================================
-- Migration: Cập nhật phân quyền - Sync role_permissions
-- Date: 2026-09-08
-- Description: Đảm bảo tất cả permissions tồn tại trong DB
--              và role_permissions được đồng bộ theo ROLE_PERMISSIONS config
-- ============================================================

-- -------------------------------------------------------
-- 1. Ensure all permissions exist in the permissions table
--    (Insert any missing permissions, update name/description if changed)
-- -------------------------------------------------------

-- TESTCASE
INSERT INTO "permissions" ("id", "key", "name", "category", "description", "isSystem", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'testcase:create', 'Tạo Test Case', 'TESTCASE', 'Tạo mới kịch bản Test Case', true, NOW(), NOW()),
  (gen_random_uuid(), 'testcase:read', 'Xem Test Case', 'TESTCASE', 'Xem danh sách và chi tiết Test Case', true, NOW(), NOW()),
  (gen_random_uuid(), 'testcase:update', 'Sửa Test Case', 'TESTCASE', 'Cập nhật nội dung đặc tả Test Case', true, NOW(), NOW()),
  (gen_random_uuid(), 'testcase:delete', 'Xóa Test Case', 'TESTCASE', 'Xóa kịch bản Test Case', true, NOW(), NOW()),
  (gen_random_uuid(), 'testcase:execute', 'Thực hiện Test Case', 'TESTCASE', 'Ghi nhận và điều chỉnh kết quả kiểm thử', true, NOW(), NOW()),
  (gen_random_uuid(), 'testcase:import', 'Nhập Test Case', 'TESTCASE', 'Nhập kịch bản từ file Excel/JSON', true, NOW(), NOW()),
  (gen_random_uuid(), 'testcase:generate', 'Sinh Test Case bằng AI', 'TESTCASE', 'Tự động sinh Test Case từ tài liệu đặc tả', true, NOW(), NOW()),
  (gen_random_uuid(), 'testcase:export', 'Xuất Excel', 'TESTCASE', 'Xuất Test Suite ra file Excel', true, NOW(), NOW())
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "category" = EXCLUDED."category",
  "description" = EXCLUDED."description",
  "updated_at" = NOW();

-- EXECUTION HISTORY
INSERT INTO "permissions" ("id", "key", "name", "category", "description", "isSystem", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'execution:read-own', 'Xem lịch sử test cá nhân', 'TESTCASE', 'Xem lịch sử thực thi do chính mình thực hiện', true, NOW(), NOW()),
  (gen_random_uuid(), 'execution:read-all', 'Xem lịch sử test toàn đội', 'TESTCASE', 'Xem lịch sử thực thi của tất cả thành viên trong team', true, NOW(), NOW())
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "category" = EXCLUDED."category",
  "description" = EXCLUDED."description",
  "updated_at" = NOW();

-- TESTCASE REVIEW
INSERT INTO "permissions" ("id", "key", "name", "category", "description", "isSystem", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'testcase:review', 'Kiểm duyệt Test Case', 'TESTCASE', 'Chuyển Test Case từ Chưa kiểm duyệt sang Đã kiểm duyệt', true, NOW(), NOW())
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "category" = EXCLUDED."category",
  "description" = EXCLUDED."description",
  "updated_at" = NOW();

-- DASHBOARD
INSERT INTO "permissions" ("id", "key", "name", "category", "description", "isSystem", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'dashboard:read', 'Xem Dashboard', 'DASHBOARD', 'Truy cập trang tổng quan Dashboard', true, NOW(), NOW()),
  (gen_random_uuid(), 'dashboard:user-stats:read', 'Xem thống kê test cá nhân', 'DASHBOARD', 'Xem biểu đồ và thống kê kết quả test cá nhân', true, NOW(), NOW()),
  (gen_random_uuid(), 'dashboard:user-stats:read-all', 'Xem thống kê test toàn đội', 'DASHBOARD', 'Xem thống kê kết quả test của tất cả thành viên trên Dashboard', true, NOW(), NOW())
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "category" = EXCLUDED."category",
  "description" = EXCLUDED."description",
  "updated_at" = NOW();

-- TESTSUITE
INSERT INTO "permissions" ("id", "key", "name", "category", "description", "isSystem", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'testsuite:create', 'Tạo Test Suite', 'TESTSUITE', 'Tạo mới bộ Test Suite', true, NOW(), NOW()),
  (gen_random_uuid(), 'testsuite:read', 'Xem Test Suite', 'TESTSUITE', 'Xem danh sách và chi tiết bộ Test Suite', true, NOW(), NOW()),
  (gen_random_uuid(), 'testsuite:update', 'Sửa Test Suite', 'TESTSUITE', 'Cập nhật thông tin bộ Test Suite', true, NOW(), NOW()),
  (gen_random_uuid(), 'testsuite:delete', 'Xóa Test Suite', 'TESTSUITE', 'Xóa bộ Test Suite', true, NOW(), NOW())
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "category" = EXCLUDED."category",
  "description" = EXCLUDED."description",
  "updated_at" = NOW();

-- SETTINGS
INSERT INTO "permissions" ("id", "key", "name", "category", "description", "isSystem", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'settings:ai:read', 'Xem cấu hình AI', 'SETTINGS', 'Xem danh sách các model và cấu hình AI', true, NOW(), NOW()),
  (gen_random_uuid(), 'settings:ai:write', 'Cấu hình AI', 'SETTINGS', 'Thêm/Sửa/Xóa cấu hình kết nối AI', true, NOW(), NOW()),
  (gen_random_uuid(), 'settings:prompt:read', 'Xem System Prompt', 'SETTINGS', 'Xem System Prompt hướng dẫn sinh Test Case', true, NOW(), NOW()),
  (gen_random_uuid(), 'settings:prompt:write', 'Sửa System Prompt', 'SETTINGS', 'Chỉnh sửa System Prompt AI', true, NOW(), NOW()),
  (gen_random_uuid(), 'settings:env:read', 'Xem môi trường', 'SETTINGS', 'Xem danh sách Server và Hệ điều hành (OS)', true, NOW(), NOW()),
  (gen_random_uuid(), 'settings:env:write', 'Cấu hình môi trường', 'SETTINGS', 'Thêm/Sửa/Xóa Server và Hệ điều hành (OS)', true, NOW(), NOW()),
  (gen_random_uuid(), 'settings:storage:read', 'Xem cấu hình lưu trữ', 'SETTINGS', 'Xem thông tin lưu trữ ảnh Local/Google Drive/SMB/FTP', true, NOW(), NOW()),
  (gen_random_uuid(), 'settings:storage:write', 'Cấu hình lưu trữ', 'SETTINGS', 'Thay đổi và kiểm tra kết nối lưu trữ ảnh minh chứng', true, NOW(), NOW())
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "category" = EXCLUDED."category",
  "description" = EXCLUDED."description",
  "updated_at" = NOW();

-- USERS & PERMISSIONS
INSERT INTO "permissions" ("id", "key", "name", "category", "description", "isSystem", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'users:read', 'Xem người dùng', 'USERS', 'Xem danh sách người dùng trong hệ thống', true, NOW(), NOW()),
  (gen_random_uuid(), 'users:create', 'Tạo người dùng', 'USERS', 'Tạo tài khoản người dùng mới', true, NOW(), NOW()),
  (gen_random_uuid(), 'users:update', 'Sửa người dùng', 'USERS', 'Cập nhật thông tin và vai trò người dùng', true, NOW(), NOW()),
  (gen_random_uuid(), 'users:delete', 'Xóa người dùng', 'USERS', 'Xóa tài khoản người dùng', true, NOW(), NOW()),
  (gen_random_uuid(), 'users:status', 'Khóa/Mở khóa tài khoản', 'USERS', 'Thay đổi trạng thái kích hoạt tài khoản', true, NOW(), NOW()),
  (gen_random_uuid(), 'permissions:read', 'Xem ma trận phân quyền', 'USERS', 'Xem danh sách và cấu hình phân quyền theo vai trò', true, NOW(), NOW()),
  (gen_random_uuid(), 'permissions:update', 'Cập nhật phân quyền', 'USERS', 'Chỉnh sửa quyền hạn cho các vai trò (Roles)', true, NOW(), NOW())
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "category" = EXCLUDED."category",
  "description" = EXCLUDED."description",
  "updated_at" = NOW();

-- PROPOSAL
INSERT INTO "permissions" ("id", "key", "name", "category", "description", "isSystem", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'proposal:read', 'Xem Đề xuất', 'PROPOSAL', 'Xem danh sách và chi tiết đề xuất', true, NOW(), NOW()),
  (gen_random_uuid(), 'proposal:create', 'Tạo Đề xuất', 'PROPOSAL', 'Tạo đề xuất mới', true, NOW(), NOW()),
  (gen_random_uuid(), 'proposal:approve', 'Duyệt Đề xuất', 'PROPOSAL', 'Duyệt đề xuất chuyển sang trạng thái APPROVED', true, NOW(), NOW()),
  (gen_random_uuid(), 'proposal:reject', 'Từ chối Đề xuất', 'PROPOSAL', 'Từ chối đề xuất chuyển sang trạng thái REJECTED', true, NOW(), NOW())
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "category" = EXCLUDED."category",
  "description" = EXCLUDED."description",
  "updated_at" = NOW();

-- WORKFLOW & PROCESS & TASK
INSERT INTO "permissions" ("id", "key", "name", "category", "description", "isSystem", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'workflow:process:read', 'Xem Quy trình', 'WORKFLOW', 'Xem danh sách và chi tiết các quy trình nghiệp vụ', true, NOW(), NOW()),
  (gen_random_uuid(), 'workflow:process:write', 'Quản lý Quy trình', 'WORKFLOW', 'Tạo mới, chỉnh sửa, xóa quy trình và các bước thực thi', true, NOW(), NOW()),
  (gen_random_uuid(), 'workflow:task:read', 'Xem Nhiệm vụ', 'WORKFLOW', 'Xem danh sách và chi tiết nhiệm vụ quy trình', true, NOW(), NOW()),
  (gen_random_uuid(), 'workflow:task:write', 'Quản lý Nhiệm vụ', 'WORKFLOW', 'Tạo mới, cập nhật, chuyển bước, hoàn thành, hủy nhiệm vụ', true, NOW(), NOW()),
  (gen_random_uuid(), 'workflow:report:read', 'Xem Báo cáo Workflow', 'WORKFLOW', 'Xem biểu đồ và thống kê hiệu suất quy trình & nhiệm vụ', true, NOW(), NOW())
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "category" = EXCLUDED."category",
  "description" = EXCLUDED."description",
  "updated_at" = NOW();

-- -------------------------------------------------------
-- 2. Sync role_permissions for all roles
--    First, collect permission IDs into a temp table
-- -------------------------------------------------------

CREATE TEMP TABLE IF NOT EXISTS _perm_lookup AS
SELECT "key", "id" FROM "permissions";

-- -------------------------------------------------------
-- 2a. ADMIN: Full permissions (all permissions in table)
-- -------------------------------------------------------

-- Remove all existing role_permissions for ADMIN, then re-add all
DELETE FROM "role_permissions" WHERE "role" = 'ADMIN';

INSERT INTO "role_permissions" ("id", "role", "permission_id", "granted_at")
SELECT gen_random_uuid(), 'ADMIN', p.id, NOW()
FROM _perm_lookup p;

-- -------------------------------------------------------
-- 2b. MANAGER permissions
-- -------------------------------------------------------

DELETE FROM "role_permissions" WHERE "role" = 'MANAGER';

INSERT INTO "role_permissions" ("id", "role", "permission_id", "granted_at")
SELECT gen_random_uuid(), 'MANAGER', p.id, NOW()
FROM _perm_lookup p
WHERE p."key" IN (
  'workflow:process:read', 'workflow:process:write',
  'workflow:task:read', 'workflow:task:write',
  'workflow:report:read',
  'dashboard:read', 'dashboard:user-stats:read', 'dashboard:user-stats:read-all',
  'testcase:read', 'testcase:execute', 'testcase:review', 'testcase:export',
  'testsuite:read', 'users:read'
);

-- -------------------------------------------------------
-- 2c. TESTER permissions
-- -------------------------------------------------------

DELETE FROM "role_permissions" WHERE "role" = 'TESTER';

INSERT INTO "role_permissions" ("id", "role", "permission_id", "granted_at")
SELECT gen_random_uuid(), 'TESTER', p.id, NOW()
FROM _perm_lookup p
WHERE p."key" IN (
  'testcase:create', 'testcase:read', 'testcase:update', 'testcase:execute',
  'testcase:import', 'testcase:generate', 'testcase:export',
  'execution:read-own', 'execution:read-all', 'testcase:review',
  'dashboard:read', 'dashboard:user-stats:read',
  'testsuite:create', 'testsuite:read', 'testsuite:update',
  'workflow:process:read', 'workflow:task:read', 'workflow:task:write',
  'workflow:report:read'
);

-- -------------------------------------------------------
-- 2d. USER permissions
-- -------------------------------------------------------

DELETE FROM "role_permissions" WHERE "role" = 'USER';

INSERT INTO "role_permissions" ("id", "role", "permission_id", "granted_at")
SELECT gen_random_uuid(), 'USER', p.id, NOW()
FROM _perm_lookup p
WHERE p."key" IN (
  'workflow:process:read', 'workflow:task:read', 'workflow:task:write',
  'dashboard:read'
);

-- -------------------------------------------------------
-- 2e. VIEWER permissions
-- -------------------------------------------------------

DELETE FROM "role_permissions" WHERE "role" = 'VIEWER';

INSERT INTO "role_permissions" ("id", "role", "permission_id", "granted_at")
SELECT gen_random_uuid(), 'VIEWER', p.id, NOW()
FROM _perm_lookup p
WHERE p."key" IN (
  'testcase:read', 'testcase:export',
  'execution:read-own', 'dashboard:read', 'dashboard:user-stats:read',
  'testsuite:read', 'workflow:process:read', 'workflow:task:read'
);

-- -------------------------------------------------------
-- 3. Clean up temp table
-- -------------------------------------------------------

DROP TABLE IF EXISTS _perm_lookup;

-- -------------------------------------------------------
-- 4. Remove permissions that are no longer in any role
--    (orphan permissions - not assigned to any role and not user-specific)
-- -------------------------------------------------------

DELETE FROM "permissions"
WHERE "key" NOT IN (
  SELECT DISTINCT p2."key" FROM "permissions" p2
  INNER JOIN "role_permissions" rp ON rp."permission_id" = p2."id"
)
AND "isSystem" = true;

-- Note: If user-specific permissions exist, those permissions will be kept
-- because they may be needed for DENY/ALLOW overrides
