# ⚡ Performance — Phase 1: Critical Backend Hardening

> **System**: AI Test Case Generator & Management System  
> **Date**: 2026-09-10  
> **Target**: 100 concurrent users — Foundation stability  
> **Status**: Plan ready for implementation  
> **Mode**: Build (implementable)

---

## 1. Prisma Connection Pool

### Problem
- Single global `PrismaClient` with **default pool of 5 connections**
- 100 concurrent users → connection pool exhausted → 502/503/ECONNRESET
- **File**: `server/src/config/database.ts`

### Current Code
```typescript
const prismaInstance = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});
```

### Implementation
```typescript
// server/src/config/database.ts — Updated

const prismaInstance = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn', 'info'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Connection pool error handling
prismaInstance.$on('query', (e) => {
  if (e.duration > 3000) {
    console.error(`Slow query: ${e.query} took ${e.duration}ms`);
  }
});
```

**Database connection string update** — `server/.env`:
```env
# Add connection pool params to DATABASE_URL
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/testcase_db?schema=public&connection_limit=20&statement_timeout=30000&idle_in_transaction_session_timeout=60000"
```

**PostgreSQL configuration** — `postgresql.conf`:
```ini
max_connections = 100        # default 20, increase for 100 users
shared_buffers = 256MB       # 25% of RAM
work_mem = 4MB               # for sort/hash operations
effective_cache_size = 768MB # 75% of RAM
```

**Connection Pool Calculation**:
```
PM2 cluster mode: 2 instances
Prisma pool per instance: max 20, min 5
Total connections = 2 × 20 = 40
PostgreSQL max_connections = 100
Safety margin = 60 connections remaining for admin/reads
```

**Risk**: Low — Configuration change only, no schema change

---

## 2. Graceful Shutdown

### Problem
- `server.listen()` has **no SIGTERM/SIGINT handling**
- PM2 restart = dropped connections, incomplete transactions
- Socket.IO clients disconnected abruptly
- Prisma connections not cleaned up

### Current Code (`server/src/index.ts`)
```typescript
app.listen(PORT, async () => { ... });
```

### Implementation
```typescript
// server/src/index.ts — Replace server.listen() with graceful shutdown

import http from 'http';

const PORT = process.env.PORT || 3001;
const server = http.createServer(app);

// WebSocket server setup
const io = socketServer(server);

let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`🔄 ${signal} received. Starting graceful shutdown...`);
  
  // 1. Stop accepting new HTTP connections
  server.close(async (err) => {
    if (err) console.error('Error closing HTTP server:', err);
    console.log('✅ HTTP server closed.');
    
    // 2. Stop Socket.IO
    try {
      io.close();
      console.log('✅ Socket.IO closed.');
    } catch (err) {
      console.error('Error closing Socket.IO:', err);
    }
    
    // 3. Disconnect Prisma
    try {
      await prismaInstance.$disconnect();
      console.log('✅ Prisma disconnected.');
    } catch (err) {
      console.error('Error disconnecting Prisma:', err);
    }
    
    // 4. Stop cron jobs
    try {
      await CronService.stop();
      console.log('✅ Cron service stopped.');
    } catch (err) {
      console.error('Error stopping cron:', err);
    }
    
    process.exit(0);
  });
  
  // Force exit after 10s
  setTimeout(() => {
    console.error('⚠️ Forced shutdown after 10s timeout.');
    process.exit(1);
  }, 10000);
};

// Register signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Process-level error handlers
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', {
    timestamp: new Date().toISOString(),
    message: err.message,
    stack: err.stack,
  });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason: any) => {
  console.error('💥 Unhandled Rejection:', {
    timestamp: new Date().toISOString(),
    reason: reason?.message || reason,
  });
  gracefulShutdown('unhandledRejection');
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
```

**Risk**: Low — Standard Express pattern, well-tested

---

## 3. Rate Limiting

### Problem
- **Zero rate limiting** on login, API, AI endpoints
- 100 users can hammer endpoints simultaneously → DoS
- Login endpoint calls `bcrypt.compare` + 2 Prisma writes per login
- No protection against brute force

### New File: `server/src/middleware/rateLimiter.ts`
```typescript
import rateLimit from 'express-rate-limit';

// General API limiter — 100 requests per 15 minutes per IP
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/api/health') || req.path.startsWith('/api/setup'),
});

// Auth limiter — 10 login attempts per 15 minutes per IP
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// AI generation limiter — 20 generations per hour per IP
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { message: 'AI generation limit reached. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Export limiter — 10 exports per hour per IP
export const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { message: 'Export limit reached. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
```

### Apply in `server/src/index.ts`
```typescript
import { apiLimiter, authLimiter, aiLimiter, exportLimiter } from './middleware/rateLimiter';

// Apply rate limiters before routes
app.use('/api/auth', authLimiter);
app.use('/api/ai', aiLimiter);
app.use('/api/export', exportLimiter);
app.use('/api', apiLimiter); // General API limiter
```

