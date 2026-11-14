import { Schema, model, Document, Types } from 'mongoose';

export type ReplyClassification =
  | 'interested'
  | 'question'
  | 'meeting_request'
  | 'price_inquiry'
  | 'objection'
  | 'not_interested'
  | 'out_of_office'
  | 'unsubscribe'
  | 'unclear';

export interface IEmailReply {
  contactId?: Types.ObjectId;
  companyId?: Types.ObjectId;
  campaignId?: Types.ObjectId;
  threadId?: string;
  messageId?: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  receivedAt: Date;
  classification: ReplyClassification;
  reviewedAt?: Date;
  suggestedReplyDraft?: string;
  isRead: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IEmailReplyDocument extends IEmailReply, Document {}

const EmailReplySchema = new Schema<IEmailReplyDocument>(
  {
    contactId: {
      type: Schema.Types.ObjectId,
      ref: 'OutreachContact',
      index: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      index: true,
    },
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      index: true,
    },
    threadId: {
      type: String,
      index: true,
    },
    messageId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    senderEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    recipientEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    classification: {
      type: String,
      enum: [
        'interested',
        'question',
        'meeting_request',
        'price_inquiry',
        'objection',
        'not_interested',
        'out_of_office',
        'unsubscribe',
        'unclear',
      ],
      default: 'unclear',
      index: true,
    },
    reviewedAt: {
      type: Date,
    },
    suggestedReplyDraft: {
      type: String,
      default: '',
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

EmailReplySchema.index({ companyId: 1, receivedAt: -1 });

export const EmailReply = model<IEmailReplyDocument>('EmailReply', EmailReplySchema);

