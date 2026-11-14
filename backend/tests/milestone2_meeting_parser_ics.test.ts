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
import { EmailDraft } from '../src/models/EmailDraft.js';
import { icsCalendarService } from '../src/services/meeting/icsCalendarService.js';
import { geminiMeetingParserService } from '../src/services/meeting/geminiMeetingParserService.js';
import { salesMeetingService } from '../src/services/meeting/salesMeetingService.js';

describe('Phase 4 - Milestone 2: Gemini Natural Language Slot Parser & RFC 5545 .ics Calendar Generator', () => {
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

    const nextMon = getNextWeekday(1, 1);
    const meeting = await salesMeetingService.createMeeting({
      companyId: company._id,
      contactId: contact._id,
      startTime: nextMon,
      durationMinutes: 30,
      title: 'Cybells AI Automation Discovery Call',
      description: 'Explore custom document extraction for garment production manifests.',
    });

    return { company, contact, meeting, nextMon };
  };

  // =========================================================================
  // 1. RFC 5545 .ics Calendar Generator Tests
  // =========================================================================
  describe('1. RFC 5545 .ics Calendar Generator (icsCalendarService)', () => {
    it('formatUtcTimestamp outputs strict YYYYMMDDTHHMMSSZ UTC format', () => {
      const d = new Date('2026-11-12T14:30:00.000Z');
      const formatted = icsCalendarService.formatUtcTimestamp(d);
      expect(formatted).toBe('20261112T143000Z');
    });

    it('escapeText properly escapes commas, semicolons, backslashes, and newlines', () => {
      const raw = 'Text with, comma; semicolon \\ backslash and\nnewline';
      const escaped = icsCalendarService.escapeText(raw);
      expect(escaped).toBe('Text with\\, comma\\; semicolon \\\\ backslash and\\nnewline');
    });

    it('generateIcs produces valid RFC 5545 standard calendar string with CRLF endings', async () => {
      const { meeting } = await createTestFixture();

      const ics = icsCalendarService.generateIcs(meeting);

      // Mandatory VCALENDAR headers
      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('VERSION:2.0');
      expect(ics).toContain('PRODID:-//Cybells AI//Sales Meeting Scheduler//EN');
      expect(ics).toContain('METHOD:REQUEST');

      // Mandatory VEVENT tags
      expect(ics).toContain('BEGIN:VEVENT');
      expect(ics).toContain(`UID:${meeting.icsUid}`);
      expect(ics).toContain(`SEQUENCE:0`);
      expect(ics).toContain('DTSTART:');
      expect(ics).toContain('DTEND:');
      expect(ics).toContain('SUMMARY:Cybells AI Automation Discovery Call');
      expect(ics).toContain(`LOCATION:${meeting.meetingUrl}`);
      expect(ics).toContain('ORGANIZER;CN="Cybells Sales Specialist":mailto:sales@cybells.com');
      expect(ics).toContain('ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE');
      expect(ics).toContain('STATUS:CONFIRMED');
      expect(ics).toContain('BEGIN:VALARM');
      expect(ics).toContain('TRIGGER:-PT15M');
      expect(ics).toContain('END:VALARM');
      expect(ics).toContain('END:VEVENT');
      expect(ics).toContain('END:VCALENDAR');

      // Must terminate with CRLF
      expect(ics.endsWith('\r\n')).toBe(true);
      expect(ics.includes('\r\n')).toBe(true);
    });

    it('generateIcs outputs METHOD:CANCEL and STATUS:CANCELLED for cancelled meetings', async () => {
      const { meeting } = await createTestFixture();
      meeting.status = 'cancelled';

      const ics = icsCalendarService.generateIcs(meeting, { method: 'CANCEL' });

      expect(ics).toContain('METHOD:CANCEL');
      expect(ics).toContain('STATUS:CANCELLED');
      expect(ics).not.toContain('BEGIN:VALARM');
    });

    it('generateAttachment returns valid email attachment object with MIME headers', async () => {
      const { meeting } = await createTestFixture();

      const attachment = icsCalendarService.generateAttachment(meeting);

      expect(attachment.filename).toBe('invite.ics');
      expect(attachment.contentType).toBe('text/calendar; charset=utf-8; method=REQUEST');
      expect(Buffer.isBuffer(attachment.content)).toBe(true);
      expect(attachment.content.toString('utf-8')).toContain('BEGIN:VCALENDAR');
    });
  });

  // =========================================================================
  // 2. Gemini Natural Language Slot Parser Tests
  // =========================================================================
  describe('2. Gemini Natural Language Slot Parser (geminiMeetingParserService)', () => {
    it('parses explicit confirmation of a time slot (time_confirmed)', async () => {
      const nextWed = getNextWeekday(3, 1);
      nextWed.setHours(15, 0, 0, 0);

      // Inject deterministic mock AI
      geminiMeetingParserService.setMockClient({
        models: {
          generateContent: async () => ({
            text: JSON.stringify({
              intent: 'time_confirmed',
              confidence: 'high',
              parsedDateTime: nextWed.toISOString(),
              durationMinutes: 30,
              suggestedAction: 'book_slot',
              notes: 'Prospect confirmed availability for next Wednesday at 3:00 PM.',
            }),
          }),
        },
      });

      const result = await geminiMeetingParserService.parseMeetingIntent(
        'Wednesday at 3:00 PM works great for our team. Looking forward to it!'
      );

      expect(result.intent).toBe('time_confirmed');
      expect(result.confidence).toBe('high');
      expect(result.parsedDateTime).toBe(nextWed.toISOString());
      expect(result.isSlotAvailable).toBe(true);
      expect(result.suggestedAction).toBe('book_slot');
    });

    it('parses alternative proposed time and detects availability (propose_alternative)', async () => {
      const nextThu = getNextWeekday(4, 1);
      nextThu.setHours(14, 0, 0, 0);

      geminiMeetingParserService.setMockClient({
        models: {
          generateContent: async () => ({
            text: JSON.stringify({
              intent: 'propose_alternative',
              confidence: 'high',
              parsedDateTime: nextThu.toISOString(),
              durationMinutes: 30,
              suggestedAction: 'book_slot',
              notes: 'Prospect cannot make proposed time and counter-offered Thursday at 2:00 PM.',
            }),
          }),
        },
      });

      const result = await geminiMeetingParserService.parseMeetingIntent(
        'I am busy on Wednesday, but how about Thursday at 2 PM instead?'
      );

      expect(result.intent).toBe('propose_alternative');
      expect(result.parsedDateTime).toBe(nextThu.toISOString());
      expect(result.isSlotAvailable).toBe(true);
    });

    it('parses request for available options (request_options)', async () => {
      geminiMeetingParserService.setMockClient({
        models: {
          generateContent: async () => ({
            text: JSON.stringify({
              intent: 'request_options',
              confidence: 'high',
              parsedDateTime: null,
              durationMinutes: 30,
              suggestedAction: 'offer_slots',
              notes: 'Prospect asked for a few open time slots.',
            }),
          }),
        },
      });

      const result = await geminiMeetingParserService.parseMeetingIntent(
        'What times do you have open next week?'
      );

      expect(result.intent).toBe('request_options');
      expect(result.parsedDateTime).toBeNull();
      expect(result.suggestedAction).toBe('offer_slots');
    });

    it('parses uninterest / decline (uninterested)', async () => {
      geminiMeetingParserService.setMockClient({
        models: {
          generateContent: async () => ({
            text: JSON.stringify({
              intent: 'uninterested',
              confidence: 'high',
              parsedDateTime: null,
              durationMinutes: 30,
              suggestedAction: 'mark_not_interested',
              notes: 'Prospect declined meeting invitation.',
            }),
          }),
        },
      });

      const result = await geminiMeetingParserService.parseMeetingIntent(
        'Not interested in this right now. Please remove me from your list.'
      );

      expect(result.intent).toBe('uninterested');
      expect(result.suggestedAction).toBe('mark_not_interested');
    });

    it('gracefully handles unparseable / ambiguous AI output', async () => {
      geminiMeetingParserService.setMockClient({
        models: {
          generateContent: async () => ({
            text: 'I cannot parse this into JSON properly!',
          }),
        },
      });

      const result = await geminiMeetingParserService.parseMeetingIntent('Maybe later.');

      expect(result.intent).toBe('ambiguous');
      expect(result.confidence).toBe('low');
      expect(result.suggestedAction).toBe('ask_clarification');
    });

    it('flags conflict if parsed time slot falls on a weekend or conflicts with another meeting', async () => {
      const sunday = getNextWeekday(0, 1); // Sunday
      sunday.setHours(10, 0, 0, 0);

      geminiMeetingParserService.setMockClient({
        models: {
          generateContent: async () => ({
            text: JSON.stringify({
              intent: 'time_confirmed',
              confidence: 'high',
              parsedDateTime: sunday.toISOString(),
              durationMinutes: 30,
              suggestedAction: 'book_slot',
              notes: 'Prospect asked for Sunday 10am.',
            }),
          }),
        },
      });

      const result = await geminiMeetingParserService.parseMeetingIntent('Let us meet Sunday at 10am.');

      expect(result.intent).toBe('time_confirmed');
      expect(result.isSlotAvailable).toBe(false);
      expect(result.conflictReason).toContain('Host does not accept meetings');
      expect(result.suggestedAction).toBe('offer_slots');
    });
  });

  // =========================================================================
  // 3. Meeting Invitation Draft Generator Tests
  // =========================================================================
  describe('3. Meeting Invitation Draft Generator (generateMeetingInviteDraft)', () => {
    it('generates a grounded meeting email draft with .ics attachment and pending_approval guard', async () => {
      const { meeting } = await createTestFixture();

      const draft = await geminiMeetingParserService.generateMeetingInviteDraft(meeting._id.toString());

      expect(draft).toBeDefined();
      expect(draft.subject).toContain('Confirmed: Cybells AI Automation Discovery Call');
      expect(draft.bodyText).toContain(meeting.meetingUrl);
      expect(draft.bodyHtml).toContain('Join Google Meet');
      expect(draft.approvalStatus).toBe('pending_approval');
      expect(draft.requiresHumanReview).toBe(true);

      // Verify attachment details
      expect(draft.attachment.filename).toBe('invite.ics');
      expect(draft.attachment.contentType).toBe('text/calendar; charset=utf-8; method=REQUEST');
      expect(draft.attachment.contentLength).toBeGreaterThan(100);
    });

    it('refuses to generate draft if contact is suppressed or unsubscribed', async () => {
      const { company, contact } = await createTestFixture();

      // Suppress contact
      await OutreachContact.findByIdAndUpdate(contact._id, {
        $set: { 'suppressionStatus.isSuppressed': true, outreachStatus: 'unsubscribed' },
      });

      const nextTue = getNextWeekday(2, 1);
      const meeting = await SalesMeeting.create({
        companyId: company._id,
        contactId: contact._id,
        startTime: nextTue,
        endTime: new Date(nextTue.getTime() + 1800000),
        durationMinutes: 30,
        title: 'Call',
        meetingUrl: 'https://meet.google.com/test',
        icsUid: 'test@cybells.com',
      });

      await expect(
        geminiMeetingParserService.generateMeetingInviteDraft(meeting._id.toString())
      ).rejects.toThrow('suppressed or unsubscribed');
    });
  });

  // =========================================================================
  // 4. REST API Endpoints Integration Tests
  // =========================================================================
  describe('4. REST API Endpoints Integration', () => {
    it('POST /api/meetings/parse-slots parses text and returns structured response', async () => {
      const nextFri = getNextWeekday(5, 1);
      nextFri.setHours(11, 0, 0, 0);

      geminiMeetingParserService.setMockClient({
        models: {
          generateContent: async () => ({
            text: JSON.stringify({
              intent: 'time_confirmed',
              confidence: 'high',
              parsedDateTime: nextFri.toISOString(),
              durationMinutes: 30,
              suggestedAction: 'book_slot',
              notes: 'Friday 11am confirmed.',
            }),
          }),
        },
      });

      const res = await request(app)
        .post('/api/meetings/parse-slots')
        .send({ messageText: 'Friday at 11am is perfect for me.' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.intent).toBe('time_confirmed');
      expect(res.body.data.parsedDateTime).toBe(nextFri.toISOString());
      expect(res.body.data.isSlotAvailable).toBe(true);
    });

    it('POST /api/meetings/parse-slots rejects request with 400 when messageText is missing', async () => {
      const res = await request(app).post('/api/meetings/parse-slots').send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('messageText is required');
    });

    it('GET /api/meetings/:id/ics downloads valid .ics calendar stream', async () => {
      const { meeting } = await createTestFixture();

      const res = await request(app).get(`/api/meetings/${meeting._id}/ics`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/calendar');
      expect(res.headers['content-disposition']).toContain(`attachment; filename="invite-${meeting._id}.ics"`);
      expect(res.text).toContain('BEGIN:VCALENDAR');
      expect(res.text).toContain(`UID:${meeting.icsUid}`);
      expect(res.text).toContain('END:VCALENDAR');
    });

    it('GET /api/meetings/:id/ics returns 404 for nonexistent meeting', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app).get(`/api/meetings/${fakeId}/ics`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/meetings/:id/generate-invite-draft creates review draft via API', async () => {
      const { meeting } = await createTestFixture();

      const res = await request(app).post(`/api/meetings/${meeting._id}/generate-invite-draft`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.subject).toContain('Confirmed: Cybells AI Automation Discovery Call');
      expect(res.body.data.approvalStatus).toBe('pending_approval');
      expect(res.body.data.attachment.filename).toBe('invite.ics');
    });
  });
});