### Install dependencies
```bash
npm install express-rate-limit
npm install -D @types/express-rate-limit
```

**Rate Limit Summary**:
| Route | Limit | Window | Purpose |
|-------|-------|--------|---------|
| `/api/auth/*` | 10 requests | 15 min | Prevent brute force |
| `/api/ai/*` | 20 requests | 1 hour | Prevent AI API abuse |
| `/api/export/*` | 10 requests | 1 hour | Prevent resource exhaustion |
| `/api/*` (general) | 100 requests | 15 min | General protection |
| `/api/health`, `/api/setup/*` | Unlimited | — | Whitelisted |

**Risk**: Low — Standard Express middleware, testable

---

## 4. Compression

### Problem
- All responses sent uncompressed
- JSON payloads (test suites, proposals, notifications) are large
- Wastes bandwidth, increases response time
- 100 users receiving large JSON responses = high network I/O

### Implementation in `server/src/index.ts`
```typescript
import compression from 'compression';

// Add BEFORE routes
app.use(compression({
  level: 6, // Balanced compression (0-9)
  threshold: 1024, // Compress responses > 1KB
  filter: (req, res) => {
    // Don't compress WebSocket upgrade requests
    if (req.headers['upgrade'] === 'websocket') return false;
    return compression.filter(req, res);
  },
}));

// Set Accept-Encoding header support
app.use((req, res, next) => {
  res.setHeader('Accept-Encoding', 'gzip, deflate');
  next();
});
```

### Install dependencies
```bash
npm install compression
npm install -D @types/compression
```

**Expected improvement**:
- JSON payloads reduced by **60-80%**
- Response times significantly faster for large endpoints (`getSuites`, `getProposals`)
- Reduced network bandwidth consumption

**Risk**: Low — Standard Express middleware, zero business logic impact

---

## 5. Request Timeout

### Problem
- **No request timeout configured**
- AI requests can take 60+ seconds with no upper bound
- Database queries with no timeout can hang forever
- 100 concurrent hanging connections exhaust all resources

### Implementation in `server/src/index.ts`
```typescript
import timeout from 'express-timeout';

// Set global timeout to 30 seconds
app.use(timeout('30s'));

// Custom timeout error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err.code === 'ECONNRESET' || err.message === 'request timeout' || err.statusCode === 504) {
    return res.status(504).json({
      message: 'Request timed out. Please try again.',
    });
  }
  next(err);
});
```

### Also add timeout to external API calls (`server/src/services/ai/aiService.ts`)
```typescript
// In all AI service methods, add AbortController timeout:
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s

try {
  const response = await fetch(endpoint, {
    headers: { 'Content-Type': 'application/json' },
    signal: controller.signal,
  });
  clearTimeout(timeoutId);
  return response;
} catch (err) {
  clearTimeout(timeoutId);
  throw err;
}
```

### Install dependencies
```bash
npm install express-timeout
npm install -D @types/express-timeout
```

**Timeout Summary**:
| Operation | Timeout | Action |
|-----------|---------|--------|
| Express HTTP requests | 30s | Global middleware |
| External API calls (AI) | 15s | AbortController |
| Database queries | 10s | Prisma default (add explicit) |
| AI generation | 60s | Move to queue (Phase 2) |

**Risk**: Low — Standard middleware, may expose existing timeout issues

---

## 6. Body Limit

### Problem
- `express.json({ limit: '50mb' })` — DoS vector
- A single malicious request can exhaust server memory
- No limit on number of files in multipart uploads

### Implementation in `server/src/index.ts`
```typescript
// Replace existing body parsers
app.use(express.json({ limit: '10mb' })); // Reduced from 50mb
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Reduced from 50mb

// For upload endpoints, add separate body parser with smaller limit
// Already enforced in uploadController.ts via multer fileSize, but add explicit limit:
app.use('/api/upload', express.json({ limit: '2mb' }));
```

### Current code to replace (`server/src/index.ts`):
```typescript
// REMOVE:
// app.use(express.json({ limit: '50mb' }));
// app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// REPLACE WITH:
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
```

**Body Limit Summary**:
| Content Type | Max Size |
|-------------|----------|
| JSON payloads | 10 MB |
| URL-encoded | 10 MB |
| Upload metadata | 2 MB |
| File uploads | Enforced by multer (already in uploadController.ts) |

**Risk**: Low — Configuration change, ensure no legitimate payloads exceed 10MB

---

## 7. Health Check

### Problem
- `/api/health` returns `status: 'ok'` even if DB is down
- Load balancer / PM2 can't determine true health
- No way to know if system is actually ready to serve

