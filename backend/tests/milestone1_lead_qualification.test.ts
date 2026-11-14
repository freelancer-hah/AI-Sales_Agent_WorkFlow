import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../src/app.js';
import { Company } from '../src/models/Company.js';
import { OutreachContact } from '../src/models/OutreachContact.js';
import { SuppressionList } from '../src/models/SuppressionList.js';
import { EmailReply } from '../src/models/EmailReply.js';
import { LeadQualification } from '../src/models/LeadQualification.js';
import { QualificationQuestion } from '../src/models/QualificationQuestion.js';
import { QualificationActivity } from '../src/models/QualificationActivity.js';
import { leadQualificationService } from '../src/services/qualification/leadQualificationService.js';

describe('Phase 3 - Milestone 1: Lead Qualification Foundation & Integration', () => {
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
    await EmailReply.deleteMany({});
    await LeadQualification.deleteMany({});
    await QualificationQuestion.deleteMany({});
    await QualificationActivity.deleteMany({});
  });

  const createTestCompanyAndContact = async (options?: {
    isSuppressed?: boolean;
    outreachStatus?: any;
    handoffToQualification?: boolean;
    problems?: string[];
  }) => {
    const company = await Company.create({
      companyName: 'Masood Textile Mills',
      normalizedName: 'masood textile mills',
      website: 'https://masoodtextile.com',
      domain: 'masoodtextile.com',
      industry: 'Textiles',
      category: 'Garments',
      description: 'Multi-unit vertical textile operations',
      country: 'Pakistan',
      city: 'Faisalabad',
      companySize: 'Enterprise: 1000+ employees',
      leadScore: 82,
      handoffToQualification: options?.handoffToQualification ?? false,
      aiAnalysis: {
        summary: 'High potential for document automation',
        problems: (options?.problems || ['Manual Manifest Entry', 'Data Silos Across Units']).map((p) => ({
          title: p,
          problem: `Detailed problem for ${p}`,
          hypothesis: true,
          evidence: 'From site',
        })),
        opportunities: [
          {
            title: 'Automated Document Extraction',
            businessProblem: 'Manual data entry',
            recommendedSolution: 'Custom AI Document Agent',
            howItWorks: 'Extracts invoices',
            benefits: 'Saves 20 hrs/week',
            whyNeeded: 'Reduce manifest latency',
          },
        ],
        leadScore: 82,
        scoreExplanation: 'Strong enterprise fit',
        evidence: ['Large operations'],
        missingInformation: [],
      },
    });

    const contact = await OutreachContact.create({
      companyId: company._id,
      email: 'waqas@masoodtextile.com',
      normalizedEmail: 'waqas@masoodtextile.com',
      emailSourceUrl: 'https://masoodtextile.com/team',
      contactName: 'Waqas Ahmad',
      jobTitle: 'Head of Operations & Logistics',
      validationStatus: 'verified',
      outreachStatus: options?.outreachStatus || 'new',
      suppressionStatus: {
        isSuppressed: options?.isSuppressed || false,
        reason: options?.isSuppressed ? 'Opted out' : '',
      },
    });

    return { company, contact };
  };

  describe('Eligibility Verification (Safety & Opt-Out Guards)', () => {
    it('rejects qualification for non-existent contact', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const result = await leadQualificationService.checkEligibility(fakeId);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Contact record not found');
    });

    it('rejects qualification for contact marked as suppressed or unsubscribed', async () => {
      const { contact } = await createTestCompanyAndContact({ isSuppressed: true, outreachStatus: 'suppressed' });
      const result = await leadQualificationService.checkEligibility(contact._id.toString());
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('suppressed or unsubscribed');
    });

    it('rejects qualification for globally suppressed emails', async () => {
      const { contact } = await createTestCompanyAndContact();
      await SuppressionList.create({
        email: contact.normalizedEmail,
        reason: 'spam_complaint',
        source: 'unsubscribe_link',
      });

      const result = await leadQualificationService.checkEligibility(contact._id.toString());
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('global suppression registry');
    });

    it('prevents duplicate active qualification for the same contact', async () => {
      const { company, contact } = await createTestCompanyAndContact({ handoffToQualification: true });

      // Create an active qualification
      await LeadQualification.create({
        companyId: company._id,
        contactId: contact._id,
        qualificationStatus: 'in_progress',
        interestLevel: 'high',
      });

      const result = await leadQualificationService.checkEligibility(contact._id.toString());
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Active qualification already exists');
      expect(result.existingQualificationId).toBeDefined();
    });

    it('rejects contact without buying interest unless allowManual is true', async () => {
      const { contact } = await createTestCompanyAndContact({ outreachStatus: 'contacted' });
      const result = await leadQualificationService.checkEligibility(contact._id.toString(), false);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('not demonstrated genuine buying interest');

      // Allowed when sales rep explicitly initiates manually
      const manualResult = await leadQualificationService.checkEligibility(contact._id.toString(), true);
      expect(manualResult.eligible).toBe(true);
    });

    it('qualifies contact with positive email reply in Phase 2', async () => {
      const { company, contact } = await createTestCompanyAndContact({ outreachStatus: 'replied' });
      await EmailReply.create({
        contactId: contact._id,
        companyId: company._id,
        senderEmail: contact.email,
        recipientEmail: 'outreach@cybells.ai',
        subject: 'Re: AI Solutions',
        body: 'Can we schedule a call regarding your document agents?',
        receivedAt: new Date(),
        classification: 'meeting_request',
        isRead: true,
      });

      const result = await leadQualificationService.checkEligibility(contact._id.toString());
      expect(result.eligible).toBe(true);
      expect(result.contact?._id.toString()).toBe(contact._id.toString());
    });
  });

  describe('Start Qualification Workflow', () => {
    it('creates lead qualification record, links Phase 1 facts, and logs activity', async () => {
      const { company, contact } = await createTestCompanyAndContact({
        handoffToQualification: true,
        outreachStatus: 'interested',
        problems: ['High-Volume B2B Manifests', 'Warehouse Sync Latency'],
      });

      const qual = await leadQualificationService.startQualification({
        contactId: contact._id.toString(),
        sourceType: 'email',
        assignedTo: 'Sarah Closer',
        actor: 'human',
        actorName: 'Sarah Closer',
        allowManual: true,
      });

      expect(qual).toBeDefined();
      expect(qual.qualificationStatus).toBe('in_progress');
      expect(qual.interestLevel).toBeDefined();
      expect(qual.companyId.toString()).toBe(company._id.toString());
      expect(qual.contactId.toString()).toBe(contact._id.toString());
      expect(qual.assignedTo).toBe('Sarah Closer');

      // Pre-populated Phase 1 problems
      expect(qual.businessChallenges).toContain('High-Volume B2B Manifests');
      expect(qual.requiredSolutions).toContain('Custom AI Document Agent');

      // Auto-inferred decision maker role from C-level title
      expect(qual.decisionMakingAuthority.status).toBe('decision_maker');

      // Verifies Company and Contact status update
      const updatedContact = await OutreachContact.findById(contact._id);
      expect(updatedContact?.outreachStatus).toBe('qualifying');

      const updatedCompany = await Company.findById(company._id);
      expect(updatedCompany?.leadStatus).toBe('qualifying');

      // Verifies Audit Activity created
      const activities = await QualificationActivity.find({ qualificationId: qual._id });
      expect(activities.length).toBe(1);
      expect(activities[0].activityType).toBe('qualification_started');
      expect(activities[0].actorName).toBe('Sarah Closer');
    });
  });

  describe('Qualification Status State Machine', () => {
    it('allows valid transitions: in_progress -> awaiting_information -> ready_for_review -> qualified', async () => {
      const { company, contact } = await createTestCompanyAndContact({ handoffToQualification: true });
      const qual = await leadQualificationService.startQualification({
        contactId: contact._id.toString(),
        allowManual: true,
      });

      // 1. in_progress -> awaiting_information
      const s1 = await leadQualificationService.updateQualificationStatus(
        qual._id.toString(),
        'awaiting_information',
        'Asked ERP system question',
        'ai'
      );
      expect(s1.qualificationStatus).toBe('awaiting_information');

      // 2. awaiting_information -> ready_for_review
      const s2 = await leadQualificationService.updateQualificationStatus(
        qual._id.toString(),
        'ready_for_review',
        'All BANT questions answered'
      );
      expect(s2.qualificationStatus).toBe('ready_for_review');

      // 3. ready_for_review -> qualified
      const s3 = await leadQualificationService.updateQualificationStatus(
        qual._id.toString(),
        'qualified',
        'Meets enterprise qualification criteria'
      );
      expect(s3.qualificationStatus).toBe('qualified');
      expect(s3.humanReview.reviewStatus).toBe('approved_qualified');

      const updatedCompany = await Company.findById(company._id);
      expect(updatedCompany?.leadStatus).toBe('qualified');

      const updatedContact = await OutreachContact.findById(contact._id);
      expect(updatedContact?.outreachStatus).toBe('qualified');
    });

    it('rejects invalid transitions (e.g. not_started -> ready_for_review)', async () => {
      const { company, contact } = await createTestCompanyAndContact();
      const qual = await LeadQualification.create({
        companyId: company._id,
        contactId: contact._id,
        qualificationStatus: 'not_started',
      });

      await expect(
        leadQualificationService.updateQualificationStatus(qual._id.toString(), 'ready_for_review')
      ).rejects.toThrow('Invalid qualification status transition');
    });

    it('handles disqualification with audit reason and updates lead records', async () => {
      const { company, contact } = await createTestCompanyAndContact({ handoffToQualification: true });
      const qual = await leadQualificationService.startQualification({
        contactId: contact._id.toString(),
        allowManual: true,
      });

      const disqualified = await leadQualificationService.updateQualificationStatus(
        qual._id.toString(),
        'disqualified',
        'Competitor research account / no legitimate enterprise use case',
        'human',
        'Sales Manager'
      );

      expect(disqualified.qualificationStatus).toBe('disqualified');
      expect(disqualified.disqualificationReason).toContain('Competitor research');

      const updatedCompany = await Company.findById(company._id);
      expect(updatedCompany?.leadStatus).toBe('disqualified');

      const updatedContact = await OutreachContact.findById(contact._id);
      expect(updatedContact?.outreachStatus).toBe('disqualified');

      const activities = await QualificationActivity.find({
        qualificationId: qual._id,
        activityType: 'status_changed',
      });
      expect(activities.length).toBe(1);
      expect(activities[0].title).toContain('in_progress -> disqualified');
    });
  });

  describe('Structured Field Updates & Auto-Score Calculation', () => {
    it('updates BANT fields, systems, and recalculates score from breakdown', async () => {
      const { contact } = await createTestCompanyAndContact({ handoffToQualification: true });
      const qual = await leadQualificationService.startQualification({
        contactId: contact._id.toString(),
        allowManual: true,
      });

      const updated = await leadQualificationService.updateQualification(
        qual._id.toString(),
        {
          currentSystems: ['SAP S/4HANA', 'Legacy Excel Spreadsheets'],
          businessPriorities: ['Reduce manual paperwork', 'Centralize QC manifests'],
          purchasingTimeline: { status: 'within_1_month', details: 'Q4 deployment target' },
          budgetInformation: { status: 'disclosed', details: 'Approved $30k-$50k automation budget' },
          scoreBreakdown: {
            needClarity: 25,
            solutionFit: 25,
            engagement: 18,
            timeline: 15,
            authority: 10,
            budgetReadiness: 5,
          },
        },
        'Tech Lead Reviewer'
      );

      expect(updated.currentSystems).toEqual(['SAP S/4HANA', 'Legacy Excel Spreadsheets']);
      expect(updated.purchasingTimeline.status).toBe('within_1_month');
      expect(updated.budgetInformation.status).toBe('disclosed');
      // 25+25+18+15+10+5 = 98
      expect(updated.qualificationScore).toBe(98);
    });
  });

  describe('REST API Endpoints Integration (/api/qualifications)', () => {
    it('GET /api/qualifications returns paginated results and stats metrics', async () => {
      const { company, contact } = await createTestCompanyAndContact({ handoffToQualification: true });
      await leadQualificationService.startQualification({
        contactId: contact._id.toString(),
        allowManual: true,
      });

      const res = await request(app).get('/api/qualifications').expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.qualifications.length).toBe(1);
      expect(res.body.data.stats.total).toBe(1);
      expect(res.body.data.stats.inProgress).toBe(1);
      expect(res.body.data.qualifications[0].companyId.companyName).toBe('Masood Textile Mills');
    });

    it('GET /api/qualifications/check-eligibility/:contactId returns eligibility status', async () => {
      const { contact } = await createTestCompanyAndContact({ handoffToQualification: true });

      const res = await request(app)
        .get(`/api/qualifications/check-eligibility/${contact._id}?allowManual=true`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.eligible).toBe(true);
    });

    it('POST /api/qualifications/start creates qualification via API', async () => {
      const { contact } = await createTestCompanyAndContact({ handoffToQualification: true });

      const res = await request(app)
        .post('/api/qualifications/start')
        .send({
          contactId: contact._id.toString(),
          sourceType: 'email',
          assignedTo: 'Farhan Account Exec',
          allowManual: true,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.qualificationStatus).toBe('in_progress');
      expect(res.body.data.assignedTo).toBe('Farhan Account Exec');
    });

    it('PATCH /api/qualifications/:id/status updates status via API', async () => {
      const { contact } = await createTestCompanyAndContact({ handoffToQualification: true });
      const qual = await leadQualificationService.startQualification({
        contactId: contact._id.toString(),
        allowManual: true,
      });

      const res = await request(app)
        .patch(`/api/qualifications/${qual._id}/status`)
        .send({
          status: 'awaiting_information',
          reason: 'Awaiting prospect response regarding current ERP version',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.qualificationStatus).toBe('awaiting_information');
    });

    it('GET /api/qualifications/:id returns full detail with populated relations', async () => {
      const { contact } = await createTestCompanyAndContact({ handoffToQualification: true });
      const qual = await leadQualificationService.startQualification({
        contactId: contact._id.toString(),
        allowManual: true,
      });

      const res = await request(app).get(`/api/qualifications/${qual._id}`).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.qualification._id).toBe(qual._id.toString());
      expect(res.body.data.activities).toBeDefined();
      expect(res.body.data.activities.length).toBeGreaterThanOrEqual(1);
    });
  });
});
