import { Router } from 'express';
import { ExecutionController } from '../controllers/executionController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/:testCaseId/execute', authenticate, ExecutionController.executeTestCase);
router.get('/:testCaseId/history', authenticate, ExecutionController.getHistory);

export default router;
