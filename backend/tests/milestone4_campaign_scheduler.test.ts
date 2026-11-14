import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../src/app.js';
import { Company } from '../src/models/Company.js';
import { OutreachContact } from '../src/models/OutreachContact.js';
import { CybellsConfig } from '../src/models/CybellsConfig.js';
import { EmailDraft } from '../src/models/EmailDraft.js';
import { Campaign } from '../src/models/Campaign.js';
import { OutreachMessage } from '../src/models/OutreachMessage.js';
import { FollowUpJob } from '../src/models/FollowUpJob.js';
import { SuppressionList } from '../src/models/SuppressionList.js';
import {
  MockEmailTransport,
  setEmailTransport,
  getEmailTransport,
  SmtpTransport,
} from '../src/services/outreach/emailTransport.js';
import { campaignEngine } from '../src/services/outreach/campaignEngine.js';
import { sendingSafetyService } from '../src/services/outreach/sendingSafetyService.js';
import { schedulerWorker } from '../src/services/outreach/schedulerWorker.js';
import { env } from '../src/config/env.js';

describe('Phase 2 - Milestone 4: Campaign Sequencing, Schedulers & Sending Engine (Sandbox Guard)', () => {
  let mongoServer: MongoMemoryServer;
  let mockTransport: MockEmailTransport;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Enforce mock transport for automated tests (Golden Rule 2.6)
    mockTransport = new MockEmailTransport();
    setEmailTransport(mockTransport);

    // Disable jitter delays during test ticks
    schedulerWorker.setDisableJitterForTesting(true);
  });

  afterAll(async () => {
    schedulerWorker.stop();
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    mockTransport.clear();
    await Company.deleteMany({});
    await OutreachContact.deleteMany({});
    await CybellsConfig.deleteMany({});
    await EmailDraft.deleteMany({});
    await Campaign.deleteMany({});
    await OutreachMessage.deleteMany({});
    await FollowUpJob.deleteMany({});
    await SuppressionList.deleteMany({});

    // Seed Cybells Config
    await CybellsConfig.create({
      agencyName: 'Cybells AI',
      mission: 'Workflow automation',
      capabilities: [
        {
          id: 'c1',
          title: 'Invoice Automation',
          description: 'Automated invoice workflow',
          typicalUseCases: ['Accounts Payable'],
        },
      ],
      senderName: 'Hafiz from Cybells',
      sendingRules: {
        dailyCap: 25,
        minDelaySeconds: 60,
        maxDelaySeconds: 180,
        allowedSendingHours: { start: 9, end: 17 },
        allowedSendingDays: [1, 2, 3, 4, 5],
        timezone: 'UTC',
      },
      postalAddress: '123 Tech St, Austin, TX',
    });
  });

  describe('A. Transport Design & Sandbox Mode Guard (Golden Rule 2.5 & 2.6)', () => {
    it('should redirect recipient to SANDBOX_INBOX and prefix subject when SEND_MODE=sandbox', async () => {
      (env as any).SEND_MODE = 'sandbox';
      (env as any).SANDBOX_INBOX = 'test-sandbox@cybells.ai';

      const result = await mockTransport.sendMail({
        to: 'real-prospect@acme-corp.com',
        subject: 'Quick question regarding logistics',
        html: '<p>Hello world</p>',
        text: 'Hello world',
      });

      expect(result.sandboxRedirected).toBe(true);
      expect(result.originalRecipient).toBe('real-prospect@acme-corp.com');
      expect(result.finalRecipient).toBe('test-sandbox@cybells.ai');
      expect(result.subject).toBe('[SANDBOX to: real-prospect@acme-corp.com] Quick question regarding logistics');
    });

    it('should preserve original recipient when SEND_MODE=live', async () => {
      (env as any).SEND_MODE = 'live';

      const result = await mockTransport.sendMail({
        to: 'real-prospect@acme-corp.com',
        subject: 'Real outreach email',
        html: '<p>Hello</p>',
        text: 'Hello',
      });

      expect(result.sandboxRedirected).toBe(false);
      expect(result.finalRecipient).toBe('real-prospect@acme-corp.com');
      expect(result.subject).toBe('Real outreach email');

      // Reset back to sandbox
      (env as any).SEND_MODE = 'sandbox';
    });
  });

  describe('B. Sending Safety, Daily Cap & Pre-Flight Validation', () => {
    it('should detect when daily cap is reached', async () => {
      const dummyContact = await OutreachContact.create({
        companyId: new mongoose.Types.ObjectId(),
        email: 'test@example.com',
        normalizedEmail: 'test@example.com',
      });

      // Create 25 sent messages for today
      const today = new Date();
      for (let i = 0; i < 25; i++) {
        await OutreachMessage.create({
          contactId: dummyContact._id,
          direction: 'outbound',
          senderEmail: 'outreach@cybells.ai',
          recipientEmail: `prospect${i}@example.com`,
          subject: 'Test',
          bodyHtml: 'Test',
          bodyText: 'Test',
          status: 'sent',
          sentAt: today,
          sandboxRedirected: true,
        });
      }

      const capResult = await sendingSafetyService.isDailyCapReached(25);
      expect(capResult.capReached).toBe(true);
      expect(capResult.sentToday).toBe(25);
    });

    it('should reject pre-send validation if email draft is NOT approved (Golden Rule 2.4)', async () => {
      const contact = await OutreachContact.create({
        companyId: new mongoose.Types.ObjectId(),
        email: 'unapproved@target.com',
        normalizedEmail: 'unapproved@target.com',
        outreachStatus: 'pending_approval',
      });

      const draft = await EmailDraft.create({
        contactId: contact._id,
        companyId: contact.companyId,
        subject: 'Draft subject',
        bodyHtml: '<p>Body</p>',
        bodyText: 'Body',
        approvalStatus: 'draft', // Unapproved
      });

      const safety = await sendingSafetyService.validatePreSendEligibility(
        contact._id.toString(),
        draft._id.toString()
      );

      expect(safety.eligible).toBe(false);
      expect(safety.reason).toContain('Explicit human approval is mandatory');
    });

    it('should reject pre-send validation if contact is listed in suppression registry (Golden Rule 2.7)', async () => {
      const contact = await OutreachContact.create({
        companyId: new mongoose.Types.ObjectId(),
        email: 'suppressed@client.com',
        normalizedEmail: 'suppressed@client.com',
        outreachStatus: 'ready',
      });

      await SuppressionList.create({
        email: 'suppressed@client.com',
        reason: 'unsubscribe',
      });

      const safety = await sendingSafetyService.validatePreSendEligibility(contact._id.toString());
      expect(safety.eligible).toBe(false);
      expect(safety.reason).toContain('global suppression registry');
    });
  });

  describe('C. Campaign Sequencing & Lifecycle Endpoints', () => {
    it('POST /api/campaigns should create campaign with multi-step sequence', async () => {
      const res = await request(app)
        .post('/api/campaigns')
        .send({
          name: 'Logistics Q4 AI Outreach',
          description: 'Multi-step sequence targeting freight brokers',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sequence).toHaveLength(4); // Default 4 steps (Day 0, 3, 7, 12)
      expect(res.body.data.status).toBe('draft');
    });

    it('POST /api/campaigns/:id/launch should schedule Step 0 messages and FollowUpJobs for future steps', async () => {
      const company = await Company.create({
        companyName: 'Express Logistics',
        website: 'https://express.example.com',
        domain: 'express.example.com',
      });

      const contact = await OutreachContact.create({
        companyId: company._id,
        email: 'ops@express.example.com',
        normalizedEmail: 'ops@express.example.com',
        contactName: 'Alex Carter',
        outreachStatus: 'ready',
      });

      // Approved draft
      const draft = await EmailDraft.create({
        contactId: contact._id,
        companyId: company._id,
        sequenceStep: 0,
        subject: 'Express Logistics automated manifest reconciliation',
        bodyHtml: '<p>Hi Alex, {{UNSUBSCRIBE_URL}}</p>',
        bodyText: 'Hi Alex, {{UNSUBSCRIBE_URL}}',
        approvalStatus: 'approved',
        approvedAt: new Date(),
      });

      const campaign = await Campaign.create({
        name: 'Express Outreach Campaign',
        selectedContacts: [contact._id],
        status: 'draft',
      });

      const res = await request(app).post(`/api/campaigns/${campaign._id}/launch`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.scheduledMessages).toBe(1);
      expect(res.body.data.scheduledFollowUpJobs).toBe(3); // Steps 1, 2, 3

      // Verify OutreachMessage was created for Step 0
      const message = await OutreachMessage.findOne({ campaignId: campaign._id, contactId: contact._id });
      expect(message).toBeDefined();
      expect(message?.status).toBe('scheduled');

      // Verify FollowUpJobs created
      const jobs = await FollowUpJob.find({ campaignId: campaign._id, contactId: contact._id });
      expect(jobs).toHaveLength(3);
    });

    it('POST /api/campaigns/:id/cancel should cancel campaign and all scheduled messages and jobs', async () => {
      const dummyContactId = new mongoose.Types.ObjectId();
      const campaign = await Campaign.create({
        name: 'To Cancel',
        selectedContacts: [dummyContactId],
        status: 'running',
      });

      await OutreachMessage.create({
        campaignId: campaign._id,
        contactId: dummyContactId,
        senderEmail: 'test@cybells.ai',
        recipientEmail: 'test@example.com',
        subject: 'Test',
        status: 'scheduled',
      });

      await FollowUpJob.create({
        campaignId: campaign._id,
        contactId: dummyContactId,
        sequenceStep: 1,
        scheduledAt: new Date(Date.now() + 100000),
        status: 'scheduled',
      });

      const res = await request(app).post(`/api/campaigns/${campaign._id}/cancel`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedMsg = await OutreachMessage.findOne({ campaignId: campaign._id });
      expect(updatedMsg?.status).toBe('cancelled');

      const updatedJob = await FollowUpJob.findOne({ campaignId: campaign._id });
      expect(updatedJob?.status).toBe('cancelled');
    });
  });

  describe('D. Scheduler Worker & Automated Dispatch Execution', () => {
    it('should process due scheduled messages, dispatch via transport, and update contact status to contacted', async () => {
      const contact = await OutreachContact.create({
        companyId: new mongoose.Types.ObjectId(),
        email: 'dispatch.target@firm.com',
        normalizedEmail: 'dispatch.target@firm.com',
        contactName: 'Samantha Ray',
        outreachStatus: 'ready',
      });

      const draft = await EmailDraft.create({
        contactId: contact._id,
        companyId: contact.companyId,
        subject: 'Scheduled dispatch test',
        bodyHtml: '<p>Hi Samantha, click {{UNSUBSCRIBE_URL}}</p>',
        bodyText: 'Hi Samantha, click {{UNSUBSCRIBE_URL}}',
        approvalStatus: 'approved',
      });

      // Scheduled message due right now
      const message = await OutreachMessage.create({
        contactId: contact._id,
        draftId: draft._id,
        direction: 'outbound',
        senderEmail: 'outreach@cybells.ai',
        recipientEmail: contact.email,
        subject: draft.subject,
        bodyHtml: draft.bodyHtml,
        bodyText: draft.bodyText,
        status: 'scheduled',
        scheduledFor: new Date(Date.now() - 1000), // Due in the past
        sandboxRedirected: true,
      });

      // Run scheduler worker tick
      const tickResult = await schedulerWorker.tick();

      expect(tickResult.processedMessages).toBe(1);

      // Verify message updated to sent
      const updatedMessage = await OutreachMessage.findById(message._id);
      expect(updatedMessage?.status).toBe('sent');
      expect(updatedMessage?.messageId).toBeTruthy();
      expect(updatedMessage?.sentAt).toBeTruthy();

      // Verify contact status updated
      const updatedContact = await OutreachContact.findById(contact._id);
      expect(updatedContact?.outreachStatus).toBe('contacted');
      expect(updatedContact?.lastContactedAt).toBeTruthy();

      // Verify mock transport received the message with sandbox redirect
      expect(mockTransport.sentMessages).toHaveLength(1);
      expect(mockTransport.sentMessages[0].subject).toContain('[SANDBOX to: dispatch.target@firm.com]');
    });

    it('should cancel contact outreach immediately via campaignEngine.cancelContactOutreach()', async () => {
      const contactId = new mongoose.Types.ObjectId();
      const campaignId = new mongoose.Types.ObjectId();

      await OutreachMessage.create({
        campaignId,
        contactId,
        senderEmail: 'test@test.com',
        recipientEmail: 'test@test.com',
        subject: 'Msg',
        status: 'scheduled',
      });

      await FollowUpJob.create({
        campaignId,
        contactId,
        sequenceStep: 1,
        scheduledAt: new Date(Date.now() + 500000),
        status: 'scheduled',
      });

      const result = await campaignEngine.cancelContactOutreach(contactId, 'User clicked unsubscribe');

      expect(result.messagesCancelled).toBe(1);
      expect(result.jobsCancelled).toBe(1);

      const msg = await OutreachMessage.findOne({ contactId });
      expect(msg?.status).toBe('cancelled');
      expect(msg?.error).toBe('User clicked unsubscribe');
    });
  });
});

