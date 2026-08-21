import { Router } from 'express';
import { ExportController } from '../controllers/exportController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/:suiteId/excel', ExportController.exportSuiteExcel);
router.get('/:suiteId/excel/results', authenticate, ExportController.exportSuiteResultsExcel);

export default router;
