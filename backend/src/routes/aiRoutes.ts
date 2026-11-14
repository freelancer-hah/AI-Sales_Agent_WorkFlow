import { Router } from 'express';
import { analyzeCompany, getCompanyAnalysis } from '../controllers/aiController.js';

const router = Router();

router.post('/:id/analyze', analyzeCompany);
router.get('/:id/analysis', getCompanyAnalysis);

export default router;
