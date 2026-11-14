import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../src/app.js';
import { Company } from '../src/models/Company.js';
import { leadScoringService } from '../src/services/scoring/leadScoringService.js';

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
});

describe('Milestone 6: Lead Relevance Scoring & Ranking System', () => {
  describe('A. Deterministic Lead Scoring Service Calculations', () => {
    it('should assign high score (80+) and "high" tier to companies with strong automation fit and verified data', () => {
      const result = leadScoringService.calculateScore({
        companyName: 'Apex Precision Manufacturing',
        industry: 'Manufacturing',
        companySize: 'Enterprise: 1000+ employees',
        emails: ['inbound@apexprecision.example.com'],
        phoneNumbers: ['+1-555-0199'],
        website: 'https://apexprecision.example.com',
        decisionMakers: [
          {
            fullName: 'Alexander Vance',
            jobTitle: 'Chief Executive Officer',
            professionalProfileUrl: 'https://linkedin.com/in/alex-vance',
            confidence: 'high',
            discoveryStatus: 'identified',
          } as any,
        ],
        aiAnalysis: {
          problems: [],
          opportunities: [
            {
              title: 'Predictive Quality Assurance Vision Agent',
              businessProblem: 'Manual defect inspection in assembly',
              recommendedSolution: 'Automated defect detection',
              howItWorks: 'Real-time camera feed analysis',
              benefits: '90% defect catch rate',
              whyNeeded: 'Precision manufacturing line',
              supportingEvidence: 'Assembly operations',
              potentialImpact: 'high',
              confidence: 'high',
            },
            {
              title: 'Robotic CNC Automated Dispatch',
              businessProblem: 'Machine downtime',
              recommendedSolution: 'Automated task queueing',
              howItWorks: 'Real-time telemetry queue',
              benefits: '35% throughput increase',
              whyNeeded: 'High capacity plant',
              supportingEvidence: 'CNC machinery',
              potentialImpact: 'high',
              confidence: 'high',
            },
            {
              title: 'Automated Supply Chain Invoicing',
              businessProblem: 'Supplier invoice delay',
              recommendedSolution: 'Document OCR',
              howItWorks: 'Extract line items',
              benefits: 'Instant approval workflow',
              whyNeeded: 'Global supplier network',
              supportingEvidence: 'Stated supply lines',
              potentialImpact: 'high',
              confidence: 'high',
            },
          ],
          leadScore: 0,
          scoreExplanation: '',
          evidence: [],
          missingInformation: [],
        },
      });

      expect(result.totalScore).toBeGreaterThanOrEqual(80);
      expect(result.totalScore).toBeLessThanOrEqual(100);
      expect(result.tier).toBe('high');
      expect(result.breakdown.industryAlignment).toBe(18); // High automation industry
      expect(result.breakdown.operationalComplexity).toBe(20); // Enterprise 1000+
      expect(result.breakdown.opportunityQuality).toBe(28); // 3+ high-impact opportunities
      expect(result.breakdown.decisionMakerAvailability).toBe(15); // C-level with LinkedIn profile
      expect(result.breakdown.contactability).toBe(15); // Email + Phone verified
    });

    it('should assign medium score (50–79) and "medium" tier to mid-market companies with moderate contacts', () => {
      const result = leadScoringService.calculateScore({
        companyName: 'Beacon Legal Partners',
        industry: 'Professional Services',
        companySize: 'Medium: 51–250 employees',
        emails: ['contact@beaconlegal.example.com'],
        phoneNumbers: [],
        website: 'https://beaconlegal.example.com',
        decisionMakers: [
          {
            fullName: 'Rachel Green',
            jobTitle: 'Managing Director',
            confidence: 'medium',
            discoveryStatus: 'identified',
          } as any,
        ],
        aiAnalysis: {
          problems: [],
          opportunities: [
            {
              title: 'Automated Contract Review Assistant',
              businessProblem: 'Manual NDA review overhead',
              recommendedSolution: 'Document analysis model',
              howItWorks: 'Highlights clause anomalies',
              benefits: 'Saves 4 hours per lawyer daily',
              whyNeeded: 'High volume corporate contracts',
              supportingEvidence: 'Commercial legal practice',
              potentialImpact: 'high',
              confidence: 'medium',
            },
          ],
          leadScore: 0,
          scoreExplanation: '',
          evidence: [],
          missingInformation: [],
        },
      });

      expect(result.totalScore).toBeGreaterThanOrEqual(50);
      expect(result.totalScore).toBeLessThan(80);
      expect(result.tier).toBe('medium');
    });

    it('should assign low score (<50) and "low" tier to companies with minimal data, unverified size, and no decision-makers', () => {
      const result = leadScoringService.calculateScore({
        companyName: 'Corner Coffee Shop',
        industry: 'Food and Beverage',
        companySize: 'Unknown',
        emails: [],
        phoneNumbers: [],
        website: 'https://cornercoffee.example.com',
        decisionMakers: [],
      });

      expect(result.totalScore).toBeLessThan(50);
      expect(result.tier).toBe('low');
      expect(result.breakdown.decisionMakerAvailability).toBe(0);
      expect(result.breakdown.contactability).toBe(4); // Website only
    });
  });

  describe('B. POST /api/companies/:id/re-score Endpoint', () => {
    it('should recalculate and persist lead score and breakdown in MongoDB', async () => {
      const company = await Company.create({
        companyName: 'Atlas Freight Systems',
        industry: 'Logistics',
        companySize: 'Large: 251–1000 employees',
        website: 'https://atlasfreight.example.com',
        domain: 'atlasfreight.example.com',
        emails: ['dispatch@atlasfreight.example.com'],
        phoneNumbers: ['+1-555-8822'],
        leadScore: 10, // Outdated initial score
        decisionMakers: [
          {
            fullName: 'David Miller',
            jobTitle: 'Director of Operations',
            confidence: 'high',
            discoveryStatus: 'identified',
          },
        ],
      });

      const res = await request(app).post(`/api/companies/${company._id}/re-score`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.leadScore).toBeGreaterThan(50);

      const updated = await Company.findById(company._id);
      expect(updated?.leadScore).toBe(res.body.data.leadScore);
      expect(updated?.aiAnalysis?.scoreBreakdown).toBeDefined();
      expect(updated?.aiAnalysis?.scoreExplanation).toContain('Score of');
    });

    it('should return 404 when re-scoring non-existent company', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app).post(`/api/companies/${fakeId}/re-score`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('C. POST /api/companies/re-score-all Bulk Endpoint', () => {
    it('should recalculate lead scores across all companies in the database', async () => {
      await Company.create([
        {
          companyName: 'Company A',
          industry: 'Technology',
          companySize: 'Small: 1–50 employees',
          emails: ['a@example.com'],
          leadScore: 0,
        },
        {
          companyName: 'Company B',
          industry: 'Manufacturing',
          companySize: 'Enterprise: 1000+ employees',
          emails: ['b@example.com'],
          phoneNumbers: ['+1-555-1111'],
          decisionMakers: [
            {
              fullName: 'Alice Walker',
              jobTitle: 'CEO',
              confidence: 'high',
            },
          ],
          leadScore: 0,
        },
      ]);

      const res = await request(app).post('/api/companies/re-score-all');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalProcessed).toBe(2);
      expect(res.body.data.updatedCount).toBe(2);

      const all = await Company.find().sort({ leadScore: -1 });
      expect(all[0].leadScore).toBeGreaterThan(all[1].leadScore);
    });
  });

  describe('D. Tier Filtering via GET /api/companies?tier=...', () => {
    beforeEach(async () => {
      await Company.create([
        { companyName: 'Hot Lead 1', industry: 'Logistics', leadScore: 92 },
        { companyName: 'Hot Lead 2', industry: 'Healthcare', leadScore: 85 },
        { companyName: 'Medium Lead', industry: 'Retail', leadScore: 65 },
        { companyName: 'Low Lead', industry: 'Food', leadScore: 25 },
      ]);
    });

    it('should filter only high relevance leads (score >= 80)', async () => {
      const res = await request(app).get('/api/companies?tier=high');
      expect(res.status).toBe(200);
      expect(res.body.data.companies.length).toBe(2);
      expect(res.body.data.companies.every((c: any) => c.leadScore >= 80)).toBe(true);
    });

    it('should filter only medium relevance leads (50 <= score <= 79)', async () => {
      const res = await request(app).get('/api/companies?tier=medium');
      expect(res.status).toBe(200);
      expect(res.body.data.companies.length).toBe(1);
      expect(res.body.data.companies[0].companyName).toBe('Medium Lead');
    });

    it('should filter only low relevance leads (score < 50)', async () => {
      const res = await request(app).get('/api/companies?tier=low');
      expect(res.status).toBe(200);
      expect(res.body.data.companies.length).toBe(1);
      expect(res.body.data.companies[0].companyName).toBe('Low Lead');
    });
  });

  describe('E. GET /api/dashboard/stats High Relevance & Distribution Alignment', () => {
    it('should compute highRelevanceCount matching leadScore >= 80 and return all score distribution ranges', async () => {
      await Company.create([
        { companyName: 'Lead 95', leadScore: 95 },
        { companyName: 'Lead 85', leadScore: 85 },
        { companyName: 'Lead 75', leadScore: 75 },
        { companyName: 'Lead 55', leadScore: 55 },
        { companyName: 'Lead 35', leadScore: 35 },
        { companyName: 'Lead 15', leadScore: 15 },
      ]);

      const res = await request(app).get('/api/dashboard/stats');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const metrics = res.body.data.metrics;
      expect(metrics.totalCompanies).toBe(6);
      expect(metrics.highRelevanceCount).toBe(2); // Only 95 and 85 are >= 80

      const distribution = res.body.data.charts.relevanceDistribution;
      expect(distribution).toBeDefined();
      expect(distribution.length).toBe(5); // 0-20, 21-40, 41-60, 61-80, 81-100
    });
  });
});

