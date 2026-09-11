# 🏗️ Performance Optimization Plan — 100 Concurrent Users

> **System**: AI Test Case Generator & Management System  
> **Date**: 2026-09-10  
> **Target**: Support 100 concurrent users without crashes, timeouts, or data loss  
> **Status**: Analysis Complete — Ready for Implementation

---

## 📋 ARCHITECTURE SUMMARY

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 + Vite + TypeScript + Tailwind CSS + Socket.IO Client |
| **Backend** | Express.js + TypeScript + Prisma ORM |
| **Database** | PostgreSQL + Prisma Migrations |
| **Realtime** | Socket.IO v4 (in-memory, no Redis adapter) |
| **AI Services** | Google Gemini + OpenAI + Groq + OpenRouter + DeepSeek |
| **Process Manager** | PM2 (referenced, no `ecosystem.config.js`) |
| **Reverse Proxy** | ❌ None configured |
| **Cache** | ❌ None (local memory only) |
| **Queue** | ❌ None |
| **CORS** | `origin: '*'` (wildcard) |

---

## 🔴 CRITICAL ISSUES (Must Fix for 100 Concurrent Users)

### C1: Single PrismaClient Instance — No Connection Pool Configuration
- **File**: `server/src/config/database.ts`
- **Problem**: Single global `PrismaClient` with default pool of **5 connections**
- **Impact**: 100 concurrent users = connection pool exhausted instantly → 502/503 errors
- **Fix**: Configure `datasources.db.prisma_config` with `max: 20, min: 5, idle: 10000`
- **Risk**: Low

### C2: No Process Management / Single Point of Failure
- **Problem**: No `ecosystem.config.js` for PM2, running single Node.js process
- **Impact**: Server crash = total outage. No clustering, no graceful restart.
- **Fix**: Create `server/ecosystem.config.js` with cluster mode (2-4 instances)
- **Risk**: Medium (need to verify Socket.IO compatibility)

### C3: AI Generation Blocks HTTP Request
- **File**: `server/src/controllers/testCaseController.ts:167`
- **Problem**: `AIService.generateTestCases()` runs synchronously in HTTP request (30-60s)
- **Impact**: 100 users clicking Generate = 100 concurrent external API calls = instant server collapse
- **Fix**: Move to queue system (BullMQ) with worker process
- **Risk**: High (architecture change)

### C4: No Rate Limiting Anywhere
- **Problem**: Zero rate limiting on login, API, AI endpoints
- **Impact**: 100 users can hammer endpoints simultaneously → DoS
- **Fix**: Add `express-rate-limit` middleware to all routes
- **Risk**: Low

### C5: No Nginx/Reverse Proxy
- **Problem**: Express handles all traffic directly
- **Impact**: No connection keepalive, no gzip, no timeout management, no load balancing
- **Fix**: Add Nginx reverse proxy with proper configuration
- **Risk**: Medium

### C6: Socket.IO In-Memory Only — No Redis Adapter
- **File**: `server/src/socket.ts`
- **Problem**: Single instance, no Redis adapter, no connection limits
- **Impact**: If scaled to multiple instances, Socket.IO rooms won't sync
- **Fix**: Add `@socket.io/redis-adapter`
- **Risk**: Medium

---

## 🟠 HIGH ISSUES (Significant Performance Degradation)

### H1: N+1 Queries & Unbounded Data Loading
- **File**: `server/src/controllers/testCaseController.ts`
- **Problem**: `getSuites()`, `getSuiteById()` load ALL suites → ALL test cases → ALL executions → ALL watchers → ALL images with no pagination
- **Impact**: Single API call returns MBs of JSON, blocks event loop, exhausts DB connections
- **Fix**: Add pagination (`page`, `limit`), selective `select`, remove nested `images` loading
- **Risk**: Low

