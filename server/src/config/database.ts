import { PrismaClient } from '@prisma/client';
import pg, { Pool, PoolConfig } from 'pg';

// Configure pg pool defaults — Prisma Client v5 uses pg internally
const pgPoolConfig: PoolConfig = {
  max: 20,
  min: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 30000,
};

// Set pg defaults globally — affects all pg.Pool instances including Prisma's internal pool
// pg.defaults is a module-level export (type: Defaults & ClientConfig)
const pgDefaults = pg.defaults as any;
pgDefaults.max = pgPoolConfig.max;
pgDefaults.min = pgPoolConfig.min;
pgDefaults.idleTimeoutMillis = pgPoolConfig.idleTimeoutMillis;
pgDefaults.connectionTimeoutMillis = pgPoolConfig.connectionTimeoutMillis;

// Create a monitoring pool for health checks
const monitorPool = new Pool({
  ...pgPoolConfig,
  max: 5,
  connectionString: process.env.DATABASE_URL,
});

let prismaInstance: PrismaClient = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn', 'info'] : ['error'],
});

let _isDatabaseReady = false;

// Prisma middleware for slow query detection
prismaInstance.$use(async (params: any, next: any) => {
  const start = Date.now();
  try {
    const result = await next(params);
    const duration = Date.now() - start;
    if (duration > 3000) {
      console.warn(`[DB SLOW QUERY] ${duration}ms — ${params.action}`);
    }
    return result;
  } catch (error: any) {
    const duration = Date.now() - start;
    console.error(`[DB ERROR] ${duration}ms — ${params.action}: ${error.message}`);
    throw error;
  }
});

(prismaInstance as any).$on('query', (e: any) => {
  if (e.duration > 5000) {
    console.warn(`[DB VERY SLOW] ${e.duration}ms — ${e.query}`);
  }
});

(prismaInstance as any).$on('error', (e: any) => {
  console.error(`[PRISMA ERROR] ${e.message}`);
});

/**
 * Kiểm tra trạng thái kết nối Database hiện tại
 */
export async function checkDatabaseConnection(): Promise<{
  ready: boolean;
  message: string;
}> {
  try {
    await prismaInstance.$connect();
    const tables = await prismaInstance.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
      ) as "exists"
    `;

    const hasUsersTable = tables?.[0]?.exists;
    if (!hasUsersTable) {
      _isDatabaseReady = false;
      return {
        ready: false,
        message: 'Database chưa có bảng schema (cần chạy khởi tạo Database qua trang Setup).',
      };
    }

    _isDatabaseReady = true;
    return {
      ready: true,
      message: 'Kết nối database và schema thành công.',
    };
  } catch (error: any) {
    _isDatabaseReady = false;
    return {
      ready: false,
      message: `Không thể kết nối database: ${error.message}`,
    };
  }
}

/**
 * Kiểm tra kết nối database bằng pool riêng (dùng cho health check)
 */
export async function checkDatabasePoolHealth(): Promise<{
  connected: boolean;
  poolSize: number;
  idleCount: number;
  error?: string;
}> {
  try {
    const client = await monitorPool.connect();
    const poolState = monitorPool.options;
    client.release();
    return {
      connected: true,
      poolSize: poolState.max || 20,
      idleCount: monitorPool.idleCount || 0,
    };
  } catch (error: any) {
    return {
      connected: false,
      poolSize: 0,
      idleCount: 0,
      error: error.message,
    };
  }
}

/**
 * Lấy trạng thái Database
 */
export function isDatabaseReady(): boolean {
  return _isDatabaseReady;
}

/**
 * Đặt trạng thái Database thủ công
 */
export function setDatabaseReady(ready: boolean): void {
  _isDatabaseReady = ready;
}

/**
 * Reinitialize Prisma Client với DATABASE_URL mới
 * Dùng khi user setup database mới từ giao diện
 */
export async function reinitializePrisma(newDatabaseUrl: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    try {
      await prismaInstance.$disconnect();
    } catch {
      // Ignore disconnect errors on old client
    }

    const url = newDatabaseUrl.includes('connection_limit')
      ? newDatabaseUrl
      : `${newDatabaseUrl.includes('?') ? newDatabaseUrl + '&' : newDatabaseUrl + '?'}connection_limit=20&statement_timeout=30000&idle_in_transaction_session_timeout=60000`;

    process.env.DATABASE_URL = url;

    prismaInstance = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn', 'info'] : ['error'],
      datasources: {
        db: {
          url: url,
        },
      },
    });

    // Re-register middleware
    prismaInstance.$use(async (params: any, next: any) => {
      const start = Date.now();
      try {
        const result = await next(params);
        const duration = Date.now() - start;
        if (duration > 3000) {
          console.warn(`[DB SLOW QUERY] ${duration}ms — ${params.action}`);
        }
        return result;
      } catch (error: any) {
        const duration = Date.now() - start;
        console.error(`[DB ERROR] ${duration}ms — ${params.action}: ${error.message}`);
        throw error;
      }
    });

    await prismaInstance.$connect();
    const tables = await prismaInstance.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
      ) as "exists"
    `;

    const hasUsersTable = tables?.[0]?.exists;
    _isDatabaseReady = Boolean(hasUsersTable);

    return {
      success: true,
      message: 'Prisma Client đã được khởi tạo lại với database mới.',
    };
  } catch (error: any) {
    _isDatabaseReady = false;
    return {
      success: false,
      message: `Lỗi khi khởi tạo lại Prisma: ${error.message}`,
    };
  }
}

/**
 * Lấy instance Prisma Client hiện tại
 */
export function getPrisma(): PrismaClient {
  return prismaInstance;
}

/**
 * Lấy pool monitor cho health check
 */
export function getMonitorPool(): Pool {
  return monitorPool;
}

/**
 * Lấy cấu hình pool hiện tại
 */
export function getPoolConfig(): PoolConfig {
  return pgPoolConfig;
}

// Proxy object
const prismaProxy = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    return (prismaInstance as any)[prop];
  },
});

export default prismaProxy;
