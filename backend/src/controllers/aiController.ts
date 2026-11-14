import { Request, Response } from 'express';
import { Company } from '../models/Company.js';
import { geminiClient } from '../services/ai/geminiClient.js';
import { logger } from '../config/logger.js';

export const analyzeCompany = async (req: Request, res: Response): Promise<void> => {
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

    company.analysisStatus = 'analyzing';
    await company.save();

    logger.info(`Starting Gemini AI research & automation opportunity analysis for ${company.companyName}`);

    const analysis = await geminiClient.analyzeCompany({
      companyName: company.companyName,
      industry: company.industry,
      category: company.category,
      description: company.description,
      services: company.services,
      products: company.products,
      country: company.country,
      city: company.city,
      companySize: company.companySize,
      emails: company.emails,
      phoneNumbers: company.phoneNumbers,
      decisionMakers: company.decisionMakers?.map((dm) => ({
        fullName: dm.fullName,
        jobTitle: dm.jobTitle,
        confidence: dm.confidence,
      })),
      website: company.website,
      desiredServices: req.body?.desiredServices || [],
      googleRating: company.googleRating,
      googleReviewsCount: company.googleReviewsCount,
      reviews: company.reviews?.map((r) => ({
        author: r.author,
        rating: r.rating,
        text: r.text,
        publishAt: r.publishAt,
      })),
      jobPostings: company.jobPostings?.map((j) => ({
        title: j.title,
        platform: j.platform,
        location: j.location,
        salary: j.salary,
        datePosted: j.datePosted,
        descriptionSnippet: j.descriptionSnippet,
      })),
    });

    company.aiAnalysis = analysis;
    company.leadScore = analysis.leadScore;
    company.analysisStatus = 'completed';

    // Append provenance source record
    company.sources.push({
      sourceUrl: company.website || 'https://ai.google.dev',
      sourceType: 'gemini_analysis',
      extractedField: 'ai_analysis',
      supportingText: `Google Gemini (${analysis.modelUsed || 'Gemini'}): ${analysis.scoreExplanation}`,
      fetchedAt: new Date(),
    } as any);

    await company.save();

    res.json({
      success: true,
      message: 'Google Gemini AI research and automation opportunities generated successfully',
      data: {
        companyId: company._id,
        companyName: company.companyName,
        leadScore: company.leadScore,
        analysisStatus: company.analysisStatus,
        aiAnalysis: company.aiAnalysis,
      },
    });
  } catch (error: any) {
    logger.error('Error during AI analysis', error);
    try {
      await Company.findByIdAndUpdate(req.params.id, { analysisStatus: 'failed' });
    } catch {
      // Ignored
    }
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Error executing Google Gemini AI analysis' },
    });
  }
};

export const getCompanyAnalysis = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const company = await Company.findById(id).select('companyName aiAnalysis leadScore analysisStatus').lean();

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
        analysisStatus: company.analysisStatus,
        leadScore: company.leadScore,
        aiAnalysis: company.aiAnalysis || null,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Error fetching AI analysis' },
    });
  }
};
