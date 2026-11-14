import { Router } from 'express';
import {
  createCampaign,
  getCampaigns,
  getCampaignById,
  updateCampaign,
  launchCampaign,
  pauseCampaign,
  resumeCampaign,
  cancelCampaign,
} from '../controllers/campaignController.js';

const router = Router();

router.post('/', createCampaign);
router.get('/', getCampaigns);
router.get('/:id', getCampaignById);
router.patch('/:id', updateCampaign);
router.post('/:id/launch', launchCampaign);
router.post('/:id/pause', pauseCampaign);
router.post('/:id/resume', resumeCampaign);
router.post('/:id/cancel', cancelCampaign);

export default router;

