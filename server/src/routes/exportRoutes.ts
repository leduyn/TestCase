import { Router } from 'express';
import { ExportController } from '../controllers/exportController';

const router = Router();

router.get('/:suiteId/excel', ExportController.exportSuiteExcel);

export default router;
