import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import ExcelJS from 'exceljs';
import app from '../src/app.js';
import { Company } from '../src/models/Company.js';

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

  // Seed sample companies with decision makers, AI analysis, and sources
  await Company.create([
    {
      companyName: 'Apex Cloud Solutions',
      normalizedName: 'apex cloud solutions',
      website: 'https://apexcloud.example.com',
      domain: 'apexcloud.example.com',
      industry: 'Technology',
      category: 'Cloud SaaS',
      description: 'Enterprise cloud infrastructure and DevOps automation.',
      country: 'United States',
      city: 'San Francisco',
      emails: ['contact@apexcloud.example.com', 'sales@apexcloud.example.com'],
      phoneNumbers: ['+1 415-555-0100'],
      companySize: 'Medium: 51–250 employees',
      leadScore: 88,
      isSaved: true,
      reviewStatus: 'reviewed',
      decisionMakers: [
        {
          fullName: 'Sarah Jenkins',
          jobTitle: 'Chief Executive Officer',
          publicBusinessEmail: 'sarah@apexcloud.example.com',
          professionalProfileUrl: 'https://linkedin.com/in/sarahjenkins-sample',
          confidence: 'high',
          discoveryStatus: 'identified',
        },
      ],
      aiAnalysis: {
        problems: [
          {
            title: 'Manual client onboarding bottleneck',
            problem: 'Client account creation and cloud resource provisioning is manual.',
            hypothesis: false,
          },
        ],
        opportunities: [
          {
            title: 'Automated Cloud Resource Provisioning Pipeline',
            businessProblem: 'Manual cloud account provisioning delay',
            recommendedSolution: 'Event-driven serverless provisioning bot',
            howItWorks: 'Webhook triggers automated Terraform templates upon sign up',
            benefits: 'Reduces onboarding time from 4 hours to 90 seconds',
            whyNeeded: 'Critical for high client conversion',
            supportingEvidence: 'Stated manual onboarding on careers page',
            implementationComplexity: 'medium',
            potentialImpact: 'high',
            confidence: 'high',
          },
        ],
        leadScore: 88,
        scoreBreakdown: {
          industryAlignment: 20,
          operationalComplexity: 16,
          opportunityQuality: 26,
          decisionMakerAvailability: 15,
          contactability: 11,
        },
        scoreExplanation: 'High relevance lead with verified CEO and high-impact automation need.',
      },
      sources: [
        {
          sourceUrl: 'https://apexcloud.example.com/about',
          sourceType: 'website_about',
          extractedField: 'description',
          supportingText: 'Leading cloud provider for B2B SaaS',
          fetchedAt: new Date(),
        },
      ],
    },
    {
      companyName: 'Pacific Rim Freight Logistics',
      normalizedName: 'pacific rim freight logistics',
      website: 'https://pacificrim.example.com',
      domain: 'pacificrim.example.com',
      industry: 'Logistics',
      category: 'Freight Forwarding',
      country: 'United States',
      city: 'Seattle',
      emails: ['dispatch@pacificrim.example.com'],
      phoneNumbers: ['+1 206-555-0199'],
      companySize: 'Small: 1–50 employees',
      leadScore: 62,
      isSaved: false,
      reviewStatus: 'new',
      decisionMakers: [],
      aiAnalysis: {
        problems: [],
        opportunities: [
          {
            title: 'AI Automated Bill of Lading & Customs Document Parsing',
            businessProblem: 'Manual document entry for international shipments',
            recommendedSolution: 'OCR and Vision LLM automated parsing',
            howItWorks: 'Scans paper BOLs and auto-populates freight TMS system',
            benefits: 'Eliminates 90% of manual freight data entry',
            whyNeeded: 'High customs compliance requirements',
            supportingEvidence: 'Stated international customs operations',
            implementationComplexity: 'low',
            potentialImpact: 'high',
            confidence: 'high',
          },
        ],
        leadScore: 62,
        scoreBreakdown: {
          industryAlignment: 20,
          operationalComplexity: 8,
          opportunityQuality: 22,
          decisionMakerAvailability: 0,
          contactability: 12,
        },
        scoreExplanation: 'Medium relevance lead with good document automation opportunity.',
      },
      sources: [],
    },
    {
      companyName: 'Local Corner Bakery',
      normalizedName: 'local corner bakery',
      website: 'https://cornerbakery.example.com',
      domain: 'cornerbakery.example.com',
      industry: 'Food and Beverage',
      country: 'United States',
      city: 'Boston',
      emails: [],
      phoneNumbers: ['+1 617-555-0155'],
      companySize: 'Small: 1–50 employees',
      leadScore: 35,
      isSaved: false,
      reviewStatus: 'new',
      decisionMakers: [],
      sources: [],
    },
  ]);
});

