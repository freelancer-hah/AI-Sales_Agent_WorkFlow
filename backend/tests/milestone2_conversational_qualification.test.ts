import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../src/app.js';
import { Company } from '../src/models/Company.js';
import { OutreachContact } from '../src/models/OutreachContact.js';
import { SuppressionList } from '../src/models/SuppressionList.js';
import { EmailDraft } from '../src/models/EmailDraft.js';
import { CybellsConfig } from '../src/models/CybellsConfig.js';
import { LeadQualification } from '../src/models/LeadQualification.js';
import { QualificationQuestion } from '../src/models/QualificationQuestion.js';
import { QualificationActivity } from '../src/models/QualificationActivity.js';
import { leadQualificationService } from '../src/services/qualification/leadQualificationService.js';
import { geminiQualificationService } from '../src/services/qualification/geminiQualificationService.js';

class MockGeminiClient {
  public responseQueue: string[] = [];
  public lastPrompt: string = '';

  public queueResponse(json: any) {
    this.responseQueue.push(typeof json === 'string' ? json : JSON.stringify(json));
  }

  public async generateContent(prompt: string): Promise<string> {
    this.lastPrompt = prompt;
    if (this.responseQueue.length > 0) {
      return this.responseQueue.shift()!;
    }
    throw new Error('No mock response queued for Gemini.');
  }

  public clear() {
    this.responseQueue = [];
    this.lastPrompt = '';
  }
}

