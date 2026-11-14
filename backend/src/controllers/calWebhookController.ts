import { Request, Response } from 'express';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { SalesMeeting } from '../models/SalesMeeting.js';
import { OutreachContact } from '../models/OutreachContact.js';
import { Company } from '../models/Company.js';
import { FollowUpJob } from '../models/FollowUpJob.js';
import { executiveDossierService } from '../services/meeting/executiveDossierService.js';
import { bookingLinkService } from '../services/outreach/bookingLinkService.js';

export class CalWebhookController {
  /**
   * Verifies the x-cal-signature-256 HMAC header
   */
  private verifySignature(req: Request): boolean {
    const signature = req.headers['x-cal-signature-256'] as string;
    const secret = env.CAL_WEBHOOK_SECRET;

    if (!secret || !signature) {
      // Allow unauthenticated in development if secret not enforced
      if (env.NODE_ENV !== 'production') {
        return true;
      }
      return false;
    }

    try {
      const payloadString = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const hmac = crypto.createHmac('sha256', secret);
      const digest = hmac.update(payloadString).digest('hex');
      return crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(digest, 'utf8'));
    } catch (err: any) {
      logger.warn(`CalWebhook: Signature check exception: ${err.message}`);
      return false;
    }
  }

  /**
   * Returns current Cal.diy configuration for frontend embeds and link generators
   */
  public getConfig = async (req: Request, res: Response) => {
    try {
      const config = bookingLinkService.getEmbedConfig();
      res.json({
        success: true,
        data: config,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  /**
   * Handles incoming webhooks from Cal.diy / Cal.com
   */
  public handleWebhook = async (req: Request, res: Response) => {
    try {
      if (!this.verifySignature(req)) {
        logger.warn('CalWebhook: Invalid or missing x-cal-signature-256 signature.');
        return res.status(401).json({ success: false, error: 'Invalid webhook signature' });
      }

      const body = req.body || {};
      const triggerEvent = body.triggerEvent || body.type || body.event;
      const payload = body.payload || body;

      logger.info(`CalWebhook received: ${triggerEvent} (Booking UID: ${payload.uid || payload.bookingUid})`);

      switch (triggerEvent) {
        case 'BOOKING_CREATED':
          return await this.handleBookingCreated(payload, res);
        case 'BOOKING_RESCHEDULED':
          return await this.handleBookingRescheduled(payload, res);
        case 'BOOKING_CANCELLED':
          return await this.handleBookingCancelled(payload, res);
        default:
          logger.info(`CalWebhook: Unhandled event type "${triggerEvent}"`);
          return res.json({ success: true, message: `Event ${triggerEvent} received and acknowledged` });
      }
    } catch (error: any) {
      logger.error('CalWebhook: Error processing webhook event', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  };

  /**
   * Processes a newly confirmed booking from Cal.diy
   */
  private async handleBookingCreated(payload: any, res: Response) {
    const bookingUid = payload.uid || payload.bookingUid || `cal_${Date.now()}`;
    const startTime = new Date(payload.startTime);
    const endTime = payload.endTime ? new Date(payload.endTime) : new Date(startTime.getTime() + (payload.length || 30) * 60000);
    const durationMinutes = payload.length || Math.round((endTime.getTime() - startTime.getTime()) / 60000) || 30;

    // Extract Attendee Details
    const attendee = (payload.attendees && payload.attendees[0]) || {
      name: payload.responses?.name?.value || payload.responses?.name || 'Prospect Attendee',
      email: payload.responses?.email?.value || payload.responses?.email || 'prospect@example.com',
      timeZone: payload.organizer?.timeZone || 'UTC',
    };

    const attendeeEmail = (attendee.email || '').toLowerCase().trim();
    const attendeeName = attendee.name || 'Prospect Attendee';

    // Extract Location & Meeting URL (Google Meet / Zoom / Cal Video)
    const meetingUrl = payload.location || payload.metadata?.videoCallUrl || 'https://meet.google.com';
    const isZoom = meetingUrl.toLowerCase().includes('zoom.us');
    const locationType = isZoom ? 'zoom' : 'google_meet';

    // 1. Locate Contact & Company
    let contact = await OutreachContact.findOne({
      normalizedEmail: attendeeEmail,
    });

    let company: any = null;

    if (contact) {
      company = await Company.findById(contact.companyId);
      // Mark contact status as meeting_scheduled
      contact.outreachStatus = 'meeting_scheduled';
      await contact.save();
    } else {
      // Fallback: match by email domain if corporate domain
      const emailDomain = attendeeEmail.split('@')[1];
      const isPublicProvider = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'].includes(emailDomain);

      if (!isPublicProvider && emailDomain) {
        company = await Company.findOne({ domain: emailDomain });
      }

      // If still no company found, create a placeholder lead company
      if (!company) {
        const companyName = attendeeName.split(' ')[0] ? `${attendeeName.split(' ')[0]}'s Company` : 'Prospect Company';
        company = await Company.create({
          companyName,
          normalizedName: companyName.toLowerCase(),
          website: emailDomain ? `https://${emailDomain}` : '',
          domain: emailDomain || '',
          industry: 'Technology',
          category: 'B2B Lead',
          description: `Discovered via Cal.diy self-serve booking by ${attendeeName}.`,
          country: 'Pakistan',
          city: 'Lahore',
          leadScore: 85,
          reviewStatus: 'contacted',
          sources: [
            {
              sourceUrl: env.CAL_BASE_URL,
              sourceType: 'cal_diy',
              extractedField: 'meeting_booking',
              supportingText: `Booked discovery session via Cal.diy`,
              fetchedAt: new Date(),
            },
          ],
        });
      }

      // Create new OutreachContact
      contact = await OutreachContact.create({
        companyId: company._id,
        email: attendeeEmail,
        normalizedEmail: attendeeEmail,
        emailSourceUrl: env.CAL_BASE_URL,
        contactName: attendeeName,
        jobTitle: 'Decision Maker',
        validationStatus: 'verified',
        outreachStatus: 'meeting_scheduled',
        suppressionStatus: { isSuppressed: false },
        notes: 'Booked directly via Cal.diy schedule link',
      });
    }

    if (company && company.reviewStatus !== 'contacted') {
      company.reviewStatus = 'contacted';
      await company.save();
    }

    // 2. Cancel any pending automated cold follow-up jobs for this contact
    try {
      await FollowUpJob.updateMany(
        { contactId: contact._id, status: 'scheduled' },
        { $set: { status: 'cancelled' } }
      );
      logger.info(`CalWebhook: Cancelled pending follow-up jobs for contact ${contact._id}`);
    } catch (fErr: any) {
      logger.warn(`CalWebhook: Failed to cancel follow-up jobs: ${fErr.message}`);
    }

    // 3. Upsert SalesMeeting in MongoDB
    let meeting = await SalesMeeting.findOne({ icsUid: bookingUid });

    if (!meeting) {
      meeting = new SalesMeeting({
        companyId: company._id,
        contactId: contact._id,
        title: payload.title || `Cybells AI Discovery Session with ${company.companyName}`,
        description: payload.description || 'Automated discovery call scheduled via Cal.diy',
        meetingType: 'discovery_call',
        startTime,
        endTime,
        durationMinutes,
        timezone: attendee.timeZone || 'Asia/Karachi',
        status: 'confirmed',
        locationType,
        meetingUrl,
        icsUid: bookingUid,
        sequence: 1,
        assignedAE: payload.organizer?.name || 'Hafiz (Sales Closer)',
        attendees: [
          {
            name: payload.organizer?.name || 'Hafiz from Cybells',
            email: payload.organizer?.email || env.SENDER_EMAIL,
            role: 'host',
            status: 'accepted',
          },
          {
            name: attendeeName,
            email: attendeeEmail,
            role: 'prospect',
            status: 'accepted',
          },
        ],
      });
      await meeting.save();
      logger.info(`CalWebhook: Created new SalesMeeting ${meeting._id} for ${attendeeEmail}`);
    } else {
      meeting.startTime = startTime;
      meeting.endTime = endTime;
      meeting.durationMinutes = durationMinutes;
      meeting.status = 'confirmed';
      meeting.meetingUrl = meetingUrl;
      await meeting.save();
      logger.info(`CalWebhook: Updated existing SalesMeeting ${meeting._id}`);
    }

    // 4. Trigger AI Executive Dossier Generation in Background
    try {
      executiveDossierService.generateDossier(meeting._id.toString()).catch((dErr) => {
        logger.warn(`CalWebhook: Background executive dossier generation error: ${dErr.message}`);
      });
    } catch (dErr: any) {
      logger.warn(`CalWebhook: Failed to kick off dossier generation: ${dErr.message}`);
    }

    return res.json({
      success: true,
      message: 'Booking created and synced with Cybells CRM',
      data: {
        meetingId: meeting._id,
        bookingUid,
        status: meeting.status,
        startTime: meeting.startTime,
        meetingUrl: meeting.meetingUrl,
      },
    });
  }

  /**
   * Handles rescheduled booking
   */
  private async handleBookingRescheduled(payload: any, res: Response) {
    const bookingUid = payload.uid || payload.bookingUid;
    const meeting = await SalesMeeting.findOne({ icsUid: bookingUid });

    if (!meeting) {
      logger.warn(`CalWebhook: Rescheduled meeting with UID ${bookingUid} not found.`);
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    meeting.startTime = new Date(payload.startTime);
    if (payload.endTime) {
      meeting.endTime = new Date(payload.endTime);
    } else {
      meeting.endTime = new Date(meeting.startTime.getTime() + meeting.durationMinutes * 60000);
    }
    meeting.status = 'rescheduled';
    meeting.sequence = (meeting.sequence || 1) + 1;
    meeting.rescheduleReason = payload.rejectionReason || 'Rescheduled via Cal.diy';
    await meeting.save();

    logger.info(`CalWebhook: Meeting ${meeting._id} rescheduled to ${meeting.startTime}`);

    return res.json({
      success: true,
      message: 'Meeting reschedule synced',
      data: { meetingId: meeting._id, newStartTime: meeting.startTime },
    });
  }

  /**
   * Handles cancelled booking
   */
  private async handleBookingCancelled(payload: any, res: Response) {
    const bookingUid = payload.uid || payload.bookingUid;
    const meeting = await SalesMeeting.findOne({ icsUid: bookingUid });

    if (!meeting) {
      logger.warn(`CalWebhook: Cancelled meeting with UID ${bookingUid} not found.`);
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    meeting.status = 'cancelled';
    meeting.cancellationReason = payload.rejectionReason || 'Cancelled by attendee via Cal.diy';
    await meeting.save();

    // Revert contact status from meeting_scheduled to contacted
    await OutreachContact.findByIdAndUpdate(meeting.contactId, {
      $set: { outreachStatus: 'contacted' },
    });

    logger.info(`CalWebhook: Meeting ${meeting._id} marked cancelled.`);

    return res.json({
      success: true,
      message: 'Meeting cancellation synced',
      data: { meetingId: meeting._id, status: meeting.status },
    });
  }
}

export const calWebhookController = new CalWebhookController();

