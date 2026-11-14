import ExcelJS from 'exceljs';
import { ICompany } from '../../models/Company.js';
import { Company } from '../../models/Company.js';
import { logger } from '../../config/logger.js';

export interface ExportFilterParams {
  industry?: string;
  country?: string;
  city?: string;
  tier?: 'high' | 'medium' | 'low' | '';
  isSaved?: boolean;
  searchJobId?: string;
  companyIds?: string[];
  search?: string;
}

export type CsvExportType = 'companies' | 'decision-makers' | 'ai-opportunities' | 'sources';

export class ExportService {
  /**
   * Builds the MongoDB query filter from query parameters.
   */
  public buildFilter(params: ExportFilterParams): Record<string, any> {
    const filter: Record<string, any> = {};

    if (params.companyIds && params.companyIds.length > 0) {
      filter._id = { $in: params.companyIds };
      return filter;
    }

    if (params.isSaved !== undefined) {
      filter.isSaved = params.isSaved;
    }

    if (params.industry) {
      filter.industry = new RegExp(params.industry, 'i');
    }

    if (params.country) {
      filter.country = new RegExp(params.country, 'i');
    }

    if (params.city) {
      filter.city = new RegExp(params.city, 'i');
    }

    if (params.tier) {
      if (params.tier === 'high') {
        filter.leadScore = { $gte: 80 };
      } else if (params.tier === 'medium') {
        filter.leadScore = { $gte: 50, $lt: 80 };
      } else if (params.tier === 'low') {
        filter.leadScore = { $lt: 50 };
      }
    }

    if (params.search && params.search.trim()) {
      const searchRegex = new RegExp(params.search.trim(), 'i');
      filter.$or = [
        { companyName: searchRegex },
        { domain: searchRegex },
        { industry: searchRegex },
        { services: searchRegex },
        { city: searchRegex },
      ];
    }

    return filter;
  }

