import { Types } from 'mongoose';
import { LeadQualification, ILeadQualification, ILeadQualificationDocument, QualificationStatus } from '../../models/LeadQualification.js';
import { QualificationQuestion } from '../../models/QualificationQuestion.js';
import { QualificationActivity } from '../../models/QualificationActivity.js';
import { OutreachContact, IOutreachContactDocument } from '../../models/OutreachContact.js';
import { Company, ICompanyDocument } from '../../models/Company.js';
import { SuppressionList } from '../../models/SuppressionList.js';
import { EmailReply } from '../../models/EmailReply.js';
import { logger } from '../../config/logger.js';

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
  contact?: IOutreachContactDocument;
  company?: ICompanyDocument;
  existingQualificationId?: string;
}

export interface StartQualificationParams {
  contactId: string;
  companyId?: string;
  campaignId?: string;
  sourceConversationId?: string;
  sourceType?: 'email' | 'website' | 'manual';
  assignedTo?: string;
  actor?: 'ai' | 'human' | 'prospect';
  actorName?: string;
  allowManual?: boolean;
}

export interface ListQualificationsFilter {
  qualificationStatus?: string;
  interestLevel?: string;
  minScore?: number;
  maxScore?: number;
  companyId?: string;
  contactId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class LeadQualificationService {
  /**
   * Evaluates if a prospect/contact is eligible to enter the qualification pipeline.
   * Enforces safety rules: suppression, active duplicates, terminal opt-outs.
   */
  public async checkEligibility(contactId: string, allowManual: boolean = false): Promise<EligibilityResult> {
    if (!Types.ObjectId.isValid(contactId)) {
      return { eligible: false, reason: 'Invalid contactId format.' };
    }

    const contact = await OutreachContact.findById(contactId);
    if (!contact) {
      return { eligible: false, reason: 'Contact record not found.' };
    }

    const company = await Company.findById(contact.companyId);
    if (!company) {
      return { eligible: false, reason: 'Associated company record not found.', contact };
    }

    // 1. Suppression & Opt-Out Checks
    if (contact.suppressionStatus?.isSuppressed || contact.outreachStatus === 'suppressed' || contact.outreachStatus === 'unsubscribed') {
      return {
        eligible: false,
        reason: `Contact ${contact.email} is suppressed or unsubscribed. Automated qualification is strictly prohibited.`,
        contact,
        company,
      };
    }

    const normalizedEmail = contact.normalizedEmail || contact.email.toLowerCase().trim();
    const isGloballySuppressed = await SuppressionList.findOne({ email: normalizedEmail }).lean();
    if (isGloballySuppressed) {
      return {
        eligible: false,
        reason: `Email ${contact.email} is listed in the global suppression registry (${isGloballySuppressed.reason || 'suppressed'}).`,
        contact,
        company,
      };
    }

    // 2. Prevent Duplicate Active Qualification
    const activeQualification = await LeadQualification.findOne({
      contactId: contact._id,
      qualificationStatus: { $in: ['in_progress', 'awaiting_information', 'ready_for_review', 'qualified'] },
    }).lean();

    if (activeQualification) {
      return {
        eligible: false,
        reason: `Active qualification already exists for ${contact.email} (Status: ${activeQualification.qualificationStatus}).`,
        contact,
        company,
        existingQualificationId: activeQualification._id.toString(),
      };
    }

    // 3. Check for previous disqualification
    const disqualifiedRecord = await LeadQualification.findOne({
      contactId: contact._id,
      qualificationStatus: 'disqualified',
    }).sort({ createdAt: -1 }).lean();

    if (disqualifiedRecord && !allowManual) {
      return {
        eligible: false,
        reason: `Contact was previously disqualified (${disqualifiedRecord.disqualificationReason || 'No fit'}). Manual override required.`,
        contact,
        company,
        existingQualificationId: disqualifiedRecord._id.toString(),
      };
    }

    // 4. Validate genuine interest trigger unless manually initiated
    if (!allowManual) {
      const hasHandoffFlag = Boolean(company.handoffToQualification);
      const isInterestedStatus = contact.outreachStatus === 'interested' || contact.outreachStatus === 'replied';

      // Check if positive email reply exists
      const positiveReply = await EmailReply.findOne({
        contactId: contact._id,
        classification: { $in: ['interested', 'meeting_request', 'price_inquiry', 'question'] },
      }).lean();

      if (!hasHandoffFlag && !isInterestedStatus && !positiveReply) {
        return {
          eligible: false,
          reason: 'Prospect has not demonstrated genuine buying interest or inquiry intent yet.',
          contact,
          company,
        };
      }
    }

    return {
      eligible: true,
      contact,
      company,
    };
  }

  /**
   * Initializes and starts a new lead qualification record for an eligible prospect.
   */
  public async startQualification(params: StartQualificationParams): Promise<ILeadQualificationDocument> {
    const {
      contactId,
      sourceConversationId,
      sourceType = 'email',
      assignedTo = '',
      actor = 'ai',
      actorName = 'Cybells Qualification Engine',
      allowManual = false,
    } = params;

    const eligibility = await this.checkEligibility(contactId, allowManual);
    if (!eligibility.eligible || !eligibility.contact || !eligibility.company) {
      throw new Error(eligibility.reason || 'Contact is not eligible for qualification.');
    }

    const contact = eligibility.contact;
    const company = eligibility.company;

    // Detect initial interest level from latest reply if available
    let initialInterestLevel: 'high' | 'medium' | 'low' | 'unknown' = 'medium';
    const latestReply = await EmailReply.findOne({ contactId: contact._id }).sort({ receivedAt: -1 }).lean();
    if (latestReply) {
      if (latestReply.classification === 'meeting_request' || latestReply.classification === 'interested') {
        initialInterestLevel = 'high';
      } else if (latestReply.classification === 'price_inquiry' || latestReply.classification === 'question') {
        initialInterestLevel = 'medium';
      }
    }

    // Pre-populate known business challenges from Phase 1 AI research
    const knownChallenges = (company.aiAnalysis?.problems || []).map((p) => p.title);
    const knownOpportunities = (company.aiAnalysis?.opportunities || []).map((o) => o.recommendedSolution);

    // Create the qualification record
    const qualification = new LeadQualification({
      companyId: company._id,
      contactId: contact._id,
      campaignId: params.campaignId,
      sourceConversationId: sourceConversationId || latestReply?._id?.toString() || '',
      sourceType,
      qualificationStatus: 'in_progress',
      interestLevel: initialInterestLevel,
      businessChallenges: knownChallenges,
      requiredSolutions: knownOpportunities,
      currentSystems: [],
      existingWorkflows: [],
      businessPriorities: [],
      budgetInformation: { status: 'not_discussed', details: '' },
      purchasingTimeline: { status: 'unknown', details: '' },
      decisionMakingAuthority: {
        status: contact.jobTitle && /ceo|owner|director|founder|president|head|coo/i.test(contact.jobTitle)
          ? 'decision_maker'
          : 'unknown',
        details: contact.jobTitle ? `Job title: ${contact.jobTitle}` : '',
        stakeholders: [],
      },
      additionalRequirements: [],
      missingInformation: [
        'Current software & ERP systems used',
        'Specific workflow friction points & weekly volume',
        'Implementation timeframe & urgency',
        'Purchasing decision committee & approval process',
      ],
      qualificationScore: 20, // Baseline score from verified Phase 1 profile
      scoreBreakdown: {
        needClarity: knownChallenges.length > 0 ? 10 : 0,
        solutionFit: knownOpportunities.length > 0 ? 10 : 0,
        engagement: 0,
        timeline: 0,
        authority: 0,
        budgetReadiness: 0,
      },
      qualificationSummary: `Initial qualification opened for ${contact.contactName || 'Executive'} at ${company.companyName}. Pre-populated with Phase 1 operational profile.`,
      aiRecommendation: 'needs_more_info',
      assignedTo,
      lastInteractionAt: new Date(),
    });

    await qualification.save();

    // Update Company & Contact statuses
    await Company.findByIdAndUpdate(company._id, {
      leadStatus: 'qualifying',
      handoffToQualification: true,
    });

    await OutreachContact.findByIdAndUpdate(contact._id, {
      outreachStatus: 'qualifying',
    });

    // Create Audit Activity Log
    await QualificationActivity.create({
      qualificationId: qualification._id,
      companyId: company._id,
      contactId: contact._id,
      activityType: 'qualification_started',
      title: 'Lead Qualification Initialized',
      description: `Qualification process started via ${sourceType} channel for ${contact.email} (${company.companyName}).`,
      actor,
      actorName,
      metadata: {
        initialInterestLevel,
        sourceType,
        sourceConversationId,
      },
    });

    logger.info(`Lead qualification started: ID=${qualification._id} for Contact=${contact.email}`);

    return qualification;
  }

  /**
   * Retrieves single qualification record by ID, fully populated with company, contact,
   * associated questions, and recent activities.
   */
  public async getQualificationById(id: string): Promise<{
    qualification: ILeadQualificationDocument;
    questions: any[];
    activities: any[];
  }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error(`Invalid qualification ID format: ${id}`);
    }

