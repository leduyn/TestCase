# Kế hoạch Tái cấu trúc Trang Task Detail

**Mục tiêu**: Nâng cấp trang chi tiết nhiệm vụ hiển thị dạng Full Screen, chuyển Lịch sử Snapshot sang cột phải, và xem snapshot trực quan (fill dữ liệu lên UI thay vì hiển thị JSON thô).

---

## Giai đoạn 1 — Bố cục Full Screen & 2 cột

**Phạm vi**: Chỉ thay đổi layout, KHÔNG thay đổi logic dữ liệu.

### Công việc:
- [x] Xóa wrapper `max-w-7xl mx-auto` → đổi sang `w-full` để trang chiếm toàn bộ chiều ngang màn hình.
- [x] Tái cấu trúc grid từ `lg:grid-cols-3` (cột 2+1) sang `lg:grid-cols-12` (cột 8+4) để có không gian nội dung rộng hơn.
- [x] Cột trái (span 8): Giữ nguyên **Nội dung & Yêu cầu** + **Tabs Trường dữ liệu / Todos / Bình luận / Tệp tin**.
- [x] Cột phải (span 4): Khối **Thông tin thời hạn & Phân công**, phía dưới là khối **Lịch sử Snapshot** (placeholder chờ giai đoạn 2).
- [x] Loại bỏ tab **"Lịch sử thay đổi"** khỏi danh sách tab bên cột trái.
- [x] Thêm Top Header Bar: Breadcrumb + Tên task + StatusBadge + Nút hành động (gọn hơn).

**Kết quả**: Giao diện full screen đồng bộ với trang TestCase Detail, bố cục rõ ràng, thoáng rộng.

---

## Giai đoạn 2 — Lịch sử Snapshot Timeline ở cột phải

**Phạm vi**: Di chuyển hiển thị lịch sử lên cột phải với thiết kế timeline.

### Công việc:
- [x] Tạo block SnapshotTimeline trong cột phải, ngay dưới Thông tin thời hạn.
- [x] Hiển thị danh sách `task.histories[]` từ mới đến cũ.
- [x] Mỗi item: Version badge (v1, v2...), loại thay đổi, mô tả, người thực hiện, thời gian.
- [x] Nút "Xem lại bản này" (icon Eye) hoặc badge "Đang xem" nếu đang active.
- [x] Timeline dạng dọc với đường kẻ kết nối các version.
- [x] Giới hạn chiều cao + overflow-y-auto.

**Kết quả**: Lịch sử snapshot hiển thị rõ ràng ở cột phải, không cần đổi tab.

---

## Giai đoạn 3 — Snapshot Preview Mode (Fill dữ liệu lên UI)

**Phạm vi**: Fill dữ liệu phiên bản lịch sử lên toàn bộ giao diện.

### Công việc:
- [x] Thêm state `selectedSnapshot` và `isSnapshotMode`.
- [x] Banner cảnh báo chế độ xem lại (nền tím/indigo) với nút "Quay lại phiên bản hiện tại".
- [x] Fill dữ liệu từ snapshot lên UI:
  - snapshotData.name → Tên nhiệm vụ
  - snapshotData.content → Nội dung & Yêu cầu
  - snapshotData.currentStep → Stepper Pipeline
  - snapshotData.customFieldValues[] → Tab Custom Fields (readOnly)
  - snapshotData.todos[] → Tab Todos (chỉ đọc)
  - snapshotData.comments[] → Tab Comments (chỉ đọc)
- [x] Khóa thao tác chỉnh sửa khi isSnapshotMode = true.
- [x] Xóa modal popup JSON cũ.

**Kết quả**: Bấm version lịch sử → giao diện render đúng dữ liệu phiên bản đó. Bấm "Quay lại" → dữ liệu hiện tại.

---

## Giai đoạn 4 — Tích hợp WorkflowStepTransitionModal vào TaskDetail

**Phạm vi**: Thay popup chuyển bước cũ bằng WorkflowStepTransitionModal đã nâng cấp.

### Công việc:
- [x] Import WorkflowStepTransitionModal trong TaskDetail.tsx.
- [x] Truyền đúng props: task, targetStep, allSteps, onSuccess.
- [x] Truyền pendingCustomFields={customFieldValues}.
- [x] Loại bỏ popup chuyển bước thủ công cũ.

**Kết quả**: Trải nghiệm chuyển bước đồng bộ với Kanban Board — kiểm tra trường bắt buộc, form nhập liệu trong popup.

---

## Giai đoạn 5 — Build & Kiểm tra

- [x] npm run build trong client → 0 lỗi TypeScript.
- [x] npx tsc --noEmit trong server → tương thích API.
- [x] Kiểm tra thủ công full screen, timeline, snapshot preview, chuyển bước.

---

## Tóm tắt

| Giai đoạn | Tên | Phức tạp | Rủi ro |
|---|---|---|---|
| 1 | Bố cục Full Screen & 2 cột | Thấp | Thấp |
| 2 | Lịch sử Snapshot Timeline cột phải | Thấp | Thấp |
| 3 | Snapshot Preview Mode (Fill UI) | Cao | Trung bình |
| 4 | Tích hợp WorkflowStepTransitionModal | Thấp | Thấp |
| 5 | Build & Kiểm tra | Thấp | Thấp |

> Tất cả thay đổi chỉ nằm trong TaskDetail.tsx, tái sử dụng component hiện có. Không cần thay đổi backend hay schema database.
