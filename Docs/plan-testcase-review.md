# Plan: Tách trạng thái kiểm duyệt Test Case khỏi Execution + trường `createdById` (own_executions)

> Trạng thái duyệt thuộc về **Test Case** (Chưa kiểm duyệt / Đã kiểm duyệt).
> Execution bắt đầu từ **UNTESTED**, không còn UNREVIEWED.
> Thêm trường `createdById` (người tạo execution) để biết "own_executions".

## 1. Thay đổi schema (`server/prisma/schema.prisma`)
- **Enum mới** `TestCaseReviewStatus { UNREVIEWED REVIEWED }`.
- **TestCase**: thêm
  - `reviewStatus TestCaseReviewStatus @default(UNREVIEWED) @map("review_status")`
  - `reviewedById String? @map("reviewed_by_id")`
  - `reviewedAt DateTime? @map("reviewed_at")`
- **TestExecution**:
  - Xóa `UNREVIEWED` khỏi `enum TestExecutionStatus` (giữ `UNTESTED, PASSED, FAILED, BLOCKED, RETEST`); default `@default(UNTESTED)`.
  - Thêm `createdById String? @map("created_by_id")` + relation `createdBy User? @relation("CreatedExecution", fields:[createdById], references:[id], onDelete:SetNull)`.
  - Giữ nguyên `executedById` (người thực thi bước tiếp theo) và `beforeExecutedId`.
- **User**: thêm back-relation `createdExecutions TestExecution[]` (quan hệ đã có `executedExecutions`/`beforeExecutions`).

## 2. Migration & backfill dữ liệu
- Script 1: `UPDATE test_executions SET status='UNTESTED' WHERE status='UNREVIEWED';`
- Script 2 (quan trọng): `UPDATE test_executions SET created_by_id = executed_by_id WHERE created_by_id IS NULL;`
  - để dữ liệu cũ có người tạo, không bị mất lịch sử under scoping mới.
- `prisma db push` + regenerate client (môi trường này `migrate dev` bị block, dùng `db push`; lưu ý khóa engine khi backend đang chạy → tkill như trước).

## 3. Phân quyền
- `server/src/services/adminSeed.ts`: thay `execution:set-UNREVIEWED` → `testcase:review` (name "Kiểm duyệt Test Case", category TESTCASE); gán vào role phù hợp.
- `permissionService.ts`: thêm `canReviewTestCase(userId, role)` = ADMIN || `hasPermission('testcase:review')`.
- Xóa mọi tham chiếu `execution:set-UNREVIEWED` (server validStatuses, client lists, excel).

## 4. Server controllers
**testCaseController.ts**
- `createTestCase` / `importTestCase`: **không** tạo execution khởi tạo; set `reviewStatus:'UNREVIEWED'`; trả `latestExecution:null`.
- Endpoint mới `PATCH /testcases/:id/review` (guard `canReviewTestCase`): set `reviewStatus:'REVIEWED'`, `reviewedById`, `reviewedAt`.
- `getSuiteById` (bảng Suite chi tiết) & `getSuites` (Dashboard): lọc testCases `reviewStatus:'REVIEWED'` **và** (canViewAll || user có execution trên case đó: `createdById===userId || executedById===userId`). Include `createdBy` trong executions (cùng `executedBy`,`beforeExecutedBy`).
- `pickLatestExecution`: với user thường trả latest của chính họ (giữ nguyên); test case chỉ xuất hiện nếu họ có execution.

**executionController.ts**
- `executeTestCase`: set `createdById = req.user.id`, `executedById = targetHandlerId`, default status `UNTESTED`. Không dùng UNREVIEWED.
- `updateExecution`: giữ nguyên `createdById` (cố định, không đổi).
- Trả về `createdBy` trong include.

**exportController.ts & excelExporter.ts**
- Scope executions theo `createdById===userId || executedById===userId` (thay vì chỉ `executedById`).
- "Mới nhất theo testcase_id": gom theo `testCaseId`, lấy execution mới nhất trong số execution **của user** (own_executions). Thêm thông tin người tạo (`createdBy`).
- Bỏ nhãn/color UNREVIEWED trong excel.

**Lịch sử (SuiteDetail "Lịch sử")**: lọc executions theo own_executions (createdById/executedById) mỗi test case.

## 5. Client
**types/index.ts**: `ExecutionStatus` bỏ UNREVIEWED; `TestExecution` thêm `createdById?`/`createdBy?`; `TestCase` thêm `reviewStatus`, `reviewedById?`, `reviewedAt?`.

**Kanban (`TestCaseKanbanBoard.tsx`)**: xóa cột `UNREVIEWED` khỏi `STATUS_INFO` + `columnsConfig` + default mới (`'UNTESTED'`) + quick-status + grouping; include `createdBy` vào `dropHandlerOptions` (label "Người tạo thực thi").

**ExecutionDrawer.tsx**: bỏ `UNREVIEWED` khỏi `EXECUTION_STATUS_LIST`; default mới `'UNTESTED'`; thêm `activeExecution.createdBy` vào danh sách người thực thi bước tiếp theo (label "Người tạo").

**SuiteDetail.tsx**: bỏ filter nút `UNREVIEWED`; "Lịch sử" chỉ hiện own_executions; hiển thị badge review status nếu cần.

**Trang quản lý Test Case mới (`pages/TestCaseManagement.tsx` + route `/testcase-management`, link trên Navbar)**:
- Bảng tất cả Test Case (theo suite) kèm `reviewStatus`, người duyệt, thời gian.
- Filter: Chưa kiểm duyệt / Đã kiểm duyệt / Tất cả.
- Nút "Đánh dấu đã kiểm duyệt" (enable nếu `canReviewTestCase`) → gọi `PATCH /testcases/:id/review`.

**Danh sách người thực thi bước tiếp theo** (cả Kanban & Drawer): bổ sung `createdBy` (người tạo thực thi) làm ứng viên, bên cạnh eligible + trước đây.

## 6. Giả định đã chọn: (A) "Test case chưa nhận"
- Test case ĐÃ kiểm duyệt nhưng chưa ai test sẽ không hiện trong danh sách thường của user.
- Thêm tab/zone **"Test case chưa nhận"** (chỉ hiện với user có quyền `execution:set-UNTESTED`) liệt kê các case ĐÃ kiểm duyệt chưa có execution, với nút **"Nhận & bắt đầu"** tạo execution UNTESTED đầu tiên (`createdById=me`).
- Sau khi nhận, case xuất hiện trong danh sách của họ.

## 7. Kiểm tra
- `npx tsc --noEmit` cả server & client.
- Restart backend (xử lý khóa engine như trước).
- Test kịch bản: tạo Test Case → mặc định "Chưa kiểm duyệt" (không có execution) → trang quản lý duyệt → vào Suite → "Ghi nhận kết quả mới" tạo execution UNTESTED (createdById=người tạo) → kéo thả chuyển bước, popup có "Người tạo thực thi" → export/history chỉ hiện own_executions.
