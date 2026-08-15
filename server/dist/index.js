"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const aiRoutes_1 = __importDefault(require("./routes/aiRoutes"));
const testCaseRoutes_1 = __importDefault(require("./routes/testCaseRoutes"));
const executionRoutes_1 = __importDefault(require("./routes/executionRoutes"));
const exportRoutes_1 = __importDefault(require("./routes/exportRoutes"));
const setupRoutes_1 = __importDefault(require("./routes/setupRoutes"));
const settingRoutes_1 = __importDefault(require("./routes/settingRoutes"));
const database_1 = require("./config/database");
const setupController_1 = require("./controllers/setupController");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Middlewares
app.use((0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
// Health check (always available)
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        message: 'AI Test Case Generator API is running',
        timestamp: new Date().toISOString(),
    });
});
// Setup Routes (always available, even without DB)
app.use('/api/setup', setupRoutes_1.default);
// Database Check Middleware - chặn API nếu DB chưa sẵn sàng
app.use(setupController_1.dbCheckMiddleware);
// API Routes (requires DB connection)
app.use('/api/auth', authRoutes_1.default);
app.use('/api/ai', aiRoutes_1.default);
app.use('/api/testcases', testCaseRoutes_1.default);
app.use('/api/executions', executionRoutes_1.default);
app.use('/api/export', exportRoutes_1.default);
app.use('/api/settings', settingRoutes_1.default);
// Global error handler
app.use((err, _req, res, _next) => {
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
    const dbCheck = await (0, database_1.checkDatabaseConnection)();
    if (dbCheck.ready) {
        console.log(`✅ Database connected successfully.`);
    }
    else {
        console.log(`⚠️  Database not connected: ${dbCheck.message}`);
        console.log(`📋 Setup available at: http://localhost:${PORT}/api/setup/status`);
        console.log(`   Frontend will redirect to Database Setup page.`);
    }
});
