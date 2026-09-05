import { Router } from 'express';
import { ProposalTypeController } from '../controllers/proposalTypeController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Yêu cầu đăng nhập cho tất cả routes
router.use(authenticate);

// Public đọc danh sách và chi tiết cho người dùng đã đăng nhập
router.get('/', ProposalTypeController.getProposalTypes);
router.get('/:id', ProposalTypeController.getProposalTypeById);

// Các thao tác quản trị chỉ dành cho ADMIN và MANAGER
router.post('/', authorize(['ADMIN', 'MANAGER']), ProposalTypeController.createProposalType);
router.put('/:id', authorize(['ADMIN', 'MANAGER']), ProposalTypeController.updateProposalType);
router.post('/:id/toggle-active', authorize(['ADMIN', 'MANAGER']), ProposalTypeController.toggleActive);
router.delete('/:id', authorize(['ADMIN']), ProposalTypeController.deleteProposalType);

export default router;
