import { Router } from 'express';
import { SettingController } from '../controllers/settingController';
import { optionalAuthenticate } from '../middleware/auth';

const router = Router();

router.get('/environments', SettingController.getEnvironments);
router.post('/environments', optionalAuthenticate, SettingController.saveEnvironments);

export default router;