    const qualification = await LeadQualification.findById(id)
      .populate('companyId', 'companyName industry website country city leadScore aiAnalysis companySize')
      .populate('contactId', 'contactName jobTitle email validationStatus outreachStatus')
      .populate('campaignId', 'name status');

    if (!qualification) {
      throw new Error(`Lead qualification ${id} not found.`);
    }

    const [questions, activities] = await Promise.all([
      QualificationQuestion.find({ qualificationId: qualification._id })
        .sort({ createdAt: -1 })
        .lean(),
      QualificationActivity.find({ qualificationId: qualification._id })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

    return {
      qualification,
      questions,
      activities,
    };
  }

  /**
   * Lists lead qualifications with rich filtering, search, pagination, and status metrics.
   */
  public async listQualifications(filter: ListQualificationsFilter): Promise<{
    qualifications: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    stats: {
      total: number;
      inProgress: number;
      awaitingInfo: number;
      readyForReview: number;
      qualified: number;
      disqualified: number;
      highPotential: number;
    };
  }> {
    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(100, Math.max(1, filter.limit || 20));
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {};

    if (filter.qualificationStatus && filter.qualificationStatus !== 'all') {
      query.qualificationStatus = filter.qualificationStatus;
    }

    if (filter.interestLevel && filter.interestLevel !== 'all') {
      query.interestLevel = filter.interestLevel;
    }

    if (filter.minScore !== undefined || filter.maxScore !== undefined) {
      query.qualificationScore = {};
      if (filter.minScore !== undefined) query.qualificationScore.$gte = filter.minScore;
      if (filter.maxScore !== undefined) query.qualificationScore.$lte = filter.maxScore;
    }

    if (filter.companyId) {
      query.companyId = new Types.ObjectId(filter.companyId);
    }

    if (filter.contactId) {
      query.contactId = new Types.ObjectId(filter.contactId);
    }

    // Keyword Search across Company name or Contact email/name
    if (filter.search && filter.search.trim()) {
      const searchRegex = new RegExp(filter.search.trim(), 'i');
      const [matchingCompanies, matchingContacts] = await Promise.all([
        Company.find({ companyName: searchRegex }).select('_id').lean(),
        OutreachContact.find({ $or: [{ contactName: searchRegex }, { email: searchRegex }] }).select('_id').lean(),
      ]);

      const compIds = matchingCompanies.map((c) => c._id);
      const contIds = matchingContacts.map((c) => c._id);

      query.$or = [
        { companyId: { $in: compIds } },
        { contactId: { $in: contIds } },
        { qualificationSummary: searchRegex },
      ];
    }

    const [qualifications, total, inProgress, awaitingInfo, readyForReview, qualified, disqualified, highPotential] =
      await Promise.all([
        LeadQualification.find(query)
          .populate('companyId', 'companyName industry website country city leadScore')
          .populate('contactId', 'contactName jobTitle email validationStatus outreachStatus')
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        LeadQualification.countDocuments(query),
        LeadQualification.countDocuments({ qualificationStatus: 'in_progress' }),
        LeadQualification.countDocuments({ qualificationStatus: 'awaiting_information' }),
        LeadQualification.countDocuments({ qualificationStatus: 'ready_for_review' }),
        LeadQualification.countDocuments({ qualificationStatus: 'qualified' }),
        LeadQualification.countDocuments({ qualificationStatus: 'disqualified' }),
        LeadQualification.countDocuments({ qualificationScore: { $gte: 75 } }),
      ]);

    return {
      qualifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      stats: {
        total: await LeadQualification.countDocuments({}),
        inProgress,
        awaitingInfo,
        readyForReview,
        qualified,
        disqualified,
        highPotential,
      },
    };
  }

  /**
   * Updates qualification status with strict state machine validation and audit logging.
   */
  public async updateQualificationStatus(
    id: string,
    newStatus: QualificationStatus,
    reason?: string,
    actor: 'human' | 'ai' = 'human',
    actorName: string = 'System User'
  ): Promise<ILeadQualificationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error(`Invalid qualification ID format: ${id}`);
    }

