# Kế hoạch điều chỉnh Lịch sử thực thi trên SuiteDetail & Drawer Timeline (Đã cập nhật theo phản hồi)

## 1. Yêu cầu chi tiết từ người dùng
1. **Trang SuiteDetail**: 
   - Phần Lịch sử thực thi (khi expand dòng testcase) hiển thị **kết quả thực thi mới nhất của từng User**.
   - Khi nhấn vào thẻ kết quả của User nào (hoặc nhấn nút xem/test), Drawer sẽ mở ra với ngữ cảnh của User đó.
2. **ExecutionDrawer**:
   - Bổ sung **cột danh sách Lịch sử (History Timeline) bên trái** lọc **theo User đang xem**:
     - Ví dụ: Đang xem kết quả test của **User 1** thì timeline bên trái hiển thị danh sách các mốc thời gian lịch sử thực thi của **User 1**.
     - Đang xem kết quả test của **User 2** thì timeline bên trái hiển thị danh sách các mốc thời gian thực thi của **User 2**.
     - Có bộ chuyển đổi nhanh giữa các User (nếu testcase có nhiều người thực thi) hoặc đồng bộ từ thẻ User được chọn ở SuiteDetail.
   - Khi nhấn vào 1 mốc thời gian trong timeline của User đó -> Hiển thị chi tiết thông tin (Trạng thái, Môi trường, Kết quả thực tế, Ghi chú, Ảnh minh chứng) tại mốc thời gian tương ứng.

---

## 2. Thiết kế chi tiết & Luồng hoạt động

```
+-----------------------------------------------------------------------------------------------------------------------+
| Drawer Header: [TC_KH_001] Tiêu đề Test Case • Module • Platform • Priority                                          |
+------------------------------------+---------------------------------------------+------------------------------------+
| CỘT 1: TIMELINE THEO USER          | CỘT 2: ĐẶC TẢ KIỂM THỬ                      | CỘT 3: CHI TIẾT KẾT QUẢ TẠI MỐC    |
|                                    |                                             |                                    |
| [ Bộ chọn User: User 1 (Tester) ▾] | - Tiền điều kiện (Preconditions)            | - Thông tin: User 1 • 24/08 10:15  |
|                                    | - Các bước thực hiện (Steps)                | - Trạng thái: PASSED               |
| [+] Thực thi lượt mới              | - Kết quả mong đợi (Expected Result)        | - Môi trường: STAGING • Win 11     |
|                                    |                                             | - Kết quả thực tế (Actual Result)  |
| Lịch sử của User 1:                | - Ảnh minh chứng của mốc này (Thumbnail)    | - Ghi chú / Link Bug               |
| ● 24/08/2026 10:15 (PASSED) [Mới]  |                                             |                                    |
| ● 23/08/2026 16:30 (FAILED)        |                                             | [ Nút Chỉnh sửa / Lưu kết quả ]    |
| ● 22/08/2026 09:00 (PASSED)        |                                             |                                    |
+------------------------------------+---------------------------------------------+------------------------------------+
```

---

## 3. Các bước triển khai cụ thể

### Bước 1: Điều chỉnh [SuiteDetail.tsx](file:///d:/Java%20lean/TestCase/client/src/pages/SuiteDetail.tsx)
- **Lọc kết quả mới nhất của từng User**:
  - Hàm `getLatestExecutionsByUser(executions)`: gom nhóm executions theo `executedById` / `executedBy.email`, lấy bản ghi `executedAt` mới nhất của mỗi user.
  - Hiển thị danh sách card đại diện cho từng user (Tên user, trạng thái mới nhất, môi trường, thời gian, kết quả thực tế tóm tắt).
  - Khi click vào 1 thẻ user trong expanded history -> Mở Drawer với `selectedExecution` hoặc `initialUserId` tương ứng của user đó.

### Bước 2: Điều chỉnh [ExecutionDrawer.tsx](file:///d:/Java%20lean/TestCase/client/src/components/ExecutionDrawer.tsx)
- **Props & State**:
  - Nhận thêm prop (tùy chọn) `initialExecution?: TestExecution` hoặc `initialUserId?: string`.
  - Quản lý danh sách toàn bộ `executions` của testcase (lấy từ `testCase.executions` hoặc `executionApi.getHistory`).
  - Gom nhóm lịch sử theo từng User: `executionsByUser = Map<userId, TestExecution[]>`.
  - State `selectedUserId`: User đang được chọn xem lịch sử.
  - State `selectedExecution`: Lần thực thi cụ thể đang được hiển thị trong cột chi tiết.
- **Cột Timeline bên trái**:
  - Phần trên: Header hiển thị Người thực hiện hiện tại + Dropdown chuyển sang User khác nếu có nhiều người test.
  - Nút **"Thực thi lượt mới"** (dành cho user hiện tại khi muốn ghi nhận kết quả test mới).
  - Danh sách Timeline mốc thời gian của `selectedUserId`:
    - Mỗi mốc hiển thị: Ngày giờ (ví dụ `10:15 24/08/2026`), Trạng thái (PASSED/FAILED/...), Server/OS.
    - Đánh dấu rõ ràng mốc mới nhất (Latest) và mốc đang được chọn (Active).
  - Khi người dùng click vào một mốc thời gian:
    - Cập nhật `selectedExecution` -> Form/View tự động nạp dữ liệu tại mốc thời gian đó (Status, Server, OS, Actual Result, Notes, và Ảnh minh chứng tương ứng).
- **Cột Đặc tả kiểm thử & Cột Chi tiết kết quả**:
  - Cột giữa: Đặc tả kiểm thử (Preconditions, Steps, Expected Result) + Thư viện ảnh của mốc thời gian đang chọn.
  - Cột phải: View chi tiết kết quả tại mốc thời gian được chọn hoặc Form chỉnh sửa / tạo lượt test mới.
  - Xử lý lưu kết quả: Sau khi lưu thành công -> cập nhật timeline và đóng drawer trở về SuiteDetail.

---

## 4. Kế hoạch kiểm thử & Xác minh
1. **Kiểm tra theo User**:
   - Test case có kết quả từ nhiều Tester (User 1, User 2).
   - Mở rộng dòng ở SuiteDetail -> Xác nhận hiển thị kết quả mới nhất của User 1 và User 2.
   - Nhấp vào User 1 -> Drawer mở ra hiển thị danh sách timeline lịch sử thực thi của User 1.
   - Chuyển sang User 2 -> Timeline cập nhật danh sách các lần chạy của User 2.
2. **Kiểm tra chuyển mốc thời gian**:
   - Nhấp vào các mốc thời gian cũ trong timeline -> Chi tiết kết quả, status, actual result và ảnh chuyển đổi chính xác theo mốc đó.
3. **Kiểm tra tạo/chỉnh sửa kết quả**:
   - Nhập kết quả mới và bấm "Lưu kết quả" -> Xác nhận validation hoạt động và quay về SuiteDetail.
