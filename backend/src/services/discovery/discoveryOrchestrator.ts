import { SearchJob, ISearchJobDocument } from '../../models/SearchJob.js';
import { Company } from '../../models/Company.js';
import { googleMapsClient } from './googleMapsClient.js';
import { overpassClient } from './overpassClient.js';
import { searxngClient } from './searxngClient.js';
import { discoveryProcessor } from './discoveryProcessor.js';
import { logger } from '../../config/logger.js';

export class DiscoveryOrchestrator {
  public async executeJob(jobId: string): Promise<void> {
    const job = await SearchJob.findById(jobId);
    if (!job) {
      logger.error(`DiscoveryOrchestrator: Job ${jobId} not found`);
      return;
    }

    job.status = 'running';
    job.progress = 10;
    job.startedAt = new Date();
    await job.save();

    logger.info(`Starting discovery pipeline for job: ${jobId}`, { criteria: job.searchCriteria });

    try {
      const { industry, keywords, country, region, city, companySize, maxCompanies } = job.searchCriteria;

      // 1. Primary Discovery: Query Google Maps Scraper (gosom/google-maps-scraper)
      job.progress = 20;
      await job.save();

      let googleMapsCompanies: any[] = [];
      try {
        const gmapsResponse = await googleMapsClient.search({
          industry,
          category: job.searchCriteria.category,
          keywords,
          city,
          country,
          limit: maxCompanies,
        });

        if (gmapsResponse.isAvailable && gmapsResponse.results.length > 0) {
          googleMapsCompanies = gmapsResponse.results;
          logger.info(`Job ${jobId}: Google Maps scraper discovered ${googleMapsCompanies.length} rich business listings`);
        }
      } catch (err: any) {
        logger.warn(`Job ${jobId}: Google Maps query error: ${err.message}`);
        job.errors.push({
          timestamp: new Date(),
          phase: 'gmaps_discovery',
          message: err.message,
        });
      }

      // 2. Secondary Discovery: Query OpenStreetMap / Overpass API (fallback / supplementary)
      job.progress = 40;
      await job.save();

      let overpassCompanies: any[] = [];
      try {
        overpassCompanies = await overpassClient.search({
          industry,
          keywords,
          city,
          country,
          limit: maxCompanies,
        });
        logger.info(`Job ${jobId}: Overpass discovered ${overpassCompanies.length} entities`);
      } catch (err: any) {
        logger.warn(`Job ${jobId}: Overpass query error: ${err.message}`);
        job.errors.push({
          timestamp: new Date(),
          phase: 'overpass_discovery',
          message: err.message,
        });
      }

      // 3. Query SearXNG (Web Search Verification)
      job.progress = 60;
      await job.save();

      let searxngResults: any[] = [];
      try {
        const sxResponse = await searxngClient.search({
          industry,
          category: job.searchCriteria.category,
          keywords,
          city,
          country,
          limit: maxCompanies,
        });

        if (!sxResponse.isAvailable && sxResponse.errorMessage) {
          job.errors.push({
            timestamp: new Date(),
            phase: 'searxng_discovery',
            message: sxResponse.errorMessage,
          });
        }
        searxngResults = sxResponse.results;
        logger.info(`Job ${jobId}: SearXNG discovered ${searxngResults.length} web results`);
      } catch (err: any) {
        logger.warn(`Job ${jobId}: SearXNG query error: ${err.message}`);
        job.errors.push({
          timestamp: new Date(),
          phase: 'searxng_discovery',
          message: err.message,
        });
      }

      // 4. Process, Normalize & Deduplicate
      job.progress = 75;
      await job.save();

      const processedCompanies = discoveryProcessor.process(
        overpassCompanies,
        searxngResults,
        {
          industry,
          category: job.searchCriteria.category,
          country,
          region,
          city,
          companySize,
        },
        googleMapsCompanies
      );

      const targetCompanies = processedCompanies.slice(0, maxCompanies);

      // 4. Persist to MongoDB with duplicate prevention
      job.progress = 85;
      await job.save();

      let savedCount = 0;
      for (const compData of targetCompanies) {
        try {
          // If domain exists, query by domain
          if (compData.domain) {
            const existing = await Company.findOne({ domain: compData.domain });
            if (existing) {
              // Enrich existing record with newly found phone numbers, emails, and address
              if ((!existing.phoneNumbers || existing.phoneNumbers.length === 0) && compData.phoneNumbers?.length) {
                existing.phoneNumbers = compData.phoneNumbers;
              }
              if ((!existing.emails || existing.emails.length === 0) && compData.emails?.length) {
                existing.emails = compData.emails;
              }
              if (!existing.address && compData.address) {
                existing.address = compData.address;
              }
              if (compData.googleRating && !existing.googleRating) {
                existing.googleRating = compData.googleRating;
              }
              if (compData.googleReviewsCount && !existing.googleReviewsCount) {
                existing.googleReviewsCount = compData.googleReviewsCount;
              }
              if (compData.reviews?.length && (!existing.reviews || existing.reviews.length === 0)) {
                existing.reviews = compData.reviews as any;
              }
              // Append newly discovered sources without overwriting user data
              const existingUrls = new Set(existing.sources.map((s) => s.sourceUrl));
              for (const s of compData.sources) {
                if (!existingUrls.has(s.sourceUrl)) {
                  existing.sources.push(s as any);
                }
              }
              await existing.save();
              savedCount++;
            } else {
              await Company.create(compData);
              savedCount++;
            }
          } else {
            // No domain: query by normalized name + city
            const existing = await Company.findOne({
              normalizedName: compData.normalizedName,
              city: compData.city,
            });
            if (existing) {
              if ((!existing.phoneNumbers || existing.phoneNumbers.length === 0) && compData.phoneNumbers?.length) {
                existing.phoneNumbers = compData.phoneNumbers;
              }
              if ((!existing.emails || existing.emails.length === 0) && compData.emails?.length) {
                existing.emails = compData.emails;
              }
              if (!existing.address && compData.address) {
                existing.address = compData.address;
              }
              if (compData.googleRating && !existing.googleRating) {
                existing.googleRating = compData.googleRating;
              }
              if (compData.googleReviewsCount && !existing.googleReviewsCount) {
                existing.googleReviewsCount = compData.googleReviewsCount;
              }
              if (compData.reviews?.length && (!existing.reviews || existing.reviews.length === 0)) {
                existing.reviews = compData.reviews as any;
              }
              const existingUrls = new Set(existing.sources.map((s) => s.sourceUrl));
              for (const s of compData.sources) {
                if (!existingUrls.has(s.sourceUrl)) {
                  existing.sources.push(s as any);
                }
              }
              await existing.save();
              savedCount++;
            } else {
              await Company.create(compData);
              savedCount++;
            }
          }
        } catch (saveErr: any) {
          logger.warn(`Failed to persist company "${compData.companyName}": ${saveErr.message}`);
          job.failedCount++;
        }
      }

      // 5. Finalize Job
      job.discoveredCount = savedCount;
      job.processedCount = targetCompanies.length;
      job.progress = 100;
      job.status = 'completed';
      job.completedAt = new Date();
      await job.save();

      logger.info(`Job ${jobId} completed successfully: ${savedCount} companies persisted`);
    } catch (fatalErr: any) {
      logger.error(`Job ${jobId} failed with unhandled exception: ${fatalErr.message}`, fatalErr);
      job.status = 'failed';
      job.progress = 100;
      job.completedAt = new Date();
      job.errors.push({
        timestamp: new Date(),
        phase: 'pipeline_execution',
        message: fatalErr.message,
      });
      await job.save();
    }
  }
}

export const discoveryOrchestrator = new DiscoveryOrchestrator();

