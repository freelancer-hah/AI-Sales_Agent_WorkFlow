import { Schema, model, Document } from 'mongoose';

export interface IDaySchedule {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  isEnabled: boolean;
  startTime: string; // e.g. "09:00"
  endTime: string;   // e.g. "18:00"
}

export interface IHostAvailability {
  hostUserId: string;
  hostName: string;
  hostEmail: string;
  timezone: string;
  defaultMeetingUrl?: string; // Persistent Google Meet, Zoom, or Teams URL
  weeklySchedule: IDaySchedule[];
  meetingDurationMinutes: number; // default: 30
  bufferMinutes: number;          // default: 15
  maxMeetingsPerDay: number;      // default: 6
  blackoutDates: Date[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IHostAvailabilityDocument extends IHostAvailability, Document {}

const DayScheduleSchema = new Schema<IDaySchedule>(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    isEnabled: { type: Boolean, default: true },
    startTime: { type: String, default: '09:00' },
    endTime: { type: String, default: '18:00' },
  },
  { _id: false }
);

export const DEFAULT_WEEKLY_SCHEDULE: IDaySchedule[] = [
  { dayOfWeek: 0, isEnabled: false, startTime: '09:00', endTime: '18:00' }, // Sunday
  { dayOfWeek: 1, isEnabled: true, startTime: '09:00', endTime: '18:00' },  // Monday
  { dayOfWeek: 2, isEnabled: true, startTime: '09:00', endTime: '18:00' },  // Tuesday
  { dayOfWeek: 3, isEnabled: true, startTime: '09:00', endTime: '18:00' },  // Wednesday
  { dayOfWeek: 4, isEnabled: true, startTime: '09:00', endTime: '18:00' },  // Thursday
  { dayOfWeek: 5, isEnabled: true, startTime: '09:00', endTime: '18:00' },  // Friday
  { dayOfWeek: 6, isEnabled: false, startTime: '09:00', endTime: '18:00' }, // Saturday
];

const HostAvailabilitySchema = new Schema<IHostAvailabilityDocument>(
  {
    hostUserId: {
      type: String,
      required: true,
      unique: true,
      default: 'default_host',
      index: true,
    },
    hostName: {
      type: String,
      default: 'Cybells Sales Specialist',
      trim: true,
    },
    hostEmail: {
      type: String,
      default: 'sales@cybells.com',
      trim: true,
      lowercase: true,
    },
    timezone: {
      type: String,
      default: 'Asia/Karachi',
      trim: true,
    },
    defaultMeetingUrl: {
      type: String,
      default: '',
      trim: true,
    },
    weeklySchedule: {
      type: [DayScheduleSchema],
      default: () => DEFAULT_WEEKLY_SCHEDULE,
    },
    meetingDurationMinutes: {
      type: Number,
      default: 30,
      min: 15,
      max: 120,
    },
    bufferMinutes: {
      type: Number,
      default: 15,
      min: 0,
      max: 60,
    },
    maxMeetingsPerDay: {
      type: Number,
      default: 6,
      min: 1,
      max: 20,
    },
    blackoutDates: {
      type: [Date],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export const HostAvailability = model<IHostAvailabilityDocument>(
  'HostAvailability',
  HostAvailabilitySchema
);

