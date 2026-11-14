import { Router } from 'express';
import { exportCsv, exportExcel } from '../controllers/exportController.js';

const router = Router();

router.get('/csv', exportCsv);
router.post('/csv', exportCsv);

router.get('/excel', exportExcel);
router.post('/excel', exportExcel);

export default router;
