import { Schema, model, Document, Types } from 'mongoose';

export type MeetingType = 'discovery_call' | 'demo' | 'technical_deep_dive';

export type MeetingStatus =
  | 'proposed'
  | 'confirmed'
  | 'rescheduled'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type MeetingLocationType = 'google_meet' | 'zoom' | 'phone' | 'custom';

export type AttendeeRole = 'host' | 'prospect' | 'stakeholder';
export type AttendeeStatus = 'accepted' | 'declined' | 'tentative' | 'needs_action';

export interface IMeetingAttendee {
  name: string;
  email: string;
  role: AttendeeRole;
  status: AttendeeStatus;
}

export interface IMeetingOutcome {
  outcome: 'deal_in_progress' | 'follow_up_needed' | 'closed_won' | 'closed_lost';
  notes?: string;
  loggedAt?: Date;
}

export interface ISalesMeeting {
  companyId: Types.ObjectId;
  contactId: Types.ObjectId;
  qualificationId?: Types.ObjectId;
  title: string;
  description?: string;
  meetingType: MeetingType;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  timezone: string;
  status: MeetingStatus;
  locationType: MeetingLocationType;
  meetingUrl: string;
  icsUid: string;
  sequence: number;
  attendees: IMeetingAttendee[];
  assignedAE: string;
  executiveDossier?: string;
  prospectNotes?: string;
  cancellationReason?: string;
  rescheduleReason?: string;
  meetingOutcome?: IMeetingOutcome;
  remindersSent?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ISalesMeetingDocument extends ISalesMeeting, Document {}

const MeetingAttendeeSchema = new Schema<IMeetingAttendee>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    role: {
      type: String,
      enum: ['host', 'prospect', 'stakeholder'],
      default: 'prospect',
    },
    status: {
      type: String,
      enum: ['accepted', 'declined', 'tentative', 'needs_action'],
      default: 'needs_action',
    },
  },
  { _id: false }
);

const MeetingOutcomeSchema = new Schema<IMeetingOutcome>(
  {
    outcome: {
      type: String,
      enum: ['deal_in_progress', 'follow_up_needed', 'closed_won', 'closed_lost'],
      required: true,
    },
    notes: { type: String, default: '' },
    loggedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const SalesMeetingSchema = new Schema<ISalesMeetingDocument>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    contactId: {
      type: Schema.Types.ObjectId,
      ref: 'OutreachContact',
      required: true,
      index: true,
    },
    qualificationId: {
      type: Schema.Types.ObjectId,
      ref: 'LeadQualification',
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      default: 'Cybells AI Automation — Discovery Meeting',
    },
    description: {
      type: String,
      default: 'Exploratory discovery call to discuss AI document automation and operational workflow solutions with Cybells.',
    },
    meetingType: {
      type: String,
      enum: ['discovery_call', 'demo', 'technical_deep_dive'],
      default: 'discovery_call',
      index: true,
    },
    startTime: {
      type: Date,
      required: true,
      index: true,
    },
    endTime: {
      type: Date,
      required: true,
      index: true,
    },
    durationMinutes: {
      type: Number,
      default: 30,
      min: 15,
      max: 120,
    },
    timezone: {
      type: String,
      default: 'Asia/Karachi',
      trim: true,
    },
    status: {
      type: String,
      enum: ['proposed', 'confirmed', 'rescheduled', 'completed', 'cancelled', 'no_show'],
      default: 'proposed',
      index: true,
    },
    locationType: {
      type: String,
      enum: ['google_meet', 'zoom', 'phone', 'custom'],
      default: 'google_meet',
    },
    meetingUrl: {
      type: String,
      required: true,
      trim: true,
    },
    icsUid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    sequence: {
      type: Number,
      default: 0,
      min: 0,
    },
    attendees: {
      type: [MeetingAttendeeSchema],
      default: [],
    },
    assignedAE: {
      type: String,
      default: 'Cybells Sales Specialist',
      trim: true,
    },
    executiveDossier: {
      type: String,
      default: '',
    },
    prospectNotes: {
      type: String,
      default: '',
    },
    cancellationReason: {
      type: String,
      default: '',
    },
    rescheduleReason: {
      type: String,
      default: '',
    },
    meetingOutcome: {
      type: MeetingOutcomeSchema,
    },
    remindersSent: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

SalesMeetingSchema.index({ startTime: 1, endTime: 1 });
SalesMeetingSchema.index({ companyId: 1, contactId: 1 });

export const SalesMeeting = model<ISalesMeetingDocument>('SalesMeeting', SalesMeetingSchema);