    const qualification = await LeadQualification.findById(id);
    if (!qualification) {
      throw new Error(`Lead qualification ${id} not found.`);
    }

    const oldStatus = qualification.qualificationStatus;
    if (oldStatus === newStatus) {
      return qualification;
    }

    // Validate Status Transitions
    const allowedTransitions: Record<QualificationStatus, QualificationStatus[]> = {
      not_started: ['in_progress', 'paused', 'disqualified'],
      in_progress: ['awaiting_information', 'ready_for_review', 'qualified', 'disqualified', 'paused'],
      awaiting_information: ['in_progress', 'ready_for_review', 'qualified', 'disqualified', 'paused'],
      ready_for_review: ['qualified', 'awaiting_information', 'disqualified', 'in_progress', 'paused'],
      qualified: ['disqualified', 'in_progress', 'paused'],
      disqualified: ['in_progress', 'paused'], // Allow manual re-qualification
      paused: ['in_progress', 'awaiting_information', 'ready_for_review', 'disqualified'],
    };

    if (!allowedTransitions[oldStatus].includes(newStatus)) {
      throw new Error(`Invalid qualification status transition from "${oldStatus}" to "${newStatus}".`);
    }

    qualification.qualificationStatus = newStatus;
    qualification.lastInteractionAt = new Date();

