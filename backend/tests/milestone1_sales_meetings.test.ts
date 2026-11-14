import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../src/app.js';
import { Company } from '../src/models/Company.js';
import { OutreachContact } from '../src/models/OutreachContact.js';
import { SuppressionList } from '../src/models/SuppressionList.js';
import { LeadQualification } from '../src/models/LeadQualification.js';
import { QualificationActivity } from '../src/models/QualificationActivity.js';
import { HostAvailability } from '../src/models/HostAvailability.js';
import { SalesMeeting } from '../src/models/SalesMeeting.js';
import { meetingAvailabilityService } from '../src/services/meeting/meetingAvailabilityService.js';
import { salesMeetingService } from '../src/services/meeting/salesMeetingService.js';

describe('Phase 4 - Milestone 1: Sales Meeting Database Models, Host Availability Engine & Direct Booking Core', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Company.deleteMany({});
    await OutreachContact.deleteMany({});
    await SuppressionList.deleteMany({});
    await LeadQualification.deleteMany({});
    await QualificationActivity.deleteMany({});
    await HostAvailability.deleteMany({});
    await SalesMeeting.deleteMany({});
  });

  /**
   * Helper to find a future date on a specific weekday (e.g. Monday = 1, Friday = 5, Sunday = 0)
   * Ensures all weekdays in the same week share the same base Monday.
   */
  const getNextWeekday = (targetDay: number, weeksAhead: number = 1): Date => {
    const d = new Date();
    d.setDate(d.getDate() + 7 * weeksAhead);
    // Find Monday of that target week
    while (d.getDay() !== 1) {
      d.setDate(d.getDate() + 1);
    }
    // Calculate offset from Monday (Monday = 1 -> offset 0, Friday = 5 -> offset 4, Sunday = 0 -> offset 6)
    const offset = targetDay === 0 ? 6 : targetDay - 1;
    d.setDate(d.getDate() + offset);
    d.setHours(10, 0, 0, 0);
    return d;
  };

  const createTestCompanyAndContact = async (options?: {
    isSuppressed?: boolean;
    outreachStatus?: any;
  }) => {
    const company = await Company.create({
      companyName: 'Masood Textile Mills',
      normalizedName: 'masood textile mills',
      website: 'https://masoodtextile.com',
      domain: 'masoodtextile.com',
      industry: 'Textiles',
      country: 'Pakistan',
      city: 'Faisalabad',
      aiAnalysis: {
        problems: [{ title: 'Manual QC', problem: 'Manual inspection entry', hypothesis: false }],
        opportunities: [],
        leadScore: 85,
        scoreExplanation: 'Excellent candidate for automation',
        evidence: [],
        missingInformation: [],
      },
    });

    const contact = await OutreachContact.create({
      companyId: company._id,
      email: 'waqas@masoodtextile.com',
      normalizedEmail: 'waqas@masoodtextile.com',
      contactName: 'Waqas Ahmad',
      jobTitle: 'VP Operations',
      emailSourceUrl: 'https://masoodtextile.com/team',
      validationStatus: 'verified',
      outreachStatus: options?.outreachStatus || 'qualified',
      suppressionStatus: {
        isSuppressed: !!options?.isSuppressed,
        reason: options?.isSuppressed ? 'Requested unsubscribe' : '',
        suppressedAt: options?.isSuppressed ? new Date() : undefined,
      },
    });

    const qualification = await LeadQualification.create({
      companyId: company._id,
      contactId: contact._id,
      sourceType: 'email',
      qualificationStatus: 'qualified',
      interestLevel: 'high',
      qualificationScore: 85,
      qualificationSummary: 'High priority lead ready for discovery call.',
    });

    return { company, contact, qualification };
  };

  // =========================================================================
  // 1. Host Availability Engine Tests
  // =========================================================================
  describe('1. Host Availability Engine (meetingAvailabilityService)', () => {
    it('initializes default host availability settings with Mon-Fri 09:00-18:00 and 15m buffer', async () => {
      const availability = await meetingAvailabilityService.getHostAvailability();

      expect(availability).toBeDefined();
      expect(availability.hostName).toBe('Cybells Sales Specialist');
      expect(availability.hostEmail).toBe('sales@cybells.com');
      expect(availability.timezone).toBe('Asia/Karachi');
      expect(availability.meetingDurationMinutes).toBe(30);
      expect(availability.bufferMinutes).toBe(15);
      expect(availability.maxMeetingsPerDay).toBe(6);

      // Verify Monday is enabled and Sunday is disabled
      const monday = availability.weeklySchedule.find((s) => s.dayOfWeek === 1);
      const sunday = availability.weeklySchedule.find((s) => s.dayOfWeek === 0);
      expect(monday?.isEnabled).toBe(true);
      expect(sunday?.isEnabled).toBe(false);
    });

    it('updates host availability settings with custom duration and buffer', async () => {
      const updated = await meetingAvailabilityService.updateHostAvailability({
        meetingDurationMinutes: 45,
        bufferMinutes: 20,
        hostName: 'Senior AI Solutions Architect',
      });

      expect(updated.meetingDurationMinutes).toBe(45);
      expect(updated.bufferMinutes).toBe(20);
      expect(updated.hostName).toBe('Senior AI Solutions Architect');
    });

    it('calculates available slots within working hours and excludes weekends', async () => {
      // Pick next Monday to Friday
      const nextMonday = getNextWeekday(1, 1);
      const nextFriday = getNextWeekday(5, 1);

      const slots = await meetingAvailabilityService.getAvailableSlots({
        startDate: nextMonday,
        endDate: nextFriday,
        durationMinutes: 30,
      });

      expect(slots.length).toBeGreaterThan(0);
      for (const slot of slots) {
        const slotDate = new Date(slot.start);
        const day = slotDate.getDay();
        expect(day).toBeGreaterThanOrEqual(1);
        expect(day).toBeLessThanOrEqual(5);
        expect(slot.durationMinutes).toBe(30);
      }
    });

    it('enforces buffer time and excludes conflicting slots when a meeting is booked', async () => {
      const { company, contact } = await createTestCompanyAndContact();
      const monday = getNextWeekday(1, 1);

      // Book a meeting from 11:00 to 11:30 on Monday
      const meetingStart = new Date(monday);
      meetingStart.setHours(11, 0, 0, 0);
      const meetingEnd = new Date(monday);
      meetingEnd.setHours(11, 30, 0, 0);

      await SalesMeeting.create({
        companyId: company._id,
        contactId: contact._id,
        title: 'Existing Call',
        startTime: meetingStart,
        endTime: meetingEnd,
        status: 'confirmed',
        icsUid: 'test-ics-1@cybells.com',
        meetingUrl: 'https://meet.google.com/test-1',
      });

      // Get slots for that specific Monday
      const dayStart = new Date(monday);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(monday);
      dayEnd.setHours(23, 59, 59, 999);

      const slots = await meetingAvailabilityService.getAvailableSlots({
        startDate: dayStart,
        endDate: dayEnd,
        durationMinutes: 30,
      });

      // With a 15-minute buffer:
      // Meeting occupies 11:00 - 11:30
      // Blocked window is 10:45 to 11:45
      // 10:30-11:00 (ends 11:00, overlaps 10:45-11:45) -> BLOCKED
      // 11:00-11:30 (exact meeting) -> BLOCKED
      // 11:30-12:00 (starts 11:30, overlaps 10:45-11:45) -> BLOCKED
      const blockedSlot = slots.find((s) => {
        const sDate = new Date(s.start);
        return sDate.getHours() === 11 && sDate.getMinutes() === 0;
      });
      expect(blockedSlot).toBeUndefined();

      const bufferSlotBefore = slots.find((s) => {
        const sDate = new Date(s.start);
        return sDate.getHours() === 10 && sDate.getMinutes() === 30;
      });
      expect(bufferSlotBefore).toBeUndefined();

      const bufferSlotAfter = slots.find((s) => {
        const sDate = new Date(s.start);
        return sDate.getHours() === 11 && sDate.getMinutes() === 30;
      });
      expect(bufferSlotAfter).toBeUndefined();
    });

    it('respects blackout dates and returns zero slots on holidays', async () => {
      const tuesday = getNextWeekday(2, 1);
      const blackoutDate = new Date(tuesday);
      blackoutDate.setHours(0, 0, 0, 0);

      await meetingAvailabilityService.updateHostAvailability({
        blackoutDates: [blackoutDate],
      });

      const dayStart = new Date(tuesday);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(tuesday);
      dayEnd.setHours(23, 59, 59, 999);

      const slots = await meetingAvailabilityService.getAvailableSlots({
        startDate: dayStart,
        endDate: dayEnd,
      });

      expect(slots.length).toBe(0);
    });

    it('validateSlot correctly detects conflicts, past times, and weekend dates', async () => {
      const monday = getNextWeekday(1, 1);
      const start = new Date(monday);
      start.setHours(14, 0, 0, 0);
      const end = new Date(monday);
      end.setHours(14, 30, 0, 0);

      const validCheck = await meetingAvailabilityService.validateSlot(start, end);
      expect(validCheck.isValid).toBe(true);

      // Past time check
      const pastStart = new Date(Date.now() - 3600000);
      const pastEnd = new Date(Date.now() - 1800000);
      const pastCheck = await meetingAvailabilityService.validateSlot(pastStart, pastEnd);
      expect(pastCheck.isValid).toBe(false);
      expect(pastCheck.conflictReason).toContain('past');

      // Weekend check
      const sunday = getNextWeekday(0, 1);
      const sundayStart = new Date(sunday);
      sundayStart.setHours(10, 0, 0, 0);
      const sundayEnd = new Date(sunday);
      sundayEnd.setHours(10, 30, 0, 0);
      const weekendCheck = await meetingAvailabilityService.validateSlot(sundayStart, sundayEnd);
      expect(weekendCheck.isValid).toBe(false);
      expect(weekendCheck.conflictReason).toContain('Host does not accept meetings');
    });
  });

  // =========================================================================
  // 2. Sales Meeting Booking Service Tests
  // =========================================================================
  describe('2. Sales Meeting Booking Service (salesMeetingService)', () => {
    it('refuses to schedule meeting for suppressed or unsubscribed contacts', async () => {
      const { company, contact } = await createTestCompanyAndContact({ isSuppressed: true });
      const nextMon = getNextWeekday(1, 1);

      await expect(
        salesMeetingService.createMeeting({
          companyId: company._id,
          contactId: contact._id,
          startTime: nextMon,
        })
      ).rejects.toThrow('suppressed or unsubscribed');
    });

    it('successfully books a meeting, provisions Google Meet URL, assigns attendees, and updates contact status', async () => {
      const { company, contact, qualification } = await createTestCompanyAndContact();
      const nextWed = getNextWeekday(3, 1);
      nextWed.setHours(15, 0, 0, 0);

      const meeting = await salesMeetingService.createMeeting({
        companyId: company._id,
        contactId: contact._id,
        qualificationId: qualification._id,
        title: 'Cybells AI Automation Discovery Session',
        startTime: nextWed,
        durationMinutes: 30,
      });

      expect(meeting).toBeDefined();
      expect(meeting.title).toBe('Cybells AI Automation Discovery Session');
      expect(meeting.status).toBe('confirmed');
      expect(meeting.meetingUrl).toMatch(/https:\/\/meet\.google\.com\/cyb-/);
      expect(meeting.icsUid).toMatch(/@cybells\.com$/);
      expect(meeting.sequence).toBe(0);

      // Verify Attendees (host + prospect)
      expect(meeting.attendees.length).toBe(2);
      expect(meeting.attendees[0].role).toBe('host');
      expect(meeting.attendees[0].email).toBe('sales@cybells.com');
      expect(meeting.attendees[1].role).toBe('prospect');
      expect(meeting.attendees[1].email).toBe('waqas@masoodtextile.com');

      // Verify Contact status updated to meeting_scheduled
      const updatedContact = await OutreachContact.findById(contact._id);
      expect(updatedContact?.outreachStatus).toBe('meeting_scheduled');

      // Verify QualificationActivity audit log created
      const activity = await QualificationActivity.findOne({
        qualificationId: qualification._id,
        activityType: 'meeting_scheduled',
      });
      expect(activity).toBeDefined();
      expect(activity?.description).toContain('Discovery meeting scheduled');
    });

    it('rejects double-booking when requested slot conflicts with existing meeting', async () => {
      const { company, contact } = await createTestCompanyAndContact();
      const nextThu = getNextWeekday(4, 1);
      nextThu.setHours(10, 0, 0, 0);

      // First meeting
      await salesMeetingService.createMeeting({
        companyId: company._id,
        contactId: contact._id,
        startTime: nextThu,
        durationMinutes: 30,
      });

      // Second meeting on same slot should fail
      await expect(
        salesMeetingService.createMeeting({
          companyId: company._id,
          contactId: contact._id,
          startTime: nextThu,
          durationMinutes: 30,
        })
      ).rejects.toThrow('Slot validation failed');
    });

    it('updates meeting status with cancellation reason and completed outcome notes', async () => {
      const { company, contact } = await createTestCompanyAndContact();
      const nextFri = getNextWeekday(5, 1);
      nextFri.setHours(16, 0, 0, 0);

      const meeting = await salesMeetingService.createMeeting({
        companyId: company._id,
        contactId: contact._id,
        startTime: nextFri,
        durationMinutes: 30,
      });

      // Cancel with reason
      const cancelled = await salesMeetingService.updateMeetingStatus(
        meeting._id.toString(),
        'cancelled',
        { cancellationReason: 'Prospect requested to postpone due to internal audit' }
      );
      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.cancellationReason).toContain('internal audit');

      // Complete with outcome
      const completed = await salesMeetingService.updateMeetingStatus(
        meeting._id.toString(),
        'completed',
        {
          meetingOutcome: {
            outcome: 'deal_in_progress',
            notes: 'High interest in garment manifest automation. Proposal to follow.',
          },
        }
      );
      expect(completed.status).toBe('completed');
      expect(completed.meetingOutcome?.outcome).toBe('deal_in_progress');
      expect(completed.meetingOutcome?.notes).toContain('manifest automation');
    });

    it('proposes top optimal slots for a prospect', async () => {
      const { contact } = await createTestCompanyAndContact();

      const proposed = await salesMeetingService.proposeSlotsForProspect(contact._id.toString(), 3);
      expect(proposed.length).toBeLessThanOrEqual(3);
      expect(proposed.length).toBeGreaterThan(0);
      expect(proposed[0].start).toBeDefined();
      expect(proposed[0].timeStr).toBeDefined();
    });

    it('aggregates pipeline statistics accurately', async () => {
      const { company, contact } = await createTestCompanyAndContact();
      const mon = getNextWeekday(1, 1);
      mon.setHours(10, 0, 0, 0);

      const meeting = await salesMeetingService.createMeeting({
        companyId: company._id,
        contactId: contact._id,
        startTime: mon,
        durationMinutes: 30,
      });

      const stats = await salesMeetingService.getMeetingStats();
      expect(stats.total).toBe(1);
      expect(stats.confirmed).toBe(1);
      expect(stats.upcoming).toBe(1);
      expect(stats.completed).toBe(0);
      expect(stats.cancelled).toBe(0);
    });
  });

  // =========================================================================
  // 3. REST API Endpoints Integration Tests (/api/meetings)
  // =========================================================================
  describe('3. REST API Endpoints Integration (/api/meetings)', () => {
    it('GET /api/meetings/availability/settings returns host settings', async () => {
      const res = await request(app).get('/api/meetings/availability/settings');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.hostEmail).toBe('sales@cybells.com');
      expect(res.body.data.weeklySchedule.length).toBe(7);
    });

    it('PUT /api/meetings/availability/settings updates host settings', async () => {
      const res = await request(app)
        .put('/api/meetings/availability/settings')
        .send({ maxMeetingsPerDay: 8, meetingDurationMinutes: 45 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.maxMeetingsPerDay).toBe(8);
      expect(res.body.data.meetingDurationMinutes).toBe(45);
    });

    it('GET /api/meetings/availability/slots returns available slots list', async () => {
      const mon = getNextWeekday(1, 1);
      const fri = getNextWeekday(5, 1);

      const res = await request(app)
        .get('/api/meetings/availability/slots')
        .query({ startDate: mon.toISOString(), endDate: fri.toISOString() });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('POST /api/meetings schedules a new meeting via API', async () => {
      const { company, contact } = await createTestCompanyAndContact();
      const mon = getNextWeekday(1, 1);
      mon.setHours(12, 0, 0, 0);

      const res = await request(app)
        .post('/api/meetings')
        .send({
          companyId: company._id.toString(),
          contactId: contact._id.toString(),
          startTime: mon.toISOString(),
          title: 'API Scheduled Discovery Call',
          durationMinutes: 30,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('API Scheduled Discovery Call');
      expect(res.body.data.status).toBe('confirmed');
    });

    it('GET /api/meetings returns paginated list and filters by status', async () => {
      const { company, contact } = await createTestCompanyAndContact();
      const mon = getNextWeekday(1, 1);
      mon.setHours(13, 0, 0, 0);

      await salesMeetingService.createMeeting({
        companyId: company._id,
        contactId: contact._id,
        startTime: mon,
        durationMinutes: 30,
      });

      const res = await request(app)
        .get('/api/meetings')
        .query({ status: 'confirmed', page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.pagination.total).toBe(1);
    });

    it('GET /api/meetings/:id returns full detail with populated relations', async () => {
      const { company, contact } = await createTestCompanyAndContact();
      const mon = getNextWeekday(1, 1);
      mon.setHours(14, 0, 0, 0);

      const meeting = await salesMeetingService.createMeeting({
        companyId: company._id,
        contactId: contact._id,
        startTime: mon,
        durationMinutes: 30,
      });

      const res = await request(app).get(`/api/meetings/${meeting._id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.companyId.companyName).toBe('Masood Textile Mills');
      expect(res.body.data.contactId.email).toBe('waqas@masoodtextile.com');
    });

    it('PATCH /api/meetings/:id/status updates status via API', async () => {
      const { company, contact } = await createTestCompanyAndContact();
      const mon = getNextWeekday(1, 1);
      mon.setHours(15, 0, 0, 0);

      const meeting = await salesMeetingService.createMeeting({
        companyId: company._id,
        contactId: contact._id,
        startTime: mon,
        durationMinutes: 30,
      });

      const res = await request(app)
        .patch(`/api/meetings/${meeting._id}/status`)
        .send({ status: 'no_show' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('no_show');
    });

    it('POST /api/meetings/propose-slots returns top slots via API', async () => {
      const { contact } = await createTestCompanyAndContact();

      const res = await request(app)
        .post('/api/meetings/propose-slots')
        .send({ contactId: contact._id.toString(), count: 3 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('GET /api/meetings/stats returns pipeline statistics', async () => {
      const res = await request(app).get('/api/meetings/stats');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBeDefined();
      expect(res.body.data.upcoming).toBeDefined();
    });
  });
});
