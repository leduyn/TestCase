import { Router } from 'express';
import { TodoController } from '../controllers/todoController';
import { authenticate } from '../middleware/auth';

const router = Router({ mergeParams: true });

router.use(authenticate);

// Nested routes: /api/tasks/:taskId/todos
router.post('/', TodoController.createTodo);
router.get('/', TodoController.getTodosByTaskId);

export default router;
