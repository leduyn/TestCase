# Kế hoạch triển khai: Trao đổi & Bình luận cho Test Execution

Bổ sung tính năng **Trao đổi & Bình luận** cho lượt thực thi kiểm thử (`Test Execution`), cho phép **người thực thi (executor)**, **người tạo (creator)**, **người theo dõi (watchers)** và quản trị viên có thể tương tác, trao đổi thông tin và đính kèm tài liệu minh chứng tương tự như tính năng trên hệ thống Đề xuất (`ProposalComment`).

---

## 📌 Giai đoạn 1: Cơ sở dữ liệu & Backend API

**Mục tiêu**: Thiết lập cấu trúc dữ liệu, chạy migration database và cung cấp đầy đủ các API xử lý bình luận với phân quyền chặt chẽ.

### Các công việc cụ thể:
1. **Cập nhật Prisma Schema**:
   - Thêm model `TestExecutionComment` vào `schema.prisma` (`id`, `executionId`, `userId`, `content`, `attachments`, `createdAt`, `updatedAt`).
   - Liên kết với `TestExecution` (`comments TestExecutionComment[]`) và `User` (`executionComments TestExecutionComment[]`).
2. **Tạo và thực thi Migration SQL**:
   - Tạo thư mục migration `202609040003_add_test_execution_comments/migration.sql`.
   - Chạy `npx prisma migrate deploy` để cập nhật bảng trong PostgreSQL.
   - Chạy `npx prisma generate` để cập nhật Prisma Client.
3. **Phát triển Controller & Routes**:
   - Tạo `server/src/controllers/executionCommentController.ts`:
     - `getComments`: Lấy danh sách bình luận của execution theo thứ tự tăng dần thời gian, include thông tin người gửi (`fullName`, `email`, `role`).
     - `addComment`: Kiểm tra người gửi có thuộc đối tượng được phép tham gia (người thực thi `executedById`, người tạo `createdById`, người theo dõi `watchers`, hoặc quản trị viên `ADMIN`/`MANAGER`), sau đó lưu bình luận và tệp đính kèm.
     - `deleteComment`: Cho phép người gửi hoặc quản trị viên xóa bình luận.
   - Đăng ký routes vào `server/src/routes/executionRoutes.ts`:
     - `GET /api/executions/:executionId/comments`
     - `POST /api/executions/:executionId/comments`
     - `DELETE /api/executions/:executionId/comments/:commentId`
4. **Xác minh Giai đoạn 1**:
   - Chạy `npm run build` trên `server` đảm bảo không phát sinh lỗi TypeScript.

---

## 📌 Giai đoạn 2: Xây dựng Frontend Core (Types, API Client & UI Component)

**Mục tiêu**: Xây dựng tầng giao diện độc lập cho khung Trao đổi & Bình luận, chuẩn hóa types và các hàm gọi API.

### Các công việc cụ thể:
1. **Types & API Client**:
   - Mở rộng `client/src/types/index.ts` với interface `TestExecutionComment` và bổ sung `comments?: TestExecutionComment[]` vào `TestExecution`.
   - Thêm `executionCommentApi` vào `client/src/services/api.ts` (`getComments`, `addComment`, `deleteComment`).
2. **Xây dựng Component `ExecutionCommentsSection.tsx`**:
   - Tạo file `client/src/components/ExecutionCommentsSection.tsx` với các tính năng chuẩn hóa từ Đề xuất:
     - Header: Icon `MessageSquare`, tiêu đề "Trao đổi & Bình luận ({count})".
     - Stream tin nhắn bong bóng chat (tin nhắn của tôi bên phải màu xanh/indigo, của người khác bên trái màu xám/slate).
     - Hiển thị Avatar tròn chữ cái đầu, tên, vai trò/email, thời gian gửi (giờ:phút, ngày/tháng).
     - Hiển thị tệp đính kèm (ảnh, tài liệu, file log) có thể nhấn vào để mở/tải về.
     - Khung soạn thảo tin nhắn: Textarea nhập nhiều dòng, nút đính kèm tệp qua `/api/upload`, xem trước danh sách file đã chọn kèm nút xóa trước khi gửi.
     - Xóa bình luận: Nút thùng rác xác nhận xóa cho bình luận của chính mình hoặc admin.
