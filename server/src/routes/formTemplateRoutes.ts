import { Router } from 'express';
import { FormTemplateController } from '../controllers/formTemplateController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Public đọc danh sách và chi tiết form template
router.get('/', FormTemplateController.getFormTemplates);
router.get('/:id', FormTemplateController.getFormTemplateById);

// Quản lý Form Template (Admin & Manager)
router.post('/', authorize(['ADMIN', 'MANAGER']), FormTemplateController.createFormTemplate);
router.put('/:id', authorize(['ADMIN', 'MANAGER']), FormTemplateController.updateFormTemplate);
router.delete('/:id', authorize(['ADMIN', 'MANAGER']), FormTemplateController.deleteFormTemplate);
router.post('/:id/duplicate', authorize(['ADMIN', 'MANAGER']), FormTemplateController.duplicateFormTemplate);

// Quản lý Fields trong Template
router.post('/:id/fields', authorize(['ADMIN', 'MANAGER']), FormTemplateController.addField);
router.post('/:id/fields/reorder', authorize(['ADMIN', 'MANAGER']), FormTemplateController.reorderFields);
router.put('/fields/:fieldId', authorize(['ADMIN', 'MANAGER']), FormTemplateController.updateField);
router.delete('/fields/:fieldId', authorize(['ADMIN', 'MANAGER']), FormTemplateController.deleteField);

export default router;
