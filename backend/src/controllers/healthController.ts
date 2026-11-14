import { Request, Response } from 'express';
import { db } from '../config/database.js';
import { env } from '../config/env.js';

export const getHealth = async (req: Request, res: Response): Promise<void> => {
  const dbStatus = db.getStatus();
  const isHealthy = dbStatus.status === 'connected';

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
    database: dbStatus,
    version: '1.0.0',
  });
};
