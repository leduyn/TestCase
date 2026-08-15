# Kế hoạch Triển khai Hệ thống Phân tích Tài liệu & Quản lý Kiểm thử Tự động (AI Test Case Generator & Management System)

Dự án xây dựng một ứng dụng web Full-stack toàn diện cho phép người dùng đăng ký/đăng nhập, tải lên tài liệu yêu cầu (PDF/TXT/DOCX), sử dụng AI (hỗ trợ đa nhà cung cấp: Google Gemini, OpenAI, Claude, DeepSeek...) để tự động phân tích và sinh bộ Test Case chuẩn. Đồng thời, hệ thống cung cấp giao diện quản lý thực thi kiểm thử (nhập Server, Hệ điều hành, Kết quả thực tế, Đánh giá Pass/Fail, Ghi chú, gắn cờ lỗi thất bại), cơ chế khởi tạo Database tự động dạng Odoo Database Manager, lưu trữ toàn bộ dữ liệu vào PostgreSQL và xuất báo cáo Excel định dạng chuyên nghiệp.

---

## User Review Required

> [!IMPORTANT]
> **Các điểm kiến trúc & công nghệ chính:**
> 1. **Khởi tạo & Quản lý Database (Tương tự Odoo)**:
>    - Khi hệ thống chưa kết nối được DB, tự động chuyển hướng đến trang Setup Wizard 4 bước.
>    - Cho phép nhập Host/Port/User/Password, test kết nối, liệt kê DB, tạo DB mới, tự động chạy Prisma migration và tạo tài khoản Admin đầu tiên.
> 2. **Tech Stack**:
>    - **Backend**: Node.js (Express + TypeScript) + Prisma ORM + `pg` native driver + PostgreSQL.
>    - **Frontend**: React (Vite) + TypeScript + Tailwind CSS + Lucide Icons.
>    - **Database**: PostgreSQL lưu trữ Users, Documents, TestSuites, TestCases, TestExecutions, AIConfigs.
> 3. **AI Provider Config**: Hỗ trợ Google Gemini, OpenAI GPT-4o, Claude 3.5, DeepSeek v3, Ollama/Local trực tiếp trên giao diện Settings.
> 4. **Thực thi Test Case**: Giao diện Drawer trực quan, chọn/nhập **Môi trường Server** (DEV, STAGING, PROD...), **Hệ điều hành** (Windows, macOS, Android, iOS...), cập nhật trạng thái (`PASSED`, `FAILED`, `BLOCKED`, `UNTESTED`), nhập Kết quả thực tế, Đánh giá, Ghi chú và highlight màu sắc cảnh báo cho các case thất bại.
> 5. **Xuất Excel Chuẩn Đẹp**: Xuất file `.xlsx` theo mẫu chuẩn (màu sắc header, phân màu App/CMS, tô màu kết quả thực thi và cột Server, OS).

---

## Kiến trúc Hệ thống & Cơ sở dữ liệu (PostgreSQL Schema)

### Luồng Database Setup (Tương tự Odoo)

```mermaid
flowchart TD
    A["🚀 Server Khởi động"] --> B{"Kiểm tra DATABASE_URL trong .env"}
    B -- "Có cấu hình" --> C{"Test kết nối PostgreSQL"}
    B -- "Không có / Trống" --> F["⚠️ API trả SETUP_REQUIRED"]
    C -- "✅ Kết nối OK" --> D["Kiểm tra Schema (Prisma)"]
    C -- "❌ Kết nối thất bại" --> F
    D -- "Schema OK" --> E["✅ Chạy bình thường"]
    D -- "Schema chưa có / cũ" --> G["Auto Migrate Schema"]
    G --> E
    F --> H["Frontend hiển thị trang Setup Database"]
    H --> I["Người dùng nhập:<br/>• DB Host / IP<br/>• Port (5432)<br/>• DB Username<br/>• DB Password<br/>• Tên Database"]
    I --> J{"Database đã tồn tại?"}
    J -- "Có" --> K["Kết nối đến DB hiện có"]
    J -- "Không" --> L["Tạo mới Database trên Server"]
    L --> K
    K --> M["Chạy Prisma Migration (tạo bảng)"]
    M --> N["Tạo tài khoản Admin đầu tiên"]
    N --> O["Ghi cấu hình vào .env"]
    O --> P["🔄 Reload kết nối → Chạy bình thường"]
```

