import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../src/app.js';
import { Company } from '../src/models/Company.js';
import { OutreachContact } from '../src/models/OutreachContact.js';
import { SuppressionList } from '../src/models/SuppressionList.js';
import { LeadQualification } from '../src/models/LeadQualification.js';
import { QualificationQuestion } from '../src/models/QualificationQuestion.js';
import { QualificationActivity } from '../src/models/QualificationActivity.js';
import { leadQualificationService } from '../src/services/qualification/leadQualificationService.js';
import { salesHandoffService } from '../src/services/qualification/salesHandoffService.js';

describe('Phase 3 - Milestone 4: Sales Handoff, Security & Export Integration', () => {
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
    await QualificationQuestion.deleteMany({});
    await QualificationActivity.deleteMany({});
  });

  const setupQualifiedLead = async (options?: {
    isSuppressed?: boolean;
    outreachStatus?: any;
    qualificationScore?: number;
  }) => {
    const company = await Company.create({
      companyName: 'Masood Textile Mills',
      normalizedName: 'masood textile mills',
      domain: 'masoodtextile.com',
      industry: 'Textiles',
      country: 'Pakistan',
      city: 'Faisalabad',
      companySize: 'Enterprise: 1000+ employees',
      aiAnalysis: {
        scoreExplanation: 'Major logistics manifest bottleneck across spinning and weaving mills',
        problems: [
          {
            title: 'Manual Manifest Entry',
            problem: 'Paper manifest entry causes 4-day customs delay',
            category: 'operations',
            severity: 'high',
            confidence: 'high',
          },
        ],
      },
    });

    const contact = await OutreachContact.create({
      companyId: company._id,
      contactName: 'Waqas Ahmad',
      jobTitle: 'VP of Supply Chain Operations',
      email: 'waqas@masoodtextile.com',
      normalizedEmail: 'waqas@masoodtextile.com',
      validationStatus: 'verified',
      outreachStatus: options?.outreachStatus || 'qualified',
      suppressionStatus: { isSuppressed: options?.isSuppressed || false },
    });

    const qualification = await leadQualificationService.startQualification({
      contactId: contact._id.toString(),
      sourceType: 'email',
      allowManual: true,
    });

    qualification.qualificationStatus = 'qualified';
    qualification.qualificationScore = options?.qualificationScore ?? 92;
    qualification.scoreBreakdown = {
      needClarity: 23,
      solutionFit: 24,
      engagement: 18,
      timeline: 12,
      authority: 10,
      budgetReadiness: 5,
    };
    qualification.aiRecommendation = 'potentially_qualified';
    qualification.qualificationSummary = 'Enterprise fit for Cybells manifest OCR with direct VP authority and Q4 budget.';
    qualification.businessChallenges = ['Paper manifest processing', 'Oracle sync lag'];
    qualification.currentSystems = ['Oracle EBS', 'Excel'];
    qualification.existingWorkflows = ['Clerks retype shipping manifests manually from paper'];
    qualification.requiredSolutions = ['OCR pipeline for shipping manifests with direct Oracle sync'];
    qualification.budgetInformation = {
      status: 'disclosed',
      details: 'Approved for modernizing logistics',
      rangeEstimated: '$30,000 - $50,000',
    };
    qualification.purchasingTimeline = {
      status: 'within_3_months',
      details: 'Deploy before Q1 audit',
    };
    qualification.decisionMakingAuthority = {
      status: 'decision_maker',
      details: 'VP has direct sign-off authority',
      stakeholders: ['Waqas Ahmad', 'IT Director'],
    };
    qualification.humanReview = {
      reviewStatus: 'approved_qualified',
      reviewerNotes: 'Verified SQL by sales lead',
      reviewedBy: 'Hafiz (Sales Lead)',
      reviewedAt: new Date(),
      finalDecision: 'Approved as Sales Qualified Lead (SQL)',
      manualScore: 92,
    };

    await qualification.save();

    // Add a question & answer
    await QualificationQuestion.create({
      qualificationId: qualification._id,
      companyId: company._id,
      contactId: contact._id,
      question: 'Do you have direct REST API access to Oracle EBS?',
      category: 'current_systems',
      purpose: 'Technical feasibility',
      questionStatus: 'answered',
      answerText: 'Yes, our IT team maintains an internal REST gateway.',
      answeredAt: new Date(),
    });

    return { company, contact, qualification };
  };

  describe('1. Sales Handoff Package Generation (generateHandoffPackage)', () => {
    it('creates comprehensive standardized handoff package with all profiles, scores, answers, and audit logs', async () => {
      const { qualification, company, contact } = await setupQualifiedLead();

      const pkg = await salesHandoffService.generateHandoffPackage({
        qualificationId: qualification._id.toString(),
        assignedSalesAgent: 'Sarah (Senior AE)',
        actorName: 'Hafiz',
      });

      expect(pkg.handoffId).toMatch(/^HANDOFF-/);
      expect(pkg.assignedSalesAgent).toBe('Sarah (Senior AE)');
      expect(pkg.qualificationScore).toBe(92);
      expect(pkg.scoreBreakdown.needClarity).toBe(23);

      // Company profile verified
      expect(pkg.companyProfile.name).toBe('Masood Textile Mills');
      expect(pkg.companyProfile.industry).toBe('Textiles');
      expect(pkg.companyProfile.aiOpportunitySummary).toContain('logistics manifest bottleneck');

      // Contact profile verified
      expect(pkg.contactProfile.name).toBe('Waqas Ahmad');
      expect(pkg.contactProfile.jobTitle).toBe('VP of Supply Chain Operations');
      expect(pkg.contactProfile.authorityStatus).toBe('decision_maker');

      // Dossier verified
      expect(pkg.qualificationDossier.businessChallenges).toContain('Paper manifest processing');
      expect(pkg.qualificationDossier.currentSystems).toContain('Oracle EBS');
      expect(pkg.qualificationDossier.budgetInformation.rangeEstimated).toBe('$30,000 - $50,000');

      // Questions & Answers included
      expect(pkg.questionsAndAnswers.length).toBe(1);
      expect(pkg.questionsAndAnswers[0].answerText).toContain('internal REST gateway');

      // Audit activity logged
      const activity = await QualificationActivity.findOne({
        qualificationId: qualification._id,
        activityType: 'lead_handed_off',
      });
      expect(activity).not.toBeNull();
      expect(activity?.metadata?.assignedSalesAgent).toBe('Sarah (Senior AE)');
    });

    it('refuses handoff if contact is unsubscribed or suppressed', async () => {
      const { qualification, contact } = await setupQualifiedLead();

      // Prospect unsubs after qualification
      contact.outreachStatus = 'unsubscribed';
      await contact.save();

      await expect(
        salesHandoffService.generateHandoffPackage({
          qualificationId: qualification._id.toString(),
        })
      ).rejects.toThrow(/Cannot hand off lead: Contact .* is suppressed or unsubscribed/i);
    });

    it('refuses handoff if contact is globally suppressed', async () => {
      const { qualification, contact } = await setupQualifiedLead();

      await SuppressionList.create({
        email: contact.normalizedEmail,
        reason: 'spam_complaint',
        source: 'manual',
      });

      await expect(
        salesHandoffService.generateHandoffPackage({
          qualificationId: qualification._id.toString(),
        })
      ).rejects.toThrow(/globally suppressed/i);
    });
  });

  describe('2. Pipeline Export (CSV & JSON)', () => {
    it('generates properly formatted CSV string with headers and escaped fields', async () => {
      const { qualification } = await setupQualifiedLead();

      const populated = await LeadQualification.find({ _id: qualification._id })
        .populate('companyId', 'companyName industry country city website')
        .populate('contactId', 'contactName jobTitle email')
        .lean();

      const csv = await salesHandoffService.exportQualificationsCsv(populated);

      expect(csv).toContain('Qualification ID,Company Name,Industry');
      expect(csv).toContain('"Masood Textile Mills"');
      expect(csv).toContain('"waqas@masoodtextile.com"');
      expect(csv).toContain('"92"');
    });
  });

  describe('3. REST API Endpoints Integration', () => {
    it('POST /api/qualifications/:id/handoff creates handoff package and records assignment via API', async () => {
      const { qualification } = await setupQualifiedLead();

      const res = await request(app)
        .post(`/api/qualifications/${qualification._id}/handoff`)
        .send({
          assignedSalesAgent: 'Alex AE',
          actorName: 'Operations Lead',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assignedSalesAgent).toBe('Alex AE');
      expect(res.body.data.companyProfile.name).toBe('Masood Textile Mills');
    });

    it('GET /api/qualifications/:id/export returns downloadable JSON dossier', async () => {
      const { qualification } = await setupQualifiedLead();

      const res = await request(app).get(`/api/qualifications/${qualification._id}/export`);

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('application/json');
      expect(res.body.qualificationId).toBe(qualification._id.toString());
      expect(res.body.qualificationScore).toBe(92);
    });

    it('GET /api/qualifications/export/csv returns downloadable CSV stream', async () => {
      await setupQualifiedLead();

      const res = await request(app).get('/api/qualifications/export/csv');

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toContain('text/csv');
      expect(res.text).toContain('Qualification ID,Company Name,Industry');
      expect(res.text).toContain('Masood Textile Mills');
    });
  });
});
