import { Router } from 'express';
import { ProcessController } from '../controllers/processController';
import { CustomFieldController } from '../controllers/customFieldController';
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

// Custom Fields của Process
router.get('/:processId/custom-fields', CustomFieldController.getCustomFieldsByProcess);
router.post('/:processId/custom-fields', CustomFieldController.createCustomField);
router.post('/:processId/custom-fields/reorder', CustomFieldController.reorderCustomFields);

export default router;
