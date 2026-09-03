import { Router } from 'express';
import { CommentController } from '../controllers/commentController';
import { authenticate } from '../middleware/auth';

const router = Router({ mergeParams: true });

router.use(authenticate);

// Nested comments: /api/tasks/:taskId/comments
router.post('/', CommentController.createComment);
router.get('/', CommentController.getCommentsByTaskId);

export default router;