describe('Milestone 7: Export Engine: Multi-Tab Excel & CSV', () => {
  describe('A. GET /api/export/excel (Multi-Tab Structured Workbook)', () => {
    it('should generate a valid 5-tab Excel workbook with correct headers and data', async () => {
      const res = await request(app)
        .get('/api/export/excel')
        .responseType('blob')
        .expect(200);

      expect(res.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(res.headers['content-disposition']).toMatch(/attachment;\s*filename="sales_leads_intelligence_.*\.xlsx"/);

      // Parse binary buffer with ExcelJS to inspect worksheets
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);

      // Verify all 5 sheets exist
      const sheetNames = workbook.worksheets.map((ws) => ws.name);
      expect(sheetNames).toContain('Companies');
      expect(sheetNames).toContain('Decision Makers');
      expect(sheetNames).toContain('AI Opportunities');
      expect(sheetNames).toContain('Data Sources');
      expect(sheetNames).toContain('Scoring Breakdown');

      // Check Companies sheet rows (Header + 3 seeded companies = 4 rows)
      const wsCompanies = workbook.getWorksheet('Companies');
      expect(wsCompanies?.rowCount).toBe(4);

      // Check Decision Makers sheet (Header + 1 decision maker = 2 rows)
      const wsDM = workbook.getWorksheet('Decision Makers');
      expect(wsDM?.rowCount).toBe(2);

      // Check AI Opportunities sheet (Header + 2 opportunities = 3 rows)
      const wsAI = workbook.getWorksheet('AI Opportunities');
      expect(wsAI?.rowCount).toBe(3);
    });

    it('should filter Excel export by tier (high)', async () => {
      const res = await request(app)
        .get('/api/export/excel?tier=high')
        .responseType('blob')
        .expect(200);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);

      const wsCompanies = workbook.getWorksheet('Companies');
      // 1 header row + 1 high-tier company (score 88) = 2 rows
      expect(wsCompanies?.rowCount).toBe(2);
    });

    it('should filter Excel export by isSaved=true', async () => {
      const res = await request(app)
        .get('/api/export/excel?isSaved=true')
        .responseType('blob')
        .expect(200);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);

      const wsCompanies = workbook.getWorksheet('Companies');
      // 1 header + 1 saved company = 2 rows
      expect(wsCompanies?.rowCount).toBe(2);
    });

    it('should support POST /api/export/excel with specific companyIds', async () => {
      const sample = await Company.findOne({ domain: 'apexcloud.example.com' });
      expect(sample).toBeDefined();

      const res = await request(app)
        .post('/api/export/excel')
        .send({ companyIds: [String(sample!._id)] })
        .responseType('blob')
        .expect(200);

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);

      const wsCompanies = workbook.getWorksheet('Companies');
      expect(wsCompanies?.rowCount).toBe(2);
    });
  });

  describe('B. GET /api/export/csv (Specialized CSV Exports)', () => {
    it('should export companies master CSV by default', async () => {
      const res = await request(app)
        .get('/api/export/csv')
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toMatch(/attachment;\s*filename="sales_leads_companies_.*\.csv"/);
      expect(res.text).toContain('Company Name');
      expect(res.text).toContain('Apex Cloud Solutions');
      expect(res.text).toContain('Pacific Rim Freight Logistics');
    });

    it('should export decision-makers CSV when type=decision-makers', async () => {
      const res = await request(app)
        .get('/api/export/csv?type=decision-makers')
        .expect(200);

      expect(res.headers['content-disposition']).toMatch(/attachment;\s*filename="sales_leads_decision-makers_.*\.csv"/);
      expect(res.text).toContain('Sarah Jenkins');
      expect(res.text).toContain('Chief Executive Officer');
      expect(res.text).toContain('Apex Cloud Solutions');
    });

    it('should export AI opportunities CSV when type=ai-opportunities', async () => {
      const res = await request(app)
        .get('/api/export/csv?type=ai-opportunities')
        .expect(200);

      expect(res.headers['content-disposition']).toMatch(/attachment;\s*filename="sales_leads_ai-opportunities_.*\.csv"/);
      expect(res.text).toContain('Automated Cloud Resource Provisioning Pipeline');
      expect(res.text).toContain('AI Automated Bill of Lading & Customs Document Parsing');
    });

    it('should export data sources CSV when type=sources', async () => {
      const res = await request(app)
        .get('/api/export/csv?type=sources')
        .expect(200);

      expect(res.headers['content-disposition']).toMatch(/attachment;\s*filename="sales_leads_sources_.*\.csv"/);
      expect(res.text).toContain('website_about');
      expect(res.text).toContain('https://apexcloud.example.com/about');
    });

    it('should support POST /api/export/csv with filtered companyIds', async () => {
      const sample = await Company.findOne({ domain: 'pacificrim.example.com' });

      const res = await request(app)
        .post('/api/export/csv')
        .send({ companyIds: [String(sample!._id)], type: 'companies' })
        .expect(200);

      expect(res.text).toContain('Pacific Rim Freight Logistics');
      expect(res.text).not.toContain('Apex Cloud Solutions');
    });
  });

  describe('C. Dual-Mounting Route Verification (/api/companies/export)', () => {
    it('should support /api/companies/export/excel identically to /api/export/excel', async () => {
      const res = await request(app)
        .get('/api/companies/export/excel')
        .expect(200);

      expect(res.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });

    it('should support /api/companies/export/csv identically to /api/export/csv', async () => {
      const res = await request(app)
        .get('/api/companies/export/csv')
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Company Name');
    });
  });
});
