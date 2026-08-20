import { Router } from 'express';
import { AIController } from '../controllers/aiController';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

const router = Router();

router.get('/providers', AIController.getProviders);
router.get('/models/:provider', authenticate, AIController.getModels);
router.get('/configs', authenticate, requirePermission('settings:ai:read'), AIController.getAiConfigs);
router.post('/configs', authenticate, requirePermission('settings:ai:write'), AIController.saveAiConfig);
router.put('/configs/:id', authenticate, requirePermission('settings:ai:write'), AIController.updateAiConfig);
router.delete('/configs/:id', authenticate, requirePermission('settings:ai:write'), AIController.deleteAiConfig);
router.post('/configs/:id/toggle-active', authenticate, requirePermission('settings:ai:write'), AIController.toggleActiveAiConfig);

export default router;