### PostgreSQL Schema

```mermaid
erDiagram
    USERS ||--o{ DOCUMENTS : uploads
    USERS ||--o{ TEST_EXECUTIONS : executes
    DOCUMENTS ||--o{ TEST_SUITES : generates
    TEST_SUITES ||--o{ TEST_CASES : contains
    TEST_CASES ||--o{ TEST_EXECUTIONS : tracked_by
    USERS ||--o{ AI_CONFIGS : configures

    USERS {
        uuid id PK
        string email
        string password_hash
        string full_name
        string role
        timestamp created_at
    }

    DOCUMENTS {
        uuid id PK
        uuid user_id FK
        string filename
        string file_type
        text raw_content
        string status
        timestamp created_at
    }

    TEST_SUITES {
        uuid id PK
        uuid document_id FK
        string name
        string module_name
        text summary
        text assumptions
        timestamp created_at
    }

    TEST_CASES {
        uuid id PK
        uuid test_suite_id FK
        string test_case_code "TC_KH_001"
        string module
        string platform "App | CMS | Web"
        string title
        string test_type "Luồng chuẩn | Luồng ngoại lệ | Giá trị biên"
        text preconditions
        text steps
        text expected_result
        string priority "Cao | Trung bình | Thấp"
        int order_index
        timestamp created_at
    }

    TEST_EXECUTIONS {
        uuid id PK
        uuid test_case_id FK
        uuid executed_by FK
        string server "DEV | STAGING | UAT | PROD"
        string os "Windows 11 | macOS | Android 14 | iOS 17 | Ubuntu"
        string status "PASSED | FAILED | BLOCKED | UNTESTED"
        text actual_result
        text evaluation
        text notes
        timestamp executed_at
        timestamp updated_at
    }

    AI_CONFIGS {
        uuid id PK
        uuid user_id FK
        string provider "gemini | openai | anthropic | deepseek | custom"
        string api_key
        string model_name
        string base_url
        boolean is_active
    }
```

---

## Chi tiết Triển khai

### 1. Database Setup & Initialization Module (Tương tự Odoo)
- **`server/src/services/databaseSetup.ts`**:
  - `testConnection()`: Kiểm tra kết nối PostgreSQL server thông qua `pg.Client`.
  - `listDatabases()`: Liệt kê danh sách database có trên server.
  - `createDatabase()`: Tạo database mới an toàn (`CREATE DATABASE`).
  - `runMigration()`: Chạy `prisma migrate deploy` hoặc `prisma db push`.
  - `createAdminUser()`: Tạo tài khoản Admin đầu tiên (mã hoá bcrypt).
  - `updateEnvFile()`: Lưu `DATABASE_URL` vào `.env`.
- **`server/src/config/database.ts`**:
  - Quản lý kết nối Prisma Client bằng Proxy pattern, hỗ trợ `reinitializePrisma()`.
- **`server/src/controllers/setupController.ts` & `server/src/routes/setupRoutes.ts`**:
  - Endpoint `/api/setup/status`, `/api/setup/test-connection`, `/api/setup/create-database`, `/api/setup/initialize`.
  - Middleware `dbCheckMiddleware`: Chặn API khi DB chưa sẵn sàng (trả về 503 `SETUP_REQUIRED`).
- **`client/src/pages/Setup/DatabaseSetupPage.tsx`**:
  - Wizard 4 bước: (1) Kết nối Server -> (2) Chọn/Tạo Database -> (3) Tạo Admin -> (4) Khởi tạo hệ thống.
- **`client/src/App.tsx`**:
  - Tự động kiểm tra trạng thái và điều hướng tới `/setup` nếu cần.

### 2. Backend Service (Node.js + Express + PostgreSQL + Prisma)
- **`prisma/schema.prisma`**: Đầy đủ models `User`, `Document`, `TestSuite`, `TestCase`, `TestExecution` (có `server` và `os`), `AiConfig`.
- **`server/src/services/ai/aiService.ts`**: Multi-provider AI Adapter (Gemini, OpenAI, Claude, DeepSeek).
- **`server/src/services/documentParser.ts`**: Bộ đọc PDF, DOCX, TXT.
- **`server/src/services/excelExporter.ts`**: Module xuất file Excel `.xlsx` chuyên nghiệp với ExcelJS (màu sắc header, phân biệt App/CMS, cột Server, OS, kết quả kiểm thử).
- **`server/src/controllers/`**: `authController`, `aiController`, `testCaseController`, `executionController`, `exportController`.

