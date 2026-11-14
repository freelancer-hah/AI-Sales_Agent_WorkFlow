import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { OverpassClient, overpassClient } from '../src/services/discovery/overpassClient.js';
import { SearXNGClient, searxngClient } from '../src/services/discovery/searxngClient.js';
import { DiscoveryProcessor, discoveryProcessor } from '../src/services/discovery/discoveryProcessor.js';
import { DiscoveryOrchestrator } from '../src/services/discovery/discoveryOrchestrator.js';
import { Company } from '../src/models/Company.js';
import { SearchJob } from '../src/models/SearchJob.js';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

beforeEach(async () => {
  await Company.deleteMany({});
  await SearchJob.deleteMany({});
});

describe('Milestone 2: Overpass Client', () => {
  it('should build a valid Overpass QL query for a given city and industry', () => {
    const client = new OverpassClient();
    const query = client.buildQuery({
      city: 'Berlin',
      industry: 'Technology',
      limit: 25,
    });

    expect(query).toContain('[out:json]');
    expect(query).toContain('area["name"~"^Berlin$",i]->.searchArea;');
    expect(query).toContain('office');
    expect(query).toContain('out tags center 25;');
  });

  it('should parse raw Overpass response elements correctly', () => {
    const client = new OverpassClient();
    const mockOsmResponse = {
      elements: [
        {
          type: 'node',
          id: 10101,
          lat: 52.52,
          lon: 13.405,
          tags: {
            name: 'Kite Technologies GmbH',
            'contact:website': 'https://kitetech.example.com',
            'contact:phone': '+49 30 123456',
            'addr:street': 'Alexanderplatz',
            'addr:housenumber': '1',
            'addr:city': 'Berlin',
            office: 'it',
          },
        },
      ],
    };

    const parsed = (client as any).parseResponse(mockOsmResponse, { city: 'Berlin', country: 'Germany' });
    expect(parsed.length).toBe(1);
    expect(parsed[0].name).toBe('Kite Technologies GmbH');
    expect(parsed[0].website).toBe('https://kitetech.example.com/');
    expect(parsed[0].phone).toBe('+49 30 123456');
    expect(parsed[0].address).toContain('Alexanderplatz');
    expect(parsed[0].sourceUrl).toBe('https://www.openstreetmap.org/node/10101');
  });
});

describe('Milestone 2: SearXNG Client', () => {
  it('should generate relevant search queries for discovery', () => {
    const client = new SearXNGClient();
    const queries = client.generateQueries({
      industry: 'Manufacturing',
      keywords: ['industrial automation', 'robotics'],
      city: 'Detroit',
      country: 'United States',
    });

    expect(queries.length).toBeGreaterThan(0);
    expect(queries[0]).toContain('Manufacturing companies in Detroit United States official website');
    expect(queries[1]).toContain('industrial automation robotics businesses in Detroit United States');
  });

  it('should handle unreachable SearXNG service without throwing fatal errors', async () => {
    // Port 59999 is guaranteed unreachable
    const client = new SearXNGClient();
    (client as any).baseUrl = 'http://127.0.0.1:59999';

    const response = await client.search({
      industry: 'Technology',
      city: 'San Francisco',
    });

    expect(response.isAvailable).toBe(false);
    expect(response.errorMessage).toContain('SearXNG service is unreachable');
    expect(response.results).toEqual([]);
  });
});

