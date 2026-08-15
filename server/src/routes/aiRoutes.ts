import { Router } from 'express';
import { AIController } from '../controllers/aiController';
import { optionalAuthenticate } from '../middleware/auth';

const router = Router();

router.get('/providers', AIController.getProviders);
router.get('/configs', optionalAuthenticate, AIController.getAiConfigs);
router.post('/configs', optionalAuthenticate, AIController.saveAiConfig);

export default router;
