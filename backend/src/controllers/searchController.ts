import { Request, Response } from 'express';
import { z } from 'zod';
import { SearchJob } from '../models/SearchJob.js';
import { discoveryOrchestrator } from '../services/discovery/discoveryOrchestrator.js';
import { logger } from '../config/logger.js';

export const SearchInputSchema = z.object({
  industry: z.string().optional().default(''),
  category: z.string().optional().default(''),
  keywords: z.array(z.string()).optional().default([]),
  country: z.string().optional().default(''),
  region: z.string().optional().default(''),
  city: z.string().optional().default(''),
  companySize: z.string().optional().default('Unknown'),
  services: z.array(z.string()).optional().default([]),
  aiRequirements: z.array(z.string()).optional().default([]),
  maxCompanies: z.number().int().min(1).max(100).default(25),
});

export const startSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = SearchInputSchema.parse(req.body);

    const job = new SearchJob({
      searchCriteria: validatedData,
      status: 'queued',
      progress: 0,
      discoveredCount: 0,
      processedCount: 0,
      failedCount: 0,
      startedAt: new Date(),
      errors: [],
    });

    await job.save();

    logger.info(`Search job created: ${job._id}`, { criteria: validatedData });

    // Execute discovery pipeline asynchronously in the background
    discoveryOrchestrator.executeJob(String(job._id)).catch((err) => {
      logger.error(`Error in discovery job background execution for ${job._id}`, err);
    });

    res.status(202).json({
      success: true,
      data: {
        jobId: job._id,
        status: job.status,
        progress: job.progress,
        searchCriteria: job.searchCriteria,
        message: 'Search job queued successfully',
      },
    });
  } catch (error: any) {
    logger.error('Failed to initiate search job', error);
    res.status(400).json({
      success: false,
      error: { message: error.message || 'Validation or creation error' },
    });
  }
};

export const getSearchJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const { jobId } = req.params;
    const job = await SearchJob.findById(jobId).lean();

    if (!job) {
      res.status(404).json({
        success: false,
        error: { message: `Search job not found with id: ${jobId}` },
      });
      return;
    }

    res.json({
      success: true,
      data: job,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Error fetching search job' },
    });
  }
};

export const getSearchHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
    const jobs = await SearchJob.find().sort({ createdAt: -1 }).limit(limit).lean();

    res.json({
      success: true,
      data: jobs,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Error fetching search history' },
    });
  }
};
