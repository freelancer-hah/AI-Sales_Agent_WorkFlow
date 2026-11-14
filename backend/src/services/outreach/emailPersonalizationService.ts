import { GoogleGenAI } from '@google/genai';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { spamScorerService, SpamAnalysisResult } from './spamScorerService.js';
import { CybellsConfig } from '../../models/CybellsConfig.js';
import { ICompany } from '../../models/Company.js';
import { IOutreachContact } from '../../models/OutreachContact.js';
import { IEmailDraft, IPersonalizationEvidence } from '../../models/EmailDraft.js';
import { bookingLinkService } from './bookingLinkService.js';

export type OutreachFramework =
  | 'pain_agitate_solve'
  | 'question_value_cta'
  | 'before_after_bridge'
  | 'observation_idea_question';

export interface GenerateDraftInput {
  company: ICompany;
  contact: IOutreachContact;
  framework?: OutreachFramework;
  customInstructions?: string;
  sequenceStep?: number;
}

export interface GeneratedDraftResult {
  subjectOptions: string[];
  subject: string;
  bodyHtml: string;
  bodyText: string;
  personalizationEvidence: IPersonalizationEvidence;
  framework: OutreachFramework;
  geminiModel: string;
  spamScore: number;
  spamFlags: string[];
}

export class EmailPersonalizationService {
  private client: GoogleGenAI | null = null;
  private primaryModel: string;
  private fallbackModels: string[];

  constructor() {
    this.primaryModel = env.GEMINI_MODEL || 'gemini-3.8-flash';
    this.fallbackModels = [
      this.primaryModel,
      'gemma-4-26b-a4b-it',
      'gemini-3.5-flash',
      'gemma-4-31b-it',
    ];

    if (env.GEMINI_API_KEY) {
      this.client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    }
  }

  public isConfigured(): boolean {
    return Boolean(env.GEMINI_API_KEY);
  }

  public getModelName(): string {
    return this.primaryModel;
  }

  /**
   * Generates a fully personalized, strictly grounded cold outreach email draft
   * using Gemini and Cybells Knowledge Base facts.
   */
  public async generatePersonalizedDraft(input: GenerateDraftInput): Promise<GeneratedDraftResult> {
    if (!env.GEMINI_API_KEY || !this.client) {
      throw new Error(
        'GEMINI_API_KEY is not configured. Please configure your GEMINI_API_KEY in backend/.env to generate personalized outreach drafts.'
      );
    }

    const framework: OutreachFramework = input.framework || 'pain_agitate_solve';

    // Retrieve active Cybells configuration and knowledge base (or auto-initialize default)
    let cybellsConfig = await CybellsConfig.findOne().lean();
    if (!cybellsConfig) {
      const created = await CybellsConfig.getOrCreateConfig();
      cybellsConfig = (created as any).toObject ? (created as any).toObject() : created;
    }

    const prompt = this.buildPrompt(input.company, input.contact, cybellsConfig, framework, input.customInstructions);

    let lastError: any = null;

    for (const model of this.fallbackModels) {
      try {
        logger.info(
          `Generating personalized outreach email with Gemini model: ${model} for ${input.contact.contactName || 'Prospect'} at ${input.company.companyName}`
        );

        const response = await this.client.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.3, // Low temperature for factual fidelity & grounding
          },
        });

        const rawText = response.text || '';
        if (!rawText.trim()) {
          throw new Error('Gemini API returned an empty response.');
        }

