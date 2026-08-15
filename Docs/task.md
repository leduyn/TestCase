# Task List - AI Test Case Generator & Management System

## Phase 0: Database Setup Module ⭐
- [ ] Backend: Cài thêm dependency `pg` (PostgreSQL native driver) cho setup service
- [ ] Backend: Tạo `server/src/services/databaseSetup.ts`
- [ ] Backend: Sửa `server/src/config/database.ts` (thêm checkConnection, reinitialize)
- [ ] Backend: Tạo `server/src/controllers/setupController.ts`
- [ ] Backend: Tạo `server/src/routes/setupRoutes.ts`
- [ ] Backend: Sửa `server/src/index.ts` (thêm dbCheckMiddleware, mount setupRoutes)
- [ ] Frontend: Tạo `client/src/pages/Setup/DatabaseSetupPage.tsx`
- [ ] Frontend: Sửa `client/src/App.tsx` (auto-redirect logic)
- [ ] Kiểm tra end-to-end Database Setup flow

## Phase 1-6: (Sau khi Phase 0 hoàn tất)
- [ ] Phase 1: Setup & Database Migration
- [ ] Phase 2: Auth & User Management
- [ ] Phase 3: Multi-Provider AI Engine
- [ ] Phase 4: Test Case Execution & Detail View
- [ ] Phase 5: Excel Export & Dashboard Stats
- [ ] Phase 6: Verification & Final Polish
