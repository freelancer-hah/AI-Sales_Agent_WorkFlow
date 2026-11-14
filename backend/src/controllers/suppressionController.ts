import { Request, Response } from 'express';
import { SuppressionList, SuppressionReason } from '../models/SuppressionList.js';
import { contactValidationService } from '../services/outreach/contactValidationService.js';
import { logger } from '../config/logger.js';

export const getSuppressionList = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (req.query.reason) {
      filter.reason = req.query.reason;
    }

    if (req.query.search) {
      filter.email = new RegExp(String(req.query.search).trim(), 'i');
    }

    const [entries, total] = await Promise.all([
      SuppressionList.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SuppressionList.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        entries,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (error: any) {
    logger.error('Failed to get suppression list', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch suppression list' },
    });
  }
};

export const addSuppressedEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, emails, reason = 'manual_suppression', source = 'manual' } = req.body;

    const validReasons: SuppressionReason[] = [
      'unsubscribe',
      'hard_bounce',
      'manual_suppression',
      'spam_complaint',
    ];

    if (!validReasons.includes(reason as SuppressionReason)) {
      res.status(400).json({
        success: false,
        error: { message: `Invalid suppression reason. Allowed: ${validReasons.join(', ')}` },
      });
      return;
    }

    const listToProcess: string[] = [];
    if (typeof email === 'string' && email.trim()) {
      listToProcess.push(email.trim());
    }
    if (Array.isArray(emails) && emails.length > 0) {
      for (const em of emails) {
        if (typeof em === 'string' && em.trim()) {
          listToProcess.push(em.trim());
        }
      }
    }

    if (listToProcess.length === 0) {
      res.status(400).json({
        success: false,
        error: { message: 'Please provide an email or list of emails to suppress.' },
      });
      return;
    }

    let totalContactsUpdated = 0;
    let totalJobsCancelled = 0;
    let totalMessagesCancelled = 0;
    const processedEmails: string[] = [];

    for (const em of listToProcess) {
      const result = await contactValidationService.suppressEmail(
        em,
        reason as SuppressionReason,
        source
      );
      totalContactsUpdated += result.contactsUpdated;
      totalJobsCancelled += result.jobsCancelled;
      totalMessagesCancelled += result.messagesCancelled;
      processedEmails.push(result.suppressedEmail);
    }

    logger.info(`Successfully processed ${processedEmails.length} suppression entries`, {
      reason,
      totalContactsUpdated,
      totalJobsCancelled,
      totalMessagesCancelled,
    });

    res.json({
      success: true,
      message: `Suppressed ${processedEmails.length} email(s) successfully. Cancelled ${totalJobsCancelled} pending jobs and ${totalMessagesCancelled} scheduled messages.`,
      data: {
        suppressedCount: processedEmails.length,
        contactsUpdated: totalContactsUpdated,
        jobsCancelled: totalJobsCancelled,
        messagesCancelled: totalMessagesCancelled,
        emails: processedEmails,
      },
    });
  } catch (error: any) {
    logger.error('Failed to add email to suppression list', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to add suppression entry' },
    });
  }
};

export const removeSuppressedEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if id is an ObjectId or email
    let targetEmail: string | undefined;

    const entry = await SuppressionList.findById(id).lean();
    if (entry) {
      targetEmail = entry.email;
    } else {
      // Treat id as raw email
      targetEmail = id;
    }

    if (!targetEmail) {
      res.status(404).json({
        success: false,
        error: { message: 'Suppression entry not found' },
      });
      return;
    }

    const removed = await contactValidationService.unsuppressEmail(targetEmail);

    if (!removed) {
      res.status(404).json({
        success: false,
        error: { message: `Email ${targetEmail} is not in the suppression list.` },
      });
      return;
    }

    res.json({
      success: true,
      message: `Email ${targetEmail} successfully removed from suppression list and reactivated.`,
    });
  } catch (error: any) {
    logger.error('Failed to remove suppressed email', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to remove suppression entry' },
    });
  }
};

