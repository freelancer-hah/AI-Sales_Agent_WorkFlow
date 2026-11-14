import { OutreachMessage } from '../../models/OutreachMessage.js';
import { FollowUpJob } from '../../models/FollowUpJob.js';
import { Campaign } from '../../models/Campaign.js';
import { CybellsConfig } from '../../models/CybellsConfig.js';
import { campaignEngine } from './campaignEngine.js';
import { sendingSafetyService } from './sendingSafetyService.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

export class SchedulerWorker {
  private timer: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  private pollingIntervalMs: number = 30000; // 30 seconds default
  private disableJitterForTesting: boolean = false;

  constructor(pollingIntervalMs?: number) {
    if (pollingIntervalMs) {
      this.pollingIntervalMs = pollingIntervalMs;
    }
  }

  public setDisableJitterForTesting(disable: boolean): void {
    this.disableJitterForTesting = disable;
  }

  public start(): void {
    if (this.timer) return;

    logger.info(`Starting SchedulerWorker (Polling every ${this.pollingIntervalMs / 1000}s)`);
    this.timer = setInterval(() => {
      this.tick().catch((err) => {
        logger.error('Error during SchedulerWorker background tick', err);
      });
    }, this.pollingIntervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('SchedulerWorker stopped.');
    }
  }

  /**
   * Main scheduler execution tick.
   * Processes due scheduled messages and follow-up sequence jobs one by one.
   */
  public async tick(): Promise<{
    processedMessages: number;
    processedFollowUps: number;
    capReached: boolean;
    outsideSendingWindow: boolean;
  }> {
    if (this.isProcessing) {
      logger.warn('SchedulerWorker tick skipped: previous tick still processing.');
      return {
        processedMessages: 0,
        processedFollowUps: 0,
        capReached: false,
        outsideSendingWindow: false,
      };
    }

    this.isProcessing = true;
    let processedMessages = 0;
    let processedFollowUps = 0;

    try {
      const config = await CybellsConfig.getOrCreateConfig();
      const sendingRules = config.sendingRules;

      // 1. Sending hours & days check (bypassed in sandbox mode for safe testing)
      const isSandbox = env.SEND_MODE === 'sandbox';
      if (!isSandbox && !this.disableJitterForTesting && !sendingSafetyService.isWithinAllowedSendingWindow(sendingRules)) {
        logger.debug('SchedulerWorker: Currently outside allowed sending business hours/days.');
        return {
          processedMessages: 0,
          processedFollowUps: 0,
          capReached: false,
          outsideSendingWindow: true,
        };
      }

      // 2. Daily send cap check
      const capCheck = await sendingSafetyService.isDailyCapReached(sendingRules?.dailyCap);
      if (capCheck.capReached) {
        logger.warn(
          `SchedulerWorker: Daily sending cap of ${capCheck.cap} reached (${capCheck.sentToday} sent today). Rescheduling remaining for tomorrow.`
        );
        return {
          processedMessages: 0,
          processedFollowUps: 0,
          capReached: true,
          outsideSendingWindow: false,
        };
      }

      // 3. Process Due Outreach Messages (Step 0 or scheduled follow-ups)
      const now = new Date();
      const dueMessages = await OutreachMessage.find({
        status: 'scheduled',
        scheduledFor: { $lte: now },
      })
        .limit(10)
        .sort({ scheduledFor: 1 });

      for (const msg of dueMessages) {
        // Re-check cap before each dispatch
        const currentCap = await sendingSafetyService.isDailyCapReached(sendingRules?.dailyCap);
        if (currentCap.capReached) {
          logger.warn('Daily send cap reached during batch processing.');
          break;
        }

        try {
          await campaignEngine.dispatchMessage(msg._id.toString());
          processedMessages++;

          // Jitter delay between dispatches (60 - 180s)
          if (!this.disableJitterForTesting) {
            const delayMs = sendingSafetyService.getRandomJitterDelayMs(
              sendingRules?.minDelaySeconds,
              sendingRules?.maxDelaySeconds
            );
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        } catch (msgErr: any) {
          logger.error(`Error sending due message ${msg._id}`, msgErr);
        }
      }

      // 4. Process Due Follow-Up Sequence Jobs (Step 1, Step 2, Step 3)
      const dueFollowUps = await FollowUpJob.find({
        status: 'scheduled',
        scheduledAt: { $lte: now },
      })
        .limit(10)
        .sort({ scheduledAt: 1 });

      for (const job of dueFollowUps) {
        try {
          await this.processFollowUpJob(job);
          processedFollowUps++;
        } catch (jobErr: any) {
          logger.error(`Error processing follow-up job ${job._id}`, jobErr);
        }
      }

      return {
        processedMessages,
        processedFollowUps,
        capReached: false,
        outsideSendingWindow: false,
      };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Evaluates and creates the scheduled outreach message for a follow-up step.
   */
  private async processFollowUpJob(job: any): Promise<void> {
    const campaign = await Campaign.findById(job.campaignId);
    if (!campaign || campaign.status === 'paused' || campaign.status === 'cancelled') {
      return;
    }

    // Pre-send check (if contact already replied or unsubscribed, cancel job)
    const safety = await sendingSafetyService.validatePreSendEligibility(job.contactId.toString());
    if (!safety.eligible || !safety.contact) {
      job.status = 'cancelled';
      job.error = safety.reason || 'Contact no longer eligible for follow-up.';
      await job.save();
      return;
    }

    const contact = safety.contact;
    const stepConfig = (campaign.sequence || []).find((s: any) => s.step === job.sequenceStep);
    const subject = stepConfig?.subject || `Following up regarding our previous email (Step ${job.sequenceStep})`;
    const bodyText = stepConfig?.body || `Hi ${contact.contactName || 'there'},\n\nFollowing up to see if you had a chance to review my previous note.\n\nBest regards,\nHafiz`;
    const bodyHtml = `<p>${bodyText.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`;

    // Find previous sent message in thread to maintain email threading (In-Reply-To)
    const previousMessage = await OutreachMessage.findOne({
      campaignId: campaign._id,
      contactId: contact._id,
      status: 'sent',
    }).sort({ sentAt: -1 });

    const references = previousMessage?.references || [];
    if (previousMessage?.messageId) {
      references.push(previousMessage.messageId);
    }

    // Create scheduled message for this follow-up
    const followUpMessage = new OutreachMessage({
      campaignId: campaign._id,
      contactId: contact._id,
      direction: 'outbound',
      senderEmail: previousMessage?.senderEmail || 'outreach@cybells.ai',
      recipientEmail: contact.email,
      subject,
      bodyHtml,
      bodyText,
      status: 'scheduled',
      scheduledFor: new Date(),
      inReplyTo: previousMessage?.messageId,
      references,
      threadId: previousMessage?.threadId || previousMessage?.messageId,
      sandboxRedirected: true,
    });

    await followUpMessage.save();

    job.status = 'completed';
    job.completedAt = new Date();
    await job.save();

    logger.info(
      `FollowUpJob ${job._id} (Step ${job.sequenceStep}) executed. Created scheduled message ${followUpMessage._id}.`
    );
  }
}

export const schedulerWorker = new SchedulerWorker();

