import { Router } from 'express';
import multer from 'multer';
import { TestCaseController } from '../controllers/testCaseController';
import { ImportController } from '../controllers/importController';
import { optionalAuthenticate } from '../middleware/auth';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
});

router.post('/', optionalAuthenticate, TestCaseController.createTestCase);
router.post('/generate', optionalAuthenticate, upload.single('file'), TestCaseController.generate);
router.post('/import/preview', optionalAuthenticate, upload.single('file'), ImportController.preview);
router.post('/import', optionalAuthenticate, upload.single('file'), ImportController.import);
router.get('/suites', optionalAuthenticate, TestCaseController.getSuites);
router.get('/suites/:id', optionalAuthenticate, TestCaseController.getSuiteById);
router.put('/:id', optionalAuthenticate, TestCaseController.updateTestCase);
router.delete('/:id', optionalAuthenticate, TestCaseController.deleteTestCase);

export default router;

