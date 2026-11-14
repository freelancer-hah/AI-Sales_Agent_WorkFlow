import { Types } from 'mongoose';
import { LeadQualification, ILeadQualificationDocument, IScoreBreakdown } from '../../models/LeadQualification.js';
import { Company, ICompanyDocument } from '../../models/Company.js';
import { OutreachContact, IOutreachContactDocument } from '../../models/OutreachContact.js';
import { QualificationQuestion } from '../../models/QualificationQuestion.js';
import { QualificationActivity } from '../../models/QualificationActivity.js';
import { SuppressionList } from '../../models/SuppressionList.js';
import { logger } from '../../config/logger.js';

export interface ISalesHandoffPackage {
  handoffId: string;
  qualificationId: string;
  handedOffAt: Date;
  assignedSalesAgent: string;
  qualificationStatus: string;
  qualificationScore: number;
  scoreBreakdown: IScoreBreakdown;
  aiRecommendation: string;
  qualificationSummary: string;
  nextRecommendedAction: string;
  companyProfile: {
    id: string;
    name: string;
    industry: string;
    size: string;
    country: string;
    city: string;
    website: string;
    aiOpportunitySummary?: string;
    problemsDiscovered?: string[];
  };
  contactProfile: {
    id: string;
    name: string;
    jobTitle: string;
    email: string;
    validationStatus: string;
    outreachStatus: string;
    authorityStatus: string;
    stakeholders?: string[];
  };
  qualificationDossier: {
    businessChallenges: string[];
    currentSystems: string[];
    existingWorkflows: string[];
    requiredSolutions: string[];
    businessPriorities: string[];
    budgetInformation: {
      status: string;
      details: string;
      rangeEstimated?: string;
    };
    purchasingTimeline: {
      status: string;
      details: string;
    };
    decisionMakingAuthority: {
      status: string;
      details: string;
      stakeholders?: string[];
    };
    missingInformation: string[];
  };
  humanReviewRecord: {
    reviewStatus: string;
    reviewedBy?: string;
    reviewedAt?: Date;
    reviewerNotes?: string;
    finalDecision?: string;
    manualScore?: number;
  };
  questionsAndAnswers: Array<{
    question: string;
    category: string;
    answerText?: string;
    status: string;
    answeredAt?: Date;
  }>;
  activityAuditHistory: Array<{
    activityType: string;
    title: string;
    description: string;
    actor: string;
    timestamp: Date;
  }>;
}

