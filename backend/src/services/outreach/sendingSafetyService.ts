import crypto from 'crypto';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { OutreachMessage } from '../../models/OutreachMessage.js';
import { OutreachContact, IOutreachContactDocument } from '../../models/OutreachContact.js';
import { SuppressionList } from '../../models/SuppressionList.js';
import { CybellsConfig } from '../../models/CybellsConfig.js';
import { EmailDraft, IEmailDraftDocument } from '../../models/EmailDraft.js';

export interface EligibilityCheckResult {
  eligible: boolean;
  reason?: string;
  contact?: IOutreachContactDocument;
  draft?: IEmailDraftDocument;
}

export class SendingSafetyService {
  /**
   * Counts total outbound emails sent today (since midnight in target timezone).
   */
  public async getSentCountToday(): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const count = await OutreachMessage.countDocuments({
      direction: 'outbound',
      status: 'sent',
      sentAt: { $gte: startOfDay },
    });

    return count;
  }

  /**
   * Checks if daily send cap has been reached.
   */
  public async isDailyCapReached(customCap?: number): Promise<{ capReached: boolean; sentToday: number; cap: number }> {
    const config = await CybellsConfig.getOrCreateConfig();
    const cap = customCap || config.sendingRules?.dailyCap || env.DAILY_SEND_CAP || 25;
    const sentToday = await this.getSentCountToday();

    return {
      capReached: sentToday >= cap,
      sentToday,
      cap,
    };
  }

  /**
   * Checks if the current time falls within allowed business hours and sending days.
   */
  public isWithinAllowedSendingWindow(sendingRules?: any): boolean {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday ... 6 = Saturday
    const currentHour = now.getHours();

    const allowedDays = sendingRules?.allowedSendingDays || [1, 2, 3, 4, 5]; // Default Mon-Fri
    const startHour = sendingRules?.allowedSendingHours?.start ?? 9; // Default 9 AM
    const endHour = sendingRules?.allowedSendingHours?.end ?? 17; // Default 5 PM

    if (!allowedDays.includes(currentDay)) {
      return false;
    }

    if (currentHour < startHour || currentHour >= endHour) {
      return false;
    }

    return true;
  }

  /**
   * Generates a randomized delay in milliseconds between minDelaySeconds and maxDelaySeconds
   * to avoid email burst detection and spam filter triggering.
   */
  public getRandomJitterDelayMs(minSec?: number, maxSec?: number): number {
    const min = minSec ?? env.MIN_DELAY_SECONDS ?? 60;
    const max = maxSec ?? env.MAX_DELAY_SECONDS ?? 180;
    const randomSec = Math.floor(Math.random() * (max - min + 1)) + min;
    return randomSec * 1000;
  }

  /**
   * Computes the next allowed sending date/time (e.g., tomorrow 9:00 AM on next business day).
   */
  public getNextAllowedSendingTime(sendingRules?: any): Date {
    const date = new Date();
    const allowedDays = sendingRules?.allowedSendingDays || [1, 2, 3, 4, 5];
    const startHour = sendingRules?.allowedSendingHours?.start ?? 9;

    // Advance to next day at startHour
    date.setDate(date.getDate() + 1);
    date.setHours(startHour, 0, 0, 0);

    // Keep advancing if falls on a disallowed day (e.g. weekend)
    while (!allowedDays.includes(date.getDay())) {
      date.setDate(date.getDate() + 1);
    }

    return date;
  }

  /**
   * Strict pre-flight safety check prior to ANY outbound email send.
   * Enforces Golden Rules 2.4, 2.7, and 2.5.
   */
  public async validatePreSendEligibility(
    contactId: string,
    draftId?: string
  ): Promise<EligibilityCheckResult> {
    const contact = await OutreachContact.findById(contactId);
    if (!contact) {
      return { eligible: false, reason: 'Contact record not found.' };
    }

    // 1. Suppression check in contact record
    if (contact.suppressionStatus?.isSuppressed || contact.outreachStatus === 'suppressed' || contact.outreachStatus === 'unsubscribed') {
      return {
        eligible: false,
        reason: `Contact ${contact.email} is suppressed or unsubscribed. Outreach is legally prohibited.`,
        contact,
      };
    }

    // 2. Global suppression registry check
    const normalizedEmail = contact.normalizedEmail || contact.email.toLowerCase().trim();
    const isGloballySuppressed = await SuppressionList.findOne({ email: normalizedEmail }).lean();
    if (isGloballySuppressed) {
      // Auto-sync contact record
      contact.suppressionStatus = {
        isSuppressed: true,
        reason: isGloballySuppressed.reason || 'suppressed',
        suppressedAt: new Date(),
      };
      contact.outreachStatus = 'suppressed';
      await contact.save();

      return {
        eligible: false,
        reason: `Email ${contact.email} is listed in the global suppression registry (${isGloballySuppressed.reason}).`,
        contact,
      };
    }

    // 3. Contact outreach state check (Stop sending if replied, converted, or not interested)
    const terminalStatuses = ['replied', 'interested', 'not_interested', 'bounced', 'unsubscribed', 'converted', 'suppressed'];
    if (terminalStatuses.includes(contact.outreachStatus)) {
      return {
        eligible: false,
        reason: `Contact is currently in status "${contact.outreachStatus}". Automated sending stopped.`,
        contact,
      };
    }

    // 4. Human Approval verification (Golden Rule 2.4)
    let draft: IEmailDraftDocument | null = null;
    if (draftId) {
      draft = await EmailDraft.findById(draftId);
      if (!draft) {
        return { eligible: false, reason: 'Associated email draft not found.', contact };
      }

      if (draft.approvalStatus !== 'approved') {
        return {
          eligible: false,
          reason: `Outbound email rejected: Draft is in "${draft.approvalStatus}" status. Explicit human approval is mandatory.`,
          contact,
          draft,
        };
      }

      // 5. Verify Content Cryptographic Hash (Ensures content was not modified after approval)
      if (draft.approvedContentHash) {
        const currentHash = crypto
          .createHash('sha256')
          .update(`${draft.subject}:::${draft.bodyHtml}`)
          .digest('hex');

        if (currentHash !== draft.approvedContentHash) {
          return {
            eligible: false,
            reason: 'Security breach: Email draft content was modified after human approval was granted.',
            contact,
            draft,
          };
        }
      }
    }

    return {
      eligible: true,
      contact,
      draft: draft || undefined,
    };
  }
}

export const sendingSafetyService = new SendingSafetyService();

