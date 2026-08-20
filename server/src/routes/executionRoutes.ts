import { Router } from 'express';
import { ExecutionController } from '../controllers/executionController';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

const router = Router();

router.post('/:testCaseId/execute', authenticate, requirePermission('testcase:execute'), ExecutionController.executeTestCase);
router.get('/:testCaseId/history', authenticate, requirePermission('testcase:read'), ExecutionController.getHistory);

export default router;
