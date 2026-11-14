import { OverpassCompany } from './overpassClient.js';
import { SearXNGResult } from './searxngClient.js';
import { GoogleMapsCompany } from './googleMapsClient.js';
import { ISource } from '../../models/Source.js';
import { normalizeDomain, normalizeCompanyName, normalizeUrl, cleanEmail, cleanPhoneNumber } from '../../utils/normalizer.js';
import { isSafePublicUrl } from '../../utils/urlValidator.js';
import { logger } from '../../config/logger.js';

export interface ProcessedCompanyDiscovery {
  companyName: string;
  normalizedName: string;
  website: string;
  domain: string;
  industry: string;
  category: string;
  description: string;
  country: string;
  region: string;
  city: string;
  address: string;
  phoneNumbers: string[];
  emails: string[];
  googleRating?: number;
  googleReviewsCount?: number;
  reviews?: Array<{
    author?: string;
    rating?: number;
    text?: string;
    publishAt?: string;
  }>;
  companySize: 'Small: 1–50 employees' | 'Medium: 51–250 employees' | 'Large: 251–1000 employees' | 'Enterprise: 1000+ employees' | 'Unknown';
  sources: ISource[];
  discoveryStatus: 'discovered';
  scrapingStatus: 'pending';
  analysisStatus: 'pending';
  leadScore: number;
}

export class DiscoveryProcessor {
  /**
   * Cleans title string from search engines into a candidate company name.
   * e.g., "Acme Inc - Official Website | Quality Products" -> "Acme Inc"
   */
  public cleanCompanyNameFromTitle(title: string): string {
    if (!title) return '';
    let name = title;
    // Split by common separators: |, -, :, •, —
    const parts = name.split(/[|\-:•—–]/);
    if (parts.length > 0 && parts[0].trim().length >= 2) {
      name = parts[0].trim();
    }
    // Remove "Home", "Welcome to", "Official Website", and trailing corporate abbreviations
    name = name
      .replace(/^(welcome\s+to\s+|home\s+of\s+|about\s+)/i, '')
      .replace(/\s+(official\s+website|homepage)$/i, '')
      .replace(/\s+(inc\.?|llc\.?|corp\.?|ltd\.?)$/i, '')
      .trim();

    return name || title.trim();
  }

