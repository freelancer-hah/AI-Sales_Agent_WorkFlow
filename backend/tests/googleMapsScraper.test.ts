import { describe, it, expect, vi, beforeEach } from 'vitest';
import { googleMapsClient, GoogleMapsCompany } from '../src/services/discovery/googleMapsClient.js';
import { discoveryProcessor } from '../src/services/discovery/discoveryProcessor.js';

describe('Phase 1: Google Maps Scraper Integration (gosom/google-maps-scraper)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Query Builder (googleMapsClient.buildQuery)', () => {
    it('builds natural search query with industry, city and country', () => {
      const query = googleMapsClient.buildQuery({
        industry: 'Textile Exporters',
        city: 'Faisalabad',
        country: 'Pakistan',
      });
      expect(query).toBe('Textile Exporters in Faisalabad, Pakistan');
    });

    it('falls back to category or keywords when industry is omitted', () => {
      const query = googleMapsClient.buildQuery({
        category: 'Dental Clinics',
        city: 'Dubai',
        country: 'United Arab Emirates',
      });
      expect(query).toBe('Dental Clinics in Dubai, United Arab Emirates');
    });

    it('handles query with city only', () => {
      const query = googleMapsClient.buildQuery({
        industry: 'Software Houses',
        city: 'Lahore',
      });
      expect(query).toBe('Software Houses in Lahore');
    });
  });

  describe('2. Result Normalization (googleMapsClient.normalizeResults)', () => {
    it('normalizes raw scraper JSON items into structured GoogleMapsCompany records', () => {
      const rawScraperItems = [
        {
          title: 'Nishat Mills Limited',
          category: 'Textile mill',
          address: 'Nishatabad, Faisalabad, Punjab, Pakistan',
          phone: '+92 41 8754472',
          website: 'https://www.nishatmillsltd.com',
          rating: 4.4,
          reviews: 142,
          emails: ['info@nishatmillsltd.com'],
          latitude: 31.4503,
          longitude: 73.1348,
          link: 'https://www.google.com/maps/place/Nishat+Mills',
        },
        {
          name: 'Interloop Industrial Park',
          main_category: 'Hosiery Manufacturer',
          full_address: 'Faisalabad, Pakistan',
          phone_number: '041-111-222-333',
          website: 'http://interloop-pk.com',
          rating: '4.8',
          reviews_count: '230',
          email: 'sales@interloop-pk.com',
        },
      ];

      const results = googleMapsClient.normalizeResults(rawScraperItems, {
        city: 'Faisalabad',
        country: 'Pakistan',
        industry: 'Textile',
      });

      expect(results).toHaveLength(2);

      // Record 1
      expect(results[0].name).toBe('Nishat Mills Limited');
      expect(results[0].website).toBe('https://www.nishatmillsltd.com/');
      expect(results[0].phone).toBe('+92 41 8754472');
      expect(results[0].rating).toBe(4.4);
      expect(results[0].reviewsCount).toBe(142);
      expect(results[0].emails).toContain('info@nishatmillsltd.com');

      // Record 2
      expect(results[1].name).toBe('Interloop Industrial Park');
      expect(results[1].website).toBe('http://interloop-pk.com/');
      expect(results[1].rating).toBe(4.8);
      expect(results[1].reviewsCount).toBe(230);
      expect(results[1].emails).toContain('sales@interloop-pk.com');
    });

    it('gracefully skips items without a business name', () => {
      const rawScraperItems = [{ title: '' }, { category: 'Shop' }];
      const results = googleMapsClient.normalizeResults(rawScraperItems, { city: 'Lahore' });
      expect(results).toHaveLength(0);
    });
  });

  describe('3. Resilience & Graceful Fallback (googleMapsClient.isAvailable)', () => {
    it('returns false gracefully when scraper server is unreachable without crashing', async () => {
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
      const available = await googleMapsClient.isAvailable();
      expect(available).toBe(false);
    });

    it('returns empty results with clean error message when scraper service is offline', async () => {
      vi.spyOn(googleMapsClient, 'isAvailable').mockResolvedValue(false);
      const res = await googleMapsClient.search({
        industry: 'Textile',
        city: 'Faisalabad',
      });
      expect(res.isAvailable).toBe(false);
      expect(res.results).toHaveLength(0);
      expect(res.errorMessage).toContain('not reachable');
    });
  });

  describe('4. Discovery Processor Ingestion & Priority (discoveryProcessor)', () => {
    it('ingests Google Maps companies as Tier-1 sources with high lead score and merges duplicates', () => {
      const gmapsResults: GoogleMapsCompany[] = [
        {
          name: 'Nishat Mills Limited',
          category: 'Textile Mill',
          address: 'Nishatabad, Faisalabad',
          city: 'Faisalabad',
          country: 'Pakistan',
          phone: '+92418754472',
          website: 'https://www.nishatmillsltd.com',
          emails: ['info@nishatmillsltd.com'],
          rating: 4.4,
          reviewsCount: 142,
          sourceUrl: 'https://www.google.com/maps/place/Nishat',
        },
      ];

      const overpassResults = [
        {
          osmId: 'node/123456',
          name: 'Nishat Mills Ltd',
          website: 'https://www.nishatmillsltd.com',
          sourceUrl: 'https://www.openstreetmap.org/node/123456',
        },
      ];

      const searxngResults = [
        {
          title: 'Nishat Mills Official Homepage',
          url: 'https://www.nishatmillsltd.com',
          content: 'Nishat Mills Limited is a premier composite textile mill.',
          domain: 'nishatmillsltd.com',
          engine: 'google',
          sourceUrl: 'https://searxng.local/search?q=nishat',
        },
      ];

      const processed = discoveryProcessor.process(
        overpassResults as any,
        searxngResults as any,
        {
          industry: 'Textile',
          city: 'Faisalabad',
          country: 'Pakistan',
        },
        gmapsResults
      );

      // Must deduplicate by domain / normalized name into a single verified company
      expect(processed).toHaveLength(1);
      const company = processed[0];
      expect(company.companyName).toBe('Nishat Mills Limited');
      expect(company.domain).toBe('nishatmillsltd.com');
      expect(company.phoneNumbers).toContain('+92418754472');
      expect(company.emails).toContain('info@nishatmillsltd.com');
      // Sources from Google Maps, OSM, and SearXNG should be merged!
      expect(company.sources.length).toBeGreaterThanOrEqual(2);
      expect(company.sources.some((s) => s.sourceType === 'google_maps')).toBe(true);
      expect(company.leadScore).toBeGreaterThanOrEqual(65);
    });
  });
});
