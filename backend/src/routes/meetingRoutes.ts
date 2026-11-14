import { Router } from 'express';
import {
  getMeetings,
  getMeetingStats,
  getAvailableSlots,
  getHostAvailability,
  updateHostAvailability,
  proposeSlots,
  getMeetingById,
  createMeeting,
  updateMeetingStatus,
  parseMeetingSlots,
  downloadMeetingIcs,
  generateMeetingInviteDraft,
  rescheduleMeeting,
  cancelMeeting,
  recordMeetingOutcome,
  sendMeetingReminder,
  processDueReminders,
  getMeetingDossier,
  generateMeetingDossier,
} from '../controllers/meetingController.js';

const router = Router();

// Static routes FIRST
router.get('/stats', getMeetingStats);
router.get('/availability/slots', getAvailableSlots);
router.get('/availability/settings', getHostAvailability);
router.put('/availability/settings', updateHostAvailability);
router.post('/propose-slots', proposeSlots);
router.post('/parse-slots', parseMeetingSlots);
router.post('/reminders/process-due', processDueReminders);

// Root collection routes
router.get('/', getMeetings);
router.post('/', createMeeting);

// Dynamic parameterized routes LAST
router.get('/:id', getMeetingById);
router.patch('/:id/status', updateMeetingStatus);
router.get('/:id/ics', downloadMeetingIcs);
router.post('/:id/generate-invite-draft', generateMeetingInviteDraft);
router.post('/:id/reschedule', rescheduleMeeting);
router.post('/:id/cancel', cancelMeeting);
router.post('/:id/outcome', recordMeetingOutcome);
router.post('/:id/remind', sendMeetingReminder);
router.get('/:id/dossier', getMeetingDossier);
router.post('/:id/dossier/generate', generateMeetingDossier);

export default router;