3. **Xác minh Giai đoạn 2**:
   - Kiểm tra component biên dịch độc lập không lỗi cú pháp và types.

---

## 📌 Giai đoạn 3: Tích hợp vào ExecutionDrawer & Tính năng Tự theo dõi (Self-watch)

**Mục tiêu**: Nhúng hoàn chỉnh khung thảo luận vào màn hình kiểm thử và tăng cường khả năng tự theo dõi của người dùng.

### Các công việc cụ thể:
1. **Tích hợp vào `ExecutionDrawer.tsx`**:
   - Nhúng `ExecutionCommentsSection` vào cột bên phải của `client/src/components/ExecutionDrawer.tsx`, ngay bên dưới kết quả kiểm thử (Actual Result, Evaluation, Notes) khi đang xem kết quả thực thi của một tester.
   - Thêm nút tắt nhanh trên thanh Header của Drawer: `Trao đổi ({commentCount})` để người dùng có thể 1-click cuộn thẳng xuống vùng trao đổi.
2. **Bổ sung tính năng Tự theo dõi (Self-watch)**:
   - Trong khung "Người theo dõi" ở cột bên trái:
     - Bổ sung nút **"Theo dõi" / "Đang theo dõi"** cho tài khoản hiện tại.
     - Khi một tester hoặc thành viên quan tâm mở execution, họ có thể bấm 1-click để thêm chính mình vào danh sách `watchers` để cùng thảo luận và nhận thông tin trao đổi.
3. **Tự động làm mới khi có bình luận (Real-time & Background Auto-refresh)**:
   - **Đồng bộ nội bộ tức thì**: Khắc phục lỗi nhánh điều kiện khi gửi/xóa bình luận; luôn gọi fetch lại danh sách nội bộ kèm callback cập nhật số lượng ngay lập tức mà không cần F5.
   - **Đồng bộ đa tab & toàn hệ thống (Cross-tab Event Sync)**: Xây dựng tiện ích `executionEvents.ts` (`emitExecutionCommentUpdated` và `onExecutionCommentUpdated`) sử dụng `CustomEvent`, `BroadcastChannel` và `storage fallback` để phát và bắt sự kiện cập nhật bình luận tức thì giữa các tab và component.
   - **Tự động làm mới nền (Silent Background Polling)**: Khi đang mở Drawer, định kỳ poll 4s (khi tab đang active) và làm mới tức thì khi người dùng quay lại tab (`focus` / `visibilitychange`), cập nhật ngầm không gây giật màn hình hoặc mất nội dung đang soạn thảo.
   - **Tự động cuộn thông minh (Auto Scroll)**: Tự động cuộn xuống tin nhắn mới nhất khi người dùng đang ở gần đáy hoặc vừa gửi bình luận.

---

## 📌 Giai đoạn 4: Kiểm thử toàn diện, Biên dịch & Hoàn tất

**Mục tiêu**: Xác minh tính ổn định, kiểm thử các kịch bản người dùng thực tế và hoàn thiện tài liệu.

### Các kịch bản kiểm thử:
1. **Kiểm thử biên dịch tự động**:
   - Chạy `npm run build` trên `server`.
   - Chạy `npm run build` (`tsc -b && vite build`) trên `client`.
2. **Kiểm thử chức năng tương tác**:
   - Mở execution từ danh sách kịch bản kiểm thử (`SuiteDetail` hoặc `TestCaseDetail`).
   - Kiểm tra hiển thị khung Trao đổi & Bình luận.
   - Đăng một bình luận có nội dung văn bản.
   - Đính kèm file/ảnh minh chứng và gửi bình luận -> Kiểm tra file mở được.
   - Thử nghiệm thao tác Tự theo dõi (Self-watch) và Bỏ theo dõi.
   - Thử nghiệm xóa bình luận của chính mình.
3. **Tạo tài liệu nghiệm thu**:
   - Viết tài liệu `walkthrough.md` tổng kết kết quả thực hiện.
