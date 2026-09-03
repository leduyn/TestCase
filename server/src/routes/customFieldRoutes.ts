import { Router } from 'express';
import { CustomFieldController } from '../controllers/customFieldController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Types & Utilities
router.get('/types', CustomFieldController.getSupportedTypes);
router.post('/validate-config', CustomFieldController.validateConfig);
router.post('/reorder', CustomFieldController.reorderCustomFields);

// Field CRUD
router.post('/', CustomFieldController.createCustomField);
router.get('/:id', CustomFieldController.getCustomFieldById);
router.put('/:id', CustomFieldController.updateCustomField);
router.delete('/:id', CustomFieldController.deleteCustomField);
router.post('/:id/duplicate', CustomFieldController.duplicateCustomField);

export default router;
