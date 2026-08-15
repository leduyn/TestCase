import { Client } from 'pg';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// On Windows, npx must be called as npx.cmd in execSync
const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';

/**
 * Database Setup Service
 * Tương tự Odoo Database Manager - cho phép khởi tạo database từ giao diện web
 */

export interface DbConnectionInfo {
  host: string;
  port: number;
  user: string;
  password: string;
  dbName?: string;
}

function buildConnectionUrl(info: DbConnectionInfo, dbName?: string): string {
  const db = dbName || info.dbName || 'postgres';
  return `postgresql://${info.user}:${encodeURIComponent(info.password)}@${info.host}:${info.port}/${db}?schema=public`;
}

/**
 * Test kết nối đến PostgreSQL server
 */
export async function testConnection(info: DbConnectionInfo): Promise<{
  connected: boolean;
  message: string;
  serverVersion?: string;
}> {
  const client = new Client({
    host: info.host,
    port: info.port,
    user: info.user,
    password: info.password,
    database: 'postgres', // Kết nối tới DB mặc định để test
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    const result = await client.query('SELECT version()');
    const version = result.rows[0]?.version || 'Unknown';
    return {
      connected: true,
      message: `Kết nối thành công đến PostgreSQL server ${info.host}:${info.port}`,
      serverVersion: version,
    };
  } catch (error: any) {
    return {
      connected: false,
      message: `Không thể kết nối: ${error.message}`,
    };
  } finally {
    try {
      await client.end();
    } catch {
      // Ignore disconnect errors
    }
  }
}

/**
 * Liệt kê danh sách database trên server
 */
export async function listDatabases(info: DbConnectionInfo): Promise<string[]> {
  const client = new Client({
    host: info.host,
    port: info.port,
    user: info.user,
    password: info.password,
    database: 'postgres',
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    const result = await client.query(
      `SELECT datname FROM pg_database 
       WHERE datistemplate = false 
       AND datname NOT IN ('postgres')
       ORDER BY datname`
    );
    return result.rows.map((row: any) => row.datname);
  } finally {
    try {
      await client.end();
    } catch {
      // Ignore
    }
  }
}

/**
 * Tạo mới database trên server PostgreSQL
 */
export async function createDatabase(
  info: DbConnectionInfo,
  dbName: string
): Promise<{ success: boolean; message: string }> {
  const client = new Client({
    host: info.host,
    port: info.port,
    user: info.user,
    password: info.password,
    database: 'postgres',
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();

    // Check if database already exists
    const checkResult = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    );

    if (checkResult.rows.length > 0) {
      return {
        success: true,
        message: `Database "${dbName}" đã tồn tại. Sẽ sử dụng database này.`,
      };
    }

    // Create database - use double-quoting for the database name to prevent SQL injection
    const safeName = dbName.replace(/"/g, '""');
    await client.query(`CREATE DATABASE "${safeName}" ENCODING 'UTF8'`);

    return {
      success: true,
      message: `Database "${dbName}" đã được tạo thành công!`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Lỗi khi tạo database: ${error.message}`,
    };
  } finally {
    try {
      await client.end();
    } catch {
      // Ignore
    }
  }
}

/**
 * Test kết nối tới một database cụ thể
 */
export async function testDatabaseConnection(
  info: DbConnectionInfo,
  dbName: string
): Promise<{ connected: boolean; message: string }> {
  const client = new Client({
    host: info.host,
    port: info.port,
    user: info.user,
    password: info.password,
    database: dbName,
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    await client.query('SELECT 1');
    return {
      connected: true,
      message: `Kết nối thành công đến database "${dbName}"`,
    };
  } catch (error: any) {
    return {
      connected: false,
      message: `Không thể kết nối đến database "${dbName}": ${error.message}`,
    };
  } finally {
    try {
      await client.end();
    } catch {
      // Ignore
    }
  }
}

/**
 * Chạy Prisma migration để tạo schema
 */
export async function runMigration(databaseUrl: string): Promise<{
  success: boolean;
  message: string;
  output?: string;
}> {
  const serverRoot = path.resolve(__dirname, '..', '..');

  try {
    // Set DATABASE_URL as env variable for prisma
    const env = {
      ...process.env,
      DATABASE_URL: databaseUrl,
    };

    // Try prisma migrate deploy first (production-safe)
    try {
      const output = execSync(`${NPX} prisma migrate deploy`, {
        cwd: serverRoot,
        env,
        timeout: 60000,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return {
        success: true,
        message: 'Migration thành công!',
        output: output?.toString(),
      };
    } catch {
      // If no migrations exist yet, use db push instead
      const output = execSync(`${NPX} prisma db push --accept-data-loss --skip-generate`, {
        cwd: serverRoot,
        env,
        timeout: 60000,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return {
        success: true,
        message: 'Schema pushed thành công!',
        output: output?.toString(),
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: `Lỗi khi chạy migration: ${error.message}`,
      output: error.stderr?.toString() || error.stdout?.toString(),
    };
  }
}

/**
 * Generate Prisma Client cho database URL mới
 */
export async function generatePrismaClient(databaseUrl: string): Promise<{
  success: boolean;
  message: string;
}> {
  const serverRoot = path.resolve(__dirname, '..', '..');

  try {
    const env = {
      ...process.env,
      DATABASE_URL: databaseUrl,
    };

    execSync(`${NPX} prisma generate`, {
      cwd: serverRoot,
      env,
      timeout: 60000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return {
      success: true,
      message: 'Prisma Client generated thành công!',
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Lỗi khi generate Prisma Client: ${error.message}`,
    };
  }
}

/**
 * Tạo tài khoản Admin đầu tiên trong database mới
 */
export async function createAdminUser(
  info: DbConnectionInfo,
  dbName: string,
  adminEmail: string,
  adminPassword: string,
  adminFullName: string
): Promise<{ success: boolean; message: string }> {
  const client = new Client({
    host: info.host,
    port: info.port,
    user: info.user,
    password: info.password,
    database: dbName,
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();

    // Check if any users exist
    const existingUsers = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(existingUsers.rows[0].count) > 0) {
      return {
        success: true,
        message: 'Database đã có tài khoản người dùng. Bỏ qua tạo Admin.',
      };
    }

    // Hash password
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const id = crypto.randomUUID();

    await client.query(
      `INSERT INTO users (id, email, password_hash, full_name, role, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, 'ADMIN', NOW(), NOW())`,
      [id, adminEmail, passwordHash, adminFullName]
    );

    return {
      success: true,
      message: `Tài khoản Admin "${adminEmail}" đã được tạo thành công!`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Lỗi khi tạo Admin: ${error.message}`,
    };
  } finally {
    try {
      await client.end();
    } catch {
      // Ignore
    }
  }
}

/**
 * Ghi DATABASE_URL vào file .env
 */
export function updateEnvFile(databaseUrl: string): {
  success: boolean;
  message: string;
} {
  const serverRoot = path.resolve(__dirname, '..', '..');
  const envPath = path.join(serverRoot, '.env');

  try {
    let envContent = '';

    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');

      // Replace existing DATABASE_URL
      if (envContent.includes('DATABASE_URL')) {
        envContent = envContent.replace(
          /DATABASE_URL=.*/g,
          `DATABASE_URL="${databaseUrl}"`
        );
      } else {
        envContent += `\nDATABASE_URL="${databaseUrl}"\n`;
      }
    } else {
      envContent = `PORT=3001
NODE_ENV=development

# PostgreSQL Database Connection URL
DATABASE_URL="${databaseUrl}"

# JWT Secret Key
JWT_SECRET=super_secret_jwt_key_testcase_ai_2026

# Default AI API Keys (Optional - can be overridden via UI Settings)
GEMINI_API_KEY=
OPENAI_API_KEY=
DEEPSEEK_API_KEY=
ANTHROPIC_API_KEY=
`;
    }

    fs.writeFileSync(envPath, envContent, 'utf-8');

    return {
      success: true,
      message: 'Cấu hình DATABASE_URL đã được lưu vào file .env',
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Lỗi khi ghi file .env: ${error.message}`,
    };
  }
}

/**
 * Build DATABASE_URL from connection info
 */
export function buildDatabaseUrl(info: DbConnectionInfo): string {
  return buildConnectionUrl(info, info.dbName);
}
