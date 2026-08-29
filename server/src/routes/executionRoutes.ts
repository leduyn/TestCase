import { Router } from 'express';
import { ExecutionController } from '../controllers/executionController';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

const router = Router();

router.post('/:testCaseId/execute', authenticate, requirePermission('testcase:execute'), ExecutionController.executeTestCase);
router.put('/:executionId', authenticate, requirePermission('testcase:execute'), ExecutionController.updateExecution);
router.get('/:testCaseId/history', authenticate, requirePermission('testcase:read'), ExecutionController.getHistory);
router.get('/watcher-users', authenticate, ExecutionController.getWatcherCandidates);
router.get('/:executionId/snapshots', authenticate, requirePermission('testcase:read'), ExecutionController.getSnapshots);
router.patch('/:executionId/watchers', authenticate, requirePermission('testcase:execute'), ExecutionController.setWatchers);

export default router;
