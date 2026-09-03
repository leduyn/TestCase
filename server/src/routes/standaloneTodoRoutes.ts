import { Router } from 'express';
import { TodoController } from '../controllers/todoController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Direct Todo actions: /api/todos/:todoId
router.put('/:todoId', TodoController.updateTodo);
router.delete('/:todoId', TodoController.deleteTodo);
router.put('/:todoId/toggle', TodoController.toggleTodo);

export default router;
