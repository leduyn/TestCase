# System Design Prompt - Hệ thống Quản lý Quy trình và Nhiệm vụ

## Mô tả tổng quan

Xây dựng hệ thống web quản lý quy trình nghiệp vụ và nhiệm vụ với các chức năng:

- Tạo quy trình (Process) với các bước (Steps) tuần tự
- Khởi tạo nhiệm vụ (Task) từ quy trình
- Theo dõi tiến độ, chuyển bước, quản lý todo list và comments
- Lưu trữ lịch sử cập nhật của từng nhiệm vụ
- Theo dõi người tạo (created_by) và người cập nhật (updated_by) cho tất cả các bảng

## Yêu cầu công nghệ

- **Backend:** Node.js với Express.js + TypeScript
- **Database:** PostgreSQL (sử dụng Prisma ORM)
- **Frontend:** React.js + TypeScript + Tailwind CSS
- **Authentication:** JWT (jsonwebtoken)
- **File upload:** Multer + lưu trữ local (hoặc Cloudinary)
- **Validation:** Zod hoặc class-validator

## Cấu trúc dữ liệu chi tiết

### 1. Bảng `Users`

````typescript
{
  id: string (UUID)
  email: string (unique)
  full_name: string
  password: string (hashed)
  role: 'ADMIN' | 'MANAGER' | 'USER'
  created_at: DateTime
  created_by: string (FK -> Users, nullable cho user đầu tiên)
  updated_at: DateTime
  updated_by: string (FK -> Users, nullable)
}

### 2. Bảng `Processes` (Quy trình)
```typescript
{
  id: string (UUID)
  name: string
  manager_id: string (FK -> Users)
  watcher_ids: string[] (Mảng UUID users)
  description: string
  created_at: DateTime
  created_by: string (FK -> Users)
  updated_at: DateTime
  updated_by: string (FK -> Users)
  deleted_at: DateTime | null (Soft delete)
  deleted_by: string | null (FK -> Users)
}
### 3. Bảng `ProcessSteps` (Bước trong quy trình)
```typescript
{
  id: string (UUID)
  process_id: string (FK -> Processes)
  name: string
  executor_ids: string[] (Mảng UUID users)
  time_limit_hours: number
  order: number (Thứ tự step, bắt đầu từ 1)
  instructions: string
  created_at: DateTime
  created_by: string (FK -> Users)
  updated_at: DateTime
  updated_by: string (FK -> Users)
}
### 4. Bảng `Tasks` (Nhiệm vụ)
```typescript
{
  id: string (UUID)
  process_id: string (FK -> Processes)
  name: string
  content: string
  custom_fields: JSON (Trường tùy chỉnh)
  current_step_id: string (FK -> ProcessSteps)
  executor_ids: string[] (Người thực thi hiện tại)
  watcher_ids: string[] (Người theo dõi)
  previous_executor_id: string (Người thực thi trước đó)
  started_at: DateTime
  deadline: DateTime
  completed_at: DateTime | null
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED'
  file_uploads: JSON
  created_at: DateTime
  created_by: string (FK -> Users)
  updated_at: DateTime
  updated_by: string (FK -> Users)
}
### 5. Bảng `Todos`
```typescript
{
  id: string (UUID)
  task_id: string (FK -> Tasks)
  description: string
  executor_id: string (FK -> Users)
  deadline: DateTime
  watcher_ids: string[]
  files: JSON
  is_completed: boolean
  completed_at: DateTime | null
  created_at: DateTime
  created_by: string (FK -> Users)
  updated_at: DateTime
  updated_by: string (FK -> Users)
}
### 6. Bảng `TaskComments`
```typescript
{
  id: string (UUID)
  task_id: string (FK -> Tasks)
  user_id: string (FK -> Users)
  content: string
  files: JSON
  created_at: DateTime
  created_by: string (FK -> Users)
  updated_at: DateTime
  updated_by: string (FK -> Users, nullable)
}
### 7. Bảng `TaskHistories` (Lịch sử cập nhật)
```typescript
{
  id: string (UUID)
  task_id: string (FK -> Tasks)
  version: number (Tăng dần mỗi lần cập nhật)
  changed_by: string (FK -> Users)
  change_type: 'CREATED' | 'UPDATED' | 'STEP_CHANGED' | 'COMPLETED' | 'CANCELLED'
  change_description: string
  snapshot: JSON (Toàn bộ dữ liệu task + todos + comments tại thời điểm đó)
  created_at: DateTime
  created_by: string (FK -> Users)
}
##API Endpoints
### Authentication
POST /api/auth/register - Đăng ký

POST /api/auth/login - Đăng nhập

GET /api/auth/me - Lấy thông tin user hiện tại

PUT /api/auth/change-password - Đổi mật khẩu

### Users
GET /api/users - Danh sách users (pagination, search)

GET /api/users/:id - Chi tiết user

PUT /api/users/:id - Cập nhật user

DELETE /api/users/:id - Xóa user (soft delete)

### Processes
POST /api/processes - Tạo quy trình mới

GET /api/processes - Danh sách quy trình

GET /api/processes/:id - Chi tiết quy trình

PUT /api/processes/:id - Cập nhật quy trình

DELETE /api/processes/:id - Xóa quy trình (soft delete)

POST /api/processes/:id/steps - Thêm step

PUT /api/steps/:stepId - Cập nhật step

DELETE /api/steps/:stepId - Xóa step

### Tasks
POST /api/tasks - Khởi tạo nhiệm vụ

