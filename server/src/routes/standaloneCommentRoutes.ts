import { Router } from 'express';
import { CommentController } from '../controllers/commentController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Direct comment actions: /api/comments/:commentId
router.put('/:commentId', CommentController.updateComment);
router.delete('/:commentId', CommentController.deleteComment);

export default router;
