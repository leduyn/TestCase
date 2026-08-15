import { Request, Response, NextFunction } from 'express';
import {
  testConnection,
  listDatabases,
  createDatabase,
  testDatabaseConnection,
  runMigration,
  generatePrismaClient,
  createAdminUser,
  updateEnvFile,
  buildDatabaseUrl,
} from '../services/databaseSetup';
import {
  isDatabaseReady,
  checkDatabaseConnection,
  reinitializePrisma,
} from '../config/database';

/**
 * GET /api/setup/status
 * Kiểm tra trạng thái hệ thống - DB đã sẵn sàng hay cần setup
 */
export async function getSetupStatus(req: Request, res: Response): Promise<void> {
  const dbReady = isDatabaseReady();

  if (dbReady) {
    res.json({
      status: 'READY',
      message: 'Hệ thống đang hoạt động bình thường.',
    });
  } else {
    // Try once more to connect
    const check = await checkDatabaseConnection();
    if (check.ready) {
      res.json({
        status: 'READY',
        message: 'Hệ thống đang hoạt động bình thường.',
      });
    } else {
      res.json({
        status: 'SETUP_REQUIRED',
        message: 'Cần khởi tạo cấu hình Database. Vui lòng thiết lập kết nối PostgreSQL.',
      });
    }
  }
}

/**
 * POST /api/setup/test-connection
 * Test kết nối đến PostgreSQL server
 */
export async function testDbConnection(req: Request, res: Response): Promise<void> {
  const { host, port, user, password } = req.body;

  if (!host || !user || !password) {
    res.status(400).json({
      error: 'Thiếu thông tin: host, user, password là bắt buộc.',
    });
    return;
  }

  const connectionInfo = {
    host,
    port: parseInt(port) || 5432,
    user,
    password,
  };

  const result = await testConnection(connectionInfo);

  if (result.connected) {
    // Also fetch list of databases
    try {
      const databases = await listDatabases(connectionInfo);
      res.json({
        connected: true,
        message: result.message,
        serverVersion: result.serverVersion,
        databases,
      });
    } catch (error: any) {
      res.json({
        connected: true,
        message: result.message,
        serverVersion: result.serverVersion,
        databases: [],
        warning: `Không thể lấy danh sách database: ${error.message}`,
      });
    }
  } else {
    res.status(400).json({
      connected: false,
      message: result.message,
    });
  }
}

/**
 * POST /api/setup/create-database
 * Tạo mới database trên server PostgreSQL
 */
export async function createNewDatabase(req: Request, res: Response): Promise<void> {
  const { host, port, user, password, dbName } = req.body;

  if (!host || !user || !password || !dbName) {
    res.status(400).json({
      error: 'Thiếu thông tin: host, user, password, dbName là bắt buộc.',
    });
    return;
  }

  // Validate dbName (chỉ cho phép ký tự hợp lệ)
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(dbName)) {
    res.status(400).json({
      error: 'Tên database không hợp lệ. Chỉ chấp nhận chữ cái, số và dấu gạch dưới.',
    });
    return;
  }

  const connectionInfo = {
    host,
    port: parseInt(port) || 5432,
    user,
    password,
  };

  const result = await createDatabase(connectionInfo, dbName);

  if (result.success) {
    res.json(result);
  } else {
    res.status(500).json(result);
  }
}

/**
 * POST /api/setup/initialize
 * Chạy full setup: kết nối → tạo DB (nếu cần) → migrate → tạo admin → lưu .env
 */
