# System Design Prompt - Hệ thống Quản lý Quy trình và Nhiệm vụ với Custom Fields

## Mô tả tổng quan

Xây dựng hệ thống web quản lý quy trình nghiệp vụ và nhiệm vụ với các chức năng:

- Tạo quy trình (Process) với các bước (Steps) tuần tự

- **\*\*Tạo và quản lý Custom Fields động cho từng Step\*\*** (single file, text editor, list box, check box, radio box, text input, number, date, dropdown...)

- Khởi tạo nhiệm vụ (Task) từ quy trình

- Theo dõi tiến độ, chuyển bước, quản lý todo list và comments

- Lưu trữ lịch sử cập nhật của từng nhiệm vụ

- Theo dõi người tạo (created\_by) và người cập nhật (updated\_by)

## Yêu cầu công nghệ

- **\*\*Backend:\*\*** Node.js với Express.js + TypeScript

- **\*\*Database:\*\*** PostgreSQL (sử dụng Prisma ORM)

- **\*\*Frontend:\*\*** React.js + TypeScript + Tailwind CSS

- **\*\*Authentication:\*\*** JWT (jsonwebtoken)

- **\*\*File upload:\*\*** Multer + lưu trữ local (hoặc Cloudinary)

- **\*\*Validation:\*\*** Zod hoặc class-validator

- **\*\*Form handling:\*\*** React Hook Form + Zod Resolver

## Thiết kế Custom Fields

### Khái niệm

Custom Fields là các trường dữ liệu động được định nghĩa ở mức Process và gán vào các Step cụ thể. Khi Task đi qua Step nào, các trường này sẽ hiển thị cho người thực thi nhập liệu.

### Các loại Custom Fields hỗ trợ

| Loại | Key | Mô tả | Cấu hình thêm |

|------|-----|--------|---------------|

| Text Input | `text` | Ô nhập text 1 dòng | placeholder, max\_length, min\_length |

| Text Area | `textarea` | Ô nhập text nhiều dòng | rows, max\_length |

| Text Editor | `richtext` | Trình soạn thảo rich text (bold, italic, image...) | toolbar\_options |

| Number | `number` | Ô nhập số | min, max, step, unit |

| Date | `date` | Chọn ngày | min\_date, max\_date, format |

| DateTime | `datetime` | Chọn ngày giờ | min\_date, max\_date |

| Single Select | `select` | Dropdown chọn 1 giá trị | options: [{label, value}] |

| Multi Select | `multiselect` | Dropdown chọn nhiều giá trị | options: [{label, value}] |

| Radio Box | `radio` | Chọn 1 trong nhiều options | options, layout: horizontal/vertical |

| Check Box | `checkbox` | Chọn nhiều options | options, min\_checked, max\_checked |

| Toggle | `toggle` | Bật/tắt | default\_value |

| Single File | `file` | Upload 1 file | accepted\_types, max\_size\_mb |

| Multi File | `multifile` | Upload nhiều files | accepted\_types, max\_files, max\_size\_mb |

| User Selector | `user` | Chọn 1 user từ hệ thống | role\_filter |

| Multi User Selector | `multiuser` | Chọn nhiều users | role\_filter |

| Email | `email` | Nhập email | domain\_restriction |

| Phone | `phone` | Nhập số điện thoại | country\_code |

| URL | `url` | Nhập URL | - |

| Rating | `rating` | Đánh giá sao | max\_stars (default 5) |

| Slider | `slider` | Thanh trượt | min, max, step |

| Color Picker | `color` | Chọn màu | default\_color |

| Formula | `formula` | Trường tính toán tự động từ các trường khác | formula\_expression |

### Cấu trúc dữ liệu

#### 1. Bảng `Users`

