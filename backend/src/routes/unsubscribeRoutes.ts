import { Router } from 'express';
import {
  showUnsubscribePage,
  processUnsubscribe,
} from '../controllers/unsubscribeController.js';

const router = Router();

router.get('/:token', showUnsubscribePage);
router.post('/:token', processUnsubscribe);

export default router;