  public process(
    overpassResults: OverpassCompany[],
    searxngResults: SearXNGResult[],
    criteria: {
      industry?: string;
      category?: string;
      country?: string;
      region?: string;
      city?: string;
      companySize?: string;
    },
    googleMapsResults: GoogleMapsCompany[] = []
  ): ProcessedCompanyDiscovery[] {
    const domainMap = new Map<string, ProcessedCompanyDiscovery>();
    const nameMap = new Map<string, ProcessedCompanyDiscovery>();

    // 1. Process Google Maps results (Tier-1 Highest confidence for active verified B2B businesses)
    for (const gmap of googleMapsResults) {
      const cleanName = gmap.name.trim();
      const normName = normalizeCompanyName(cleanName);
      if (!normName) continue;

      let website = '';
      let domain = '';
      if (gmap.website) {
        const safeCheck = isSafePublicUrl(gmap.website);
        if (safeCheck.isValid) {
          website = normalizeUrl(gmap.website);
          domain = normalizeDomain(website);
        }
      }

      const sources: ISource[] = [
        {
          sourceUrl: gmap.sourceUrl,
          sourceType: 'google_maps',
          extractedField: 'business_entity',
          supportingText: `Google Maps verified listing for "${cleanName}" (${gmap.rating ? gmap.rating + '★' : 'unrated'}, ${gmap.reviewsCount || 0} reviews) in ${gmap.city || criteria.city || 'unspecified'}.`,
          fetchedAt: new Date(),
        },
      ];

      if (gmap.reviews && gmap.reviews.length > 0) {
        sources.push({
          sourceUrl: gmap.sourceUrl,
          sourceType: 'google_maps',
          extractedField: 'customer_reviews',
          supportingText: `Extracted ${gmap.reviews.length} customer reviews from Google Maps for empirical pain points and reputation analysis.`,
          fetchedAt: new Date(),
        });
      }

      const phoneNumbers = gmap.phone ? [cleanPhoneNumber(gmap.phone)].filter(Boolean) : [];
      const emails = (gmap.emails || []).map(cleanEmail).filter(Boolean);

      const company: ProcessedCompanyDiscovery = {
        companyName: cleanName,
        normalizedName: normName,
        website,
        domain,
        industry: criteria.industry || gmap.category || 'Other',
        category: criteria.category || gmap.category || '',
        description: `Verified Google Maps business entity in ${gmap.city || criteria.city || ''}, ${gmap.country || criteria.country || ''}.`,
        country: gmap.country || criteria.country || '',
        region: criteria.region || '',
        city: gmap.city || criteria.city || '',
        address: gmap.address || '',
        phoneNumbers,
        emails,
        googleRating: gmap.rating,
        googleReviewsCount: gmap.reviewsCount || (gmap.reviews ? gmap.reviews.length : undefined),
        reviews: gmap.reviews,
        companySize: (criteria.companySize as any) || 'Unknown',
        sources,
        discoveryStatus: 'discovered',
        scrapingStatus: 'pending',
        analysisStatus: 'pending',
        leadScore: website ? 65 : 45, // High baseline score for Google Maps businesses
      };

      if (domain) {
        domainMap.set(domain, company);
      }
      nameMap.set(normName, company);
    }

    // 2. Process Overpass results (Merges or adds companies)
    for (const osm of overpassResults) {
      const cleanName = osm.name.trim();
      const normName = normalizeCompanyName(cleanName);
      if (!normName) continue;

      let website = '';
      let domain = '';
      if (osm.website) {
        const safeCheck = isSafePublicUrl(osm.website);
        if (safeCheck.isValid) {
          website = normalizeUrl(osm.website);
          domain = normalizeDomain(website);
        }
      }

      const sourceRecord: ISource = {
        sourceUrl: osm.sourceUrl,
        sourceType: 'osm',
        extractedField: 'business_entity',
        supportingText: `OpenStreetMap entry ${osm.osmId} categorized as ${osm.category || 'business'} in ${osm.city || criteria.city || 'unspecified'}.`,
        fetchedAt: new Date(),
      };

      const existing = (domain ? domainMap.get(domain) : undefined) || nameMap.get(normName);
      if (existing) {
        existing.sources.push(sourceRecord);
        if (!existing.phoneNumbers.length && osm.phone) {
          existing.phoneNumbers.push(cleanPhoneNumber(osm.phone));
        }
        if (!existing.website && website) {
          existing.website = website;
          existing.domain = domain;
        }
        existing.leadScore = Math.min(existing.leadScore + 15, 80);
        continue;
      }

      const phoneNumbers = osm.phone ? [cleanPhoneNumber(osm.phone)].filter(Boolean) : [];
      const emails = osm.email ? [cleanEmail(osm.email)].filter(Boolean) : [];

      const company: ProcessedCompanyDiscovery = {
        companyName: cleanName,
        normalizedName: normName,
        website,
        domain,
        industry: criteria.industry || osm.category || 'Other',
        category: criteria.category || osm.category || '',
        description: `Discovered business entity via OpenStreetMap in ${osm.city || criteria.city || ''}, ${osm.country || criteria.country || ''}.`,
        country: osm.country || criteria.country || '',
        region: criteria.region || '',
        city: osm.city || criteria.city || '',
        address: osm.address || '',
        phoneNumbers,
        emails,
        companySize: (criteria.companySize as any) || 'Unknown',
        sources: [sourceRecord],
        discoveryStatus: 'discovered',
        scrapingStatus: 'pending',
        analysisStatus: 'pending',
        leadScore: website ? 50 : 30, // Initial base relevance
      };

      if (domain) {
        domainMap.set(domain, company);
      }
      nameMap.set(normName, company);
    }

    // 2. Process SearXNG results (Merges or adds new companies found via search)
    for (const sx of searxngResults) {
      const safeCheck = isSafePublicUrl(sx.url);
      if (!safeCheck.isValid) continue;

      const domain = sx.domain;
      const cleanName = this.cleanCompanyNameFromTitle(sx.title);
      const normName = normalizeCompanyName(cleanName);

      const sourceRecord: ISource = {
        sourceUrl: sx.sourceUrl,
        sourceType: 'searxng',
        extractedField: 'website_meta',
        supportingText: sx.content ? `SearXNG snippet: "${sx.content}"` : `SearXNG organic search result from ${sx.engine}.`,
        fetchedAt: new Date(),
      };

      // Check if this domain or normalized name was already found via OSM
      const existing = domainMap.get(domain) || (normName ? nameMap.get(normName) : undefined);

      if (existing) {
        // Merge records! Add SearXNG source, update description if richer
        existing.sources.push(sourceRecord);
        if (!existing.website) {
          existing.website = sx.url;
          existing.domain = domain;
        }
        if (sx.content && sx.content.length > existing.description.length) {
          existing.description = sx.content;
        }
        // Boost score for dual-source verification
        existing.leadScore = Math.min(existing.leadScore + 20, 75);
      } else {
        // New company discovered strictly via SearXNG
        const newCompany: ProcessedCompanyDiscovery = {
          companyName: cleanName || domain,
          normalizedName: normName || domain,
          website: sx.url,
          domain,
          industry: criteria.industry || 'Other',
          category: criteria.category || '',
          description: sx.content || `Official website discovered via web search for ${cleanName}.`,
          country: criteria.country || '',
          region: criteria.region || '',
          city: criteria.city || '',
          address: '',
          phoneNumbers: [],
          emails: [],
          companySize: (criteria.companySize as any) || 'Unknown',
          sources: [sourceRecord],
          discoveryStatus: 'discovered',
          scrapingStatus: 'pending',
          analysisStatus: 'pending',
          leadScore: 45,
        };

        domainMap.set(domain, newCompany);
        if (normName) nameMap.set(normName, newCompany);
      }
    }

    // Combine distinct records (prioritize records with official domain/website)
    const combined = Array.from(domainMap.values());

    // Also include OSM companies that might not have had a website tag yet
    for (const comp of nameMap.values()) {
      if (!comp.domain && !combined.includes(comp)) {
        combined.push(comp);
      }
    }

    // Sort: verified websites first, then highest leadScore
    combined.sort((a, b) => {
      if (Boolean(a.website) !== Boolean(b.website)) {
        return a.website ? -1 : 1;
      }
      return b.leadScore - a.leadScore;
    });

    logger.info(`Discovery processing complete: ${combined.length} distinct companies processed`, {
      fromOverpass: overpassResults.length,
      fromSearxng: searxngResults.length,
      distinctCombined: combined.length,
    });

    return combined;
  }
}

export const discoveryProcessor = new DiscoveryProcessor();
