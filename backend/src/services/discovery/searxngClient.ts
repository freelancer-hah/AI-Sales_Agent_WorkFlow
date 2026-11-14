import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { normalizeDomain, normalizeUrl } from '../../utils/normalizer.js';

export interface SearXNGResult {
  title: string;
  url: string;
  content: string;
  domain: string;
  engine: string;
  sourceUrl: string;
}

export interface SearXNGResponse {
  isAvailable: boolean;
  errorMessage?: string;
  results: SearXNGResult[];
}

export interface SearXNGSearchParams {
  industry?: string;
  category?: string;
  keywords?: string[];
  city?: string;
  country?: string;
  limit?: number;
}

// Directory and aggregator domains that are not official company websites
const AGGREGATOR_DOMAINS = new Set([
  'wikipedia.org',
  'en.wikipedia.org',
  'yelp.com',
  'yellowpages.com',
  'tripadvisor.com',
  'facebook.com',
  'twitter.com',
  'x.com',
  'instagram.com',
  'linkedin.com',
  'youtube.com',
  'reddit.com',
  'bloomberg.com',
  'crunchbase.com',
  'glassdoor.com',
  'indeed.com',
  'bbb.org',
  'dnb.com',
  'zoominfo.com',
  'clutch.co',
  'g2.com',
]);

export class SearXNGClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = env.SEARXNG_URL || 'http://localhost:8080';
  }

  public generateQueries(params: SearXNGSearchParams): string[] {
    const queries: string[] = [];
    const location = [params.city, params.country].filter(Boolean).join(' ');

    if (params.category && location) {
      queries.push(`${params.category} in ${location} official website`);
    }

    if (params.industry && location) {
      queries.push(`${params.industry} companies in ${location} official website`);
    } else if (params.industry) {
      queries.push(`${params.industry} company official website`);
    }

    if (params.keywords && params.keywords.length > 0) {
      const kw = params.keywords.slice(0, 3).join(' ');
      if (location) {
        queries.push(`${kw} businesses in ${location}`);
      } else {
        queries.push(`${kw} company website`);
      }
    }

    if (queries.length === 0 && location) {
      queries.push(`businesses in ${location}`);
    }

    return queries;
  }

  public async search(params: SearXNGSearchParams): Promise<SearXNGResponse> {
    const queries = this.generateQueries(params);
    if (queries.length === 0) {
      return { isAvailable: true, results: [] };
    }

    const allResults: SearXNGResult[] = [];
    const seenDomains = new Set<string>();

    for (const query of queries) {
      try {
        const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&format=json&categories=general`;
        logger.info(`Querying SearXNG: ${query}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(searchUrl, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'User-Agent': 'SalesAgentLeadFinder/1.0',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`SearXNG responded with HTTP ${response.status}: ${response.statusText}`);
        }

        const data: any = await response.json();
        const rawResults = data.results || [];

        for (const item of rawResults) {
          if (!item.url || !item.title) continue;

          const domain = normalizeDomain(item.url);
          if (!domain || AGGREGATOR_DOMAINS.has(domain)) continue;

          // Discard sub-pages that are clearly privacy policies, terms, or generic blogs
          if (seenDomains.has(domain)) continue;
          seenDomains.add(domain);

          allResults.push({
            title: item.title.replace(/<\/?[^>]+(>|$)/g, '').trim(),
            url: normalizeUrl(item.url),
            content: (item.content || '').replace(/<\/?[^>]+(>|$)/g, '').trim(),
            domain,
            engine: item.engine || 'searxng',
            sourceUrl: item.url,
          });

          if (allResults.length >= (params.limit || 25)) break;
        }
      } catch (err: any) {
        logger.warn(`SearXNG query "${query}" failed: ${err.message}`);
        // If connection refused, mark unavailable
        if (err.cause?.code === 'ECONNREFUSED' || err.message.includes('fetch failed')) {
          return {
            isAvailable: false,
            errorMessage: `SearXNG service is unreachable at ${this.baseUrl}. Please verify your SearXNG container is running (e.g., docker run -d -p 8080:8080 searxng/searxng).`,
            results: allResults,
          };
        }
      }
    }

    return {
      isAvailable: true,
      results: allResults,
    };
  }

  public async searchDecisionMakers(companyName: string, domain?: string): Promise<Array<{
    fullName: string;
    jobTitle: string;
    evidence: string;
    sourceUrl: string;
    professionalProfileUrl?: string;
    confidence: 'high' | 'medium' | 'low';
  }>> {
    const query = `"${companyName}" (CEO OR Founder OR "Managing Director" OR "President" OR "Operations Manager" OR "Sales Director")`;
    const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&format=json&categories=general`;
    const discovered: Array<{
      fullName: string;
      jobTitle: string;
      evidence: string;
      sourceUrl: string;
      professionalProfileUrl?: string;
      confidence: 'high' | 'medium' | 'low';
    }> = [];

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: { Accept: 'application/json', 'User-Agent': 'SalesAgentLeadFinder/1.0' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) return [];

      const data: any = await response.json();
      const rawResults = data.results || [];

      const roleRegex = /\b(Chief\s+Executive\s+Officer|CEO|Co-Founder|Founder|Managing\s+Director|President|Owner|Operations\s+Manager|Head\s+of\s+Operations|COO|Sales\s+Director|Head\s+of\s+Sales|Business\s+Development\s+Director)\b/i;
      const nameRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/;
      const blacklist = new Set([
        'our team', 'leadership team', 'about us', 'contact us', 'join us',
        'read more', 'learn more', 'press release', 'news article', 'view bio',
        'terms of service', 'privacy policy'
      ]);

      const seenNames = new Set<string>();

      for (const item of rawResults) {
        const text = `${item.title || ''} ${item.content || ''}`.replace(/<\/?[^>]+(>|$)/g, ' ');
        const roleMatch = text.match(roleRegex);
        if (!roleMatch) continue;

        const role = roleMatch[0];
        // Pattern 1: [Name], [Role]
        const pat1 = new RegExp(`\\b([A-Z][a-z]+(?:\\s+[A-Z][a-z]+){1,2})\\b\\s*[,–\\-|:]\\s*(?:is\\s+(?:the\\s+)?)?${role}`, 'i');
        // Pattern 2: [Role] [Name] or [Role]: [Name]
        const pat2 = new RegExp(`${role}\\s*(?:at|of|[,–\\-|:])?\\s*\\b([A-Z][a-z]+(?:\\s+[A-Z][a-z]+){1,2})\\b`, 'i');

        let nameMatch = text.match(pat1);
        if (!nameMatch) nameMatch = text.match(pat2);

        if (nameMatch && nameMatch[1]) {
          const rawName = nameMatch[1].trim();
          const lowerName = rawName.toLowerCase();
          if (blacklist.has(lowerName) || seenNames.has(lowerName)) continue;

          // Check if profile URL
          let profileUrl = '';
          if (item.url && item.url.includes('linkedin.com/in/')) {
            profileUrl = item.url;
          }

          seenNames.add(lowerName);
          discovered.push({
            fullName: rawName,
            jobTitle: role,
            evidence: text.slice(0, 180).trim(),
            sourceUrl: item.url,
            professionalProfileUrl: profileUrl,
            confidence: profileUrl ? 'high' : 'medium',
          });
        }
      }
    } catch {
      // If SearXNG is unavailable or times out, fail gracefully
    }

    return discovered;
  }
}

export const searxngClient = new SearXNGClient();