describe('Phase 3 - Milestone 2: Conversational Qualification & Information Extraction', () => {
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
    await EmailDraft.deleteMany({});
    await CybellsConfig.deleteMany({});
    await LeadQualification.deleteMany({});
    await QualificationQuestion.deleteMany({});
    await QualificationActivity.deleteMany({});

    // Seed Cybells agency profile
    await CybellsConfig.create({
      agencyName: 'Cybells AI Solutions',
      senderName: 'Hafiz from Cybells',
      senderEmail: 'sales@cybells.com',
      capabilities: [
        {
          id: 'doc-ai',
          title: 'Automated Document Extraction & AI Agents',
          category: 'Document Automation',
          description: 'Extracts invoices, manifests, and logistics records directly into ERPs.',
        },
      ],
    });
  });

  const setupTestLead = async (options?: {
    isSuppressed?: boolean;
    outreachStatus?: any;
    qualificationStatus?: any;
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
        summary: 'Multi-unit manufacturing bottlenecks',
        problems: [
          {
            title: 'Manual Manifest Entry',
            problem: 'Manual Manifest Entry',
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
      emailSourceUrl: 'https://masoodtextile.com/team',
      validationStatus: 'verified',
      outreachStatus: options?.outreachStatus || 'interested',
      suppressionStatus: {
        isSuppressed: options?.isSuppressed || false,
        reason: options?.isSuppressed ? 'unsubscribed' : undefined,
      },
    });

    const qualification = await leadQualificationService.startQualification({
      contactId: contact._id.toString(),
      sourceType: 'email',
      allowManual: true,
    });

    if (options?.qualificationStatus) {
      qualification.qualificationStatus = options.qualificationStatus;
      await qualification.save();
    }

    return { company, contact, qualification };
  };

  describe('1. AI Information Extraction (extractInformationFromMessage)', () => {
    it('extracts structured B2B facts, systems, timeline, and authority from inbound reply', async () => {
      const { qualification } = await setupTestLead();

      const mockExtractionPayload = {
        businessChallenges: ['Manual manifest verification', 'Excel errors in yard management'],
        currentSystems: ['Oracle ERP', 'Excel spreadsheets', 'WhatsApp for yard dispatch'],
        existingWorkflows: ['Clerks retype shipping manifests manually from paper'],
        requiredSolutions: ['OCR pipeline for shipping manifests with direct Oracle sync'],
        businessPriorities: ['Cut turnaround time by 50%', 'Zero data entry errors'],
        budgetInformation: {
          status: 'disclosed',
          details: 'Budget approved for Q4 operational modernization',
          rangeEstimated: '$25,000 - $40,000',
        },
        purchasingTimeline: {
          status: 'within_3_months',
          details: 'Targeting rollout before Q1 audit',
        },
        decisionMakingAuthority: {
          status: 'decision_maker',
          details: 'VP of Supply Chain has sign-off authority',
          stakeholders: ['Waqas Ahmad', 'IT Director'],
        },
        interestLevel: 'high',
        missingInformation: ['Specific Oracle version and API availability'],
        conversationSummary: 'Prospect confirmed high interest in manifest automation for Oracle ERP with Q4 budget.',
        nextRecommendedAction: 'Inquire about Oracle API connectivity and schedule discovery.',
        evidence: ['We are looking to implement this within 3 months, budget is approved.'],
      };

      mockAi.queueResponse(mockExtractionPayload);

      const inboundReply = `Hi Hafiz, thanks for following up. We are currently using Oracle ERP and heavy Excel spreadsheets, but our team struggles with manual manifest verification. We have budget approved for Q4 ($25k-$40k) and need to roll out within 3 months. I have the sign-off authority.`;

      const result = await geminiQualificationService.extractInformationFromMessage({
        qualificationId: qualification._id.toString(),
        messageText: inboundReply,
        sourceChannel: 'email',
        sourceMessageId: 'msg-reply-101',
      });

      expect(result.extracted.businessChallenges).toContain('Manual manifest verification');
      expect(result.extracted.currentSystems).toContain('Oracle ERP');
      expect(result.extracted.purchasingTimeline.status).toBe('within_3_months');
      expect(result.extracted.budgetInformation.rangeEstimated).toBe('$25,000 - $40,000');
      expect(result.extracted.interestLevel).toBe('high');

      // Verify merged into LeadQualification in DB
      const updatedQual = await LeadQualification.findById(qualification._id);
      expect(updatedQual).not.toBeNull();
      expect(updatedQual?.businessChallenges).toContain('Manual manifest verification');
      expect(updatedQual?.currentSystems).toContain('Oracle ERP');
      expect(updatedQual?.purchasingTimeline.status).toBe('within_3_months');
      expect(updatedQual?.budgetInformation.status).toBe('disclosed');
      expect(updatedQual?.interestLevel).toBe('high');
      expect(updatedQual?.qualificationStatus).toBe('in_progress');

      // Verify QualificationActivity audit log created
      const activity = await QualificationActivity.findOne({
        qualificationId: qualification._id,
        activityType: 'information_extracted',
      });
      expect(activity).not.toBeNull();
      expect(activity?.actor).toBe('ai');
      expect(activity?.metadata?.interestLevel).toBe('high');
    });

    it('cleanly handles JSON wrapped in markdown code fences from LLM', async () => {
      const { qualification } = await setupTestLead();

      const fencedJson = `\`\`\`json
{
  "businessChallenges": ["Legacy AS400 sync issues"],
  "currentSystems": ["IBM AS400"],
  "existingWorkflows": [],
  "requiredSolutions": ["AI Bridge to modern database"],
  "businessPriorities": ["System modernization"],
  "budgetInformation": { "status": "not_discussed", "details": "" },
  "purchasingTimeline": { "status": "within_6_months", "details": "Next fiscal year" },
  "decisionMakingAuthority": { "status": "influencer", "details": "Will present to Board" },
  "interestLevel": "medium",
  "missingInformation": ["Budget allocations"],
  "conversationSummary": "Prospect interested in AS400 modernization.",
  "nextRecommendedAction": "Ask about AS400 export formats.",
  "evidence": ["We are running on an old AS400"]
}
\`\`\``;

      mockAi.queueResponse(fencedJson);

      const result = await geminiQualificationService.extractInformationFromMessage({
        qualificationId: qualification._id.toString(),
        messageText: 'We are running on an old AS400 and need an AI bridge.',
      });

      expect(result.extracted.currentSystems).toContain('IBM AS400');
      expect(result.extracted.interestLevel).toBe('medium');
    });
  });

  describe('2. Conversational Question Generation (generateNextQualificationQuestion)', () => {
    it('generates a single consultative, contextual qualification question and saves record', async () => {
      const { qualification } = await setupTestLead();

      const mockQuestion = {
        question: 'Which version of Oracle ERP does your logistics unit currently run, and do you have direct REST API access enabled?',
        category: 'current_systems',
        purpose: 'Verify system compatibility for automated OCR data ingestion.',
        priority: 'high',
      };

      mockAi.queueResponse(mockQuestion);

      const questionRecord = await geminiQualificationService.generateNextQualificationQuestion({
        qualificationId: qualification._id.toString(),
        focusCategory: 'current_systems',
      });

      expect(questionRecord.question).toBe(mockQuestion.question);
      expect(questionRecord.category).toBe('current_systems');
      expect(questionRecord.questionStatus).toBe('draft');
      expect(questionRecord.priority).toBe('high');
      expect(questionRecord.generatedBy).toBe('ai');

      // Verify saved in DB
      const dbQuestion = await QualificationQuestion.findById(questionRecord._id);
      expect(dbQuestion).not.toBeNull();
      expect(dbQuestion?.question).toBe(mockQuestion.question);

      // Verify activity logged
      const activity = await QualificationActivity.findOne({
        qualificationId: qualification._id,
        activityType: 'question_generated',
      });
      expect(activity).not.toBeNull();
      expect(activity?.metadata?.category).toBe('current_systems');
    });

    it('strictly prevents duplicate questions if an identical question was already asked', async () => {
      const { qualification } = await setupTestLead();

      // Create existing question
      const existingQuestionText = 'Do you currently use an ERP or spreadsheets for inventory?';
      await QualificationQuestion.create({
        qualificationId: qualification._id,
        companyId: qualification.companyId,
        contactId: qualification.contactId,
        question: existingQuestionText,
        category: 'current_systems',
        purpose: 'Understand baseline tech',
        priority: 'medium',
        questionStatus: 'sent',
      });

      // Mock AI trying to ask the duplicate question
      mockAi.queueResponse({
        question: existingQuestionText,
        category: 'current_systems',
        purpose: 'Duplicate check',
        priority: 'medium',
      });

      await expect(
        geminiQualificationService.generateNextQualificationQuestion({
          qualificationId: qualification._id.toString(),
        })
      ).rejects.toThrow(/Duplicate qualification question/i);
    });
  });

  describe('3. Human-in-the-Loop Email Draft Generation (generateQualificationResponseDraft)', () => {
    it('crafts a consultative B2B response draft grounded in Cybells and stores draft for human approval', async () => {
      const { qualification } = await setupTestLead();

      // Create a draft question first
      const questionRecord = await QualificationQuestion.create({
        qualificationId: qualification._id,
        companyId: qualification.companyId,
        contactId: qualification.contactId,
        question: 'Could you share how your team currently validates incoming bills of lading from suppliers?',
        category: 'business_challenges',
        purpose: 'Map document flow',
        priority: 'high',
        questionStatus: 'draft',
      });

      mockAi.queueResponse({
        subject: 'Re: Quick question regarding Masood Textile Mills',
        bodyText: 'Hi Waqas,\n\nThank you for explaining your supply chain setup. Cybells specializes in automated document pipelines that feed directly into enterprise systems.\n\nCould you share how your team currently validates incoming bills of lading from suppliers?\n\nBest regards,\nHafiz from Cybells',
        bodyHtml: '<p>Hi Waqas,</p><p>Thank you for explaining your supply chain setup. Cybells specializes in automated document pipelines that feed directly into enterprise systems.</p><p>Could you share how your team currently validates incoming bills of lading from suppliers?</p><p>Best regards,<br/>Hafiz from Cybells</p>',
        questionIncluded: questionRecord.question,
        category: 'business_challenges',
      });

      const result = await geminiQualificationService.generateQualificationResponseDraft({
        qualificationId: qualification._id.toString(),
        questionId: questionRecord._id.toString(),
        inReplyToSubject: 'Quick question regarding Masood Textile Mills',
      });

      expect(result.draft.subject).toContain('Re: Quick question');
      expect(result.draft.bodyText).toContain(questionRecord.question);

      // Verify EmailDraft record is created with approvalStatus: 'draft' (NEVER auto-dispatched)
      expect(result.emailDraftRecord.approvalStatus).toBe('draft');
      expect(result.emailDraftRecord.sequenceStep).toBe(90);

      // Verify question status transitioned to pending_approval
      const updatedQuestion = await QualificationQuestion.findById(questionRecord._id);
      expect(updatedQuestion?.questionStatus).toBe('pending_approval');
    });
  });

  describe('4. Stop Conditions & Opt-Out Enforcement', () => {
    it('refuses information extraction if prospect is marked unsubscribed', async () => {
      const { qualification, contact } = await setupTestLead();

      // Mark contact as unsubscribed
      contact.outreachStatus = 'unsubscribed';
      await contact.save();

      await expect(
        geminiQualificationService.extractInformationFromMessage({
          qualificationId: qualification._id.toString(),
          messageText: 'Please remove me from your list.',
        })
      ).rejects.toThrow(/Contact .* is suppressed or unsubscribed/i);
    });

    it('refuses question generation if contact is globally suppressed', async () => {
      const { qualification, contact } = await setupTestLead();

      await SuppressionList.create({
        email: contact.normalizedEmail,
        reason: 'spam_complaint',
        source: 'manual',
      });

      await expect(
        geminiQualificationService.generateNextQualificationQuestion({
          qualificationId: qualification._id.toString(),
        })
      ).rejects.toThrow(/globally suppressed/i);
    });

    it('refuses draft generation if qualification is already disqualified', async () => {
      const { qualification } = await setupTestLead({
        qualificationStatus: 'disqualified',
      });

      const questionRecord = await QualificationQuestion.create({
        qualificationId: qualification._id,
        companyId: qualification.companyId,
        contactId: qualification.contactId,
        question: 'Any timeline?',
        category: 'budget_timeline',
        purpose: 'Test',
      });

      await expect(
        geminiQualificationService.generateQualificationResponseDraft({
          qualificationId: qualification._id.toString(),
          questionId: questionRecord._id.toString(),
        })
      ).rejects.toThrow(/Qualification is in "disqualified" status/i);
    });
  });

  describe('5. REST API Endpoints Integration', () => {
    it('POST /api/qualifications/:id/extract triggers extraction and returns updated record', async () => {
      const { qualification } = await setupTestLead();

      mockAi.queueResponse({
        businessChallenges: ['Manual manifest OCR backlog'],
        currentSystems: ['SAP Business One'],
        existingWorkflows: [],
        requiredSolutions: ['Invoice parser'],
        businessPriorities: ['Accuracy'],
        budgetInformation: { status: 'not_discussed', details: '' },
        purchasingTimeline: { status: 'within_1_month', details: 'Immediate' },
        decisionMakingAuthority: { status: 'decision_maker', details: 'Direct buyer' },
        interestLevel: 'high',
        missingInformation: [],
        conversationSummary: 'Urgent SAP parser needed',
        nextRecommendedAction: 'Send technical specs',
        evidence: ['We need this within 1 month'],
      });

      const res = await request(app)
        .post(`/api/qualifications/${qualification._id}/extract`)
        .send({
          messageText: 'We need an invoice parser for SAP Business One within 1 month.',
          sourceChannel: 'email',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.extracted.currentSystems).toContain('SAP Business One');
      expect(res.body.data.qualification.interestLevel).toBe('high');
    });

    it('POST /api/qualifications/:id/generate-question creates draft question via API', async () => {
      const { qualification } = await setupTestLead();

      mockAi.queueResponse({
        question: 'What is your current monthly document volume for supplier shipping manifests?',
        category: 'business_challenges',
        purpose: 'Estimate automation scale',
        priority: 'high',
      });

      const res = await request(app)
        .post(`/api/qualifications/${qualification._id}/generate-question`)
        .send({
          focusCategory: 'business_challenges',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.question).toContain('monthly document volume');
      expect(res.body.data.questionStatus).toBe('draft');
    });

    it('POST /api/qualifications/:id/generate-draft creates pending-approval email draft via API', async () => {
      const { qualification } = await setupTestLead();

      const questionRecord = await QualificationQuestion.create({
        qualificationId: qualification._id,
        companyId: qualification.companyId,
        contactId: qualification.contactId,
        question: 'How many facilities need to access the manifest portal?',
        category: 'current_systems',
        purpose: 'Scope licenses',
        priority: 'medium',
        questionStatus: 'draft',
      });

      mockAi.queueResponse({
        subject: 'Re: Facilities access requirements',
        bodyText: 'Hi Waqas,\n\nHow many facilities need to access the manifest portal?\n\nBest regards,\nHafiz',
        bodyHtml: '<p>Hi Waqas,</p><p>How many facilities need to access the manifest portal?</p>',
        questionIncluded: questionRecord.question,
        category: 'current_systems',
      });

      const res = await request(app)
        .post(`/api/qualifications/${qualification._id}/generate-draft`)
        .send({
          questionId: questionRecord._id.toString(),
          inReplyToSubject: 'Facilities discussion',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.emailDraftRecord.approvalStatus).toBe('draft');
    });

    it('GET /api/qualifications/:id/questions and PATCH /api/qualifications/:id/questions/:questionId manage lifecycle', async () => {
      const { qualification } = await setupTestLead();

      const q1 = await QualificationQuestion.create({
        qualificationId: qualification._id,
        companyId: qualification.companyId,
        contactId: qualification.contactId,
        question: 'What is your primary ERP?',
        category: 'current_systems',
        purpose: 'ERP check',
        questionStatus: 'draft',
      });

      // 1. GET questions list
      const getRes = await request(app).get(`/api/qualifications/${qualification._id}/questions`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.total).toBe(1);
      expect(getRes.body.data.questions[0].question).toBe('What is your primary ERP?');

      // 2. PATCH question answer/status
      const patchRes = await request(app)
        .patch(`/api/qualifications/${qualification._id}/questions/${q1._id}`)
        .send({
          answerText: 'We run Oracle Fusion Cloud v23.',
          questionStatus: 'answered',
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.questionStatus).toBe('answered');
      expect(patchRes.body.data.answerText).toBe('We run Oracle Fusion Cloud v23.');

      // Verify activity was logged
      const activity = await QualificationActivity.findOne({
        qualificationId: qualification._id,
        activityType: 'reply_received',
      });
      expect(activity).not.toBeNull();
    });
  });

  describe('6. Resilience & Safe Error Handling', () => {
    it('fails safely and preserves state when AI returns unparseable garbage', async () => {
      const { qualification } = await setupTestLead();

      mockAi.queueResponse('THIS IS NOT VALID JSON AT ALL >>> ERROR <<<');

      await expect(
        geminiQualificationService.extractInformationFromMessage({
          qualificationId: qualification._id.toString(),
          messageText: 'Hello',
        })
      ).rejects.toThrow(/Gemini returned invalid extraction format/i);

      // Verify qualification state was preserved without corruptions
      const reloadedQual = await LeadQualification.findById(qualification._id);
      expect(reloadedQual?.qualificationStatus).toBe('in_progress');
      expect(reloadedQual?.businessChallenges).toEqual(qualification.businessChallenges);
    });
  });
});
