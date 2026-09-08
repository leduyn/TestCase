import { Router } from 'express';
import { ExecutionController } from '../controllers/executionController';
import { ExecutionCommentController } from '../controllers/executionCommentController';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

const router = Router();

router.post('/:testCaseId/execute', authenticate, requirePermission('testcase:execute'), ExecutionController.executeTestCase);
router.put('/:executionId', authenticate, requirePermission('testcase:execute'), ExecutionController.updateExecution);
router.get('/:testCaseId/history', authenticate, requirePermission('testcase:read'), ExecutionController.getHistory);
router.get('/watcher-users', authenticate, ExecutionController.getWatcherCandidates);
router.get('/:executionId/snapshots', authenticate, requirePermission('testcase:read'), ExecutionController.getSnapshots);
router.patch('/:executionId/watchers', authenticate, requirePermission('testcase:read'), ExecutionController.setWatchers);

// Trao đổi & Bình luận cho lượt thực thi (Comments)
router.get('/:executionId/comments', authenticate, requirePermission('testcase:read'), ExecutionCommentController.getComments);
router.post('/:executionId/comments', authenticate, requirePermission('testcase:read'), ExecutionCommentController.addComment);
router.delete('/:executionId/comments/:commentId', authenticate, requirePermission('testcase:read'), ExecutionCommentController.deleteComment);

export default router;
