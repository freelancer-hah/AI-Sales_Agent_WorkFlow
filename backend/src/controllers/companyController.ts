import { Request, Response } from 'express';
import { Company } from '../models/Company.js';
import { normalizeDomain, normalizeCompanyName, normalizeUrl } from '../utils/normalizer.js';
import { leadScoringService } from '../services/scoring/leadScoringService.js';
import { logger } from '../config/logger.js';

export const getCompanies = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (req.query.industry) {
      filter.industry = new RegExp(`^${req.query.industry}$`, 'i');
    }

    if (req.query.country) {
      filter.country = new RegExp(`^${req.query.country}$`, 'i');
    }

    if (req.query.city) {
      filter.city = new RegExp(`^${req.query.city}$`, 'i');
    }

    if (req.query.companySize && req.query.companySize !== 'All') {
      filter.companySize = req.query.companySize;
    }

    if (req.query.isSaved !== undefined) {
      filter.isSaved = req.query.isSaved === 'true';
    }

    if (req.query.reviewStatus) {
      filter.reviewStatus = req.query.reviewStatus;
    }

    if (req.query.hasWebsite === 'true') {
      filter.website = { $exists: true, $ne: '' };
    }

    if (req.query.hasEmail === 'true') {
      filter.emails = { $exists: true, $not: { $size: 0 } };
    }

    if (req.query.hasDecisionMaker === 'true') {
      filter.decisionMakers = { $exists: true, $not: { $size: 0 } };
    }

    if (req.query.minScore) {
      filter.leadScore = { ...filter.leadScore, $gte: parseInt(req.query.minScore as string, 10) };
    }

    if (req.query.maxScore) {
      filter.leadScore = { ...filter.leadScore, $lte: parseInt(req.query.maxScore as string, 10) };
    }

    if (req.query.tier) {
      const tier = String(req.query.tier).toLowerCase();
      if (tier === 'high') {
        filter.leadScore = { ...filter.leadScore, $gte: 80 };
      } else if (tier === 'medium') {
        filter.leadScore = { ...filter.leadScore, $gte: 50, $lte: 79 };
      } else if (tier === 'low') {
        filter.leadScore = { ...filter.leadScore, $lt: 50 };
      }
    }

    if (req.query.search) {
      const term = (req.query.search as string).trim();
      filter.$or = [
        { companyName: new RegExp(term, 'i') },
        { description: new RegExp(term, 'i') },
        { services: new RegExp(term, 'i') },
        { domain: new RegExp(term, 'i') },
      ];
    }

    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const sort: Record<string, any> = { [sortBy]: sortOrder };

    const [total, companies] = await Promise.all([
      Company.countDocuments(filter),
      Company.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    ]);

    res.json({
      success: true,
      data: {
        companies,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (error: any) {
    logger.error('Failed to get companies', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Error fetching companies' },
    });
  }
};

export const getCompanyById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const company = await Company.findById(id).lean();

    if (!company) {
      res.status(404).json({
        success: false,
        error: { message: `Company not found with id: ${id}` },
      });
      return;
    }

    res.json({
      success: true,
      data: company,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Error fetching company' },
    });
  }
};

export const updateCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const existing = await Company.findById(id);
    if (!existing) {
      res.status(404).json({
        success: false,
        error: { message: `Company not found with id: ${id}` },
      });
      return;
    }

    // Preserve original sources while tracking manual overrides
    const manualOverrides = existing.manualOverrides || {};
    for (const key of Object.keys(updates)) {
      if (['companyName', 'website', 'industry', 'description', 'city', 'country', 'companySize'].includes(key)) {
        if (!manualOverrides[key] && (existing as any)[key] !== undefined) {
          manualOverrides[key] = {
            originalValue: (existing as any)[key],
            overriddenAt: new Date(),
          };
        }
      }
    }

    if (updates.website) {
      updates.website = normalizeUrl(updates.website);
      updates.domain = normalizeDomain(updates.website);
    }

    if (updates.companyName) {
      updates.normalizedName = normalizeCompanyName(updates.companyName);
    }

    updates.manualOverrides = manualOverrides;

    const updated = await Company.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();

    res.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Error updating company' },
    });
  }
};

export const deleteCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const deleted = await Company.findByIdAndDelete(id);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: { message: `Company not found with id: ${id}` },
      });
      return;
    }

    res.json({
      success: true,
      message: 'Company deleted successfully',
      data: { id },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Error deleting company' },
    });
  }
};

export const reScoreCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updated = await leadScoringService.reScoreCompanyById(id);
    if (!updated) {
      res.status(404).json({ success: false, error: { message: `Company not found with id: ${id}` } });
      return;
    }
    res.json({
      success: true,
      message: `Lead score recalculated: ${updated.leadScore}/100`,
      data: updated,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message || 'Error re-scoring company' } });
  }
};

export const reScoreAllCompanies = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await leadScoringService.reScoreAllCompanies();
    res.json({
      success: true,
      message: `Re-scoring completed: ${result.totalProcessed} companies evaluated, ${result.updatedCount} scores updated.`,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: { message: error.message || 'Error re-scoring all companies' } });
  }
};
