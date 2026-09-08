# Kế hoạch cải tiến chức năng "Nhận & bắt đầu" và Hỗ trợ "Nhận lượt test mới" (Multi-round Test Execution) & "Chọn người theo dõi mặc định"

Tài liệu phân tích và thiết kế chi tiết để giải quyết các yêu cầu:
1. **Độc lập bộ execution khi "Nhận & bắt đầu"**: Khi nhân viên nhấn "Nhận & bắt đầu", hệ thống sẽ tạo một bộ `TestExecution` hoàn toàn mới cho chính nhân viên đó (`createdById = user`, `executedById = user`), độc lập hoàn toàn, không gán nhận lại hay phụ thuộc vào người khác (`beforeExecutedId = null`).
2. **Ưu tiên hiển thị kết quả của chính người dùng**: Khi người dùng xem danh sách Test Case / Kanban trong Suite, hệ thống luôn hiển thị trạng thái và kết quả lượt test mới nhất của chính người dùng đó (thay vì bị quyền xem tất cả `canViewAll` ghi đè hiển thị kết quả của đồng nghiệp khác).
3. **Cho phép nhận lại để test thêm lượt mới**: Sau khi đã nhận và bắt đầu (hoặc đã hoàn thành kiểm thử), nhân viên vẫn có thể bấm nhận lại để tạo một **lượt test mới** (Round 2, Round 3...). Lượt test mới sẽ tạo mới các execution ở trạng thái `UNTESTED`, tăng tổng số lượt test ("số lần test") của nhân viên và giữ nguyên toàn bộ lịch sử các lượt test trước đó.
4. **Cho phép chọn danh sách người theo dõi mặc định (Watchers)**: Khi nhấn "Nhận & bắt đầu" hoặc "Nhận lượt test mới", hiển thị modal cho phép chọn danh sách người theo dõi mặc định. Khi khởi tạo bộ execution, tất cả người được chọn sẽ được thêm tự động vào `TestExecutionWatcher` của các execution đó và lưu ghi nhớ (cache) cho những lần nhận tiếp theo.

---

## User Review Required

> [!IMPORTANT]
> **Quy tắc tạo lượt test mới vs Lấy test case còn thiếu & Người theo dõi:**
> 1. **Lần đầu nhận (hoặc khi có Test Case mới được thêm/duyệt vào Suite):** Người dùng bấm **"Lấy testcase"** hoặc **"Nhận & bắt đầu"** theo chức năng để cấp phát các test case mà người dùng *chưa từng nhận*.
> 2. **Khi muốn test lượt mới (Re-test toàn bộ hoặc theo chức năng):** Người dùng có thể bấm **"Nhận lượt test mới"** (trên Toolbar hoặc theo từng nhóm chức năng/module). Hệ thống sẽ tạo một bộ bản ghi `TestExecution` mới với trạng thái `UNTESTED`, giúp người dùng bắt đầu chu kỳ test mới độc lập. Lịch sử của các lượt test cũ vẫn được lưu trọn vẹn.
> 3. **Modal chọn người theo dõi mặc định:** Bất cứ khi nào nhấn "Nhận & bắt đầu" hay "Nhận lượt test mới", sẽ hiển thị một Modal popup xác nhận kèm danh sách chọn người theo dõi (Watchers) tiện lợi, có tìm kiếm và ghi nhớ lựa chọn gần nhất.

---

## Phân tích nguyên nhân hiện tại (Root Causes)

1. **Gán nhầm "tiếp nhận từ người khác" (`beforeExecutedId`):**
   - Trong `TestCaseController.provisionExecutions` (`server/src/controllers/testCaseController.ts`), code cũ có đoạn tìm execution gần nhất của người khác và gán `beforeExecutedId = prevExec.executedById`. Điều này khiến trên thẻ Kanban / Drawer hiển thị *"Tiếp nhận từ: [Tên người khác]"* như thể người dùng đang nhận lại lượt của người khác.
2. **Lỗi ưu tiên hiển thị khi người dùng có quyền `canViewAll`:**
   - Hàm `pickLatestVisibleExecution` và `pickLatestExecution` có logic `if (canViewAll) return executions[0];`.
   - Khi tài khoản (ADMIN hoặc TESTER có quyền xem lịch sử) mở Suite, hệ thống trả về execution mới nhất toàn đội (của bất kỳ ai vừa test) thay vì execution của chính tài khoản đang đăng nhập.
3. **Chặn nhận lại khi đã có execution:**
   - Trong `provisionExecutions`, logic `existingIds` loại bỏ tất cả các test case mà user đã từng tạo execution (`missing = caseIds.filter(cid => !existingIds.has(cid))`).
   - Khi `missing.length === 0`, server trả về thông báo *"Bạn đã nhận đủ các Test Case này"* và không cho phép nhận tiếp lượt mới.
   - Trên giao diện `SuiteDetail.tsx`, khu vực *"Test case chưa nhận"* cũng bị ẩn hoàn toàn khi `unreceivedTestCases.length === 0`.
