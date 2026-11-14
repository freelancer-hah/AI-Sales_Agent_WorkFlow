import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../src/app.js';
import { Company } from '../src/models/Company.js';
import { OutreachContact } from '../src/models/OutreachContact.js';
import { CybellsConfig } from '../src/models/CybellsConfig.js';
import { EmailDraft } from '../src/models/EmailDraft.js';
import { SuppressionList } from '../src/models/SuppressionList.js';
import { spamScorerService } from '../src/services/outreach/spamScorerService.js';
import { emailPersonalizationService } from '../src/services/outreach/emailPersonalizationService.js';

describe('Phase 2 - Milestone 3: Gemini Personalized Email Generator & Deliverability', () => {
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
    await CybellsConfig.deleteMany({});
    await EmailDraft.deleteMany({});
    await SuppressionList.deleteMany({});

    // Seed empty/baseline Cybells Knowledge Base
    await CybellsConfig.create({
      agencyName: 'Cybells AI Automation',
      mission: 'Helping logistics and healthcare leaders automate complex workflows with AI agents.',
      targetAudience: 'B2B Enterprise Operations Leaders',
      brandVoice: 'Professional, consultative, direct, concise, and respectful',
      capabilities: [
        {
          id: 'cap-1',
          title: 'Automated Invoice & Dispatch Processing',
          description: 'AI agents that extract, reconcile, and post logistics invoices directly to ERP.',
          typicalUseCases: ['Freight dispatching', 'Vendor billing reconciliation'],
        },
      ],
      caseStudies: [], // Knowledge base starts with NO case studies
      senderName: 'Hafiz from Cybells',
      signature: 'Best regards,\nHafiz | AI Solutions Lead',
      optOutText: 'If you would rather not hear from us, click below to unsubscribe.',
      postalAddress: '123 Tech Way, Suite 400, Austin, TX 78701',
    });
  });

  describe('A. Spam Trigger Scorer & Deliverability Engine', () => {
    it('should assign a pristine low spam score to clean, consultative B2B copy with footer', () => {
      const subject = 'Quick observation regarding Acme Logistics dispatch workflow';
      const body = `Hi Sarah,\n\nI noticed Acme Logistics manages a large regional carrier fleet across Texas. With manual dispatch paperwork, reconciliation often delays billing.\n\nWe recently automated freight invoice matching for operations teams without requiring ERP overhaul.\n\nOpen to exploring whether a similar AI workflow is relevant for your dispatch team?\n\nBest regards,\nHafiz`;

      const result = spamScorerService.analyze(subject, body, true);

      expect(result.spamScore).toBeLessThan(15);
      expect(result.isHighRisk).toBe(false);
      expect(result.spamFlags).toHaveLength(0);
    });

    it('should heavily penalize high-risk spam words, exclamation marks, and ALL-CAPS shouting', () => {
      const spammySubject = 'ACT NOW! 100% FREE RISK-FREE OFFER $$$';
      const spammyBody = `CLICK HERE to earn fast cash and pure profit! Satisfaction guaranteed with no catch! Order now for instant cash! YOU WILL MAKE MONEY!`;

      const result = spamScorerService.analyze(spammySubject, spammyBody, false);

      expect(result.spamScore).toBeGreaterThanOrEqual(60);
      expect(result.isHighRisk).toBe(true);
      expect(result.spamFlags.some((f) => f.includes('High-risk spam phrase'))).toBe(true);
      expect(result.spamFlags.some((f) => f.includes('Exclamation mark'))).toBe(true);
      expect(result.spamFlags.some((f) => f.includes('ALL-CAPS'))).toBe(true);
      expect(result.spamFlags.some((f) => f.includes('unsubscribe'))).toBe(true);
    });

    it('should allow legitimate industry acronyms (AI, CRM, ERP, B2B) without flagging as ALL-CAPS shouting', () => {
      const subject = 'AI and ERP workflow automation for B2B logistics';
      const body = 'Our AI integrates with your CRM and ERP systems for B2B fulfillment.';

      const result = spamScorerService.analyze(subject, body, true);

      expect(result.spamFlags.some((f) => f.includes('ALL-CAPS'))).toBe(false);
    });
  });

  describe('B. Grounded Email Generation & Copywriting Frameworks', () => {
    it('should generate personalized draft with 3 subject variants, evidence, and grounded facts', async () => {
      const company = await Company.create({
        companyName: 'Apex Cold Freight',
        website: 'https://apexfreight.example.com',
        domain: 'apexfreight.example.com',
        industry: 'Transportation & Logistics',
        city: 'Dallas',
        country: 'United States',
        services: ['Cold chain warehousing', 'Refrigerated freight delivery'],
        aiAnalysis: {
          problems: [
            {
              title: 'Manual Temperature Log Reconciliation',
              problem: 'Drivers record reefer temps on paper manifests causing audit delays.',
              hypothesis: false,
            },
          ],
          opportunities: [
            {
              title: 'Automated Temperature IoT Ingestion',
              businessProblem: 'Manual temperature manifests delay billing.',
              recommendedSolution: 'Ingest reefer sensor telemetry automatically.',
              whyNeeded: 'Eliminates paper logging errors and driver compliance lag.',
              howItWorks: 'Direct telemetry to database',
              benefits: '100% audit readiness',
              supportingEvidence: 'Reefer regulations',
              confidence: 'high',
            },
          ],
          leadScore: 88,
          scoreExplanation: 'High opportunity for logistics AI automation.',
          evidence: ['Website mentions cold chain fleet'],
          missingInformation: [],
        },
      });

      const contact = await OutreachContact.create({
        companyId: company._id,
        email: 'vp.ops@apexfreight.example.com',
        contactName: 'Marcus Vance',
        jobTitle: 'VP of Fleet Operations',
        emailSourceUrl: 'https://apexfreight.example.com/team',
        validationStatus: 'format_valid',
        outreachStatus: 'selected',
      });

      // Mock Gemini call to verify structure and grounding
      const mockGenerateContent = vi.fn().mockResolvedValue({
        text: JSON.stringify({
          subjectOptions: [
            'Question regarding Apex Cold Freight temperature manifest audits',
            'Automating paper temperature logging for your reefer fleet',
            'Observation on Apex Cold Freight cold chain documentation',
          ],
          subject: 'Question regarding Apex Cold Freight temperature manifest audits',
          bodyHtml: '<p>Hi Marcus,</p><p>Noticed Apex Cold Freight manages specialized refrigerated fleet operations across Dallas.</p><p>Drivers often lose hours reconciling paper temperature manifests.</p><p>We help logistics teams automate documentation directly into their dispatch workflows.</p><p>Open to a quick note if this is on your radar?</p><p>Best regards,<br>Hafiz</p>',
          bodyText: 'Hi Marcus,\n\nNoticed Apex Cold Freight manages specialized refrigerated fleet operations across Dallas.\n\nDrivers often lose hours reconciling paper temperature manifests.\n\nWe help logistics teams automate documentation directly into their dispatch workflows.\n\nOpen to a quick note if this is on your radar?\n\nBest regards,\nHafiz',
          personalizationEvidence: {
            phase1ProblemsUsed: ['Manual Temperature Log Reconciliation'],
            cybellsCapabilityUsed: 'Automated Invoice & Dispatch Processing',
            matchedReasoning: 'Eliminates manual driver paperwork and manifest reconciliation lag.',
          },
        }),
      });

      (emailPersonalizationService as any).client = {
        models: {
          generateContent: mockGenerateContent,
        },
      };

      const result = await emailPersonalizationService.generatePersonalizedDraft({
        company,
        contact,
        framework: 'pain_agitate_solve',
      });

      expect(result.subjectOptions).toHaveLength(3);
      expect(result.subject).toContain('Apex Cold Freight');
      expect(result.personalizationEvidence.phase1ProblemsUsed).toContain('Manual Temperature Log Reconciliation');
      expect(result.bodyHtml).toContain('{{UNSUBSCRIBE_URL}}'); // Appends compliant unsubscribe link
      expect(result.bodyText).toContain('Unsubscribe: {{UNSUBSCRIBE_URL}}');
      expect(result.spamScore).toBeLessThan(25);
    });

    it('should throw an informative error when Gemini fails or quota is exhausted (Golden Rule 2.9)', async () => {
      const company = await Company.create({
        companyName: 'Beta Industrial',
        website: 'https://beta.example.com',
        domain: 'beta.example.com',
        industry: 'Manufacturing',
      });

      const contact = await OutreachContact.create({
        companyId: company._id,
        email: 'cto@beta.example.com',
        contactName: 'Elena Rostova',
        jobTitle: 'CTO',
        emailSourceUrl: 'https://beta.example.com/leadership',
        validationStatus: 'format_valid',
        outreachStatus: 'selected',
      });

      // Mock Gemini quota exhaustion (HTTP 429)
      (emailPersonalizationService as any).client = {
        models: {
          generateContent: vi.fn().mockRejectedValue(new Error('Resource has been exhausted (e.g. check quota): 429')),
        },
      };

      await expect(
        emailPersonalizationService.generatePersonalizedDraft({
          company,
          contact,
        })
      ).rejects.toThrow(/Resource has been exhausted|Gemini email generation failed/);
    });
  });

  describe('C. Email Draft API & Approval Lifecycle Endpoints', () => {
    it('POST /api/outreach/drafts/generate should create a draft and set contact to pending_approval', async () => {
      const company = await Company.create({
        companyName: 'Gamma Healthcare Solutions',
        website: 'https://gamma.example.com',
        domain: 'gamma.example.com',
        industry: 'Healthcare',
      });

      const contact = await OutreachContact.create({
        companyId: company._id,
        email: 'dir.ops@gamma.example.com',
        contactName: 'David Kim',
        jobTitle: 'Director of Clinical Operations',
        emailSourceUrl: 'https://gamma.example.com/contact',
        validationStatus: 'format_valid',
        outreachStatus: 'selected',
      });

      (emailPersonalizationService as any).client = {
        models: {
          generateContent: vi.fn().mockResolvedValue({
            text: JSON.stringify({
              subjectOptions: [
                'Gamma Healthcare clinical operations inquiry',
                'Patient document processing for Gamma Healthcare',
                'Workflow efficiency for clinical staff',
              ],
              subject: 'Gamma Healthcare clinical operations inquiry',
              bodyHtml: '<p>Hi David,</p><p>Reaching out regarding Gamma Healthcare patient paperwork.</p>',
              bodyText: 'Hi David,\n\nReaching out regarding Gamma Healthcare patient paperwork.',
              personalizationEvidence: {
                phase1ProblemsUsed: ['Document Intake'],
                cybellsCapabilityUsed: 'Automated Invoice & Dispatch Processing',
                matchedReasoning: 'Healthcare document workflow',
              },
            }),
          }),
        },
      };

      const res = await request(app)
          .post('/api/outreach/drafts/generate')
          .send({ contactId: contact._id.toString(), framework: 'question_value_cta' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.drafts).toHaveLength(1);

        const draft = res.body.data.drafts[0];
        expect(draft.approvalStatus).toBe('draft');
        expect(draft.subjectOptions).toHaveLength(3);

        // Contact should now be transitioned to pending_approval
        const updatedContact = await OutreachContact.findById(contact._id);
        expect(updatedContact?.outreachStatus).toBe('pending_approval');
    });

    it('POST /api/outreach/drafts/generate should refuse to generate draft for suppressed or unsubscribed contacts', async () => {
      const company = await Company.create({
        companyName: 'Suppressed Corp',
        website: 'https://suppressed.example.com',
        domain: 'suppressed.example.com',
      });

      const contact = await OutreachContact.create({
        companyId: company._id,
        email: 'optout@suppressed.example.com',
        contactName: 'Opted Out User',
        jobTitle: 'Manager',
        emailSourceUrl: 'https://suppressed.example.com/team',
        validationStatus: 'format_valid',
        outreachStatus: 'suppressed',
        suppressionStatus: { isSuppressed: true, reason: 'unsubscribe' },
      });

      const res = await request(app)
        .post('/api/outreach/drafts/generate')
        .send({ contactId: contact._id.toString() });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('suppressed or unsubscribed');
    });

    it('PATCH /api/outreach/drafts/:id should allow approving draft, calculate content hash, and set contact to ready', async () => {
      const company = await Company.create({
        companyName: 'Delta Robotics',
        website: 'https://delta.example.com',
        domain: 'delta.example.com',
      });

      const contact = await OutreachContact.create({
        companyId: company._id,
        email: 'ceo@delta.example.com',
        contactName: 'Rachel Green',
        jobTitle: 'Chief Executive Officer',
        emailSourceUrl: 'https://delta.example.com/about',
        validationStatus: 'format_valid',
        outreachStatus: 'pending_approval',
      });

      const draft = await EmailDraft.create({
        contactId: contact._id,
        companyId: company._id,
        sequenceStep: 0,
        subjectOptions: ['Variant 1', 'Variant 2 (Selected)', 'Variant 3'],
        subject: 'Variant 1',
        bodyHtml: '<p>Hi Rachel, quick note.</p>',
        bodyText: 'Hi Rachel, quick note.',
        approvalStatus: 'draft',
      });

      // Update to switch subject variant and approve
      const res = await request(app)
        .patch(`/api/outreach/drafts/${draft._id}`)
        .send({
          subjectVariantUsed: 1,
          approvalStatus: 'approved',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.approvalStatus).toBe('approved');
      expect(res.body.data.subject).toBe('Variant 2 (Selected)');
      expect(res.body.data.approvedContentHash).toBeTruthy();
      expect(res.body.data.approvedAt).toBeTruthy();

      // Contact outreach status must transition to 'ready'
      const updatedContact = await OutreachContact.findById(contact._id);
      expect(updatedContact?.outreachStatus).toBe('ready');
    });
  });
});
