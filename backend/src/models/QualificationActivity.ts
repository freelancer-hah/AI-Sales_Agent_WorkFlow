import { Schema, model, Document, Types } from 'mongoose';

export type QualificationActivityType =
  | 'qualification_started'
  | 'question_generated'
  | 'question_sent'
  | 'reply_received'
  | 'information_extracted'
  | 'score_generated'
  | 'human_review_completed'
  | 'status_changed'
  | 'paused'
  | 'resumed'
  | 'lead_handed_off'
  | 'meeting_scheduled';

export interface IQualificationActivity {
  qualificationId: Types.ObjectId;
  companyId: Types.ObjectId;
  contactId: Types.ObjectId;
  activityType: QualificationActivityType;
  title: string;
  description: string;
  actor: 'ai' | 'human' | 'prospect';
  actorName?: string;
  metadata?: Record<string, any>;
  createdAt?: Date;
}

export interface IQualificationActivityDocument extends IQualificationActivity, Document {}

const QualificationActivitySchema = new Schema<IQualificationActivityDocument>(
  {
    qualificationId: {
      type: Schema.Types.ObjectId,
      ref: 'LeadQualification',
      required: true,
      index: true,
    },
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
    activityType: {
      type: String,
      enum: [
        'qualification_started',
        'question_generated',
        'question_sent',
        'reply_received',
        'information_extracted',
        'score_generated',
        'human_review_completed',
        'status_changed',
        'paused',
        'resumed',
        'lead_handed_off',
        'meeting_scheduled',
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    actor: {
      type: String,
      enum: ['ai', 'human', 'prospect'],
      default: 'ai',
    },
    actorName: {
      type: String,
      default: '',
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

QualificationActivitySchema.index({ qualificationId: 1, createdAt: -1 });

export const QualificationActivity = model<IQualificationActivityDocument>(
  'QualificationActivity',
  QualificationActivitySchema
);

