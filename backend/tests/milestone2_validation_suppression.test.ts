import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import {
  Company,
  OutreachContact,
  SuppressionList,
  FollowUpJob,
  OutreachMessage,
} from '../src/models/index.js';
import { contactValidationService } from '../src/services/outreach/contactValidationService.js';
import { unsubscribeService } from '../src/services/outreach/unsubscribeService.js';

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
  await OutreachContact.deleteMany({});
  await SuppressionList.deleteMany({});
  await FollowUpJob.deleteMany({});
  await OutreachMessage.deleteMany({});
});

describe('Phase 2 - Milestone 2: Contact Validation, Suppression & Signed Unsubscribe', () => {
  describe('A. Advanced Contact & Email Syntax Validation Engine', () => {
    it('should validate clean corporate and business emails as format_valid', () => {
      const validEmails = [
        'sarah.jenkins@apexcloud.com',
        'john+sales@logistics360.co.uk',
        'contact.us@sub.domain.org',
        'first_last@tech-corp.net',
      ];

      for (const email of validEmails) {
        const result = contactValidationService.validateEmailFormat(email);
        expect(result.isValid).toBe(true);
        expect(result.status).toBe('format_valid');
        expect(result.status).not.toBe('verified'); // Golden Rule: regex alone never produces verified
        expect(result.isRoleBased).toBe(false);
        expect(result.isDisposable).toBe(false);
      }
    });

    it('should reject malformed, empty, or invalid emails as format_invalid', () => {
      const invalidEmails = [
        '',
        'notanemail',
        '@nodomain.com',
        'noat-sign.com',
        'user@nodot',
        'user@domain.c', // TLD < 2 chars
        'a'.repeat(260) + '@domain.com', // Exceeds 254 length
      ];

      for (const email of invalidEmails) {
        const result = contactValidationService.validateEmailFormat(email);
        expect(result.isValid).toBe(false);
        expect(result.status).toBe('format_invalid');
        expect(result.reason).toBeDefined();
      }
    });

    it('should identify role-based mailbox prefixes and flag them as risky', () => {
      const roleEmails = [
        'support@company.com',
        'billing@logistics.com',
        'admin@enterprise.org',
        'no-reply@service.io',
      ];

      for (const email of roleEmails) {
        const result = contactValidationService.validateEmailFormat(email);
        expect(result.isValid).toBe(true);
        expect(result.status).toBe('risky');
        expect(result.isRoleBased).toBe(true);
        expect(result.reason).toContain('Role-based mailbox');
      }
    });

    it('should identify temporary and disposable domains and flag them as risky', () => {
      const disposableEmails = [
        'tempuser@mailinator.com',
        'throwaway@tempmail.com',
        'user123@10minutemail.com',
      ];

      for (const email of disposableEmails) {
        const result = contactValidationService.validateEmailFormat(email);
        expect(result.isValid).toBe(true);
        expect(result.status).toBe('risky');
        expect(result.isDisposable).toBe(true);
        expect(result.reason).toContain('disposable inbox');
      }
    });
  });

  describe('B. Suppression List Management & Job Cancellation', () => {
    it('should add an email to suppression list and cancel all pending follow-up jobs and scheduled messages', async () => {
      const company = await Company.create({
        companyName: 'Acme Freight Logistics',
        domain: 'acmefreight.example.com',
      });

      const contact = await OutreachContact.create({
        companyId: company._id,
        email: 'vp.ops@acmefreight.example.com',
        normalizedEmail: 'vp.ops@acmefreight.example.com',
        contactName: 'Robert Paulson',
        outreachStatus: 'selected',
        validationStatus: 'format_valid',
      });

      const dummyCampaignId = new mongoose.Types.ObjectId();

      // Schedule a follow-up job and an outreach message
      const job = await FollowUpJob.create({
        campaignId: dummyCampaignId,
        contactId: contact._id,
        sequenceStep: 2,
        scheduledAt: new Date(Date.now() + 86400000),
        status: 'scheduled',
      });

      const message = await OutreachMessage.create({
        campaignId: dummyCampaignId,
        contactId: contact._id,
        senderEmail: 'outreach@cybells.ai',
        recipientEmail: contact.email,
        subject: 'Cybells AI Follow-up',
        status: 'scheduled',
        scheduledFor: new Date(Date.now() + 86400000),
      });

      // Execute suppression via API
      const res = await request(app)
        .post('/api/suppression')
        .send({
          email: 'vp.ops@acmefreight.example.com',
          reason: 'hard_bounce',
          source: 'smtp_bounce_handler',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.suppressedCount).toBe(1);
      expect(res.body.data.contactsUpdated).toBe(1);
      expect(res.body.data.jobsCancelled).toBe(1);
      expect(res.body.data.messagesCancelled).toBe(1);

      // Verify contact status is updated
      const updatedContact = await OutreachContact.findById(contact._id);
      expect(updatedContact?.outreachStatus).toBe('suppressed');
      expect(updatedContact?.suppressionStatus.isSuppressed).toBe(true);
      expect(updatedContact?.suppressionStatus.reason).toBe('hard_bounce');

      // Verify job and message were cancelled
      const updatedJob = await FollowUpJob.findById(job._id);
      expect(updatedJob?.status).toBe('cancelled');

      const updatedMessage = await OutreachMessage.findById(message._id);
      expect(updatedMessage?.status).toBe('cancelled');
    });

    it('should support bulk suppression imports via POST /api/suppression', async () => {
      const res = await request(app)
        .post('/api/suppression')
        .send({
          emails: [
            'optout1@domain.com',
            'optout2@domain.com',
            'bounce3@domain.com',
          ],
          reason: 'manual_suppression',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.suppressedCount).toBe(3);

      const count = await SuppressionList.countDocuments({});
      expect(count).toBe(3);
    });

    it('should list suppressed emails with pagination via GET /api/suppression', async () => {
      await SuppressionList.create([
        { email: 'user1@test.com', reason: 'unsubscribe' },
        { email: 'user2@test.com', reason: 'hard_bounce' },
      ]);

      const res = await request(app).get('/api/suppression?reason=unsubscribe').expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.entries.length).toBe(1);
      expect(res.body.data.entries[0].email).toBe('user1@test.com');
    });

    it('should remove an email from suppression list via DELETE /api/suppression/:id', async () => {
      const company = await Company.create({ companyName: 'Test Co' });
      const contact = await OutreachContact.create({
        companyId: company._id,
        email: 'reactivate@test.com',
        normalizedEmail: 'reactivate@test.com',
        outreachStatus: 'suppressed',
        suppressionStatus: { isSuppressed: true, reason: 'manual_suppression' },
        validationStatus: 'format_valid',
      });

      const entry = await SuppressionList.create({
        email: 'reactivate@test.com',
        reason: 'manual_suppression',
      });

      const res = await request(app).delete(`/api/suppression/${entry._id}`).expect(200);
      expect(res.body.success).toBe(true);

      const inSuppression = await SuppressionList.findById(entry._id);
      expect(inSuppression).toBeNull();

      const updatedContact = await OutreachContact.findById(contact._id);
      expect(updatedContact?.suppressionStatus.isSuppressed).toBe(false);
      expect(updatedContact?.outreachStatus).toBe('selected');
    });
  });

  describe('C. Signed Unsubscribe Tokens & One-Click Unsubscribe Flow', () => {
    it('should generate a valid HMAC-SHA256 signed token and verify it correctly', () => {
      const token = unsubscribeService.generateToken({
        contactId: '6ae800000000000000000001',
        email: 'ceo@techstartup.example.com',
        companyId: '6ae800000000000000000002',
      });

      expect(typeof token).toBe('string');
      expect(token).toContain('.');

      const verification = unsubscribeService.verifyToken(token);
      expect(verification.valid).toBe(true);
      expect(verification.payload?.email).toBe('ceo@techstartup.example.com');
      expect(verification.payload?.contactId).toBe('6ae800000000000000000001');
    });

    it('should reject tampered or corrupted tokens', () => {
      const token = unsubscribeService.generateToken({
        contactId: '6ae800000000000000000001',
        email: 'hacker.target@example.com',
        companyId: '6ae800000000000000000002',
      });

      const [payload, hmac] = token.split('.');
      // Tamper payload slightly
      const tamperedToken = `${payload}xyz.${hmac}`;

      const result = unsubscribeService.verifyToken(tamperedToken);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('tampered');
    });

    it('should render HTML confirmation page on GET /api/unsubscribe/:token and support JSON format', async () => {
      const token = unsubscribeService.generateToken({
        contactId: '6ae800000000000000000001',
        email: 'prospect@corp.example.com',
        companyId: '6ae800000000000000000002',
      });

      // 1. HTML render test
      const htmlRes = await request(app).get(`/api/unsubscribe/${token}`).expect(200);
      expect(htmlRes.headers['content-type']).toContain('text/html');
      expect(htmlRes.text).toContain('Confirm Unsubscribe');
      expect(htmlRes.text).toContain('prospect@corp.example.com');

      // 2. JSON API test
      const jsonRes = await request(app)
        .get(`/api/unsubscribe/${token}?format=json`)
        .set('Accept', 'application/json')
        .expect(200);

      expect(jsonRes.body.success).toBe(true);
      expect(jsonRes.body.data.email).toBe('prospect@corp.example.com');
      expect(jsonRes.body.data.isAlreadySuppressed).toBe(false);
    });

    it('should execute immediate unsubscribe upon POST /api/unsubscribe/:token (RFC 8058 one-click)', async () => {
      const company = await Company.create({ companyName: 'OneClick Target' });
      const contact = await OutreachContact.create({
        companyId: company._id,
        email: 'oneclick@target.example.com',
        normalizedEmail: 'oneclick@target.example.com',
        contactName: 'One Click User',
        outreachStatus: 'contacted',
        validationStatus: 'format_valid',
      });

      const token = unsubscribeService.generateToken({
        contactId: String(contact._id),
        email: contact.email,
        companyId: String(company._id),
      });

      // Perform one-click unsubscribe
      const res = await request(app)
        .post(`/api/unsubscribe/${token}`)
        .set('Accept', 'application/json')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('oneclick@target.example.com');

      // Verify contact is now unsubscribed
      const updatedContact = await OutreachContact.findById(contact._id);
      expect(updatedContact?.outreachStatus).toBe('unsubscribed');
      expect(updatedContact?.suppressionStatus.isSuppressed).toBe(true);
      expect(updatedContact?.suppressionStatus.reason).toBe('unsubscribe');

      // Verify email is in SuppressionList
      const inSuppression = await SuppressionList.findOne({ email: 'oneclick@target.example.com' });
      expect(inSuppression).toBeDefined();
      expect(inSuppression?.reason).toBe('unsubscribe');
      expect(inSuppression?.source).toBe('one_click_unsubscribe');
    });
  });
});
