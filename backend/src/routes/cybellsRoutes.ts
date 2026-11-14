import { Router } from 'express';
import { getCybellsConfig, updateCybellsConfig } from '../controllers/cybellsController.js';

const router = Router();

router.get('/config', getCybellsConfig);
router.put('/config', updateCybellsConfig);

export default router;

