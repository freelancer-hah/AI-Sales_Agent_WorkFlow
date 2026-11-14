import { Request, Response, NextFunction } from 'express';
import { salesMeetingService } from '../services/meeting/salesMeetingService.js';
import { meetingAvailabilityService } from '../services/meeting/meetingAvailabilityService.js';
import { geminiMeetingParserService } from '../services/meeting/geminiMeetingParserService.js';
import { icsCalendarService } from '../services/meeting/icsCalendarService.js';
import { meetingReminderService } from '../services/meeting/meetingReminderService.js';
import { executiveDossierService } from '../services/meeting/executiveDossierService.js';
import { EmailReply } from '../models/EmailReply.js';
import { OutreachContact } from '../models/OutreachContact.js';
import { logger } from '../config/logger.js';

/**
 * GET /api/meetings
 * List meetings with optional filters & pagination
 */
export async function getMeetings(req: Request, res: Response, Next: NextFunction) {
  try {
    const { status, companyId, contactId, startDate, endDate, page, limit } = req.query;

    const result = await salesMeetingService.getMeetings(
      {
        status: status as any,
        companyId: companyId as string,
        contactId: contactId as string,
        startDate: startDate as string,
        endDate: endDate as string,
      },
      {
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      }
    );

    res.json({ success: true, data: result.meetings, pagination: { total: result.total, page: result.page, totalPages: result.totalPages } });
  } catch (error) {
    Next(error);
  }
}

/**
 * GET /api/meetings/stats
 * Pipeline statistics
 */
export async function getMeetingStats(req: Request, res: Response, Next: NextFunction) {
  try {
    const stats = await salesMeetingService.getMeetingStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    Next(error);
  }
}

/**
 * GET /api/meetings/availability/slots
 * Fetch bookable slots
 */
export async function getAvailableSlots(req: Request, res: Response, Next: NextFunction) {
  try {
    const { startDate, endDate, timezone, durationMinutes } = req.query;

    const slots = await meetingAvailabilityService.getAvailableSlots({
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      timezone: timezone as string,
      durationMinutes: durationMinutes ? parseInt(durationMinutes as string, 10) : undefined,
    });

    res.json({ success: true, count: slots.length, data: slots });
  } catch (error) {
    Next(error);
  }
}

/**
 * GET /api/meetings/availability/settings
 * Get host availability settings
 */
export async function getHostAvailability(req: Request, res: Response, Next: NextFunction) {
  try {
    const availability = await meetingAvailabilityService.getHostAvailability();
    res.json({ success: true, data: availability });
  } catch (error) {
    Next(error);
  }
}

/**
 * PUT /api/meetings/availability/settings
 * Update host availability settings
 */
export async function updateHostAvailability(req: Request, res: Response, Next: NextFunction) {
  try {
    const updated = await meetingAvailabilityService.updateHostAvailability(req.body);
    res.json({ success: true, message: 'Host availability updated successfully', data: updated });
  } catch (error) {
    Next(error);
  }
}

/**
 * POST /api/meetings/propose-slots
 * Generate top proposed slots for a contact
 */
export async function proposeSlots(req: Request, res: Response, Next: NextFunction) {
  try {
    const { contactId, count } = req.body;
    if (!contactId) {
      return res.status(400).json({ success: false, error: 'contactId is required' });
    }

    const slots = await salesMeetingService.proposeSlotsForProspect(contactId, count || 3);
    res.json({ success: true, data: slots });
  } catch (error) {
    Next(error);
  }
}

/**
 * GET /api/meetings/:id
 * Get single meeting detail
 */
export async function getMeetingById(req: Request, res: Response, Next: NextFunction) {
  try {
    const meeting = await salesMeetingService.getMeetingById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }
    res.json({ success: true, data: meeting });
  } catch (error) {
    Next(error);
  }
}

/**
 * POST /api/meetings
 * Schedule a new meeting
 */
