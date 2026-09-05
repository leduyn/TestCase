# System Design Prompt - Chức năng Đề xuất/Đề nghị (Proposal/Request System)

## Mô tả tổng quan

Xây dựng chức năng Đề xuất/Đề nghị cho phép:

- Tạo các loại đề xuất với quy trình duyệt linh hoạt

- Sử dụng form mẫu với custom fields (liên kết với hệ thống Custom Fields đã có)

- Người dùng tạo đề xuất và gửi duyệt

- Người duyệt xử lý theo quy trình (đồng thời, lần lượt, hoặc 1 người)

- Liên kết với Workflow engine đã thiết kế để xử lý sau khi duyệt

- Theo dõi lịch sử duyệt và trạng thái

## Yêu cầu công nghệ

- **\*\*Backend:\*\*** Node.js với Express.js + TypeScript

- **\*\*Database:\*\*** PostgreSQL (sử dụng Prisma ORM)

- **\*\*Frontend:\*\*** React.js + TypeScript + Tailwind CSS

- **\*\*Authentication:\*\*** JWT (jsonwebtoken)

- **\*\*File upload:\*\*** Multer + lưu trữ local (hoặc Cloudinary)

- **\*\*Validation:\*\*** Zod hoặc class-validator

- **\*\*Form handling:\*\*** React Hook Form + Zod Resolver

- **\*\*Notification:\*\*** Email + In-app notification (WebSocket hoặc SSE)

## Cấu trúc dữ liệu chi tiết

### 1. Bảng `ProposalTypes` (Loại đề xuất)

