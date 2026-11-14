import { SalesMeeting, ISalesMeetingDocument } from '../../models/SalesMeeting.js';
import { OutreachContact } from '../../models/OutreachContact.js';
import { Company } from '../../models/Company.js';
import { EmailDraft } from '../../models/EmailDraft.js';
import { salesMeetingService } from './salesMeetingService.js';
import { logger } from '../../config/logger.js';

export type ReminderType = '24h' | '1h' | 'followup' | 'noshow';

export interface IReminderResult {
  draftId?: string;
  meetingId: string;
  reminderType: ReminderType;
  recipient: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  approvalStatus: string;
  requiresHumanReview: boolean;
  remindersSent: number;
}

export class MeetingReminderService {
  /**
   * Generates a grounded reminder or recovery email draft for a meeting
   */
  async generateReminder(meetingId: string, reminderType: ReminderType): Promise<IReminderResult> {
    const meeting = await SalesMeeting.findById(meetingId)
      .populate('companyId')
      .populate('contactId');

    if (!meeting) {
      throw new Error(`Meeting with ID ${meetingId} not found.`);
    }

    const company: any = meeting.companyId;
    const contact: any = meeting.contactId;

    if (contact?.suppressionStatus?.isSuppressed || contact?.outreachStatus === 'unsubscribed') {
      throw new Error(`Cannot send reminder: Contact ${contact?.email} is suppressed or unsubscribed.`);
    }

    const sDate = new Date(meeting.startTime);
    const dateFormatted = sDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timeFormatted = `${pad(sDate.getHours())}:${pad(sDate.getMinutes())} (${meeting.timezone})`;

    let subject = '';
    let bodyText = '';
    let bodyHtml = '';

    if (reminderType === '24h') {
      subject = `Reminder: Cybells AI Automation Discovery Call Tomorrow — ${company?.companyName || 'Session'}`;
      bodyText = `Hi ${contact?.contactName || 'there'},

This is a friendly reminder that our Cybells AI Automation discovery call is scheduled for tomorrow:

📅 Date: ${dateFormatted}
⏰ Time: ${timeFormatted}
⏱ Duration: ${meeting.durationMinutes} minutes
🔗 Google Meet Video Room: ${meeting.meetingUrl}

We look forward to speaking with you and exploring how AI can streamline document entry and workflows at ${company?.companyName || 'your company'}.

If you need to reschedule or invite colleagues, please let me know.

Best regards,
${meeting.assignedAE || 'Cybells Sales Specialist'}
Cybells AI Automation Team`;

      bodyHtml = `
<div style="font-family: sans-serif; line-height: 1.6; color: #1e293b;">
  <p>Hi ${contact?.contactName || 'there'},</p>
  <p>This is a friendly reminder that our Cybells AI Automation discovery call is scheduled for tomorrow:</p>
  <div style="background: #f8fafc; border-left: 4px solid #4f46e5; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
    <p style="margin: 4px 0;"><strong>📅 Date:</strong> ${dateFormatted}</p>
    <p style="margin: 4px 0;"><strong>⏰ Time:</strong> ${timeFormatted}</p>
    <p style="margin: 4px 0;"><strong>⏱ Duration:</strong> ${meeting.durationMinutes} minutes</p>
    <p style="margin: 4px 0;"><strong>🔗 Video Link:</strong> <a href="${meeting.meetingUrl}" style="color: #4f46e5; font-weight: bold;">Join Google Meet</a></p>
  </div>
  <p>We look forward to speaking with you!</p>
  <br/>
  <p>Best regards,<br/><strong>${meeting.assignedAE || 'Cybells Sales Specialist'}</strong><br/>Cybells AI Automation Team</p>
</div>`;

      meeting.remindersSent = (meeting.remindersSent || 0) + 1;
      await meeting.save();
    } else if (reminderType === '1h') {
      subject = `Starting in 1 hour: Cybells AI Discovery Call with ${company?.companyName || 'Your Team'}`;
      bodyText = `Hi ${contact?.contactName || 'there'},

Our discovery session is starting in approximately 1 hour:

⏰ Time: ${timeFormatted}
🔗 Direct Video Link: ${meeting.meetingUrl}

Looking forward to our conversation shortly!

Best regards,
${meeting.assignedAE || 'Cybells Sales Specialist'}`;

      bodyHtml = `
<div style="font-family: sans-serif; line-height: 1.6; color: #1e293b;">
  <p>Hi ${contact?.contactName || 'there'},</p>
  <p>Our discovery session is starting in approximately 1 hour:</p>
  <div style="background: #eef2ff; border-left: 4px solid #4f46e5; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
    <p style="margin: 4px 0;"><strong>⏰ Time:</strong> ${timeFormatted}</p>
    <p style="margin: 8px 0;"><strong>🔗 Direct Video Link:</strong> <a href="${meeting.meetingUrl}" style="color: #4f46e5; font-weight: bold; font-size: 16px;">Join Google Meet Room</a></p>
  </div>
  <p>Looking forward to our conversation shortly!</p>
  <br/>
  <p>Best regards,<br/><strong>${meeting.assignedAE || 'Cybells Sales Specialist'}</strong></p>
</div>`;

      meeting.remindersSent = (meeting.remindersSent || 0) + 1;
      await meeting.save();
    } else if (reminderType === 'noshow') {
      const freshSlots = await salesMeetingService.proposeSlotsForProspect(contact._id.toString(), 3);
      const slotListText = freshSlots.map((s) => `  * ${s.dateStr} at ${s.timeStr}`).join('\n');
      const slotListHtml = freshSlots.map((s) => `<li><strong>${s.dateStr}</strong> at ${s.timeStr}</li>`).join('');

      subject = `Sorry we missed each other today — Let's reschedule our Cybells discovery call`;
      bodyText = `Hi ${contact?.contactName || 'there'},

I'm sorry we weren't able to connect for our scheduled discovery call today. I completely understand that urgent business priorities come up unexpectedly.

Whenever you have a moment, I would love to find a new time that works best for your schedule. Here are a few open times next week:

${slotListText}

Please let me know if any of these suit you, or feel free to suggest an alternative time.

Best regards,
${meeting.assignedAE || 'Cybells Sales Specialist'}
Cybells AI Automation Team`;

      bodyHtml = `
<div style="font-family: sans-serif; line-height: 1.6; color: #1e293b;">
  <p>Hi ${contact?.contactName || 'there'},</p>
  <p>I'm sorry we weren't able to connect for our scheduled discovery call today. I completely understand that urgent business priorities come up unexpectedly.</p>
  <p>Whenever you have a moment, I would love to find a new time that works best for your schedule. Here are a few open times next week:</p>
  <ul style="background: #f8fafc; padding: 12px 24px; border-radius: 4px;">
    ${slotListHtml}
  </ul>
  <p>Please let me know if any of these suit you, or feel free to suggest an alternative time.</p>
  <br/>
  <p>Best regards,<br/><strong>${meeting.assignedAE || 'Cybells Sales Specialist'}</strong><br/>Cybells AI Automation Team</p>
</div>`;
    } else {
      // followup for unconfirmed proposal
      const freshSlots = await salesMeetingService.proposeSlotsForProspect(contact._id.toString(), 3);
      const slotListText = freshSlots.map((s) => `  * ${s.dateStr} at ${s.timeStr}`).join('\n');
      const slotListHtml = freshSlots.map((s) => `<li><strong>${s.dateStr}</strong> at ${s.timeStr}</li>`).join('');

      subject = `Following up: Cybells AI Automation Discussion for ${company?.companyName || 'Your Team'}`;
      bodyText = `Hi ${contact?.contactName || 'there'},

Following up on my previous note regarding exploring custom AI document and workflow automation for ${company?.companyName || 'your team'}.

Here are a few quick times we have available for a brief 20-minute discovery chat:

${slotListText}

Would any of these work for you?

Best regards,
${meeting.assignedAE || 'Cybells Sales Specialist'}`;

      bodyHtml = `
<div style="font-family: sans-serif; line-height: 1.6; color: #1e293b;">
  <p>Hi ${contact?.contactName || 'there'},</p>
  <p>Following up on my previous note regarding exploring custom AI document and workflow automation for ${company?.companyName || 'your team'}.</p>
  <p>Here are a few quick times we have available for a brief 20-minute discovery chat:</p>
  <ul style="background: #f8fafc; padding: 12px 24px; border-radius: 4px;">
    ${slotListHtml}
  </ul>
  <p>Would any of these work for you?</p>
  <br/>
  <p>Best regards,<br/><strong>${meeting.assignedAE || 'Cybells Sales Specialist'}</strong></p>
</div>`;
    }

    let emailDraft = null;
    try {
      emailDraft = await EmailDraft.create({
        companyId: company?._id,
        contactId: contact?._id,
        stepNumber: 0,
        subject,
        bodyHtml,
        bodyText,
        approvalStatus: 'pending_approval',
        requiresHumanReview: true,
        metadata: {
          meetingId: meeting._id,
          reminderType,
        },
      });
    } catch {
      // Allow graceful fallback if draft collection already exists
    }

    logger.info(`Generated ${reminderType} reminder draft for meeting ${meetingId} (Contact: ${contact?.email})`);

    return {
      draftId: emailDraft?._id ? (emailDraft._id as any).toString() : undefined,
      meetingId: meeting._id.toString(),
      reminderType,
      recipient: contact?.email,
      subject,
      bodyText,
      bodyHtml,
      approvalStatus: 'pending_approval',
      requiresHumanReview: true,
      remindersSent: meeting.remindersSent || 0,
    };
  }

