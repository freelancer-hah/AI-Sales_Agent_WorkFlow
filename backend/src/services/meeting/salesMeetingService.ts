import crypto from 'crypto';
import { Types } from 'mongoose';
import { SalesMeeting, ISalesMeetingDocument, MeetingStatus, MeetingType, MeetingLocationType, IMeetingAttendee } from '../../models/SalesMeeting.js';
import { OutreachContact } from '../../models/OutreachContact.js';
import { Company } from '../../models/Company.js';
import { LeadQualification } from '../../models/LeadQualification.js';
import { QualificationActivity } from '../../models/QualificationActivity.js';
import { meetingAvailabilityService } from './meetingAvailabilityService.js';
import { logger } from '../../config/logger.js';

export interface ICreateMeetingInput {
  companyId: string | Types.ObjectId;
  contactId: string | Types.ObjectId;
  qualificationId?: string | Types.ObjectId;
  title?: string;
  description?: string;
  meetingType?: MeetingType;
  startTime: Date | string;
  endTime?: Date | string;
  durationMinutes?: number;
  timezone?: string;
  locationType?: MeetingLocationType;
  meetingUrl?: string;
  status?: MeetingStatus;
  assignedAE?: string;
  prospectNotes?: string;
  executiveDossier?: string;
  attendees?: IMeetingAttendee[];
  force?: boolean;
}

export class SalesMeetingService {
  /**
   * Schedules a sales meeting with full safety and conflict validation
   */
  async createMeeting(input: ICreateMeetingInput): Promise<ISalesMeetingDocument> {
    const contact = await OutreachContact.findById(input.contactId);
    if (!contact) {
      throw new Error(`Contact with ID ${input.contactId} not found.`);
    }

    // 1. Mandatory Suppression & Unsubscribe Check
    if (contact.suppressionStatus?.isSuppressed || contact.outreachStatus === 'unsubscribed') {
      throw new Error(`Cannot schedule meeting: Contact ${contact.email} is suppressed or unsubscribed.`);
    }

    const company = await Company.findById(input.companyId);
    if (!company) {
      throw new Error(`Company with ID ${input.companyId} not found.`);
    }

    const availability = await meetingAvailabilityService.getHostAvailability();

    const startTime = new Date(input.startTime);
    const durationMinutes = input.durationMinutes || availability.meetingDurationMinutes || 30;
    const endTime = input.endTime ? new Date(input.endTime) : new Date(startTime.getTime() + durationMinutes * 60 * 1000);

    // 2. Validate Slot Availability unless forced
    if (!input.force) {
      const slotValidation = await meetingAvailabilityService.validateSlot(startTime, endTime);
      if (!slotValidation.isValid) {
        throw new Error(`Slot validation failed: ${slotValidation.conflictReason}`);
      }
    }

    // 3. Assemble Meeting Attendees
    const attendees: IMeetingAttendee[] = [
      {
        name: availability.hostName,
        email: availability.hostEmail,
        role: 'host',
        status: 'accepted',
      },
      {
        name: contact.contactName || 'Valued Prospect',
        email: contact.email,
        role: 'prospect',
        status: 'needs_action',
      },
    ];

    if (input.attendees && input.attendees.length > 0) {
      for (const att of input.attendees) {
        if (!attendees.some((a) => a.email.toLowerCase() === att.email.toLowerCase())) {
          attendees.push(att);
        }
      }
    }

    // 4. Provision Meeting Link & ICS UID
    const meetingUrl =
      input.meetingUrl?.trim() ||
      availability.defaultMeetingUrl?.trim() ||
      `https://meet.google.com/cyb-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 5)}`;
    const icsUid = `${crypto.randomUUID()}@cybells.com`;

    const title = input.title || `Cybells AI Automation Discovery — ${company.companyName}`;
    const meetingStatus = input.status || 'confirmed';

    const meeting = await SalesMeeting.create({
      companyId: company._id,
      contactId: contact._id,
      qualificationId: input.qualificationId ? new Types.ObjectId(input.qualificationId) : undefined,
      title,
      description: input.description || `Discovery session with ${company.companyName} to explore Cybells document extraction and custom AI workflows.`,
      meetingType: input.meetingType || 'discovery_call',
      startTime,
      endTime,
      durationMinutes,
      timezone: input.timezone || availability.timezone || 'Asia/Karachi',
      status: meetingStatus,
      locationType: input.locationType || 'google_meet',
      meetingUrl,
      icsUid,
      sequence: 0,
      attendees,
      assignedAE: input.assignedAE || availability.hostName,
      executiveDossier: input.executiveDossier || '',
      prospectNotes: input.prospectNotes || '',
    });

    // 5. Update OutreachContact status
    await OutreachContact.findByIdAndUpdate(contact._id, {
      $set: {
        outreachStatus: 'meeting_scheduled',
        lastContactedAt: new Date(),
      },
    });

    // 6. If LeadQualification exists, update and record activity
    if (input.qualificationId) {
      await LeadQualification.findByIdAndUpdate(input.qualificationId, {
        $set: { lastInteractionAt: new Date() },
      });

      await QualificationActivity.create({
        qualificationId: input.qualificationId,
        companyId: company._id,
        contactId: contact._id,
        activityType: 'meeting_scheduled',
        title: 'Discovery Meeting Scheduled',
        description: `Discovery meeting scheduled with ${contact.contactName || contact.email} for ${startTime.toISOString()}`,
        actor: 'human',
        actorName: availability.hostName,
        metadata: {
          meetingId: meeting._id,
          startTime,
          endTime,
          meetingUrl,
        },
      });
    }

    logger.info(`Sales meeting scheduled: ID=${meeting._id} for Company="${company.companyName}" with Contact="${contact.email}"`);
    return meeting;
  }

