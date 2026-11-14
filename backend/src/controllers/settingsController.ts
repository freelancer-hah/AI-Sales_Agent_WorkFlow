import { Request, Response } from 'express';
import { env } from '../config/env.js';
import { db } from '../config/database.js';

export const getSettings = (req: Request, res: Response): void => {
  const hasGeminiKey = Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim() !== '');

  res.json({
    success: true,
    data: {
      gemini: {
        configured: hasGeminiKey,
        model: env.GEMINI_MODEL,
        apiKeyMasked: hasGeminiKey
          ? `${env.GEMINI_API_KEY.slice(0, 4)}...${env.GEMINI_API_KEY.slice(-4)}`
          : 'Not configured',
      },
      sources: {
        overpassUrl: env.OVERPASS_API_URL,
        searxngUrl: env.SEARXNG_URL,
        scraperServiceUrl: env.SCRAPER_SERVICE_URL,
      },
      server: {
        port: env.PORT,
        nodeEnv: env.NODE_ENV,
        clientUrl: env.CLIENT_URL,
      },
    },
  });
};

export const getIntegrations = async (req: Request, res: Response): Promise<void> => {
  const dbStatus = db.getStatus();

  res.json({
    success: true,
    data: {
      mongodb: {
        status: dbStatus.status,
        host: dbStatus.host || 'localhost:27017',
        dbName: dbStatus.dbName || 'sales_agent',
        error: dbStatus.error,
      },
      gemini: {
        status: env.GEMINI_API_KEY ? 'configured' : 'missing_api_key',
        model: env.GEMINI_MODEL,
      },
      overpass: {
        status: 'configured',
        url: env.OVERPASS_API_URL,
      },
      searxng: {
        status: 'configured',
        url: env.SEARXNG_URL,
      },
      scraper: {
        status: 'configured',
        url: env.SCRAPER_SERVICE_URL,
      },
    },
  });
};
