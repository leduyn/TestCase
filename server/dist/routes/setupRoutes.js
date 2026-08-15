"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const setupController_1 = require("../controllers/setupController");
const router = (0, express_1.Router)();
// GET /api/setup/status - Kiểm tra trạng thái hệ thống
router.get('/status', setupController_1.getSetupStatus);
// POST /api/setup/test-connection - Test kết nối PostgreSQL
router.post('/test-connection', setupController_1.testDbConnection);
// POST /api/setup/create-database - Tạo mới database
router.post('/create-database', setupController_1.createNewDatabase);
// POST /api/setup/initialize - Full setup: kết nối + migrate + tạo admin
router.post('/initialize', setupController_1.initializeDatabase);
exports.default = router;
