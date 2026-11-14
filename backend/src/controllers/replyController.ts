import { Request, Response } from 'express';
import { EmailReply } from '../models/EmailReply.js';
import { OutreachMessage } from '../models/OutreachMessage.js';
import { OutreachContact } from '../models/OutreachContact.js';
import { Company } from '../models/Company.js';
import { CybellsConfig } from '../models/CybellsConfig.js';
import { SuppressionList } from '../models/SuppressionList.js';
import { imapSyncService } from '../services/outreach/imapSyncService.js';
import { replyClassifierService } from '../services/outreach/replyClassifierService.js';
import { getEmailTransport } from '../services/outreach/emailTransport.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export const getReplies = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 15));
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (req.query.classification) {
      filter.classification = req.query.classification;
    }

    if (req.query.isRead !== undefined) {
      filter.isRead = req.query.isRead === 'true';
    }

    if (req.query.reviewed !== undefined) {
      filter.reviewedAt = req.query.reviewed === 'true' ? { $ne: null } : null;
    }

    if (req.query.companyId) {
      filter.companyId = req.query.companyId;
    }

    if (req.query.search) {
      const searchRegex = new RegExp(String(req.query.search).trim(), 'i');
      filter.$or = [
        { subject: searchRegex },
        { senderEmail: searchRegex },
        { body: searchRegex },
      ];
    }

    const [replies, total, unreadCount, interestedCount] = await Promise.all([
      EmailReply.find(filter)
        .populate('contactId', 'contactName jobTitle email validationStatus outreachStatus')
        .populate('companyId', 'companyName industry city country website leadStatus')
        .populate('campaignId', 'name')
        .sort({ receivedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      EmailReply.countDocuments(filter),
      EmailReply.countDocuments({ isRead: false }),
      EmailReply.countDocuments({ classification: { $in: ['interested', 'meeting_request', 'price_inquiry'] } }),
    ]);

    res.json({
      success: true,
      data: {
        replies,
        stats: {
          total,
          unreadCount,
          interestedCount,
        },
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (error: any) {
    logger.error('Failed to get replies', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to retrieve replies' },
    });
  }
};

export const getReplyById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const reply = await EmailReply.findById(id)
      .populate('contactId')
      .populate('companyId')
      .populate('campaignId');

    if (!reply) {
      res.status(404).json({
        success: false,
        error: { message: 'Reply not found' },
      });
      return;
    }

    // Auto mark as read on view
    if (!reply.isRead) {
      reply.isRead = true;
      await reply.save();
    }

    // Retrieve conversation history / message logs for this thread or contact
    let threadMessages: any[] = [];
    if (reply.threadId) {
      threadMessages = await OutreachMessage.find({ threadId: reply.threadId })
        .sort({ sentAt: 1, createdAt: 1 })
        .lean();
    } else if (reply.contactId) {
      threadMessages = await OutreachMessage.find({ contactId: reply.contactId })
        .sort({ sentAt: 1, createdAt: 1 })
        .lean();
    }

    res.json({
      success: true,
      data: {
        reply,
        threadMessages,
      },
    });
  } catch (error: any) {
    logger.error(`Failed to get reply ${req.params.id}`, error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to get reply details' },
    });
  }
};

export const updateReply = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { classification, isRead, isReviewed, suggestedReplyDraft } = req.body;

    const reply = await EmailReply.findById(id);
    if (!reply) {
      res.status(404).json({
        success: false,
        error: { message: 'Reply not found' },
      });
      return;
    }

    if (classification) {
      reply.classification = classification;

      // Handle category side-effects
      if (['interested', 'meeting_request', 'price_inquiry'].includes(classification) && reply.companyId) {
        await Company.updateOne(
          { _id: reply.companyId },
          { $set: { leadStatus: 'interested', handoffToQualification: true } }
        );
      } else if (classification === 'unsubscribe' && reply.contactId) {
        const contact = await OutreachContact.findById(reply.contactId);
        if (contact) {
          await SuppressionList.findOneAndUpdate(
            { email: contact.email.toLowerCase().trim() },
            {
              email: contact.email.toLowerCase().trim(),
              reason: 'reply_unsubscribe',
              source: 'reply_category_update',
            },
            { upsert: true }
          );
          contact.suppressionStatus = {
            isSuppressed: true,
            reason: 'opt-out',
            suppressedAt: new Date(),
          };
          contact.outreachStatus = 'suppressed';
          await contact.save();
        }
      }
    }

    if (isRead !== undefined) {
      reply.isRead = Boolean(isRead);
    }

    if (isReviewed !== undefined) {
      reply.reviewedAt = isReviewed ? new Date() : undefined;
    }

    if (typeof suggestedReplyDraft === 'string') {
      reply.suggestedReplyDraft = suggestedReplyDraft;
    }

    await reply.save();

    res.json({
      success: true,
      message: 'Reply updated successfully',
      data: { reply },
    });
  } catch (error: any) {
    logger.error(`Failed to update reply ${req.params.id}`, error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to update reply' },
    });
  }
};

