import { Router } from 'express';
import { TaskController } from '../controllers/taskController';
import { authenticate } from '../middleware/auth';
import todoRoutes from './todoRoutes';
import commentRoutes from './commentRoutes';

const router = Router();

router.use(authenticate);

// Nested Todos & Comments
router.use('/:taskId/todos', todoRoutes);
router.use('/:taskId/comments', commentRoutes);

// Tasks CRUD
router.post('/', TaskController.createTask);
router.get('/', TaskController.getTasks);
router.get('/:id', TaskController.getTaskById);
router.put('/:id', TaskController.updateTask);

// Task Transitions & Statuses
router.post('/:id/transition', TaskController.transitionStep);
router.post('/:id/complete', TaskController.completeTask);
router.post('/:id/cancel', TaskController.cancelTask);

// Task History & Snapshots
router.get('/:id/history', TaskController.getTaskHistory);
router.get('/:id/history/:version', TaskController.getTaskHistoryVersion);

export default router;