export async function initializeDatabase(req: Request, res: Response): Promise<void> {
  const {
    host,
    port,
    user,
    password,
    dbName,
    createNew,
    adminEmail,
    adminPassword,
    adminFullName,
  } = req.body;

  // Validate required fields
  if (!host || !user || !password || !dbName) {
    res.status(400).json({
      success: false,
      error: 'Thiếu thông tin kết nối database (host, user, password, dbName).',
    });
    return;
  }

  if (!adminEmail || !adminPassword || !adminFullName) {
    res.status(400).json({
      success: false,
      error: 'Thiếu thông tin tài khoản Admin (adminEmail, adminPassword, adminFullName).',
    });
    return;
  }

  const connectionInfo = {
    host,
    port: parseInt(port) || 5432,
    user,
    password,
    dbName,
  };

  const steps: Array<{ step: string; status: string; message: string }> = [];

  try {
    // Step 1: Test kết nối server
    const connResult = await testConnection(connectionInfo);
    if (!connResult.connected) {
      res.status(400).json({
        success: false,
        error: connResult.message,
        steps: [{ step: 'Test kết nối', status: 'FAILED', message: connResult.message }],
      });
      return;
    }
    steps.push({ step: 'Test kết nối Server', status: 'OK', message: connResult.message });

    // Step 2: Tạo database mới (nếu được yêu cầu)
    if (createNew) {
      const createResult = await createDatabase(connectionInfo, dbName);
      if (!createResult.success) {
        res.status(500).json({
          success: false,
          error: createResult.message,
          steps: [...steps, { step: 'Tạo Database', status: 'FAILED', message: createResult.message }],
        });
        return;
      }
      steps.push({ step: 'Tạo Database', status: 'OK', message: createResult.message });
    }

    // Step 3: Test kết nối tới database cụ thể
    const dbConnResult = await testDatabaseConnection(connectionInfo, dbName);
    if (!dbConnResult.connected) {
      res.status(400).json({
        success: false,
        error: dbConnResult.message,
        steps: [...steps, { step: 'Kết nối Database', status: 'FAILED', message: dbConnResult.message }],
      });
      return;
    }
    steps.push({ step: 'Kết nối Database', status: 'OK', message: dbConnResult.message });

    // Step 4: Build DATABASE_URL và lưu .env
    const databaseUrl = buildDatabaseUrl(connectionInfo);
    const envResult = updateEnvFile(databaseUrl);
    steps.push({ step: 'Lưu cấu hình .env', status: envResult.success ? 'OK' : 'WARNING', message: envResult.message });

    // Step 5: Chạy Migration (tạo tables trước)
    const migrateResult = await runMigration(databaseUrl);
    if (!migrateResult.success) {
      res.status(500).json({
        success: false,
        error: migrateResult.message,
        steps: [...steps, { step: 'Chạy Migration', status: 'FAILED', message: migrateResult.message }],
      });
      return;
    }
    steps.push({ step: 'Chạy Migration', status: 'OK', message: migrateResult.message });

    // Step 6: Generate Prisma Client (sau khi schema đã push)
    const genResult = await generatePrismaClient(databaseUrl);
    steps.push({ step: 'Generate Prisma Client', status: genResult.success ? 'OK' : 'WARNING', message: genResult.message });

    // Step 7: Reinitialize Prisma Client
    const reinitResult = await reinitializePrisma(databaseUrl);
    if (!reinitResult.success) {
      steps.push({ step: 'Reload Prisma', status: 'WARNING', message: reinitResult.message });
    } else {
      steps.push({ step: 'Reload Prisma', status: 'OK', message: reinitResult.message });
    }

    // Step 8: Tạo tài khoản Admin
    const adminResult = await createAdminUser(
      connectionInfo,
      dbName,
      adminEmail,
      adminPassword,
      adminFullName
    );
    steps.push({
      step: 'Tạo Admin',
      status: adminResult.success ? 'OK' : 'WARNING',
      message: adminResult.message,
    });

    res.json({
      success: true,
      message: 'Khởi tạo hệ thống thành công! Bạn có thể đăng nhập bằng tài khoản Admin.',
      steps,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: `Lỗi không mong muốn: ${error.message}`,
      steps,
    });
  }
}

/**
 * Middleware kiểm tra trạng thái Database
 * Chặn tất cả API (trừ /api/setup/* và /api/health) nếu DB chưa sẵn sàng
 */
export function dbCheckMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Bypass for setup and health endpoints
  if (
    req.path.startsWith('/api/setup') ||
    req.path.startsWith('/api/health') ||
    req.path === '/api/setup/status'
  ) {
    next();
    return;
  }

  if (!isDatabaseReady()) {
    res.status(503).json({
      status: 'SETUP_REQUIRED',
      message: 'Hệ thống chưa được khởi tạo. Vui lòng cấu hình kết nối Database trước.',
    });
    return;
  }

  next();
}
