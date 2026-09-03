# Custom Fields - Task Checklist

## Giai đoạn 1: Database Schema
- [x] Thêm `CustomFieldDefinition` model vào schema.prisma
- [x] Thêm `TaskCustomFieldValue` model vào schema.prisma
- [x] Thêm enum `FIELD_UPDATED` vào `TaskHistoryChangeType`
- [x] Cập nhật quan hệ User, Process, ProcessStep, Task
- [x] Chạy `prisma db push` đồng bộ database

## Giai đoạn 2: Backend API & Services
- [x] Tạo `customFieldService.ts` (CRUD Custom Field Definitions)
- [x] Tạo `customFieldController.ts` (REST endpoints)
- [x] Tạo `taskCustomFieldService.ts` (Lưu/đọc giá trị)
- [x] Tạo `taskCustomFieldController.ts` (Task field values endpoints)
- [x] Đăng ký routes
- [x] Kiểm tra TypeScript (`tsc --noEmit`)

## Giai đoạn 3: Frontend Custom Field Builder
- [x] Tạo `CustomFieldList.tsx` (Danh sách fields theo process/step)
- [x] Tạo `CustomFieldEditorModal.tsx` (Tạo/sửa field)
- [x] Tích hợp vào `ProcessModal.tsx`
- [x] Tạo `workflowApi.ts` endpoints cho custom fields

## Giai đoạn 4: Frontend Dynamic Form Renderer
- [x] Tạo `DynamicFieldRenderer.tsx` (Render 1 field theo type)
- [x] Tạo `DynamicFormRenderer.tsx` (Render form nhiều fields)
- [x] Tích hợp vào `TaskDetail.tsx`
- [x] Kiểm tra TypeScript client

## Giai đoạn 5: Seed Data & Testing
- [x] Bổ sung seed data custom fields
- [x] Kiểm thử tổng thể
