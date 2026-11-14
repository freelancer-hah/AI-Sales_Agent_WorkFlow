import { env } from '../../config/env.js';

export interface BookingLinkParams {
  name?: string;
  email?: string;
  companyName?: string;
  notes?: string;
  eventSlug?: string;
  closerSlug?: string;
}

/**
 * Service to generate personalized Cal.diy booking URLs for cold outreach & CRM interactions
 */
export class BookingLinkService {
  /**
   * Generates a fully qualified Cal.diy URL with pre-filled name, email, and company notes
   */
  public generatePersonalizedUrl(params: BookingLinkParams = {}): string {
    const baseUrl = (env.CAL_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const closer = params.closerSlug || env.CAL_CLOSER_SLUG || 'hafiz';
    const event = params.eventSlug || env.CAL_EVENT_SLUG || '30min';

    const url = new URL(`${baseUrl}/${closer}/${event}`);

    if (params.name?.trim()) {
      url.searchParams.set('name', params.name.trim());
    }
    if (params.email?.trim()) {
      url.searchParams.set('email', params.email.trim());
    }

    const noteParts: string[] = [];
    if (params.companyName?.trim()) {
      noteParts.push(`Company: ${params.companyName.trim()}`);
    }
    if (params.notes?.trim()) {
      noteParts.push(params.notes.trim());
    }
    if (noteParts.length > 0) {
      url.searchParams.set('notes', noteParts.join(' | '));
    }

    return url.toString();
  }

  /**
   * Returns base Cal configuration for frontend embeds
   */
  public getEmbedConfig() {
    return {
      calOrigin: (env.CAL_BASE_URL || 'http://localhost:3000').replace(/\/+$/, ''),
      closerSlug: env.CAL_CLOSER_SLUG || 'hafiz',
      eventSlug: env.CAL_EVENT_SLUG || '30min',
      defaultCalLink: `${env.CAL_CLOSER_SLUG || 'hafiz'}/${env.CAL_EVENT_SLUG || '30min'}`,
    };
  }
}

export const bookingLinkService = new BookingLinkService();

