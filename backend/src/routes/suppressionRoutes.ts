import { Router } from 'express';
import {
  getSuppressionList,
  addSuppressedEmail,
  removeSuppressedEmail,
} from '../controllers/suppressionController.js';

const router = Router();

router.get('/', getSuppressionList);
router.post('/', addSuppressedEmail);
router.delete('/:id', removeSuppressedEmail);

export default router;

