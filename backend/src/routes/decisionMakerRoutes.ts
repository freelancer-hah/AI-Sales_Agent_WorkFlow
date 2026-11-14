import { Router } from 'express';
import {
  getDecisionMakers,
  getCompanyDecisionMakers,
  discoverCompanyDecisionMakers,
} from '../controllers/decisionMakerController.js';

const router = Router();

router.get('/', getDecisionMakers);
router.get('/company/:id', getCompanyDecisionMakers);
router.post('/company/:id/discover', discoverCompanyDecisionMakers);

export default router;