  /**
   * Retrieves paginated sales meetings with filtering
   */
  async getMeetings(
    filter: {
      status?: MeetingStatus;
      companyId?: string;
      contactId?: string;
      startDate?: string | Date;
      endDate?: string | Date;
    } = {},
    pagination: { page?: number; limit?: number } = {}
  ): Promise<{ meetings: ISalesMeetingDocument[]; total: number; page: number; totalPages: number }> {
    const page = Math.max(1, pagination.page || 1);
    const limit = Math.min(100, Math.max(1, pagination.limit || 20));
    const skip = (page - 1) * limit;

    const query: any = {};

    if (filter.status) {
      query.status = filter.status;
    }
    if (filter.companyId) {
      query.companyId = filter.companyId;
    }
    if (filter.contactId) {
      query.contactId = filter.contactId;
    }
    if (filter.startDate || filter.endDate) {
      query.startTime = {};
      if (filter.startDate) query.startTime.$gte = new Date(filter.startDate);
      if (filter.endDate) query.startTime.$lte = new Date(filter.endDate);
    }

    // Heal legacy random hash meeting URLs to active Google Meet room
    SalesMeeting.updateMany(
      { meetingUrl: { $regex: 'meet\\.google\\.com/cyb-' } },
      { $set: { meetingUrl: 'https://meet.google.com/new' } }
    ).catch(() => {});

    const [meetings, total] = await Promise.all([
      SalesMeeting.find(query)
        .populate('companyId', 'companyName domain industry')
        .populate('contactId', 'contactName email jobTitle')
        .populate('qualificationId', 'qualificationScore qualificationStatus interestLevel')
        .sort({ startTime: 1 })
        .skip(skip)
        .limit(limit),
      SalesMeeting.countDocuments(query),
    ]);

    // Ensure returned meeting objects in memory also don't carry expired hashes
    for (const m of meetings) {
      if (m.meetingUrl && m.meetingUrl.includes('meet.google.com/cyb-')) {
        m.meetingUrl = 'https://meet.google.com/new';
      }
    }

    return {
      meetings,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Fetches meeting by ID with populated relations
   */
  async getMeetingById(id: string): Promise<ISalesMeetingDocument | null> {
    const meeting = await SalesMeeting.findById(id)
      .populate('companyId')
      .populate('contactId')
      .populate('qualificationId');
    if (meeting && meeting.meetingUrl && meeting.meetingUrl.includes('meet.google.com/cyb-')) {
      meeting.meetingUrl = 'https://meet.google.com/new';
    }
    return meeting;
  }

  /**
   * Aggregates meeting pipeline statistics
   */
  async getMeetingStats(): Promise<{
    total: number;
    upcoming: number;
    confirmed: number;
    completed: number;
    rescheduled: number;
    cancelled: number;
    noShow: number;
  }> {
    const now = new Date();
    const [total, upcoming, confirmed, completed, rescheduled, cancelled, noShow] = await Promise.all([
      SalesMeeting.countDocuments(),
      SalesMeeting.countDocuments({
        status: { $in: ['proposed', 'confirmed', 'rescheduled'] },
        startTime: { $gte: now },
      }),
      SalesMeeting.countDocuments({ status: 'confirmed' }),
      SalesMeeting.countDocuments({ status: 'completed' }),
      SalesMeeting.countDocuments({ status: 'rescheduled' }),
      SalesMeeting.countDocuments({ status: 'cancelled' }),
      SalesMeeting.countDocuments({ status: 'no_show' }),
    ]);

    return {
      total,
      upcoming,
      confirmed,
      completed,
      rescheduled,
      cancelled,
      noShow,
    };
  }

  /**
   * Proposes top optimal slots for a prospect
   */
  async proposeSlotsForProspect(contactId: string, count: number = 3): Promise<any[]> {
    const contact = await OutreachContact.findById(contactId);
    if (!contact) {
      throw new Error(`Contact with ID ${contactId} not found.`);
    }

    if (contact.suppressionStatus?.isSuppressed || contact.outreachStatus === 'unsubscribed') {
      throw new Error(`Cannot propose slots: Contact ${contact.email} is suppressed or unsubscribed.`);
    }

    // Search from next business day forward
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const slots = await meetingAvailabilityService.getAvailableSlots({
      startDate: tomorrow,
      durationMinutes: 30,
    });

    return slots.slice(0, Math.max(1, count));
  }

  /**
   * Updates meeting status with audit reasons
   */
  async updateMeetingStatus(
    id: string,
    status: MeetingStatus,
    extraData: {
      cancellationReason?: string;
      rescheduleReason?: string;
      meetingOutcome?: {
        outcome: 'deal_in_progress' | 'follow_up_needed' | 'closed_won' | 'closed_lost';
        notes?: string;
      };
    } = {}
  ): Promise<ISalesMeetingDocument> {
    const meeting = await SalesMeeting.findById(id);
    if (!meeting) {
      throw new Error(`Meeting with ID ${id} not found.`);
    }

    meeting.status = status;
    if (extraData.cancellationReason) {
      meeting.cancellationReason = extraData.cancellationReason;
    }
    if (extraData.rescheduleReason) {
      meeting.rescheduleReason = extraData.rescheduleReason;
    }
    if (extraData.meetingOutcome) {
      meeting.meetingOutcome = {
        outcome: extraData.meetingOutcome.outcome,
        notes: extraData.meetingOutcome.notes || '',
        loggedAt: new Date(),
      };
    }

    await meeting.save();
    logger.info(`Updated meeting status: ID=${id} -> ${status}`);
    return meeting;
  }

  /**
   * Reschedules an existing meeting to a new time slot
   * Enforces slot validation, increments RFC 5545 sequence, and generates updated .ics
   */
  async rescheduleMeeting(
    id: string,
    newStartTime: Date | string,
    reason?: string,
    options: { force?: boolean } = {}
  ): Promise<{ meeting: ISalesMeetingDocument; icsContent: string }> {
    const meeting = await SalesMeeting.findById(id).populate('contactId').populate('companyId');
    if (!meeting) {
      throw new Error(`Meeting with ID ${id} not found.`);
    }

    const contact: any = meeting.contactId;
    if (contact?.suppressionStatus?.isSuppressed || contact?.outreachStatus === 'unsubscribed') {
      throw new Error(`Cannot reschedule meeting: Contact ${contact?.email} is suppressed or unsubscribed.`);
    }

    const start = new Date(newStartTime);
    const end = new Date(start.getTime() + meeting.durationMinutes * 60 * 1000);

    if (!options.force) {
      const check = await meetingAvailabilityService.validateSlot(start, end, meeting._id.toString());
      if (!check.isValid) {
        throw new Error(`Cannot reschedule: ${check.conflictReason}`);
      }
    }

    meeting.startTime = start;
    meeting.endTime = end;
    meeting.status = 'rescheduled';
    meeting.sequence = (meeting.sequence || 0) + 1;
    if (reason) {
      meeting.rescheduleReason = reason;
    }

    await meeting.save();

    // Import icsCalendarService dynamically if needed or use imported service
    const { icsCalendarService } = await import('./icsCalendarService.js');
    const icsContent = icsCalendarService.generateIcs(meeting, { method: 'REQUEST' });

    if (meeting.qualificationId) {
      await QualificationActivity.create({
        qualificationId: meeting.qualificationId,
        companyId: meeting.companyId,
        contactId: meeting.contactId,
        activityType: 'meeting_scheduled',
        title: 'Discovery Meeting Rescheduled',
        description: `Meeting rescheduled to ${start.toISOString()}${reason ? ` (Reason: ${reason})` : ''}`,
        actor: 'human',
        metadata: {
          meetingId: meeting._id,
          newStartTime: start,
          newEndTime: end,
          sequence: meeting.sequence,
        },
      });
    }

    logger.info(`Meeting ${id} rescheduled to ${start.toISOString()} (Sequence=${meeting.sequence})`);
    return { meeting, icsContent };
  }

  /**
   * Cancels a meeting, releases the slot, increments sequence, and generates cancellation .ics
   */
  async cancelMeeting(
    id: string,
    reason: string
  ): Promise<{ meeting: ISalesMeetingDocument; icsContent: string }> {
    const meeting = await SalesMeeting.findById(id).populate('contactId').populate('companyId');
    if (!meeting) {
      throw new Error(`Meeting with ID ${id} not found.`);
    }

    meeting.status = 'cancelled';
    meeting.cancellationReason = reason;
    meeting.sequence = (meeting.sequence || 0) + 1;

    await meeting.save();

    const { icsCalendarService } = await import('./icsCalendarService.js');
    const icsContent = icsCalendarService.generateIcs(meeting, {
      method: 'CANCEL',
      status: 'CANCELLED',
      includeAlarm: false,
    });

    if (meeting.qualificationId) {
      await QualificationActivity.create({
        qualificationId: meeting.qualificationId,
        companyId: meeting.companyId,
        contactId: meeting.contactId,
        activityType: 'status_changed',
        title: 'Discovery Meeting Cancelled',
        description: `Meeting cancelled. Reason: ${reason}`,
        actor: 'human',
        metadata: {
          meetingId: meeting._id,
          reason,
          sequence: meeting.sequence,
        },
      });
    }

    logger.info(`Meeting ${id} cancelled. Reason: "${reason}" (Sequence=${meeting.sequence})`);
    return { meeting, icsContent };
  }

  /**
   * Logs final meeting outcome and updates contact status if deal progressing
   */
  async recordMeetingOutcome(
    id: string,
    outcome: 'deal_in_progress' | 'follow_up_needed' | 'closed_won' | 'closed_lost',
    notes: string = ''
  ): Promise<ISalesMeetingDocument> {
    const meeting = await SalesMeeting.findById(id);
    if (!meeting) {
      throw new Error(`Meeting with ID ${id} not found.`);
    }

    meeting.status = 'completed';
    meeting.meetingOutcome = {
      outcome,
      notes,
      loggedAt: new Date(),
    };

    await meeting.save();

    // Cascade to OutreachContact if won or active deal
    if (outcome === 'closed_won' || outcome === 'deal_in_progress') {
      await OutreachContact.findByIdAndUpdate(meeting.contactId, {
        $set: { outreachStatus: 'converted' },
      });
    }

    if (meeting.qualificationId) {
      await QualificationActivity.create({
        qualificationId: meeting.qualificationId,
        companyId: meeting.companyId,
        contactId: meeting.contactId,
        activityType: 'status_changed',
        title: 'Meeting Outcome Logged',
        description: `Meeting completed with outcome: ${outcome}.${notes ? ` Notes: ${notes}` : ''}`,
        actor: 'human',
        metadata: {
          meetingId: meeting._id,
          outcome,
          notes,
        },
      });
    }

    logger.info(`Logged meeting outcome for ${id}: ${outcome}`);
    return meeting;
  }
}

export const salesMeetingService = new SalesMeetingService();
