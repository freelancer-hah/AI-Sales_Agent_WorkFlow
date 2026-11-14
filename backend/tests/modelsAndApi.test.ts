import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../src/app.js';
import { Company } from '../src/models/Company.js';
import { SearchJob } from '../src/models/SearchJob.js';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
});

beforeEach(async () => {
  await Company.deleteMany({});
  await SearchJob.deleteMany({});
});

describe('MongoDB Models and CRUD API', () => {
  it('should create and validate a company with decision makers and sources', async () => {
    const company = new Company({
      companyName: 'Acme Robotics Corp',
      normalizedName: 'acme robotics',
      website: 'https://acmerobotics.com',
      domain: 'acmerobotics.com',
      industry: 'Technology',
      category: 'Robotics',
      description: 'Autonomous industrial robotics provider',
      services: ['Warehouse automation', 'Robotic sorting'],
      products: ['AutoMover 5000'],
      country: 'United States',
      region: 'California',
      city: 'San Francisco',
      address: '100 Innovation Way',
      emails: ['info@acmerobotics.com'],
      phoneNumbers: ['+1-555-0199'],
      companySize: 'Medium: 51–250 employees',
      leadScore: 85,
      sources: [
        {
          sourceUrl: 'https://acmerobotics.com/about',
          sourceType: 'website_about',
          extractedField: 'services',
          supportingText: 'We provide autonomous industrial robotics solutions.',
          fetchedAt: new Date(),
        },
      ],
      decisionMakers: [
        {
          companyId: new mongoose.Types.ObjectId(),
          fullName: 'Elena Vance',
          jobTitle: 'Chief Executive Officer',
          professionalProfileUrl: 'https://www.linkedin.com/in/elena-vance-robotics',
          confidence: 'high',
          discoveryStatus: 'identified',
          sourceUrl: 'https://acmerobotics.com/team',
          evidence: 'Elena Vance serves as the Chief Executive Officer of Acme Robotics.',
        },
      ],
    });

    const saved = await company.save();
    expect(saved._id).toBeDefined();
    expect(saved.companyName).toBe('Acme Robotics Corp');
    expect(saved.decisionMakers.length).toBe(1);
    expect(saved.decisionMakers[0].fullName).toBe('Elena Vance');
    expect(saved.sources.length).toBe(1);
    expect(saved.sources[0].sourceType).toBe('website_about');
  });

  it('GET /api/companies should return paginated companies with filters', async () => {
    await Company.create([
      {
        companyName: 'Tech Alpha',
        domain: 'techalpha.com',
        website: 'https://techalpha.com',
        industry: 'Technology',
        country: 'United States',
        city: 'New York',
        leadScore: 90,
      },
      {
        companyName: 'Logi Flow',
        domain: 'logiflow.com',
        website: 'https://logiflow.com',
        industry: 'Logistics',
        country: 'Canada',
        city: 'Toronto',
        leadScore: 40,
      },
    ]);

    const res = await request(app).get('/api/companies?industry=Technology');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.companies.length).toBe(1);
    expect(res.body.data.companies[0].companyName).toBe('Tech Alpha');
    expect(res.body.data.pagination.total).toBe(1);
  });

  it('PATCH /api/companies/:id should preserve original values in manualOverrides', async () => {
    const comp = await Company.create({
      companyName: 'Original Name Inc',
      website: 'https://original.com',
      domain: 'original.com',
      industry: 'Manufacturing',
      description: 'Original description from website',
    });

    const updateRes = await request(app)
      .patch(`/api/companies/${comp._id}`)
      .send({
        companyName: 'Custom Edited Name',
        description: 'User edited description',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.companyName).toBe('Custom Edited Name');
    expect(updateRes.body.data.manualOverrides).toHaveProperty('companyName');
    expect(updateRes.body.data.manualOverrides.companyName.originalValue).toBe('Original Name Inc');
  });

  it('POST /api/search should validate criteria and create SearchJob in database', async () => {
    const searchPayload = {
      industry: 'Healthcare',
      keywords: ['medical devices', 'hospital automation'],
      country: 'United States',
      city: 'Boston',
      companySize: 'Small: 1–50 employees',
      services: ['Workflow Automation'],
      maxCompanies: 25,
    };

    const res = await request(app).post('/api/search').send(searchPayload);
    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('jobId');

    const jobInDb = await SearchJob.findById(res.body.data.jobId);
    expect(jobInDb).not.toBeNull();
    expect(jobInDb?.searchCriteria.industry).toBe('Healthcare');
    expect(jobInDb?.status).toBe('queued');
  });

  it('GET /api/dashboard/stats should compute aggregation stats from real records', async () => {
    await Company.create({
      companyName: 'Alpha Health',
      website: 'https://alphahealth.com',
      emails: ['contact@alphahealth.com'],
      phoneNumbers: ['+1-555-1234'],
      industry: 'Healthcare',
      country: 'United States',
      city: 'Boston',
      leadScore: 88,
      decisionMakers: [
        {
          fullName: 'Dr. Sarah Connor',
          jobTitle: 'Founder & CEO',
          confidence: 'high',
          discoveryStatus: 'identified',
        },
      ],
    });

    const res = await request(app).get('/api/dashboard/stats');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.metrics.totalCompanies).toBe(1);
    expect(res.body.data.metrics.withWebsites).toBe(1);
    expect(res.body.data.metrics.withEmails).toBe(1);
    expect(res.body.data.metrics.withPhones).toBe(1);
    expect(res.body.data.metrics.highRelevanceCount).toBe(1);
  });
});
