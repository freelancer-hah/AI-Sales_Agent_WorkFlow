import { Schema, Document, model, Types } from 'mongoose';
import { SourceSchema, ISource } from './Source.js';
import { DecisionMakerSchema, IDecisionMaker } from './DecisionMaker.js';

export interface IAIOpportunity {
  title: string;
  businessProblem: string;
  recommendedSolution: string;
  howItWorks: string;
  benefits: string;
  whyNeeded: string;
  supportingEvidence: string;
  implementationComplexity?: 'low' | 'medium' | 'high';
  potentialImpact?: 'low' | 'medium' | 'high';
  confidence: 'high' | 'medium' | 'low';
}

export interface IAIProblem {
  title: string;
  problem: string;
  hypothesis: boolean;
  evidence?: string;
}

export interface IAIScoreBreakdown {
  industryAlignment: number;
  operationalComplexity: number;
  opportunityQuality: number;
  decisionMakerAvailability: number;
  contactability: number;
}

export interface IAIAnalysis {
  problems: IAIProblem[];
  opportunities: IAIOpportunity[];
  leadScore: number;
  scoreBreakdown?: IAIScoreBreakdown;
  scoreExplanation: string;
  evidence: string[];
  missingInformation: string[];
  analyzedAt?: Date;
  modelUsed?: string;
}

export interface IGoogleReview {
  author?: string;
  rating?: number;
  text?: string;
  publishAt?: string;
}

export interface IJobPosting {
  title: string;
  platform: string;
  company?: string;
  location?: string;
  salary?: string;
  datePosted?: string;
  jobUrl?: string;
  descriptionSnippet?: string;
}

export interface ICompany {
  companyName: string;
  normalizedName: string;
  website: string;
  domain: string;
  industry: string;
  category: string;
  description: string;
  services: string[];
  products: string[];
  country: string;
  region: string;
  city: string;
  address: string;
  phoneNumbers: string[];
  emails: string[];
  googleRating?: number;
  googleReviewsCount?: number;
  reviews?: IGoogleReview[];
  jobPostings?: IJobPosting[];
  jobsScrapedAt?: Date;
  companySize: 'Small: 1–50 employees' | 'Medium: 51–250 employees' | 'Large: 251–1000 employees' | 'Enterprise: 1000+ employees' | 'Unknown';
  socialLinks: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    github?: string;
    [key: string]: string | undefined;
  };
  decisionMakers: IDecisionMaker[];
  aiAnalysis?: IAIAnalysis;
  leadScore: number;
  sources: ISource[];
  discoveryStatus: 'discovered' | 'in_progress' | 'completed' | 'failed';
  scrapingStatus: 'pending' | 'scraping' | 'completed' | 'failed';
  analysisStatus: 'pending' | 'analyzing' | 'completed' | 'failed';
  isSaved: boolean;
  reviewStatus: 'new' | 'reviewed' | 'contacted' | 'rejected';
  leadStatus?: 'new' | 'reviewed' | 'contacted' | 'replied' | 'interested' | 'qualifying' | 'qualified' | 'disqualified' | 'converted';
  handoffToQualification?: boolean;
  notes: string;
  manualOverrides?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICompanyDocument extends ICompany, Document {}

const AIOpportunitySchema = new Schema<IAIOpportunity>(
  {
    title: { type: String, required: true },
    businessProblem: { type: String, required: true },
    recommendedSolution: { type: String, required: true },
    howItWorks: { type: String, required: true },
    benefits: { type: String, required: true },
    whyNeeded: { type: String, required: true },
    supportingEvidence: { type: String, default: '' },
    implementationComplexity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    potentialImpact: { type: String, enum: ['low', 'medium', 'high'], default: 'high' },
    confidence: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  },
  { _id: false }
);

const AIProblemSchema = new Schema<IAIProblem>(
  {
    title: { type: String, required: true },
    problem: { type: String, required: true },
    hypothesis: { type: Boolean, default: true },
    evidence: { type: String, default: '' },
  },
  { _id: false }
);

