import { SalesMeeting, ISalesMeetingDocument } from '../../models/SalesMeeting.js';
import { Company } from '../../models/Company.js';
import { OutreachContact } from '../../models/OutreachContact.js';
import { LeadQualification } from '../../models/LeadQualification.js';
import { logger } from '../../config/logger.js';

export interface IExecutiveDossier {
  meetingId: string;
  generatedAt: string;
  companyProfile: {
    name: string;
    website: string;
    industry: string;
    city?: string;
    country?: string;
    companyScale?: string;
  };
  decisionMaker: {
    name: string;
    jobTitle: string;
    email: string;
    roleLevel?: string;
  };
  meetingDetails: {
    title: string;
    scheduledTime: string;
    durationMinutes: number;
    timezone: string;
    meetingUrl: string;
    assignedAE: string;
  };
  qualificationSummary: {
    status: string;
    score: number;
    interestLevel: string;
    identifiedBottlenecks: string[];
    currentSystems: string[];
    existingWorkflows: string[];
    purchasingTimeline?: string;
    budgetReadiness?: string;
    decisionAuthority?: string;
  };
  tailoredSolutionPitch: {
    recommendedOffering: string;
    automationValueProp: string;
    highPriorityFeatures: string[];
  };
  recommendedDiscoveryQuestions: string[];
  markdownDossier: string;
}

export class ExecutiveDossierService {
  /**
   * Generates a 1-page Executive Closer Brief combining Phase 1, Phase 2, and Phase 3 data
   */
  async generateDossier(meetingId: string): Promise<IExecutiveDossier> {
    const meeting = await SalesMeeting.findById(meetingId)
      .populate('companyId')
      .populate('contactId')
      .populate('qualificationId');

    if (!meeting) {
      throw new Error(`SalesMeeting ${meetingId} not found.`);
    }

    const company: any = meeting.companyId;
    const contact: any = meeting.contactId;
    const qualification: any = meeting.qualificationId;

    const pad = (n: number) => n.toString().padStart(2, '0');
    const sDate = new Date(meeting.startTime);
    const dateFormatted = sDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeFormatted = `${pad(sDate.getHours())}:${pad(sDate.getMinutes())} (${meeting.timezone})`;

    // Phase 1 Pain Points
    const painPoints = (company?.aiAnalysis?.problems || []).map((p: any) => p.title || p.problem);
    const challenges = qualification?.businessChallenges?.length > 0
      ? qualification.businessChallenges
      : (painPoints.length > 0 ? painPoints : ['Manual document processing and data entry across operational units']);

    const systems = qualification?.currentSystems?.length > 0
      ? qualification.currentSystems
      : ['Legacy ERP / In-house software', 'Spreadsheets / Excel'];

    const workflows = qualification?.existingWorkflows?.length > 0
      ? qualification.existingWorkflows
      : ['Manual entry of supplier manifests, POs, and QC inspection sheets'];

    const score = qualification?.qualificationScore || company?.aiAnalysis?.leadScore || 80;
    const status = qualification?.qualificationStatus || 'ready_for_review';
    const interest = qualification?.interestLevel || 'high';

    const timeline = qualification?.purchasingTimeline?.details || 'Immediate to 3 months (High Urgency)';
    const budget = qualification?.budgetInformation?.details || 'Allocated for operational automation initiatives';
    const authority = qualification?.decisionMakingAuthority?.details || 'Primary Decision-Maker / Evaluator';

    // Tailored Cybells Offering
    const recommendedOffering = 'Cybells AI Automated Document Extraction & Workflow Orchestration Pipeline';
    const automationValueProp = `Eliminates up to 90% of manual data entry errors for ${company?.companyName || 'the prospect'}, accelerating document throughput and syncing directly with ${systems[0] || 'core ERP'}.`;
    const highPriorityFeatures = [
      'Zero-Template Multi-Format Manifest & Invoice Extraction',
      'Automated Human-in-the-Loop Discrepancy Flagging',
      'Direct ERP/Database Connector API',
      'Local Sandbox Execution & Enterprise Data Privacy',
    ];

    const recommendedDiscoveryQuestions = [
      `1. How does your operational team currently reconcile manifests or invoices with ${systems[0]}?`,
      '2. What is the typical error rate or delay experienced during peak shipment cycles?',
      '3. If we deploy an automated pipeline that extracts 99%+ of fields accurately, what would be the ideal rollout timeframe for your team?',
      '4. Who else from IT or Operations would participate in a technical demo or sandbox proof-of-concept?',
    ];

    const markdownDossier = `# Discovery Call Closer Dossier: ${company?.companyName || 'Target Company'}

## 🎯 Executive Meeting Overview
- **Scheduled Time:** ${dateFormatted} at ${timeFormatted}
- **Duration:** ${meeting.durationMinutes} Minutes
- **Video Room:** [Join Google Meet](${meeting.meetingUrl})
- **Assigned Account Executive:** ${meeting.assignedAE || 'Cybells Sales Specialist'}
- **Qualification Score:** **${score}/100** (Status: \`${status}\` | Interest: \`${interest}\`)

---

## 🏢 Target Account & Key Decision Maker
- **Company:** ${company?.companyName || 'Masood Textile Mills'} (${company?.industry || 'Manufacturing & Services'})
- **Website:** ${company?.website || 'N/A'}
- **Location:** ${company?.city ? `${company.city}, ` : ''}${company?.country || 'Global'}
- **Primary Stakeholder:** **${contact?.contactName || 'Decision Maker'}** (${contact?.jobTitle || 'Executive'})
- **Email:** \`${contact?.email}\`

---

## 🔍 B2B Qualification Intelligence (Phase 3 BANT)
- **Core Operational Bottlenecks:**
${challenges.map((c: string) => `  - ${c}`).join('\n')}
- **Current Software Stack:**
${systems.map((s: string) => `  - \`${s}\``).join('\n')}
- **Current Workflows:**
${workflows.map((w: string) => `  - ${w}`).join('\n')}
- **Purchasing Timeline:** ${timeline}
- **Budget Readiness:** ${budget}
- **Decision Authority:** ${authority}