4. **Chưa có cơ chế gán người theo dõi khi provision hàng loạt:**
   - `provisionExecutions` hiện chỉ tạo bản ghi `TestExecution` mà chưa nhận `watcherIds` để gán vào bảng `test_execution_watchers`.

---

## Proposed Changes

### 1. Server (`server/src`)

#### [MODIFY] [testCaseController.ts](file:///d:/Java%20lean/TestCase/server/src/controllers/testCaseController.ts)
- **Sửa `pickLatestExecution` và `pickLatestVisibleExecution`**:
  - Ưu tiên tìm execution của chính `currentUserId` trước:
    ```typescript
    if (currentUserId) {
      const own = executions.find(
        (e: any) => e.createdById === currentUserId || e.executedById === currentUserId
      );
      if (own) return own;
    }
    // Chỉ khi user hiện tại CHƯA CÓ execution nào cho testcase này, mới fallback sang executions[0] nếu canViewAll
    if (canViewAll) return executions[0] || null;
    return null;
    ```
  - Đảm bảo khi Tester B mở giao diện, Tester B luôn nhìn thấy lượt test mới nhất của chính mình.

- **Cải tiến `provisionExecutions` hỗ trợ độc lập, nhận lượt mới (`newRound`) và gán người theo dõi (`watcherIds`)**:
  - Nhận thêm `newRound?: boolean` và `watcherIds?: string[]` từ `req.body`.
  - **Không kế thừa `beforeExecutedId` từ người khác**: Bản ghi execution mới sẽ có `beforeExecutedId: null`.
  - Nếu `newRound === true`:
    - Tạo mới một bộ `TestExecution` với trạng thái `UNTESTED` cho tất cả test case thuộc phạm vi (toàn bộ suite hoặc lọc theo module/testCaseIds) cho `currentUserId`.
  - Nếu `newRound !== true`:
    - Provision cho các test case mà user chưa có execution.
  - **Gán người theo dõi tự động**:
    - Sau khi tạo các `newExecutions`, nếu có `watcherIds` hợp lệ:
      ```typescript
      if (Array.isArray(watcherIds) && watcherIds.length > 0 && newExecutions.length > 0) {
        const watcherData = [];
        for (const exec of newExecutions) {
          for (const wId of watcherIds) {
            watcherData.push({ executionId: exec.id, userId: wId });
          }
        }
        await prisma.testExecutionWatcher.createMany({
          data: watcherData,
          skipDuplicates: true,
        });
      }
      ```
    - Ghi nhận snapshot khởi tạo trong `test_execution_histories` cho mỗi execution vừa tạo.

---

### 2. Client (`client/src`)

#### [MODIFY] [api.ts](file:///d:/Java%20lean/TestCase/client/src/services/api.ts)
- Cập nhật định nghĩa `takeTestCases` hỗ trợ `newRound` và `watcherIds`:
  ```typescript
  takeTestCases: (
    id: string,
    data?: { module?: string; testCaseIds?: string[]; newRound?: boolean; watcherIds?: string[] }
  ) =>
    api.post<{ message: string; created: number; testCaseIds: string[] }>(
      `/testcases/suites/${id}/provision`,
      data || {}
    ),
  ```

#### [NEW] [ReceiveTestCasesModal.tsx](file:///d:/Java%20lean/TestCase/client/src/components/ReceiveTestCasesModal.tsx)
- Modal xác nhận khi nhấn **"Nhận & bắt đầu"**, **"Lấy testcase"**, hoặc **"Nhận lượt test mới"**:
  - Tiêu đề rõ ràng: phân biệt giữa "Nhận Test Case" (lần đầu) và "Nhận lượt kiểm thử mới" (retest).
  - Tóm tắt phạm vi: Tên Suite, Module áp dụng, số lượng Test Case.
  - **Bảng chọn người theo dõi (Watchers)**:
    - Tải danh sách user từ `executionApi.getWatcherCandidates()`.
    - Cho phép tìm kiếm nhanh theo tên/email, chọn/bỏ chọn từng người hoặc chọn tất cả.
    - Lưu danh sách người theo dõi đã chọn vào `localStorage` (key: `default_testcase_watchers`) để tự động điền sẵn cho các lần nhận sau.
  - Nút "Xác nhận & Bắt đầu" và "Hủy".

#### [MODIFY] [SuiteDetail.tsx](file:///d:/Java%20lean/TestCase/client/src/pages/SuiteDetail.tsx)
- Khi bấm "Lấy testcase", "Nhận & bắt đầu" theo module, hoặc "Nhận lượt test mới":
  - Mở `ReceiveTestCasesModal`.
  - Truyền các thông tin: module (nếu nhận theo nhóm), `newRound` (nếu nhận lượt mới), danh sách case count.
  - Sau khi xác nhận trong Modal -> gọi `takeTestCases` với `watcherIds` và làm mới dữ liệu Suite.