const JobPostingSchema = new Schema<IJobPosting>(
  {
    title: { type: String, required: true },
    platform: { type: String, default: 'job_board' },
    company: { type: String, default: '' },
    location: { type: String, default: '' },
    salary: { type: String, default: '' },
    datePosted: { type: String, default: '' },
    jobUrl: { type: String, default: '' },
    descriptionSnippet: { type: String, default: '' },
  },
  { _id: false }
);

const AIAnalysisSchema = new Schema<IAIAnalysis>(
  {
    problems: [AIProblemSchema],
    opportunities: [AIOpportunitySchema],
    leadScore: { type: Number, min: 0, max: 100, default: 0 },
    scoreBreakdown: {
      industryAlignment: { type: Number, default: 0 },
      operationalComplexity: { type: Number, default: 0 },
      opportunityQuality: { type: Number, default: 0 },
      decisionMakerAvailability: { type: Number, default: 0 },
      contactability: { type: Number, default: 0 },
    },
    scoreExplanation: { type: String, default: '' },
    evidence: [{ type: String }],
    missingInformation: [{ type: String }],
    analyzedAt: { type: Date },
    modelUsed: { type: String },
  },
  { _id: false }
);

export const CompanySchema = new Schema<ICompanyDocument>(
  {
    companyName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    normalizedName: {
      type: String,
      trim: true,
      index: true,
    },
    website: {
      type: String,
      trim: true,
      default: '',
    },
    domain: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },
    industry: {
      type: String,
      trim: true,
      default: 'Other',
      index: true,
    },
    category: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    services: [{ type: String, trim: true }],
    products: [{ type: String, trim: true }],
    country: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    region: {
      type: String,
      trim: true,
      default: '',
    },
    city: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    phoneNumbers: [{ type: String, trim: true }],
    emails: [{ type: String, trim: true, lowercase: true }],
    googleRating: { type: Number },
    googleReviewsCount: { type: Number },
    reviews: [
      {
        author: { type: String, default: '' },
        rating: { type: Number },
        text: { type: String, default: '' },
        publishAt: { type: String, default: '' },
      },
    ],
    jobPostings: [JobPostingSchema],
    jobsScrapedAt: { type: Date },
    companySize: {
      type: String,
      enum: [
        'Small: 1–50 employees',
        'Medium: 51–250 employees',
        'Large: 251–1000 employees',
        'Enterprise: 1000+ employees',
        'Unknown',
      ],
      default: 'Unknown',
      index: true,
    },
    socialLinks: {
      linkedin: { type: String, default: '' },
      twitter: { type: String, default: '' },
      facebook: { type: String, default: '' },
      github: { type: String, default: '' },
    },
    decisionMakers: [DecisionMakerSchema],
    aiAnalysis: AIAnalysisSchema,
    leadScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
      index: true,
    },
    sources: [SourceSchema],
    discoveryStatus: {
      type: String,
      enum: ['discovered', 'in_progress', 'completed', 'failed'],
      default: 'discovered',
      index: true,
    },
    scrapingStatus: {
      type: String,
      enum: ['pending', 'scraping', 'completed', 'failed'],
      default: 'pending',
    },
    analysisStatus: {
      type: String,
      enum: ['pending', 'analyzing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    isSaved: {
      type: Boolean,
      default: false,
      index: true,
    },
    reviewStatus: {
      type: String,
      enum: ['new', 'reviewed', 'contacted', 'rejected'],
      default: 'new',
      index: true,
    },
    leadStatus: {
      type: String,
      enum: ['new', 'reviewed', 'contacted', 'replied', 'interested', 'qualifying', 'qualified', 'disqualified', 'converted'],
      default: 'new',
      index: true,
    },
    handoffToQualification: {
      type: Boolean,
      default: false,
      index: true,
    },
    notes: {
      type: String,
      default: '',
    },
    manualOverrides: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for searching & duplicate queries
CompanySchema.index({ domain: 1, country: 1 });
CompanySchema.index({ companyName: 'text', description: 'text', services: 'text' });

export const Company = model<ICompanyDocument>('Company', CompanySchema);