```typescript

{

id: string (UUID)

email: string (unique)

full\_name: string

password: string (hashed)

role: 'ADMIN' | 'MANAGER' | 'USER'

avatar\_url: string | null

created\_at: DateTime

created\_by: string | null (FK -> Users)

updated\_at: DateTime

updated\_by: string | null (FK -> Users)

}

**2. Bảng Processes**

typescript

{

id: string (UUID)

name: string

manager\_id: string (FK -> Users)

watcher\_ids: string[]

description: string

icon: string | null

color: string | null

is\_active: boolean

created\_at: DateTime

created\_by: string (FK -> Users)

updated\_at: DateTime

updated\_by: string (FK -> Users)

deleted\_at: DateTime | null

deleted\_by: string | null

}

**3. Bảng ProcessSteps**

typescript

{

id: string (UUID)

process\_id: string (FK -> Processes)

name: string

executor\_ids: string[]

time\_limit\_hours: number

order: number

instructions: string

step\_type: 'NORMAL' | 'APPROVAL' | 'INPUT' | 'REVIEW' | 'FINAL'

is\_required: boolean

can\_skip: boolean

created\_at: DateTime

created\_by: string (FK -> Users)

updated\_at: DateTime

updated\_by: string (FK -> Users)

}

**4. Bảng CustomFieldDefinitions (Định nghĩa custom field)**

typescript

{

id: string (UUID)

process\_id: string (FK -> Processes)

step\_id: string | null (FK -> ProcessSteps, null = áp dụng cho tất cả steps)

field\_key: string (unique trong process, ví dụ: "contract\_value")

field\_label: string (Hiển thị label, ví dụ: "Giá trị hợp đồng")

field\_type: 'text' | 'textarea' | 'richtext' | 'number' | 'date' | 'datetime' |

'select' | 'multiselect' | 'radio' | 'checkbox' | 'toggle' |

'file' | 'multifile' | 'user' | 'multiuser' | 'email' |

'phone' | 'url' | 'rating' | 'slider' | 'color' | 'formula'

field\_config: JSON (Cấu hình chi tiết tùy theo loại)

is\_required: boolean (Bắt buộc nhập)

default\_value: JSON | null (Giá trị mặc định)

placeholder: string | null

help\_text: string | null (Hướng dẫn nhập)

order: number (Thứ tự hiển thị trong form)

is\_visible: boolean (Có hiển thị không)

visibility\_condition: JSON | null (Điều kiện hiển thị dựa trên các field khác)

validation\_rules: JSON | null (Rules validate bổ sung)

created\_at: DateTime

created\_by: string (FK -> Users)

updated\_at: DateTime

updated\_by: string (FK -> Users)

}

*// Ví dụ field\_config cho từng loại:*

*// Text: { "min\_length": 5, "max\_length": 100, "pattern": "^[a-zA-Z0-9]+$" }*

*// Number: { "min": 0, "max": 1000000, "step": 1000, "unit": "VNĐ" }*

*// Select/Radio: { "options": [{ "label": "Loại A", "value": "A" }, ...], "layout": "vertical" }*

*// Checkbox: { "options": [...], "min\_checked": 1, "max\_checked": 3 }*

*// File: { "accepted\_types": ["pdf", "doc", "docx"], "max\_size\_mb": 10 }*

*// User: { "role\_filter": ["MANAGER", "USER"] }*

*// Rating: { "max\_stars": 5 }*

*// Slider: { "min": 0, "max": 100, "step": 5 }*

*// Formula: { "expression": "field\_a + field\_b \* 2", "dependencies": ["field\_a", "field\_b"] }*

*// Visibility: { "field": "status", "operator": "equals", "value": "approved" }*

**5. Bảng TaskCustomFieldValues (Giá trị custom field của task)**

typescript

{

id: string (UUID)

task\_id: string (FK -> Tasks)

field\_definition\_id: string (FK -> CustomFieldDefinitions)

value: JSON (Giá trị đã nhập, format tùy theo field\_type)

step\_id: string (FK -> ProcessSteps, step mà giá trị được nhập)

filled\_by: string (FK -> Users, người nhập giá trị)

filled\_at: DateTime

updated\_at: DateTime

updated\_by: string (FK -> Users)

}

*// Ví dụ value cho từng loại:*

*// text: "Nguyen Van A"*

*// number: 500000000*

*// select/radio: "A"*

*// multiselect/checkbox: ["A", "B"]*

*// file: { "file\_url": "...", "file\_name": "contract.pdf", "file\_size": 1024 }*

*// multifile: [{ "file\_url": "...", "file\_name": "..." }, ...]*

*// user: "uuid-user-123"*

*// multiuser: ["uuid-user-1", "uuid-user-2"]*

*// rating: 4*

*// slider: 75*

*// formula: 1500000000 (kết quả tính toán)*

**6. Bảng Tasks**

typescript

{

id: string (UUID)

process\_id: string (FK -> Processes)

name: string

content: string

current\_step\_id: string (FK -> ProcessSteps)

executor\_ids: string[]

watcher\_ids: string[]

previous\_executor\_id: string | null

started\_at: DateTime

deadline: DateTime

completed\_at: DateTime | null

status: 'PENDING' | 'IN\_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED'

file\_uploads: JSON

created\_at: DateTime

created\_by: string (FK -> Users)

updated\_at: DateTime

updated\_by: string (FK -> Users)

}

**7. Bảng Todos**

typescript

{

id: string (UUID)

task\_id: string (FK -> Tasks)

description: string

executor\_id: string (FK -> Users)

deadline: DateTime

watcher\_ids: string[]

files: JSON

is\_completed: boolean

completed\_at: DateTime | null

created\_at: DateTime

created\_by: string (FK -> Users)

updated\_at: DateTime

updated\_by: string (FK -> Users)

}

**8. Bảng TaskComments**

typescript

{

id: string (UUID)

task\_id: string (FK -> Tasks)

user\_id: string (FK -> Users)

content: string

files: JSON

created\_at: DateTime

created\_by: string (FK -> Users)

updated\_at: DateTime

updated\_by: string | null (FK -> Users)

}

**9. Bảng TaskHistories**

typescript

{

id: string (UUID)

task\_id: string (FK -> Tasks)

version: number

changed\_by: string (FK -> Users)

change\_type: 'CREATED' | 'UPDATED' | 'STEP\_CHANGED' | 'FIELD\_UPDATED' | 'COMPLETED' | 'CANCELLED'

change\_description: string

snapshot: JSON (Toàn bộ dữ liệu task + custom\_fields + todos + comments)

created\_at: DateTime

created\_by: string (FK -> Users)

}

**API Endpoints**

**Custom Fields Management**

* POST /api/processes/:processId/custom-fields - Tạo custom field cho process
* GET /api/processes/:processId/custom-fields - Lấy danh sách custom fields của process
* GET /api/custom-fields/:fieldId - Lấy chi tiết custom field
* PUT /api/custom-fields/:fieldId - Cập nhật custom field
* DELETE /api/custom-fields/:fieldId - Xóa custom field
* POST /api/custom-fields/reorder - Sắp xếp lại thứ tự custom fields
* POST /api/custom-fields/duplicate - Nhân bản custom field
* GET /api/custom-fields/types - Lấy danh sách các loại field hỗ trợ
* POST /api/custom-fields/validate-config - Validate cấu hình field

**Task Custom Field Values**

* GET /api/tasks/:taskId/custom-fields - Lấy custom fields hiển thị ở step hiện tại
* PUT /api/tasks/:taskId/custom-fields - Lưu giá trị custom fields (bulk update)
* GET /api/tasks/:taskId/custom-fields/history - Lịch sử thay đổi giá trị
* POST /api/tasks/:taskId/custom-fields/validate - Validate giá trị trước khi lưu

**Các API khác (giữ nguyên)**

* Authentication, Users, Processes, Steps, Tasks, Todos, Comments, Files, Reports

**Logic nghiệp vụ**

**Quản lý Custom Fields**

**Tạo Custom Field**

1. Admin/Manager chọn Process và Step (hoặc tất cả steps)
2. Chọn loại field từ danh sách
3. Cấu hình field (options, validation rules, default values)
4. Hệ thống validate cấu hình
5. Lưu vào CustomFieldDefinitions
6. Tự động set order = max(order) + 1

**Gán Custom Field vào Step**

* Custom Field có thể gán vào:
  + Một step cụ thể (step\_id != null)
  + Tất cả steps (step\_id = null)
  + Nhiều steps (tạo bảng trung gian nếu cần)

**Hiển thị Custom Fields trong Task**

**Khi Task đến Step**

1. Hệ thống lấy tất cả CustomFieldDefinitions có:
   * process\_id = process của task
   * step\_id = current\_step\_id (hoặc step\_id = null)
   * is\_visible = true
2. Kiểm tra visibility\_condition (nếu có)
3. Sắp xếp theo order
4. Trả về cho frontend để render form động

**Lưu Giá trị**

1. User nhập giá trị vào form
2. Frontend gửi PUT /api/tasks/:taskId/custom-fields
3. Backend validate giá trị theo field\_config và validation\_rules
4. Lưu vào TaskCustomFieldValues
5. Tạo TaskHistories với change\_type = 'FIELD\_UPDATED'

**Công thức tính toán (Formula Fields)**

1. Xác định dependencies từ formula\_expression
2. Lấy giá trị các field dependencies
3. Tính toán kết quả
4. Lưu kết quả vào TaskCustomFieldValues
5. Tự động cập nhật khi dependencies thay đổi

**Validate theo Visibility Condition**

json

*// Ví dụ: chỉ hiển thị "Lý do từ chối" khi "Kết quả phê duyệt" = "Từ chối"*

{

"field": "approval\_result",

"operator": "equals",

"value": "rejected"

}

*// Các operator hỗ trợ:*

*// equals, not\_equals, contains, not\_contains,*

*// greater\_than, less\_than, greater\_or\_equal, less\_or\_equal,*

*// is\_empty, is\_not\_empty, in\_array, not\_in\_array*

**Frontend Components**

**Custom Field Builder (Trang quản lý)**

typescript

interface CustomFieldBuilderProps {

processId: string;

onSave: (field: CustomFieldDefinition) => void;

}

*// Components:*

- FieldTypeSelector: Chọn loại field

- FieldConfigEditor: Cấu hình theo loại (dynamic)

- OptionsEditor: Thêm/sửa/xóa options cho select, radio, checkbox

- ValidationRulesEditor: Cấu hình rules

- VisibilityConditionEditor: Cấu hình điều kiện hiển thị

- FieldPreview: Xem trước field

**Dynamic Form Renderer (Trong Task)**

typescript

interface DynamicFormProps {

fields: CustomFieldDefinition[];

values: Record<string, any>;

onChange: (fieldKey: string, value: any) => void;

onValidate: (fieldKey: string, value: any) => string | null;

}

*// Render theo field\_type:*

- text: <Input type="text" />

- textarea: <TextArea rows={config.rows} />

- richtext: <RichTextEditor toolbar={config.toolbar\_options} />

- number: <Input type="number" min={config.min} max={config.max} />

- date: <DatePicker minDate={config.min\_date} />

- select: <Select options={config.options} />

- multiselect: <MultiSelect options={config.options} />

- radio: <RadioGroup options={config.options} layout={config.layout} />

- checkbox: <CheckboxGroup options={config.options} />

- toggle: <Switch defaultChecked={config.default\_value} />

- file: <FileUpload accept={config.accepted\_types} maxSize={config.max\_size\_mb} />

- multifile: <MultiFileUpload />

- user: <UserSelector roleFilter={config.role\_filter} />

- rating: <Rating maxStars={config.max\_stars} />

- slider: <Slider min={config.min} max={config.max} step={config.step} />

- color: <ColorPicker defaultValue={config.default\_color} />

**Ví dụ sử dụng**

**Ví dụ 1: Quy trình phê duyệt hợp đồng**

json

*// Custom Fields cho Step 1: "Soạn thảo hợp đồng"*

[

{

"field\_key": "contract\_type",

"field\_label": "Loại hợp đồng",

"field\_type": "select",

"field\_config": {

"options": [

{ "label": "Hợp đồng mua bán", "value": "purchase" },

{ "label": "Hợp đồng dịch vụ", "value": "service" },

{ "label": "Hợp đồng lao động", "value": "labor" }

]

},

"is\_required": true

},

{

"field\_key": "contract\_value",

"field\_label": "Giá trị hợp đồng",

"field\_type": "number",

"field\_config": {

"min": 0,

"max": 10000000000,

"step": 1000000,

"unit": "VNĐ"

},

"is\_required": true

},

{

"field\_key": "partner\_info",

"field\_label": "Thông tin đối tác",

"field\_type": "textarea",

"field\_config": {

"rows": 5,

"max\_length": 1000

}

},

{

"field\_key": "contract\_file",

"field\_label": "File hợp đồng",

"field\_type": "file",

"field\_config": {

"accepted\_types": ["pdf", "doc", "docx"],

"max\_size\_mb": 20

},

"is\_required": true

}

]

*// Custom Fields cho Step 2: "Phê duyệt"*

[

{

"field\_key": "approval\_result",

"field\_label": "Kết quả phê duyệt",

"field\_type": "radio",

"field\_config": {

"options": [

{ "label": "Đồng ý", "value": "approved" },

{ "label": "Từ chối", "value": "rejected" },

{ "label": "Cần chỉnh sửa", "value": "revision" }

],

"layout": "horizontal"

},

"is\_required": true

},

{

"field\_key": "reject\_reason",

"field\_label": "Lý do từ chối",

"field\_type": "textarea",

"visibility\_condition": {

"field": "approval\_result",

"operator": "equals",

"value": "rejected"

}

},

{

"field\_key": "approval\_rating",

"field\_label": "Đánh giá chất lượng",

"field\_type": "rating",

"field\_config": {

"max\_stars": 5

}

}

]

**Ví dụ 2: Quy trình tuyển dụng**

json

*// Custom Fields cho Step 1: "Tiếp nhận hồ sơ"*

[

{

"field\_key": "candidate\_name",

"field\_label": "Họ tên ứng viên",

"field\_type": "text",

"is\_required": true

},

{

"field\_key": "position",

"field\_label": "Vị trí ứng tuyển",

"field\_type": "select",

"field\_config": {

"options": [

{ "label": "Developer", "value": "dev" },

{ "label": "Tester", "value": "tester" },

{ "label": "BA", "value": "ba" },

{ "label": "PM", "value": "pm" }

]

}

},

{

"field\_key": "cv\_file",

"field\_label": "CV ứng viên",

"field\_type": "multifile",

"field\_config": {

"accepted\_types": ["pdf", "doc"],

"max\_files": 3,

"max\_size\_mb": 5

}

},

{

"field\_key": "skills",

"field\_label": "Kỹ năng",

"field\_type": "checkbox",

"field\_config": {

"options": [

{ "label": "JavaScript", "value": "js" },

{ "label": "Python", "value": "python" },

{ "label": "Java", "value": "java" },

{ "label": "SQL", "value": "sql" }

]

}

}

]

*// Custom Fields cho Step 2: "Phỏng vấn"*

[

{

"field\_key": "interviewer",

"field\_label": "Người phỏng vấn",

"field\_type": "user",

"field\_config": {

"role\_filter": ["MANAGER", "ADMIN"]

}

},

{

"field\_key": "interview\_score",

"field\_label": "Điểm phỏng vấn",

"field\_type": "slider",

"field\_config": {

"min": 0,

"max": 10,

"step": 0.5

}

},

{

"field\_key": "interview\_notes",

"field\_label": "Ghi chú phỏng vấn",

"field\_type": "richtext",

"field\_config": {

"toolbar\_options": ["bold", "italic", "underline", "list", "image"]

}

},

{

"field\_key": "interview\_result",

"field\_label": "Kết quả",

"field\_type": "toggle",

"field\_config": {

"default\_value": false

},

"help\_text": "Bật nếu đạt yêu cầu"

}

]

**Yêu cầu kỹ thuật**

1. **Dynamic Form Rendering:** Frontend phải render form động dựa trên field\_type
2. **Real-time Validation:** Validate ngay khi user nhập liệu
3. **File Upload:** Hỗ trợ upload file với progress bar
4. **Auto-save:** Tự động lưu nháp sau mỗi 30 giây
5. **Responsive Design:** Form phải hiển thị tốt trên mobile
6. **Accessibility:** Tuân thủ WCAG 2.1
7. **Performance:** Lazy load các field components
8. **Caching:** Cache field definitions để tăng tốc

**Test Cases**

1. Tạo custom field đầy đủ các loại
2. Validate cấu hình field (options trống, min > max...)
3. Hiển thị đúng field ở đúng step
4. Visibility condition hoạt động đúng
5. Required field validation
6. File upload đúng loại và kích thước
7. Formula field tính toán đúng
8. Lưu và đọc lại giá trị custom fields
9. Lịch sử thay đổi custom fields
10. Phân quyền quản lý custom fields