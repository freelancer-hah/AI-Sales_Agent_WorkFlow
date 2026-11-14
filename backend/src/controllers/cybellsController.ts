import { Request, Response } from 'express';
import { CybellsConfig } from '../models/CybellsConfig.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export const getCybellsConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const config = await CybellsConfig.getOrCreateConfig();
    
    // Provide diagnostic indicator of SMTP & IMAP configuration without exposing credentials
    const transportStatus = {
      sendMode: env.SEND_MODE,
      sandboxInbox: env.SANDBOX_INBOX,
      smtpConfigured: Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS),
      smtpHost: env.SMTP_HOST,
      smtpPort: env.SMTP_PORT,
      imapConfigured: Boolean(env.IMAP_HOST && env.IMAP_USER && env.IMAP_PASS),
      imapHost: env.IMAP_HOST,
      imapPort: env.IMAP_PORT,
      defaultSenderName: env.SENDER_NAME,
      defaultSenderEmail: env.SENDER_EMAIL,
    };

    res.json({
      success: true,
      data: config,
      transportStatus,
    });
  } catch (error: any) {
    logger.error('Failed to get Cybells configuration', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to retrieve Cybells configuration' },
    });
  }
};

export const updateCybellsConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const config = await CybellsConfig.getOrCreateConfig();

    const allowedFields = [
      'agencyName',
      'mission',
      'targetAudience',
      'brandVoice',
      'capabilities',
      'caseStudies',
      'faqs',
      'securityPrivacyStatement',
      'senderName',
      'signature',
      'optOutText',
      'postalAddress',
      'sendingRules',
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        (config as any)[field] = req.body[field];
      }
    }

    await config.save();
    logger.info('Cybells configuration updated successfully');

    res.json({
      success: true,
      message: 'Cybells configuration updated successfully',
      data: config,
    });
  } catch (error: any) {
    logger.error('Failed to update Cybells configuration', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to update Cybells configuration' },
    });
  }
};

