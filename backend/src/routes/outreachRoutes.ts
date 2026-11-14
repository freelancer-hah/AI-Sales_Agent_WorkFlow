import { Router } from 'express';
import {
  getOutreachContacts,
  selectContactsForOutreach,
  updateOutreachContact,
} from '../controllers/outreachContactController.js';
import {
  generateDraft,
  getDrafts,
  getDraftById,
  updateDraft,
  deleteDraft,
} from '../controllers/emailDraftController.js';
import {
  getOutreachMessages,
  sendSingleApprovedMessage,
} from '../controllers/campaignController.js';

const router = Router();

// Contacts
router.get('/contacts', getOutreachContacts);
router.post('/contacts/select', selectContactsForOutreach);
router.patch('/contacts/:id', updateOutreachContact);

// Drafts
router.post('/drafts/generate', generateDraft);
router.get('/drafts', getDrafts);
router.get('/drafts/:id', getDraftById);
router.patch('/drafts/:id', updateDraft);
router.delete('/drafts/:id', deleteDraft);

// Messages & Dispatch
router.get('/messages', getOutreachMessages);
router.post('/send-single', sendSingleApprovedMessage);

export default router;

