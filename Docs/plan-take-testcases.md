# Plan: Nút "Lấy testcase" cấp bộ executions cho user trong Suite

> Thay thế phương án auto-provision khi mở suite bằng một nút tường minh **"Lấy testcase"**
> trong trang `/suites/:id` (SuiteDetail).

## Mục tiêu
Khi user (có quyền `testcase:execute`) bấm **Lấy testcase**, hệ thống tạo một execution
trạng thái `UNTESTED` (`createdById = user`, `executedById = user`) cho **mọi Test Case đã
kiểm duyệt (REVIEWED)** trong bộ suite mà user **chưa test** — tức chưa có execution nào
với cặp `(testCaseId, createdById = user)`.

Lịch sử test của user được xác định dựa trên 2 trường: `test_case_id` + `created_by_id`.
Vùng "Test case chưa nhận" / "Nhận & bắt đầu" giữ nguyên làm fallback.

## Server (`server/src`)
**`controllers/testCaseController.ts`**
- Thêm `import { hasPermission } from '../services/permissionService';`
- Thêm static method `provisionExecutions(req, res)`:
  1. `const { id } = req.params; const currentUserId = req.user?.id;`
  2. Load suite + REVIEWED test case ids:
     `prisma.testSuite.findUnique({ where:{id}, include:{ testCases:{ where:{reviewStatus:'REVIEWED'}, select:{id:true} } } })`
     → 404 nếu không tìm thấy.
  3. Tìm các execution đã có `createdById = currentUserId` trong tập case ids
     (`findMany`, `select:{testCaseId:true}`).
  4. `missing = caseIds.filter(cid => !existingIds.has(cid))`.
  5. Nếu `missing.length > 0`: `prisma.testExecution.createMany({ data: missing.map(cid => ({
     testCaseId: cid, status:'UNTESTED', createdById: currentUserId, executedById: currentUserId })) })`
     (`executedAt` dùng `@default(now())`).
  6. Trả `{ message, created: missing.length, testCaseIds: missing }`.
  - **Idempotent**: bấm lại không tạo trùng (đã có row thì bỏ qua).
  - Chỉ tạo cho user hiện tại (`createdById = currentUserId`).

**`routes/testCaseRoutes.ts`**
- Thêm: `router.post('/suites/:id/provision', authenticate, requirePermission('testcase:execute'), TestCaseController.provisionExecutions);`
- Không conflict với `GET /suites/:id`.

## Client (`client/src`)
**`services/api.ts`** (trong `testCaseApi`)
- `takeTestCases: (id: string) => api.post<{ message: string; created: number; testCaseIds: string[] }>('/testcases/suites/' + id + '/provision');`

**`pages/SuiteDetail.tsx`**
- State `taking` (loading).
- `handleTakeTestCases`: gọi `testCaseApi.takeTestCases(id)` → `finally` gọi lại
  `fetchSuiteDetails()` để làm tươi `testCases` + `unreceivedTestCases`.
- Nút **"Lấy testcase"** ở toolbar/header trang (luôn hiển thị, idempotent),
  chỉ render khi `canExecuteTestCase`, disable khi `taking`.
- Giữ nguyên zone "Test case chưa nhận" / "Nhận & bắt đầu" (fallback).

## Verify
- `cd server && npx tsc --noEmit` và `cd client && npm run build`.
- Chạy server; user TESTER (có `testcase:execute`): mở suite có case REVIEWED chưa test
  → bấm **Lấy testcase** → `created = N`; board hiển thị các case đó với
  `latestExecution.status === 'UNTESTED'`, `createdById === me`; `unreceivedTestCases` rỗng.
  Bấm lại → `created: 0`.
- User không có `testcase:execute`: nút ẩn; gọi trực tiếp `POST .../provision` → 403.
