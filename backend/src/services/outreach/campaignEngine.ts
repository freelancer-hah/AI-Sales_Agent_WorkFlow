import { Types } from 'mongoose';
import { Campaign, ICampaignDocument, ICampaignSequenceStep } from '../../models/Campaign.js';
import { OutreachMessage, IOutreachMessageDocument } from '../../models/OutreachMessage.js';
import { FollowUpJob, IFollowUpJobDocument } from '../../models/FollowUpJob.js';
import { OutreachContact } from '../../models/OutreachContact.js';
import { EmailDraft } from '../../models/EmailDraft.js';
import { getEmailTransport, SendMailResult } from './emailTransport.js';
import { sendingSafetyService } from './sendingSafetyService.js';
import { unsubscribeService } from './unsubscribeService.js';
import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';

export interface LaunchCampaignResult {
  campaignId: string;
  totalContacts: number;
  scheduledMessages: number;
  scheduledFollowUpJobs: number;
  skippedContacts: Array<{ contactId: string; reason: string }>;
}

export class CampaignEngine {
  /**
   * Returns default multi-step campaign sequence steps:
   * Step 0: Intro (Day 0)
   * Step 1: Follow-Up 1 (Day 3)
   * Step 2: Follow-Up 2 (Day 7)
   * Step 3: Break-up (Day 12)
   */
  public getDefaultSequence(): ICampaignSequenceStep[] {
    return [
      { step: 0, dayOffset: 0, subject: '', body: '' },
      { step: 1, dayOffset: 3, subject: 'Quick follow up regarding our previous note', body: '' },
      { step: 2, dayOffset: 7, subject: 'Following up on AI automation workflow', body: '' },
      { step: 3, dayOffset: 12, subject: 'Closing the loop on workflow automation', body: '' },
    ];
  }