### H2: Permission Service Database Query Per Request
- **File**: `server/src/services/permissionService.ts`
- **Problem**: Every RBAC middleware call queries `rolePermission` + `userPermission` from DB
- **Impact**: 100 concurrent requests = 100 DB queries for permissions
- **Fix**: Add Redis cache or extended in-memory TTL cache with invalidation
- **Risk**: Low

### H3: Login Performance — 2 Writes Per Login
- **File**: `server/src/controllers/authController.ts:196-215`
- **Problem**: Each login does `bcrypt.compare` + **2 Prisma writes** (failedLoginAttempts + lastLogin)
- **Impact**: Under 100 concurrent logins, connection pool exhausted
- **Fix**: Optimize to single write, use connection pool
- **Risk**: Low

### H4: `getUserExecutionStats()` — O(n) User Queries
- **File**: `server/src/controllers/testCaseController.ts:996-1056`
- **Problem**: Queries ALL users, then for EACH user queries ALL their executions via `Promise.all`
- **Impact**: Heavy sequential DB queries on a single endpoint
- **Fix**: Single aggregate SQL query with `GROUP BY`
- **Risk**: Medium

### H5: Export Controller — Full Table Load in Memory
- **File**: `server/src/controllers/exportController.ts`
- **Problem**: Loads ALL test cases with ALL executions into memory, generates Excel buffer
- **Impact**: OOM with large datasets, blocks event loop
- **Fix**: Stream-based export or background job
- **Risk**: Medium

### H6: Cron Job Heavy Transaction Per Task
- **File**: `server/src/services/cronService.ts`
- **Problem**: `checkOverdueTasks()` loads ALL overdue tasks with full relations, sequential `$transaction` per task
- **Impact**: Cron job monopolizes DB connections
- **Fix**: Batch processing with pagination
- **Risk**: Medium

### H7: Express Configuration Issues
- **File**: `server/src/index.ts`
- **Problems**:
  - `express.json({ limit: '50mb' })` — DoS vector
  - No request timeout
  - No compression middleware
  - No `trust proxy` setting
  - CORS `origin: '*'` wildcard
- **Fix**: Set body limit to 10mb, add `compression`, add `express-timeout`, restrict CORS
- **Risk**: Low

### H8: No Graceful Shutdown
- **File**: `server/src/index.ts`
- **Problem**: `server.listen()` has no handling for SIGTERM/SIGINT
- **Impact**: PM2 restart = dropped connections, incomplete transactions
- **Fix**: Add `process.on('SIGTERM', ...)` with `server.close()` + `prisma.$disconnect()`
- **Risk**: Low

---

## 🟡 MEDIUM ISSUES (Should Optimize)

### M1: Missing Database Indexes
- **File**: `server/prisma/schema.prisma`
- **Missing indexes**:
  - `TestSuite.createdAt` (used in `orderBy: { createdAt: 'desc' }`)
  - `TestCase.module`, `TestCase.platform`, `TestCase.reviewStatus`
  - `TestExecution.testCaseId`, `TestExecution.executedById`, `TestExecution.status`
  - `Task.status`, `Task.deadline`
  - `Proposal.status`, `Proposal.proposalTypeId`
  - `Notification.recipientId`, `Notification.isRead`
  - `TestExecutionImage.executionId`
- **Fix**: Add `@@index` to schema, generate migration
- **Risk**: Medium

### M2: No Query Optimization
- `getMe()` fetches manager relation unnecessarily
- `getSuites()`, `getSuiteById()` fetch `images` via watchers — huge overhead
- `getTestCaseById()` loads all executions with nested watchers → images
- **Fix**: Add `select` to limit fields where possible
- **Risk**: Low

### M3: Frontend API Calls — No Pagination/Debounce
- `usePermissions` fetches ALL permissions on every mount, no caching
- No debounce on search inputs
- No virtualized lists for large datasets
- `socket.ts` reconnects aggressively (`reconnectionAttempts: 20`)
- **Fix**: Add debounce, pagination, virtualized lists, reduce reconnection attempts
- **Risk**: Low

