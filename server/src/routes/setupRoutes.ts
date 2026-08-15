import { Router } from 'express';
import {
  getSetupStatus,
  testDbConnection,
  createNewDatabase,
  initializeDatabase,
} from '../controllers/setupController';

const router = Router();

// GET /api/setup/status - Kiểm tra trạng thái hệ thống
router.get('/status', getSetupStatus);

// POST /api/setup/test-connection - Test kết nối PostgreSQL
router.post('/test-connection', testDbConnection);

// POST /api/setup/create-database - Tạo mới database
router.post('/create-database', createNewDatabase);

// POST /api/setup/initialize - Full setup: kết nối + migrate + tạo admin
router.post('/initialize', initializeDatabase);

export default router;
