import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../Models/UserModel';

const router = Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.get('/me', authenticate, AuthController.getMe);
router.put('/profile', authenticate, AuthController.updateProfile);
router.post('/disable', authenticate, AuthController.disableAccount);
router.post('/toggle/:id', authenticate, authorize([UserRole.ADMIN]), AuthController.toggleAccountStatus);

export default router;
