import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { normalizeDomain, normalizeUrl, cleanEmail, cleanPhoneNumber } from '../../utils/normalizer.js';

export interface GoogleMapsReview {
  author?: string;
  rating?: number;
  text?: string;
  publishAt?: string;
}

export interface GoogleMapsCompany {
  placeId?: string;
  name: string;
  category?: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  website?: string;
  emails?: string[];
  rating?: number;
  reviewsCount?: number;
  reviews?: GoogleMapsReview[];
  latitude?: number;
  longitude?: number;
  sourceUrl: string;
}

export interface GoogleMapsResponse {
  isAvailable: boolean;
  errorMessage?: string;
  results: GoogleMapsCompany[];
}

export interface GoogleMapsSearchParams {
  industry?: string;
  category?: string;
  keywords?: string[];
  city?: string;
  country?: string;
  limit?: number;
}

export class GoogleMapsClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = env.GMAPS_SCRAPER_API_URL || 'http://localhost:8080';
  }

  /**
   * Health check probing whether gosom/google-maps-scraper server is active
   */
  public async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(`${this.baseUrl}/api/v1/jobs`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      return res.status < 500;
    } catch {
      return false;
    }
  }

  /**
   * Formats search criteria into a natural search query for Google Maps
   * e.g., "restaurants in Faisalabad, Pakistan"
   */
  public buildQuery(params: GoogleMapsSearchParams): string {
    const parts: string[] = [];
    const mainSubject = params.industry || params.category || (params.keywords && params.keywords[0]) || 'Business';
    parts.push(mainSubject);

    const locationParts: string[] = [];
    if (params.city) locationParts.push(params.city);
    if (params.country) locationParts.push(params.country);

    if (locationParts.length > 0) {
      parts.push(`in ${locationParts.join(', ')}`);
    }

    return parts.join(' ').trim();
  }

  /**
   * Submits a scraping job to the gosom/google-maps-scraper REST API
   */
  public async search(params: GoogleMapsSearchParams): Promise<GoogleMapsResponse> {
    const query = this.buildQuery(params);
    const limit = Math.min(params.limit || 50, 100);

    logger.info(`GoogleMapsClient: Querying Google Maps for: "${query}" (limit: ${limit})`);

    const available = await this.isAvailable();
    if (!available) {
      logger.info(`GoogleMapsClient: Scraper server not running at ${this.baseUrl}. Will use secondary sources.`);
      return {
        isAvailable: false,
        errorMessage: `Google Maps scraper server is not reachable at ${this.baseUrl}`,
        results: [],
      };
    }

    try {
      // 1. Submit scraping job: POST /api/v1/jobs conforming to gosom OpenAPI schema
      const postController = new AbortController();
      const postTimeout = setTimeout(() => postController.abort(), 10000);

      const jobPayload = {
        name: `job_${Date.now()}`,
        keywords: [query],
        lang: 'en',
        depth: 1,
        max_time: 180,
        email: false,
      };

      const jobRes = await fetch(`${this.baseUrl}/api/v1/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobPayload),
        signal: postController.signal,
      });
      clearTimeout(postTimeout);

      if (!jobRes.ok) {
        const errText = await jobRes.text().catch(() => '');
        throw new Error(`Failed to submit job to Google Maps scraper: HTTP ${jobRes.status} (${errText})`);
      }

      const jobData: any = await jobRes.json();
      const jobId = jobData.id || jobData.ID || jobData.job_id || jobData.data?.id;

      if (!jobId) {
        if (Array.isArray(jobData) || Array.isArray(jobData.results)) {
          const rawItems = Array.isArray(jobData) ? jobData : jobData.results;
          return {
            isAvailable: true,
            results: this.normalizeResults(rawItems, params),
          };
        }
        throw new Error('Google Maps scraper did not return a job ID');
      }

      // 2. Poll job status until completed (up to 45s)
      const startTime = Date.now();
      const maxPollTime = 45000;
      let rawResults: any[] = [];

      while (Date.now() - startTime < maxPollTime) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const statusRes = await fetch(`${this.baseUrl}/api/v1/jobs/${jobId}`);
        if (!statusRes.ok) continue;

        const statusData: any = await statusRes.json();
        const status = (statusData.status || statusData.Status || statusData.state || '').toLowerCase();

        if (status === 'ok' || status === 'completed' || status === 'done' || status === 'finished') {
          // 3. Download results from /api/v1/jobs/{id}/download
          const downloadRes = await fetch(`${this.baseUrl}/api/v1/jobs/${jobId}/download`);
          if (downloadRes.ok) {
            const contentType = downloadRes.headers.get('content-type') || '';
            if (contentType.includes('json')) {
              const data: any = await downloadRes.json();
              rawResults = Array.isArray(data) ? data : data.results || data.data || [];
            } else {
              // Parse CSV formatted output returned by gosom scraper
              const csvText = await downloadRes.text();
              rawResults = this.parseCsv(csvText);
            }
          }
          break;
        } else if (status === 'failed' || status === 'error') {
          throw new Error(`Google Maps scraper job ${jobId} failed: ${statusData.error || 'Unknown error'}`);
        }
      }

      logger.info(`GoogleMapsClient: Successfully scraped ${rawResults.length} places for "${query}"`);

      return {
        isAvailable: true,
        results: this.normalizeResults(rawResults, params),
      };
    } catch (err: any) {
      logger.error('GoogleMapsClient: Search failed', err);
      return {
        isAvailable: true,
        errorMessage: err.message || 'Failed to scrape Google Maps',
        results: [],
      };
    }
  }

  /**
   * Parses RFC 4180 CSV with quotes, escaped quotes, and newlines into array of row objects
   */
  public parseCsv(text: string): Record<string, string>[] {
    if (!text || typeof text !== 'string') return [];
    const rows: string[][] = [];
    let row: string[] = [];
    let col = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (c === '"' && next === '"') {
          col += '"';
          i++;
        } else if (c === '"') {
          inQuotes = false;
        } else {
          col += c;
        }
      } else {
        if (c === '"') {
          inQuotes = true;
        } else if (c === ',') {
          row.push(col);
          col = '';
        } else if (c === '\n' || (c === '\r' && next === '\n')) {
          row.push(col);
          col = '';
          if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
            rows.push(row);
          }
          row = [];
          if (c === '\r') i++;
        } else {
          col += c;
        }
      }
    }

    if (col || row.length > 0) {
      row.push(col);
      rows.push(row);
    }

    if (rows.length < 2) return [];

    const headers = rows[0].map((h) => h.trim());
    return rows.slice(1).map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h] = r[idx] ?? '';
      });
      return obj;
    });
  }

  /**
   * Normalizes raw items from gosom scraper into standardized GoogleMapsCompany records
   */
  public normalizeResults(rawItems: any[], params: GoogleMapsSearchParams): GoogleMapsCompany[] {
    const list: GoogleMapsCompany[] = [];

    for (const item of rawItems) {
      const name = (item.title || item.name || '').trim();
      if (!name) continue;

      let website = '';
      if (item.website && typeof item.website === 'string' && item.website.startsWith('http')) {
        website = normalizeUrl(item.website);
      }

      const rawPhone = item.phone || item.phone_number || '';
      const address = item.address || item.complete_address || item.full_address || '';
      const category = item.category || item.main_category || params.industry || params.category || '';
      const rating = typeof item.rating === 'number'
        ? item.rating
        : parseFloat(item.review_rating || item.rating) || undefined;
      const reviewsCount = typeof item.reviews === 'number'
        ? item.reviews
        : parseInt(item.review_count || item.reviews || item.reviews_count, 10) || undefined;

      const emails: string[] = [];
      if (Array.isArray(item.emails)) {
        for (const e of item.emails) {
          const cleaned = cleanEmail(e);
          if (cleaned) emails.push(cleaned);
        }
      } else if (typeof item.email === 'string') {
        const cleaned = cleanEmail(item.email);
        if (cleaned) emails.push(cleaned);
      } else if (typeof item.emails === 'string' && item.emails.trim()) {
        const parts = item.emails.split(/[,;\s]+/);
        for (const p of parts) {
          const cleaned = cleanEmail(p);
          if (cleaned) emails.push(cleaned);
        }
      }

      // Extract extended Google Maps reviews for customer sentiment and pain points
      let rawReviews: any[] = [];
      const reviewsData = item.user_reviews || item.user_reviews_extended || item.reviews_data || item.reviews;
      if (Array.isArray(reviewsData)) {
        rawReviews = reviewsData;
      } else if (typeof reviewsData === 'string' && reviewsData.trim().startsWith('[')) {
        try {
          rawReviews = JSON.parse(reviewsData);
        } catch {
          rawReviews = [];
        }
      }

      const reviews: GoogleMapsReview[] = [];
      if (Array.isArray(rawReviews)) {
        for (const r of rawReviews) {
          if (!r) continue;
          const text = (r.Description || r.description || r.text_original || r.text || r.comment || r.snippet || '').trim();
          const rRating = typeof r.Rating === 'number'
            ? r.Rating
            : typeof r.rating === 'number'
            ? r.rating
            : parseFloat(r.Rating || r.rating) || undefined;
          const author = (r.Name || r.name || r.author || r.user_name || r.reviewer || '').trim();
          const publishAt = (r.When || r.when || r.published_at || r.publish_at || r.date || r.time || '').trim();

          if (text || rRating) {
            reviews.push({ author, rating: rRating, text, publishAt });
          }
        }
      }

      const lat = typeof item.latitude === 'number' ? item.latitude : parseFloat(item.latitude) || undefined;
      const lon = typeof item.longitude === 'number' ? item.longitude : parseFloat(item.longitude) || undefined;

      list.push({
        placeId: item.place_id || item.cid || undefined,
        name,
        category,
        address,
        city: params.city || '',
        country: params.country || '',
        phone: rawPhone ? cleanPhoneNumber(rawPhone) : undefined,
        website: website || undefined,
        emails,
        rating,
        reviewsCount: reviewsCount || (reviews.length > 0 ? reviews.length : undefined),
        reviews: reviews.length > 0 ? reviews : undefined,
        latitude: lat,
        longitude: lon,
        sourceUrl: item.link || item.url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ' ' + (params.city || ''))}`,
      });
    }

    return list;
  }
}

export const googleMapsClient = new GoogleMapsClient();
