import { Schema, model, Document } from 'mongoose';

export type EmailFramework =
  | 'problem_agitate_solve'
  | 'before_after_bridge'
  | 'short_executive'
  | 'custom';

export interface IEmailTemplate {
  name: string;
  subject: string;
  body: string;
  placeholders: string[];
  framework: EmailFramework;
  isDefault: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IEmailTemplateDocument extends IEmailTemplate, Document {}

const EmailTemplateSchema = new Schema<IEmailTemplateDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
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
    placeholders: {
      type: [String],
      default: [
        'companyName',
        'contactName',
        'jobTitle',
        'industry',
        'city',
        'automationOpportunity',
        'senderName',
      ],
    },
    framework: {
      type: String,
      enum: ['problem_agitate_solve', 'before_after_bridge', 'short_executive', 'custom'],
      default: 'problem_agitate_solve',
      index: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export const EmailTemplate = model<IEmailTemplateDocument>('EmailTemplate', EmailTemplateSchema);

