import { Schema, Document, model, Types } from 'mongoose';

export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type DecisionMakerStatus = 'identified' | 'verified' | 'unverified';

export interface IDecisionMaker {
  companyId: Types.ObjectId;
  fullName: string;
  jobTitle: string;
  professionalProfileUrl?: string;
  publicBusinessEmail?: string;
  evidence?: string;
  sourceUrl?: string;
  confidence: ConfidenceLevel;
  discoveryStatus: DecisionMakerStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IDecisionMakerDocument extends IDecisionMaker, Document {}

export const DecisionMakerSchema = new Schema<IDecisionMakerDocument>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: false,
      index: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    jobTitle: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    professionalProfileUrl: {
      type: String,
      trim: true,
      default: '',
    },
    publicBusinessEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    evidence: {
      type: String,
      trim: true,
      default: '',
    },
    sourceUrl: {
      type: String,
      trim: true,
      default: '',
    },
    confidence: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium',
    },
    discoveryStatus: {
      type: String,
      enum: ['identified', 'verified', 'unverified'],
      default: 'identified',
    },
  },
  {
    timestamps: true,
  }
);

DecisionMakerSchema.index({ companyId: 1, fullName: 1 }, { unique: false });

export const DecisionMaker = model<IDecisionMakerDocument>('DecisionMaker', DecisionMakerSchema);
