import { Router } from 'express';
import { ProcessController } from '../controllers/processController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Tất cả các routes đều yêu cầu đăng nhập
router.use(authenticate);

// Processes CRUD
router.post('/', ProcessController.createProcess);
router.get('/', ProcessController.getProcesses);
router.get('/:id', ProcessController.getProcessById);
router.put('/:id', ProcessController.updateProcess);
router.delete('/:id', ProcessController.deleteProcess);

// Steps CRUD
router.post('/:id/steps', ProcessController.addStep);
router.put('/steps/:stepId', ProcessController.updateStep);
router.delete('/steps/:stepId', ProcessController.deleteStep);

export default router;