GET /api/tasks - Danh sách nhiệm vụ

GET /api/tasks/:id - Chi tiết nhiệm vụ

PUT /api/tasks/:id - Cập nhật nhiệm vụ

POST /api/tasks/:id/transition - Chuyển bước

POST /api/tasks/:id/complete - Hoàn thành

POST /api/tasks/:id/cancel - Hủy nhiệm vụ

GET /api/tasks/:id/history - Lịch sử cập nhật

GET /api/tasks/:id/history/:version - Snapshot tại version

### Todos
POST /api/tasks/:taskId/todos - Thêm todo

PUT /api/todos/:todoId - Cập nhật todo

DELETE /api/todos/:todoId - Xóa todo

PUT /api/todos/:todoId/toggle - Đánh dấu hoàn thành

### Comments
POST /api/tasks/:taskId/comments - Thêm bình luận

GET /api/tasks/:taskId/comments - Danh sách bình luận

PUT /api/comments/:commentId - Sửa bình luận

DELETE /api/comments/:commentId - Xóa bình luận

### Files
POST /api/upload - Upload file

DELETE /api/files/:fileId - Xóa file

### Reports
GET /api/reports/tasks-by-status - Thống kê theo trạng thái

GET /api/reports/tasks-by-process - Thống kê theo quy trình

GET /api/reports/tasks-by-executor - Thống kê theo người thực thi

GET /api/reports/overdue-tasks - Danh sách task quá hạn

## Logic nghiệp vụ
### Khởi tạo Task
Set current_step_id = step đầu tiên (order = 1)

Set executor_ids = executor_ids của step đầu tiên

Set deadline = now + time_limit_hours của step đầu tiên

Set status = 'IN_PROGRESS'

### Tạo TaskHistories version 1

Chuyển bước (Transition)
Tìm step tiếp theo (order + 1)

Nếu không còn step -> hoàn thành task

Cập nhật executor, deadline, started_at

Tạo TaskHistories mới

Lưu lịch sử
Mỗi lần update task -> tạo snapshot trong TaskHistories

Snapshot chứa toàn bộ dữ liệu task + todos + comments

Xử lý overdue
Cron job mỗi giờ kiểm tra tasks quá hạn

Tự động cập nhật status = 'OVERDUE'

Authorization
Chỉ created_by hoặc manager_id được edit/delete process

Chỉ executor hiện tại được chuyển bước

Admin có toàn quyền

Watchers chỉ có quyền xem và comment

Yêu cầu Frontend
Trang cần xây dựng
Trang Login/Register

Trang Dashboard - Thống kê tổng quan

Trang Quản lý Processes - CRUD processes và steps

Trang Danh sách Tasks - Bảng tasks với filter, sort, pagination

Trang Chi tiết Task - Timeline, Todo list, Comments, Files, History

Trang Quản lý Users (chỉ admin)

Trang Hồ sơ cá nhân

UI Components
Data table với sorting, filtering, pagination

Modal forms cho CRUD

File upload component (drag & drop)

Timeline component cho lịch sử

Badge/Status indicators

Rich text editor

Toast notifications

User avatar component

Breadcrumb navigation

Loading skeletons

Yêu cầu kỹ thuật
Validation tất cả input

Error handling toàn cục

Authentication middleware

RBAC (Role-Based Access Control)

Pagination cho tất cả list endpoints

Database transaction khi cần

CORS configuration

Environment variables

Docker support

Logging các hoạt động quan trọng

Rate limiting

Security: hash password, sanitize input, chống SQL injection

## Cấu trúc thư mục

project-root/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   ├── middlewares/
│   │   ├── routes/
│   │   ├── utils/
│   │   ├── config/
│   │   └── index.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── uploads/
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── contexts/
│   │   ├── utils/
│   │   └── App.tsx
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
├── docs/
│   ├── API.md
│   └── DATABASE.md
├── docker-compose.yml
└── README.md
Yêu cầu cuối cùng
Code đầy đủ, có comment giải thích

Prisma schema hoàn chỉnh

Seed data để test (3 users, 2 processes, 5 tasks)

README.md hướng dẫn cài đặt

Xử lý edge cases

Postman collection hoặc file .http để test API

Timestamps sử dụng UTC

IDs sử dụng UUID v4

Dữ liệu mẫu
json
{
  "name": "Quy trình phê duyệt hợp đồng",
  "description": "Quy trình phê duyệt hợp đồng mua bán",
  "steps": [
    {
      "name": "Soạn thảo hợp đồng",
      "executor_ids": ["user-2"],
      "time_limit_hours": 24,
      "order": 1,
      "instructions": "Soạn thảo hợp đồng theo mẫu"
    },
    {
      "name": "Phê duyệt của trưởng phòng",
      "executor_ids": ["user-3", "user-4"],
      "time_limit_hours": 48,
      "order": 2,
      "instructions": "Kiểm tra và phê duyệt"
    },
    {
      "name": "Ký duyệt của giám đốc",
      "executor_ids": ["user-5"],
      "time_limit_hours": 24,
      "order": 3,
      "instructions": "Ký duyệt cuối cùng"
    }
  ]
}
Test cases
Tạo process với 3 steps

Khởi tạo task, kiểm tra current_step = step 1

Chuyển bước, kiểm tra executor thay đổi

Hoàn thành task ở step cuối

Xem lịch sử task

Thêm todo, comment, file

Kiểm tra phân quyền

Kiểm tra soft delete

Kiểm tra task overdue

Kiểm tra validation
````
