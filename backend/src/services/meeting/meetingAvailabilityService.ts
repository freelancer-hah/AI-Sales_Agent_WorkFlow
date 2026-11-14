import { HostAvailability, IHostAvailabilityDocument, DEFAULT_WEEKLY_SCHEDULE } from '../../models/HostAvailability.js';
import { SalesMeeting } from '../../models/SalesMeeting.js';
import { logger } from '../../config/logger.js';

export interface IAvailableSlot {
  start: string;          // ISO String
  end: string;            // ISO String
  dateStr: string;        // YYYY-MM-DD
  timeStr: string;        // "09:00 - 09:30"
  durationMinutes: number;
  timezone: string;
}

export interface ISlotQueryOptions {
  startDate?: Date | string;
  endDate?: Date | string;
  timezone?: string;
  durationMinutes?: number;
}

export class MeetingAvailabilityService {
  /**
   * Retrieves or initializes default host availability settings
   */
  async getHostAvailability(hostUserId: string = 'default_host'): Promise<IHostAvailabilityDocument> {
    let availability = await HostAvailability.findOne({ hostUserId });
    if (!availability) {
      availability = await HostAvailability.create({
        hostUserId,
        hostName: 'Cybells Sales Specialist',
        hostEmail: 'sales@cybells.com',
        timezone: 'Asia/Karachi',
        weeklySchedule: DEFAULT_WEEKLY_SCHEDULE,
        meetingDurationMinutes: 30,
        bufferMinutes: 15,
        maxMeetingsPerDay: 6,
        blackoutDates: [],
      });
      logger.info(`Initialized default host availability for host: ${hostUserId}`);
    }
    return availability;
  }

  /**
   * Updates host availability settings
   */
  async updateHostAvailability(
    updateData: Partial<IHostAvailabilityDocument>,
    hostUserId: string = 'default_host'
  ): Promise<IHostAvailabilityDocument> {
    const availability = await HostAvailability.findOneAndUpdate(
      { hostUserId },
      { $set: updateData },
      { new: true, upsert: true, runValidators: true }
    );
    logger.info(`Updated host availability for host: ${hostUserId}`);
    return availability;
  }

  /**
   * Calculates all available meeting slots in a date range, respecting:
   * 1. Weekly schedule (working hours and enabled days)
   * 2. Buffer times between meetings (before & after)
   * 3. Existing active meetings (confirmed, rescheduled, proposed)
   * 4. Past time slots (auto-pruned)
   * 5. Blackout dates and daily max meeting caps
   */
  async getAvailableSlots(options: ISlotQueryOptions = {}): Promise<IAvailableSlot[]> {
    const availability = await this.getHostAvailability();

    const now = new Date();
    // Default search window: from tomorrow to next 7 business days if not provided
    const startDate = options.startDate ? new Date(options.startDate) : new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const endDate = options.endDate
      ? new Date(options.endDate)
      : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    const slotDuration = options.durationMinutes || availability.meetingDurationMinutes || 30;
    const buffer = availability.bufferMinutes ?? 15;
    const maxPerDay = availability.maxMeetingsPerDay || 6;
    const tz = options.timezone || availability.timezone || 'Asia/Karachi';

    // Fetch all active meetings in this window
    const existingMeetings = await SalesMeeting.find({
      status: { $in: ['confirmed', 'rescheduled', 'proposed'] },
      startTime: { $lt: endDate },
      endTime: { $gt: startDate },
    }).lean();

    const availableSlots: IAvailableSlot[] = [];

    // Iterate through each day in the range
    const currentDay = new Date(startDate);
    currentDay.setHours(0, 0, 0, 0);

    const endLimit = new Date(endDate);
    endLimit.setHours(23, 59, 59, 999);

    while (currentDay <= endLimit) {
      const dayOfWeek = currentDay.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
      const dayConfig = availability.weeklySchedule.find((s) => s.dayOfWeek === dayOfWeek);

      // Check if day is enabled in schedule
      if (dayConfig && dayConfig.isEnabled) {
        // Check if date is in blackoutDates
        const isBlackout = availability.blackoutDates.some((bDate) => {
          const bd = new Date(bDate);
          return (
            bd.getFullYear() === currentDay.getFullYear() &&
            bd.getMonth() === currentDay.getMonth() &&
            bd.getDate() === currentDay.getDate()
          );
        });

        if (!isBlackout) {
          // Check existing meetings on this specific day
          const dayStartBoundary = new Date(currentDay);
          dayStartBoundary.setHours(0, 0, 0, 0);
          const dayEndBoundary = new Date(currentDay);
          dayEndBoundary.setHours(23, 59, 59, 999);

          const dayMeetings = existingMeetings.filter(
            (m) => m.startTime >= dayStartBoundary && m.startTime <= dayEndBoundary
          );

          if (dayMeetings.length < maxPerDay) {
            // Parse working hours
            const [startHour, startMin] = (dayConfig.startTime || '09:00').split(':').map(Number);
            const [endHour, endMin] = (dayConfig.endTime || '18:00').split(':').map(Number);

            const dayStartTime = new Date(currentDay);
            dayStartTime.setHours(startHour, startMin, 0, 0);

            const dayEndTime = new Date(currentDay);
            dayEndTime.setHours(endHour, endMin, 0, 0);

            let slotCursor = new Date(dayStartTime);

            while (slotCursor.getTime() + slotDuration * 60 * 1000 <= dayEndTime.getTime()) {
              const slotStart = new Date(slotCursor);
              const slotEnd = new Date(slotCursor.getTime() + slotDuration * 60 * 1000);

              // 1. Must be in the future
              if (slotStart.getTime() > now.getTime()) {
                // 2. Check overlap with any existing meeting + buffer
                const hasConflict = dayMeetings.some((m) => {
                  const mStart = new Date(m.startTime).getTime() - buffer * 60 * 1000;
                  const mEnd = new Date(m.endTime).getTime() + buffer * 60 * 1000;
                  return slotStart.getTime() < mEnd && slotEnd.getTime() > mStart;
                });

                if (!hasConflict) {
                  const dateStr = currentDay.toISOString().split('T')[0];
                  const pad = (n: number) => n.toString().padStart(2, '0');
                  const sTimeStr = `${pad(slotStart.getHours())}:${pad(slotStart.getMinutes())}`;
                  const eTimeStr = `${pad(slotEnd.getHours())}:${pad(slotEnd.getMinutes())}`;

                  availableSlots.push({
                    start: slotStart.toISOString(),
                    end: slotEnd.toISOString(),
                    dateStr,
                    timeStr: `${sTimeStr} - ${eTimeStr}`,
                    durationMinutes: slotDuration,
                    timezone: tz,
                  });
                }
              }

              // Step forward by slot duration
              slotCursor = new Date(slotCursor.getTime() + slotDuration * 60 * 1000);
            }
          }
        }
      }

      // Advance to next day
      currentDay.setDate(currentDay.getDate() + 1);
    }

    return availableSlots;
  }

