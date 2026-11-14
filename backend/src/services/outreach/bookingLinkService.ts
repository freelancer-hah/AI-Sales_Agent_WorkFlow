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
    const baseUrl = (env.CAL_BASE_URL || 'https://cal.com').replace(/\/+$/, '');
    const closer = params.closerSlug || env.CAL_CLOSER_SLUG || 'abdulhannan-digitalsofts';
    const event = params.eventSlug !== undefined ? params.eventSlug : (env.CAL_EVENT_SLUG || '30min');

    const path = event ? `${closer}/${event}` : closer;
    const url = new URL(`${baseUrl}/${path}`);

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
    const closer = env.CAL_CLOSER_SLUG || 'abdulhannan-digitalsofts';
    const event = env.CAL_EVENT_SLUG || '30min';
    return {
      calOrigin: (env.CAL_BASE_URL || 'https://cal.com').replace(/\/+$/, ''),
      closerSlug: closer,
      eventSlug: event,
      defaultCalLink: event ? `${closer}/${event}` : closer,
    };
  }
}

export const bookingLinkService = new BookingLinkService();