### 3. Frontend Application (React + Vite + Tailwind CSS)
- **`client/src/pages/Auth/`**: `Login.tsx`, `Register.tsx`.
- **`client/src/pages/Dashboard.tsx`**: Bảng điều khiển thống kê tổng quan (Suites, Test Cases, Pass Rate, Failed Cases).
- **`client/src/pages/Generate.tsx`**: Kéo thả tài liệu, chọn Provider AI & Model, sinh Test Case tự động.
- **`client/src/pages/SuiteDetail.tsx`**: Bảng chi tiết Test Case, Drawer thực thi (Server, OS, kết quả thực tế, đánh giá Pass/Fail, badge cảnh báo FAILED).
- **`client/src/pages/Settings.tsx`**: Quản lý API Keys AI và trạng thái kết nối PostgreSQL.

---

## Kế hoạch Thực hiện (Phases)

| Phase | Nội dung công việc | Trạng thái |
| :--- | :--- | :--- |
| **Phase 0: Database Setup Module** ⭐ | - Service `databaseSetup.ts` (test connection, create DB, run migration, create admin).<br>- Routes `/api/setup/*` & `dbCheckMiddleware`.<br>- Frontend `DatabaseSetupPage.tsx` dạng wizard 4 bước.<br>- Auto-redirect logic khi DB chưa kết nối. | ✅ Hoàn thành |
| **Phase 1: Setup & Database** | - Schema Prisma PostgreSQL (User, Document, TestCase, TestExecution với `server`, `os`).<br>- Kết nối DB và migration. | ✅ Hoàn thành |
| **Phase 2: Auth & User Management** | - Backend Auth API (Register, Login, JWT Middleware).<br>- Frontend Login/Register & AuthContext. | ✅ Hoàn thành |
| **Phase 3: Multi-Provider AI Engine** | - AI Service (Gemini, OpenAI, Claude, DeepSeek).<br>- Document Parser (PDF/TXT/DOCX).<br>- Frontend Generate Studio. | ✅ Hoàn thành |
| **Phase 4: Test Case Execution & Detail View** | - Bảng danh sách Test Case, Drawer chi tiết.<br>- Form nhập: Server, OS, Actual Result, Status, Notes.<br>- Badge cảnh báo FAILED trực quan & bộ lọc. | ✅ Hoàn thành |
| **Phase 5: Excel Export & Dashboard Stats** | - Engine xuất Excel (.xlsx) với ExcelJS.<br>- Dashboard thống kê tiến độ kiểm thử. | ✅ Hoàn thành |
| **Phase 6: Verification & Polish** | - Kiểm tra typecheck TypeScript (`server` + `client`).<br>- Kiểm thử toàn diện các luồng. | ✅ Hoàn thành |

---

## Hướng dẫn Sử dụng Tính năng Khởi tạo Database (Odoo-like)

1. Mở trình duyệt truy cập: `http://localhost:5173/setup` (hoặc mở ứng dụng tại `http://localhost:5173`, hệ thống sẽ tự phát hiện và chuyển đến trang Setup).
2. **Bước 1 - Kết nối Server**: Nhập `Host` (VD: `localhost`), `Port` (5432), `Username` (VD: `postgres`), `Password` -> Nhấn **"Test Kết nối"**.
3. **Bước 2 - Chọn Database**: Chọn một database có sẵn hoặc nhập tên database mới (VD: `testcase_db`) -> Nhấn **"Tạo Database Ngay"**.
4. **Bước 3 - Tài khoản Admin**: Nhập Họ tên, Email (VD: `admin@company.com`), Mật khẩu Admin.
5. **Bước 4 - Khởi tạo Hệ thống**: Nhấn **"🚀 Khởi tạo Hệ thống"**. Hệ thống sẽ tự động chạy migration, tạo bảng và tạo tài khoản Admin, sau đó chuyển hướng đến trang Đăng nhập.
