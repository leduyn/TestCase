# Kế hoạch triển khai: Trao đổi & Bình luận cho Test Execution

Bổ sung tính năng **Trao đổi & Bình luận** cho lượt thực thi kiểm thử (`Test Execution`), cho phép **người thực thi (executor)**, **người tạo (creator)**, **người theo dõi (watchers)** và quản trị viên có thể tương tác, trao đổi thông tin và đính kèm tài liệu minh chứng tương tự như tính năng trên hệ thống Đề xuất (`ProposalComment`).

---

## 1. Yêu cầu & Mục tiêu

1. **Đối tượng tham gia**:
   - Người thực thi test case (`executedById` / `executedBy`).
   - Người tạo execution (`createdById` / `createdBy`).
   - Người theo dõi (`watchers` / `TestExecutionWatcher`).
   - Quản trị viên (`ADMIN` / `MANAGER`).
2. **Nội dung trao đổi & bình luận**:
   - Hiển thị danh sách bình luận dạng bong bóng chat hiện đại (tin nhắn của tôi bên phải, tin nhắn đồng nghiệp bên trái).
   - Hiển thị thông tin người gửi: Avatar chữ cái, họ tên, vai trò/email, thời gian gửi.
   - Hỗ trợ đính kèm tệp, hình ảnh, log file minh chứng (sử dụng API upload tệp sẵn có).
   - Cho phép tác giả hoặc quản trị viên xóa bình luận khi cần.
   - Hỗ trợ tự theo dõi (Self-watch / Unwatch 1-click) ngay trên giao diện để nhanh chóng nhận thông tin trao đổi.
