import { Router } from 'express';
import { triggerScrape } from '../controllers/scrapeController.js';

const router = Router();

router.post('/:id/scrape', triggerScrape);

export default router;
