import { Router } from 'express';
import { WorkflowReportController } from '../controllers/workflowReportController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/tasks-by-status', WorkflowReportController.getTasksByStatus);
router.get('/tasks-by-process', WorkflowReportController.getTasksByProcess);
router.get('/tasks-by-executor', WorkflowReportController.getTasksByExecutor);
router.get('/overdue-tasks', WorkflowReportController.getOverdueTasks);

export default router;