    if (newStatus === 'disqualified') {
      qualification.disqualificationReason = reason || 'No fit or declined';
      await Company.findByIdAndUpdate(qualification.companyId, { leadStatus: 'disqualified' });
      await OutreachContact.findByIdAndUpdate(qualification.contactId, { outreachStatus: 'disqualified' });
    } else if (newStatus === 'qualified') {
      qualification.humanReview.reviewStatus = 'approved_qualified';
      qualification.humanReview.reviewedAt = new Date();
      qualification.humanReview.reviewedBy = actorName;
      qualification.humanReview.finalDecision = 'Approved as Sales Qualified Lead (SQL)';
      await Company.findByIdAndUpdate(qualification.companyId, { leadStatus: 'qualified' });
      await OutreachContact.findByIdAndUpdate(qualification.contactId, { outreachStatus: 'qualified' });
    } else if (newStatus === 'in_progress' || newStatus === 'awaiting_information') {
      await Company.findByIdAndUpdate(qualification.companyId, { leadStatus: 'qualifying' });
      await OutreachContact.findByIdAndUpdate(qualification.contactId, { outreachStatus: 'qualifying' });
    }

    await qualification.save();

    // Log Activity
    await QualificationActivity.create({
      qualificationId: qualification._id,
      companyId: qualification.companyId,
      contactId: qualification.contactId,
      activityType: newStatus === 'paused' ? 'paused' : newStatus === 'in_progress' && oldStatus === 'paused' ? 'resumed' : 'status_changed',
      title: `Status Changed: ${oldStatus} -> ${newStatus}`,
      description: reason ? `Reason: ${reason}` : `Status updated to ${newStatus} by ${actorName}.`,
      actor,
      actorName,
      metadata: { oldStatus, newStatus, reason },
    });

