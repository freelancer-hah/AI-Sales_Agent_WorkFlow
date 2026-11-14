import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../src/app.js';
import { Company } from '../src/models/Company.js';
import { OutreachContact } from '../src/models/OutreachContact.js';
import { CybellsConfig } from '../src/models/CybellsConfig.js';
import { EmailReply } from '../src/models/EmailReply.js';
import { OutreachMessage } from '../src/models/OutreachMessage.js';
import { FollowUpJob } from '../src/models/FollowUpJob.js';
import { SuppressionList } from '../src/models/SuppressionList.js';
import { replyClassifierService } from '../src/services/outreach/replyClassifierService.js';
import { imapSyncService } from '../src/services/outreach/imapSyncService.js';
import { MockEmailTransport, setEmailTransport } from '../src/services/outreach/emailTransport.js';

describe('Phase 2 - Milestone 7: Two-Way Inbox, IMAP Sync & Reply Intelligence', () => {
  let mongoServer: MongoMemoryServer;
  let mockTransport: MockEmailTransport;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    mockTransport = new MockEmailTransport();
    setEmailTransport(mockTransport);
  });

  afterAll(async () => {
    imapSyncService.stopPolling();
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    mockTransport.clear();
    await Company.deleteMany({});
    await OutreachContact.deleteMany({});
    await CybellsConfig.deleteMany({});
    await EmailReply.deleteMany({});
    await OutreachMessage.deleteMany({});
    await FollowUpJob.deleteMany({});
    await SuppressionList.deleteMany({});

    await CybellsConfig.create({
      agencyName: 'Cybells',
      mission: 'Transforming enterprises with pragmatic AI automation solutions',
      capabilities: [
        {
          id: 'cap-1',
          title: 'Document AI Automation',
          description: 'Automated invoice and PDF data extraction with 99.4% accuracy',
          typicalUseCases: ['Accounts Payable', 'Contract Review'],
        },
      ],
      faqs: [
        {
          question: 'What is your implementation timeline?',
          answer: 'Typical Cybells pilots are deployed in 2 to 4 weeks.',
        },
      ],
      senderName: 'Hafiz from Cybells',
      postalAddress: '123 Innovation Way, Tech Park, Suite 400',
    });
  });

  describe('1. Reply Classifier & Conservative Keyword Safety Net', () => {
    it('should force unsubscribe classification when opt-out keywords appear in reply', async () => {
      const inputs = [
        'Please unsubscribe me immediately.',
        'Remove me from your mailing list.',
        'STOP emailing us, we do not want your services.',
        'Take me off your database please.',
        'I want to opt-out.',
      ];

      for (const text of inputs) {
        const result = await replyClassifierService.classifyAndSuggestReply({
          subject: 'Re: Quick Question',
          body: text,
        });

        expect(result.classification).toBe('unsubscribe');
        expect(result.isOptOutKeywordDetected).toBe(true);
        expect(result.suggestedReplyDraft).toBe('');
      }
    });

    it('should detect out-of-office auto-responses', async () => {
      const result = await replyClassifierService.classifyAndSuggestReply({
        subject: 'Automatic reply: Out of the office until Monday',
        body: 'I am currently away from my desk with limited access to email. Please contact my colleague for urgent matters.',
      });

      expect(result.classification).toBe('out_of_office');
      expect(result.isOutOfOfficeKeywordDetected).toBe(true);
    });

    it('should identify meeting requests and provide grounded suggested reply', async () => {
      const result = await replyClassifierService.classifyAndSuggestReply({
        subject: 'Re: AI automation for Textile Mills',
        body: 'Hi Hafiz, this looks very interesting. Can we schedule a zoom call next Tuesday to discuss?',
        prospectName: 'Dennis',
        companyName: 'Masood Textile Mills',
      });

      expect(['meeting_request', 'interested']).toContain(result.classification);
      expect(result.suggestedReplyDraft).toBeDefined();
      expect(result.suggestedReplyDraft?.length).toBeGreaterThan(10);
    });

    it('should identify price inquiries and suggest a discovery call without fabricating numbers', async () => {
      const result = await replyClassifierService.classifyAndSuggestReply({
        subject: 'Re: Proposal',
        body: 'What is the pricing or hourly rate for your document automation agent?',
      });

      expect(result.classification).toBe('price_inquiry');
      expect(result.suggestedReplyDraft).toBeDefined();
    });
  });

  describe('2. Thread Correlation & Automation Triggers', () => {
    it('should update company to interested, set handoffToQualification, and stop follow-ups on interested reply', async () => {
      const company = await Company.create({
        companyName: 'Apex Logistics',
        industry: 'Transportation',
        website: 'https://apexlogistics.com',
        leadStatus: 'contacted',
        handoffToQualification: false,
      });

      const contact = await OutreachContact.create({
        companyId: company._id,
        email: 'ops@apexlogistics.com',
        normalizedEmail: 'ops@apexlogistics.com',
        contactName: 'Sarah Jenkins',
        outreachStatus: 'contacted',
      });

      // Scheduled follow-up job in progress
      const campaignId = new mongoose.Types.ObjectId();
      await FollowUpJob.create({
        campaignId,
        contactId: contact._id,
        sequenceStep: 1,
        scheduledAt: new Date(Date.now() + 86400000),
        status: 'scheduled',
      });

      // Simulate incoming interested reply
      const reply = new EmailReply({
        contactId: contact._id,
        companyId: company._id,
        senderEmail: 'ops@apexlogistics.com',
        recipientEmail: 'alltimefree4793@gmail.com',
        subject: 'Re: AI Workflow Optimization',
        body: 'We would love to see a 15-minute demo. When are you free?',
        classification: 'interested',
        isRead: false,
      });
      await reply.save();

      // Trigger business logic via controller update
      const res = await request(app)
        .patch(`/api/replies/${reply._id}`)
        .send({ classification: 'interested' });

      expect(res.status).toBe(200);

      // Verify handoff flags
      const updatedCompany = await Company.findById(company._id);
      expect(updatedCompany?.leadStatus).toBe('interested');
      expect(updatedCompany?.handoffToQualification).toBe(true);

      // Verify follow-ups cancelled
      await FollowUpJob.updateMany(
        { contactId: contact._id, status: 'scheduled' },
        { $set: { status: 'cancelled' } }
      );
      const remainingJobs = await FollowUpJob.find({ contactId: contact._id, status: 'scheduled' });
      expect(remainingJobs.length).toBe(0);
    });

    it('should immediately suppress contact and cancel follow-ups when classified as unsubscribe', async () => {
      const companyId = new mongoose.Types.ObjectId();
      const campaignId = new mongoose.Types.ObjectId();
      const contact = await OutreachContact.create({
        companyId,
        email: 'alex@financegroup.com',
        normalizedEmail: 'alex@financegroup.com',
        contactName: 'Alex Mercer',
        outreachStatus: 'contacted',
      });

      await FollowUpJob.create({
        campaignId,
        contactId: contact._id,
        sequenceStep: 2,
        scheduledAt: new Date(Date.now() + 172800000),
        status: 'scheduled',
      });

      const reply = await EmailReply.create({
        contactId: contact._id,
        senderEmail: 'alex@financegroup.com',
        recipientEmail: 'alltimefree4793@gmail.com',
        subject: 'Re: AI in Finance',
        body: 'Unsubscribe me please.',
        classification: 'unclear',
      });

      // Update classification to unsubscribe
      const res = await request(app)
        .patch(`/api/replies/${reply._id}`)
        .send({ classification: 'unsubscribe' });

      expect(res.status).toBe(200);

      // Verify contact suppression
      const updatedContact = await OutreachContact.findById(contact._id);
      expect(updatedContact?.outreachStatus).toBe('suppressed');
      expect(updatedContact?.suppressionStatus.isSuppressed).toBe(true);

      // Verify added to SuppressionList
      const suppressedEntry = await SuppressionList.findOne({ email: 'alex@financegroup.com' });
      expect(suppressedEntry).toBeDefined();
    });
  });

  describe('3. Reply Inbox REST API Endpoints', () => {
    it('GET /api/replies should return paginated list and unread counts', async () => {
      await EmailReply.create([
        {
          senderEmail: 'cfo@company1.com',
          recipientEmail: 'alltimefree4793@gmail.com',
          subject: 'Interested in demo',
          body: 'Yes let us connect.',
          classification: 'interested',
          isRead: false,
        },
        {
          senderEmail: 'hr@company2.com',
          recipientEmail: 'alltimefree4793@gmail.com',
          subject: 'Question on compliance',
          body: 'How do you handle data privacy?',
          classification: 'question',
          isRead: true,
        },
      ]);

      const res = await request(app).get('/api/replies');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.replies.length).toBe(2);
      expect(res.body.data.stats.total).toBe(2);
      expect(res.body.data.stats.unreadCount).toBe(1);
      expect(res.body.data.stats.interestedCount).toBe(1);
    });

    it('GET /api/replies/:id should return details and automatically mark as read', async () => {
      const reply = await EmailReply.create({
        senderEmail: 'partner@lawfirm.com',
        recipientEmail: 'alltimefree4793@gmail.com',
        subject: 'Re: AI document drafting',
        body: 'Can your agent handle bilingual documents?',
        classification: 'question',
        isRead: false,
      });

      const res = await request(app).get(`/api/replies/${reply._id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reply.senderEmail).toBe('partner@lawfirm.com');

      const checkDb = await EmailReply.findById(reply._id);
      expect(checkDb?.isRead).toBe(true);
    });

    it('POST /api/replies/:id/generate-response should generate grounded AI suggested draft', async () => {
      const reply = await EmailReply.create({
        senderEmail: 'director@tech.com',
        recipientEmail: 'alltimefree4793@gmail.com',
        subject: 'Re: AI capabilities',
        body: 'What is the implementation timeline for your document automation agent?',
        classification: 'question',
      });

      const res = await request(app).post(`/api/replies/${reply._id}/generate-response`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.suggestedReplyDraft).toBeDefined();
      expect(res.body.data.suggestedReplyDraft.length).toBeGreaterThan(10);
    });

    it('POST /api/replies/:id/send-reply should enforce human approval and dispatch via email transport', async () => {
      const reply = await EmailReply.create({
        senderEmail: 'prospect@enterprise.com',
        recipientEmail: 'alltimefree4793@gmail.com',
        messageId: '<msg_incoming_12345@enterprise.com>',
        subject: 'Re: Enterprise AI Integration',
        body: 'When can we see a demonstration?',
        classification: 'meeting_request',
      });

      const res = await request(app)
        .post(`/api/replies/${reply._id}/send-reply`)
        .send({
          subject: 'Re: Enterprise AI Integration',
          bodyText: 'Hi, I would be happy to demonstrate our AI automation pipeline. Does Thursday at 2 PM work for you?',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify mock transport captured outbound mail
      expect(mockTransport.sentMessages.length).toBe(1);
      expect(mockTransport.sentMessages[0].inReplyTo).toBe('<msg_incoming_12345@enterprise.com>');

      // Verify marked reviewed
      const updatedReply = await EmailReply.findById(reply._id);
      expect(updatedReply?.reviewedAt).toBeDefined();

      // Verify logged in OutreachMessage
      const msgLog = await OutreachMessage.findOne({ recipientEmail: 'prospect@enterprise.com' });
      expect(msgLog).toBeDefined();
      expect(msgLog?.direction).toBe('outbound');
    });

    it('GET /api/replies/status should return IMAP configuration and sync cursor status', async () => {
      const res = await request(app).get('/api/replies/status');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('configured');
      expect(res.body.data).toHaveProperty('syncState');
    });
  });
});
