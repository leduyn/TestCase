# Task List - Cải tiến "Nhận & Bắt đầu" Test Execution

## Bước 1 (Backend - Core Query) ✅
- [x] Sửa `pickLatestExecution` ưu tiên `currentUserId`
- [x] Sửa `pickLatestVisibleExecution` ưu tiên `currentUserId`

## Bước 2 (Backend - Provisioning) ✅
- [x] Cải tiến `provisionExecutions`: `beforeExecutedId = null`, hỗ trợ `newRound`, `watcherIds`

## Bước 3 (Client - API Service) ✅
- [x] Cập nhật `takeTestCases` hỗ trợ `newRound`, `watcherIds`

## Bước 4 (Client - Modal UI) ✅
- [x] Tạo `ReceiveTestCasesModal.tsx` cho chọn watchers và xác nhận

## Bước 5 (Client - SuiteDetail Integration)
- [x] Import `ReceiveTestCasesModal` (đã có)
- [x] Thêm state `receiveModalConfig` (đã có)
- [x] Thêm `handleOpenTakeModal`, `handleOpenNewRoundModal`, `handleOpenReceiveModuleModal` (đã có)
- [x] Thêm `handleConfirmReceive` (đã có)
- [x] Thêm nút "Nhận lượt test mới" trên Toolbar (đã có)
- [ ] **Render `<ReceiveTestCasesModal>` trong JSX** (THIẾU)
- [ ] **Sửa `handleReceiveModule` → dùng `handleOpenReceiveModuleModal`** (BUG)

## Bước 6 (Client - Execution Drawer)
- [ ] Kiểm tra hiển thị lượt test và watchers

## Bước 7 (Verification & Build)
- [ ] Chạy TypeScript compile check server
- [ ] Chạy TypeScript compile check client
