import { Router } from 'express';
import { SettingController } from '../controllers/settingController';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

const router = Router();

router.get('/environments', authenticate, requirePermission('settings:env:read'), SettingController.getEnvironments);
router.post('/environments', authenticate, requirePermission('settings:env:write'), SettingController.saveEnvironments);
router.get('/system-prompt', authenticate, requirePermission('settings:prompt:read'), SettingController.getSystemPrompt);
router.put('/system-prompt', authenticate, requirePermission('settings:prompt:write'), SettingController.updateSystemPrompt);

export default router;
