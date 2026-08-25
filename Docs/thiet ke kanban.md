Tôi muốn thêm button trên thanh toolbar để tôi có thể thay đổi giao diện từ dạng Data Table / Table View sang Kanban Board hoặc ngược lại, dựa trên dữ liệu Test Case hiện có. Hãy giúp tôi tạo thêm layout kanban:
1. Mục tiêu
Hiện tại mỗi Test Case đang được hiển thị trên một dòng trong bảng với các thông tin:
- Mã TC
- Chức năng
- Platform
- Server
- Hệ điều hành
- Tiêu đề kịch bản
- Loại Test
- Các bước thực hiện
- Kết quả mong đợi
- Đánh giá
- Thao tác

Hãy thiết kế giao diện Kanban Board hiện đại, chuyên nghiệp, dễ quản lý nhiều Test Case.
Không thay đổi dữ liệu backend, business logic hoặc API hiện tại.

Chỉ refactor phần UI/UX và cách hiển thị dữ liệu.

2. Cấu trúc Kanban Board

Phân chia cột

Mỗi cột Kanban đại diện cho trạng thái thực hiện Test Case.

Sử dụng các cột:

Chưa thực hiện

Failed

Blocked

Retest

Skipped

Passed

Mỗi cột hiển thị:

Tên trạng thái

Số lượng Test Case

Màu trạng thái phù hợp

Progress indicator nếu cần

Ví dụ:

┌────────────────────────────┐
│ ⏳ Chưa thực hiện       12  │
│ ━━━━━━━━━━━━━━━━━━━━━━━    │
│                            │
│ ┌────────────────────────┐ │
│ │ TC_122                 │ │
│ │ Sắp xếp thứ tự icon    │ │
│ │                        │ │
│ │ CMS · Windows 11       │ │
│ │ Functional Test        │ │
│ │                        │ │
│ │ 👤 Nguyễn Hà Vy        │ │
│ └────────────────────────┘ │
│                            │
└────────────────────────────┘

3. Thiết kế Test Case Card

Mỗi Test Case được hiển thị dưới dạng Card.

Header Card

Hiển thị:

Test Case ID

Ví dụ:

TC_122

Badge Platform

Ví dụ:

CMS

App

Web

Loại Test

Ví dụ:

Functional

Regression

Smoke

Integration

Nội dung chính

Hiển thị:

Tiêu đề kịch bản

Ví dụ:

Sắp xếp thứ tự icon cho thương hiệu nổi bật

Giới hạn tối đa 2–3 dòng.

Nếu dài hơn thì truncate bằng ellipsis.

Thông tin phụ

Hiển thị dạng metadata:

⚙ Chức năng: Thương hiệu

🖥 Server: STAGING

💻 Windows 11

Không hiển thị toàn bộ dữ liệu giống table.

Ưu tiên hiển thị thông tin quan trọng nhất.

Các thông tin chi tiết sẽ hiển thị khi click vào card.

4. Trạng thái Test Case

Trạng thái được xác định từ trường:

Đánh giá

hoặc trường status hiện có trong hệ thống.

Mapping UI:

Status

Column

Chưa test

Chưa thực hiện

In Progress

Đang thực hiện

PASSED

Passed

FAILED

Failed

BLOCKED

Blocked

RETEST

Retest

SKIPPED

Skipped

Không thay đổi giá trị backend nếu không cần thiết.

Nếu backend đang sử dụng giá trị khác, chỉ mapping ở frontend.

5. Drag and Drop

Hỗ trợ kéo thả Test Case giữa các cột.

Ví dụ:

Chưa thực hiện
        ↓ drag
Đang thực hiện
        ↓
Passed

Khi kéo Test Case sang cột khác:

Hiển thị drag preview.

Highlight cột đang được drop.

Cập nhật trạng thái Test Case.

Gọi API update status hiện tại.

Nếu API lỗi:

Rollback vị trí card.

Hiển thị thông báo lỗi.

Nếu API thành công:

Cập nhật UI ngay.

Không cần reload toàn trang.

Ưu tiên sử dụng optimistic update.

6. Test Case Detail

Khi click vào một Test Case Card:

Mở Side Drawer bên phải.

Không chuyển sang trang khác nếu không cần thiết.

Drawer hiển thị đầy đủ:

Thông tin chung

Mã TC

Chức năng

Platform

Server

Hệ điều hành

Loại Test

Đánh giá

Thực tế

Tiêu đề kịch bản

Hiển thị đầy đủ.

Các bước thực hiện

Hiển thị theo danh sách có thứ tự:

1. Vào menu "Quản lý thương hiệu"

2. Sắp xếp thứ tự icon thương hiệu nổi bật

3. Bấm "Lưu"

Kết quả mong đợi

Hiển thị trong khu vực riêng:

Kết quả mong đợi:

Thứ tự hiển thị thương hiệu nổi bật
trên App thay đổi đúng theo thứ tự sắp xếp.

7. Header và Toolbar

Phía trên Kanban Board cần có:

Bên trái

Test Case Management

Hiển thị:

Tổng số Test Case

Số Passed

Số Failed

Số Chưa thực hiện

Ví dụ:

Tổng: 347

✓ Passed: 210

✕ Failed: 15

◷ Chưa thực hiện: 122

Bên phải

Có các chức năng:

Search Test Case

Filter

Sort

Refresh

Toggle View

Toggle View

Cho phép chuyển đổi:

☷ Kanban

☰ Table

