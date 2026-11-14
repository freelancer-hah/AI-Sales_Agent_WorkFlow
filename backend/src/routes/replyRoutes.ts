import { Router } from 'express';
import {
  getReplies,
  getReplyById,
  updateReply,
  generateResponse,
  sendHumanApprovedReply,
  syncInbox,
  getImapStatus,
  testImapConnection,
} from '../controllers/replyController.js';

const router = Router();

router.get('/', getReplies);
router.post('/sync', syncInbox);
router.get('/status', getImapStatus);
router.post('/test-connection', testImapConnection);
router.get('/:id', getReplyById);
router.patch('/:id', updateReply);
router.post('/:id/generate-response', generateResponse);
router.post('/:id/send-reply', sendHumanApprovedReply);

export default router;