  /**
   * Scans upcoming meetings and generates due 24h and 1h reminders
   */
  async processDueReminders(): Promise<{ processedCount: number; reminders: any[] }> {
    const now = new Date();
    const in23Hours = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const in25Hours = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const in50Minutes = new Date(now.getTime() + 50 * 60 * 1000);
    const in70Minutes = new Date(now.getTime() + 70 * 60 * 1000);

    const [due24hMeetings, due1hMeetings] = await Promise.all([
      SalesMeeting.find({
        status: { $in: ['confirmed', 'rescheduled'] },
        startTime: { $gte: in23Hours, $lte: in25Hours },
        remindersSent: 0,
      }),
      SalesMeeting.find({
        status: { $in: ['confirmed', 'rescheduled'] },
        startTime: { $gte: in50Minutes, $lte: in70Minutes },
        remindersSent: { $lte: 1 },
      }),
    ]);

    const results: any[] = [];

    for (const m of due24hMeetings) {
      try {
        const rem = await this.generateReminder(m._id.toString(), '24h');
        results.push(rem);
      } catch (err) {
        logger.error(`Error processing 24h reminder for meeting ${m._id}`, err);
      }
    }

    for (const m of due1hMeetings) {
      try {
        const rem = await this.generateReminder(m._id.toString(), '1h');
        results.push(rem);
      } catch (err) {
        logger.error(`Error processing 1h reminder for meeting ${m._id}`, err);
      }
    }

    return {
      processedCount: results.length,
      reminders: results,
    };
  }
}

export const meetingReminderService = new MeetingReminderService();
