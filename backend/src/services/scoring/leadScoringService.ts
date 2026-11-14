import { ICompany, IAIScoreBreakdown } from '../../models/Company.js';
import { Company } from '../../models/Company.js';
import { logger } from '../../config/logger.js';

export type LeadTier = 'high' | 'medium' | 'low';

export interface LeadScoreResult {
  totalScore: number;
  tier: LeadTier;
  breakdown: IAIScoreBreakdown;
  explanation: string;
  factorDetails: {
    industryFitReason: string;
    scaleReason: string;
    opportunitiesReason: string;
    decisionMakersReason: string;
    contactabilityReason: string;
  };
}

// Industry categories ranked by automation potential
const HIGH_AUTOMATION_INDUSTRIES = new Set([
  'manufacturing',
  'logistics',
  'healthcare',
  'e-commerce',
  'ecommerce',
  'finance',
  'technology',
  'supply chain',
]);

const MODERATE_AUTOMATION_INDUSTRIES = new Set([
  'retail',
  'real estate',
  'professional services',
  'automotive',
  'construction',
  'telecommunications',
  'legal',
  'insurance',
]);

export class LeadScoringService {
  /**
   * Evaluates the 0–100 lead score based on 5 objective, explainable dimensions.
   */
  public calculateScore(company: Partial<ICompany>): LeadScoreResult {
    // 1. Industry Fit (0 to 20 points)
    const { score: industryAlignment, reason: industryFitReason } = this.evaluateIndustryFit(company.industry, company.category);

    // 2. Company Scale & Operational Complexity (0 to 20 points)
    const { score: operationalComplexity, reason: scaleReason } = this.evaluateScaleAndComplexity(company.companySize);

    // 3. Quality of AI Automation Opportunities (0 to 30 points)
    const { score: opportunityQuality, reason: opportunitiesReason } = this.evaluateOpportunities(company);

    // 4. Decision-Maker Availability (0 to 15 points)
    const { score: decisionMakerAvailability, reason: decisionMakersReason } = this.evaluateDecisionMakers(company.decisionMakers);

    // 5. Contactability & Data Quality (0 to 15 points)
    const { score: contactability, reason: contactabilityReason } = this.evaluateContactability(company);

    const totalScore = Math.min(
      Math.max(
        industryAlignment + operationalComplexity + opportunityQuality + decisionMakerAvailability + contactability,
        0
      ),
      100
    );

    const tier = this.getTier(totalScore);

    const breakdown: IAIScoreBreakdown = {
      industryAlignment,
      operationalComplexity,
      opportunityQuality,
      decisionMakerAvailability,
      contactability,
    };

    const explanation = `Score of ${totalScore}/100 (${tier.toUpperCase()} relevance). Breakdown: Industry fit (${industryAlignment}/20), Operational scale (${operationalComplexity}/20), Automation opportunities (${opportunityQuality}/30), Decision-makers (${decisionMakerAvailability}/15), Contactability (${contactability}/15).`;

    return {
      totalScore,
      tier,
      breakdown,
      explanation,
      factorDetails: {
        industryFitReason,
        scaleReason,
        opportunitiesReason,
        decisionMakersReason,
        contactabilityReason,
      },
    };
  }

  public getTier(score: number): LeadTier {
    if (score >= 80) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }

  private evaluateIndustryFit(industry?: string, category?: string): { score: number; reason: string } {
    const raw = `${industry || ''} ${category || ''}`.toLowerCase().trim();

    for (const highInd of HIGH_AUTOMATION_INDUSTRIES) {
      if (raw.includes(highInd)) {
        return {
          score: 18,
          reason: `High automation potential industry (${industry || 'Technology/Logistics'}). High volume operational workflows.`,
        };
      }
    }

    for (const modInd of MODERATE_AUTOMATION_INDUSTRIES) {
      if (raw.includes(modInd)) {
        return {
          score: 13,
          reason: `Moderate automation potential industry (${industry || 'Commercial'}). Moderate administrative and customer workflows.`,
        };
      }
    }

    return {
      score: 8,
      reason: `Standard or unclassified industry (${industry || 'Other'}). Lower baseline automation priority.`,
    };
  }

  private evaluateScaleAndComplexity(companySize?: string): { score: number; reason: string } {
    switch (companySize) {
      case 'Enterprise: 1000+ employees':
        return { score: 20, reason: 'Enterprise-scale organization (1000+ employees). High operational complexity.' };
      case 'Large: 251–1000 employees':
        return { score: 17, reason: 'Large organization (251–1000 employees). Substantial division workflows.' };
      case 'Medium: 51–250 employees':
        return { score: 14, reason: 'Mid-market organization (51–250 employees). Ideal target for fast-ROI automation.' };
      case 'Small: 1–50 employees':
        return { score: 10, reason: 'Small business (1–50 employees). Agile decision-making, leaner operations.' };
      default:
        return { score: 6, reason: 'Company size not yet confirmed by verifiable public records.' };
    }
  }