- Bổ sung nút **"Nhận lượt test mới"** trên Toolbar (cho toàn Suite) và tại từng nhóm chức năng (module).
- Đảm bảo stats (Untested, Passed, Failed...) phản ánh chính xác kết quả theo lượt test mới nhất của chính user hiện tại.

#### [MODIFY] [ExecutionDrawer.tsx](file:///d:/Java%20lean/TestCase/client/src/components/ExecutionDrawer.tsx)
- Đảm bảo khi Tester có nhiều lượt test (nhiều executions theo thời gian):
  - Danh sách số lượt test hiển thị chuẩn xác: `{opt.name} ({opt.count} lượt)`.
  - Timeline hiển thị các mốc kiểm thử rõ ràng, người dùng có thể xem lại kết quả của lượt 1, lượt 2... dễ dàng.
  - Hiển thị danh sách Người theo dõi (Watchers) đã được gán tự động từ lúc nhận.

---

## Verification Plan

### Automated Tests / Compile Check
1. Kiểm tra build và TypeScript types của Backend:
   ```bash
   cd server && npx tsc --noEmit
   ```
2. Kiểm tra build và TypeScript types của Frontend:
   ```bash
   cd client && npm run build
   ```

### Manual Verification
1. **Kiểm tra tính độc lập khi Tester khác nhận test case**:
   - Đăng nhập tài khoản Tester 1: Bấm "Nhận & bắt đầu" một module -> Điền kết quả PASSED cho 1 test case.
   - Đăng nhập tài khoản Tester 2: Mở bộ Test Suite đó.
   - Xác nhận Tester 2 nhìn thấy test case ở trạng thái chưa nhận hoặc UNTESTED của chính Tester 2, KHÔNG bị hiển thị PASSED của Tester 1.
   - Tester 2 bấm "Nhận & bắt đầu" -> Xác nhận tạo mới execution UNTESTED độc lập của Tester 2, không hiển thị "Tiếp nhận từ: Tester 1".
2. **Kiểm tra chọn người theo dõi mặc định**:
   - Khi bấm "Nhận & bắt đầu" hoặc "Lấy testcase", modal mở ra cho phép chọn người theo dõi.
   - Chọn User A và User B làm người theo dõi -> Bấm xác nhận.
   - Mở Drawer của các Test Case vừa nhận -> Kiểm tra User A và User B đã có trong danh sách "Người theo dõi".
   - Lần nhận tiếp theo, kiểm tra xem danh sách người theo dõi có được nhớ sẵn từ lần trước không.
3. **Kiểm tra chức năng "Nhận lượt test mới"**:
   - Tester 1 đã hoàn thành test một số test case.
   - Tester 1 bấm "Nhận lượt test mới" -> Xác nhận hệ thống tạo lượt UNTESTED mới.
   - Kiểm tra số lượt test của Tester 1 tăng thêm 1.
   - Mở Drawer xem lịch sử -> Xác nhận lịch sử của lượt trước vẫn còn nguyên vẹn và có thể click xem lại bất kỳ lúc nào.


---

## Verification Plan

### Automated Tests / Compile Check
1. Kiểm tra build và TypeScript types của Backend:
   ```bash
   cd server && npx tsc --noEmit
   ```
2. Kiểm tra build và TypeScript types của Frontend:
   ```bash
   cd client && npm run build
   ```

### Manual Verification
1. **Kiểm tra tính độc lập khi Tester khác nhận test case**:
   - Đăng nhập tài khoản Tester 1: Bấm "Nhận & bắt đầu" một module -> Điền kết quả PASSED cho 1 test case.
   - Đăng nhập tài khoản Tester 2: Mở bộ Test Suite đó.
   - Xác nhận Tester 2 nhìn thấy test case ở trạng thái chưa nhận hoặc UNTESTED của chính Tester 2, KHÔNG bị hiển thị PASSED của Tester 1.
   - Tester 2 bấm "Nhận & bắt đầu" -> Xác nhận tạo mới execution UNTESTED độc lập của Tester 2, không hiển thị "Tiếp nhận từ: Tester 1".
2. **Kiểm tra chức năng "Nhận lượt test mới"**:
   - Tester 1 đã hoàn thành test một số test case.
   - Tester 1 bấm "Nhận lượt test mới" -> Xác nhận hệ thống tạo lượt UNTESTED mới.
   - Kiểm tra số lượt test của Tester 1 tăng thêm 1.
   - Mở Drawer xem lịch sử -> Xác nhận lịch sử của lượt trước vẫn còn nguyên vẹn và có thể click xem lại bất kỳ lúc nào.
