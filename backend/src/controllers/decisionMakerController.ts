import { Request, Response } from 'express';
import { Company } from '../models/Company.js';
import { scraperClient } from '../services/scraping/scraperClient.js';
import { searxngClient } from '../services/discovery/searxngClient.js';
import { logger } from '../config/logger.js';

export const getDecisionMakers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
    const skip = (page - 1) * limit;

    const pipeline: any[] = [
      { $unwind: '$decisionMakers' },
      {
        $project: {
          companyId: '$_id',
          companyName: '$companyName',
          companyWebsite: '$website',
          companyIndustry: '$industry',
          fullName: '$decisionMakers.fullName',
          jobTitle: '$decisionMakers.jobTitle',
          professionalProfileUrl: '$decisionMakers.professionalProfileUrl',
          publicBusinessEmail: '$decisionMakers.publicBusinessEmail',
          evidence: '$decisionMakers.evidence',
          sourceUrl: '$decisionMakers.sourceUrl',
          confidence: '$decisionMakers.confidence',
          discoveryStatus: '$decisionMakers.discoveryStatus',
        },
      },
    ];

    if (req.query.search) {
      const term = (req.query.search as string).trim();
      pipeline.push({
        $match: {
          $or: [
            { fullName: new RegExp(term, 'i') },
            { jobTitle: new RegExp(term, 'i') },
            { companyName: new RegExp(term, 'i') },
          ],
        },
      });
    }

    if (req.query.jobTitle) {
      pipeline.push({
        $match: { jobTitle: new RegExp(req.query.jobTitle as string, 'i') },
      });
    }

    if (req.query.confidence) {
      pipeline.push({
        $match: { confidence: req.query.confidence },
      });
    }

    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await Company.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    pipeline.push({ $skip: skip }, { $limit: limit });
    const decisionMakers = await Company.aggregate(pipeline);

    res.json({
      success: true,
      data: {
        decisionMakers,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Error fetching decision makers' },
    });
  }
};

export const getCompanyDecisionMakers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const company = await Company.findById(id).select('companyName decisionMakers').lean();

    if (!company) {
      res.status(404).json({
        success: false,
        error: { message: `Company not found with id: ${id}` },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        companyId: company._id,
        companyName: company.companyName,
        decisionMakers: company.decisionMakers || [],
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Error fetching decision makers' },
    });
  }
};

export const discoverCompanyDecisionMakers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const company = await Company.findById(id);

    if (!company) {
      res.status(404).json({
        success: false,
        error: { message: `Company not found with id: ${id}` },
      });
      return;
    }

    logger.info(`Discovering decision makers for company: ${company.companyName}`);
    if (!company.decisionMakers) company.decisionMakers = [];

    const existingNames = new Set(company.decisionMakers.map((dm) => dm.fullName.toLowerCase().trim()));
    let newFoundCount = 0;

    // 1. If company has website, run targeted scraper
    if (company.website) {
      try {
        const scrapeResult = await scraperClient.scrapeWebsite(company.website);
        if (scrapeResult.decisionMakers && scrapeResult.decisionMakers.length > 0) {
          for (const dm of scrapeResult.decisionMakers) {
            const norm = dm.fullName.toLowerCase().trim();
            if (!existingNames.has(norm)) {
              company.decisionMakers.push({
                fullName: dm.fullName,
                jobTitle: dm.jobTitle,
                professionalProfileUrl: dm.professionalProfileUrl || '',
                publicBusinessEmail: dm.publicBusinessEmail || '',
                evidence: dm.evidence || '',
                sourceUrl: dm.sourceUrl || company.website,
                confidence: dm.confidence || 'medium',
                discoveryStatus: 'identified',
              } as any);
              existingNames.add(norm);
              newFoundCount++;
            }
          }
        }
      } catch (err: any) {
        logger.warn(`Website scrape failed during decision maker discovery: ${err.message}`);
      }
    }

    // 2. Query SearXNG for public leadership references
    try {
      const searxDms = await searxngClient.searchDecisionMakers(company.companyName, company.domain);
      for (const dm of searxDms) {
        const norm = dm.fullName.toLowerCase().trim();
        if (!existingNames.has(norm)) {
          company.decisionMakers.push({
            fullName: dm.fullName,
            jobTitle: dm.jobTitle,
            professionalProfileUrl: dm.professionalProfileUrl || '',
            publicBusinessEmail: '',
            evidence: dm.evidence || '',
            sourceUrl: dm.sourceUrl || '',
            confidence: dm.confidence || 'medium',
            discoveryStatus: 'identified',
          } as any);
          existingNames.add(norm);
          newFoundCount++;
        }
      }
    } catch (err: any) {
      logger.warn(`SearXNG search failed during decision maker discovery: ${err.message}`);
    }

    if (newFoundCount > 0 && company.leadScore < 75) {
      company.leadScore = Math.min(company.leadScore + 15, 85);
    }

    await company.save();

    res.json({
      success: true,
      message: newFoundCount > 0
        ? `Successfully identified ${newFoundCount} new decision maker(s)`
        : 'No additional decision makers found with verifiable public evidence',
      data: {
        companyId: company._id,
        companyName: company.companyName,
        decisionMakers: company.decisionMakers,
        newlyDiscoveredCount: newFoundCount,
      },
    });
  } catch (error: any) {
    logger.error('Error discovering decision makers', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Error discovering decision makers' },
    });
  }
};