  private evaluateOpportunities(company: Partial<ICompany>): { score: number; reason: string } {
    const opportunities = company.aiAnalysis?.opportunities || [];
    if (opportunities.length === 0) {
      // If no AI opportunities generated yet, assign baseline if description or services exist
      if (company.services && company.services.length > 0) {
        return {
          score: 8,
          reason: `${company.services.length} business services indexed; AI opportunity assessment pending.`,
        };
      }
      return { score: 0, reason: 'No AI automation opportunities generated yet.' };
    }

    const highImpactCount = opportunities.filter((o) => o.confidence === 'high' || o.potentialImpact === 'high').length;

    if (highImpactCount >= 3) {
      return {
        score: 28,
        reason: `${highImpactCount} high-impact automation opportunities backed by confirmed business evidence.`,
      };
    }
    if (highImpactCount >= 2 || opportunities.length >= 3) {
      return {
        score: 22,
        reason: `${opportunities.length} tailored automation solutions identified (${highImpactCount} high-impact).`,
      };
    }
    if (opportunities.length >= 1) {
      return {
        score: 14,
        reason: `${opportunities.length} automation opportunity identified for company workflows.`,
      };
    }

    return { score: 6, reason: 'Baseline automation opportunities identified.' };
  }

  private evaluateDecisionMakers(decisionMakers?: any[]): { score: number; reason: string } {
    if (!decisionMakers || decisionMakers.length === 0) {
      return { score: 0, reason: 'No decision-makers verified from public leadership pages yet.' };
    }

    const cLevelPattern = /(?:chief\s+executive\s+officer|ceo|co-founder|founder|owner|managing\s+director|president)/i;

    const hasCLevelWithProfile = decisionMakers.some(
      (dm) => cLevelPattern.test(dm.jobTitle) && Boolean(dm.professionalProfileUrl)
    );
    if (hasCLevelWithProfile) {
      return {
        score: 15,
        reason: 'C-Level executive or Founder verified with public professional profile URL.',
      };
    }

    const hasCLevel = decisionMakers.some((dm) => cLevelPattern.test(dm.jobTitle));
    if (hasCLevel) {
      return {
        score: 12,
        reason: 'C-Level executive or Founder identified from official leadership team.',
      };
    }

    const hasDirectorOrManager = decisionMakers.some((dm) =>
      /(?:director|operations|sales|head|manager|coo|cro)/i.test(dm.jobTitle)
    );
    if (hasDirectorOrManager) {
      return {
        score: 9,
        reason: 'Department director or operations leader identified.',
      };
    }

    return {
      score: 6,
      reason: `${decisionMakers.length} team member(s) identified from company pages.`,
    };
  }

  private evaluateContactability(company: Partial<ICompany>): { score: number; reason: string } {
    const hasEmail = Boolean(company.emails && company.emails.length > 0);
    const hasPhone = Boolean(company.phoneNumbers && company.phoneNumbers.length > 0);
    const hasWebsite = Boolean(company.website);

    if (hasEmail && hasPhone) {
      return {
        score: 15,
        reason: `Full contact points verified: ${company.emails?.length} email(s) and ${company.phoneNumbers?.length} phone(s).`,
      };
    }
    if (hasEmail) {
      return {
        score: 11,
        reason: `Direct business email verified: ${company.emails?.[0]}.`,
      };
    }
    if (hasPhone) {
      return {
        score: 8,
        reason: `Public phone number verified: ${company.phoneNumbers?.[0]}.`,
      };
    }
    if (hasWebsite) {
      return {
        score: 4,
        reason: 'Official company website recorded, direct business contact pending extraction.',
      };
    }

    return { score: 0, reason: 'No public website or contact points indexed yet.' };
  }

  /**
   * Recalculates and persists lead score for a single company by ID.
   */
  public async reScoreCompanyById(id: string): Promise<ICompany | null> {
    const company = await Company.findById(id);
    if (!company) return null;

    const result = this.calculateScore(company);
    company.leadScore = result.totalScore;

    if (!company.aiAnalysis) {
      company.aiAnalysis = {
        problems: [],
        opportunities: [],
        leadScore: result.totalScore,
        scoreBreakdown: result.breakdown,
        scoreExplanation: result.explanation,
        evidence: [],
        missingInformation: [],
      };
    } else {
      company.aiAnalysis.leadScore = result.totalScore;
      company.aiAnalysis.scoreBreakdown = result.breakdown;
      company.aiAnalysis.scoreExplanation = result.explanation;
    }

    await company.save();
    logger.info(`Re-scored company ${company.companyName}: ${result.totalScore}/100 (${result.tier})`);
    return company;
  }

  /**
   * Recalculates lead scores across all companies in the database.
   */
  public async reScoreAllCompanies(): Promise<{ totalProcessed: number; updatedCount: number }> {
    const companies = await Company.find();
    let updatedCount = 0;

    for (const company of companies) {
      const result = this.calculateScore(company);
      if (company.leadScore !== result.totalScore) {
        company.leadScore = result.totalScore;
        if (!company.aiAnalysis) {
          company.aiAnalysis = {
            problems: [],
            opportunities: [],
            leadScore: result.totalScore,
            scoreBreakdown: result.breakdown,
            scoreExplanation: result.explanation,
            evidence: [],
            missingInformation: [],
          };
        } else {
          company.aiAnalysis.leadScore = result.totalScore;
          company.aiAnalysis.scoreBreakdown = result.breakdown;
          company.aiAnalysis.scoreExplanation = result.explanation;
        }
        await company.save();
        updatedCount++;
      }
    }

    logger.info(`Re-scoring completed: processed ${companies.length} companies, updated ${updatedCount}.`);
    return {
      totalProcessed: companies.length,
      updatedCount,
    };
  }
}

export const leadScoringService = new LeadScoringService();
