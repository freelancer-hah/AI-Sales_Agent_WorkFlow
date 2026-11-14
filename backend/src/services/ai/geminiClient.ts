import { GoogleGenAI } from '@google/genai';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { IAIAnalysis, IAIOpportunity, IAIProblem } from '../../models/Company.js';

export interface CompanyAnalysisInput {
  companyName: string;
  industry: string;
  category?: string;
  description?: string;
  services?: string[];
  products?: string[];
  country?: string;
  city?: string;
  companySize?: string;
  emails?: string[];
  phoneNumbers?: string[];
  decisionMakers?: Array<{ fullName: string; jobTitle: string; confidence?: string }>;
  website?: string;
  desiredServices?: string[];
  googleRating?: number;
  googleReviewsCount?: number;
  reviews?: Array<{
    author?: string;
    rating?: number;
    text?: string;
    publishAt?: string;
  }>;
  jobPostings?: Array<{
    title: string;
    platform: string;
    location?: string;
    salary?: string;
    datePosted?: string;
    descriptionSnippet?: string;
  }>;
}

export class GeminiClient {
  private client: GoogleGenAI | null = null;
  private primaryModel: string;
  private fallbackModels: string[];

  constructor() {
    this.primaryModel = env.GEMINI_MODEL || 'gemini-3.5-flash';
    this.fallbackModels = [
      this.primaryModel,
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-2.5-flash-lite',
      'gemini-3.8-flash',
      'gemini-flash-latest',
      'gemini-pro-latest',
    ];

    if (env.GEMINI_API_KEY) {
      this.client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    } else {
      logger.warn('GEMINI_API_KEY is not set. Gemini AI research agent will run in simulated mode.');
    }
  }

  public isConfigured(): boolean {
    return Boolean(env.GEMINI_API_KEY);
  }

  public getModelName(): string {
    return this.primaryModel;
  }

  public async analyzeCompany(input: CompanyAnalysisInput): Promise<IAIAnalysis> {
    if (!this.client || !env.GEMINI_API_KEY) {
      throw new Error('Google Gemini API Key is not configured. Please set GEMINI_API_KEY in backend/.env to analyze companies.');
    }

    const prompt = this.buildPrompt(input);
    let lastError: any = null;

    // Try primary model, then fallbacks if 503 (demand spike) or 404 (model deprecated) occurs
    for (const model of this.fallbackModels) {
      try {
        logger.info(`Sending company research request to Gemini model: ${model} for ${input.companyName}`);

        const response = await this.client.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.2, // Low temperature for factual, grounded reasoning
          },
        });

        const rawText = response.text || '';
        if (!rawText.trim()) {
          throw new Error('Gemini API returned an empty response text.');
        }

