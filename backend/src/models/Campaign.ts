import { Schema, model, Document, Types } from 'mongoose';

export type CampaignStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'scheduled'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled';

export interface ICampaignSequenceStep {
  step: number;
  dayOffset: number;
  templateId?: Types.ObjectId;
  subject?: string;
  body?: string;
}

export interface ICampaignSendingLimits {
  dailyCap?: number;
  minDelaySeconds?: number;
  maxDelaySeconds?: number;
}

export interface ICampaignSchedule {
  startDate?: Date;
  timezone?: string;
}

export interface ICampaign {
  name: string;
  description: string;
  targetCriteria: Record<string, any>;
  selectedContacts: Types.ObjectId[];
  templateId?: Types.ObjectId;
  sequence: ICampaignSequenceStep[];
  status: CampaignStatus;
  schedule: ICampaignSchedule;
  sendingLimits: ICampaignSendingLimits;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICampaignDocument extends ICampaign, Document {}

const CampaignSequenceStepSchema = new Schema<ICampaignSequenceStep>(
  {
    step: { type: Number, required: true },
    dayOffset: { type: Number, default: 0 },
    templateId: { type: Schema.Types.ObjectId, ref: 'EmailTemplate' },
    subject: { type: String, default: '' },
    body: { type: String, default: '' },
  },
  { _id: false }
);

const CampaignSchema = new Schema<ICampaignDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    targetCriteria: {
      type: Schema.Types.Mixed,
      default: {},
    },
    selectedContacts: [
      {
        type: Schema.Types.ObjectId,
        ref: 'OutreachContact',
      },
    ],
    templateId: {
      type: Schema.Types.ObjectId,
      ref: 'EmailTemplate',
    },
    sequence: {
      type: [CampaignSequenceStepSchema],
      default: () => [
        { step: 0, dayOffset: 0 },
        { step: 1, dayOffset: 3 },
        { step: 2, dayOffset: 7 },
        { step: 3, dayOffset: 12 },
      ],
    },
    status: {
      type: String,
      enum: [
        'draft',
        'pending_approval',
        'approved',
        'scheduled',
        'running',
        'paused',
        'completed',
        'cancelled',
      ],
      default: 'draft',
      index: true,
    },
    schedule: {
      startDate: { type: Date },
      timezone: { type: String, default: 'UTC' },
    },
    sendingLimits: {
      dailyCap: { type: Number, default: 25 },
      minDelaySeconds: { type: Number, default: 60 },
      maxDelaySeconds: { type: Number, default: 180 },
    },
  },
  {
    timestamps: true,
  }
);

CampaignSchema.index({ status: 1, createdAt: -1 });

export const Campaign = model<ICampaignDocument>('Campaign', CampaignSchema);

