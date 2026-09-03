# Kế hoạch Triển khai: Lưu trữ hình ảnh theo từng mốc nhật ký kiểm thử (Phương án 2)

**Mục tiêu**: Đóng băng danh sách hình ảnh tại mỗi mốc thay đổi / snapshot của kết quả kiểm thử Test Case (`TestExecutionHistory`), giúp khi bấm vào bất kỳ giai đoạn lịch sử nào cũng xem được chính xác tập hình ảnh minh chứng của giai đoạn đó.

## User Review Required
> [!IMPORTANT]
> Phương án này sẽ thêm trường `images JSONB` vào bảng `test_execution_histories` trong cơ sở dữ liệu. Toàn bộ thông tin file ảnh/video tại thời điểm snapshot sẽ được lưu lại nguyên vẹn.
> Theo yêu cầu của bạn, chúng ta sẽ **triển khai và chạy thử nghiệm cục bộ trên máy trước, KHÔNG commit & push lên GitHub** cho đến khi bạn đã kiểm tra và đồng ý.

---

## Proposed Changes

### Database Layer (`server/prisma`)

#### [MODIFY] [schema.prisma](file:///d:/Java/lean/TestCase/server/prisma/schema.prisma)
- Thêm trường `images Json? @default("[]") @map("images")` vào model `TestExecutionHistory`.

#### [NEW] [202609030002_add_images_to_test_execution_history/migration.sql](file:///d:/Java/lean/TestCase/server/prisma/migrations/202609030002_add_images_to_test_execution_history/migration.sql)
- File migration SQL:
  ```sql
  -- AlterTable
  ALTER TABLE "test_execution_histories" ADD COLUMN IF NOT EXISTS "images" JSONB DEFAULT '[]';
  ```

---

### Backend Service & Controller (`server/src`)

#### [MODIFY] [executionController.ts](file:///d:/Java/lean/TestCase/server/src/controllers/executionController.ts)
- Cập nhật hàm `ExecutionController.snapshotExecution(executionId)`:
  - Truy vấn danh sách ảnh hiện có:
    ```ts
    const currentImages = await prisma.testExecutionImage.findMany({
      where: { executionId },
      orderBy: { uploadedAt: 'asc' },
    });
    ```
  - Lưu `images: currentImages` khi tạo mới hoặc cập nhật snapshot.

---

### Frontend Components (`client/src`)

#### [MODIFY] [types/index.ts](file:///d:/Java/lean/TestCase/client/src/types/index.ts)
- Bổ sung `images?: TestExecutionImage[];` vào interface `TestExecutionHistory`.

#### [MODIFY] [ExecutionDrawer.tsx](file:///d:/Java/lean/TestCase/client/src/components/ExecutionDrawer.tsx)
- Khi `selectedSnapshot` được chọn:
  - Hiển thị danh sách ảnh của chính mốc đó (`selectedSnapshot.images`, có fallback lọc theo `uploadedAt <= selectedSnapshot.updatedAt` cho các mốc cũ).
  - Khóa thao tác upload/xóa ảnh ở chế độ xem lại mốc lịch sử.
  - Cho phép click xem ảnh phóng to bằng lightbox như bình thường.
- Khi thoát xem mốc lịch sử (`selectedSnapshot = null`): khôi phục hiển thị toàn bộ ảnh của lần chạy hiện tại.

---

## Verification Plan

### Automated Build Verification
- Chạy `npm run build` trong `server/` và `client/` để đảm bảo 0 lỗi TypeScript.
- Chạy `npx prisma migrate deploy` để áp dụng migration vào database PostgreSQL cục bộ.

### Manual Local Verification
1. Mở Drawer một Test Case bất kỳ, tải 1 ảnh lên và lưu với trạng thái **FAILED**.
2. Đổi trạng thái sang **RETEST**, tải thêm 1 ảnh khác và lưu.
3. Bấm vào mốc **FAILED** trong danh sách "Lịch sử thay đổi":
   - Xác minh: Chỉ hiển thị đúng 1 ảnh tại thời điểm FAILED.
4. Bấm vào mốc **RETEST**:
   - Xác minh: Hiển thị đủ 2 ảnh tại thời điểm RETEST.
5. Bấm **"Quay lại bản hiện tại"**:
   - Xác minh: Trở về chế độ bình thường để tiếp tục sử dụng.