### Implementation in `server/src/index.ts`
```typescript
app.get('/api/health', async (_req, res) => {
  const health = {
    status: 'ok' as const,
    message: 'AI Test Case Generator API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: false,
    },
  };
  
  try {
    const dbResult = await prismaInstance.$queryRaw`SELECT 1`;
    health.checks.database = true;
  } catch (err) {
    health.status = 'degraded';
    health.checks.database = false;
  }
  
  if (!health.checks.database) {
    res.status(503).json(health);
    return;
  }
  
  res.json(health);
});

// Detailed health check
app.get('/api/health/deep', async (_req, res) => {
  const start = Date.now();
  try {
    await prismaInstance.$connect();
    await prismaInstance.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      database: 'connected',
      responseTime: `${Date.now() - start}ms`,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      error: err.message,
    });
  }
});
```

**Note**: `/api/health` and `/api/setup/*` must be **whitelisted** from `dbCheckMiddleware`.

**Risk**: Low — Read-only `SELECT 1` query, minimal overhead

---

## 8. Error Handling

### Problem
- Generic error handler exposes `err.message` (may contain sensitive info)
- No `uncaughtException`/`unhandledRejection` handlers
- No request ID tracking
- No execution time logging
- Console errors have no timestamp, request ID, or user context

### New File: `server/src/middleware/errorHandler.ts`
```typescript
import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction) {
  req.id = generateRequestId();
  req.startTime = Date.now();
  next();
}

export function responseTimeMiddleware(req: Request, res: Response, next: NextFunction) {
  res.on('finish', () => {
    const duration = Date.now() - (req.startTime || Date.now());
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
}

export function errorHandler(err: AppError, req: Request, res: Response, next: NextFunction) {
  const statusCode = err.statusCode || 500;
  const isDev = process.env.NODE_ENV === 'development';
  const message = err.isOperational ? err.message : 'Internal server error';
  
  // Sanitize error message — never expose raw error details in production
  console.error({
    timestamp: new Date().toISOString(),
    requestId: req.id,
    method: req.method,
    path: req.path,
    userId: (req as any).user?.id || 'anonymous',
    statusCode,
    error: err.message,
    stack: isDev ? err.stack : undefined,
  });
  
  res.status(statusCode).json({
    message,
    ...(isDev && { stack: err.stack, requestId: req.id }),
  });
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  const err = new Error(`Route not found: ${req.method} ${req.path}`) as AppError;
  err.statusCode = 404;
  err.isOperational = true;
  next(err);
}
```

### Update `server/src/index.ts`
```typescript
import { errorHandler, notFoundHandler, requestIdMiddleware, responseTimeMiddleware } from './middleware/errorHandler';

// Add middleware before routes
app.use(requestIdMiddleware);
app.use(responseTimeMiddleware);

// ... existing routes ...

// 404 handler
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);
```

### Install dependencies
No new dependencies needed — uses existing Express types.

**Error Handling Summary**:
| Feature | Implementation |
|---------|---------------|
| Request ID | `generateRequestId()` per request |
| Execution time | `responseTimeMiddleware` logs on finish |
| Error classification | `statusCode`, `isOperational` flags |
| Sensitive data protection | Never log passwords, tokens, secrets |
| 404 handling | `notFoundHandler` middleware |
| Process crashes | `uncaughtException`, `unhandledRejection` |
| Stack traces | Only in development mode |

**Risk**: Medium — May expose previously hidden bugs, test all endpoints

---

## 📦 DEPENDENCIES TO INSTALL

```bash
cd server
npm install express-rate-limit compression express-timeout
npm install -D @types/express-rate-limit @types/compression @types/express-timeout
```

---

## 📝 IMPLEMENTATION ORDER

| Step | Item | File | Risk |
|------|------|------|------|
| 1 | Prisma Connection Pool | `server/src/config/database.ts`, `server/.env` | Low |
| 2 | Graceful Shutdown | `server/src/index.ts` | Low |
| 3 | Rate Limiting | `server/src/middleware/rateLimiter.ts`, `server/src/index.ts` | Low |
| 4 | Compression | `server/src/index.ts` | Low |
| 5 | Request Timeout | `server/src/index.ts` | Low |
| 6 | Body Limit | `server/src/index.ts` | Low |
| 7 | Health Check | `server/src/index.ts` | Low |
| 8 | Error Handling | `server/src/middleware/errorHandler.ts`, `server/src/index.ts` | Medium |

**Suggested execution**: Steps 1-2 first (infrastructure), then 3-6 (middleware), then 7-8 (monitoring).

---

## ✅ SUCCESS CRITERIA (Phase 1)

After Phase 1 implementation:

1. ✅ Prisma connection pool configured (20 max, 5 min)
2. ✅ Server gracefully shuts down on SIGTERM/SIGINT
3. ✅ Rate limiting active on all API routes
4. ✅ Responses compressed (gzip)
5. ✅ Request timeout enforced (30s)
6. ✅ Body limit reduced to 10mb
7. ✅ Health check returns DB status
8. ✅ Structured error handling with request IDs
9. ✅ No unhandled exceptions crash the server
10. ✅ 100 concurrent users can connect without connection exhaustion