export class SalesHandoffService {
  /**
   * Generates a complete, structured Sales Handoff Package for an AE or CRM integration.
   * Enforces security, suppression, and opt-out guards.
   */
  public async generateHandoffPackage(params: {
    qualificationId: string;
    assignedSalesAgent?: string;
    actorName?: string;
  }): Promise<ISalesHandoffPackage> {
    const { qualificationId, assignedSalesAgent = 'Account Executive', actorName = 'Sales Operations' } = params;

    if (!Types.ObjectId.isValid(qualificationId)) {
      throw new Error(`Invalid qualification ID format: ${qualificationId}`);
    }

    const qualification = await LeadQualification.findById(qualificationId);
    if (!qualification) {
      throw new Error(`Lead qualification ${qualificationId} not found.`);
    }

    // Safety and suppression checks
    const contact = await OutreachContact.findById(qualification.contactId);
    if (!contact) {
      throw new Error('Contact record associated with qualification not found.');
    }

    if (contact.suppressionStatus?.isSuppressed || contact.outreachStatus === 'suppressed' || contact.outreachStatus === 'unsubscribed') {
      throw new Error(`Cannot hand off lead: Contact ${contact.email} is suppressed or unsubscribed.`);
    }

    const isGloballySuppressed = await SuppressionList.findOne({
      email: contact.normalizedEmail || contact.email.toLowerCase().trim(),
    }).lean();

    if (isGloballySuppressed) {
      throw new Error(`Cannot hand off lead: Contact ${contact.email} is globally suppressed.`);
    }

    const company = await Company.findById(qualification.companyId);
    if (!company) {
      throw new Error('Company record associated with qualification not found.');
    }

    // Fetch questions and activities
    const [questions, activities] = await Promise.all([
      QualificationQuestion.find({ qualificationId: qualification._id }).sort({ createdAt: 1 }).lean(),
      QualificationActivity.find({ qualificationId: qualification._id }).sort({ createdAt: 1 }).limit(100).lean(),
    ]);

    // Update assignment
    qualification.assignedTo = assignedSalesAgent;
    qualification.lastInteractionAt = new Date();
    await qualification.save();

    const handoffId = `HANDOFF-${qualification._id.toString().slice(-6).toUpperCase()}-${Date.now().toString().slice(-4)}`;

    const handoffPackage: ISalesHandoffPackage = {
      handoffId,
      qualificationId: qualification._id.toString(),
      handedOffAt: new Date(),
      assignedSalesAgent,
      qualificationStatus: qualification.qualificationStatus,
      qualificationScore: qualification.qualificationScore,
      scoreBreakdown: qualification.scoreBreakdown,
      aiRecommendation: qualification.aiRecommendation,
      qualificationSummary: qualification.qualificationSummary,
      nextRecommendedAction: qualification.qualificationScore >= 70
        ? 'Schedule 30-minute discovery & solution architecture demonstration.'
        : 'Conduct brief qualification follow-up regarding integration requirements.',
      companyProfile: {
        id: company._id.toString(),
        name: company.companyName,
        industry: company.industry || 'Enterprise',
        size: company.companySize || 'Unknown',
        country: company.country || '',
        city: company.city || '',
        website: company.website || '',
        aiOpportunitySummary: company.aiAnalysis?.scoreExplanation || '',
        problemsDiscovered: (company.aiAnalysis?.problems || []).map((p: any) => p.problem || p.title),
      },
      contactProfile: {
        id: contact._id.toString(),
        name: contact.contactName,
        jobTitle: contact.jobTitle,
        email: contact.email,
        validationStatus: contact.validationStatus,
        outreachStatus: contact.outreachStatus,
        authorityStatus: qualification.decisionMakingAuthority?.status || 'unknown',
        stakeholders: qualification.decisionMakingAuthority?.stakeholders || [],
      },
      qualificationDossier: {
        businessChallenges: qualification.businessChallenges || [],
        currentSystems: qualification.currentSystems || [],
        existingWorkflows: qualification.existingWorkflows || [],
        requiredSolutions: qualification.requiredSolutions || [],
        businessPriorities: qualification.businessPriorities || [],
        budgetInformation: {
          status: qualification.budgetInformation?.status || 'not_discussed',
          details: qualification.budgetInformation?.details || '',
          rangeEstimated: qualification.budgetInformation?.rangeEstimated,
        },
        purchasingTimeline: {
          status: qualification.purchasingTimeline?.status || 'unknown',
          details: qualification.purchasingTimeline?.details || '',
        },
        decisionMakingAuthority: {
          status: qualification.decisionMakingAuthority?.status || 'unknown',
          details: qualification.decisionMakingAuthority?.details || '',
          stakeholders: qualification.decisionMakingAuthority?.stakeholders || [],
        },
        missingInformation: qualification.missingInformation || [],
      },
      humanReviewRecord: {
        reviewStatus: qualification.humanReview?.reviewStatus || 'pending',
        reviewedBy: qualification.humanReview?.reviewedBy,
        reviewedAt: qualification.humanReview?.reviewedAt,
        reviewerNotes: qualification.humanReview?.reviewerNotes,
        finalDecision: qualification.humanReview?.finalDecision,
        manualScore: qualification.humanReview?.manualScore,
      },
      questionsAndAnswers: questions.map((q) => ({
        question: q.question,
        category: q.category,
        answerText: q.answerText,
        status: q.questionStatus,
        answeredAt: q.answeredAt,
      })),
      activityAuditHistory: activities.map((a) => ({
        activityType: a.activityType,
        title: a.title,
        description: a.description,
        actor: a.actor,
        timestamp: a.createdAt || new Date(),
      })),
    };

    // Log handoff activity
    await QualificationActivity.create({
      qualificationId: qualification._id,
      companyId: qualification.companyId,
      contactId: qualification.contactId,
      activityType: 'lead_handed_off',
      title: `Lead Handed Off to Sales: ${assignedSalesAgent}`,
      description: `Sales handoff dossier generated with ID ${handoffId}. Score: ${qualification.qualificationScore}/100.`,
      actor: 'human',
      actorName,
      metadata: {
        handoffId,
        assignedSalesAgent,
        qualificationScore: qualification.qualificationScore,
      },
    });

    logger.info(`Lead qualification ${qualificationId} handed off to ${assignedSalesAgent} (Handoff ID: ${handoffId})`);

    return handoffPackage;
  }

  /**
   * Generates a CSV export string of qualifications.
   */
  public async exportQualificationsCsv(qualifications: any[]): Promise<string> {
    const headers = [
      'Qualification ID',
      'Company Name',
      'Industry',
      'Country',
      'City',
      'Contact Name',
      'Job Title',
      'Email',
      'Status',
      'Total Score',
      'Need Clarity (25)',
      'Solution Fit (25)',
      'Engagement (20)',
      'Timeline (15)',
      'Authority (10)',
      'Budget (5)',
      'AI Recommendation',
      'Assigned To',
      'Summary',
      'Reviewed By',
      'Review Decision',
      'Last Interaction',
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = qualifications.map((q) => {
      const company = q.companyId || {};
      const contact = q.contactId || {};
      const breakdown = q.scoreBreakdown || {};
      const review = q.humanReview || {};

      return [
        escapeCsv(q._id),
        escapeCsv(company.companyName),
        escapeCsv(company.industry),
        escapeCsv(company.country),
        escapeCsv(company.city),
        escapeCsv(contact.contactName),
        escapeCsv(contact.jobTitle),
        escapeCsv(contact.email),
        escapeCsv(q.qualificationStatus),
        escapeCsv(q.qualificationScore),
        escapeCsv(breakdown.needClarity ?? 0),
        escapeCsv(breakdown.solutionFit ?? 0),
        escapeCsv(breakdown.engagement ?? 0),
        escapeCsv(breakdown.timeline ?? 0),
        escapeCsv(breakdown.authority ?? 0),
        escapeCsv(breakdown.budgetReadiness ?? 0),
        escapeCsv(q.aiRecommendation),
        escapeCsv(q.assignedTo || 'Unassigned'),
        escapeCsv(q.qualificationSummary),
        escapeCsv(review.reviewedBy || 'Pending'),
        escapeCsv(review.finalDecision || 'Pending'),
        escapeCsv(q.lastInteractionAt ? new Date(q.lastInteractionAt).toISOString() : ''),
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }
}

export const salesHandoffService = new SalesHandoffService();