Table View vẫn giữ lại giao diện hiện tại.

Kanban View là giao diện mới.

Lưu lựa chọn View của người dùng.

Ví dụ:

localStorage:

testcase_view = "kanban"

8. Filter

Hỗ trợ Filter theo:

Platform

Chức năng

Server

Hệ điều hành

Loại Test

Trạng thái

Người thực hiện

Filter phải hoạt động với toàn bộ dữ liệu.

Khi filter:

Chỉ hiển thị các card phù hợp.

Cập nhật số lượng card trong từng cột.

Không reload toàn bộ trang.

9. Search

Search theo:

Mã Test Case

Tiêu đề kịch bản

Chức năng

Platform

Có debounce khoảng 300ms.

10. Card Actions

Khi hover vào Test Case Card, hiển thị menu:

⋮

Menu bao gồm:

Xem chi tiết

Chỉnh sửa

Nhân bản

Đổi trạng thái

Xóa

Giữ nguyên các quyền và logic hiện tại.

11. UI / UX Design

Phong cách:

Modern SaaS

Enterprise

Clean

Professional

Information dense

Phù hợp hệ thống quản lý QA/Test Case

Không thiết kế theo phong cách Trello quá đơn giản.

Không dùng card quá to.

Không dùng màu sắc quá nhiều.

Giao diện phải tối ưu để hiển thị hàng trăm Test Case.

Color Guideline

Sử dụng màu trạng thái nhẹ nhàng:

Chưa thực hiện:
Neutral / Gray

Đang thực hiện:
Blue

Passed:
Green

Failed:
Red

Blocked:
Orange

Retest:
Purple

Skipped:
Gray

Không sử dụng background màu quá đậm.

Ưu tiên:

Light background

Subtle border

Soft shadow

Border radius 6–8px

12. Layout

Cấu trúc:

┌──────────────────────────────────────────────────────────────┐
│ Test Case Management                         Search Filter + │
│ Total: 347 | Passed: 210 | Failed: 15 | Pending: 122        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐     │
│ │ Chưa   │ │ Đang   │ │ Passed │ │ Failed │ │ Blocked│     │
│ │ làm 12 │ │ làm 8  │ │ 210    │ │ 15     │ │ 2      │     │
│ ├────────┤ ├────────┤ ├────────┤ ├────────┤ ├────────┤     │
│ │ TC_001 │ │ TC_021 │ │ TC_050 │ │ TC_071 │ │ TC_101 │     │
│ │ CMS    │ │ App    │ │ Web    │ │ CMS    │ │ API    │     │
│ ├────────┤ ├────────┤ ├────────┤ ├────────┤ ├────────┤     │
│ │ TC_002 │ │ TC_022 │ │ TC_051 │ │ TC_072 │ │         │     │
│ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘     │
│                                                              │
└──────────────────────────────────────────────────────────────┘

Board phải:

Scroll ngang nếu có nhiều cột.

Scroll dọc độc lập trong từng column.

Header của column phải sticky.

Toolbar phía trên phải sticky nếu phù hợp.

Responsive với màn hình desktop và tablet.

13. Performance

Hệ thống có thể có hàng trăm hoặc hàng nghìn Test Case.

Cần đảm bảo:

Không render toàn bộ dữ liệu không cần thiết.

Sử dụng virtualization nếu số lượng card lớn.

Lazy loading hoặc pagination nếu backend hỗ trợ.

Debounce Search.

Optimistic update khi drag/drop.

Tránh re-render toàn bộ Kanban Board.

14. Technical Requirements

Trước khi code:

Phân tích cấu trúc source code hiện tại.

Xác định component đang render Test Case Table.

Tái sử dụng API và data model hiện tại.

Không phá vỡ chức năng CRUD đang có.

Không thay đổi backend nếu không thực sự cần thiết.

Sau đó đề xuất cấu trúc component.

Ví dụ:

TestCasePage
│
├── TestCaseToolbar
│   ├── Search
│   ├── Filter
│   ├── Statistics
│   └── ViewToggle
│
├── TestCaseKanbanBoard
│   │
│   ├── KanbanColumn
│   │   ├── ColumnHeader
│   │   └── TestCaseCard
│   │
│   ├── KanbanColumn
│   ├── KanbanColumn
│   └── ...
│
└── TestCaseDetailDrawer

15. Yêu cầu thực hiện

Hãy thực hiện theo thứ tự:

Bước 1

Phân tích source code hiện tại và xác định:

Tech stack

Component Test Case Table

API đang sử dụng

Data model Test Case

Field nào đại diện cho Status

Bước 2

Lập kế hoạch refactor UI sang Kanban.

Bước 3

Tạo các component Kanban mới.

Bước 4

Giữ nguyên toàn bộ:

API

Backend

Database

CRUD logic

Permission

Validation

Bước 5

Implement:

Kanban Board

Kanban Column

Test Case Card

Drag & Drop

Filter

Search

Detail Drawer

View Toggle giữa Table và Kanban

Bước 6

Sau khi hoàn thành:

Kiểm tra build.

Kiểm tra lỗi TypeScript.

Kiểm tra responsive.

Kiểm tra drag & drop.

Kiểm tra API update status.

Không để ảnh hưởng đến Table View hiện tại.

Quan trọng: Không tự ý sửa business logic hoặc backend. Trước khi thay đổi, hãy đọc và phân tích code hiện tại. Sau mỗi nhóm thay đổi lớn, báo cáo rõ file nào đã thay đổi và lý do.