export async function createMeeting(req: Request, res: Response, Next: NextFunction) {
  try {
    const { companyId, contactId, startTime } = req.body;
    if (!companyId || !contactId || !startTime) {
      return res.status(400).json({
        success: false,
        error: 'companyId, contactId, and startTime are required fields',
      });
    }

    const meeting = await salesMeetingService.createMeeting(req.body);
    res.status(201).json({
      success: true,
      message: 'Sales meeting successfully scheduled',
      data: meeting,
    });
  } catch (error: any) {
    logger.error('Failed to create sales meeting', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to schedule meeting' });
  }
}

/**
 * PATCH /api/meetings/:id/status
 * Update meeting status (confirm, reschedule, cancel, complete, no-show)
 */
export async function updateMeetingStatus(req: Request, res: Response, Next: NextFunction) {
  try {
    const { status, cancellationReason, rescheduleReason, meetingOutcome } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, error: 'status is required' });
    }

    const meeting = await salesMeetingService.updateMeetingStatus(req.params.id, status, {
      cancellationReason,
      rescheduleReason,
      meetingOutcome,
    });

    res.json({ success: true, message: `Meeting status updated to ${status}`, data: meeting });
  } catch (error: any) {
    logger.error('Failed to update meeting status', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to update meeting status' });
  }
}

/**
 * POST /api/meetings/parse-slots
 * Parse meeting preferences from email text using Gemini NLP.
 * If messageText is omitted, automatically finds the prospect's latest inbound reply!
 */
