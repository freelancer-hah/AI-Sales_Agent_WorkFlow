import { Schema, model, Document, Types } from 'mongoose';

export type MessageStatus =
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'failed'
  | 'cancelled';

export interface IOutreachMessage {
  campaignId?: Types.ObjectId;
  contactId: Types.ObjectId;
  draftId?: Types.ObjectId;
  direction: 'outbound' | 'inbound';
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  status: MessageStatus;
  messageId?: string;
  inReplyTo?: string;
  references: string[];
  threadId?: string;
  scheduledFor?: Date;
  sentAt?: Date;
  error?: string;
  sandboxRedirected: boolean;
  // Performance tracking
  framework?: string;
  subjectVariantUsed?: number;
  matchedCapability?: string;
  industry?: string;
  country?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IOutreachMessageDocument extends IOutreachMessage, Document {}

const OutreachMessageSchema = new Schema<IOutreachMessageDocument>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      index: true,
    },
    contactId: {
      type: Schema.Types.ObjectId,
      ref: 'OutreachContact',
      required: true,
      index: true,
    },
    draftId: {
      type: Schema.Types.ObjectId,
      ref: 'EmailDraft',
      index: true,
    },
    direction: {
      type: String,
      enum: ['outbound', 'inbound'],
      default: 'outbound',
      index: true,
    },
    senderEmail: {
      type: String,
      required: true,
      trim: true,
    },
    recipientEmail: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    bodyHtml: {
      type: String,
      default: '',
    },
    bodyText: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['scheduled', 'sending', 'sent', 'delivered', 'bounced', 'failed', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    messageId: {
      type: String,
      index: true,
    },
    inReplyTo: {
      type: String,
      default: '',
    },
    references: {
      type: [String],
      default: [],
    },
    threadId: {
      type: String,
      index: true,
    },
    scheduledFor: {
      type: Date,
      index: true,
    },
    sentAt: {
      type: Date,
      index: true,
    },
    error: {
      type: String,
      default: '',
    },
    sandboxRedirected: {
      type: Boolean,
      default: false,
    },
    framework: {
      type: String,
      default: '',
      index: true,
    },
    subjectVariantUsed: {
      type: Number,
      default: 0,
    },
    matchedCapability: {
      type: String,
      default: '',
      index: true,
    },
    industry: {
      type: String,
      default: '',
      index: true,
    },
    country: {
      type: String,
      default: '',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

OutreachMessageSchema.index({ status: 1, scheduledFor: 1 });
OutreachMessageSchema.index({ contactId: 1, sentAt: -1 });

export const OutreachMessage = model<IOutreachMessageDocument>(
  'OutreachMessage',
  OutreachMessageSchema
);

