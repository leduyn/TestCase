import { Router } from 'express';
import { ProposalReportController } from '../controllers/proposalReportController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Báo cáo thống kê Module Đề xuất
router.get('/proposals-by-type', ProposalReportController.getProposalsByType);
router.get('/proposals-by-status', ProposalReportController.getProposalsByStatus);
router.get('/proposals-by-approver', ProposalReportController.getProposalsByApprover);
router.get('/approval-time', ProposalReportController.getApprovalTimeStats);
router.get('/proposals-approval-time', ProposalReportController.getApprovalTimeStats);
router.get('/overdue-proposals', ProposalReportController.getOverdueProposals);

export default router;
