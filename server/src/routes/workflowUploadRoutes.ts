import { Router } from 'express';
import multer from 'multer';
import { WorkflowUploadController } from '../controllers/workflowUploadController';
import { authenticate } from '../middleware/auth';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB hard limit
});

router.use(authenticate);

router.post('/', upload.array('files', 10), WorkflowUploadController.uploadFiles);
router.get('/view', WorkflowUploadController.viewFile);

export default router;