### M4: JWT Secret & API Keys in .env
- **File**: `server/.env`
- `JWT_SECRET=super_secret_jwt_key_testcase_ai_2026` — weak, hardcoded
- Multiple API keys exposed
- **Fix**: Move to environment variables, use secrets manager
- **Risk**: Low

### M5: File Upload — Buffered in Memory
- **File**: `server/src/controllers/uploadController.ts`
- `provider.upload(file.buffer, ...)` — entire file in memory
- No streaming upload
- **Fix**: Stream-based upload, file system or direct to storage
- **Risk**: High

### M6: No Structured Logging
- `console.error()`, `console.log()` only
- No request logging middleware
- No structured log format
- **Fix**: Add `pino` or `winston` with request logging
- **Risk**: Low

---

## 🟢 LOW PRIORITY (Nice to Have)

### L1: Missing `ecosystem.config.js` for PM2
### L2: No health check for database connectivity
### L3: No CDN or static asset caching
### L4: No WebSocket rooms broadcast optimization
### L5: Frontend code splitting by route
### L6: Image lazy loading on frontend
### L7: `node-cron` single instance — not distributed
### L8: `@marsaud/smb2`, `basic-ftp` dependencies — unused in core flow

---

## 📝 RECOMMENDED IMPROVEMENT PLAN

### Phase 1 — CRITICAL (Immediate, Pre-Deployment)

| # | Change | Files | Risk |
|---|--------|-------|------|
| 1 | Configure Prisma connection pool (`max: 20`, `min: 5`, `idle: 10000`) | `server/src/config/database.ts` | Low |
| 2 | Create PM2 `ecosystem.config.js` with cluster mode (2 instances) | New file | Medium |
| 3 | Add graceful shutdown (SIGTERM/SIGINT) | `server/src/index.ts` | Low |
| 4 | Move AI generation to background queue (BullMQ) | `server/src/controllers/testCaseController.ts`, new `server/src/queue/` | High |
| 5 | Add `express-rate-limit` to all routes | `server/src/middleware/` | Low |
| 6 | Add `compression` middleware + set body limit to 10mb | `server/src/index.ts` | Low |
| 7 | Add request timeout (`express-timeout`) | `server/src/index.ts` | Low |

### Phase 2 — HIGH (Post-Phase 1)

| # | Change | Files | Risk |
|---|--------|-------|------|
| 8 | Add pagination to all list endpoints (`getSuites`, `getTasks`, `getProposals`, etc.) | All `*Controller.ts` | Medium |
| 9 | Add database indexes for frequently queried fields | `server/prisma/schema.prisma` + migration | Medium |
| 10 | Optimize `getSuites()`, `getSuiteById()` — remove nested `images` loading, add `select` | `server/src/controllers/testCaseController.ts` | Low |
| 11 | Optimize `getUserExecutionStats()` to single aggregate query | `server/src/controllers/testCaseController.ts` | Medium |
| 12 | Optimize `cronService.ts` batch processing | `server/src/services/cronService.ts` | Medium |
| 13 | Add Redis for Socket.IO adapter + permission caching | `server/src/socket.ts`, `server/src/services/permissionService.ts` | Medium |
| 14 | Add Nginx reverse proxy config | New file | Medium |
| 15 | Optimize `exportController.ts` — stream-based Excel | `server/src/controllers/exportController.ts` | Medium |

### Phase 3 — MEDIUM (Post-Phase 2)

| # | Change | Files | Risk |
|---|--------|-------|------|
| 16 | Add structured logging (`pino`/`winston`) | New file | Low |
| 17 | Add `.env` secrets management, rotate API keys | `server/.env` | Low |
| 18 | Frontend: Add debounce, pagination, virtualized lists | `client/src/` | Medium |
| 19 | Frontend: Code splitting by route | `client/src/App.tsx` | Low |
| 20 | Add Socket.IO `allowEIO3: false`, connection limits | `server/src/socket.ts` | Low |