---

## 💡 Target Cybells Solution & Commercial Angle
- **Recommended Architecture:** ${recommendedOffering}
- **Value Proposition:** ${automationValueProp}
- **Key Modules for Demo:**
${highPriorityFeatures.map((f: string) => `  - ${f}`).join('\n')}

---

## ❓ Recommended Discovery Questions for AE
${recommendedDiscoveryQuestions.join('\n')}
`;

    // Persist to SalesMeeting document
    meeting.executiveDossier = markdownDossier;
    await meeting.save();

    logger.info(`Generated executive closer dossier for meeting ${meetingId}`);

    return {
      meetingId: meeting._id.toString(),
      generatedAt: new Date().toISOString(),
      companyProfile: {
        name: company?.companyName || 'Prospect Account',
        website: company?.website || '',
        industry: company?.industry || '',
        city: company?.city,
        country: company?.country,
      },
      decisionMaker: {
        name: contact?.contactName || '',
        jobTitle: contact?.jobTitle || '',
        email: contact?.email || '',
      },
      meetingDetails: {
        title: meeting.title,
        scheduledTime: `${dateFormatted} at ${timeFormatted}`,
        durationMinutes: meeting.durationMinutes,
        timezone: meeting.timezone,
        meetingUrl: meeting.meetingUrl,
        assignedAE: meeting.assignedAE,
      },
      qualificationSummary: {
        status,
        score,
        interestLevel: interest,
        identifiedBottlenecks: challenges,
        currentSystems: systems,
        existingWorkflows: workflows,
        purchasingTimeline: timeline,
        budgetReadiness: budget,
        decisionAuthority: authority,
      },
      tailoredSolutionPitch: {
        recommendedOffering,
        automationValueProp,
        highPriorityFeatures,
      },
      recommendedDiscoveryQuestions,
      markdownDossier,
    };
  }
}

export const executiveDossierService = new ExecutiveDossierService();

