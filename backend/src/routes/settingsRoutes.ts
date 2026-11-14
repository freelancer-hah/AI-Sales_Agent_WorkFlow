import { Router } from 'express';
import { getSettings, getIntegrations } from '../controllers/settingsController.js';

const router = Router();

router.get('/', getSettings);
router.get('/integrations', getIntegrations);

export default router;
