import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../src/app.js';
import { Company } from '../src/models/Company.js';
import { geminiClient } from '../src/services/ai/geminiClient.js';

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

describe('Milestone 5: Google Gemini AI Research Agent', () => {
  describe('A. Gemini Client Architecture & Configuration', () => {
    it('should be configured with model and API key status', () => {
      expect(geminiClient.getModelName()).toBeDefined();
      expect(typeof geminiClient.isConfigured()).toBe('boolean');
    });

    it('should generate grounded fallback analysis when API key is simulated or missing', async () => {
      const fallbackAnalysis = (geminiClient as any).generateFallbackAnalysis({
        companyName: 'Apex Health Systems',
        industry: 'Healthcare',
        description: 'Regional outpatient healthcare and clinical diagnostics provider.',
        services: ['Radiology', 'Laboratory Testing', 'Cardiology'],
        companySize: 'Medium: 51–250 employees',
        emails: ['info@apexhealth.example.com'],
        phoneNumbers: ['+1-555-0123'],
        decisionMakers: [
          {
            fullName: 'Dr. Sarah Connor',
            jobTitle: 'Chief Executive Officer',
            confidence: 'high',
          },
        ],
      }, 'TestSimulation');

      expect(fallbackAnalysis).toBeDefined();
      expect(fallbackAnalysis.leadScore).toBeGreaterThan(0);
      expect(fallbackAnalysis.leadScore).toBeLessThanOrEqual(100);
      expect(fallbackAnalysis.scoreBreakdown).toBeDefined();
      expect(fallbackAnalysis.scoreBreakdown?.industryAlignment).toBeGreaterThan(0);
      expect(fallbackAnalysis.scoreExplanation).toBeDefined();
      expect(fallbackAnalysis.problems.length).toBeGreaterThanOrEqual(1);
      expect(fallbackAnalysis.opportunities.length).toBeGreaterThanOrEqual(1);

      const opp = fallbackAnalysis.opportunities[0];
      expect(opp.title).toBeDefined();
      expect(opp.businessProblem).toBeDefined();
      expect(opp.recommendedSolution).toBeDefined();
      expect(opp.benefits).toBeDefined();
      expect(opp.whyNeeded).toBeDefined();
      expect(['high', 'medium', 'low']).toContain(opp.confidence);
    });
  });

  describe('B. POST /api/ai/:id/analyze Endpoint', () => {
    it('should execute Gemini research and persist structured analysis to MongoDB', async () => {
      const company = await Company.create({
        companyName: 'Vanguard Industrial Logistics',
        industry: 'Logistics',
        description: 'Freight forwarding, intermodal freight transport, and cold chain distribution.',
        services: ['Refrigerated Freight', 'Fleet Management', 'Cross-Docking'],
        companySize: 'Large: 251–1000 employees',
        website: 'https://vanguardlogistics.example.com',
        domain: 'vanguardlogistics.example.com',
        emails: ['inbound@vanguardlogistics.example.com'],
        phoneNumbers: ['+1-555-4920'],
        leadScore: 40,
        decisionMakers: [
          {
            fullName: 'Marcus Vance',
            jobTitle: 'Chief Operating Officer',
            confidence: 'high',
          },
        ],
      });

      // Mock geminiClient.analyzeCompany to return structured reasoning
      vi.spyOn(geminiClient, 'analyzeCompany').mockResolvedValueOnce({
        problems: [
          {
            title: 'Manual Cold-Chain Telemetry Monitoring',
            problem: 'Manual verification of temperature thresholds risks cargo spoilage during transit.',
            hypothesis: false,
            evidence: 'Stated services: Refrigerated Freight and Fleet Management',
          },
          {
            title: 'Cross-Docking Dispatch Bottleneck',
            problem: 'Scheduling incoming freight across warehouse docks relies on spreadsheet dispatchers.',
            hypothesis: true,
            evidence: 'Operates cross-docking facilities with 250+ employees',
          },
        ],
        opportunities: [
          {
            title: 'AI Predictive Cold-Chain Anomaly Detection',
            businessProblem: 'Preventing spoiled perishable cargo during intermodal transit.',
            recommendedSolution: 'Real-time IoT telemetry ingestion with predictive temperature anomaly alerts.',
            howItWorks: 'Stream temperature sensor data to Gemini time-series models to predict equipment failures.',
            benefits: 'Eliminates cargo spoilage losses and reduces insurance claim incidents by 75%.',
            whyNeeded: 'Vanguard specializes in refrigerated transport where failure results in total cargo loss.',
            supportingEvidence: 'Vanguard provides refrigerated freight across multi-state transit.',
            implementationComplexity: 'medium',
            potentialImpact: 'high',
            confidence: 'high',
          },
          {
            title: 'Automated Dispatch & Cross-Dock Workflow Optimizer',
            businessProblem: 'Manual scheduling of incoming trucks and dock assignments.',
            recommendedSolution: 'Deploy LLM-driven dispatch coordinator integrated with warehouse management API.',
            howItWorks: 'Parses incoming driver manifestos, assigns optimal dock, and sends automated driver SMS.',
            benefits: 'Reduces dock turnaround times by 40 minutes per truck.',
            whyNeeded: 'Large-scale facility handling high-volume cross-docking operations.',
            supportingEvidence: 'Stated services: Cross-Docking',
            implementationComplexity: 'low',
            potentialImpact: 'high',
            confidence: 'high',
          },
        ],
        leadScore: 84,
        scoreBreakdown: {
          industryAlignment: 18,
          operationalComplexity: 16,
          opportunityQuality: 26,
          decisionMakerAvailability: 12,
          contactability: 12,
        },
        scoreExplanation: 'Score 84/100: Prime candidate for logistics automation. High-value refrigerated assets, verified COO decision-maker, and strong operational need.',
        evidence: ['Logistics industry', 'Verified COO: Marcus Vance', 'Public email: inbound@vanguardlogistics.example.com'],
        missingInformation: ['Current telematics provider not listed'],
        analyzedAt: new Date(),
        modelUsed: 'gemini-3.8-flash',
      });

      const res = await request(app)
        .post(`/api/ai/${company._id}/analyze`)
        .send({ desiredServices: ['Workflow Automation', 'AI Business Analytics'] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.leadScore).toBe(84);
      expect(res.body.data.analysisStatus).toBe('completed');
      expect(res.body.data.aiAnalysis.problems.length).toBe(2);
      expect(res.body.data.aiAnalysis.opportunities.length).toBe(2);

      // Verify DB persistence
      const updated = await Company.findById(company._id);
      expect(updated?.leadScore).toBe(84);
      expect(updated?.analysisStatus).toBe('completed');
      expect(updated?.aiAnalysis?.opportunities[0].title).toBe('AI Predictive Cold-Chain Anomaly Detection');

      // Verify Source provenance was logged
      const aiSource = updated?.sources.find((s) => s.sourceType === 'gemini_analysis');
      expect(aiSource).toBeDefined();
      expect(aiSource?.extractedField).toBe('ai_analysis');
    });

    it('should return 404 when analyzing non-existent company', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app).post(`/api/ai/${fakeId}/analyze`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('C. GET /api/ai/:id/analysis Endpoint', () => {
    it('should return company analysis details', async () => {
      const company = await Company.create({
        companyName: 'Alpha Med',
        industry: 'Healthcare',
        leadScore: 78,
        analysisStatus: 'completed',
        aiAnalysis: {
          problems: [
            {
              title: 'Manual Patient Scheduling',
              problem: 'High call volume for appointment booking.',
              hypothesis: true,
            },
          ],
          opportunities: [
            {
              title: 'Conversational Patient Booking Agent',
              businessProblem: 'Call center overload.',
              recommendedSolution: 'Voice & web conversational scheduling agent.',
              howItWorks: 'Directly reads EHR calendars and books appointments.',
              benefits: '24/7 self-service scheduling.',
              whyNeeded: 'Alpha Med handles high outpatient volume.',
              supportingEvidence: 'High call volume noted.',
              confidence: 'high',
            },
          ],
          leadScore: 78,
          scoreExplanation: 'Evaluated based on patient service volume.',
          evidence: [],
          missingInformation: [],
          analyzedAt: new Date(),
          modelUsed: 'gemini-3.8-flash',
        },
      });

      const res = await request(app).get(`/api/ai/${company._id}/analysis`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.companyName).toBe('Alpha Med');
      expect(res.body.data.leadScore).toBe(78);
      expect(res.body.data.aiAnalysis.opportunities.length).toBe(1);
    });

    it('should return 404 for invalid company id', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app).get(`/api/ai/${fakeId}/analysis`);
      expect(res.status).toBe(404);
    });
  });
});