```typescript

{

id: string (UUID)

name: string (Tên nhóm đề xuất, ví dụ: "Đề xuất nghỉ phép", "Đề xuất mua sắm")

code: string (Mã loại đề xuất, unique)

description: string (Mô tả nhóm)

icon: string | null (Icon hiển thị)

color: string | null (Màu sắc nhận diện)

// Người duyệt mặc định

default\_approver\_ids: string[] (Mảng UUID users - người xét duyệt mặc định)

// Cho phép chọn người duyệt tùy chọn

is\_optional\_approver: boolean (true = người tạo có thể chọn thêm người duyệt)

optional\_approver\_config: JSON | null (Cấu hình chọn người duyệt tùy chọn)

// Ví dụ: {

// "max\_selectable": 3,

// "role\_filter": ["MANAGER", "ADMIN"],

// "department\_filter": ["IT", "HR"],

// "allow\_direct\_manager": true (cho phép chọn quản lý trực tiếp)

// }

// Quy trình xử lý

approval\_workflow: 'PARALLEL' | 'SEQUENTIAL' | 'ANY\_ONE'

// PARALLEL = Duyệt đồng thời (tất cả phải duyệt)

// SEQUENTIAL = Duyệt lần lượt (theo thứ tự)

// ANY\_ONE = Chỉ cần 1 người duyệt

// Thời hạn xử lý

deadline\_hours: number (Thời hạn xử lý tính bằng giờ, 0 = không giới hạn)

// Danh sách người được tạo

creator\_ids: string[] (Mảng UUID users được phép tạo đề xuất loại này)

creator\_roles: string[] (Hoặc theo role: ['USER', 'MANAGER'])

creator\_departments: string[] (Hoặc theo phòng ban)

// Form mẫu

use\_custom\_form: boolean (true = dùng form mẫu, false = dùng form mặc định)

form\_template\_id: string | null (FK -> FormTemplates, nếu use\_custom\_form = true)

// Liên kết với Workflow

linked\_process\_id: string | null (FK -> Processes, workflow sẽ chạy sau khi duyệt)

auto\_start\_workflow: boolean (Tự động tạo task từ workflow khi đề xuất được duyệt)

// Trạng thái

is\_active: boolean (Kích hoạt/khóa loại đề xuất)

allow\_draft: boolean (Cho phép lưu nháp)

allow\_cancel: boolean (Cho phép hủy đề xuất)

allow\_edit\_after\_submit: boolean (Cho phép sửa sau khi gửi)

// Thông tin tạo/cập nhật

created\_at: DateTime

created\_by: string (FK -> Users)

updated\_at: DateTime

updated\_by: string (FK -> Users)

deleted\_at: DateTime | null (Soft delete)

deleted\_by: string | null

}

**2. Bảng FormTemplates (Form mẫu)**

typescript

{

id: string (UUID)

name: string (Tên form mẫu)

description: string | null

proposal\_type\_id: string | null (FK -> ProposalTypes, nếu form thuộc loại đề xuất cụ thể)

is\_default: boolean (Form mặc định - chỉ có trường "Nội dung đề xuất")

*// Cấu trúc form*

form\_structure: JSON (Cấu trúc form dạng JSON schema)

*// Ví dụ: {*

*// "sections": [*

*// {*

*// "id": "section\_1",*

*// "title": "Thông tin chung",*

*// "fields": ["field\_1", "field\_2"]*

*// }*

*// ]*

*// }*

created\_at: DateTime

created\_by: string (FK -> Users)

updated\_at: DateTime

updated\_by: string (FK -> Users)

}

**3. Bảng FormFieldDefinitions (Trường dữ liệu trong form mẫu)**

typescript

{

id: string (UUID)

form\_template\_id: string (FK -> FormTemplates)

field\_key: string (unique trong form, ví dụ: "reason", "amount")

field\_label: string (Hiển thị label, ví dụ: "Lý do nghỉ phép")

field\_type: 'text' | 'textarea' | 'richtext' | 'number' | 'date' | 'datetime' |

'select' | 'multiselect' | 'radio' | 'checkbox' | 'toggle' |

'file' | 'multifile' | 'user' | 'multiuser' | 'email' |

'phone' | 'url' | 'rating' | 'slider' | 'color' | 'formula' |

'section' | 'table' | 'signature'

field\_config: JSON (Cấu hình chi tiết tùy theo loại)

is\_required: boolean

default\_value: JSON | null

placeholder: string | null

help\_text: string | null

order: number

is\_visible: boolean

visibility\_condition: JSON | null

validation\_rules: JSON | null

section\_id: string | null (Thuộc section nào trong form)

created\_at: DateTime

created\_by: string (FK -> Users)

updated\_at: DateTime

updated\_by: string (FK -> Users)

}

**4. Bảng Proposals (Đề xuất)**

typescript

{

id: string (UUID)

proposal\_type\_id: string (FK -> ProposalTypes)

title: string (Tiêu đề đề xuất)

content: string (Nội dung đề xuất - dùng khi không có form mẫu)

*// Người tạo*

creator\_id: string (FK -> Users)

*// Dữ liệu form*

form\_data: JSON (Dữ liệu điền trên form mẫu)

*// Ví dụ: {*

*// "reason": "Nghỉ phép năm",*

*// "start\_date": "2024-01-01",*

*// "end\_date": "2024-01-05",*

*// "total\_days": 5,*

*// "attachment": { "file\_url": "...", "file\_name": "..." }*

*// }*

*// Người duyệt*

default\_approvers: string[] (Mảng UUID - người duyệt mặc định từ loại đề xuất)

optional\_approvers: string[] (Mảng UUID - người duyệt tùy chọn do người tạo chọn)

direct\_manager\_id: string | null (UUID - quản lý trực tiếp nếu được chọn)

*// Danh sách duyệt (được tạo khi gửi duyệt)*

approval\_list: JSON (Danh sách người duyệt và trạng thái)

*// Ví dụ: {*

*// "approvers": [*

*// {*

*// "user\_id": "uuid-1",*

*// "order": 1,*

*// "status": "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED",*

*// "comment": "Đồng ý",*

*// "approved\_at": "2024-01-01T10:00:00Z"*

*// }*

*// ]*

*// }*

*// Thời gian*

created\_at: DateTime

submitted\_at: DateTime | null (Ngày gửi duyệt)

approved\_at: DateTime | null (Ngày duyệt cuối cùng)

rejected\_at: DateTime | null (Ngày từ chối)

completed\_at: DateTime | null (Ngày hoàn thành)

deadline: DateTime | null (Thời hạn duyệt)

*// Trạng thái*

status: 'DRAFT' | 'PENDING' | 'IN\_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED'

*// Liên kết với Workflow*

linked\_task\_id: string | null (FK -> Tasks, task được tạo từ workflow sau khi duyệt)

*// Thông tin khác*

attachments: JSON (File đính kèm ngoài form)

tags: string[] (Tags phân loại)

priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

created\_at: DateTime

created\_by: string (FK -> Users)

updated\_at: DateTime

updated\_by: string (FK -> Users)

}

**5. Bảng ProposalApprovals (Lịch sử duyệt)**

typescript

{

id: string (UUID)

proposal\_id: string (FK -> Proposals)

approver\_id: string (FK -> Users)

order: number (Thứ tự duyệt - quan trọng cho SEQUENTIAL)

action: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED' | 'CANCELLED'

comment: string | null (Ý kiến của người duyệt)

attachments: JSON (File đính kèm khi duyệt)

decided\_at: DateTime | null (Thời gian quyết định)

reminder\_sent\_at: DateTime | null (Thời gian gửi nhắc nhở)

reminder\_count: number (Số lần đã nhắc nhở)

created\_at: DateTime

created\_by: string (FK -> Users)

}

**6. Bảng ProposalHistories (Lịch sử đề xuất)**

typescript

{

id: string (UUID)

proposal\_id: string (FK -> Proposals)

version: number

changed\_by: string (FK -> Users)

change\_type: 'CREATED' | 'SUBMITTED' | 'UPDATED' | 'APPROVED' | 'REJECTED' |

'CANCELLED' | 'APPROVER\_ADDED' | 'APPROVER\_REMOVED' | 'WORKFLOW\_STARTED'

change\_description: string

snapshot: JSON (Toàn bộ dữ liệu proposal tại thời điểm đó)

created\_at: DateTime

created\_by: string (FK -> Users)

}

**7. Bảng ProposalComments (Bình luận)**

typescript

{

id: string (UUID)

proposal\_id: string (FK -> Proposals)

user\_id: string (FK -> Users)

content: string

attachments: JSON

created\_at: DateTime

created\_by: string (FK -> Users)

updated\_at: DateTime

updated\_by: string | null (FK -> Users)

}

**8. Bảng ProposalNotifications (Thông báo)**

typescript

{

id: string (UUID)

proposal\_id: string (FK -> Proposals)

recipient\_id: string (FK -> Users)

type: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REMINDER' | 'COMMENT' | 'WORKFLOW\_STARTED'

title: string

content: string

is\_read: boolean

read\_at: DateTime | null

created\_at: DateTime

}

**Logic nghiệp vụ**

**A. Tạo Loại Đề xuất**

1. Admin/Manager tạo ProposalType
2. Chọn form mẫu:
   * **Không dùng form mẫu:** Chỉ có trường "Nội dung đề xuất" (textarea)
   * **Dùng form mẫu có sẵn:** Chọn từ danh sách FormTemplates
   * **Tạo form mẫu mới:** Tạo FormTemplate + FormFieldDefinitions
3. Cấu hình quy trình duyệt:
   * PARALLEL: Tất cả người duyệt nhận được đề xuất cùng lúc
   * SEQUENTIAL: Duyệt theo thứ tự order, người sau chỉ nhận khi người trước duyệt xong
   * ANY\_ONE: Chỉ cần 1 trong số người duyệt đồng ý
4. Chọn người duyệt mặc định
5. Cấu hình người duyệt tùy chọn (nếu cho phép)
6. Chọn danh sách người được tạo
7. Liên kết với Process (workflow) nếu cần

**B. Tạo Đề xuất**

1. User chọn loại đề xuất
2. Hệ thống kiểm tra quyền tạo
3. Hiển thị form tương ứng:
   * Form mặc định: Chỉ có title + content
   * Form mẫu: Render dynamic form từ FormFieldDefinitions
4. User điền thông tin
5. User chọn người duyệt tùy chọn (nếu được phép):
   * Chọn từ danh sách users (theo role/department filter)
   * Hoặc chọn "Quản lý trực tiếp" (tự động lấy manager của user)
6. Lưu nháp hoặc gửi duyệt

**C. Quy trình Duyệt**

**PARALLEL (Duyệt đồng thời)**

text

Gửi duyệt → Tất cả approvers nhận thông báo →

- Tất cả APPROVED → Trạng thái: APPROVED

- 1 người REJECTED → Trạng thái: REJECTED (dừng tất cả)

- Quá hạn → Trạng thái: EXPIRED

**SEQUENTIAL (Duyệt lần lượt)**

text

Gửi duyệt → Approver 1 nhận thông báo →

- Approver 1 APPROVED → Approver 2 nhận thông báo →

- Approver 2 APPROVED → ... → APPROVED

- Approver 2 REJECTED → REJECTED

- Approver 1 REJECTED → REJECTED

**ANY\_ONE (Chỉ cần 1 người duyệt)**

text

Gửi duyệt → Tất cả approvers nhận thông báo →

- 1 người APPROVED → Trạng thái: APPROVED (những người khác tự SKIPPED)

- 1 người REJECTED → Trạng thái: REJECTED (những người khác tự SKIPPED)

- Quá hạn → Trạng thái: EXPIRED

**D. Liên kết với Workflow**

1. Khi đề xuất được APPROVED
2. Nếu linked\_process\_id != null và auto\_start\_workflow = true:
   * Tự động tạo Task từ Process
   * Copy dữ liệu từ form\_data sang custom\_fields của Task
   * Lưu linked\_task\_id vào Proposal
   * Tạo ProposalHistory với change\_type = 'WORKFLOW\_STARTED'
3. Nếu không tự động:
   * Hiển thị nút "Bắt đầu quy trình" cho người tạo
   * Người tạo có thể chọn thời điểm bắt đầu

**E. Nhắc nhở và Quá hạn**

1. Cron job chạy mỗi 30 phút kiểm tra:
   * Proposals PENDING/IN\_REVIEW quá hạn
   * Gửi reminder cho approvers chưa xử lý
   * Cập nhật status = 'EXPIRED' nếu quá deadline
2. Reminder escalation:
   * Lần 1: Sau 50% thời hạn
   * Lần 2: Sau 75% thời hạn
   * Lần 3: Sau 90% thời hạn
   * Lần 4: Khi quá hạn

**F. Phân quyền**

| **Hành động** | **Người tạo** | **Người duyệt** | **Admin** |
| --- | --- | --- | --- |
| Tạo đề xuất | ✅ | - | ✅ |
| Sửa nháp | ✅ | - | ✅ |
| Gửi duyệt | ✅ | - | ✅ |
| Hủy đề xuất | ✅ (trước khi duyệt) | - | ✅ |
| Duyệt/ từ chối | - | ✅ | ✅ |
| Bình luận | ✅ | ✅ | ✅ |
| Xem đề xuất | ✅ | ✅ | ✅ |
| Xóa đề xuất | - | - | ✅ |

**API Endpoints**

**Proposal Types**

* POST /api/proposal-types - Tạo loại đề xuất
* GET /api/proposal-types - Danh sách loại đề xuất (filter, pagination)
* GET /api/proposal-types/:id - Chi tiết loại đề xuất
* PUT /api/proposal-types/:id - Cập nhật loại đề xuất
* DELETE /api/proposal-types/:id - Xóa (soft delete)
* POST /api/proposal-types/:id/toggle-active - Kích hoạt/khóa

**Form Templates**

* POST /api/form-templates - Tạo form mẫu
* GET /api/form-templates - Danh sách form mẫu
* GET /api/form-templates/:id - Chi tiết form mẫu
* PUT /api/form-templates/:id - Cập nhật form mẫu
* DELETE /api/form-templates/:id - Xóa form mẫu
* POST /api/form-templates/:id/fields - Thêm trường vào form
* PUT /api/form-fields/:fieldId - Cập nhật trường
* DELETE /api/form-fields/:fieldId - Xóa trường
* POST /api/form-templates/:id/duplicate - Nhân bản form

**Proposals**

* POST /api/proposals - Tạo đề xuất (lưu nháp)
* GET /api/proposals - Danh sách đề xuất (filter theo status, type, creator, approver)
* GET /api/proposals/:id - Chi tiết đề xuất
* PUT /api/proposals/:id - Cập nhật đề xuất (chỉ khi DRAFT)
* DELETE /api/proposals/:id - Xóa nháp
* POST /api/proposals/:id/submit - Gửi duyệt
* POST /api/proposals/:id/cancel - Hủy đề xuất
* POST /api/proposals/:id/approve - Duyệt (người duyệt)
* POST /api/proposals/:id/reject - Từ chối (người duyệt)
* POST /api/proposals/:id/start-workflow - Bắt đầu workflow (sau khi duyệt)
* GET /api/proposals/:id/history - Lịch sử đề xuất
* GET /api/proposals/:id/comments - Bình luận
* POST /api/proposals/:id/comments - Thêm bình luận

**My Proposals**

* GET /api/my/proposals - Đề xuất tôi tạo
* GET /api/my/approvals - Đề xuất cần tôi duyệt
* GET /api/my/approved - Đề xuất tôi đã duyệt
* GET /api/my/rejected - Đề xuất tôi đã từ chối

**Reports**

* GET /api/reports/proposals-by-type - Thống kê theo loại
* GET /api/reports/proposals-by-status - Thống kê theo trạng thái
* GET /api/reports/proposals-by-approver - Thống kê theo người duyệt
* GET /api/reports/approval-time - Thời gian duyệt trung bình
* GET /api/reports/overdue-proposals - Đề xuất quá hạn

**Frontend Components**

**1. Proposal Type Builder**

typescript

interface ProposalTypeBuilderProps {

onSave: (data: ProposalTypeData) => void;

}

*// Components:*

- BasicInfoForm: Tên, code, mô tả

- ApproverConfig: Chọn người duyệt mặc định, cấu hình tùy chọn

- WorkflowSelector: Chọn PARALLEL/SEQUENTIAL/ANY\_ONE

- FormTemplateSelector: Chọn hoặc tạo form mẫu

- CreatorPermissions: Chọn người được tạo

- WorkflowLink: Liên kết với Process

**2. Proposal Creation Form**

typescript

interface ProposalFormProps {

proposalType: ProposalType;

formTemplate: FormTemplate;

onSubmit: (data: ProposalData) => void;

}

*// Flow:*

1. Chọn loại đề xuất

2. Điền thông tin form (dynamic)

3. Chọn người duyệt tùy chọn (nếu có)

4. Xem trước và gửi

**3. Approval Dashboard**

typescript

interface ApprovalDashboardProps {

pendingProposals: Proposal[];

onApprove: (id: string, comment: string) => void;

onReject: (id: string, comment: string) => void;

}

*// Hiển thị:*

- Danh sách đề xuất cần duyệt

- Thông tin người tạo, thời gian

- Nút Duyệt/Từ chối với comment

- Timeline lịch sử duyệt

**4. Proposal Detail**

typescript

interface ProposalDetailProps {

proposal: Proposal;

currentUser: User;

}

*// Hiển thị:*

- Thông tin đề xuất

- Form data đã điền

- Timeline duyệt (ai đã duyệt, khi nào, comment)

- Comments section

- Lịch sử thay đổi

- Nút hành động (duyệt, từ chối, hủy, bắt đầu workflow)

**Ví dụ sử dụng**

**Ví dụ 1: Đề xuất nghỉ phép**

json

{

"name": "Đề xuất nghỉ phép",

"code": "LEAVE\_REQUEST",

"description": "Đề xuất nghỉ phép năm, phép không lương",

"default\_approver\_ids": ["manager-1", "hr-1"],

"is\_optional\_approver": false,

"approval\_workflow": "SEQUENTIAL",

"deadline\_hours": 48,

"creator\_roles": ["USER", "MANAGER"],

"use\_custom\_form": true,

"form\_template": {

"name": "Form nghỉ phép",

"fields": [

{

"field\_key": "leave\_type",

"field\_label": "Loại phép",

"field\_type": "select",

"field\_config": {

"options": [

{ "label": "Nghỉ phép năm", "value": "annual" },

{ "label": "Nghỉ không lương", "value": "unpaid" },

{ "label": "Nghỉ bệnh", "value": "sick" }

]

},

"is\_required": true

},

{

"field\_key": "start\_date",

"field\_label": "Ngày bắt đầu",

"field\_type": "date",

"is\_required": true

},

{

"field\_key": "end\_date",

"field\_label": "Ngày kết thúc",

"field\_type": "date",

"is\_required": true

},

{

"field\_key": "reason",

"field\_label": "Lý do",

"field\_type": "textarea",

"field\_config": { "rows": 3 }

},

{

"field\_key": "attachment",

"field\_label": "File đính kèm",

"field\_type": "file",

"field\_config": {

"accepted\_types": ["pdf", "jpg", "png"],

"max\_size\_mb": 5

}

}

]

}

}

**Ví dụ 2: Đề xuất mua sắm**

json

{

"name": "Đề xuất mua sắm thiết bị",

"code": "PURCHASE\_REQUEST",

"description": "Đề xuất mua sắm thiết bị văn phòng",

"default\_approver\_ids": ["manager-1"],

"is\_optional\_approver": true,

"optional\_approver\_config": {

"max\_selectable": 2,

"role\_filter": ["MANAGER", "ADMIN"],

"allow\_direct\_manager": true

},

"approval\_workflow": "ANY\_ONE",

"deadline\_hours": 72,

"creator\_roles": ["USER", "MANAGER"],

"use\_custom\_form": true,

"linked\_process\_id": "process-purchase-1",

"auto\_start\_workflow": true,

"form\_template": {

"name": "Form mua sắm",

"fields": [

{

"field\_key": "items",

"field\_label": "Danh sách thiết bị",

"field\_type": "table",

"field\_config": {

"columns": [

{ "key": "name", "label": "Tên thiết bị", "type": "text" },

{ "key": "quantity", "label": "Số lượng", "type": "number" },

{ "key": "price", "label": "Đơn giá", "type": "number" }

]

},

"is\_required": true

},

{

"field\_key": "total\_amount",

"field\_label": "Tổng tiền",

"field\_type": "formula",

"field\_config": {

"expression": "SUM(items[].price \* items[].quantity)",

"unit": "VNĐ"

}

},

{

"field\_key": "urgency",

"field\_label": "Mức độ khẩn cấp",

"field\_type": "radio",

"field\_config": {

"options": [

{ "label": "Bình thường", "value": "normal" },

{ "label": "Khẩn cấp", "value": "urgent" }

]

}

},

{

"field\_key": "quotation",

"field\_label": "Báo giá",

"field\_type": "multifile",

"field\_config": {

"accepted\_types": ["pdf", "xlsx", "docx"],

"max\_files": 5,

"max\_size\_mb": 10

}

}

]

}

}

**Test Cases**

1. Tạo loại đề xuất với form mẫu
2. Tạo đề xuất và lưu nháp
3. Gửi duyệt và kiểm tra thông báo
4. Duyệt theo SEQUENTIAL (approver 1 duyệt → approver 2 nhận)
5. Duyệt theo PARALLEL (tất cả nhận cùng lúc)
6. Duyệt theo ANY\_ONE (1 người duyệt → kết thúc)
7. Từ chối đề xuất
8. Hủy đề xuất
9. Quá hạn và nhắc nhở
10. Liên kết workflow - tự động tạo task sau khi duyệt
11. Phân quyền người tạo và người duyệt
12. Xem lịch sử và bình luận

**Yêu cầu kỹ thuật bổ sung**

1. **Real-time updates:** Sử dụng WebSocket/SSE để cập nhật trạng thái real-time
2. **Email notifications:** Gửi email khi có đề xuất mới, được duyệt/từ chối
3. **Mobile responsive:** Giao diện phải hiển thị tốt trên mobile
4. **File upload:** Hỗ trợ upload nhiều file với progress bar
5. **Form validation:** Validate real-time theo field\_config
6. **Audit log:** Ghi log tất cả hành động
7. **Data export:** Export danh sách đề xuất ra Excel/PDF
8. **Dashboard:** Thống kê đề xuất theo loại, trạng thái, thời gian
9. **Search:** Tìm kiếm đề xuất theo nhiều tiêu chí
10. **Bulk actions:** Duyệt hàng loạt (cho admin)

text

---

\*\*Để tải file này:\*\*

```bash

cat > PROPOSAL\_SYSTEM\_DESIGN.md << 'EOF'

[paste nội dung ở trên]

EOF

**Đặc điểm chính của thiết kế:**

✅ **3 loại quy trình duyệt:** PARALLEL, SEQUENTIAL, ANY\_ONE
✅ **Form mẫu động:** Tích hợp với hệ thống Custom Fields
✅ **Liên kết Workflow:** Tự động tạo task từ Process sau khi duyệt
✅ **Người duyệt linh hoạt:** Mặc định + tùy chọn + quản lý trực tiếp
✅ **Lịch sử đầy đủ:** ProposalHistories, ProposalApprovals
✅ **Nhắc nhở tự động:** Cron job + reminder escalation
✅ **Phân quyền chi tiết:** Creator, Approver, Admin
✅ **Notification:** Email + In-app
✅ **Báo cáo thống kê:** Theo loại, trạng thái, người duyệt