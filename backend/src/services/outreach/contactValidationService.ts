import { SuppressionList, SuppressionReason } from '../../models/SuppressionList.js';
import { OutreachContact } from '../../models/OutreachContact.js';
import { FollowUpJob } from '../../models/FollowUpJob.js';
import { OutreachMessage } from '../../models/OutreachMessage.js';
import { logger } from '../../config/logger.js';

// Comprehensive RFC 5322 syntax regex
const EMAIL_SYNTAX_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// Common disposable / throwaway domains to filter out risky mailboxes
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'throwawaymail.com',
  'yopmail.com',
  'trashmail.com',
  'sharklasers.com',
  'getairmail.com',
  'temp-mail.org',
  'fakeinbox.com',
]);

// Role-based prefixes that typically do not belong to individual decision-makers
const ROLE_BASED_PREFIXES = new Set([
  'abuse',
  'admin',
  'billing',
  'compliance',
  'devnull',
  'dns',
  'ftp',
  'hostmaster',
  'inoc',
  'ispfeedback',
  'ispsupport',
  'list',
  'list-request',
  'maildaemon',
  'mailer-daemon',
  'marketing',
  'noc',
  'no-reply',
  'noreply',
  'null',
  'postmaster',
  'privacy',
  'registrar',
  'root',
  'security',
  'spam',
  'support',
  'sysadmin',
  'undisclosed-recipients',
  'unsubscribe',
  'usenet',
  'uucp',
  'webmaster',
]);

export interface EmailFormatValidationResult {
  isValid: boolean;
  status: 'format_valid' | 'format_invalid' | 'risky';
  reason?: string;
  isRoleBased: boolean;
  isDisposable: boolean;
  normalizedEmail: string;
}

export class ContactValidationService {
  /**
   * Validates email syntax, structure, role-based status, and disposable domain detection.
   * Note: Regex alone never produces 'verified' (Golden Rule 2.2).
   */
  public validateEmailFormat(rawEmail: string): EmailFormatValidationResult {
    if (!rawEmail || typeof rawEmail !== 'string') {
      return {
        isValid: false,
        status: 'format_invalid',
        reason: 'Email is missing or empty',
        isRoleBased: false,
        isDisposable: false,
        normalizedEmail: '',
      };
    }

    const trimmed = rawEmail.trim().toLowerCase();

    // 1. Overall length check (RFC 5321 limit is 254 characters)
    if (trimmed.length === 0 || trimmed.length > 254) {
      return {
        isValid: false,
        status: 'format_invalid',
        reason: 'Email length exceeds 254 characters or is empty',
        isRoleBased: false,
        isDisposable: false,
        normalizedEmail: trimmed,
      };
    }

    // 2. Syntax regex test
    if (!EMAIL_SYNTAX_REGEX.test(trimmed)) {
      return {
        isValid: false,
        status: 'format_invalid',
        reason: 'Email does not match standard RFC 5322 syntax',
        isRoleBased: false,
        isDisposable: false,
        normalizedEmail: trimmed,
      };
    }

    const [localPart, domainPart] = trimmed.split('@');

    // 3. Local part length check (max 64 characters)
    if (!localPart || localPart.length > 64) {
      return {
        isValid: false,
        status: 'format_invalid',
        reason: 'Local part exceeds 64 characters',
        isRoleBased: false,
        isDisposable: false,
        normalizedEmail: trimmed,
      };
    }

    // 4. Domain & TLD checks
    if (!domainPart || !domainPart.includes('.')) {
      return {
        isValid: false,
        status: 'format_invalid',
        reason: 'Domain must contain a valid dot-separated TLD',
        isRoleBased: false,
        isDisposable: false,
        normalizedEmail: trimmed,
      };
    }

    const domainParts = domainPart.split('.');
    const tld = domainParts[domainParts.length - 1];
    if (tld.length < 2) {
      return {
        isValid: false,
        status: 'format_invalid',
        reason: 'Top-level domain must be at least 2 characters long',
        isRoleBased: false,
        isDisposable: false,
        normalizedEmail: trimmed,
      };
    }

    // 5. Disposable domain heuristic
    const isDisposable = DISPOSABLE_DOMAINS.has(domainPart);

    // 6. Role-based email heuristic
    const isRoleBased = ROLE_BASED_PREFIXES.has(localPart);

    if (isDisposable) {
      return {
        isValid: true,
        status: 'risky',
        reason: 'Email domain is a known temporary or disposable inbox provider',
        isRoleBased,
        isDisposable: true,
        normalizedEmail: trimmed,
      };
    }

    if (isRoleBased) {
      return {
        isValid: true,
        status: 'risky',
        reason: `Role-based mailbox (${localPart}@) detected, which has higher bounce and spam risk`,
        isRoleBased: true,
        isDisposable: false,
        normalizedEmail: trimmed,
      };
    }

    return {
      isValid: true,
      status: 'format_valid',
      isRoleBased: false,
      isDisposable: false,
      normalizedEmail: trimmed,
    };
  }

