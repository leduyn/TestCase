import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
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
import uploadRoutes from './routes/uploadRoutes';
import { checkDatabaseConnection } from './config/database';
import { dbCheckMiddleware } from './controllers/setupController';

import { ensureDefaultAdmin } from './services/adminSeed';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check (always available)
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'AI Test Case Generator API is running',
    timestamp: new Date().toISOString(),
  });
});

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
app.use('/api/uploads', uploadRoutes);

// Static uploads serving
app.use('/uploads', express.static(path.resolve('./uploads')));


// Global error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({
    message: 'Internal server error',
    error: err.message || 'Unknown error',
  });
});

// Start server and check DB
app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);

  // Check database connection on startup
  const dbCheck = await checkDatabaseConnection();
  if (dbCheck.ready) {
    console.log(`✅ Database connected successfully.`);
    // Tự động kiểm tra và tạo tài khoản Admin mặc định
    await ensureDefaultAdmin();
  } else {
    console.log(`⚠️  Database not connected: ${dbCheck.message}`);
    console.log(`📋 Setup available at: http://localhost:${PORT}/api/setup/status`);
    console.log(`   Frontend will redirect to Database Setup page.`);
  }
});