  /**
   * Generates a rich, professionally styled 5-tab Excel Workbook.
   */
  public async generateExcelWorkbook(companies: ICompany[]): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'AI Sales Agent Lead Intelligence';
    workbook.created = new Date();

    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
      alignment: { vertical: 'middle', horizontal: 'center' },
    };

    // ==========================================
    // TAB 1: Companies (Master Lead Sheet)
    // ==========================================
    const wsCompanies = workbook.addWorksheet('Companies', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    wsCompanies.columns = [
      { header: 'Company Name', key: 'companyName', width: 28 },
      { header: 'Official Website', key: 'website', width: 32 },
      { header: 'Domain', key: 'domain', width: 22 },
      { header: 'Industry', key: 'industry', width: 20 },
      { header: 'Sub-Category', key: 'category', width: 24 },
      { header: 'City', key: 'city', width: 16 },
      { header: 'Region / State', key: 'region', width: 18 },
      { header: 'Country', key: 'country', width: 16 },
      { header: 'Company Size', key: 'companySize', width: 24 },
      { header: 'Lead Score', key: 'leadScore', width: 14 },
      { header: 'Lead Tier', key: 'leadTier', width: 14 },
      { header: 'Public Emails', key: 'emails', width: 32 },
      { header: 'Phone Numbers', key: 'phones', width: 24 },
      { header: 'Decision Makers Count', key: 'dmCount', width: 22 },
      { header: 'AI Opportunities Count', key: 'aiCount', width: 22 },
      { header: 'Review Status', key: 'reviewStatus', width: 16 },
      { header: 'Is Saved', key: 'isSaved', width: 12 },
      { header: 'Description', key: 'description', width: 45 },
      { header: 'Services Listed', key: 'services', width: 35 },
      { header: 'Discovered Date', key: 'createdAt', width: 18 },
    ];

    wsCompanies.getRow(1).eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' }, // Dark slate
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    wsCompanies.getRow(1).height = 28;

    companies.forEach((comp) => {
      const tier = comp.leadScore >= 80 ? 'HOT (High)' : comp.leadScore >= 50 ? 'Medium' : 'Low';
      const row = wsCompanies.addRow({
        companyName: comp.companyName,
        website: comp.website || '',
        domain: comp.domain || '',
        industry: comp.industry || '',
        category: comp.category || '',
        city: comp.city || '',
        region: comp.region || '',
        country: comp.country || '',
        companySize: comp.companySize || 'Unknown',
        leadScore: comp.leadScore,
        leadTier: tier,
        emails: (comp.emails || []).join(', '),
        phones: (comp.phoneNumbers || []).join(', '),
        dmCount: comp.decisionMakers ? comp.decisionMakers.length : 0,
        aiCount: comp.aiAnalysis?.opportunities ? comp.aiAnalysis.opportunities.length : 0,
        reviewStatus: comp.reviewStatus || 'new',
        isSaved: comp.isSaved ? 'YES' : 'NO',
        description: comp.description || '',
        services: (comp.services || []).join(', '),
        createdAt: comp.createdAt ? new Date(comp.createdAt).toLocaleDateString() : '',
      });
      row.height = 20;
    });

    // ==========================================
    // TAB 2: Decision Makers
    // ==========================================
    const wsDM = workbook.addWorksheet('Decision Makers', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    wsDM.columns = [
      { header: 'Company Name', key: 'companyName', width: 28 },
      { header: 'Full Name', key: 'fullName', width: 24 },
      { header: 'Job Title / Role', key: 'jobTitle', width: 26 },
      { header: 'Confidence', key: 'confidence', width: 15 },
      { header: 'Public Business Email', key: 'email', width: 30 },
      { header: 'Professional Profile URL', key: 'profileUrl', width: 36 },
      { header: 'Discovery Status', key: 'status', width: 16 },
      { header: 'Evidence / Supporting Text', key: 'evidence', width: 45 },
      { header: 'Source URL', key: 'sourceUrl', width: 36 },
    ];

    wsDM.getRow(1).eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF065F46' }, // Dark emerald
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    wsDM.getRow(1).height = 28;

    companies.forEach((comp) => {
      if (comp.decisionMakers && comp.decisionMakers.length > 0) {
        comp.decisionMakers.forEach((dm) => {
          const row = wsDM.addRow({
            companyName: comp.companyName,
            fullName: dm.fullName,
            jobTitle: dm.jobTitle,
            confidence: (dm.confidence || 'medium').toUpperCase(),
            email: dm.publicBusinessEmail || 'Not Listed',
            profileUrl: dm.professionalProfileUrl || '',
            status: dm.discoveryStatus || 'identified',
            evidence: dm.evidence || '',
            sourceUrl: dm.sourceUrl || comp.website || '',
          });
          row.height = 20;
        });
      }
    });

    // ==========================================
    // TAB 3: AI Opportunities
    // ==========================================
    const wsAI = workbook.addWorksheet('AI Opportunities', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    wsAI.columns = [
      { header: 'Company Name', key: 'companyName', width: 28 },
      { header: 'Industry', key: 'industry', width: 18 },
      { header: 'Opportunity Title', key: 'title', width: 32 },
      { header: 'Business Problem / Bottleneck', key: 'problem', width: 40 },
      { header: 'Recommended AI Solution', key: 'solution', width: 40 },
      { header: 'How It Works (Operational Flow)', key: 'howItWorks', width: 45 },
      { header: 'Expected Benefits & ROI', key: 'benefits', width: 38 },
      { header: 'Why Needed Urgently', key: 'whyNeeded', width: 38 },
      { header: 'Complexity', key: 'complexity', width: 15 },
      { header: 'Impact', key: 'impact', width: 15 },
      { header: 'Confidence', key: 'confidence', width: 15 },
      { header: 'Supporting Evidence', key: 'evidence', width: 40 },
    ];

    wsAI.getRow(1).eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF312E81' }, // Indigo
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    wsAI.getRow(1).height = 28;

    companies.forEach((comp) => {
      if (comp.aiAnalysis?.opportunities && comp.aiAnalysis.opportunities.length > 0) {
        comp.aiAnalysis.opportunities.forEach((opp) => {
          const row = wsAI.addRow({
            companyName: comp.companyName,
            industry: comp.industry || '',
            title: opp.title,
            problem: opp.businessProblem,
            solution: opp.recommendedSolution,
            howItWorks: opp.howItWorks,
            benefits: opp.benefits,
            whyNeeded: opp.whyNeeded,
            complexity: (opp.implementationComplexity || 'medium').toUpperCase(),
            impact: (opp.potentialImpact || 'high').toUpperCase(),
            confidence: (opp.confidence || 'high').toUpperCase(),
            evidence: opp.supportingEvidence || '',
          });
          row.height = 20;
        });
      }
    });

    // ==========================================
    // TAB 4: Data Sources & Citations
    // ==========================================
    const wsSources = workbook.addWorksheet('Data Sources', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    wsSources.columns = [
      { header: 'Company Name', key: 'companyName', width: 28 },
      { header: 'Source Type', key: 'sourceType', width: 20 },
      { header: 'Extracted Field', key: 'extractedField', width: 22 },
      { header: 'Source URL', key: 'sourceUrl', width: 42 },
      { header: 'Supporting Evidence / Snippet', key: 'supportingText', width: 50 },
      { header: 'Fetched Timestamp', key: 'fetchedAt', width: 22 },
    ];

    wsSources.getRow(1).eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF334155' }, // Slate
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    wsSources.getRow(1).height = 28;

    companies.forEach((comp) => {
      if (comp.sources && comp.sources.length > 0) {
        comp.sources.forEach((src) => {
          const row = wsSources.addRow({
            companyName: comp.companyName,
            sourceType: src.sourceType,
            extractedField: src.extractedField || 'general',
            sourceUrl: src.sourceUrl,
            supportingText: src.supportingText || '',
            fetchedAt: src.fetchedAt ? new Date(src.fetchedAt).toLocaleString() : '',
          });
          row.height = 20;
        });
      }
    });

    // ==========================================
    // TAB 5: Lead Scoring Breakdown
    // ==========================================
    const wsScoring = workbook.addWorksheet('Scoring Breakdown', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    wsScoring.columns = [
      { header: 'Company Name', key: 'companyName', width: 28 },
      { header: 'Total Score (0–100)', key: 'leadScore', width: 20 },
      { header: 'Relevance Tier', key: 'tier', width: 16 },
      { header: 'Industry Fit (/20)', key: 'industryScore', width: 18 },
      { header: 'Operational Scale (/20)', key: 'scaleScore', width: 22 },
      { header: 'AI Opportunities (/30)', key: 'oppScore', width: 22 },
      { header: 'Decision Makers (/15)', key: 'dmScore', width: 22 },
      { header: 'Contactability (/15)', key: 'contactScore', width: 20 },
      { header: 'Score Explanation', key: 'explanation', width: 60 },
    ];

    wsScoring.getRow(1).eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF854D0E' }, // Amber brown
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    wsScoring.getRow(1).height = 28;

    companies.forEach((comp) => {
      const b = comp.aiAnalysis?.scoreBreakdown;
      const tier = comp.leadScore >= 80 ? 'HIGH' : comp.leadScore >= 50 ? 'MEDIUM' : 'LOW';
      const row = wsScoring.addRow({
        companyName: comp.companyName,
        leadScore: comp.leadScore,
        tier,
        industryScore: b?.industryAlignment ?? (comp.leadScore > 60 ? 16 : 10),
        scaleScore: b?.operationalComplexity ?? (comp.companySize && comp.companySize !== 'Unknown' ? 14 : 6),
        oppScore: b?.opportunityQuality ?? (comp.aiAnalysis?.opportunities?.length ? 22 : 8),
        dmScore: b?.decisionMakerAvailability ?? (comp.decisionMakers?.length ? 15 : 0),
        contactScore: b?.contactability ?? (comp.emails?.length ? 12 : 5),
        explanation: comp.aiAnalysis?.scoreExplanation || `Lead score of ${comp.leadScore}/100 based on verified attributes.`,
      });
      row.height = 20;
    });

    return workbook;
  }

  /**
   * Generates specialized CSV files according to type:
   * 'companies' | 'decision-makers' | 'ai-opportunities' | 'sources'
   */
  public async generateCsv(companies: ICompany[], type: CsvExportType = 'companies'): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Export');

    if (type === 'decision-makers') {
      worksheet.columns = [
        { header: 'Company Name', key: 'companyName' },
        { header: 'Full Name', key: 'fullName' },
        { header: 'Job Title', key: 'jobTitle' },
        { header: 'Confidence', key: 'confidence' },
        { header: 'Public Business Email', key: 'email' },
        { header: 'Professional Profile URL', key: 'profileUrl' },
        { header: 'Evidence', key: 'evidence' },
        { header: 'Source URL', key: 'sourceUrl' },
      ];

      companies.forEach((comp) => {
        (comp.decisionMakers || []).forEach((dm) => {
          worksheet.addRow({
            companyName: comp.companyName,
            fullName: dm.fullName,
            jobTitle: dm.jobTitle,
            confidence: dm.confidence,
            email: dm.publicBusinessEmail || '',
            profileUrl: dm.professionalProfileUrl || '',
            evidence: dm.evidence || '',
            sourceUrl: dm.sourceUrl || '',
          });
        });
      });
    } else if (type === 'ai-opportunities') {
      worksheet.columns = [
        { header: 'Company Name', key: 'companyName' },
        { header: 'Industry', key: 'industry' },
        { header: 'Opportunity Title', key: 'title' },
        { header: 'Business Problem', key: 'problem' },
        { header: 'Recommended Solution', key: 'solution' },
        { header: 'Expected Benefits & ROI', key: 'benefits' },
        { header: 'Why Needed', key: 'whyNeeded' },
        { header: 'Implementation Complexity', key: 'complexity' },
        { header: 'Potential Impact', key: 'impact' },
        { header: 'Confidence', key: 'confidence' },
      ];

      companies.forEach((comp) => {
        (comp.aiAnalysis?.opportunities || []).forEach((opp) => {
          worksheet.addRow({
            companyName: comp.companyName,
            industry: comp.industry || '',
            title: opp.title,
            problem: opp.businessProblem,
            solution: opp.recommendedSolution,
            benefits: opp.benefits,
            whyNeeded: opp.whyNeeded,
            complexity: opp.implementationComplexity || 'medium',
            impact: opp.potentialImpact || 'high',
            confidence: opp.confidence || 'high',
          });
        });
      });
    } else if (type === 'sources') {
      worksheet.columns = [
        { header: 'Company Name', key: 'companyName' },
        { header: 'Source Type', key: 'sourceType' },
        { header: 'Extracted Field', key: 'extractedField' },
        { header: 'Source URL', key: 'sourceUrl' },
        { header: 'Supporting Snippet', key: 'supportingText' },
        { header: 'Fetched Timestamp', key: 'fetchedAt' },
      ];

      companies.forEach((comp) => {
        (comp.sources || []).forEach((src) => {
          worksheet.addRow({
            companyName: comp.companyName,
            sourceType: src.sourceType,
            extractedField: src.extractedField || '',
            sourceUrl: src.sourceUrl,
            supportingText: src.supportingText || '',
            fetchedAt: src.fetchedAt ? new Date(src.fetchedAt).toISOString() : '',
          });
        });
      });
    } else {
      // Default: companies master CSV
      worksheet.columns = [
        { header: 'Company Name', key: 'companyName' },
        { header: 'Website', key: 'website' },
        { header: 'Domain', key: 'domain' },
        { header: 'Industry', key: 'industry' },
        { header: 'Category', key: 'category' },
        { header: 'City', key: 'city' },
        { header: 'Country', key: 'country' },
        { header: 'Company Size', key: 'companySize' },
        { header: 'Lead Score', key: 'leadScore' },
        { header: 'Lead Tier', key: 'leadTier' },
        { header: 'Emails', key: 'emails' },
        { header: 'Phone Numbers', key: 'phones' },
        { header: 'Decision Makers', key: 'decisionMakers' },
        { header: 'AI Opportunities Count', key: 'aiCount' },
        { header: 'Review Status', key: 'reviewStatus' },
        { header: 'Is Saved', key: 'isSaved' },
        { header: 'Created At', key: 'createdAt' },
      ];

      companies.forEach((comp) => {
        const tier = comp.leadScore >= 80 ? 'HIGH' : comp.leadScore >= 50 ? 'MEDIUM' : 'LOW';
        worksheet.addRow({
          companyName: comp.companyName,
          website: comp.website || '',
          domain: comp.domain || '',
          industry: comp.industry || '',
          category: comp.category || '',
          city: comp.city || '',
          country: comp.country || '',
          companySize: comp.companySize || 'Unknown',
          leadScore: comp.leadScore,
          leadTier: tier,
          emails: (comp.emails || []).join('; '),
          phones: (comp.phoneNumbers || []).join('; '),
          decisionMakers: (comp.decisionMakers || []).map((dm) => `${dm.fullName} (${dm.jobTitle})`).join('; '),
          aiCount: comp.aiAnalysis?.opportunities?.length || 0,
          reviewStatus: comp.reviewStatus || 'new',
          isSaved: comp.isSaved ? 'YES' : 'NO',
          createdAt: comp.createdAt ? new Date(comp.createdAt).toISOString() : '',
        });
      });
    }

    const csvBuffer = await workbook.csv.writeBuffer();
    return csvBuffer.toString();
  }
}

export const exportService = new ExportService();

