import { Router } from 'express';
import multer from 'multer';
import { UploadController } from '../controllers/uploadController';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB hard limit (soft limit from settings)
});

// Upload images for an execution
router.post(
  '/executions/:executionId/images',
  authenticate,
  requirePermission('testcase:execute'),
  upload.array('images', 20), // max 20 files per request (soft limit from settings)
  UploadController.uploadImages
);

// Get all images for an execution
router.get(
  '/executions/:executionId/images',
  authenticate,
  requirePermission('testcase:read'),
  UploadController.getExecutionImages
);

// Get all images for a testcase (across all executions)
router.get(
  '/testcases/:testCaseId/images',
  authenticate,
  requirePermission('testcase:read'),
  UploadController.getTestCaseImages
);

// View/download a single image
router.get(
  '/images/:imageId/view',
  authenticate,
  requirePermission('testcase:read'),
  UploadController.getImage
);

// Delete an image
router.delete(
  '/images/:imageId',
  authenticate,
  requirePermission('testcase:execute'),
  UploadController.deleteImage
);

export default router;
