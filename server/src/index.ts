import express from 'express';
import http from 'http';
import cors from 'cors';
import compression from 'compression';
const timeout = require('express-timeout') as any;
import 'dotenv/config';
import { initSocket } from './socket';
import path from 'path';
import authRoutes from './routes/authRoutes';
import usersRoutes from './routes/usersRoutes';
import aiRoutes from './routes/aiRoutes';
import testCaseRoutes from './routes/testCaseRoutes';
import executionRoutes from './routes/executionRoutes';
import exportRoutes from './routes/exportRoutes';
import setupRoutes from './routes/setupRoutes';
import settingRoutes from './routes/settingRoutes';
import permissionRoutes from './routes/permissionRoutes';
import statusHandlerRoutes from './routes/statusHandlerRoutes';
import uploadRoutes from './routes/uploadRoutes';
import processRoutes from './routes/processRoutes';
import taskRoutes from './routes/taskRoutes';
import customFieldRoutes from './routes/customFieldRoutes';
import standaloneTodoRoutes from './routes/standaloneTodoRoutes';
import standaloneCommentRoutes from './routes/standaloneCommentRoutes';
import workflowUploadRoutes from './routes/workflowUploadRoutes';
import workflowReportRoutes from './routes/workflowReportRoutes';
import proposalTypeRoutes from './routes/proposalTypeRoutes';
import formTemplateRoutes from './routes/formTemplateRoutes';
import formFieldRoutes from './routes/formFieldRoutes';
import proposalRoutes from './routes/proposalRoutes';
import myProposalRoutes from './routes/myProposalRoutes';
import proposalReportRoutes from './routes/proposalReportRoutes';
import proposalNotificationRoutes from './routes/proposalNotificationRoutes';
import notificationRoutes from './routes/notificationRoutes';
import { checkDatabaseConnection, checkDatabasePoolHealth, getPrisma } from './config/database';
import { initRedis } from './config/redis';
import { getIO } from './socket';
import { dbCheckMiddleware } from './controllers/setupController';
import { apiLimiter, authLimiter, aiLimiter, exportLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler, requestIdMiddleware, responseTimeMiddleware } from './middleware/errorHandler';

import { ensureDefaultAdmin } from './services/adminSeed';
import { CronService } from './services/cronService';

//dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// Tin IP thật từ Nginx reverse proxy (X-Forwarded-For) để rate-limit/socket log đúng client.
// Chỉ trust 1 hop (Nginx) — không dùng `true` để tránh IP giả mạo qua nhiều proxy.
app.set('trust proxy', 1);

// Khởi tạo Socket.IO Server
initSocket(server);

// Middlewares
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
// Body limits: reduce from 50mb to 10mb to prevent DoS
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Upload routes use smaller body limit
app.use('/api/upload', express.json({ limit: '2mb' }));
app.use('/api/uploads', express.json({ limit: '2mb' }));
app.use('/upload', express.json({ limit: '2mb' }));

// Compression middleware
app.use(compression());

// Request timeout middleware (30s global)
app.use(timeout('30s'));

// Timeout error handler
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && (err.code === 'ECONNRESET' || err.message === 'request timeout' || err.statusCode === 504)) {
    return res.status(504).json({ message: 'Request timed out. Please try again.' });
  }
  next(err);
});

// Rate Limiters
app.use('/api/auth', authLimiter);
app.use('/api/ai', aiLimiter);
app.use('/api/export', exportLimiter);
app.use('/api', apiLimiter);

// Health check — always available, checks DB connectivity
app.get('/api/health', async (_req, res) => {
  const health = {
    status: 'ok' as const,
    message: 'AI Test Case Generator & Workflow API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: { database: false },
  };

  try {
    const poolHealth = await checkDatabasePoolHealth();
    health.checks.database = poolHealth.connected;
  } catch {
    health.checks.database = false;
  }

  if (!health.checks.database) {
    res.status(503).json(health);
    return;
  }

  res.json(health);
});

// Deep health check — detailed diagnostics
app.get('/api/health/deep', async (_req, res) => {
  const start = Date.now();
  try {
    const poolHealth = await checkDatabasePoolHealth();
    const dbResult = await getPrisma().$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      database: 'connected',
      pool: poolHealth,
      responseTime: `${Date.now() - start}ms`,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      error: error.message,
    });
  }
});

// Request ID and response time middleware
app.use(requestIdMiddleware);
app.use(responseTimeMiddleware);

// Setup Routes (always available, even without DB)
app.use('/api/setup', setupRoutes);

// Database Check Middleware - chặn API nếu DB chưa sẵn sàng
app.use(dbCheckMiddleware);

// API Routes (requires DB connection)
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/testcases', testCaseRoutes);
app.use('/api/executions', executionRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/execution-status-handlers', statusHandlerRoutes);
app.use('/api/uploads', uploadRoutes);

// Workflow Management Routes
app.use('/api/processes', processRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/custom-fields', customFieldRoutes);
app.use('/api/todos', standaloneTodoRoutes);
app.use('/api/comments', standaloneCommentRoutes);
app.use('/api/workflow/upload', workflowUploadRoutes);
app.use('/api/upload', workflowUploadRoutes);
app.use('/api/reports', workflowReportRoutes);
app.use('/api/workflow/reports', workflowReportRoutes);

// Proposal / Request Management Routes
app.use('/api/proposal-types', proposalTypeRoutes);
app.use('/api/form-templates', formTemplateRoutes);
app.use('/api/form-fields', formFieldRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/my', myProposalRoutes);
app.use('/api/reports', proposalReportRoutes);
app.use('/api/proposal-reports', proposalReportRoutes);
app.use('/api/proposal-notifications', proposalNotificationRoutes);

// Unified Realtime Notifications Route
app.use('/api/notifications', notificationRoutes);

// Static uploads serving
app.use('/uploads', express.static(path.resolve('./uploads')));


// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Start server and check DB
let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n🔄 ${signal} received. Starting graceful shutdown...`);

  // 1. Stop accepting new HTTP connections
  server.close(async (err) => {
    if (err) console.error('Error closing HTTP server:', err);
    console.log('✅ HTTP server closed.');

    // 2. Stop Socket.IO
    try {
      const io = getIO();
      if (io) {
        io.close();
        console.log('✅ Socket.IO closed.');
      }
    } catch (err) {
      console.error('Error closing Socket.IO:', err);
    }

    // 3. Disconnect Prisma
    try {
      await getPrisma().$disconnect();
      console.log('✅ Prisma disconnected.');
    } catch (err) {
      console.error('Error disconnecting Prisma:', err);
    }

    // 4. Stop Cron Jobs
    try {
      CronService.stop();
    } catch (err) {
      console.error('Error stopping Cron:', err);
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

server.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);

  // Kết nối Redis (không chặn boot — fallback memory nếu Redis down)
  initRedis().catch((err) => console.warn(`⚠️ [Redis] init failed: ${err?.message || err}`));

  // Check database connection on startup
  const dbCheck = await checkDatabaseConnection();
  if (dbCheck.ready) {
    console.log(`✅ Database connected successfully.`);
    // Tự động kiểm tra và tạo tài khoản Admin mặc định
    await ensureDefaultAdmin();
    // Khởi chạy Cron Jobs kiểm tra nhiệm vụ quá hạn
    CronService.init();
  } else {
    console.log(`⚠️  Database not connected: ${dbCheck.message}`);
    console.log(`📋 Setup available at: http://localhost:${PORT}/api/setup/status`);
    console.log(`   Frontend will redirect to Database Setup page.`);
  }
});
