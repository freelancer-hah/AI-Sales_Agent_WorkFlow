import { Request, Response } from 'express';
import { Company } from '../models/Company.js';
import { scraperClient } from '../services/scraping/scraperClient.js';
import { logger } from '../config/logger.js';

export const triggerScrape = async (req: Request, res: Response): Promise<void> => {
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

    if (!company.website) {
      res.status(400).json({
        success: false,
        error: { message: 'Cannot scrape company without a recorded website URL' },
      });
      return;
    }

    company.scrapingStatus = 'scraping';
    await company.save();

    logger.info(`Starting scrape execution for company: ${company.companyName} (${company.website})`);

    // Perform scrape
    const scrapedData = await scraperClient.scrapeWebsite(company.website);

    // Update company details if not manually overridden
    if (scrapedData.description && !company.manualOverrides?.description) {
      company.description = scrapedData.description;
    }

    if (scrapedData.services && scrapedData.services.length > 0) {
      const existingServices = new Set(company.services || []);
      for (const s of scrapedData.services) {
        existingServices.add(s);
      }
      company.services = Array.from(existingServices);
    }

    if (scrapedData.emails && scrapedData.emails.length > 0) {
      const existingEmails = new Set(company.emails || []);
      for (const e of scrapedData.emails) {
        existingEmails.add(e);
      }
      company.emails = Array.from(existingEmails);
    }

    if (scrapedData.phoneNumbers && scrapedData.phoneNumbers.length > 0) {
      const existingPhones = new Set(company.phoneNumbers || []);
      for (const p of scrapedData.phoneNumbers) {
        existingPhones.add(p);
      }
      company.phoneNumbers = Array.from(existingPhones);
    }

    if (scrapedData.companySize && scrapedData.companySize !== 'Unknown') {
      company.companySize = scrapedData.companySize;
    }

    if (scrapedData.socialLinks) {
      company.socialLinks = {
        ...company.socialLinks,
        ...scrapedData.socialLinks,
      };
    }

    // Merge discovered decision-makers
    if (scrapedData.decisionMakers && scrapedData.decisionMakers.length > 0) {
      if (!company.decisionMakers) {
        company.decisionMakers = [];
      }
      const existingNames = new Set(company.decisionMakers.map((dm) => dm.fullName.toLowerCase().trim()));
      for (const dm of scrapedData.decisionMakers) {
        const norm = dm.fullName.toLowerCase().trim();
        if (!existingNames.has(norm)) {
          company.decisionMakers.push({
            fullName: dm.fullName,
            jobTitle: dm.jobTitle,
            professionalProfileUrl: dm.professionalProfileUrl || '',
            publicBusinessEmail: dm.publicBusinessEmail || '',
            evidence: dm.evidence || '',
            sourceUrl: dm.sourceUrl || '',
            confidence: dm.confidence || 'medium',
            discoveryStatus: 'identified',
          } as any);
          existingNames.add(norm);
        }
      }
    }

    // Append provenance sources
    const VALID_SOURCE_TYPES = new Set([
      'osm',
      'searxng',
      'website_about',
      'website_contact',
      'website_team',
      'website_home',
      'website_services',
      'website_products',
      'website_leadership',
      'website_management',
      'gemini_analysis',
      'manual_entry',
      'other',
    ]);

    const existingSourceUrls = new Set(company.sources.map((s) => s.sourceUrl));
    for (const src of scrapedData.sources) {
      const sanitizedType = VALID_SOURCE_TYPES.has(src.sourceType) ? src.sourceType : 'other';
      if (!existingSourceUrls.has(src.sourceUrl) || src.extractedField) {
        company.sources.push({
          ...src,
          sourceType: sanitizedType,
        } as any);
      }
    }

    company.scrapingStatus = 'completed';
    // Recalculate base lead score if new contact info or decision makers found
    if (company.emails.length > 0 && company.leadScore < 60) {
      company.leadScore = Math.min(company.leadScore + 15, 80);
    }
    if (company.decisionMakers && company.decisionMakers.length > 0 && company.leadScore < 75) {
      company.leadScore = Math.min(company.leadScore + 15, 85);
    }

    await company.save();

    res.json({
      success: true,
      message: 'Scraping and information extraction completed successfully',
      data: company,
    });
  } catch (error: any) {
    logger.error('Scraping error', error);
    try {
      await Company.findByIdAndUpdate(req.params.id, { scrapingStatus: 'failed' });
    } catch {
      // Ignored
    }
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Error occurred while scraping company' },
    });
  }
};

export const triggerJobScrape = async (req: Request, res: Response): Promise<void> => {
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

    logger.info(`Starting JobSpy job scraping for company: ${company.companyName}`);

    // Call JobSpy scraper with real geographic location or unconstrained global
    const locationStr = [company.city, company.country].filter(Boolean).join(', ') || company.region || '';
    const jobs = await scraperClient.scrapeCompanyJobs(
      company.companyName,
      locationStr,
      company.country || ''
    );

    company.jobPostings = jobs;
    company.jobsScrapedAt = new Date();

    if (jobs.length > 0) {
      // Append provenance source
      company.sources.push({
        sourceUrl: jobs[0].jobUrl || 'https://www.linkedin.com/jobs',
        sourceType: 'other',
        extractedField: 'job_postings',
        supportingText: `Discovered ${jobs.length} active job postings via JobSpy (LinkedIn, Indeed, Google Jobs) to detect staffing bottlenecks.`,
        fetchedAt: new Date(),
      } as any);

      // Boost lead score if active hiring pain is detected
      if (company.leadScore < 70) {
        company.leadScore = Math.min(company.leadScore + 10, 85);
      }
    }

    await company.save();

    res.json({
      success: true,
      message: `JobSpy successfully discovered ${jobs.length} active job postings for ${company.companyName}`,
      data: {
        companyId: company._id,
        companyName: company.companyName,
        totalJobs: jobs.length,
        jobPostings: company.jobPostings,
      },
    });
  } catch (error: any) {
    logger.error('JobSpy scrape error', error);
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Error occurred while scraping job postings via JobSpy' },
    });
  }
};