        const parsed = JSON.parse(rawText);
        const validated = this.validateAndFormatResponse(parsed, input, cybellsConfig, framework, model);
        return validated;
      } catch (err: any) {
        lastError = err;
        logger.warn(
          `Gemini generation attempt with model ${model} failed (${err.message}). Trying next candidate...`
        );
      }
    }

    // Never return fake/fabricated drafts if Gemini is unavailable
    const errorMessage = lastError?.message || 'Gemini API call failed';
    logger.error('Failed to generate personalized email draft via Gemini.', lastError);
    throw new Error(
      `Gemini email generation failed: ${errorMessage}. Please check your Gemini API quota or network connection and retry.`
    );
  }

  /**
   * Builds the rigorous, injection-safe, grounded prompt for Gemini.
   */
  private buildPrompt(
    company: ICompany,
    contact: IOutreachContact,
    cybells: any,
    framework: OutreachFramework,
    customInstructions?: string
  ): string {
    // Collect grounded facts only from Phase 1 data
    const problems = (company.aiAnalysis?.problems || [])
      .map((p) => `- ${p.title}: ${p.problem}`)
      .join('\n');

    const opportunities = (company.aiAnalysis?.opportunities || [])
      .map((o) => `- ${o.title}: ${o.recommendedSolution} (Why needed: ${o.whyNeeded})`)
      .join('\n');

    const services = (company.services || []).join(', ') || 'General business services';
    const products = (company.products || []).join(', ');

    // Collect Cybells capabilities
    const capabilities = (cybells.capabilities || [])
      .map((c: any) => `- ${c.title}: ${c.description}`)
      .join('\n');

    // ONLY verified case studies entered by user; NO fabricated metrics
    const verifiedCaseStudies = (cybells.caseStudies || [])
      .filter((cs: any) => cs.verified)
      .map((cs: any) => `- Client/Industry: ${cs.clientIndustry}, Solution: ${cs.solutionDelivered}, Result: ${cs.metricResult}`)
      .join('\n');

    const bookingUrl = bookingLinkService.generatePersonalizedUrl({
      name: contact.contactName,
      email: contact.email,
      companyName: company.companyName,
    });

    const frameworkInstructions = this.getFrameworkInstructions(framework);

    return `You are an elite B2B Sales Copywriting Specialist and AI Outreach Strategist for "${cybells.agencyName || 'Cybells'}".
Your task is to write a highly tailored, authentic, concise, and non-salesy cold outreach email to a prospective business decision-maker.

=== STRICT GROUNDING & ANTI-HALLUCINATION RULES (MANDATORY) ===
1. FACTUAL GROUNDING: You must ONLY cite facts, problems, and services explicitly listed in the PROSPECT COMPANY DATA below.
2. NEVER INVENT: Do NOT fabricate achievements, employee counts, revenue figures, awards, problems, or news about the prospect company.
3. CASE STUDIES & METRICS: You may ONLY mention a past result or case study if it appears in the VERIFIED CYBELLS CASE STUDIES list below. If the case study list is EMPTY, DO NOT mention or imply any past client, percentage increase, or metric. Never invent client names or statistics.
4. TONE & BRAND VOICE: ${cybells.brandVoice || 'Professional, consultative, direct, authentic, concise, respectful of time'}.
5. NO SPAM TRIGGER WORDS: Avoid words like "100% free", "guaranteed", "earn $", "limited time", "act now", "urgent", "click here", "satisfaction guaranteed".
6. LOW-FRICTION CALL TO ACTION: The CTA must be low pressure and conversational (e.g. asking for their perspective or if this aligns with their current focus). Do not demand a 30-minute demo upfront.
7. LENGTH: Keep the body text between 80 and 150 words. Decision-makers do not read long emails.

=== PROSPECT COMPANY DATA (PHASE 1 GROUND TRUTH) ===
- Company Name: ${company.companyName}
- Industry: ${company.industry || 'Business Services'}
- Location: ${company.city || ''}, ${company.country || ''}
- Description: ${company.description || 'Not provided'}
- Services Offered: ${services}
${products ? `- Products Offered: ${products}` : ''}
- Website: ${company.website || 'Not provided'}

=== IDENTIFIED PAIN POINTS & AI OPPORTUNITIES (PHASE 1) ===
${problems || '- General operational efficiency and workflow automation'}
${opportunities ? `\nAutomation Opportunities:\n${opportunities}` : ''}

=== PROSPECT CONTACT DETAILS ===
- Name: ${contact.contactName || 'There'}
- Job Title: ${contact.jobTitle || 'Executive'}
- Public Email: ${contact.email}
- Email Source: ${contact.emailSourceUrl || 'Public company website'}

=== CYBELLS AGENCY PROFILE ===
- Agency Name: ${cybells.agencyName || 'Cybells'}
- Mission: ${cybells.mission || 'Empowering enterprises with intelligent AI automation solutions'}
- Sender Name: ${cybells.senderName || 'Cybells Partnership Team'}

=== CYBELLS CAPABILITIES ===
${capabilities || '- Custom AI Agents and Workflow Automation for B2B Operations'}

=== VERIFIED CYBELLS CASE STUDIES ===
${verifiedCaseStudies ? verifiedCaseStudies : '(None verified yet. DO NOT cite or invent any client metrics or past case studies.)'}

=== COPYWRITING FRAMEWORK: ${framework.toUpperCase()} ===
${frameworkInstructions}

=== CAL.DIY DIRECT BOOKING LINK ===
- Pre-filled calendar URL: ${bookingUrl}
- Note: You may optionally include this link as a low-friction option for the prospect to select a 15-minute slot.

${customInstructions ? `=== USER CUSTOM INSTRUCTIONS ===\n${customInstructions}\n` : ''}

=== REQUIRED OUTPUT FORMAT (JSON ONLY) ===
Respond ONLY with a valid JSON object matching this schema:
{
  "subjectOptions": [
    "Option 1: Curiosity angle (e.g., question regarding their specific process/service)",
    "Option 2: Pain-point angle (referencing an identified bottleneck)",
    "Option 3: Observation angle (referencing a specific public service or workflow)"
  ],
  "subject": "The strongest option among the 3",
  "bodyHtml": "<p>Hi [Name or First Name],</p><p>First paragraph introducing the context and observation...</p><p>Second paragraph presenting the AI automation concept and solution...</p><p>Low-friction closing question?</p><p>Best regards,<br>${cybells.senderName || 'Cybells Team'}</p>",
  "bodyText": "Hi [Name],\n\nFirst paragraph...\n\nSecond paragraph...\n\nClosing question?\n\nBest regards,\n${cybells.senderName || 'Cybells Team'}",
  "personalizationEvidence": {
    "phase1ProblemsUsed": ["Exact problem title or concept from Phase 1 used in the copy"],
    "cybellsCapabilityUsed": "Title of the Cybells capability matched",
    "matchedReasoning": "One concise sentence explaining why this capability addresses their specific situation"
  }
}`;
  }

  private getFrameworkInstructions(framework: OutreachFramework): string {
    switch (framework) {
      case 'question_value_cta':
        return `Framework: Question - Value - Call to Action (QVC)
- Opening: Ask an insightful question about their specific operational workflow or service line.
- Value: Share a practical observation on how AI automation solves this exact challenge.
- CTA: Propose a soft, conversational question to explore whether this is on their radar.`;

      case 'before_after_bridge':
        return `Framework: Before - After - Bridge (BAB)
- Before: Highlight their current operational status or workflow based on their services.
- After: Paint a clear, realistic picture of what a streamlined, AI-assisted operation looks like.
- Bridge: Introduce Cybells as the bridge to implement that specific automation.`;

      case 'observation_idea_question':
        return `Framework: Observation - Idea - Question (OIQ)
- Observation: Note an authentic detail from their company services or public footprint.
- Idea: Share a concrete, tailored AI automation idea relevant to their industry.
- Question: Ask a simple, low-pressure question to see if they are exploring this area.`;

      case 'pain_agitate_solve':
      default:
        return `Framework: Problem - Agitate - Solve (PAS)
- Problem: Acknowledge an authentic challenge in their industry/operations from Phase 1 data.
- Agitate: Briefly highlight the friction, manual effort, or missed speed this causes.
- Solve: Present Cybells' specific automation capability as an elegant, non-intrusive solution.`;
    }
  }

  /**
   * Validates and normalizes Gemini's JSON response, enforces spam checks,
   * and appends opt-out and legal compliance footers.
   */
  private validateAndFormatResponse(
    parsed: any,
    input: GenerateDraftInput,
    cybells: any,
    framework: OutreachFramework,
    modelUsed: string
  ): GeneratedDraftResult {
    const subjectOptions: string[] = Array.isArray(parsed.subjectOptions) && parsed.subjectOptions.length >= 3
      ? parsed.subjectOptions.slice(0, 3).map((s: any) => String(s).trim())
      : [
          parsed.subject || `Quick question regarding ${input.company.companyName}`,
          `AI automation for ${input.company.companyName}`,
          `Observation on ${input.company.companyName}'s workflow`,
        ];

    const subject = parsed.subject && typeof parsed.subject === 'string' && parsed.subject.trim()
      ? parsed.subject.trim()
      : subjectOptions[0];

    let bodyText = typeof parsed.bodyText === 'string' && parsed.bodyText.trim()
      ? parsed.bodyText.trim()
      : '';

    let bodyHtml = typeof parsed.bodyHtml === 'string' && parsed.bodyHtml.trim()
      ? parsed.bodyHtml.trim()
      : '';

    // If bodyHtml is missing or plain text, wrap paragraphs in <p> tags
    if (!bodyHtml && bodyText) {
      bodyHtml = bodyText
        .split('\n\n')
        .map((p: string) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
        .join('');
    }

    // Append compliant unsubscribe footer if not already present
    const postalAddress = cybells.postalAddress || 'San Francisco, CA';
    const optOutNotice = cybells.optOutText || 'If you prefer not to receive future emails, you can unsubscribe below.';

    const footerHtml = `
<br/><br/>
<div style="font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 24px;">
  <p style="margin: 0 0 4px 0;">${optOutNotice} <a href="{{UNSUBSCRIBE_URL}}" style="color: #6366f1; text-decoration: underline;">Unsubscribe here</a>.</p>
  <p style="margin: 0; color: #94a3b8;">${postalAddress}</p>
</div>`;

    const footerText = `\n\n---\n${optOutNotice} Unsubscribe: {{UNSUBSCRIBE_URL}}\n${postalAddress}`;

    if (!bodyHtml.includes('{{UNSUBSCRIBE_URL}}') && !bodyHtml.includes('Unsubscribe here')) {
      bodyHtml += footerHtml;
    }
    if (!bodyText.includes('{{UNSUBSCRIBE_URL}}') && !bodyText.includes('Unsubscribe:')) {
      bodyText += footerText;
    }

    // Run spam scorer analysis
    const spamResult: SpamAnalysisResult = spamScorerService.analyze(subject, bodyText, true);

    const personalizationEvidence: IPersonalizationEvidence = {
      phase1ProblemsUsed: Array.isArray(parsed.personalizationEvidence?.phase1ProblemsUsed)
        ? parsed.personalizationEvidence.phase1ProblemsUsed.map(String)
        : [],
      cybellsCapabilityUsed: parsed.personalizationEvidence?.cybellsCapabilityUsed || '',
      matchedReasoning: parsed.personalizationEvidence?.matchedReasoning || 'Direct alignment with Phase 1 operational profile.',
    };

    return {
      subjectOptions,
      subject,
      bodyHtml,
      bodyText,
      personalizationEvidence,
      framework,
      geminiModel: modelUsed,
      spamScore: spamResult.spamScore,
      spamFlags: spamResult.spamFlags,
    };
  }
}

export const emailPersonalizationService = new EmailPersonalizationService();
