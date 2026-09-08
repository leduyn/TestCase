import { Router } from 'express';
import { ProposalNotificationController } from '../controllers/proposalNotificationController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Thông báo người dùng
router.get('/', ProposalNotificationController.getNotifications);
router.get('/unread-count', ProposalNotificationController.getUnreadCount);
router.put('/read-all', ProposalNotificationController.markAllAsRead);
router.put('/:id/read', ProposalNotificationController.markAsRead);
router.delete('/:id', ProposalNotificationController.deleteNotification);

export default router;