### Phase 4 — LOW (Post-Phase 3)

| # | Change | Files | Risk |
|---|--------|-------|------|
| 21 | Add file upload streaming | `server/src/controllers/uploadController.ts` | High |
| 22 | Add health check DB connectivity | `server/src/index.ts` | Low |
| 23 | Frontend: lazy loading, image optimization | `client/src/` | Low |
| 24 | Add PM2 auto-restart + memory monitoring | `server/ecosystem.config.js` | Low |

---

## 📊 CONNECTION POOL CALCULATION (for 100 Concurrent Users)

```
Assumptions:
- PM2 cluster mode: 2 instances
- Prisma pool per instance: max 20
- PostgreSQL max_connections: 100 (default)

Total connections = 2 instances × 20 pool = 40 connections
This leaves 60 connections for admin/reads.

For 100 concurrent users:
- Each user makes ~2-3 concurrent requests
- Prisma handles connection queuing automatically
- Total peak connections ≈ 40 (within safe limits)
```

---

## 🔧 RECOMMENDED NEW DEPENDENCIES

```bash
# Backend package.json additions
npm install express-rate-limit compression express-timeout BullMQ ioredis pino pino-http
npm install -D @types/compression @types/express-rate-limit @types/express-timeout
```

---

## 📁 KEY FILE PATHS

### Backend Core
- `server/src/config/database.ts` — Prisma client configuration
- `server/src/index.ts` — Server entry point, middleware, routes
- `server/src/socket.ts` — Socket.IO configuration
- `server/src/middleware/auth.ts` — JWT authentication middleware
- `server/src/middleware/rbac.ts` — Role-based access control

### Backend Controllers
- `server/src/controllers/testCaseController.ts` — Test case CRUD + AI generation
- `server/src/controllers/authController.ts` — Authentication
- `server/src/controllers/executionController.ts` — Test execution
- `server/src/controllers/taskController.ts` — Task management
- `server/src/controllers/proposalController.ts` — Proposal workflow
- `server/src/controllers/exportController.ts` — Excel export
- `server/src/controllers/uploadController.ts` — File upload
- `server/src/controllers/notificationController.ts` — Notifications

### Backend Services
- `server/src/services/permissionService.ts` — Permission caching
- `server/src/services/cronService.ts` — Scheduled jobs
- `server/src/services/ai/aiService.ts` — AI service calls

### Database
- `server/prisma/schema.prisma` — Prisma schema
- `server/prisma/migrations/` — Migration files

### Frontend
- `client/src/App.tsx` — Main application component
- `client/src/context/AuthContext.tsx` — Auth state
- `client/src/services/api.ts` — Axios API client
- `client/src/services/socket.ts` — Socket.IO client
- `client/src/hooks/usePermissions.ts` — Permission hooks

### Deployment
- `server/package.json` — Backend dependencies
- `deploy.sh`, `deploy3.sh`, `deploy_bak.sh` — Deployment scripts
- `start-app.ps1`, `start-app.bat` — Startup scripts
- `server/.env` — Environment variables
- `server/.env.example` — Environment template

---

## ⚠️ CONSTRAINTS

- No migration that drops tables or resets database
- No change to business logic unless absolutely necessary
- No breaking changes to existing API contracts
- Must support existing Prisma migration history
- Must not log passwords, JWTs, or API keys

---

## ✅ SUCCESS CRITERIA

After implementation, the system should:

1. ✅ Support 100 concurrent users without crashes
2. ✅ No 502/503/504/ECONNRESET errors
3. ✅ No database connection exhausted errors
4. ✅ No memory leaks or CPU overload
5. ✅ API response times under 500ms under load
6. ✅ No data loss or corruption under concurrent operations
7. ✅ All existing features continue to work
8. ✅ Health check endpoint returns DB status
9. ✅ Graceful shutdown on restart
10. ✅ Socket.IO connections stable under load
