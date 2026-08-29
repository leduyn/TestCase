import { Router } from 'express';
import { StatusHandlerController } from '../controllers/statusHandlerController';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

const router = Router();

// Tất cả route đều yêu cầu đăng nhập
router.use(authenticate);

// Danh sách user được gán xử lý một trạng thái (dùng cho dropdown giao việc)
router.get('/:status', StatusHandlerController.getHandlersByStatus);

// Các trạng thái mà user hiện tại được gán xử lý
router.get('/me/statuses', StatusHandlerController.getMyStatuses);

// Gán user xử lý một trạng thái (cần quyền quản lý người dùng)
router.post('/', requirePermission('users:update'), StatusHandlerController.assignHandler);

// Gỡ user khỏi xử lý một trạng thái (cần quyền quản lý người dùng)
router.delete('/:status/:userId', requirePermission('users:update'), StatusHandlerController.removeHandler);

export default router;
