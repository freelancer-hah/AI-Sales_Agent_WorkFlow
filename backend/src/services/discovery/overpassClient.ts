import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { normalizeUrl } from '../../utils/normalizer.js';

export interface OverpassCompany {
  osmId: string;
  name: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  country?: string;
  category?: string;
  coordinates?: [number, number];
  sourceUrl: string;
}

export interface OverpassQueryParams {
  industry?: string;
  keywords?: string[];
  city?: string;
  country?: string;
  limit?: number;
}

const OVERPASS_ENDPOINTS = [
  env.OVERPASS_API_URL || 'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

// In-memory cache for recent Overpass searches & geocodes
const queryCache = new Map<string, { timestamp: number; data: OverpassCompany[] }>();
const geocodeCache = new Map<string, { lat: number; lon: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export class OverpassClient {
  public async geocodeLocation(city?: string, country?: string): Promise<{ lat: number; lon: number } | null> {
    const locString = [city, country].filter(Boolean).join(', ');
    if (!locString) return null;

    if (geocodeCache.has(locString)) {
      return geocodeCache.get(locString)!;
    }

    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locString)}&format=json&limit=1`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(url, {
        headers: { 'User-Agent': 'SalesAgentLeadFinder/1.0 (OSM B2B Lead Engine)' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data: any = await res.json();
        if (Array.isArray(data) && data.length > 0 && data[0].lat && data[0].lon) {
          const coords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
          geocodeCache.set(locString, coords);
          return coords;
        }
      }
    } catch (err: any) {
      logger.debug(`Nominatim geocoding failed for "${locString}": ${err.message}. Falling back to area query.`);
    }

    return null;
  }

  private getTagFilters(industry?: string, keywords?: string[]): string[] {
    const ind = (industry || '').toLowerCase();
    const filters: string[] = [];

    if (ind.includes('tech') || ind.includes('software') || ind.includes('it')) {
      filters.push('["office"~"it|company|software|telecommunication|coworking"]');
      filters.push('["office"]');
      filters.push('["craft"~"electronics"]');
    } else if (ind.includes('manufactur') || ind.includes('industrial')) {
      filters.push('["industrial"~"factory|manufacturing"]');
      filters.push('["craft"]');
      filters.push('["man_made"~"works"]');
    } else if (ind.includes('health') || ind.includes('medical')) {
      filters.push('["amenity"~"hospital|clinic|doctors|dentist|pharmacy"]');
      filters.push('["healthcare"]');
    } else if (ind.includes('estate') || ind.includes('property')) {
      filters.push('["office"~"estate_agent|property_management"]');
    } else if (ind.includes('logistic') || ind.includes('freight') || ind.includes('transport')) {
      filters.push('["office"~"logistics|freight|courier"]');
      filters.push('["industrial"~"warehouse|logistics"]');
    } else if (ind.includes('construct') || ind.includes('build')) {
      filters.push('["craft"~"builder|carpenter|construction|electrician|plumber"]');
      filters.push('["office"~"architect|engineer|construction"]');
    } else if (ind.includes('retail') || ind.includes('e-commerce') || ind.includes('shop')) {
      filters.push('["shop"]');
      filters.push('["office"~"wholesale|logistics"]');
    } else if (ind.includes('finance') || ind.includes('bank') || ind.includes('insurance')) {
      filters.push('["office"~"financial|accountant|tax_advisor|insurance|financial_advisor"]');
    } else if (ind.includes('hospitality') || ind.includes('hotel') || ind.includes('restaurant')) {
      filters.push('["tourism"~"hotel|guest_house|motel"]');
      filters.push('["amenity"~"restaurant|cafe"]');
    } else if (ind.includes('auto')) {
      filters.push('["shop"~"car|car_repair|car_parts"]');
      filters.push('["craft"~"car_repair"]');
    } else if (ind.includes('food') || ind.includes('beverage')) {
      filters.push('["craft"~"bakery|brewery|confectionery|distillery"]');
      filters.push('["shop"~"food|supermarket|deli"]');
    } else if (ind.includes('service') || ind.includes('consult')) {
      filters.push('["office"~"consulting|lawyer|advertising|employment_agency|accountant"]');
    } else {
      // General commercial / office query
      filters.push('["office"]');
      filters.push('["industrial"]');
      filters.push('["commercial"]');
    }

    if (keywords && keywords.length > 0) {
      const kwPattern = keywords
        .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');
      filters.push(`["name"~"${kwPattern}",i]`);
    }

    return filters;
  }

  public buildQuery(params: OverpassQueryParams, coords?: { lat: number; lon: number } | null): string {
    const { city, country, limit = 25 } = params;
    const tagFilters = this.getTagFilters(params.industry, params.keywords);
    const maxResults = Math.min(limit, 100);

    // If geocoded coordinates exist, use high-speed radius search (around:15000m)
    if (coords) {
      const statements = tagFilters
        .slice(0, 4)
        .map((f) => `  node${f}(around:15000, ${coords.lat}, ${coords.lon})["name"];\n  way${f}(around:15000, ${coords.lat}, ${coords.lon})["name"];`)
        .join('\n');

      return `[out:json][timeout:25];
(
${statements}
);
out tags center ${maxResults};`;
    }

    // Fallback: area name query
    const cleanLocation = (city || country || '').replace(/[.*+?^${}()|[\]\\]/g, '');

    if (!cleanLocation) {
      const statements = tagFilters
        .slice(0, 4)
        .map((f) => `  node${f}["website"]["name"];\n  way${f}["website"]["name"];`)
        .join('\n');
      return `[out:json][timeout:25];\n(\n${statements}\n);\nout tags center ${maxResults};`;
    }

    const statements = tagFilters
      .slice(0, 5)
      .map((f) => `  node${f}(area.searchArea)["name"];\n  way${f}(area.searchArea)["name"];`)
      .join('\n');

    return `[out:json][timeout:25];
area["name"~"^${cleanLocation}$",i]->.searchArea;
(
${statements}
);
out tags center ${maxResults};`;
  }

  public async search(params: OverpassQueryParams): Promise<OverpassCompany[]> {
    const cacheKey = JSON.stringify(params);
    const cached = queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      logger.info('Returning Overpass results from cache', { count: cached.data.length });
      return cached.data;
    }

    // Geocode location for high-speed query
    const coords = await this.geocodeLocation(params.city, params.country);
    const query = this.buildQuery(params, coords);
    logger.info('Executing Overpass discovery query', {
      location: params.city || params.country,
      industry: params.industry,
      geocoded: Boolean(coords),
    });

    let lastError: Error | null = null;

    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'SalesAgentLeadFinder/1.0 (B2B Lead Discovery Agent)',
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Overpass API responded with HTTP ${response.status}: ${response.statusText}`);
        }

        const data: any = await response.json();
        const companies = this.parseResponse(data, params);

        queryCache.set(cacheKey, { timestamp: Date.now(), data: companies });
        logger.info(`Overpass discovery succeeded via ${endpoint}`, { count: companies.length });
        return companies;
      } catch (err: any) {
        lastError = err;
        logger.warn(`Overpass query failed on endpoint ${endpoint}: ${err.message}. Trying next mirror...`);
      }
    }

    logger.error('All Overpass API endpoints failed or timed out', lastError);
    return [];
  }

  private parseResponse(data: any, params: OverpassQueryParams): OverpassCompany[] {
    if (!data || !Array.isArray(data.elements)) {
      return [];
    }

    const results: OverpassCompany[] = [];
    const seenNames = new Set<string>();

    for (const element of data.elements) {
      const tags = element.tags || {};
      const rawName = tags.name || tags['name:en'] || tags['brand'] || tags['operator'];
      if (!rawName) continue;

      const trimmedName = rawName.trim();
      const lowerName = trimmedName.toLowerCase();
      if (seenNames.has(lowerName)) continue;
      seenNames.add(lowerName);

      const rawWebsite = tags.website || tags['contact:website'] || tags.url || '';
      const website = rawWebsite ? normalizeUrl(rawWebsite) : undefined;

      const phone = tags.phone || tags['contact:phone'] || tags['contact:mobile'] || undefined;
      const email = tags.email || tags['contact:email'] || undefined;

      const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
      const address = [street, tags['addr:postcode']].filter(Boolean).join(', ') || undefined;
      const city = tags['addr:city'] || params.city || undefined;
      const country = tags['addr:country'] || params.country || undefined;

      const category =
        tags.office ||
        tags.craft ||
        tags.industrial ||
        tags.shop ||
        tags.amenity ||
        tags.healthcare ||
        params.industry ||
        'Business';

      const lat = element.lat || element.center?.lat;
      const lon = element.lon || element.center?.lon;
      const coordinates: [number, number] | undefined =
        lat !== undefined && lon !== undefined ? [lat, lon] : undefined;

      const osmId = `${element.type}/${element.id}`;
      const sourceUrl = `https://www.openstreetmap.org/${element.type}/${element.id}`;

      results.push({
        osmId,
        name: trimmedName,
        website,
        phone,
        email,
        address,
        city,
        country,
        category,
        coordinates,
        sourceUrl,
      });

      if (results.length >= (params.limit || 25)) {
        break;
      }
    }

    return results;
  }
}

export const overpassClient = new OverpassClient();
