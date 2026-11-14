import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../src/app.js';
import { Company } from '../src/models/Company.js';
import { OutreachContact } from '../src/models/OutreachContact.js';
import { SuppressionList } from '../src/models/SuppressionList.js';
import { HostAvailability } from '../src/models/HostAvailability.js';
import { SalesMeeting } from '../src/models/SalesMeeting.js';
import { LeadQualification } from '../src/models/LeadQualification.js';
import { QualificationActivity } from '../src/models/QualificationActivity.js';
import { EmailDraft } from '../src/models/EmailDraft.js';
import { salesMeetingService } from '../src/services/meeting/salesMeetingService.js';
import { meetingReminderService } from '../src/services/meeting/meetingReminderService.js';
import { meetingAvailabilityService } from '../src/services/meeting/meetingAvailabilityService.js';

describe('Phase 4 - Milestone 3: Automated Meeting Follow-Ups, Reschedule / Cancellation Engine & Outreach Integration', () => {
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
    await HostAvailability.deleteMany({});
    await SalesMeeting.deleteMany({});
    await LeadQualification.deleteMany({});
    await QualificationActivity.deleteMany({});
    await EmailDraft.deleteMany({});
  });

  const getNextWeekday = (targetDay: number, weeksAhead: number = 1): Date => {
    const d = new Date();
    d.setDate(d.getDate() + 7 * weeksAhead);
    while (d.getDay() !== 1) {
      d.setDate(d.getDate() + 1);
    }
    const offset = targetDay === 0 ? 6 : targetDay - 1;
    d.setDate(d.getDate() + offset);
    d.setHours(11, 0, 0, 0);
    return d;
  };

  const createTestFixture = async (options?: { isSuppressed?: boolean; outreachStatus?: any }) => {
    const company = await Company.create({
      companyName: 'Masood Textile Mills',
      normalizedName: 'masood textile mills',
      website: 'https://masoodtextile.com',
      domain: 'masoodtextile.com',
      industry: 'Textiles',
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
      },
    });

    const qualification = await LeadQualification.create({
      companyId: company._id,
      contactId: contact._id,
      sourceType: 'email',
      qualificationStatus: 'qualified',
      interestLevel: 'high',
      qualificationScore: 85,
    });

    const nextMon = getNextWeekday(1, 1);
    const meeting = await salesMeetingService.createMeeting({
      companyId: company._id,
      contactId: contact._id,
      qualificationId: qualification._id,
      startTime: nextMon,
      durationMinutes: 30,
      title: 'Cybells AI Automation Discovery Call',
      description: 'Explore custom document extraction for garment production manifests.',
    });

    return { company, contact, qualification, meeting, nextMon };
  };

  // =========================================================================
  // 1. Reschedule Engine Tests
  // =========================================================================
  describe('1. Reschedule Engine (salesMeetingService.rescheduleMeeting)', () => {
    it('reschedules meeting, increments sequence, validates new slot, and generates updated .ics', async () => {
      const { meeting } = await createTestFixture();
      expect(meeting.sequence).toBe(0);

      const nextWed = getNextWeekday(3, 1);
      nextWed.setHours(14, 0, 0, 0);

      const result = await salesMeetingService.rescheduleMeeting(
        meeting._id.toString(),
        nextWed,
        'Prospect requested shift to Wednesday afternoon.'
      );

      expect(result.meeting.status).toBe('rescheduled');
      expect(result.meeting.sequence).toBe(1);
      expect(result.meeting.rescheduleReason).toBe('Prospect requested shift to Wednesday afternoon.');
      expect(new Date(result.meeting.startTime).toISOString()).toBe(nextWed.toISOString());

      // Verify updated .ics has SEQUENCE:1 and METHOD:REQUEST
      expect(result.icsContent).toContain('SEQUENCE:1');
      expect(result.icsContent).toContain('METHOD:REQUEST');

      // Verify QualificationActivity logged
      const activity = await QualificationActivity.findOne({
        qualificationId: meeting.qualificationId,
        title: 'Discovery Meeting Rescheduled',
      });
      expect(activity).toBeDefined();
      expect(activity?.description).toContain('Meeting rescheduled');
    });

    it('rejects reschedule when new slot conflicts with another meeting', async () => {
      const { meeting, company, contact } = await createTestFixture();
      const nextFri = getNextWeekday(5, 1);
      nextFri.setHours(10, 0, 0, 0);

      // Create another conflicting meeting
      await salesMeetingService.createMeeting({
        companyId: company._id,
        contactId: contact._id,
        startTime: nextFri,
        durationMinutes: 30,
      });

      // Attempting to reschedule first meeting to that same slot should fail
      await expect(
        salesMeetingService.rescheduleMeeting(meeting._id.toString(), nextFri)
      ).rejects.toThrow('Cannot reschedule: Slot conflicts with an existing meeting');
    });

    it('refuses to reschedule for suppressed or unsubscribed contacts', async () => {
      const { meeting, contact } = await createTestFixture();

      await OutreachContact.findByIdAndUpdate(contact._id, {
        $set: { 'suppressionStatus.isSuppressed': true, outreachStatus: 'unsubscribed' },
      });

      const nextWed = getNextWeekday(3, 1);
      await expect(
        salesMeetingService.rescheduleMeeting(meeting._id.toString(), nextWed)
      ).rejects.toThrow('suppressed or unsubscribed');
    });
  });

  // =========================================================================
  // 2. Cancellation Engine Tests
  // =========================================================================
  describe('2. Cancellation Engine (salesMeetingService.cancelMeeting)', () => {
    it('cancels meeting, increments sequence, generates METHOD:CANCEL .ics, and frees the slot', async () => {
      const { meeting, nextMon } = await createTestFixture();

      const result = await salesMeetingService.cancelMeeting(
        meeting._id.toString(),
        'Company budget reallocated to ERP migration.'
      );

      expect(result.meeting.status).toBe('cancelled');
      expect(result.meeting.sequence).toBe(1);
      expect(result.meeting.cancellationReason).toBe('Company budget reallocated to ERP migration.');

      // Verify cancellation .ics
      expect(result.icsContent).toContain('METHOD:CANCEL');
      expect(result.icsContent).toContain('STATUS:CANCELLED');
      expect(result.icsContent).toContain('SEQUENCE:1');

      // Verify slot is now free
      const check = await meetingAvailabilityService.validateSlot(
        new Date(nextMon),
        new Date(nextMon.getTime() + 1800000)
      );
      expect(check.isValid).toBe(true);

      // Verify activity audit log
      const activity = await QualificationActivity.findOne({
        qualificationId: meeting.qualificationId,
        title: 'Discovery Meeting Cancelled',
      });
      expect(activity).toBeDefined();
    });
  });

  // =========================================================================
  // 3. Meeting Outcome Logging Tests
  // =========================================================================
  describe('3. Meeting Outcome Logging (salesMeetingService.recordMeetingOutcome)', () => {
    it('records closed_won outcome, marks meeting completed, and cascades converted status to contact', async () => {
      const { meeting, contact } = await createTestFixture();

      const completed = await salesMeetingService.recordMeetingOutcome(
        meeting._id.toString(),
        'closed_won',
        'Signed 12-month contract for shipping manifest document automation.'
      );

      expect(completed.status).toBe('completed');
      expect(completed.meetingOutcome?.outcome).toBe('closed_won');
      expect(completed.meetingOutcome?.notes).toContain('Signed 12-month contract');

      // Contact outreachStatus should be converted
      const updatedContact = await OutreachContact.findById(contact._id);
      expect(updatedContact?.outreachStatus).toBe('converted');
    });

    it('records deal_in_progress outcome and cascades converted status', async () => {
      const { meeting, contact } = await createTestFixture();

      const updated = await salesMeetingService.recordMeetingOutcome(
        meeting._id.toString(),
        'deal_in_progress',
        'Pilot scheduled for Garment City unit.'
      );

      expect(updated.status).toBe('completed');
      expect(updated.meetingOutcome?.outcome).toBe('deal_in_progress');

      const updatedContact = await OutreachContact.findById(contact._id);
      expect(updatedContact?.outreachStatus).toBe('converted');
    });
  });

  // =========================================================================
  // 4. Meeting Reminders & Recovery Cadence Tests
  // =========================================================================
  describe('4. Meeting Reminders & Recovery Cadence (meetingReminderService)', () => {
    it('generates 24-hour advance reminder draft and increments remindersSent', async () => {
      const { meeting } = await createTestFixture();
      expect(meeting.remindersSent).toBe(0);

      const reminder = await meetingReminderService.generateReminder(meeting._id.toString(), '24h');

      expect(reminder.reminderType).toBe('24h');
      expect(reminder.subject).toContain('Reminder: Cybells AI Automation Discovery Call Tomorrow');
      expect(reminder.bodyText).toContain(meeting.meetingUrl);
      expect(reminder.approvalStatus).toBe('pending_approval');
      expect(reminder.requiresHumanReview).toBe(true);

      const updated = await SalesMeeting.findById(meeting._id);
      expect(updated?.remindersSent).toBe(1);
    });

    it('generates 1-hour advance urgent reminder draft with direct Google Meet URL', async () => {
      const { meeting } = await createTestFixture();

      const reminder = await meetingReminderService.generateReminder(meeting._id.toString(), '1h');

      expect(reminder.reminderType).toBe('1h');
      expect(reminder.subject).toContain('Starting in 1 hour');
      expect(reminder.bodyText).toContain('Direct Video Link: ' + meeting.meetingUrl);
      expect(reminder.bodyHtml).toContain('Join Google Meet Room');
    });

    it('generates no-show recovery email draft with fresh proposed candidate slots', async () => {
      const { meeting } = await createTestFixture();

      const recovery = await meetingReminderService.generateReminder(meeting._id.toString(), 'noshow');

      expect(recovery.reminderType).toBe('noshow');
      expect(recovery.subject).toContain('Sorry we missed each other');
      expect(recovery.bodyText).toContain('urgent business priorities come up unexpectedly');
      expect(recovery.bodyText).toContain('Here are a few open times next week');
    });

    it('generates follow-up nudge draft for unconfirmed proposals', async () => {
      const { meeting } = await createTestFixture();

      const nudge = await meetingReminderService.generateReminder(meeting._id.toString(), 'followup');

      expect(nudge.reminderType).toBe('followup');
      expect(nudge.subject).toContain('Following up: Cybells AI Automation Discussion');
      expect(nudge.bodyText).toContain('brief 20-minute discovery chat');
    });

    it('processDueReminders detects and generates reminders for upcoming meetings in time window', async () => {
      const { company, contact } = await createTestFixture();

      // Meeting 24 hours from now
      const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const meeting24 = await salesMeetingService.createMeeting({
        companyId: company._id,
        contactId: contact._id,
        startTime: in24h,
        durationMinutes: 30,
        force: true,
      });

      // Meeting 60 minutes from now
      const in60m = new Date(Date.now() + 60 * 60 * 1000);
      const meeting1h = await salesMeetingService.createMeeting({
        companyId: company._id,
        contactId: contact._id,
        startTime: in60m,
        durationMinutes: 30,
        force: true,
      });

      const summary = await meetingReminderService.processDueReminders();
      expect(summary.processedCount).toBeGreaterThanOrEqual(2);
      expect(summary.reminders.some((r) => r.meetingId === meeting24._id.toString())).toBe(true);
      expect(summary.reminders.some((r) => r.meetingId === meeting1h._id.toString())).toBe(true);
    });
  });

  // =========================================================================
  // 5. REST API Endpoints Integration Tests
  // =========================================================================
  describe('5. REST API Endpoints Integration', () => {
    it('POST /api/meetings/:id/reschedule reschedules meeting via API', async () => {
      const { meeting } = await createTestFixture();
      const nextThu = getNextWeekday(4, 1);
      nextThu.setHours(15, 0, 0, 0);

      const res = await request(app)
        .post(`/api/meetings/${meeting._id}/reschedule`)
        .send({
          newStartTime: nextThu.toISOString(),
          reason: 'Client requested reschedule via API',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('rescheduled');
      expect(res.body.data.sequence).toBe(1);
    });

    it('POST /api/meetings/:id/cancel cancels meeting via API', async () => {
      const { meeting } = await createTestFixture();

      const res = await request(app)
        .post(`/api/meetings/${meeting._id}/cancel`)
        .send({ reason: 'Cancelled by client request' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('cancelled');
      expect(res.body.data.cancellationReason).toBe('Cancelled by client request');
    });

    it('POST /api/meetings/:id/outcome records outcome via API', async () => {
      const { meeting } = await createTestFixture();

      const res = await request(app)
        .post(`/api/meetings/${meeting._id}/outcome`)
        .send({
          outcome: 'closed_won',
          notes: 'Signed deal via API',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.meetingOutcome.outcome).toBe('closed_won');
    });

    it('POST /api/meetings/:id/remind sends reminder via API', async () => {
      const { meeting } = await createTestFixture();

      const res = await request(app)
        .post(`/api/meetings/${meeting._id}/remind`)
        .send({ reminderType: '24h' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reminderType).toBe('24h');
      expect(res.body.data.approvalStatus).toBe('pending_approval');
    });

    it('POST /api/meetings/reminders/process-due executes batch scan via API', async () => {
      const res = await request(app).post('/api/meetings/reminders/process-due');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.processedCount).toBeDefined();
    });
  });
});

