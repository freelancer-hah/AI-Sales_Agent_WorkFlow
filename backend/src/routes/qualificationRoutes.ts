import { Router } from 'express';
import {
  listQualifications,
  getQualificationById,
  checkEligibility,
  startQualification,
  updateQualification,
  updateQualificationStatus,
  extractInformation,
  generateQuestion,
  generateDraft,
  listQuestions,
  updateQuestion,
  scoreQualification,
  submitReview,
  handoffQualification,
  exportSingleHandoffJson,
  exportQualificationsCsv,
} from '../controllers/qualificationController.js';

const router = Router();

// Milestone 4 Global Exports
router.get('/export/csv', exportQualificationsCsv);

// Milestone 1 Routes
router.get('/', listQualifications);
router.get('/check-eligibility/:contactId', checkEligibility);
router.get('/:id', getQualificationById);
router.post('/start', startQualification);
router.patch('/:id', updateQualification);
router.patch('/:id/status', updateQualificationStatus);

// Milestone 2 Conversational Qualification & Extraction Routes
router.post('/:id/extract', extractInformation);
router.post('/:id/generate-question', generateQuestion);
router.post('/:id/generate-draft', generateDraft);
router.get('/:id/questions', listQuestions);
router.patch('/:id/questions/:questionId', updateQuestion);

// Milestone 3 AI Scoring & Human Review Routes
router.post('/:id/score', scoreQualification);
router.post('/:id/review', submitReview);

// Milestone 4 Sales Handoff & Export Routes
router.post('/:id/handoff', handoffQualification);
router.get('/:id/export', exportSingleHandoffJson);

export default router;

