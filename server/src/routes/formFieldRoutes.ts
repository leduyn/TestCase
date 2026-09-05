import { Router } from 'express';
import { FormTemplateController } from '../controllers/formTemplateController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.put('/:fieldId', authorize(['ADMIN', 'MANAGER']), FormTemplateController.updateField);
router.delete('/:fieldId', authorize(['ADMIN', 'MANAGER']), FormTemplateController.deleteField);

export default router;
