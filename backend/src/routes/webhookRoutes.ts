import { Router } from 'express';
import { calWebhookController } from '../controllers/calWebhookController.js';

export const webhookRouter = Router();

// GET /api/v1/webhooks/cal/config - Returns Cal.diy embed and link configuration
webhookRouter.get('/cal/config', calWebhookController.getConfig);

// POST /api/v1/webhooks/cal - Webhook receiver for Cal.diy / Cal.com events
webhookRouter.post('/cal', calWebhookController.handleWebhook);