3. **Vị trí hiển thị**:
   - Tích hợp trực tiếp vào [ExecutionDrawer.tsx](file:///d:/Java%20lean/TestCase/client/src/components/ExecutionDrawer.tsx) (cả chế độ drawer modal và trang chi tiết đầy đủ [TestCaseDetail.tsx](file:///d:/Java%20lean/TestCase/client/src/pages/TestCaseDetail.tsx)).
   - Bổ sung nút chuyển đổi tab hoặc mở nhanh bình luận trên thanh công cụ và bên dưới kết quả kiểm thử.

---

## 2. Chi tiết các thay đổi đề xuất

### A. Database & Prisma Schema

#### [MODIFY] [schema.prisma](file:///d:/Java%20lean/TestCase/server/prisma/schema.prisma)
- Thêm model `TestExecutionComment`:
  ```prisma
  model TestExecutionComment {
    id          String        @id @default(uuid())
    executionId String        @map("execution_id")
    execution   TestExecution @relation(fields: [executionId], references: [id], onDelete: Cascade)
    userId      String        @map("user_id")
    user        User          @relation("TestExecutionCommentUser", fields: [userId], references: [id], onDelete: Cascade)
    content     String        @db.Text
    attachments Json?         @default("[]") @map("attachments")
    createdAt   DateTime      @default(now()) @map("created_at")
    updatedAt   DateTime      @updatedAt @map("updated_at")

    @@map("test_execution_comments")
  }
  ```
- Cập nhật quan hệ trong `TestExecution`:
  ```prisma
  comments TestExecutionComment[]
  ```
- Cập nhật quan hệ trong `User`:
  ```prisma
  executionComments TestExecutionComment[] @relation("TestExecutionCommentUser")
  ```
- Tạo file migration SQL và chạy `npx prisma migrate deploy` + `npx prisma generate`.

---

### B. Backend Services, Controllers & Routes

#### [NEW] [executionCommentController.ts](file:///d:/Java%20lean/TestCase/server/src/controllers/executionCommentController.ts)
- `getComments(req, res)`: Lấy danh sách bình luận của một execution theo thứ tự thời gian tăng dần (`createdAt: 'asc'`), kèm thông tin người gửi.
- `addComment(req, res)`:
  - Kiểm tra quyền truy cập của user (người thực thi, người tạo, watcher, hoặc admin/manager).
  - Tạo bản ghi bình luận mới với nội dung và danh sách file đính kèm.
- `deleteComment(req, res)`: Cho phép chính tác giả hoặc ADMIN xóa bình luận.

#### [MODIFY] [executionRoutes.ts](file:///d:/Java%20lean/TestCase/server/src/routes/executionRoutes.ts)
- Thêm các route:
  - `GET /:executionId/comments` (xem bình luận)
  - `POST /:executionId/comments` (gửi bình luận)
  - `DELETE /:executionId/comments/:commentId` (xóa bình luận)

---

### C. Frontend

#### [MODIFY] [types/index.ts](file:///d:/Java%20lean/TestCase/client/src/types/index.ts)
- Khai báo interface `TestExecutionComment`:
  ```ts
  export interface TestExecutionComment {
    id: string;
    executionId: string;
    userId: string;
    user: {
      id: string;
      fullName: string;
      email: string;
      role?: string;
    };
    content: string;
    attachments?: Array<{
      name: string;
      url: string;
      storagePath?: string;
      size?: number;
    }>;
    createdAt: string;
    updatedAt: string;
  }
  ```
- Mở rộng `TestExecution` thêm `comments?: TestExecutionComment[]`.

#### [MODIFY] [services/api.ts](file:///d:/Java%20lean/TestCase/client/src/services/api.ts)
- Bổ sung `executionCommentApi`:
  - `getComments(executionId: string)`
  - `addComment(executionId: string, data: { content: string; attachments?: any[] })`
  - `deleteComment(executionId: string, commentId: string)`

#### [NEW] [ExecutionCommentsSection.tsx](file:///d:/Java%20lean/TestCase/client/src/components/ExecutionCommentsSection.tsx)
- Kế thừa phong cách thiết kế hiện đại của `ProposalCommentsSection.tsx`:
  - Tiêu đề "Trao đổi & Bình luận" kèm số lượng bình luận.
  - Luồng tin nhắn bong bóng chat với thời gian, avatar người gửi.
  - Tải lên tệp đính kèm / hình ảnh minh chứng và hiển thị chip tệp có thể tải/xem.
  - Ô nhập liệu tin nhắn hỗ trợ gõ nhiều dòng, đính kèm nhiều tệp, gửi bằng phím Enter hoặc nút Gửi.
  - Nút xóa bình luận (hiển thị khi là bình luận của chính mình hoặc admin).

#### [MODIFY] [ExecutionDrawer.tsx](file:///d:/Java%20lean/TestCase/client/src/components/ExecutionDrawer.tsx)
- Nhúng `ExecutionCommentsSection` vào bên dưới kết quả kiểm thử (dưới phần Ghi chú / Notes) khi đang xem kết quả thực thi của một tester.
- Thêm nút tắt trên thanh Topbar: Nút icon tin nhắn `Trao đổi ({commentCount})` để cuộn nhanh đến phần trao đổi.
- Bổ sung nút **"Theo dõi / Đang theo dõi" (Self-watch)** ngay trong khung Người theo dõi ở cột trái, cho phép người dùng 1-click tự thêm mình vào danh sách theo dõi để cùng thảo luận.

---

## 3. Kế hoạch kiểm thử & xác minh

1. **Biên dịch**:
   - Chạy `npm run build` trên `server`: Đảm bảo TypeScript không có lỗi sau khi cập nhật schema Prisma và controller mới.
   - Chạy `npm run build` trên `client`: Đảm bảo Vite bundle và TypeScript biên dịch thành công 100%.
2. **Kiểm thử chức năng**:
   - Mở kịch bản kiểm thử trong `ExecutionDrawer`.
   - Kiểm tra hiển thị khung "Trao đổi & Bình luận".
   - Gửi thử một bình luận văn bản -> Kiểm tra hiển thị đúng thời gian, avatar, tên người gửi.
   - Đính kèm file hình ảnh/tài liệu -> Gửi bình luận và kiểm tra link xem file.
   - Kiểm tra tính năng xóa bình luận của chính mình.
   - Thử nghiệm thao tác tự theo dõi (Self-watch) ở cột bên trái.
