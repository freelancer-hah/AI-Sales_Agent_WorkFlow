import { Schema, model, Document, Types } from 'mongoose';

export type DraftApprovalStatus = 'draft' | 'approved' | 'rejected';

export interface IPersonalizationEvidence {
  phase1ProblemsUsed: string[];
  cybellsCapabilityUsed: string;
  matchedReasoning: string;
}

export interface IEmailDraft {
  contactId: Types.ObjectId;
  companyId: Types.ObjectId;
  campaignId?: Types.ObjectId;
  sequenceStep: number;
  subjectOptions: string[];
  subject: string;
  bodyHtml: string;
  bodyText: string;
  personalizationEvidence: IPersonalizationEvidence;
  geminiModel: string;
  spamScore: number;
  spamFlags: string[];
  approvalStatus: DraftApprovalStatus;
  approvedAt?: Date;
  approvedContentHash?: string;
  // Performance tracking fields
  framework: string;
  subjectVariantUsed: number;
  matchedCapability: string;
  industry: string;
  country: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IEmailDraftDocument extends IEmailDraft, Document {}

const PersonalizationEvidenceSchema = new Schema<IPersonalizationEvidence>(
  {
    phase1ProblemsUsed: [{ type: String }],
    cybellsCapabilityUsed: { type: String, default: '' },
    matchedReasoning: { type: String, default: '' },
  },
  { _id: false }
);

const EmailDraftSchema = new Schema<IEmailDraftDocument>(
  {
    contactId: {
      type: Schema.Types.ObjectId,
      ref: 'OutreachContact',
      required: true,
      index: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      index: true,
    },
    sequenceStep: {
      type: Number,
      default: 0,
      index: true,
    },
    subjectOptions: {
      type: [String],
      default: [],
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    bodyHtml: {
      type: String,
      required: true,
    },
    bodyText: {
      type: String,
      required: true,
    },
    personalizationEvidence: {
      type: PersonalizationEvidenceSchema,
      default: () => ({ phase1ProblemsUsed: [], cybellsCapabilityUsed: '', matchedReasoning: '' }),
    },
    geminiModel: {
      type: String,
      default: '',
    },
    spamScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    spamFlags: {
      type: [String],
      default: [],
    },
    approvalStatus: {
      type: String,
      enum: ['draft', 'approved', 'rejected'],
      default: 'draft',
      index: true,
    },
    approvedAt: {
      type: Date,
    },
    approvedContentHash: {
      type: String,
      default: '',
    },
    framework: {
      type: String,
      default: 'problem_agitate_solve',
      index: true,
    },
    subjectVariantUsed: {
      type: Number,
      default: 0,
    },
    matchedCapability: {
      type: String,
      default: '',
      index: true,
    },
    industry: {
      type: String,
      default: '',
      index: true,
    },
    country: {
      type: String,
      default: '',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

EmailDraftSchema.index({ contactId: 1, sequenceStep: 1 });
EmailDraftSchema.index({ approvalStatus: 1, campaignId: 1 });

export const EmailDraft = model<IEmailDraftDocument>('EmailDraft', EmailDraftSchema);

