"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDatabaseConnection = checkDatabaseConnection;
exports.isDatabaseReady = isDatabaseReady;
exports.setDatabaseReady = setDatabaseReady;
exports.reinitializePrisma = reinitializePrisma;
exports.getPrisma = getPrisma;
const client_1 = require("@prisma/client");
let prismaInstance = new client_1.PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});
let _isDatabaseReady = false;
/**
 * Kiểm tra trạng thái kết nối Database hiện tại
 */
async function checkDatabaseConnection() {
    try {
        await prismaInstance.$connect();
        // Check if the users table exists in PostgreSQL schema cleanly without triggering Prisma runtime errors
        const tables = await prismaInstance.$queryRaw `
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
    }
    catch (error) {
        _isDatabaseReady = false;
        return {
            ready: false,
            message: `Không thể kết nối database: ${error.message}`,
        };
    }
}
/**
 * Lấy trạng thái Database
 */
function isDatabaseReady() {
    return _isDatabaseReady;
}
/**
 * Đặt trạng thái Database thủ công
 */
function setDatabaseReady(ready) {
    _isDatabaseReady = ready;
}
/**
 * Reinitialize Prisma Client với DATABASE_URL mới
 * Dùng khi user setup database mới từ giao diện
 */
async function reinitializePrisma(newDatabaseUrl) {
    try {
        // Disconnect old client
        try {
            await prismaInstance.$disconnect();
        }
        catch {
            // Ignore disconnect errors on old client
        }
        // Update process env for Prisma
        process.env.DATABASE_URL = newDatabaseUrl;
        // Create new Prisma client instance
        prismaInstance = new client_1.PrismaClient({
            log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
            datasources: {
                db: {
                    url: newDatabaseUrl,
                },
            },
        });
        // Test connection and schema
        await prismaInstance.$connect();
        const tables = await prismaInstance.$queryRaw `
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
    }
    catch (error) {
        _isDatabaseReady = false;
        return {
            success: false,
            message: `Lỗi khi khởi tạo lại Prisma: ${error.message}`,
        };
    }
}
/**
 * Lấy instance Prisma Client hiện tại (luôn trả về instance mới nhất)
 * Tất cả controller nên dùng hàm này thay vì import trực tiếp
 */
function getPrisma() {
    return prismaInstance;
}
// Proxy object: khi các module import default, nó sẽ luôn proxy đến instance hiện tại
// Điều này đảm bảo sau reinitializePrisma, tất cả đều dùng instance mới
const prismaProxy = new Proxy({}, {
    get(_target, prop) {
        return prismaInstance[prop];
    },
});
exports.default = prismaProxy;
