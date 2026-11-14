import { Router } from 'express';
import {
  getCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany,
  reScoreCompany,
  reScoreAllCompanies,
} from '../controllers/companyController.js';
import { triggerScrape, triggerJobScrape } from '../controllers/scrapeController.js';
import { discoverCompanyDecisionMakers } from '../controllers/decisionMakerController.js';

const router = Router();

router.get('/', getCompanies);
router.post('/re-score-all', reScoreAllCompanies);
router.get('/:id', getCompanyById);
router.patch('/:id', updateCompany);
router.delete('/:id', deleteCompany);
router.post('/:id/scrape', triggerScrape);
router.post('/:id/jobs/scrape', triggerJobScrape);
router.post('/:id/decision-makers/discover', discoverCompanyDecisionMakers);
router.post('/:id/re-score', reScoreCompany);

export default router;
