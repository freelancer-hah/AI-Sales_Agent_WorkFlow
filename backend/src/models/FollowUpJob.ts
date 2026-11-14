import { Schema, model, Document, Types } from 'mongoose';

export type FollowUpJobStatus =
  | 'scheduled'
  | 'processing'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface IFollowUpJob {
  campaignId: Types.ObjectId;
  contactId: Types.ObjectId;
  sequenceStep: number;
  scheduledAt: Date;
  status: FollowUpJobStatus;
  completedAt?: Date;
  error?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IFollowUpJobDocument extends IFollowUpJob, Document {}

const FollowUpJobSchema = new Schema<IFollowUpJobDocument>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
      index: true,
    },
    contactId: {
      type: Schema.Types.ObjectId,
      ref: 'OutreachContact',
      required: true,
      index: true,
    },
    sequenceStep: {
      type: Number,
      required: true,
    },
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['scheduled', 'processing', 'completed', 'cancelled', 'failed'],
      default: 'scheduled',
      index: true,
    },
    completedAt: {
      type: Date,
    },
    error: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

FollowUpJobSchema.index({ campaignId: 1, contactId: 1, sequenceStep: 1 }, { unique: true });
FollowUpJobSchema.index({ status: 1, scheduledAt: 1 });

export const FollowUpJob = model<IFollowUpJobDocument>('FollowUpJob', FollowUpJobSchema);