  /**
   * Launches or schedules a campaign.
   * Validates human approval on drafts (Golden Rule 2.4), schedules Step 0 messages,
   * and creates queued FollowUpJobs for future steps.
   */
  public async launchCampaign(campaignId: string, startDate?: Date): Promise<LaunchCampaignResult> {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found.`);
    }

    if (campaign.status === 'cancelled') {
      throw new Error('Cannot launch a cancelled campaign.');
    }

    const start = startDate || campaign.schedule?.startDate || new Date();
    const skippedContacts: Array<{ contactId: string; reason: string }> = [];
    let scheduledMessages = 0;
    let scheduledFollowUpJobs = 0;

    const sequence = campaign.sequence && campaign.sequence.length > 0
      ? campaign.sequence
      : this.getDefaultSequence();

    for (const contactId of campaign.selectedContacts) {
      // 1. Locate approved draft for this contact (sequenceStep 0), prioritizing approved drafts
      let draft = await EmailDraft.findOne({
        contactId,
        sequenceStep: 0,
        approvalStatus: 'approved',
      }).sort({ updatedAt: -1, createdAt: -1 });

      if (!draft) {
        // Fallback: check if an unapproved draft exists
        const unapproved = await EmailDraft.findOne({
          contactId,
          sequenceStep: 0,
        }).sort({ updatedAt: -1, createdAt: -1 });

        if (unapproved) {
          skippedContacts.push({
            contactId: contactId.toString(),
            reason: `Draft is in "${unapproved.approvalStatus}" status. Outbound emails strictly require human approval.`,
          });
        } else {
          skippedContacts.push({
            contactId: contactId.toString(),
            reason: 'No email draft has been generated for this contact yet.',
          });
        }
        continue;
      }

      // 2. Pre-send safety check
      const safetyCheck = await sendingSafetyService.validatePreSendEligibility(
        contactId.toString(),
        draft._id.toString()
      );

      if (!safetyCheck.eligible || !safetyCheck.contact) {
        skippedContacts.push({
          contactId: contactId.toString(),
          reason: safetyCheck.reason || 'Contact failed pre-send eligibility check.',
        });
        continue;
      }

      const contact = safetyCheck.contact;

      // 3. Create or update Step 0 OutreachMessage
      let initialMessage = await OutreachMessage.findOne({
        campaignId: campaign._id,
        contactId: contact._id,
        draftId: draft._id,
      });

      if (!initialMessage) {
        initialMessage = new OutreachMessage({
          campaignId: campaign._id,
          contactId: contact._id,
          draftId: draft._id,
          direction: 'outbound',
          senderEmail: env.SENDER_EMAIL || 'outreach@cybells.ai',
          recipientEmail: contact.email,
          subject: draft.subject,
          bodyHtml: draft.bodyHtml,
          bodyText: draft.bodyText,
          status: 'scheduled',
          scheduledFor: start,
          sandboxRedirected: env.SEND_MODE === 'sandbox',
          framework: draft.framework,
          subjectVariantUsed: draft.subjectVariantUsed,
          matchedCapability: draft.matchedCapability,
          industry: draft.industry,
          country: draft.country,
        });

        await initialMessage.save();
        scheduledMessages++;

        // In sandbox mode, dispatch Step 0 immediately so user receives test email right away
        if (env.SEND_MODE === 'sandbox') {
          try {
            await this.dispatchMessage(initialMessage._id.toString());
          } catch (dispErr) {
            logger.warn('Immediate sandbox dispatch deferred to scheduler worker', dispErr);
          }
        }
      }

      // 4. Create FollowUpJobs for subsequent sequence steps (Step 1, Step 2, Step 3)
      for (const stepConfig of sequence) {
        if (stepConfig.step === 0) continue; // Step 0 is the initial message

        const stepScheduledAt = new Date(start.getTime() + stepConfig.dayOffset * 24 * 60 * 60 * 1000);

        await FollowUpJob.findOneAndUpdate(
          {
            campaignId: campaign._id,
            contactId: contact._id,
            sequenceStep: stepConfig.step,
          },
          {
            scheduledAt: stepScheduledAt,
            status: 'scheduled',
            error: '',
          },
          { upsert: true, new: true }
        );

        scheduledFollowUpJobs++;
      }
    }

    campaign.status = 'running';
    campaign.schedule = {
      startDate: start,
      timezone: campaign.schedule?.timezone || 'UTC',
    };
    await campaign.save();

    logger.info(
      `Campaign ${campaign.name} (${campaign._id}) launched. Scheduled ${scheduledMessages} initial messages and ${scheduledFollowUpJobs} follow-up jobs.`
    );

    return {
      campaignId: campaign._id.toString(),
      totalContacts: campaign.selectedContacts.length,
      scheduledMessages,
      scheduledFollowUpJobs,
      skippedContacts,
    };
  }

  /**
   * Executes dispatch of an individual OutreachMessage.
   * Injects dynamic signed unsubscribe links and respects Sandbox Mode Guard.
   */
  public async dispatchMessage(messageId: string): Promise<SendMailResult> {
    const message = await OutreachMessage.findById(messageId);
    if (!message) {
      throw new Error(`OutreachMessage ${messageId} not found.`);
    }

    if (message.status === 'sent') {
      throw new Error(`Message ${messageId} was already sent.`);
    }

    if (message.status === 'cancelled') {
      throw new Error(`Message ${messageId} has been cancelled.`);
    }

    // Safety validation
    const safetyCheck = await sendingSafetyService.validatePreSendEligibility(
      message.contactId.toString(),
      message.draftId ? message.draftId.toString() : undefined
    );

    if (!safetyCheck.eligible || !safetyCheck.contact) {
      message.status = 'cancelled';
      message.error = safetyCheck.reason || 'Safety check failed';
      await message.save();
      throw new Error(`Pre-send safety failed: ${safetyCheck.reason}`);
    }

    const contact = safetyCheck.contact;

    // Generate signed one-click unsubscribe URL
    const unsubscribeUrl = unsubscribeService.generateUnsubscribeUrl({
      contactId: contact._id.toString(),
      email: contact.email,
      companyId: contact.companyId?.toString() || '',
    });

    // Replace {{UNSUBSCRIBE_URL}} placeholders with fallback HTML builder
    let safeHtml = message.bodyHtml || '';
    let safeText = message.bodyText || '';

    // Ensure HTML version is fully populated if bodyHtml was blank
    const coreText = safeText.replace(/---\s*If you prefer not to receive future emails[\s\S]*$/i, '').trim();
    if (coreText && (!safeHtml || safeHtml.replace(/<div[\s\S]*?<\/div>/gi, '').trim().length < 20)) {
      safeHtml = coreText
        .split('\n\n')
        .map((p) => `<p style="margin: 0 0 12px 0; line-height: 1.6; color: #1e293b; font-size: 14px;">${p.replace(/\n/g, '<br/>')}</p>`)
        .join('') +
        `<br/><br/><div style="font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 24px;"><p style="margin: 0 0 4px 0;">If you prefer not to receive future emails regarding AI solutions, please reply with "unsubscribe" or click the link below. <a href="{{UNSUBSCRIBE_URL}}" style="color: #6366f1; text-decoration: underline;">Unsubscribe here</a>.</p><p style="margin: 0; color: #94a3b8;">${env.SENDER_POSTAL_ADDRESS || 'Lahore, Pakistan'}</p></div>`;
    }

    const personalizedHtml = safeHtml.replace(/\{\{UNSUBSCRIBE_URL\}\}/g, unsubscribeUrl);
    const personalizedText = safeText.replace(/\{\{UNSUBSCRIBE_URL\}\}/g, unsubscribeUrl);

    message.status = 'sending';
    await message.save();

    const transport = getEmailTransport();

    try {
      const result = await transport.sendMail({
        from: `"${env.SENDER_NAME}" <${message.senderEmail}>`,
        to: message.recipientEmail,
        subject: message.subject,
        html: personalizedHtml,
        text: personalizedText,
        inReplyTo: message.inReplyTo,
        references: message.references,
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });

      // Update message record
      message.status = 'sent';
      message.messageId = result.messageId;
      message.sentAt = result.sentAt;
      message.sandboxRedirected = result.sandboxRedirected;
      message.error = '';
      await message.save();

      // Update contact status
      contact.lastContactedAt = result.sentAt;
      if (contact.outreachStatus !== 'replied' && contact.outreachStatus !== 'interested') {
        contact.outreachStatus = 'contacted';
      }
      await contact.save();

      logger.info(
        `Dispatched outreach message ${message._id} (MessageId: ${result.messageId}, Redirected: ${result.sandboxRedirected})`
      );

      return result;
    } catch (err: any) {
      message.status = 'failed';
      message.error = err.message || 'SMTP dispatch failed';
      await message.save();
      logger.error(`Failed to dispatch outreach message ${message._id}`, err);
      throw err;
    }
  }

  /**
   * Cancels all pending follow-up sequence jobs and scheduled messages for a contact.
   * Triggered on unsubscribe, hard-bounce, reply, or manual suppression (Golden Rule 2.7).
   */
  public async cancelContactOutreach(contactId: string | Types.ObjectId, reason: string): Promise<{
    jobsCancelled: number;
    messagesCancelled: number;
  }> {
    const cid = typeof contactId === 'string' ? new Types.ObjectId(contactId) : contactId;

    const [jobsRes, messagesRes] = await Promise.all([
      FollowUpJob.updateMany(
        { contactId: cid, status: 'scheduled' },
        { status: 'cancelled', error: reason }
      ),
      OutreachMessage.updateMany(
        { contactId: cid, status: 'scheduled' },
        { status: 'cancelled', error: reason }
      ),
    ]);

    logger.info(`Cancelled outreach for contact ${cid} (${reason})`, {
      jobsCancelled: jobsRes.modifiedCount,
      messagesCancelled: messagesRes.modifiedCount,
    });

    return {
      jobsCancelled: jobsRes.modifiedCount,
      messagesCancelled: messagesRes.modifiedCount,
    };
  }
}

export const campaignEngine = new CampaignEngine();
