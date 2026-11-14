import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../src/app.js';
import { Company } from '../src/models/Company.js';
import { scraperClient } from '../src/services/scraping/scraperClient.js';

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

describe('Milestone 3: Scraper Client SSRF & Extraction', () => {
  it('should block unsafe or private URLs from being scraped (SSRF protection)', async () => {
    await expect(scraperClient.scrapeWebsite('http://localhost:5000/internal')).rejects.toThrow(
      'SSRF Prevention'
    );
    await expect(scraperClient.scrapeWebsite('http://192.168.1.1/admin')).rejects.toThrow(
      'SSRF Prevention'
    );
    await expect(scraperClient.scrapeWebsite('http://127.0.0.1:27017')).rejects.toThrow(
      'SSRF Prevention'
    );
  });
});

describe('Milestone 3: POST /api/companies/:id/scrape Endpoint', () => {
  it('should scrape company website and update company record in MongoDB', async () => {
    const comp = await Company.create({
      companyName: 'Acme Robotics',
      website: 'https://acmerobotics.example.com',
      domain: 'acmerobotics.example.com',
      industry: 'Technology',
      scrapingStatus: 'pending',
    });

    // Mock scraperClient.scrapeWebsite to return structured extracted data
    const scrapeSpy = vi.spyOn(scraperClient, 'scrapeWebsite').mockResolvedValueOnce({
      url: 'https://acmerobotics.example.com',
      description: 'Acme Robotics designs next-generation autonomous fulfillment machines.',
      services: ['Warehouse Automation', 'Autonomous Mobile Robots'],
      products: ['AutoMover 5000'],
      emails: ['info@acmerobotics.example.com', 'sales@acmerobotics.example.com'],
      phoneNumbers: ['+1-555-0199'],
      companySize: 'Medium: 51–250 employees',
      socialLinks: {
        linkedin: 'https://linkedin.com/company/acme-robotics',
        twitter: 'https://twitter.com/acmerobotics',
      },
      sources: [
        {
          sourceUrl: 'https://acmerobotics.example.com/about',
          sourceType: 'website_about',
          extractedField: 'description',
          supportingText: 'Extracted overview description from about page',
          fetchedAt: new Date(),
        },
        {
          sourceUrl: 'https://acmerobotics.example.com/contact',
          sourceType: 'website_contact',
          extractedField: 'email',
          supportingText: 'Found mailto link: info@acmerobotics.example.com',
          fetchedAt: new Date(),
        },
      ],
    });

    const res = await request(app).post(`/api/companies/${comp._id}/scrape`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.scrapingStatus).toBe('completed');
    expect(res.body.data.description).toContain('autonomous fulfillment machines');
    expect(res.body.data.emails).toContain('info@acmerobotics.example.com');
    expect(res.body.data.phoneNumbers).toContain('+1-555-0199');
    expect(res.body.data.companySize).toBe('Medium: 51–250 employees');
    expect(res.body.data.socialLinks.linkedin).toBe('https://linkedin.com/company/acme-robotics');

    // Verify persisted in DB
    const updatedInDb = await Company.findById(comp._id);
    expect(updatedInDb?.scrapingStatus).toBe('completed');
    expect(updatedInDb?.sources.length).toBe(2);

    scrapeSpy.mockRestore();
  });

  it('should return 400 when attempting to scrape a company without a website', async () => {
    const comp = await Company.create({
      companyName: 'No Website Corp',
      industry: 'Manufacturing',
      website: '',
    });

    const res = await request(app).post(`/api/companies/${comp._id}/scrape`);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('recorded website URL');
  });
});

