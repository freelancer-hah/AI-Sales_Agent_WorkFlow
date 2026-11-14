import { Schema, model, Document, Model } from 'mongoose';

export interface ICybellsCapability {
  id: string;
  title: string;
  description: string;
  typicalUseCases: string[];
}

export interface ICybellsCaseStudy {
  id: string;
  title: string;
  clientIndustry: string;
  problemSolved: string;
  metricOrResult: string;
  verified: boolean;
}

export interface ICybellsFAQ {
  question: string;
  answer: string;
}

export interface ICybellsSendingRules {
  dailyCap: number;
  minDelaySeconds: number;
  maxDelaySeconds: number;
  allowedSendingHours: {
    start: number;
    end: number;
  };
  allowedSendingDays: number[];
  timezone: string;
}

export interface IImapSyncState {
  lastSyncAt?: Date;
  lastUid: number;
  uidValidity: string;
  status: 'idle' | 'syncing' | 'error';
  lastError?: string;
  processedCount?: number;
}

export interface ICybellsConfig {
  agencyName: string;
  mission: string;
  targetAudience: string;
  brandVoice: string;
  capabilities: ICybellsCapability[];
  caseStudies: ICybellsCaseStudy[];
  faqs: ICybellsFAQ[];
  securityPrivacyStatement: string;
  senderName: string;
  signature: string;
  optOutText: string;
  postalAddress: string;
  sendingRules: ICybellsSendingRules;
  imapSyncState?: IImapSyncState;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICybellsConfigDocument extends ICybellsConfig, Document {}

const CybellsCapabilitySchema = new Schema<ICybellsCapability>(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    typicalUseCases: [{ type: String }],
  },
  { _id: false }
);

const CybellsCaseStudySchema = new Schema<ICybellsCaseStudy>(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    clientIndustry: { type: String, required: true },
    problemSolved: { type: String, required: true },
    metricOrResult: { type: String, required: true },
    verified: { type: Boolean, default: false },
  },
  { _id: false }
);

const CybellsFAQSchema = new Schema<ICybellsFAQ>(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
  },
  { _id: false }
);

const CybellsConfigSchema = new Schema<ICybellsConfigDocument>(
  {
    agencyName: {
      type: String,
      default: 'Cybells',
      trim: true,
    },
    mission: {
      type: String,
      default: '',
      trim: true,
    },
    targetAudience: {
      type: String,
      default: '',
      trim: true,
    },
    brandVoice: {
      type: String,
      default: 'Professional, consultative, and value-focused',
      trim: true,
    },
    capabilities: [CybellsCapabilitySchema],
    caseStudies: [CybellsCaseStudySchema],
    faqs: [CybellsFAQSchema],
    securityPrivacyStatement: {
      type: String,
      default: 'Enterprise-grade data security with zero third-party model retraining on confidential client data.',
    },
    senderName: {
      type: String,
      default: 'Cybells AI Solutions',
      trim: true,
    },
    signature: {
      type: String,
      default: 'Best regards,\nCybells AI Solutions Team\nhttps://cybells.ai',
    },
    optOutText: {
      type: String,
      default: 'If you prefer not to receive future emails regarding AI solutions, please reply with "unsubscribe" or click the link below.',
    },
    postalAddress: {
      type: String,
      default: '123 Innovation Way, Tech Park, Suite 400',
    },
    sendingRules: {
      dailyCap: { type: Number, default: 25 },
      minDelaySeconds: { type: Number, default: 60 },
      maxDelaySeconds: { type: Number, default: 180 },
      allowedSendingHours: {
        start: { type: Number, default: 9 },
        end: { type: Number, default: 18 },
      },
      allowedSendingDays: {
        type: [Number],
        default: [1, 2, 3, 4, 5],
      },
      timezone: { type: String, default: 'UTC' },
    },
    imapSyncState: {
      lastSyncAt: { type: Date },
      lastUid: { type: Number, default: 0 },
      uidValidity: { type: String, default: '' },
      status: {
        type: String,
        enum: ['idle', 'syncing', 'error'],
        default: 'idle',
      },
      lastError: { type: String, default: '' },
      processedCount: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Singleton retrieval pattern: gets or creates the default Cybells configuration.
 */
CybellsConfigSchema.statics.getOrCreateConfig = async function (): Promise<ICybellsConfigDocument> {
  let config = await this.findOne();
  if (!config) {
    config = await this.create({
      agencyName: 'Cybells',
      mission: '',
      targetAudience: '',
      capabilities: [],
      caseStudies: [],
      faqs: [],
    });
  }
  return config;
};

export interface ICybellsConfigModel extends Model<ICybellsConfigDocument> {
  getOrCreateConfig(): Promise<ICybellsConfigDocument>;
}

export const CybellsConfig = model<ICybellsConfigDocument, ICybellsConfigModel>(
  'CybellsConfig',
  CybellsConfigSchema
);

