import { Schema, model, Document, Types } from 'mongoose';

export type InquiryStatus = 'active' | 'lead_captured' | 'closed';

export interface IInquiryMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface IExtractedLead {
  visitorName?: string;
  email?: string;
  companyName?: string;
  needs?: string;
  matchedCompanyId?: Types.ObjectId;
}

export interface IInquiry {
  sessionId: string;
  messages: IInquiryMessage[];
  extractedLead: IExtractedLead;
  status: InquiryStatus;
  createdAt: Date;
  updatedAt?: Date;
}

export interface IInquiryDocument extends IInquiry, Document {}

const InquiryMessageSchema = new Schema<IInquiryMessage>(
  {
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const ExtractedLeadSchema = new Schema<IExtractedLead>(
  {
    visitorName: { type: String, default: '' },
    email: { type: String, default: '', lowercase: true, trim: true },
    companyName: { type: String, default: '' },
    needs: { type: String, default: '' },
    matchedCompanyId: { type: Schema.Types.ObjectId, ref: 'Company' },
  },
  { _id: false }
);

const InquirySchema = new Schema<IInquiryDocument>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    messages: [InquiryMessageSchema],
    extractedLead: {
      type: ExtractedLeadSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: ['active', 'lead_captured', 'closed'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Inquiry = model<IInquiryDocument>('Inquiry', InquirySchema);