export const generateResponse = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const reply = await EmailReply.findById(id).populate('contactId').populate('companyId');

    if (!reply) {
      res.status(404).json({
        success: false,
        error: { message: 'Reply not found' },
      });
      return;
    }

    const contact = reply.contactId as any;
    const company = reply.companyId as any;

    const result = await replyClassifierService.classifyAndSuggestReply({
      subject: reply.subject,
      body: reply.body,
      prospectName: contact?.contactName,
      companyName: company?.companyName,
    });

    reply.suggestedReplyDraft = result.suggestedReplyDraft || reply.suggestedReplyDraft || '';
    if (result.classification && reply.classification === 'unclear') {
      reply.classification = result.classification;
    }
    await reply.save();

    res.json({
      success: true,
      message: 'Generated grounded AI suggested response successfully',
      data: {
        reply,
        classification: result.classification,
        reasoning: result.reasoning,
        suggestedReplyDraft: reply.suggestedReplyDraft,
      },
    });
  } catch (error: any) {
    logger.error(`Failed to generate suggested response for reply ${req.params.id}`, error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to generate response' },
    });
  }
};

export const sendHumanApprovedReply = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { subject, bodyText, bodyHtml } = req.body;

    if (!subject || (!bodyText && !bodyHtml)) {
      res.status(400).json({
        success: false,
        error: { message: 'Subject and body are required to send reply.' },
      });
      return;
    }

    const reply = await EmailReply.findById(id).populate('contactId');
    if (!reply) {
      res.status(404).json({
        success: false,
        error: { message: 'Reply not found' },
      });
      return;
    }

    const recipient = reply.senderEmail;
    const textContent = bodyText || bodyHtml.replace(/<[^>]+>/g, '');
    const htmlContent = bodyHtml || `<p>${textContent.replace(/\n/g, '<br/>')}</p>`;

    // Transmit via configured EmailTransport
    const transport = getEmailTransport();
    const sendResult = await transport.sendMail({
      to: recipient,
      subject,
      text: textContent,
      html: htmlContent,
      inReplyTo: reply.messageId,
      references: reply.messageId ? [reply.messageId] : [],
    });

    // Log outbound message
    const outboundMsg = new OutreachMessage({
      campaignId: reply.campaignId,
      contactId: reply.contactId?._id || reply._id,
      direction: 'outbound',
      senderEmail: env.SENDER_EMAIL || env.SMTP_USER,
      recipientEmail: recipient,
      subject,
      bodyHtml: htmlContent,
      bodyText: textContent,
      status: 'sent',
      messageId: sendResult.messageId,
      inReplyTo: reply.messageId,
      references: reply.messageId ? [reply.messageId] : [],
      threadId: reply.threadId || reply.messageId,
      sentAt: new Date(),
      sandboxRedirected: sendResult.sandboxRedirected,
    });
    await outboundMsg.save();

    // Mark reply as reviewed
    reply.reviewedAt = new Date();
    await reply.save();

    res.json({
      success: true,
      message: sendResult.sandboxRedirected
        ? `Reply dispatched in SANDBOX mode to ${env.SANDBOX_INBOX}!`
        : `Reply sent successfully to ${recipient}!`,
      data: {
        messageId: sendResult.messageId,
        sandboxRedirected: sendResult.sandboxRedirected,
        recipient: sendResult.finalRecipient,
      },
    });
  } catch (error: any) {
    logger.error(`Failed to send approved reply for reply ${req.params.id}`, error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to dispatch reply' },
    });
  }
};

export const syncInbox = async (_req: Request, res: Response): Promise<void> => {
  try {
    const summary = await imapSyncService.syncInbox();
    res.json({
      success: summary.success,
      message: `IMAP Sync completed: ${summary.messagesFetched} message(s) inspected, ${summary.repliesCreated} reply/replies imported, ${summary.bouncesHandled} bounce(s) handled.`,
      data: summary,
    });
  } catch (error: any) {
    logger.error('Failed to trigger manual IMAP sync', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to sync inbox' },
    });
  }
};

export const getImapStatus = async (_req: Request, res: Response): Promise<void> => {
  try {
    const config = await CybellsConfig.findOne().lean();
    const isConfigured = Boolean(env.IMAP_HOST && env.IMAP_USER && env.IMAP_PASS);

    res.json({
      success: true,
      data: {
        configured: isConfigured,
        host: env.IMAP_HOST || '',
        port: env.IMAP_PORT || 993,
        user: env.IMAP_USER || '',
        syncState: config?.imapSyncState || {
          lastSyncAt: null,
          lastUid: 0,
          status: 'idle',
          lastError: '',
          processedCount: 0,
        },
      },
    });
  } catch (error: any) {
    logger.error('Failed to get IMAP status', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to get IMAP status' },
    });
  }
};

export const testImapConnection = async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await imapSyncService.testConnection();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'IMAP connection test failed',
    });
  }
};