describe('Milestone 2: Discovery Processor & Deduplication', () => {
  it('should clean company names from search engine titles', () => {
    const processor = new DiscoveryProcessor();
    expect(processor.cleanCompanyNameFromTitle('Apex Logistics Inc - Official Website | Global Freight')).toBe('Apex Logistics');
    expect(processor.cleanCompanyNameFromTitle('Welcome to Alpha Medical Devices : Innovative Care')).toBe('Alpha Medical Devices');
  });

  it('should merge results from Overpass and SearXNG for the same company', () => {
    const processor = new DiscoveryProcessor();

    const osmResults = [
      {
        osmId: 'node/999',
        name: 'Apex Solutions LLC',
        website: 'https://apexsolutions.example.com',
        phone: '+1-555-0100',
        address: '100 Main St',
        city: 'Austin',
        country: 'United States',
        category: 'it',
        sourceUrl: 'https://www.openstreetmap.org/node/999',
      },
    ];

    const searxngResults = [
      {
        title: 'Apex Solutions - Leading IT Consulting in Austin',
        url: 'https://apexsolutions.example.com/services',
        content: 'Apex Solutions provides enterprise cloud engineering and workflow automation.',
        domain: 'apexsolutions.example.com',
        engine: 'duckduckgo',
        sourceUrl: 'https://apexsolutions.example.com/services',
      },
    ];

    const processed = processor.process(osmResults, searxngResults, {
      industry: 'Technology',
      city: 'Austin',
      country: 'United States',
    });

    expect(processed.length).toBe(1);
    const comp = processed[0];
    expect(comp.domain).toBe('apexsolutions.example.com');
    expect(comp.phoneNumbers).toContain('+1-555-0100');
    expect(comp.description).toContain('cloud engineering');
    // Crucial: both sources must be recorded for provenance!
    expect(comp.sources.length).toBe(2);
    expect(comp.sources.some((s) => s.sourceType === 'osm')).toBe(true);
    expect(comp.sources.some((s) => s.sourceType === 'searxng')).toBe(true);
  });
});

describe('Milestone 2: Discovery Orchestrator Pipeline', () => {
  it('should execute search job and persist discovered companies into MongoDB', async () => {
    const job = await SearchJob.create({
      searchCriteria: {
        industry: 'Healthcare',
        city: 'Boston',
        country: 'United States',
        maxCompanies: 10,
      },
      status: 'queued',
      progress: 0,
      discoveredCount: 0,
      processedCount: 0,
      failedCount: 0,
      errors: [],
    });

    // Mock overpassClient.search to return 2 discovered companies
    const overpassSpy = vi.spyOn(overpassClient, 'search').mockResolvedValueOnce([
      {
        osmId: 'node/101',
        name: 'Boston MedTech Group',
        website: 'https://bostonmedtech.example.com',
        phone: '+1-617-555-0199',
        address: '500 Commonwealth Ave',
        city: 'Boston',
        country: 'United States',
        category: 'medical',
        sourceUrl: 'https://www.openstreetmap.org/node/101',
      },
      {
        osmId: 'node/102',
        name: 'Beacon Diagnostics',
        website: 'https://beacondiagnostics.example.com',
        phone: '+1-617-555-0188',
        address: '200 Boylston St',
        city: 'Boston',
        country: 'United States',
        category: 'clinic',
        sourceUrl: 'https://www.openstreetmap.org/node/102',
      },
    ]);

    // Mock searxngClient.search to return 1 company
    const searxngSpy = vi.spyOn(searxngClient, 'search').mockResolvedValueOnce({
      isAvailable: true,
      results: [
        {
          title: 'Boston MedTech Group - Official Website',
          url: 'https://bostonmedtech.example.com',
          content: 'Boston MedTech specializes in hospital robotics and clinical devices.',
          domain: 'bostonmedtech.example.com',
          engine: 'google',
          sourceUrl: 'https://bostonmedtech.example.com',
        },
      ],
    });

    const orchestrator = new DiscoveryOrchestrator();
    await orchestrator.executeJob(String(job._id));

    const updatedJob = await SearchJob.findById(job._id);
    expect(updatedJob?.status).toBe('completed');
    expect(updatedJob?.progress).toBe(100);
    expect(updatedJob?.discoveredCount).toBe(2);

    const companies = await Company.find({ city: 'Boston' });
    expect(companies.length).toBe(2);

    const medtech = await Company.findOne({ domain: 'bostonmedtech.example.com' });
    expect(medtech).not.toBeNull();
    expect(medtech?.sources.length).toBe(2); // Merged OSM + SearXNG
    expect(medtech?.companyName).toBe('Boston MedTech Group');

    overpassSpy.mockRestore();
    searxngSpy.mockRestore();
  });
});