export async function parseMeetingSlots(req: Request, res: Response, Next: NextFunction) {
  try {
    let { messageText, contactId, companyId, referenceDate } = req.body;

    let autoDetectedMessage: string | null = null;
    let autoDetectedSubject: string | null = null;

    // If messageText is NOT supplied, auto-fetch the prospect's latest inbound email reply
    if (!messageText && (contactId || companyId)) {
      const orConditions: any[] = [];
      if (contactId) {
        orConditions.push({ contactId });
        const contact = await OutreachContact.findById(contactId);
        if (contact?.email) {
          orConditions.push({ senderEmail: contact.email.toLowerCase().trim() });
        }
      }
      if (companyId) {
        orConditions.push({ companyId });
      }

      if (orConditions.length > 0) {
        // Priority 1: Inbound replies with meeting_request or interested
        const prioritizedReply = await EmailReply.findOne({
          $or: orConditions,
          classification: { $in: ['meeting_request', 'interested', 'question'] },
        }).sort({ receivedAt: -1 });

        // Priority 2: Fallback to the latest reply from that contact/company
        const reply =
          prioritizedReply ||
          (await EmailReply.findOne({
            $or: orConditions,
          }).sort({ receivedAt: -1 }));

        if (reply && reply.body) {
          messageText = reply.body;
          autoDetectedMessage = reply.body;
          autoDetectedSubject = reply.subject;
        }
      }
    }

    if (!messageText) {
      if (!contactId && !companyId) {
        return res.status(400).json({ success: false, error: 'messageText is required' });
      }

      return res.json({
        success: true,
        data: {
          intent: 'ambiguous',
          confidence: 'low',
          parsedDateTime: null,
          durationMinutes: 30,
          suggestedAction: 'ask_clarification',
          notes: 'No inbound message found for this prospect yet. Please specify time or enter custom notes below.',
          sourceMessage: null,
          sourceSubject: null,
        },
      });
    }

    const result = await geminiMeetingParserService.parseMeetingIntent(messageText, {
      contactId,
      referenceDate: referenceDate ? new Date(referenceDate) : undefined,
    });

    res.json({
      success: true,
      data: {
        ...result,
        sourceMessage: autoDetectedMessage || messageText,
        sourceSubject: autoDetectedSubject || null,
      },
    });
  } catch (error: any) {
    logger.error('Failed to parse meeting intent', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to parse meeting intent' });
  }
}

/**
 * GET /api/meetings/:id/ics
 * Download standard RFC 5545 .ics calendar invite
 */
export async function downloadMeetingIcs(req: Request, res: Response, Next: NextFunction) {
  try {
    const meeting = await salesMeetingService.getMeetingById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    const icsContent = icsCalendarService.generateIcs(meeting);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8; method=REQUEST');
    res.setHeader('Content-Disposition', `attachment; filename="invite-${meeting._id}.ics"`);
    res.status(200).send(icsContent);
  } catch (error: any) {
    logger.error('Failed to generate .ics file', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to export .ics file' });
  }
}

/**
 * POST /api/meetings/:id/generate-invite-draft
 * Generate email invitation draft with .ics attachment (subject to human approval)
 */
export async function generateMeetingInviteDraft(req: Request, res: Response, Next: NextFunction) {
  try {
    const draft = await geminiMeetingParserService.generateMeetingInviteDraft(req.params.id);
    res.json({
      success: true,
      message: 'Meeting invite draft successfully generated for review',
      data: draft,
    });
  } catch (error: any) {
    logger.error('Failed to generate invite draft', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to generate invite draft' });
  }
}

/**
 * POST /api/meetings/:id/reschedule
 * Reschedules a meeting to a new time
 */
export async function rescheduleMeeting(req: Request, res: Response, Next: NextFunction) {
  try {
    const { newStartTime, reason, force } = req.body;
    if (!newStartTime) {
      return res.status(400).json({ success: false, error: 'newStartTime is required' });
    }

    const result = await salesMeetingService.rescheduleMeeting(req.params.id, newStartTime, reason, { force });
    res.json({
      success: true,
      message: 'Meeting successfully rescheduled',
      data: result.meeting,
    });
  } catch (error: any) {
    logger.error('Failed to reschedule meeting', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to reschedule meeting' });
  }
}

/**
 * POST /api/meetings/:id/cancel
 * Cancels a meeting with an audit reason
 */
export async function cancelMeeting(req: Request, res: Response, Next: NextFunction) {
  try {
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ success: false, error: 'Cancellation reason is required' });
    }

    const result = await salesMeetingService.cancelMeeting(req.params.id, reason);
    res.json({
      success: true,
      message: 'Meeting successfully cancelled',
      data: result.meeting,
    });
  } catch (error: any) {
    logger.error('Failed to cancel meeting', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to cancel meeting' });
  }
}

/**
 * POST /api/meetings/:id/outcome
 * Logs the meeting completion outcome
 */
export async function recordMeetingOutcome(req: Request, res: Response, Next: NextFunction) {
  try {
    const { outcome, notes } = req.body;
    if (!outcome) {
      return res.status(400).json({ success: false, error: 'outcome is required' });
    }

    const meeting = await salesMeetingService.recordMeetingOutcome(req.params.id, outcome, notes);
    res.json({
      success: true,
      message: 'Meeting outcome recorded successfully',
      data: meeting,
    });
  } catch (error: any) {
    logger.error('Failed to log meeting outcome', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to log meeting outcome' });
  }
}

/**
 * POST /api/meetings/:id/remind
 * Sends a reminder or recovery email draft for a meeting
 */
export async function sendMeetingReminder(req: Request, res: Response, Next: NextFunction) {
  try {
    const { reminderType } = req.body;
    if (!reminderType || !['24h', '1h', 'followup', 'noshow'].includes(reminderType)) {
      return res.status(400).json({
        success: false,
        error: 'reminderType must be one of: "24h", "1h", "followup", "noshow"',
      });
    }

    const result = await meetingReminderService.generateReminder(req.params.id, reminderType);
    res.json({
      success: true,
      message: `${reminderType} reminder draft generated successfully`,
      data: result,
    });
  } catch (error: any) {
    logger.error('Failed to generate meeting reminder', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to generate reminder' });
  }
}

/**
 * POST /api/meetings/reminders/process-due
 * Process all scheduled upcoming 24h/1h reminders
 */
export async function processDueReminders(req: Request, res: Response, Next: NextFunction) {
  try {
    const summary = await meetingReminderService.processDueReminders();
    res.json({
      success: true,
      message: `Processed ${summary.processedCount} due meeting reminders`,
      data: summary,
    });
  } catch (error: any) {
    logger.error('Failed to process due reminders', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to process reminders' });
  }
}

/**
 * GET /api/meetings/:id/dossier
 * Get executive closer dossier for meeting
 */
export async function getMeetingDossier(req: Request, res: Response, Next: NextFunction) {
  try {
    const meeting = await salesMeetingService.getMeetingById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    // If dossier already exists, return it or generate fresh
    const dossier = await executiveDossierService.generateDossier(req.params.id);
    res.json({ success: true, data: dossier });
  } catch (error: any) {
    logger.error('Failed to get meeting dossier', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to get dossier' });
  }
}

/**
 * POST /api/meetings/:id/dossier/generate
 * Re-generate executive closer dossier
 */
export async function generateMeetingDossier(req: Request, res: Response, Next: NextFunction) {
  try {
    const dossier = await executiveDossierService.generateDossier(req.params.id);
    res.json({
      success: true,
      message: 'Executive closer dossier successfully generated',
      data: dossier,
    });
  } catch (error: any) {
    logger.error('Failed to generate meeting dossier', error);
    res.status(400).json({ success: false, error: error.message || 'Failed to generate dossier' });
  }
}




