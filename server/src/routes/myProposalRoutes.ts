import { Router } from 'express';
import { MyProposalController } from '../controllers/myProposalController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Sub-routes cho User Hub Dashboard
router.get('/proposals', MyProposalController.getMyProposals);
router.get('/approvals', MyProposalController.getMyPendingApprovals);
router.get('/approved', MyProposalController.getMyApproved);
router.get('/rejected', MyProposalController.getMyRejected);
router.get('/following', MyProposalController.getMyFollowing);

export default router;
