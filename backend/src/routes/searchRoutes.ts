import { Router } from 'express';
import {
  startSearch,
  getSearchJob,
  getSearchHistory,
} from '../controllers/searchController.js';

const router = Router();

router.post('/', startSearch);
router.get('/history', getSearchHistory);
router.get('/:jobId', getSearchJob);

export default router;
