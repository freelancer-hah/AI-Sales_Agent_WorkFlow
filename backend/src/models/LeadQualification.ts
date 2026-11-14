import { Schema, model, Document, Types } from 'mongoose';

export type QualificationStatus =
  | 'not_started'
  | 'in_progress'
  | 'awaiting_information'
  | 'ready_for_review'
  | 'qualified'
  | 'disqualified'
  | 'paused';

export type InterestLevel = 'high' | 'medium' | 'low' | 'unknown';

export type QualificationSourceType = 'email' | 'website' | 'manual';

export interface IBudgetInformation {
  status: 'disclosed' | 'not_disclosed' | 'not_discussed' | 'constrained';
  details: string;
  rangeEstimated?: string;
}

export interface IPurchasingTimeline {
  status: 'immediate' | 'within_1_month' | 'within_3_months' | 'within_6_months' | 'later' | 'unknown';
  details: string;
  targetDate?: Date;
}

export interface IDecisionMakingAuthority {
  status: 'decision_maker' | 'influencer' | 'researcher' | 'committee' | 'unknown';
  details: string;
  stakeholders?: string[];
}

export interface IScoreBreakdown {
  needClarity: number;      // 0 to 25
  solutionFit: number;      // 0 to 25
  engagement: number;       // 0 to 20
  timeline: number;         // 0 to 15
  authority: number;        // 0 to 10
  budgetReadiness: number;  // 0 to 5
}

export interface IHumanReview {
  reviewStatus: 'pending' | 'approved_qualified' | 'disqualified' | 'more_info_needed';
  reviewerNotes: string;
  approvedFields?: string[];
  rejectedFields?: string[];
  manualScore?: number;
  finalDecision?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
}

