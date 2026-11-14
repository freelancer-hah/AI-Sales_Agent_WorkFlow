import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('Health and System Status API', () => {
  it('GET /api/health should return health information', async () => {
    const res = await request(app).get('/api/health');
    // Even if db is not connected yet, it returns structured status
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('database');
    expect(res.body).toHaveProperty('version');
  });

  it('GET /api/settings should return sanitized configuration', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('gemini');
    expect(res.body.data).toHaveProperty('sources');
    expect(res.body.data).toHaveProperty('server');
    // Ensure raw key is never exposed
    if (res.body.data.gemini.configured) {
      expect(res.body.data.gemini.apiKeyMasked).toContain('...');
    }
  });

  it('GET /api/settings/integrations should return status of all external services', async () => {
    const res = await request(app).get('/api/settings/integrations');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('mongodb');
    expect(res.body.data).toHaveProperty('gemini');
    expect(res.body.data).toHaveProperty('overpass');
    expect(res.body.data).toHaveProperty('searxng');
    expect(res.body.data).toHaveProperty('scraper');
  });
});
