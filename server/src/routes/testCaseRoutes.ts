import { Router } from 'express';
import multer from 'multer';
import { TestCaseController } from '../controllers/testCaseController';
import { ImportController } from '../controllers/importController';
import { authenticate } from '../middleware/auth';
import { requirePermission, requireResourcePermission } from '../middleware/rbac';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
});

// Test Case routes
router.post('/', authenticate, requirePermission('testcase:create'), TestCaseController.createTestCase);
router.post('/generate', authenticate, requirePermission('testcase:generate'), upload.single('file'), TestCaseController.generate);
router.post('/import/preview', authenticate, requirePermission('testcase:import'), upload.single('file'), ImportController.preview);
router.post('/import', authenticate, requirePermission('testcase:import'), upload.single('file'), ImportController.import);
router.post('/import/json', authenticate, requirePermission('testcase:import'), ImportController.importJson);
router.get('/stats/user-executions', authenticate, TestCaseController.getUserExecutionStats);
router.get('/suites', authenticate, requirePermission('testsuite:read'), TestCaseController.getSuites);
router.get('/suites/:id', authenticate, requirePermission('testsuite:read'), TestCaseController.getSuiteById);
router.put('/:id', authenticate, requirePermission('testcase:update'), TestCaseController.updateTestCase);
router.delete('/:id', authenticate, requirePermission('testcase:delete'), TestCaseController.deleteTestCase);

// TestSuite CRUD routes
router.put('/suites/:id', authenticate, requirePermission('testsuite:update'), TestCaseController.updateTestSuite);
router.delete('/suites/:id', authenticate, requirePermission('testsuite:delete'), TestCaseController.deleteTestSuite);

export default router;

