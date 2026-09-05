import { Router } from 'express';
import { ProposalController } from '../controllers/proposalController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Danh sách & Chi tiết
router.get('/', ProposalController.getProposals);
router.get('/:id', ProposalController.getProposalById);

// Tạo, sửa, xóa
router.post('/', ProposalController.createProposal);
router.put('/:id', ProposalController.updateProposal);
router.delete('/:id', ProposalController.deleteProposal);

// Luồng phê duyệt
router.post('/:id/submit', ProposalController.submitProposal);
router.post('/:id/cancel', ProposalController.cancelProposal);
router.post('/:id/approve', ProposalController.approveProposal);
router.post('/:id/reject', ProposalController.rejectProposal);

// Workflow engine
router.post('/:id/start-workflow', ProposalController.startWorkflow);

// Lịch sử & Bình luận
router.get('/:id/history', ProposalController.getHistory);
router.get('/:id/comments', ProposalController.getComments);
router.post('/:id/comments', ProposalController.addComment);

// Người theo dõi (Followers)
router.get('/:id/followers', ProposalController.getFollowers);
router.post('/:id/followers', ProposalController.addFollowers);
router.delete('/:id/followers/:userId', ProposalController.removeFollower);

export default router;