export interface ILeadQualification {
  companyId: Types.ObjectId;
  contactId: Types.ObjectId;
  campaignId?: Types.ObjectId;
  sourceConversationId?: string;
  sourceType: QualificationSourceType;
  qualificationStatus: QualificationStatus;
  interestLevel: InterestLevel;
  businessChallenges: string[];
  currentSystems: string[];
  existingWorkflows: string[];
  requiredSolutions: string[];
  businessPriorities: string[];
  budgetInformation: IBudgetInformation;
  purchasingTimeline: IPurchasingTimeline;
  decisionMakingAuthority: IDecisionMakingAuthority;
  additionalRequirements: string[];
  missingInformation: string[];
  qualificationScore: number;
  scoreBreakdown: IScoreBreakdown;
  qualificationSummary: string;
  aiRecommendation: 'potentially_qualified' | 'needs_more_info' | 'not_qualified' | 'pending';
  lastInteractionAt?: Date;
  assignedTo?: string;
  humanReview: IHumanReview;
  disqualificationReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ILeadQualificationDocument extends ILeadQualification, Document {}

const BudgetInformationSchema = new Schema<IBudgetInformation>(
  {
    status: {
      type: String,
      enum: ['disclosed', 'not_disclosed', 'not_discussed', 'constrained'],
      default: 'not_discussed',
    },
    details: { type: String, default: '' },
    rangeEstimated: { type: String, default: '' },
  },
  { _id: false }
);

const PurchasingTimelineSchema = new Schema<IPurchasingTimeline>(
  {
    status: {
      type: String,
      enum: ['immediate', 'within_1_month', 'within_3_months', 'within_6_months', 'later', 'unknown'],
      default: 'unknown',
    },
    details: { type: String, default: '' },
    targetDate: { type: Date },
  },
  { _id: false }
);

const DecisionMakingAuthoritySchema = new Schema<IDecisionMakingAuthority>(
  {
    status: {
      type: String,
      enum: ['decision_maker', 'influencer', 'researcher', 'committee', 'unknown'],
      default: 'unknown',
    },
    details: { type: String, default: '' },
    stakeholders: [{ type: String }],
  },
  { _id: false }
);

const ScoreBreakdownSchema = new Schema<IScoreBreakdown>(
  {
    needClarity: { type: Number, default: 0, min: 0, max: 25 },
    solutionFit: { type: Number, default: 0, min: 0, max: 25 },
    engagement: { type: Number, default: 0, min: 0, max: 20 },
    timeline: { type: Number, default: 0, min: 0, max: 15 },
    authority: { type: Number, default: 0, min: 0, max: 10 },
    budgetReadiness: { type: Number, default: 0, min: 0, max: 5 },
  },
  { _id: false }
);

const HumanReviewSchema = new Schema<IHumanReview>(
  {
    reviewStatus: {
      type: String,
      enum: ['pending', 'approved_qualified', 'disqualified', 'more_info_needed'],
      default: 'pending',
    },
    reviewerNotes: { type: String, default: '' },
    approvedFields: [{ type: String }],
    rejectedFields: [{ type: String }],
    manualScore: { type: Number },
    finalDecision: { type: String, default: '' },
    reviewedBy: { type: String },
    reviewedAt: { type: Date },
  },
  { _id: false }
);

const LeadQualificationSchema = new Schema<ILeadQualificationDocument>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    contactId: {
      type: Schema.Types.ObjectId,
      ref: 'OutreachContact',
      required: true,
      index: true,
    },
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      index: true,
    },
    sourceConversationId: {
      type: String,
      default: '',
      index: true,
    },
    sourceType: {
      type: String,
      enum: ['email', 'website', 'manual'],
      default: 'email',
    },
    qualificationStatus: {
      type: String,
      enum: [
        'not_started',
        'in_progress',
        'awaiting_information',
        'ready_for_review',
        'qualified',
        'disqualified',
        'paused',
      ],
      default: 'not_started',
      index: true,
    },
    interestLevel: {
      type: String,
      enum: ['high', 'medium', 'low', 'unknown'],
      default: 'unknown',
      index: true,
    },
    businessChallenges: [{ type: String }],
    currentSystems: [{ type: String }],
    existingWorkflows: [{ type: String }],
    requiredSolutions: [{ type: String }],
    businessPriorities: [{ type: String }],
    budgetInformation: {
      type: BudgetInformationSchema,
      default: () => ({ status: 'not_discussed', details: '' }),
    },
    purchasingTimeline: {
      type: PurchasingTimelineSchema,
      default: () => ({ status: 'unknown', details: '' }),
    },
    decisionMakingAuthority: {
      type: DecisionMakingAuthoritySchema,
      default: () => ({ status: 'unknown', details: '', stakeholders: [] }),
    },
    additionalRequirements: [{ type: String }],
    missingInformation: [{ type: String }],
    qualificationScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
      index: true,
    },
    scoreBreakdown: {
      type: ScoreBreakdownSchema,
      default: () => ({
        needClarity: 0,
        solutionFit: 0,
        engagement: 0,
        timeline: 0,
        authority: 0,
        budgetReadiness: 0,
      }),
    },
    qualificationSummary: {
      type: String,
      default: '',
    },
    aiRecommendation: {
      type: String,
      enum: ['potentially_qualified', 'needs_more_info', 'not_qualified', 'pending'],
      default: 'pending',
    },
    lastInteractionAt: {
      type: Date,
      default: Date.now,
    },
    assignedTo: {
      type: String,
      default: '',
      trim: true,
    },
    humanReview: {
      type: HumanReviewSchema,
      default: () => ({
        reviewStatus: 'pending',
        reviewerNotes: '',
      }),
    },
    disqualificationReason: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast dashboard filtering & sorting
LeadQualificationSchema.index({ companyId: 1, contactId: 1 });
LeadQualificationSchema.index({ qualificationStatus: 1, qualificationScore: -1 });
LeadQualificationSchema.index({ updatedAt: -1 });

export const LeadQualification = model<ILeadQualificationDocument>(
  'LeadQualification',
  LeadQualificationSchema
);
