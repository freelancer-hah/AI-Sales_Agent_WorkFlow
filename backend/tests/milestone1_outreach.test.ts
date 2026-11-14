import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import {
  Company,
  CybellsConfig,
  OutreachContact,
  SuppressionList,
  EmailTemplate,
  EmailDraft,
  Campaign,
  OutreachMessage,
  FollowUpJob,
  EmailReply,
  Inquiry,
} from '../src/models/index.js';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

beforeEach(async () => {
  await Company.deleteMany({});
  await CybellsConfig.deleteMany({});
  await OutreachContact.deleteMany({});
  await SuppressionList.deleteMany({});
  await EmailTemplate.deleteMany({});
  await EmailDraft.deleteMany({});
  await Campaign.deleteMany({});
  await OutreachMessage.deleteMany({});
  await FollowUpJob.deleteMany({});
  await EmailReply.deleteMany({});
  await Inquiry.deleteMany({});
});

describe('Phase 2 - Milestone 1: Cybells Knowledge Base, Models & Lead Management', () => {
  describe('A. Cybells Settings & Knowledge Base API', () => {
    it('should initialize empty Cybells knowledge base on GET /api/cybells/config', async () => {
      const res = await request(app).get('/api/cybells/config').expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.agencyName).toBe('Cybells');
      expect(res.body.data.capabilities).toEqual([]);
      expect(res.body.data.caseStudies).toEqual([]);
      expect(res.body.data.faqs).toEqual([]);
      expect(res.body.data.sendingRules.dailyCap).toBe(25);
      expect(res.body.transportStatus).toBeDefined();
      expect(res.body.transportStatus.sendMode).toBe('sandbox');
      expect(res.body.transportStatus.smtpPass).toBeUndefined(); // Crucial: never leak password
    });

    it('should update Cybells configuration and user-entered knowledge base via PUT /api/cybells/config', async () => {
      const updatePayload = {
        agencyName: 'Cybells AI Solutions',
        mission: 'Empowering mid-market enterprises with autonomous AI agents',
        targetAudience: 'B2B Logistics and SaaS companies',
        brandVoice: 'Authoritative, technical, and ROI-oriented',
        capabilities: [
          {
            id: 'cap-1',
            title: 'Intelligent Document Processing',
            description: 'Automates extraction from messy PDFs, bills of lading, and freight invoices.',
            typicalUseCases: ['Logistics invoice reconciliation', 'Customs documentation parsing'],
          },
        ],
        caseStudies: [
          {
            id: 'cs-1',
            title: 'Freight Automation Pipeline',
            clientIndustry: 'Logistics',
            problemSolved: 'Manual invoice entry was causing 48-hour payment reconciliation delays.',
            metricOrResult: '75% reduction in processing time within 30 days',
            verified: true,
          },
        ],
        faqs: [
          {
            question: 'How long does implementation take?',
            answer: 'Typical pilot integrations are deployed within 2 to 4 weeks.',
          },
        ],
        sendingRules: {
          dailyCap: 40,
          minDelaySeconds: 45,
          maxDelaySeconds: 120,
          allowedSendingHours: { start: 8, end: 17 },
          allowedSendingDays: [1, 2, 3, 4, 5],
          timezone: 'America/New_York',
        },
      };

      const res = await request(app)
        .put('/api/cybells/config')
        .send(updatePayload)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.agencyName).toBe('Cybells AI Solutions');
      expect(res.body.data.capabilities.length).toBe(1);
      expect(res.body.data.capabilities[0].title).toBe('Intelligent Document Processing');
      expect(res.body.data.caseStudies.length).toBe(1);
      expect(res.body.data.caseStudies[0].verified).toBe(true);
      expect(res.body.data.sendingRules.dailyCap).toBe(40);
    });
  });

  describe('B. Phase 2 Data Models & Index Integrity', () => {
    it('should extend Company schema with Phase 3 handoff fields without breaking Phase 1 data', async () => {
      const comp = await Company.create({
        companyName: 'Apex Cloud Logistics',
        normalizedName: 'apex cloud logistics',
        website: 'https://apexcloud.example.com',
        domain: 'apexcloud.example.com',
        industry: 'Logistics',
        country: 'United States',
        city: 'Chicago',
        emails: ['info@apexcloud.example.com'],
        leadScore: 85,
        leadStatus: 'new',
        handoffToQualification: false,
      });

      expect(comp.leadStatus).toBe('new');
      expect(comp.handoffToQualification).toBe(false);
    });

    it('should enforce unique index on OutreachContact (normalizedEmail + companyId)', async () => {
      await OutreachContact.init();

      const comp = await Company.create({
        companyName: 'Vanguard Systems',
        domain: 'vanguard.example.com',
        industry: 'Technology',
      });

      await OutreachContact.create({
        companyId: comp._id,
        email: 'ceo@vanguard.example.com',
        normalizedEmail: 'ceo@vanguard.example.com',
        contactName: 'John Doe',
        jobTitle: 'CEO',
        validationStatus: 'format_valid',
        outreachStatus: 'selected',
      });

      // Attempting to insert identical email for same company must fail with duplicate key
      await expect(
        OutreachContact.create({
          companyId: comp._id,
          email: 'CEO@VANGUARD.EXAMPLE.COM',
          normalizedEmail: 'ceo@vanguard.example.com',
          contactName: 'Duplicate John',
          jobTitle: 'CEO',
        })
      ).rejects.toThrow();
    });

    it('should enforce unique index on FollowUpJob (campaignId + contactId + sequenceStep)', async () => {
      await FollowUpJob.init();

      const dummyCampaignId = new mongoose.Types.ObjectId();
      const dummyContactId = new mongoose.Types.ObjectId();

      await FollowUpJob.create({
        campaignId: dummyCampaignId,
        contactId: dummyContactId,
        sequenceStep: 1,
        scheduledAt: new Date(),
        status: 'scheduled',
      });

      await expect(
        FollowUpJob.create({
          campaignId: dummyCampaignId,
          contactId: dummyContactId,
          sequenceStep: 1,
          scheduledAt: new Date(),
          status: 'scheduled',
        })
      ).rejects.toThrow();
    });

    it('should enforce unique index on SuppressionList email', async () => {
      await SuppressionList.create({
        email: 'unsub@target.example.com',
        reason: 'unsubscribe',
      });

      await expect(
        SuppressionList.create({
          email: 'unsub@target.example.com',
          reason: 'manual_suppression',
        })
      ).rejects.toThrow();
    });
  });

  describe('C. Outreach Contact Selection & Lead Management API', () => {
    it('should select contacts from Phase 1 companies, extracting decision makers and generic emails', async () => {
      const company = await Company.create({
        companyName: 'Titan Industrial Software',
        domain: 'titan.example.com',
        website: 'https://titan.example.com',
        industry: 'Manufacturing',
        city: 'Detroit',
        country: 'United States',
        emails: ['contact@titan.example.com'],
        decisionMakers: [
          {
            fullName: 'Elena Rostova',
            jobTitle: 'VP of Engineering',
            publicBusinessEmail: 'elena@titan.example.com',
            sourceUrl: 'https://titan.example.com/team',
            confidence: 'high',
            discoveryStatus: 'identified',
          },
        ],
        leadScore: 90,
        leadStatus: 'new',
      });

      const res = await request(app)
        .post('/api/outreach/contacts/select')
        .send({ companyIds: [String(company._id)] })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.createdCount).toBe(2); // Elena + generic contact@
      expect(res.body.data.contacts.length).toBe(2);

      // Verify that Company leadStatus transitioned from 'new' to 'reviewed'
      const updatedCompany = await Company.findById(company._id);
      expect(updatedCompany?.leadStatus).toBe('reviewed');
    });

    it('should strictly skip and never select contacts present in SuppressionList', async () => {
      // Add email to suppression list first
      await SuppressionList.create({
        email: 'suppressed.ceo@acme.example.com',
        reason: 'unsubscribe',
      });

      const company = await Company.create({
        companyName: 'Acme Logistics',
        domain: 'acme.example.com',
        website: 'https://acme.example.com',
        industry: 'Logistics',
        emails: ['suppressed.ceo@acme.example.com', 'active.team@acme.example.com'],
      });

      const res = await request(app)
        .post('/api/outreach/contacts/select')
        .send({ companyIds: [String(company._id)] })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.createdCount).toBe(1); // active.team only
      expect(res.body.data.suppressedCount).toBe(1); // suppressed.ceo skipped

      const created = await OutreachContact.find({ companyId: company._id });
      expect(created.length).toBe(1);
      expect(created[0].email).toBe('active.team@acme.example.com');
    });

    it('should mark syntax-valid emails as format_valid (and never fabricate verified status)', async () => {
      const company = await Company.create({
        companyName: 'Beta Dynamics',
        domain: 'beta.example.com',
      });

      const res = await request(app)
        .post('/api/outreach/contacts/select')
        .send({
          contactSelections: [
            {
              companyId: String(company._id),
              email: 'valid.user@beta.example.com',
              contactName: 'Valid User',
              jobTitle: 'CTO',
            },
            {
              companyId: String(company._id),
              email: 'invalid-email-no-domain',
              contactName: 'Invalid Person',
            },
          ],
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      const contacts = await OutreachContact.find({ companyId: company._id }).sort({ email: 1 });
      expect(contacts.length).toBe(2);

      const invalidContact = contacts.find((c) => c.email.includes('invalid'));
      const validContact = contacts.find((c) => c.email.includes('valid.user'));

      expect(invalidContact?.validationStatus).toBe('format_invalid');
      expect(validContact?.validationStatus).toBe('format_valid');
      // Must not be marked verified by regex alone
      expect(validContact?.validationStatus).not.toBe('verified');
    });

    it('should retrieve contacts with filters via GET /api/outreach/contacts', async () => {
      const company = await Company.create({
        companyName: 'Gamma Systems',
        domain: 'gamma.example.com',
        industry: 'Security',
      });

      await OutreachContact.create([
        {
          companyId: company._id,
          email: 'alice@gamma.example.com',
          normalizedEmail: 'alice@gamma.example.com',
          contactName: 'Alice Morgan',
          jobTitle: 'CISO',
          validationStatus: 'format_valid',
          outreachStatus: 'selected',
        },
        {
          companyId: company._id,
          email: 'bob@gamma.example.com',
          normalizedEmail: 'bob@gamma.example.com',
          contactName: 'Bob Vance',
          jobTitle: 'IT Director',
          validationStatus: 'format_valid',
          outreachStatus: 'contacted',
        },
      ]);

      const res = await request(app)
        .get('/api/outreach/contacts?outreachStatus=selected')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.contacts.length).toBe(1);
      expect(res.body.data.contacts[0].contactName).toBe('Alice Morgan');
    });

    it('should update contact and enforce automatic suppression when status is changed to suppressed', async () => {
      const company = await Company.create({
        companyName: 'Delta Robotics',
        domain: 'delta.example.com',
      });

      const contact = await OutreachContact.create({
        companyId: company._id,
        email: 'dave@delta.example.com',
        normalizedEmail: 'dave@delta.example.com',
        contactName: 'Dave Miller',
        outreachStatus: 'selected',
        validationStatus: 'format_valid',
      });

      const res = await request(app)
        .patch(`/api/outreach/contacts/${contact._id}`)
        .send({ outreachStatus: 'suppressed', notes: 'Prospect explicitly opted out' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.outreachStatus).toBe('suppressed');
      expect(res.body.data.suppressionStatus.isSuppressed).toBe(true);

      // Verify that email is now added to the global SuppressionList
      const inSuppression = await SuppressionList.findOne({ email: 'dave@delta.example.com' });
      expect(inSuppression).toBeDefined();
      expect(inSuppression?.reason).toBe('manual_suppression');
    });
  });
});

