import { Schema, model, Document, Types } from 'mongoose';

export type QuestionCategory =
  | 'business_challenges'
  | 'current_systems'
  | 'required_solutions'
  | 'business_priorities'
  | 'budget_timeline'
  | 'decision_authority';

export type QuestionStatus =
  | 'draft'
  | 'pending_approval'
  | 'sent'
  | 'answered'
  | 'skipped';

export interface IQualificationQuestion {
  qualificationId: Types.ObjectId;
  contactId: Types.ObjectId;
  companyId: Types.ObjectId;
  question: string;
  category: QuestionCategory;
  purpose: string;
  priority: 'high' | 'medium' | 'low';
  isRequired: boolean;
  questionStatus: QuestionStatus;
  generatedBy: 'ai' | 'human';
  sourceChannel: 'email' | 'website' | 'manual';
  sourceMessageId?: string;
  answerText?: string;
  answeredAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IQualificationQuestionDocument extends IQualificationQuestion, Document {}

const QualificationQuestionSchema = new Schema<IQualificationQuestionDocument>(
  {
    qualificationId: {
      type: Schema.Types.ObjectId,
      ref: 'LeadQualification',
      required: true,
      index: true,
    },
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
    question: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: [
        'business_challenges',
        'current_systems',
        'required_solutions',
        'business_priorities',
        'budget_timeline',
        'decision_authority',
      ],
      required: true,
    },
    purpose: {
      type: String,
      default: '',
    },
    priority: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium',
    },
    isRequired: {
      type: Boolean,
      default: false,
    },
    questionStatus: {
      type: String,
      enum: ['draft', 'pending_approval', 'sent', 'answered', 'skipped'],
      default: 'draft',
      index: true,
    },
    generatedBy: {
      type: String,
      enum: ['ai', 'human'],
      default: 'ai',
    },
    sourceChannel: {
      type: String,
      enum: ['email', 'website', 'manual'],
      default: 'email',
    },
    sourceMessageId: {
      type: String,
    },
    answerText: {
      type: String,
      default: '',
    },
    answeredAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

QualificationQuestionSchema.index({ qualificationId: 1, questionStatus: 1 });

export const QualificationQuestion = model<IQualificationQuestionDocument>(
  'QualificationQuestion',
  QualificationQuestionSchema
);

