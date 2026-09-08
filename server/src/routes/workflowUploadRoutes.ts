import { Router } from 'express';
import multer from 'multer';
import { WorkflowUploadController } from '../controllers/workflowUploadController';
import { authenticate, optionalAuthenticate } from '../middleware/auth';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB hard limit
});

// POST requires strict authentication
router.post('/', authenticate, upload.array('files', 10), WorkflowUploadController.uploadFiles);

// GET view supports optional authentication (allows image tags / downloads with or without expired tokens)
router.get('/view', optionalAuthenticate, WorkflowUploadController.viewFile);

export default router;
