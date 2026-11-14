import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import crypto from 'crypto';
import app from '../src/app.js';
import { Company } from '../src/models/Company.js';
import { OutreachContact } from '../src/models/OutreachContact.js';
import { SalesMeeting } from '../src/models/SalesMeeting.js';
import { FollowUpJob } from '../src/models/FollowUpJob.js';
import { Campaign } from '../src/models/Campaign.js';
import { env } from '../src/config/env.js';

describe('Cal.diy Webhook & Scheduling Engine Integration Tests', () => {
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
    await SalesMeeting.deleteMany({});
    await FollowUpJob.deleteMany({});
    await Campaign.deleteMany({});
  });

  it('GET /api/webhooks/cal/config returns current Cal.diy embed and link configuration', async () => {
    const res = await request(app).get('/api/webhooks/cal/config');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.calOrigin).toBeDefined();
    expect(res.body.data.closerSlug).toBe('hafiz');
    expect(res.body.data.eventSlug).toBe('30min');
    expect(res.body.data.defaultCalLink).toBe('hafiz/30min');
  });

  it('POST /api/webhooks/cal processes BOOKING_CREATED for an existing prospect contact', async () => {
    // 1. Setup company and contact
    const company = await Company.create({
      companyName: 'NexGen Retail Corp',
      normalizedName: 'nexgen retail corp',
      website: 'https://nexgenretail.com',
      domain: 'nexgenretail.com',
      industry: 'E-Commerce & Retail',
      country: 'Pakistan',
      city: 'Faisalabad',
      reviewStatus: 'new',
    });

    const contact = await OutreachContact.create({
      companyId: company._id,
      email: 'tariq@nexgenretail.com',
      normalizedEmail: 'tariq@nexgenretail.com',
      emailSourceUrl: 'https://nexgenretail.com/about',
      contactName: 'Tariq Mehmood',
      jobTitle: 'Head of Operations',
      validationStatus: 'verified',
      outreachStatus: 'contacted',
      suppressionStatus: { isSuppressed: false },
    });

    const campaign = await Campaign.create({
      name: 'Cold AI Outreach Q1',
      description: 'Test Campaign',
      status: 'running',
    });

    // 2. Setup pending cold follow-up job that should be cancelled upon booking
    const followUp = await FollowUpJob.create({
      campaignId: campaign._id,
      contactId: contact._id,
      sequenceStep: 1,
      scheduledAt: new Date(Date.now() + 86400000),
      status: 'scheduled',
    });

    // 3. Dispatch simulated Cal.diy BOOKING_CREATED payload
    const bookingUid = `bk_test_${Date.now()}`;
    const startTime = new Date(Date.now() + 172800000).toISOString(); // 2 days ahead
    const endTime = new Date(Date.now() + 172800000 + 1800000).toISOString();

    const calPayload = {
      triggerEvent: 'BOOKING_CREATED',
      payload: {
        uid: bookingUid,
        title: '30 Min Discovery with Tariq Mehmood',
        startTime,
        endTime,
        length: 30,
        location: 'https://meet.google.com/abc-defg-hij',
        organizer: {
          name: 'Hafiz from Cybells',
          email: 'hafiz@cybells.ai',
          timeZone: 'Asia/Karachi',
        },
        attendees: [
          {
            name: 'Tariq Mehmood',
            email: 'tariq@nexgenretail.com',
            timeZone: 'Asia/Karachi',
          },
        ],
      },
    };

    const res = await request(app)
      .post('/api/webhooks/cal')
      .send(calPayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.bookingUid).toBe(bookingUid);

    // 4. Verify MongoDB SalesMeeting record created
    const meeting = await SalesMeeting.findOne({ icsUid: bookingUid });
    expect(meeting).toBeDefined();
    expect(meeting!.status).toBe('confirmed');
    expect(meeting!.durationMinutes).toBe(30);
    expect(meeting!.meetingUrl).toBe('https://meet.google.com/abc-defg-hij');
    expect(meeting!.locationType).toBe('google_meet');
    expect(meeting!.companyId.toString()).toBe(company._id.toString());
    expect(meeting!.contactId.toString()).toBe(contact._id.toString());

    // 5. Verify Contact & Company updated
    const updatedContact = await OutreachContact.findById(contact._id);
    expect(updatedContact!.outreachStatus).toBe('meeting_scheduled');

    const updatedCompany = await Company.findById(company._id);
    expect(updatedCompany!.reviewStatus).toBe('contacted');

    // 6. Verify pending follow-up job cancelled
    const updatedFollowUp = await FollowUpJob.findById(followUp._id);
    expect(updatedFollowUp!.status).toBe('cancelled');
  });

  it('POST /api/webhooks/cal processes BOOKING_RESCHEDULED', async () => {
    const bookingUid = `bk_resched_${Date.now()}`;
    const initialStart = new Date(Date.now() + 86400000);
    const initialEnd = new Date(Date.now() + 86400000 + 1800000);

    const dummyCompanyId = new mongoose.Types.ObjectId();
    const dummyContactId = new mongoose.Types.ObjectId();

    await SalesMeeting.create({
      companyId: dummyCompanyId,
      contactId: dummyContactId,
      title: 'Initial Discovery Call',
      startTime: initialStart,
      endTime: initialEnd,
      durationMinutes: 30,
      timezone: 'Asia/Karachi',
      status: 'confirmed',
      locationType: 'google_meet',
      meetingUrl: 'https://meet.google.com/test-room',
      icsUid: bookingUid,
      sequence: 1,
      assignedAE: 'Hafiz',
      attendees: [
        { name: 'Prospect', email: 'prospect@acme.com', role: 'prospect', status: 'accepted' },
      ],
    });

    const newStart = new Date(Date.now() + 172800000).toISOString();
    const newEnd = new Date(Date.now() + 172800000 + 1800000).toISOString();

    const reschedulePayload = {
      triggerEvent: 'BOOKING_RESCHEDULED',
      payload: {
        uid: bookingUid,
        startTime: newStart,
        endTime: newEnd,
        length: 30,
        rejectionReason: 'Prospect requested postponement due to board meeting.',
      },
    };

    const res = await request(app)
      .post('/api/webhooks/cal')
      .send(reschedulePayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updatedMeeting = await SalesMeeting.findOne({ icsUid: bookingUid });
    expect(updatedMeeting!.status).toBe('rescheduled');
    expect(updatedMeeting!.sequence).toBe(2);
    expect(updatedMeeting!.rescheduleReason).toContain('board meeting');
  });

  it('POST /api/webhooks/cal processes BOOKING_CANCELLED', async () => {
    const bookingUid = `bk_cancel_${Date.now()}`;
    const dummyCompanyId = new mongoose.Types.ObjectId();
    const contact = await OutreachContact.create({
      companyId: dummyCompanyId,
      email: 'cancel@lead.com',
      normalizedEmail: 'cancel@lead.com',
      emailSourceUrl: 'https://lead.com',
      contactName: 'Lead to Cancel',
      jobTitle: 'Director',
      validationStatus: 'verified',
      outreachStatus: 'meeting_scheduled',
      suppressionStatus: { isSuppressed: false },
    });

    await SalesMeeting.create({
      companyId: dummyCompanyId,
      contactId: contact._id,
      title: 'Call to Cancel',
      startTime: new Date(),
      endTime: new Date(Date.now() + 1800000),
      durationMinutes: 30,
      timezone: 'UTC',
      status: 'confirmed',
      locationType: 'google_meet',
      meetingUrl: 'https://meet.google.com/cancel-room',
      icsUid: bookingUid,
      sequence: 1,
      assignedAE: 'Hafiz',
      attendees: [
        { name: 'Lead to Cancel', email: 'cancel@lead.com', role: 'prospect', status: 'accepted' },
      ],
    });

    const cancelPayload = {
      triggerEvent: 'BOOKING_CANCELLED',
      payload: {
        uid: bookingUid,
        rejectionReason: 'Scheduling conflict with external client.',
      },
    };

    const res = await request(app)
      .post('/api/webhooks/cal')
      .send(cancelPayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updatedMeeting = await SalesMeeting.findOne({ icsUid: bookingUid });
    expect(updatedMeeting!.status).toBe('cancelled');
    expect(updatedMeeting!.cancellationReason).toContain('conflict');

    const updatedContact = await OutreachContact.findById(contact._id);
    expect(updatedContact!.outreachStatus).toBe('contacted');
  });
});
