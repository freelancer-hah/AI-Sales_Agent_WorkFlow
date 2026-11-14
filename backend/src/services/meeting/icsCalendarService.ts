import { ISalesMeetingDocument } from '../../models/SalesMeeting.js';

export interface IIcsOptions {
  method?: 'REQUEST' | 'CANCEL';
  status?: 'CONFIRMED' | 'CANCELLED';
  includeAlarm?: boolean;
}

export class IcsCalendarService {
  /**
   * Formats a JavaScript Date object into RFC 5545 UTC timestamp: YYYYMMDDTHHMMSSZ
   */
  formatUtcTimestamp(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return (
      date.getUTCFullYear().toString() +
      pad(date.getUTCMonth() + 1) +
      pad(date.getUTCDate()) +
      'T' +
      pad(date.getUTCHours()) +
      pad(date.getUTCMinutes()) +
      pad(date.getUTCSeconds()) +
      'Z'
    );
  }

  /**
   * Escapes special characters according to RFC 5545 (backslashes, semicolons, commas, newlines)
   */
  escapeText(text: string): string {
    if (!text) return '';
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  }

  /**
   * Generates a fully RFC 5545 compliant .ics calendar string
   */
  generateIcs(meeting: ISalesMeetingDocument, options: IIcsOptions = {}): string {
    const method = options.method || (meeting.status === 'cancelled' ? 'CANCEL' : 'REQUEST');
    const status = options.status || (meeting.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED');

    const dtStamp = this.formatUtcTimestamp(new Date());
    const dtStart = this.formatUtcTimestamp(new Date(meeting.startTime));
    const dtEnd = this.formatUtcTimestamp(new Date(meeting.endTime));

    const host = meeting.attendees.find((a) => a.role === 'host') || {
      name: meeting.assignedAE || 'Cybells Sales Specialist',
      email: 'sales@cybells.com',
    };

    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Cybells AI//Sales Meeting Scheduler//EN',
      'CALSCALE:GREGORIAN',
      `METHOD:${method}`,
      'BEGIN:VEVENT',
      `UID:${meeting.icsUid}`,
      `SEQUENCE:${meeting.sequence || 0}`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${this.escapeText(meeting.title)}`,
      `DESCRIPTION:${this.escapeText(
        (meeting.description || '') +
          `\\n\\nJoin Google Meet: ${meeting.meetingUrl}\\n\\nOrganized by Cybells AI Automation.`
      )}`,
      `LOCATION:${this.escapeText(meeting.meetingUrl)}`,
      `ORGANIZER;CN="${this.escapeText(host.name)}":mailto:${host.email}`,
      `STATUS:${status}`,
    ];

    // Add attendees
    for (const att of meeting.attendees) {
      const partStat = att.role === 'host' ? 'ACCEPTED' : 'NEEDS-ACTION';
      const rsvp = att.role === 'host' ? 'FALSE' : 'TRUE';
      lines.push(
        `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=${partStat};RSVP=${rsvp};CN="${this.escapeText(
          att.name
        )}":mailto:${att.email}`
      );
    }

    // Optional 15-minute advance alarm
    if (options.includeAlarm !== false && status !== 'CANCELLED') {
      lines.push(
        'BEGIN:VALARM',
        'TRIGGER:-PT15M',
        'ACTION:DISPLAY',
        'DESCRIPTION:Reminder: Upcoming Cybells Discovery Call',
        'END:VALARM'
      );
    }

    lines.push('END:VEVENT', 'END:VCALENDAR');

    // RFC 5545 requires CRLF line endings
    return lines.join('\r\n') + '\r\n';
  }

  /**
   * Generates email attachment object ready for Nodemailer
   */
  generateAttachment(meeting: ISalesMeetingDocument, options: IIcsOptions = {}) {
    const icsContent = this.generateIcs(meeting, options);
    const method = options.method || (meeting.status === 'cancelled' ? 'CANCEL' : 'REQUEST');

    return {
      filename: 'invite.ics',
      content: Buffer.from(icsContent, 'utf-8'),
      contentType: `text/calendar; charset=utf-8; method=${method}`,
      headers: {
        'Content-Class': 'urn:content-classes:calendarmessage',
      },
    };
  }
}

export const icsCalendarService = new IcsCalendarService();