  /**
   * Validates if a proposed time slot is strictly available
   */
  async validateSlot(
    startTime: Date,
    endTime: Date,
    excludeMeetingId?: string
  ): Promise<{ isValid: boolean; conflictReason?: string }> {
    const now = new Date();
    if (startTime.getTime() <= now.getTime()) {
      return { isValid: false, conflictReason: 'Requested time slot is in the past.' };
    }

    if (endTime.getTime() <= startTime.getTime()) {
      return { isValid: false, conflictReason: 'End time must be after start time.' };
    }

    const availability = await this.getHostAvailability();
    const dayOfWeek = startTime.getDay();
    const dayConfig = availability.weeklySchedule.find((s) => s.dayOfWeek === dayOfWeek);

    if (!dayConfig || !dayConfig.isEnabled) {
      return { isValid: false, conflictReason: 'Host does not accept meetings on this day of the week.' };
    }

    // Check blackout
    const isBlackout = availability.blackoutDates.some((bDate) => {
      const bd = new Date(bDate);
      return (
        bd.getFullYear() === startTime.getFullYear() &&
        bd.getMonth() === startTime.getMonth() &&
        bd.getDate() === startTime.getDate()
      );
    });

    if (isBlackout) {
      return { isValid: false, conflictReason: 'The requested date is marked as unavailable/holiday.' };
    }

    // Check conflict with other meetings
    const buffer = availability.bufferMinutes ?? 15;
    const bufferMs = buffer * 60 * 1000;

    const query: any = {
      status: { $in: ['confirmed', 'rescheduled', 'proposed'] },
      startTime: { $lt: new Date(endTime.getTime() + bufferMs) },
      endTime: { $gt: new Date(startTime.getTime() - bufferMs) },
    };

    if (excludeMeetingId) {
      query._id = { $ne: excludeMeetingId };
    }

    const conflictingMeetings = await SalesMeeting.find(query).lean();

    if (conflictingMeetings.length > 0) {
      return {
        isValid: false,
        conflictReason: `Slot conflicts with an existing meeting or required ${buffer}-minute buffer.`,
      };
    }

    return { isValid: true };
  }
}

export const meetingAvailabilityService = new MeetingAvailabilityService();

