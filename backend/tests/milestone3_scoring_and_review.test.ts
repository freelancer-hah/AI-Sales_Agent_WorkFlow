import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../src/app.js';
import { Company } from '../src/models/Company.js';
import { OutreachContact } from '../src/models/OutreachContact.js';
import { SuppressionList } from '../src/models/SuppressionList.js';
import { CybellsConfig } from '../src/models/CybellsConfig.js';
import { LeadQualification } from '../src/models/LeadQualification.js';
import { QualificationQuestion } from '../src/models/QualificationQuestion.js';
import { QualificationActivity } from '../src/models/QualificationActivity.js';
import { leadQualificationService } from '../src/services/qualification/leadQualificationService.js';
import { geminiQualificationService } from '../src/services/qualification/geminiQualificationService.js';

class MockGeminiClient {
  public responseQueue: string[] = [];

  public queueResponse(json: any) {
    this.responseQueue.push(typeof json === 'string' ? json : JSON.stringify(json));
  }

  public async generateContent(): Promise<string> {
    if (this.responseQueue.length > 0) {
      return this.responseQueue.shift()!;
    }
    throw new Error('No mock response queued for Gemini.');
  }

  public clear() {
    this.responseQueue = [];
  }
}

describe('Phase 3 - Milestone 3: AI Lead Scoring, Qualification Decisions & Human Review', () => {
  let mongoServer: MongoMemoryServer;
  const mockAi = new MockGeminiClient();

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    geminiQualificationService.setMockClient(mockAi);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    mockAi.clear();
    await Company.deleteMany({});
    await OutreachContact.deleteMany({});
    await SuppressionList.deleteMany({});
    await CybellsConfig.deleteMany({});
    await LeadQualification.deleteMany({});
    await QualificationQuestion.deleteMany({});
    await QualificationActivity.deleteMany({});

    await CybellsConfig.create({
      agencyName: 'Cybells AI Solutions',
      senderName: 'Hafiz from Cybells',
      senderEmail: 'sales@cybells.com',
      capabilities: [
        {
          id: 'manifest-ai',
          title: 'Automated Manifest & Logistics OCR Extraction',
          category: 'Document Automation',
          description: 'Extracts invoices, manifests, and logistics records directly into ERPs.',
        },
      ],
    });
  });

  const setupTestLead = async (options?: {
    problems?: string[];
    challenges?: string[];
    systems?: string[];
    timelineStatus?: any;
    budgetStatus?: any;
    authorityStatus?: any;
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
        summary: 'High volume textile operations with manual logistics tracking',
        problems: [
          {
            title: 'Manual Manifest Entry',
            problem: 'Manual Manifest Entry across 3 warehouses',
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
      emailSourceUrl: 'https://masoodtextile.com/leadership',
      validationStatus: 'verified',
      outreachStatus: 'qualifying',
      suppressionStatus: { isSuppressed: false },
    });

    const qualification = await leadQualificationService.startQualification({
      contactId: contact._id.toString(),
      sourceType: 'email',
      allowManual: true,
    });

    if (options?.challenges) qualification.businessChallenges = options.challenges;
    if (options?.systems) qualification.currentSystems = options.systems;
    if (options?.timelineStatus) qualification.purchasingTimeline.status = options.timelineStatus;
    if (options?.budgetStatus) qualification.budgetInformation.status = options.budgetStatus;
    if (options?.authorityStatus) qualification.decisionMakingAuthority.status = options.authorityStatus;

    await qualification.save();

    return { company, contact, qualification };
  };

  describe('1. Multidimensional Qualification Scoring (evaluateAndScoreQualification)', () => {
    it('computes multidimensional score, generates evidence summary, and auto-promotes to ready_for_review when score >= 70', async () => {
      const { qualification } = await setupTestLead({
        challenges: ['Manual entry of 500+ daily shipping manifests', 'Oracle synchronization delay'],
        systems: ['Oracle EBS', 'Excel spreadsheets'],
        timelineStatus: 'within_3_months',
        budgetStatus: 'disclosed',
        authorityStatus: 'decision_maker',
      });

      mockAi.queueResponse({
        scoreBreakdown: {
          needClarity: 23,
          solutionFit: 24,
          engagement: 18,
          timeline: 12,
          authority: 10,
          budgetReadiness: 5,
        },
        qualificationScore: 92,
        aiRecommendation: 'potentially_qualified',
        qualificationSummary: 'Masood Textile Mills exhibits a strong operational need for Cybells manifest extraction with 500+ daily volume, approved budget, and direct VP sign-off.',
        keyStrengths: ['Direct decision maker sign-off', 'High document volume bottleneck', 'Approved Q4 budget'],
        keyRisks: ['Requires Oracle EBS connector testing'],
        nextRecommendedAction: 'Submit for human sales approval and schedule technical architecture session.',
      });

      const { scoringResult, qualification: updatedQual } =
        await geminiQualificationService.evaluateAndScoreQualification(qualification._id.toString());

      expect(scoringResult.qualificationScore).toBe(92);
      expect(scoringResult.scoreBreakdown.needClarity).toBe(23);
      expect(scoringResult.scoreBreakdown.solutionFit).toBe(24);
      expect(scoringResult.aiRecommendation).toBe('potentially_qualified');
      expect(scoringResult.keyStrengths).toContain('Approved Q4 budget');

      // Verify DB record updated
      const reloaded = await LeadQualification.findById(qualification._id);
      expect(reloaded?.qualificationScore).toBe(92);
      expect(reloaded?.scoreBreakdown.needClarity).toBe(23);
      expect(reloaded?.aiRecommendation).toBe('potentially_qualified');

      // Auto-promoted to ready_for_review because score >= 70
      expect(reloaded?.qualificationStatus).toBe('ready_for_review');

      // Verify QualificationActivity audit log created
      const activity = await QualificationActivity.findOne({
        qualificationId: qualification._id,
        activityType: 'score_generated',
      });
      expect(activity).not.toBeNull();
      expect(activity?.metadata?.qualificationScore).toBe(92);
    });

    it('bounds score to maximum allowed ranges and correctly sets needs_more_info if score is between 40 and 69', async () => {
      const { qualification } = await setupTestLead();

      // Return partial numbers needing bounding
      mockAi.queueResponse({
        scoreBreakdown: {
          needClarity: 12,
          solutionFit: 15,
          engagement: 10,
          timeline: 6,
          authority: 5,
          budgetReadiness: 2,
        },
        qualificationScore: 50,
        aiRecommendation: 'needs_more_info',
        qualificationSummary: 'Early stage interest; tech stack and budget details remain incomplete.',
        keyStrengths: ['Acknowledged operational interest'],
        keyRisks: ['Budget unconfirmed', 'Timeline vague'],
        nextRecommendedAction: 'Inquire about ERP systems in use.',
      });

      const { scoringResult, qualification: updatedQual } =
        await geminiQualificationService.evaluateAndScoreQualification(qualification._id.toString());

      expect(scoringResult.qualificationScore).toBe(50);
      expect(scoringResult.aiRecommendation).toBe('needs_more_info');

      // Status should remain in_progress (NOT auto-promoted to ready_for_review because < 70)
      expect(updatedQual.qualificationStatus).toBe('in_progress');
    });
  });

  describe('2. Human Review & Decision Workflows (submitHumanReview)', () => {
    it('approves lead as qualified (SQL) and cascades status to Company and Contact records', async () => {
      const { company, contact, qualification } = await setupTestLead();

      const reviewedQual = await leadQualificationService.submitHumanReview({
        qualificationId: qualification._id.toString(),
        decision: 'approved_qualified',
        reviewerNotes: 'Strong enterprise fit. Ready for discovery demo.',
        reviewerName: 'Hafiz (Sales Lead)',
        manualScore: 95,
        approvedFields: ['businessChallenges', 'currentSystems', 'budgetInformation'],
      });

      expect(reviewedQual.qualificationStatus).toBe('qualified');
      expect(reviewedQual.qualificationScore).toBe(95);
      expect(reviewedQual.humanReview.reviewStatus).toBe('approved_qualified');
      expect(reviewedQual.humanReview.reviewedBy).toBe('Hafiz (Sales Lead)');
      expect(reviewedQual.humanReview.finalDecision).toBe('Approved as Sales Qualified Lead (SQL)');

      // Verify Company and Contact status cascaded to 'qualified'
      const updatedCompany = await Company.findById(company._id);
      expect(updatedCompany?.leadStatus).toBe('qualified');

      const updatedContact = await OutreachContact.findById(contact._id);
      expect(updatedContact?.outreachStatus).toBe('qualified');

      // Verify Activity log
      const activity = await QualificationActivity.findOne({
        qualificationId: qualification._id,
        activityType: 'human_review_completed',
      });
      expect(activity).not.toBeNull();
      expect(activity?.actor).toBe('human');
    });

    it('disqualifies lead with audit reason and cascades status to Company and Contact', async () => {
      const { company, contact, qualification } = await setupTestLead();

      const reviewedQual = await leadQualificationService.submitHumanReview({
        qualificationId: qualification._id.toString(),
        decision: 'disqualified',
        reviewerNotes: 'Company uses custom in-house software with no API capabilities.',
        reviewerName: 'Sales Director',
        disqualificationReason: 'Incompatible legacy architecture',
      });

      expect(reviewedQual.qualificationStatus).toBe('disqualified');
      expect(reviewedQual.disqualificationReason).toBe('Incompatible legacy architecture');

      // Cascades to Company and Contact
      const updatedCompany = await Company.findById(company._id);
      expect(updatedCompany?.leadStatus).toBe('disqualified');

      const updatedContact = await OutreachContact.findById(contact._id);
      expect(updatedContact?.outreachStatus).toBe('disqualified');
    });

    it('marks lead as more_info_needed and resets status to awaiting_information', async () => {
      const { qualification } = await setupTestLead();

      const reviewedQual = await leadQualificationService.submitHumanReview({
        qualificationId: qualification._id.toString(),
        decision: 'more_info_needed',
        reviewerNotes: 'Need confirmation on daily document volume before scheduling demo.',
        reviewerName: 'Hafiz',
      });

      expect(reviewedQual.qualificationStatus).toBe('awaiting_information');
      expect(reviewedQual.humanReview.reviewStatus).toBe('more_info_needed');
    });
  });

  describe('3. REST API Endpoints Integration', () => {
    it('POST /api/qualifications/:id/score evaluates qualification via API', async () => {
      const { qualification } = await setupTestLead();

      mockAi.queueResponse({
        scoreBreakdown: {
          needClarity: 20,
          solutionFit: 20,
          engagement: 16,
          timeline: 10,
          authority: 8,
          budgetReadiness: 4,
        },
        qualificationScore: 78,
        aiRecommendation: 'potentially_qualified',
        qualificationSummary: 'Promising enterprise candidate with clear logistics workflow.',
        keyStrengths: ['Clear workflow'],
        keyRisks: ['Timeline'],
        nextRecommendedAction: 'Assign to AE',
      });

      const res = await request(app).post(`/api/qualifications/${qualification._id}/score`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.scoringResult.qualificationScore).toBe(78);
      expect(res.body.data.qualification.qualificationStatus).toBe('ready_for_review');
    });

    it('POST /api/qualifications/:id/review submits human review via API', async () => {
      const { qualification } = await setupTestLead();

      const res = await request(app)
        .post(`/api/qualifications/${qualification._id}/review`)
        .send({
          decision: 'approved_qualified',
          reviewerNotes: 'Enterprise approved by team.',
          reviewerName: 'Waqas AE',
          manualScore: 88,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.qualificationStatus).toBe('qualified');
      expect(res.body.data.qualificationScore).toBe(88);
      expect(res.body.data.humanReview.reviewedBy).toBe('Waqas AE');
    });
  });
});

