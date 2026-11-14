import { Schema, model, Document } from 'mongoose';

export type SuppressionReason =
  | 'unsubscribe'
  | 'hard_bounce'
  | 'manual_suppression'
  | 'spam_complaint';

export interface ISuppressionList {
  email: string;
  reason: SuppressionReason;
  source: string;
  createdAt: Date;
}

export interface ISuppressionListDocument extends ISuppressionList, Document {}

const SuppressionListSchema = new Schema<ISuppressionListDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    reason: {
      type: String,
      enum: ['unsubscribe', 'hard_bounce', 'manual_suppression', 'spam_complaint'],
      required: true,
      index: true,
    },
    source: {
      type: String,
      default: 'manual',
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

export const SuppressionList = model<ISuppressionListDocument>(
  'SuppressionList',
  SuppressionListSchema
);

