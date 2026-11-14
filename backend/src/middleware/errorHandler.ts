import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';

export interface AppError extends Error {
  statusCode?: number;
  details?: any;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  logger.error(`[${req.method} ${req.path}] Error ${statusCode}: ${message}`, err);

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      statusCode,
      details: err.details || undefined,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    },
  });
}