        const parsed = JSON.parse(rawText);
        const validated = this.validateAndNormalizeResponse(parsed, model, input);
        logger.info(`Gemini analysis completed successfully using model ${model} for ${input.companyName} (LeadScore: ${validated.leadScore})`);
        return validated;
      } catch (err: any) {
        lastError = err;
        logger.warn(`Gemini generation with ${model} failed (${err.message}). Trying next fallback if available...`);
      }
    }

    logger.error('All Gemini model candidates failed to generate analysis.', lastError);
    throw new Error(`Google Gemini API Error: ${lastError?.message || 'Failed to generate AI analysis'}. Please verify your GEMINI_API_KEY and model in backend/.env.`);
  }

  private buildPrompt(input: CompanyAnalysisInput): string {
    const desired = input.desiredServices && input.desiredServices.length > 0
      ? input.desiredServices.join(', ')
      : 'AI Customer Support, AI Chatbots, Sales Automation, Workflow Automation, Document Processing, Data Entry Automation, AI Business Analytics';

    return `You are a Senior Enterprise AI Automation Architect and B2B Lead Intelligence Specialist.
Your objective is to perform an in-depth research and automation opportunity assessment for the company described below.

CRITICAL INSTRUCTIONS:
1. Base all findings strictly on the verified company data provided. Never invent facts, false products, or fictional clients.
2. Clearly distinguish between confirmed facts and reasonable business hypotheses.
3. For every identified business problem or operational bottleneck, state whether it is an empirical fact or hypothesis, and reference supporting evidence from the extracted company text.
4. For every automation opportunity:
   - Provide concrete, technical, and practical AI solutions (e.g. LLM-based document extraction, automated customer support triage, inventory forecasting models).
   - Align with user-specified target services where relevant: ${desired}.
   - Detail the business problem addressed, how the solution works step-by-step, expected ROI/benefits, why this specific company needs it, supporting evidence, implementation complexity (low/medium/high), potential impact (low/medium/high), and confidence (low/medium/high).
5. Explicitly list any missing or unclear operational details in "missingInformation".
6. REPUTATION & CUSTOMER COMPLAINTS ANALYSIS (CRITICAL FOR EMPIRICAL PAIN POINTS):
   - Scrutinize the verified Google Maps customer reviews below (especially 1-star, 2-star, and 3-star reviews).
   - Identify tangible, real-world customer complaints (e.g. slow response, unanswered calls, booking confusion, delayed shipments, lack of self-service, staff confusion).
   - Whenever a pain point originates from an actual customer review, set "hypothesis": false, and quote the exact review text in "evidence"!
   - For every verified complaint, synthesize a high-converting Cybells AI Automation Solution (e.g. 24/7 AI Voice/Chat Receptionist, Automated WhatsApp Order Tracking, AI Knowledge Base).
7. HIRING SIGNALS & OPERATIONAL OVERLOAD (JOBSPY INTELLIGENCE):
   - Scrutinize any active open job postings listed below (scraped from LinkedIn, Indeed, Glassdoor, and Google Jobs via JobSpy).
   - If the company is actively hiring for manual, shift-based, or repetitive human tasks (such as customer support, telemarketing, data entry, invoice processing, order tracking), treat this as high-intent operational bottleneck evidence!
   - Highlight the financial burden of recruiting and salaries (e.g. $45k/yr), and contrast it with Cybells AI autonomous software handling the exact same tasks for a fraction of the cost.
8. Calculate an explainable lead relevance score (0–100) based on these 5 factors:
   - Industry alignment (0–20): How well suited the company's industry and operations are for AI solutions.
   - Company operational complexity / size (0–20): Estimated operational scale, transactions, or staff structure.
   - Quality of identified automation opportunities (0–30): Feasibility, potential impact, and clear evidence (higher if supported by real customer reviews or active job postings).
   - Availability of decision-makers (0–15): Higher if CEOs, Founders, or Operations Managers are already identified.
   - Contactability (0–15): Higher if direct public business emails and phones are verified.
   Total leadScore = sum of all 5 components (must be an integer 0–100).
   Provide a concise, explainable "scoreExplanation" justifying this calculation.

COMPANY DOSSIER:
- Company Name: ${input.companyName}
- Industry / Category: ${input.industry} / ${input.category || 'General'}
- Website: ${input.website || 'Not recorded'}
- Location: ${[input.city, input.country].filter(Boolean).join(', ') || 'Not recorded'}
- Company Size: ${input.companySize || 'Unknown'}
- Public Business Description: ${input.description || 'Not provided'}
- Stated Services: ${input.services?.length ? input.services.join(', ') : 'None explicitly listed'}
- Stated Products: ${input.products?.length ? input.products.join(', ') : 'None explicitly listed'}
- Public Contact Details: Emails: ${input.emails?.join(', ') || 'None'}; Phone: ${input.phoneNumbers?.join(', ') || 'None'}
- Identified Decision-Makers: ${input.decisionMakers?.length ? input.decisionMakers.map(dm => `${dm.fullName} (${dm.jobTitle})`).join('; ') : 'None identified yet'}
- Google Maps Reputation: ${input.googleRating ? `${input.googleRating}★ (${input.googleReviewsCount || input.reviews?.length || 0} reviews)` : 'Unrated'}
- Verified Google Maps Customer Reviews (${input.reviews?.length || 0} reviews available):
${input.reviews && input.reviews.length > 0
  ? input.reviews.slice(0, 15).map(r => `  • [${r.rating ? `${r.rating}★` : 'Review'} by ${r.author || 'Customer'}]: "${r.text || 'No comment text'}"`).join('\n')
  : '  • No customer reviews scraped yet.'}
- Active Job Postings & Hiring Signals (${input.jobPostings?.length || 0} open positions scraped via JobSpy):
${input.jobPostings && input.jobPostings.length > 0
  ? input.jobPostings.slice(0, 10).map(j => `  • [${j.title} on ${j.platform}]: "${j.descriptionSnippet || 'No snippet'}" (Salary: ${j.salary || 'Unstated'}, Location: ${j.location || 'Unspecified'})`).join('\n')
  : '  • No active job postings recorded yet.'}

RETURN ONLY A VALID JSON OBJECT conforming to this exact structure:
{
  "problems": [
    {
      "title": "Short title of operational bottleneck or pain point",
      "problem": "Detailed explanation of the issue or workflow constraint",
      "hypothesis": true,
      "evidence": "Supporting quote or observation from company details"
    }
  ],
  "opportunities": [
    {
      "title": "Opportunity Title (e.g., Automated Client Invoicing & Document Processing)",
      "businessProblem": "Specific operational challenge addressed",
      "recommendedSolution": "Recommended AI / Automation Solution",
      "howItWorks": "Step-by-step operational workflow of the proposed system",
      "benefits": "Tangible business benefits, cost savings, or efficiency gains",
      "whyNeeded": "Why this specific company urgently needs this solution",
      "supportingEvidence": "Direct quote or fact from company profile",
      "implementationComplexity": "low" | "medium" | "high",
      "potentialImpact": "low" | "medium" | "high",
      "confidence": "high" | "medium" | "low"
    }
  ],
  "leadScore": 75,
  "scoreBreakdown": {
    "industryAlignment": 18,
    "operationalComplexity": 14,
    "opportunityQuality": 25,
    "decisionMakerAvailability": 10,
    "contactability": 8
  },
  "scoreExplanation": "Comprehensive rationale explaining why this score was awarded across all 5 evaluation criteria.",
  "evidence": ["Evidence point 1", "Evidence point 2"],
  "missingInformation": ["List of missing or unconfirmed facts"]
}`;
  }

  private validateAndNormalizeResponse(raw: any, modelUsed: string, input: CompanyAnalysisInput): IAIAnalysis {
    const problems: IAIProblem[] = Array.isArray(raw.problems)
      ? raw.problems.map((p: any) => ({
          title: String(p.title || 'Operational Bottleneck').trim(),
          problem: String(p.problem || '').trim(),
          hypothesis: Boolean(p.hypothesis !== false),
          evidence: String(p.evidence || '').trim(),
        }))
      : [];

    const opportunities: IAIOpportunity[] = Array.isArray(raw.opportunities)
      ? raw.opportunities.map((o: any) => ({
          title: String(o.title || 'AI Automation Solution').trim(),
          businessProblem: String(o.businessProblem || '').trim(),
          recommendedSolution: String(o.recommendedSolution || '').trim(),
          howItWorks: String(o.howItWorks || '').trim(),
          benefits: String(o.benefits || '').trim(),
          whyNeeded: String(o.whyNeeded || '').trim(),
          supportingEvidence: String(o.supportingEvidence || '').trim(),
          implementationComplexity: ['low', 'medium', 'high'].includes(o.implementationComplexity)
            ? o.implementationComplexity
            : 'medium',
          potentialImpact: ['low', 'medium', 'high'].includes(o.potentialImpact)
            ? o.potentialImpact
            : 'high',
          confidence: ['high', 'medium', 'low'].includes(o.confidence)
            ? o.confidence
            : 'medium',
        }))
      : [];

    const breakdown = raw.scoreBreakdown || {};
    const industryAlignment = Math.min(Math.max(Number(breakdown.industryAlignment) || 12, 0), 20);
    const operationalComplexity = Math.min(Math.max(Number(breakdown.operationalComplexity) || 10, 0), 20);
    const opportunityQuality = Math.min(Math.max(Number(breakdown.opportunityQuality) || 18, 0), 30);
    const decisionMakerAvailability = (input.decisionMakers && input.decisionMakers.length > 0)
      ? Math.min(Math.max(Number(breakdown.decisionMakerAvailability) || 10, 5), 15)
      : 0;
    const contactability = ((input.emails && input.emails.length > 0) || (input.phoneNumbers && input.phoneNumbers.length > 0))
      ? Math.min(Math.max(Number(breakdown.contactability) || 10, 5), 15)
      : 0;

    const calculatedScore = industryAlignment + operationalComplexity + opportunityQuality + decisionMakerAvailability + contactability;
    const finalScore = Math.min(Math.max(Number(raw.leadScore) || calculatedScore, 0), 100);

    return {
      problems,
      opportunities,
      leadScore: finalScore,
      scoreBreakdown: {
        industryAlignment,
        operationalComplexity,
        opportunityQuality,
        decisionMakerAvailability,
        contactability,
      },
      scoreExplanation: String(raw.scoreExplanation || `Lead relevance evaluated at ${finalScore}/100 based on verified industry automation fit, contactability, and operational complexity.`).trim(),
      evidence: Array.isArray(raw.evidence) ? raw.evidence.map(String) : [],
      missingInformation: Array.isArray(raw.missingInformation) ? raw.missingInformation.map(String) : [],
      analyzedAt: new Date(),
      modelUsed,
    };
  }
}

export const geminiClient = new GeminiClient();

