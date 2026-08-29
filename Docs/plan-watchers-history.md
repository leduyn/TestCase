# Plan: Watchers + Execution History Snapshots

## Nguyên lý
1. **Watchers**: bảng trung gian `TestExecutionWatcher`; quản lý bởi creator / executor / admin.
2. **History**: bảng `TestExecutionHistory` = sao chép cấu trúc `test_executions` + trường `execution_id`. Mỗi lần tạo/cập nhật execution → thêm 1 dòng snapshot vào `test_execution_histories`; dòng live trong `test_executions` luôn là bản mới nhất.
3. **Dedup**: mỗi `(testCaseId, createdById)` = 1 execution. Đổi trạng thái = UPDATE dòng đó + thêm snapshot (không tạo execution mới).
4. **Drawer timeline** = các snapshot của execution đang chọn.

## Schema (server/prisma/schema.prisma)
- `TestExecutionWatcher { id, executionId, userId, user, createdAt }` unique(executionId, userId)
- `TestExecutionHistory` mirror của `TestExecution` + `executionId` (FK), relation names HistoryExecutedBy / HistoryBeforeExecutedBy / HistoryCreatedBy
- `TestExecution` thêm `watchers TestExecutionWatcher[]` và `history TestExecutionHistory[]`

## Server
- `executionController.snapshotExecution(prisma, executionId)`: copy live state vào `testExecutionHistory`.
- `executeTestCase`: upsert theo (testCaseId, createdById=me) + snapshot + viewerIds.
- `updateExecution`: update + snapshot + viewerIds.
- `getHistory`: OR thêm `{ watchers: { some: { userId } } }` + include watchers.
- `getSnapshots(executionId)`: trả history sắp xếp updatedAt asc.
- `getWatcherCandidates`: GET watcher-users (chỉ authenticate).
- `setWatchers(executionId, userIds)`: PATCH, canManageWatchers, thay thế watcher.
- `testCaseController.getSuiteById` / `getTestCaseById`: visibility watcher-aware + include watchers.
- canManageWatchers = ADMIN || createdById===me || executedById===me.

## Client
- types: `TestExecution.watchers`, interface `TestExecutionHistory`.
- api: getSnapshots, setWatchers, getWatcherUsers; execute/update nhận viewerIds.
- ExecutionDrawer: timeline từ snapshots; khu "Người theo dõi" add/bớt; commitSave truyền viewerIds.
- DropConfirmModal: multi-select "Người theo dõi".

## Kiểm tra
- `cd server && npx tsc --noEmit` + `cd client && npm run build`
- Chạy server: đổi trạng thái nhiều lần cùng creator -> 1 dòng test_executions, nhiều snapshot; timeline đúng; watcher cập nhật; visibility đúng.