    logger.info(`Updated qualification status for ${id}: ${oldStatus} -> ${newStatus}`);

    return qualification;
  }

  /**
   * Updates structured fields on an existing qualification (e.g. extracted info or review notes).
   */
  public async updateQualification(
    id: string,
    updates: Partial<ILeadQualification>,
    actorName: string = 'System User'
  ): Promise<ILeadQualificationDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error(`Invalid qualification ID format: ${id}`);
    }

    const qualification = await LeadQualification.findById(id);
    if (!qualification) {
      throw new Error(`Lead qualification ${id} not found.`);
    }

    // Apply allowed field updates
    if (updates.businessChallenges) qualification.businessChallenges = updates.businessChallenges;
    if (updates.currentSystems) qualification.currentSystems = updates.currentSystems;
    if (updates.existingWorkflows) qualification.existingWorkflows = updates.existingWorkflows;
    if (updates.requiredSolutions) qualification.requiredSolutions = updates.requiredSolutions;
    if (updates.businessPriorities) qualification.businessPriorities = updates.businessPriorities;
    if (updates.additionalRequirements) qualification.additionalRequirements = updates.additionalRequirements;
    if (updates.missingInformation) qualification.missingInformation = updates.missingInformation;
    if (updates.assignedTo !== undefined) qualification.assignedTo = updates.assignedTo.trim();
    if (updates.interestLevel) qualification.interestLevel = updates.interestLevel;
    if (updates.qualificationSummary) qualification.qualificationSummary = updates.qualificationSummary;
    if (updates.aiRecommendation) qualification.aiRecommendation = updates.aiRecommendation;

    if (updates.budgetInformation) {
      qualification.budgetInformation = {
        ...qualification.budgetInformation,
        ...updates.budgetInformation,
      };
    }

    if (updates.purchasingTimeline) {
      qualification.purchasingTimeline = {
        ...qualification.purchasingTimeline,
        ...updates.purchasingTimeline,
      };
    }

    if (updates.decisionMakingAuthority) {
      qualification.decisionMakingAuthority = {
        ...qualification.decisionMakingAuthority,
        ...updates.decisionMakingAuthority,
      };
    }

    if (updates.scoreBreakdown) {
      qualification.scoreBreakdown = {
        ...qualification.scoreBreakdown,
        ...updates.scoreBreakdown,
      };
      // Auto-sum score breakdown
      const b = qualification.scoreBreakdown;
      qualification.qualificationScore = Math.min(
        100,
        Math.max(0, b.needClarity + b.solutionFit + b.engagement + b.timeline + b.authority + b.budgetReadiness)
      );
    } else if (typeof updates.qualificationScore === 'number') {
      qualification.qualificationScore = Math.min(100, Math.max(0, updates.qualificationScore));
    }

    if (updates.humanReview) {
      qualification.humanReview = {
        ...qualification.humanReview,
        ...updates.humanReview,
        reviewedAt: new Date(),
        reviewedBy: actorName,
      };
    }

    qualification.lastInteractionAt = new Date();
    await qualification.save();

    await QualificationActivity.create({
      qualificationId: qualification._id,
      companyId: qualification.companyId,
      contactId: qualification.contactId,
      activityType: 'information_extracted',
      title: 'Qualification Information Updated',
      description: `Lead qualification details updated by ${actorName}. Score is now ${qualification.qualificationScore}.`,
      actor: 'human',
      actorName,
    });

    return qualification;
  }

  /**
   * Submits a formal human sales team review decision on a qualification.
   * Can approve as qualified SQL, disqualify with reason, or request more information.
   * Also supports manual score overrides and field-level approvals.
   */
  public async submitHumanReview(params: {
    qualificationId: string;
    decision: 'approved_qualified' | 'disqualified' | 'more_info_needed';
    reviewerNotes: string;
    reviewerName?: string;
    manualScore?: number;
    approvedFields?: string[];
    rejectedFields?: string[];
    disqualificationReason?: string;
  }): Promise<ILeadQualificationDocument> {
    const {
      qualificationId,
      decision,
      reviewerNotes,
      reviewerName = 'Sales Team',
      manualScore,
      approvedFields = [],
      rejectedFields = [],
      disqualificationReason,
    } = params;

    if (!Types.ObjectId.isValid(qualificationId)) {
      throw new Error(`Invalid qualification ID format: ${qualificationId}`);
    }

    const qualification = await LeadQualification.findById(qualificationId);
    if (!qualification) {
      throw new Error(`Lead qualification ${qualificationId} not found.`);
    }

    const finalDecisionMap = {
      approved_qualified: 'Approved as Sales Qualified Lead (SQL)',
      disqualified: 'Disqualified from Outreach',
      more_info_needed: 'More Information Required Prior to Qualification',
    };

    qualification.humanReview = {
      reviewStatus: decision,
      reviewerNotes: reviewerNotes || '',
      approvedFields,
      rejectedFields,
      manualScore,
      finalDecision: finalDecisionMap[decision] || decision,
      reviewedBy: reviewerName,
      reviewedAt: new Date(),
    };

    if (manualScore !== undefined && typeof manualScore === 'number') {
      qualification.qualificationScore = Math.min(100, Math.max(0, manualScore));
    }

    // Apply status transitions according to decision
    if (decision === 'approved_qualified') {
      qualification.qualificationStatus = 'qualified';
      await Company.findByIdAndUpdate(qualification.companyId, { leadStatus: 'qualified' });
      await OutreachContact.findByIdAndUpdate(qualification.contactId, { outreachStatus: 'qualified' });
    } else if (decision === 'disqualified') {
      qualification.qualificationStatus = 'disqualified';
      qualification.disqualificationReason = disqualificationReason || reviewerNotes || 'Disqualified during human review';
      await Company.findByIdAndUpdate(qualification.companyId, { leadStatus: 'disqualified' });
      await OutreachContact.findByIdAndUpdate(qualification.contactId, { outreachStatus: 'disqualified' });
    } else if (decision === 'more_info_needed') {
      qualification.qualificationStatus = 'awaiting_information';
      await Company.findByIdAndUpdate(qualification.companyId, { leadStatus: 'qualifying' });
      await OutreachContact.findByIdAndUpdate(qualification.contactId, { outreachStatus: 'qualifying' });
    }

    qualification.lastInteractionAt = new Date();
    await qualification.save();

    // Log Human Review Activity
    await QualificationActivity.create({
      qualificationId: qualification._id,
      companyId: qualification.companyId,
      contactId: qualification.contactId,
      activityType: 'human_review_completed',
      title: `Human Review Completed: ${qualification.humanReview.finalDecision}`,
      description: reviewerNotes
        ? `Decision by ${reviewerName}: "${reviewerNotes}"`
        : `Decision by ${reviewerName}. Lead status updated to ${qualification.qualificationStatus}.`,
      actor: 'human',
      actorName: reviewerName,
      metadata: {
        decision,
        manualScore,
        approvedFields,
        rejectedFields,
        finalDecision: qualification.humanReview.finalDecision,
      },
    });

    logger.info(`Human review recorded for qualification ${qualificationId}: decision=${decision} by ${reviewerName}`);

    return qualification;
  }
}

export const leadQualificationService = new LeadQualificationService();

