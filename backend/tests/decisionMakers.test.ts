import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../src/app.js';
import { Company } from '../src/models/Company.js';
import { scraperClient } from '../src/services/scraping/scraperClient.js';
import { searxngClient } from '../src/services/discovery/searxngClient.js';

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
  vi.restoreAllMocks();
});

describe('Milestone 4: Decision-Maker Discovery Engine', () => {
  describe('A. Data Model & Schema Validation', () => {
    it('should save multiple decision makers with required fields and valid confidence levels', async () => {
      const company = await Company.create({
        companyName: 'Apex Logistics Inc',
        website: 'https://apexlogistics.example.com',
        domain: 'apexlogistics.example.com',
        industry: 'Logistics',
        decisionMakers: [
          {
            fullName: 'Alexander Vance',
            jobTitle: 'Chief Executive Officer',
            professionalProfileUrl: 'https://linkedin.com/in/alex-vance-ceo',
            publicBusinessEmail: 'alex.vance@apexlogistics.example.com',
            evidence: 'Identified as Chief Executive Officer from official team directory',
            sourceUrl: 'https://apexlogistics.example.com/team',
            confidence: 'high',
            discoveryStatus: 'identified',
          },
          {
            fullName: 'Elena Rostova',
            jobTitle: 'Director of Operations',
            confidence: 'medium',
            discoveryStatus: 'identified',
          },
        ],
      });

      expect(company.decisionMakers.length).toBe(2);
      expect(company.decisionMakers[0].fullName).toBe('Alexander Vance');
      expect(company.decisionMakers[0].jobTitle).toBe('Chief Executive Officer');
      expect(company.decisionMakers[0].confidence).toBe('high');
      expect(company.decisionMakers[1].jobTitle).toBe('Director of Operations');
    });

    it('should reject invalid confidence levels', async () => {
      await expect(
        Company.create({
          companyName: 'Invalid DM Company',
          decisionMakers: [
            {
              fullName: 'John Doe',
              jobTitle: 'Founder',
              confidence: 'invalid_confidence' as any,
            },
          ],
        })
      ).rejects.toThrow();
    });
  });

  describe('B. GET /api/decision-makers & Filtering', () => {
    beforeEach(async () => {
      await Company.create([
        {
          companyName: 'Nova Health',
          industry: 'Healthcare',
          decisionMakers: [
            {
              fullName: 'Dr. Evelyn Reed',
              jobTitle: 'Chief Executive Officer',
              professionalProfileUrl: 'https://linkedin.com/in/dr-reed',
              confidence: 'high',
              discoveryStatus: 'identified',
            },
            {
              fullName: 'Marcus Brody',
              jobTitle: 'Operations Manager',
              confidence: 'medium',
              discoveryStatus: 'identified',
            },
          ],
        },
        {
          companyName: 'CyberPulse',
          industry: 'Technology',
          decisionMakers: [
            {
              fullName: 'Sarah Chen',
              jobTitle: 'Co-Founder & CTO',
              confidence: 'high',
              discoveryStatus: 'identified',
            },
            {
              fullName: 'David Miller',
              jobTitle: 'Sales Director',
              confidence: 'low',
              discoveryStatus: 'identified',
            },
          ],
        },
      ]);
    });

    it('should retrieve unwound list of decision-makers with pagination', async () => {
      const res = await request(app).get('/api/decision-makers?page=1&limit=10');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.decisionMakers.length).toBe(4);
      expect(res.body.data.pagination.total).toBe(4);
    });

    it('should filter decision-makers by search query (name or company)', async () => {
      const res = await request(app).get('/api/decision-makers?search=Chen');
      expect(res.status).toBe(200);
      expect(res.body.data.decisionMakers.length).toBe(1);
      expect(res.body.data.decisionMakers[0].fullName).toBe('Sarah Chen');
      expect(res.body.data.decisionMakers[0].companyName).toBe('CyberPulse');
    });

    it('should filter decision-makers by role/jobTitle', async () => {
      const res = await request(app).get('/api/decision-makers?jobTitle=Operations');
      expect(res.status).toBe(200);
      expect(res.body.data.decisionMakers.length).toBe(1);
      expect(res.body.data.decisionMakers[0].fullName).toBe('Marcus Brody');
    });

    it('should filter decision-makers by confidence level', async () => {
      const res = await request(app).get('/api/decision-makers?confidence=high');
      expect(res.status).toBe(200);
      expect(res.body.data.decisionMakers.length).toBe(2);
      expect(res.body.data.decisionMakers.map((dm: any) => dm.fullName)).toContain('Dr. Evelyn Reed');
      expect(res.body.data.decisionMakers.map((dm: any) => dm.fullName)).toContain('Sarah Chen');
    });
  });

  describe('C. GET /api/decision-makers/company/:id', () => {
    it('should return decision makers for a specific company', async () => {
      const company = await Company.create({
        companyName: 'Aero Dynamics',
        decisionMakers: [
          {
            fullName: 'Michael Scott',
            jobTitle: 'Managing Director',
            confidence: 'high',
          },
        ],
      });

      const res = await request(app).get(`/api/decision-makers/company/${company._id}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.companyName).toBe('Aero Dynamics');
      expect(res.body.data.decisionMakers.length).toBe(1);
      expect(res.body.data.decisionMakers[0].fullName).toBe('Michael Scott');
    });

    it('should return 404 for invalid company id', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app).get(`/api/decision-makers/company/${fakeId}`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('D. POST /api/companies/:id/decision-makers/discover', () => {
    it('should discover and persist decision makers, deduplicate existing names, and adjust lead score', async () => {
      const company = await Company.create({
        companyName: 'Quantum Computing Lab',
        website: 'https://quantumlab.example.com',
        domain: 'quantumlab.example.com',
        industry: 'Technology',
        leadScore: 50,
        decisionMakers: [
          {
            fullName: 'Existing Leader',
            jobTitle: 'Owner',
            confidence: 'medium',
          },
        ],
      });

      // Mock scraper client finding decision makers from website
      vi.spyOn(scraperClient, 'scrapeWebsite').mockResolvedValueOnce({
        url: 'https://quantumlab.example.com',
        services: ['Quantum Research'],
        products: [],
        emails: ['info@quantumlab.example.com'],
        phoneNumbers: [],
        sources: [],
        decisionMakers: [
          {
            fullName: 'Dr. Alice Martin',
            jobTitle: 'Chief Executive Officer',
            professionalProfileUrl: 'https://linkedin.com/in/alice-martin-ceo',
            publicBusinessEmail: 'alice@quantumlab.example.com',
            evidence: 'Dr. Alice Martin identified as CEO from official team page',
            sourceUrl: 'https://quantumlab.example.com/team',
            confidence: 'high',
            discoveryStatus: 'identified',
          },
          {
            fullName: 'Existing Leader', // Duplicate name: should be deduplicated!
            jobTitle: 'Owner',
            confidence: 'medium',
          },
        ],
      });

      // Mock SearXNG returning an additional decision maker
      vi.spyOn(searxngClient, 'searchDecisionMakers').mockResolvedValueOnce([
        {
          fullName: 'Brian O\'Connor',
          jobTitle: 'Head of Operations',
          evidence: 'Quantum Computing Lab Head of Operations Brian O\'Connor announced new initiative',
          sourceUrl: 'https://techpress.example.com/article123',
          confidence: 'medium',
        },
      ]);

      const res = await request(app).post(`/api/companies/${company._id}/decision-makers/discover`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.newlyDiscoveredCount).toBe(2); // Alice + Brian (Existing Leader deduplicated)

      const updated = await Company.findById(company._id);
      expect(updated?.decisionMakers.length).toBe(3);

      const names = updated?.decisionMakers.map((dm) => dm.fullName);
      expect(names).toContain('Existing Leader');
      expect(names).toContain('Dr. Alice Martin');
      expect(names).toContain('Brian O\'Connor');

      // Lead score should have increased
      expect(updated?.leadScore).toBeGreaterThan(50);
    });

    it('should return zero newly discovered when no decision-makers are found without hallucinating', async () => {
      const company = await Company.create({
        companyName: 'Secretive Corp',
        website: 'https://secretivecorp.example.com',
        domain: 'secretivecorp.example.com',
        industry: 'Finance',
        leadScore: 40,
        decisionMakers: [],
      });

      vi.spyOn(scraperClient, 'scrapeWebsite').mockResolvedValueOnce({
        url: 'https://secretivecorp.example.com',
        services: [],
        products: [],
        emails: [],
        phoneNumbers: [],
        sources: [],
        decisionMakers: [],
      });

      vi.spyOn(searxngClient, 'searchDecisionMakers').mockResolvedValueOnce([]);

      const res = await request(app).post(`/api/companies/${company._id}/decision-makers/discover`);
      expect(res.status).toBe(200);
      expect(res.body.data.newlyDiscoveredCount).toBe(0);
      expect(res.body.data.decisionMakers.length).toBe(0);
    });
  });
});

