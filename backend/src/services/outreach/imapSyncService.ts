import { ImapFlow } from 'imapflow';
import { simpleParser, ParsedMail } from 'mailparser';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { CybellsConfig } from '../../models/CybellsConfig.js';
import { EmailReply, IEmailReplyDocument } from '../../models/EmailReply.js';
import { OutreachMessage } from '../../models/OutreachMessage.js';
import { OutreachContact } from '../../models/OutreachContact.js';
import { Company } from '../../models/Company.js';
import { FollowUpJob } from '../../models/FollowUpJob.js';
import { SuppressionList } from '../../models/SuppressionList.js';
import { replyClassifierService } from './replyClassifierService.js';
import { leadQualificationService } from '../qualification/leadQualificationService.js';

export interface ImapConnectionTestResult {
  success: boolean;
  message: string;
  details?: {
    host: string;
    port: number;
    user: string;
    mailboxCount?: number;
  };
}

export interface ImapSyncSummary {
  success: boolean;
  messagesFetched: number;
  repliesCreated: number;
  bouncesHandled: number;
  errors: string[];
  lastSyncAt: Date;
}

export class ImapSyncService {
  private isSyncing = false;
  private pollingTimer: NodeJS.Timeout | null = null;
  private consecutiveErrors = 0;

  /**
   * Tests the IMAP connection using configured environment credentials.
   */
  public async testConnection(): Promise<ImapConnectionTestResult> {
    if (!env.IMAP_HOST || !env.IMAP_USER || !env.IMAP_PASS) {
      return {
        success: false,
        message: 'IMAP credentials (IMAP_HOST, IMAP_USER, IMAP_PASS) are missing in environment variables.',
      };
    }

    const client = new ImapFlow({
      host: env.IMAP_HOST,
      port: Number(env.IMAP_PORT || 993),
      secure: env.IMAP_PORT ? Number(env.IMAP_PORT) === 993 : true,
      auth: {
        user: env.IMAP_USER,
        pass: env.IMAP_PASS,
      },
      logger: false,
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      const count = client.mailbox ? client.mailbox.exists : 0;
      lock.release();
      await client.logout();

      return {
        success: true,
        message: `Successfully connected to IMAP server (${env.IMAP_HOST}:${env.IMAP_PORT || 993}). Inbox contains ${count} message(s).`,
        details: {
          host: env.IMAP_HOST,
          port: Number(env.IMAP_PORT || 993),
          user: env.IMAP_USER,
          mailboxCount: count,
        },
      };
    } catch (err: any) {
      logger.error('IMAP connection test failed', err);
      return {
        success: false,
        message: `IMAP connection failed: ${err.message || 'Could not authenticate'}`,
        details: {
          host: env.IMAP_HOST,
          port: Number(env.IMAP_PORT || 993),
          user: env.IMAP_USER,
        },
      };
    }
  }

  /**
   * Performs an idempotent sync of the IMAP inbox, processing new replies and bounce notices.
   */
  public async syncInbox(): Promise<ImapSyncSummary> {
    if (this.isSyncing) {
      return {
        success: true,
        messagesFetched: 0,
        repliesCreated: 0,
        bouncesHandled: 0,
        errors: ['Sync already in progress. Skipping duplicate tick.'],
        lastSyncAt: new Date(),
      };
    }

    if (!env.IMAP_HOST || !env.IMAP_USER || !env.IMAP_PASS) {
      return {
        success: false,
        messagesFetched: 0,
        repliesCreated: 0,
        bouncesHandled: 0,
        errors: ['IMAP credentials not configured in environment.'],
        lastSyncAt: new Date(),
      };
    }

    this.isSyncing = true;
    const summary: ImapSyncSummary = {
      success: true,
      messagesFetched: 0,
      repliesCreated: 0,
      bouncesHandled: 0,
      errors: [],
      lastSyncAt: new Date(),
    };

    const client = new ImapFlow({
      host: env.IMAP_HOST,
      port: Number(env.IMAP_PORT || 993),
      secure: env.IMAP_PORT ? Number(env.IMAP_PORT) === 993 : true,
      auth: {
        user: env.IMAP_USER,
        pass: env.IMAP_PASS,
      },
      logger: false,
    });

    let configDoc = await CybellsConfig.getOrCreateConfig();

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');

      try {
        const mailbox = client.mailbox;
        if (!mailbox) {
          throw new Error('Could not open INBOX mailbox');
        }

        const currentUidValidity = String(mailbox.uidValidity);
        let lastUid = configDoc.imapSyncState?.lastUid || 0;

        // If UIDVALIDITY changed (e.g. mailbox rebuilt), reset UID cursor
        if (configDoc.imapSyncState?.uidValidity && configDoc.imapSyncState.uidValidity !== currentUidValidity) {
          logger.warn(`IMAP UIDVALIDITY changed from ${configDoc.imapSyncState.uidValidity} to ${currentUidValidity}. Resetting UID cursor.`);
          lastUid = 0;
        }

        // Query messages: if lastUid is 0, fetch last 50 messages to establish baseline without overloading
        const searchRange = lastUid > 0 ? `${lastUid + 1}:*` : '1:*';
        let highestSeenUid = lastUid;

        // Iterate through messages in the range
        for await (const msg of client.fetch(searchRange, { uid: true, source: true, envelope: true })) {
          // If searchRange was 1:* and mailbox is huge, take the most recent messages
          if (msg.uid <= lastUid) continue;
          if (msg.uid > highestSeenUid) {
            highestSeenUid = msg.uid;
          }

          summary.messagesFetched++;

          try {
            if (!msg.source) continue;
            const parsed: ParsedMail = await simpleParser(msg.source);
            const messageId = parsed.messageId || (parsed.headers.get('message-id') as string) || `uid-${msg.uid}-${Date.now()}`;

            // Check idempotency: skip if already logged
            const existingReply = await EmailReply.findOne({ messageId });
            if (existingReply) continue;

            const existingMsg = await OutreachMessage.findOne({ messageId, direction: 'inbound' });
            if (existingMsg) continue;

            const fromAddress = parsed.from?.value?.[0]?.address?.toLowerCase().trim() || '';
            const toAddress = parsed.to
              ? Array.isArray(parsed.to)
                ? parsed.to[0]?.value?.[0]?.address || ''
                : parsed.to.value?.[0]?.address || ''
              : '';
            const subject = parsed.subject || 'No Subject';
            const body = parsed.text || (typeof parsed.html === 'string' ? parsed.html.replace(/<[^>]+>/g, '') : '') || '';
            const receivedDate = parsed.date || new Date();

            // Extract In-Reply-To and References
            const inReplyTo = (parsed.inReplyTo || (parsed.headers.get('in-reply-to') as string) || '').trim();
            const rawReferences = parsed.references || (parsed.headers.get('references') as any) || [];
            const referencesArray: string[] = Array.isArray(rawReferences)
              ? rawReferences.map(String)
              : typeof rawReferences === 'string'
              ? rawReferences.split(/\s+/)
              : [];

            // 1. Check if this is a Bounce / Non-Delivery Report
            if (this.isBounceMessage(fromAddress, subject, body)) {
              await this.handleBounce(fromAddress, subject, body, inReplyTo, referencesArray);
              summary.bouncesHandled++;
              continue;
            }

            // 2. Thread Matching
            const match = await this.correlateReply({
              fromAddress,
              inReplyTo,
              references: referencesArray,
            });

            // Only process emails that are connected to outreach campaigns or enrolled contacts
            if (!match.contact && !match.matchedMessage) {
              continue;
            }

            // 3. Classify reply sentiment and generate suggested reply draft
            const classificationResult = await replyClassifierService.classifyAndSuggestReply({
              subject,
              body,
              originalOutboundSubject: match.matchedMessage?.subject,
              originalOutboundBody: match.matchedMessage?.bodyText,
              prospectName: match.contact?.contactName,
              companyName: match.company?.companyName,
            });

            // 4. Create EmailReply document
            const newReply = new EmailReply({
              contactId: match.contact?._id,
              companyId: match.company?._id,
              campaignId: match.matchedMessage?.campaignId,
              threadId: match.matchedMessage?.threadId || messageId,
              messageId,
              senderEmail: fromAddress || 'unknown@domain.com',
              recipientEmail: toAddress || env.IMAP_USER,
              subject,
              body,
              receivedAt: receivedDate,
              classification: classificationResult.classification,
              suggestedReplyDraft: classificationResult.suggestedReplyDraft || '',
              isRead: false,
            });

            await newReply.save();

            // 5. Create inbound OutreachMessage log
            const inboundMessage = new OutreachMessage({
              campaignId: match.matchedMessage?.campaignId,
              contactId: match.contact?._id || newReply._id, // fallback ID
              direction: 'inbound',
              senderEmail: fromAddress,
              recipientEmail: toAddress || env.IMAP_USER,
              subject,
              bodyHtml: typeof parsed.html === 'string' ? parsed.html : `<p>${body.replace(/\n/g, '<br/>')}</p>`,
              bodyText: body,
              status: 'delivered',
              messageId,
              inReplyTo,
              references: referencesArray,
              threadId: match.matchedMessage?.threadId || messageId,
              sentAt: receivedDate,
              sandboxRedirected: false,
            });
            await inboundMessage.save();

            // 6. Execute Business Automation Triggers
            if (match.contact) {
              await this.executeTriggers(match.contact, match.company, classificationResult.classification);
            }

            summary.repliesCreated++;
          } catch (itemErr: any) {
            logger.error(`Error processing IMAP message UID ${msg.uid}`, itemErr);
            summary.errors.push(`UID ${msg.uid}: ${itemErr.message}`);
          }
        }

        // Update sync cursor in CybellsConfig
        await CybellsConfig.updateOne(
          { _id: configDoc._id },
          {
            $set: {
              'imapSyncState.lastSyncAt': new Date(),
              'imapSyncState.lastUid': highestSeenUid,
              'imapSyncState.uidValidity': currentUidValidity,
              'imapSyncState.status': 'idle',
              'imapSyncState.lastError': '',
            },
            $inc: {
              'imapSyncState.processedCount': summary.repliesCreated,
            },
          }
        );

        this.consecutiveErrors = 0;
      } finally {
        lock.release();
      }

      await client.logout();
    } catch (syncErr: any) {
      this.consecutiveErrors++;
      logger.error('IMAP Sync iteration failed', syncErr);
      summary.success = false;
      summary.errors.push(syncErr.message);

      await CybellsConfig.updateOne(
        { _id: configDoc._id },
        {
          $set: {
            'imapSyncState.status': 'error',
            'imapSyncState.lastError': syncErr.message || 'IMAP Sync Error',
          },
        }
      );
    } finally {
      this.isSyncing = false;
    }

    return summary;
  }