  /**
   * Checks whether an email is currently suppressed in the global SuppressionList.
   */
  public async checkSuppression(email: string): Promise<{
    isSuppressed: boolean;
    reason?: string;
    source?: string;
  }> {
    if (!email) return { isSuppressed: false };
    const normalized = email.trim().toLowerCase();
    const entry = await SuppressionList.findOne({ email: normalized }).lean();
    if (entry) {
      return {
        isSuppressed: true,
        reason: entry.reason,
        source: entry.source,
      };
    }
    return { isSuppressed: false };
  }

  /**
   * Suppresses an email globally:
   * 1. Records in SuppressionList.
   * 2. Updates all matching OutreachContacts to suppressed.
   * 3. Cancels any scheduled FollowUpJobs or OutreachMessages for those contacts.
   */
  public async suppressEmail(
    email: string,
    reason: SuppressionReason,
    source = 'manual'
  ): Promise<{
    suppressedEmail: string;
    contactsUpdated: number;
    jobsCancelled: number;
    messagesCancelled: number;
  }> {
    const normalized = email.trim().toLowerCase();

    // 1. Upsert into SuppressionList
    await SuppressionList.findOneAndUpdate(
      { email: normalized },
      {
        email: normalized,
        reason,
        source,
        createdAt: new Date(),
      },
      { upsert: true, new: true }
    );

    // 2. Find and update all OutreachContacts matching this normalized email
    const matchingContacts = await OutreachContact.find({
      normalizedEmail: normalized,
    });

    const contactIds = matchingContacts.map((c) => c._id);

    const updateRes = await OutreachContact.updateMany(
      { normalizedEmail: normalized },
      {
        $set: {
          outreachStatus: reason === 'unsubscribe' ? 'unsubscribed' : 'suppressed',
          suppressionStatus: {
            isSuppressed: true,
            reason,
            suppressedAt: new Date(),
          },
        },
      }
    );

    let jobsCancelled = 0;
    let messagesCancelled = 0;

    if (contactIds.length > 0) {
      // 3. Cancel scheduled follow-up jobs for these contacts
      const jobRes = await FollowUpJob.updateMany(
        {
          contactId: { $in: contactIds },
          status: 'scheduled',
        },
        {
          $set: {
            status: 'cancelled',
            error: `Cancelled due to email suppression (${reason})`,
          },
        }
      );
      jobsCancelled = jobRes.modifiedCount;

      // 4. Cancel scheduled messages for these contacts
      const msgRes = await OutreachMessage.updateMany(
        {
          contactId: { $in: contactIds },
          status: 'scheduled',
        },
        {
          $set: {
            status: 'cancelled',
            error: `Cancelled due to email suppression (${reason})`,
          },
        }
      );
      messagesCancelled = msgRes.modifiedCount;
    }

    logger.info(`Email suppressed: ${normalized} (Reason: ${reason})`, {
      contactsUpdated: updateRes.modifiedCount,
      jobsCancelled,
      messagesCancelled,
    });

    return {
      suppressedEmail: normalized,
      contactsUpdated: updateRes.modifiedCount,
      jobsCancelled,
      messagesCancelled,
    };
  }

  /**
   * Removes an email from the global SuppressionList and reactivates associated contacts.
   */
  public async unsuppressEmail(email: string): Promise<boolean> {
    const normalized = email.trim().toLowerCase();
    const deleteRes = await SuppressionList.deleteOne({ email: normalized });

    if (deleteRes.deletedCount > 0) {
      await OutreachContact.updateMany(
        {
          normalizedEmail: normalized,
          'suppressionStatus.isSuppressed': true,
        },
        {
          $set: {
            outreachStatus: 'selected',
            suppressionStatus: {
              isSuppressed: false,
              reason: '',
            },
          },
        }
      );
      logger.info(`Email unsuppressed and contacts reactivated: ${normalized}`);
      return true;
    }

    return false;
  }
}

export const contactValidationService = new ContactValidationService();

