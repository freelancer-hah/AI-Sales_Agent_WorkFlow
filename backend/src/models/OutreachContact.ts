import { Schema, model, Document, Types } from 'mongoose';

export type ContactValidationStatus =
  | 'format_valid'
  | 'format_invalid'
  | 'unverified'
  | 'verified'
  | 'risky'
  | 'bounced';

export type ContactOutreachStatus =
  | 'new'
  | 'selected'
  | 'ready'
  | 'pending_approval'
  | 'contacted'
  | 'replied'
  | 'interested'
  | 'qualifying'
  | 'qualified'
  | 'disqualified'
  | 'not_interested'
  | 'bounced'
  | 'unsubscribed'
  | 'converted'
  | 'meeting_scheduled'
  | 'suppressed';

export interface ISuppressionStatus {
  isSuppressed: boolean;
  reason?: string;
  suppressedAt?: Date;
}

export interface IOutreachContact {
  companyId: Types.ObjectId;
  decisionMakerId?: Types.ObjectId;
  email: string;
  normalizedEmail: string;
  emailSourceUrl: string;
  contactName: string;
  jobTitle: string;
  validationStatus: ContactValidationStatus;
  outreachStatus: ContactOutreachStatus;
  suppressionStatus: ISuppressionStatus;
  lastContactedAt?: Date;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IOutreachContactDocument extends IOutreachContact, Document {}

const SuppressionStatusSchema = new Schema<ISuppressionStatus>(
  {
    isSuppressed: { type: Boolean, default: false },
    reason: { type: String, default: '' },
    suppressedAt: { type: Date },
  },
  { _id: false }
);

const OutreachContactSchema = new Schema<IOutreachContactDocument>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    decisionMakerId: {
      type: Schema.Types.ObjectId,
      ref: 'DecisionMaker',
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    normalizedEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    emailSourceUrl: {
      type: String,
      default: '',
      trim: true,
    },
    contactName: {
      type: String,
      default: '',
      trim: true,
    },
    jobTitle: {
      type: String,
      default: '',
      trim: true,
    },
    validationStatus: {
      type: String,
      enum: ['format_valid', 'format_invalid', 'unverified', 'verified', 'risky', 'bounced'],
      default: 'unverified',
      index: true,
    },
    outreachStatus: {
      type: String,
      enum: [
        'new',
        'selected',
        'ready',
        'pending_approval',
        'contacted',
        'replied',
        'interested',
        'qualifying',
        'qualified',
        'disqualified',
        'not_interested',
        'bounced',
        'unsubscribed',
        'converted',
        'meeting_scheduled',
        'suppressed',
      ],
      default: 'new',
      index: true,
    },
    suppressionStatus: {
      type: SuppressionStatusSchema,
      default: () => ({ isSuppressed: false }),
    },
    lastContactedAt: {
      type: Date,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate contacts for the same email in a company
OutreachContactSchema.pre('validate', function (next) {
  if (this.email && !this.normalizedEmail) {
    this.normalizedEmail = this.email.toLowerCase().trim();
  }
  next();
});

OutreachContactSchema.index({ normalizedEmail: 1, companyId: 1 }, { unique: true });
OutreachContactSchema.index({ companyId: 1, outreachStatus: 1 });
OutreachContactSchema.index({ 'suppressionStatus.isSuppressed': 1 });

export const OutreachContact = model<IOutreachContactDocument>(
  'OutreachContact',
  OutreachContactSchema
);