  /**
   * Starts periodic polling in the background (default: 60s).
   */
  public startPolling(intervalMs = 60000): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
    }

    logger.info(`Starting IMAP Sync Polling Worker (Interval: ${intervalMs / 1000}s)`);

    // Run first sync immediately after 5s
    setTimeout(() => {
      this.syncInbox().catch((err) => logger.warn('Initial IMAP sync failed', err));
    }, 5000);

    this.pollingTimer = setInterval(() => {
      // Exponential backoff if consecutive errors occur
      if (this.consecutiveErrors > 5) {
        logger.warn('IMAP sync paused temporarily due to repeated errors. Will retry after extended delay.');
        return;
      }

      this.syncInbox().catch((err) => logger.warn('Periodic IMAP sync failed', err));
    }, intervalMs);
  }

  public stopPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      logger.info('IMAP Sync Polling Worker stopped.');
    }
  }

  /**
   * Detects bounce / Non-Delivery Report emails.
   */
  private isBounceMessage(from: string, subject: string, body: string): boolean {
    const bounceFrom = ['mailer-daemon@', 'postmaster@', 'mail-daemon@'];
    const bounceKeywords = [
      'delivery status notification (failure)',
      'undelivered mail returned to sender',
      'failure notice',
      'mail delivery subsystem',
      'returned mail:',
      'message could not be delivered',
      '550 5.1.1',
    ];

    const isFromBounce = bounceFrom.some((bf) => from.includes(bf));
    const combined = `${subject} ${body}`.toLowerCase();
    const hasBounceKeyword = bounceKeywords.some((bk) => combined.includes(bk));

    return isFromBounce || hasBounceKeyword;
  }

  /**
   * Handles a detected bounce by identifying the recipient and marking them bounced.
   */
  private async handleBounce(
    from: string,
    subject: string,
    body: string,
    inReplyTo: string,
    references: string[]
  ): Promise<void> {
    logger.warn(`Processing bounce notice from ${from}: "${subject}"`);

    // Try finding via In-Reply-To
    let originalMessage = inReplyTo ? await OutreachMessage.findOne({ messageId: inReplyTo }) : null;
    if (!originalMessage && references.length > 0) {
      originalMessage = await OutreachMessage.findOne({ messageId: { $in: references } });
    }

    if (originalMessage?.contactId) {
      const contact = await OutreachContact.findById(originalMessage.contactId);
      if (contact) {
        contact.validationStatus = 'bounced';
        contact.outreachStatus = 'bounced';
        await contact.save();

        // Cancel all pending follow-up jobs for this bounced contact
        await FollowUpJob.updateMany(
          { contactId: contact._id, status: 'scheduled' },
          { $set: { status: 'cancelled' } }
        );
        logger.info(`Marked contact ${contact.email} as bounced and cancelled follow-up jobs.`);
      }
    }
  }

  /**
   * Correlates an incoming reply to an existing contact and company.
   */
  private async correlateReply(params: {
    fromAddress: string;
    inReplyTo?: string;
    references?: string[];
  }): Promise<{
    matchedMessage?: any;
    contact?: any;
    company?: any;
  }> {
    // Strategy 1: Match by In-Reply-To or References messageId
    const candidateIds: string[] = [];
    if (params.inReplyTo) candidateIds.push(params.inReplyTo);
    if (params.references && params.references.length > 0) {
      candidateIds.push(...params.references);
    }

    if (candidateIds.length > 0) {
      const matchedMsg = await OutreachMessage.findOne({
        messageId: { $in: candidateIds },
        direction: 'outbound',
      });

      if (matchedMsg) {
        const contact = await OutreachContact.findById(matchedMsg.contactId);
        const company = contact?.companyId ? await Company.findById(contact.companyId) : null;
        return { matchedMessage: matchedMsg, contact, company };
      }
    }

    // Strategy 2: Match by Sender Email address
    if (params.fromAddress) {
      const contact = await OutreachContact.findOne({
        normalizedEmail: params.fromAddress.toLowerCase().trim(),
      });

      if (contact) {
        const company = await Company.findById(contact.companyId);
        const matchedMsg = await OutreachMessage.findOne({
          contactId: contact._id,
          direction: 'outbound',
        }).sort({ sentAt: -1 });

        return { matchedMessage: matchedMsg, contact, company };
      }

      // Strategy 3: Fallback match by email domain to Company website/domain
      const domainMatch = params.fromAddress.split('@')[1];
      if (domainMatch && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'].includes(domainMatch)) {
        const company = await Company.findOne({
          $or: [
            { website: new RegExp(domainMatch, 'i') },
            { emails: new RegExp(`@${domainMatch}`, 'i') },
          ],
        });

        if (company) {
          return { company };
        }
      }
    }

    return {};
  }

  /**
   * Executes business triggers based on the classified reply intent.
   */
  private async executeTriggers(
    contact: any,
    company: any,
    classification: string
  ): Promise<void> {
    contact.lastContactedAt = new Date();
    contact.outreachStatus = 'replied';
    await contact.save();

    // 1. High-Value Conversion Intent: interested, meeting_request, price_inquiry
    if (['interested', 'meeting_request', 'price_inquiry'].includes(classification)) {
      if (company) {
        company.leadStatus = 'interested';
        company.handoffToQualification = true;
        await company.save();
      }

      // Stop all future automated follow-ups immediately
      await FollowUpJob.updateMany(
        { contactId: contact._id, status: 'scheduled' },
        { $set: { status: 'cancelled' } }
      );
      logger.info(`Prospect ${contact.email} is interested (${classification}). Set handoffToQualification=true and cancelled follow-up sequence.`);

      // Automatically enroll into Phase 3 Lead Qualification
      try {
        await leadQualificationService.startQualification({
          contactId: contact._id.toString(),
          sourceType: 'email',
          actor: 'ai',
          actorName: 'IMAP Reply Classifier',
          allowManual: false,
        });
        logger.info(`Auto-started Phase 3 Lead Qualification for ${contact.email}`);
      } catch (qualErr: any) {
        logger.warn(`Could not auto-start qualification for ${contact.email}: ${qualErr.message}`);
      }
    }

    // 2. Unsubscribe Intent: immediate suppression & job cancellation
    else if (classification === 'unsubscribe') {
      await SuppressionList.findOneAndUpdate(
        { email: contact.email.toLowerCase().trim() },
        {
          email: contact.email.toLowerCase().trim(),
          reason: 'reply_unsubscribe',
          source: 'imap_reply_listener',
        },
        { upsert: true, new: true }
      );

      contact.suppressionStatus = {
        isSuppressed: true,
        reason: 'opt-out',
        suppressedAt: new Date(),
      };
      contact.outreachStatus = 'suppressed';
      await contact.save();

      await FollowUpJob.updateMany(
        { contactId: contact._id, status: 'scheduled' },
        { $set: { status: 'cancelled' } }
      );
      logger.info(`Prospect ${contact.email} requested unsubscribe. Contact suppressed and follow-ups cancelled.`);
    }

    // 3. Out of Office: Delay next follow-up by 5 days
    else if (classification === 'out_of_office') {
      const nextJob = await FollowUpJob.findOne({
        contactId: contact._id,
        status: 'scheduled',
      }).sort({ scheduledAt: 1 });

      if (nextJob) {
        const delayedDate = new Date(nextJob.scheduledAt.getTime() + 5 * 24 * 60 * 60 * 1000);
        nextJob.scheduledAt = delayedDate;
        await nextJob.save();
        logger.info(`Out of office reply from ${contact.email}. Pushed next follow-up to ${delayedDate.toISOString()}`);
      }
    }

    // 4. Not Interested: Stop follow-ups
    else if (classification === 'not_interested') {
      await FollowUpJob.updateMany(
        { contactId: contact._id, status: 'scheduled' },
        { $set: { status: 'cancelled' } }
      );
      contact.outreachStatus = 'not_interested';
      await contact.save();
      logger.info(`Prospect ${contact.email} declined. Cancelled follow-up sequence.`);
    }
  }
}

export const imapSyncService = new ImapSyncService();
