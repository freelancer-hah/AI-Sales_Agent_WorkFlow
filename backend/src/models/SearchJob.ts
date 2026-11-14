import { Schema, Document, model } from 'mongoose';

export interface ISearchCriteria {
  industry?: string;
  category?: string;
  keywords?: string[];
  country?: string;
  region?: string;
  city?: string;
  companySize?: string;
  services?: string[];
  aiRequirements?: string[];
  maxCompanies: number;
}

export interface ISearchError {
  timestamp: Date;
  phase: string;
  message: string;
}

export interface ISearchJob {
  searchCriteria: ISearchCriteria;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  discoveredCount: number;
  processedCount: number;
  failedCount: number;
  startedAt?: Date;
  completedAt?: Date;
  errors: ISearchError[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ISearchJobDocument extends Omit<Document, 'errors'>, ISearchJob {}

const SearchCriteriaSchema = new Schema<ISearchCriteria>(
  {
    industry: { type: String, default: '' },
    category: { type: String, default: '' },
    keywords: [{ type: String }],
    country: { type: String, default: '' },
    region: { type: String, default: '' },
    city: { type: String, default: '' },
    companySize: { type: String, default: 'Unknown' },
    services: [{ type: String }],
    aiRequirements: [{ type: String }],
    maxCompanies: { type: Number, default: 25 },
  },
  { _id: false }
);

const SearchErrorSchema = new Schema<ISearchError>(
  {
    timestamp: { type: Date, default: Date.now },
    phase: { type: String, required: true },
    message: { type: String, required: true },
  },
  { _id: false }
);

export const SearchJobSchema = new Schema<ISearchJobDocument>(
  {
    searchCriteria: {
      type: SearchCriteriaSchema,
      required: true,
    },
    status: {
      type: String,
      enum: ['queued', 'running', 'completed', 'failed'],
      default: 'queued',
      index: true,
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    discoveredCount: {
      type: Number,
      default: 0,
    },
    processedCount: {
      type: Number,
      default: 0,
    },
    failedCount: {
      type: Number,
      default: 0,
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    errors: [SearchErrorSchema],
  },
  {
    timestamps: true,
    suppressReservedKeysWarning: true,
  }
);

export const SearchJob = model<ISearchJobDocument>('SearchJob', SearchJobSchema);
