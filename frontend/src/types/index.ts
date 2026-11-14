export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type DiscoveryStatus = 'discovered' | 'in_progress' | 'completed' | 'failed';
export type ReviewStatus = 'new' | 'reviewed' | 'contacted' | 'rejected';

export type SourceType =
  | 'google_maps'
  | 'osm'
  | 'searxng'
  | 'website_about'
  | 'website_contact'
  | 'website_team'
  | 'website_home'
  | 'website_services'
  | 'website_products'
  | 'website_leadership'
  | 'website_management'
  | 'gemini_analysis'
  | 'manual_entry'
  | 'other';

export interface ISource {
  _id?: string;
  sourceUrl: string;
  sourceType: SourceType;
  extractedField?: string;
  supportingText?: string;
  fetchedAt: string;
}

export interface IDecisionMaker {
  _id?: string;
  companyId?: string;
  companyName?: string;
  fullName: string;
  jobTitle: string;
  professionalProfileUrl?: string;
  publicBusinessEmail?: string;
  evidence?: string;
  sourceUrl?: string;
  confidence: ConfidenceLevel;
  discoveryStatus: 'identified' | 'verified' | 'unverified';
}

export interface IAIOpportunity {
  title: string;
  businessProblem: string;
  recommendedSolution: string;
  howItWorks: string;
  benefits: string;
  whyNeeded: string;
  supportingEvidence: string;
  implementationComplexity?: 'low' | 'medium' | 'high';
  potentialImpact?: 'low' | 'medium' | 'high';
  confidence: ConfidenceLevel;
}

export interface IAIProblem {
  title: string;
  problem: string;
  hypothesis: boolean;
  evidence?: string;
}

export interface IAIScoreBreakdown {
  industryAlignment: number;
  operationalComplexity: number;
  opportunityQuality: number;
  decisionMakerAvailability: number;
  contactability: number;
}

export interface IAIAnalysis {
  problems: IAIProblem[];
  opportunities: IAIOpportunity[];
  leadScore: number;
  scoreBreakdown?: IAIScoreBreakdown;
  scoreExplanation: string;
  evidence: string[];
  missingInformation: string[];
  analyzedAt?: string;
  modelUsed?: string;
}

export interface IGoogleReview {
  author?: string;
  rating?: number;
  text?: string;
  publishAt?: string;
}

export interface IJobPosting {
  title: string;
  platform: string;
  company?: string;
  location?: string;
  salary?: string;
  datePosted?: string;
  jobUrl?: string;
  descriptionSnippet?: string;
}

export interface ICompany {
  _id: string;
  companyName: string;
  normalizedName?: string;
  website: string;
  domain: string;
  industry: string;
  category: string;
  description: string;
  services: string[];
  products: string[];
  country: string;
  region: string;
  city: string;
  address: string;
  phoneNumbers: string[];
  emails: string[];
  googleRating?: number;
  googleReviewsCount?: number;
  reviews?: IGoogleReview[];
  jobPostings?: IJobPosting[];
  jobsScrapedAt?: string;
  companySize: 'Small: 1–50 employees' | 'Medium: 51–250 employees' | 'Large: 251–1000 employees' | 'Enterprise: 1000+ employees' | 'Unknown';
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    github?: string;
  };
  decisionMakers: IDecisionMaker[];
  aiAnalysis?: IAIAnalysis;
  leadScore: number;
  sources: ISource[];
  discoveryStatus: DiscoveryStatus;
  scrapingStatus: 'pending' | 'scraping' | 'completed' | 'failed';
  analysisStatus: 'pending' | 'analyzing' | 'completed' | 'failed';
  isSaved: boolean;
  reviewStatus: ReviewStatus;
  leadStatus?: 'new' | 'reviewed' | 'contacted' | 'replied' | 'interested' | 'converted';
  handoffToQualification?: boolean;
  notes: string;
  manualOverrides?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ISearchCriteria {
  industry: string;
  category: string;
  keywords: string[];
  country: string;
  region: string;
  city: string;
  companySize: string;
  services: string[];
  aiRequirements: string[];
  maxCompanies: number;
}

export interface ISearchJob {
  _id: string;
  searchCriteria: ISearchCriteria;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  discoveredCount: number;
  processedCount: number;
  failedCount: number;
  startedAt?: string;
  completedAt?: string;
  errors: { timestamp: string; phase: string; message: string }[];
  createdAt: string;
}

export interface IDashboardStats {
  metrics: {
    totalCompanies: number;
    withWebsites: number;
    withEmails: number;
    withPhones: number;
    decisionMakersCount: number;
    highRelevanceCount: number;
  };
  charts: {
    byIndustry: { name: string; count: number }[];
    byCountry: { name: string; count: number }[];
    byCity: { name: string; count: number }[];
    relevanceDistribution: { range: string; count: number }[];
    byJobTitle: { name: string; count: number }[];
  };
  recentSearches: ISearchJob[];
  recentDiscoveries: Partial<ICompany>[];
  dbConnected: boolean;
}

// Phase 2: Cybells Knowledge Base & Outreach Types
export interface ICybellsCapability {
  id: string;
  title: string;
  description: string;
  typicalUseCases: string[];
}

export interface ICybellsCaseStudy {
  id: string;
  title: string;
  clientIndustry: string;
  problemSolved: string;
  metricOrResult: string;
  verified: boolean;
}

export interface ICybellsFAQ {
  question: string;
  answer: string;
}

export interface ICybellsSendingRules {
  dailyCap: number;
  minDelaySeconds: number;
  maxDelaySeconds: number;
  allowedSendingHours: {
    start: number;
    end: number;
  };
  allowedSendingDays: number[];
  timezone: string;
}

export interface ICybellsConfig {
  agencyName: string;
  mission: string;
  targetAudience: string;
  brandVoice: string;
  capabilities: ICybellsCapability[];
  caseStudies: ICybellsCaseStudy[];
  faqs: ICybellsFAQ[];
  securityPrivacyStatement: string;
  senderName: string;
  signature: string;
  optOutText: string;
  postalAddress: string;
  sendingRules: ICybellsSendingRules;
}

export interface ITransportStatus {
  sendMode: 'sandbox' | 'live';
  sandboxInbox: string;
  smtpConfigured: boolean;
  smtpHost: string;
  smtpPort: number;
  imapConfigured: boolean;
  imapHost: string;
  imapPort: number;
  defaultSenderName: string;
  defaultSenderEmail: string;
}

export type ContactValidationStatus =
  | 'format_valid'
  | 'format_invalid'
  | 'unverified'
  | 'verified'
  | 'risky'
  | 'bounced';

export type ContactOutreachStatus =
  | 'new'
  | 'selected'
  | 'ready'
  | 'pending_approval'
  | 'contacted'
  | 'replied'
  | 'interested'
  | 'not_interested'
  | 'bounced'
  | 'unsubscribed'
  | 'converted'
  | 'suppressed';

export interface IOutreachContact {
  _id: string;
  companyId: string | ICompany;
  decisionMakerId?: string | IDecisionMaker;
  email: string;
  normalizedEmail: string;
  emailSourceUrl: string;
  contactName: string;
  jobTitle: string;
  validationStatus: ContactValidationStatus;
  outreachStatus: ContactOutreachStatus;
  suppressionStatus: {
    isSuppressed: boolean;
    reason?: string;
    suppressedAt?: string;
  };
  lastContactedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type SuppressionReason =
  | 'unsubscribe'
  | 'hard_bounce'
  | 'manual_suppression'
  | 'spam_complaint';

export interface ISuppressionEntry {
  _id: string;
  email: string;
  reason: SuppressionReason;
  source: string;
  createdAt: string;
  updatedAt?: string;
}

export type DraftApprovalStatus = 'draft' | 'approved' | 'rejected';

export type OutreachFramework =
  | 'pain_agitate_solve'
  | 'question_value_cta'
  | 'before_after_bridge'
  | 'observation_idea_question';

export interface IPersonalizationEvidence {
  phase1ProblemsUsed: string[];
  cybellsCapabilityUsed: string;
  matchedReasoning: string;
}

export interface IEmailDraft {
  _id: string;
  contactId: string | IOutreachContact;
  companyId: string | ICompany;
  campaignId?: string;
  sequenceStep: number;
  subjectOptions: string[];
  subject: string;
  bodyHtml: string;
  bodyText: string;
  personalizationEvidence: IPersonalizationEvidence;
  geminiModel: string;
  spamScore: number;
  spamFlags: string[];
  approvalStatus: DraftApprovalStatus;
  approvedAt?: string;
  approvedContentHash?: string;
  framework: OutreachFramework;
  subjectVariantUsed: number;
  matchedCapability: string;
  industry: string;
  country: string;
  createdAt: string;
  updatedAt: string;
}

export type CampaignStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'scheduled'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled';

export interface ICampaignSequenceStep {
  step: number;
  dayOffset: number;
  subject?: string;
  body?: string;
}

export interface ICampaign {
  _id: string;
  name: string;
  description: string;
  targetCriteria: Record<string, any>;
  selectedContacts: string[] | IOutreachContact[];
  sequence: ICampaignSequenceStep[];
  status: CampaignStatus;
  sendingLimits: {
    dailyCap?: number;
    minDelaySeconds?: number;
    maxDelaySeconds?: number;
  };
  schedule: {
    startDate?: string;
    timezone?: string;
  };
  stats?: {
    totalEnrolled: number;
    sentCount: number;
    scheduledCount: number;
    bouncedCount: number;
  };
  createdAt: string;
  updatedAt: string;
}

export type MessageStatus =
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'failed'
  | 'cancelled';

export interface IOutreachMessage {
  _id: string;
  campaignId?: string | ICampaign;
  contactId: string | IOutreachContact;
  draftId?: string;
  direction: 'outbound' | 'inbound';
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  status: MessageStatus;
  messageId?: string;
  scheduledFor?: string;
  sentAt?: string;
  error?: string;
  sandboxRedirected: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ReplyClassification =
  | 'interested'
  | 'question'
  | 'meeting_request'
  | 'price_inquiry'
  | 'objection'
  | 'not_interested'
  | 'out_of_office'
  | 'unsubscribe'
  | 'unclear';

export interface IEmailReply {
  _id: string;
  contactId?: {
    _id: string;
    contactName?: string;
    jobTitle?: string;
    email: string;
    validationStatus: string;
    outreachStatus: string;
  };
  companyId?: {
    _id: string;
    companyName: string;
    industry?: string;
    city?: string;
    country?: string;
    website?: string;
    leadStatus?: string;
  };
  campaignId?: {
    _id: string;
    name: string;
  };
  threadId?: string;
  messageId?: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  receivedAt: string;
  classification: ReplyClassification;
  reviewedAt?: string;
  suggestedReplyDraft?: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- PHASE 3: LEAD QUALIFICATION TYPES ---

export type QualificationStatus =
  | 'not_started'
  | 'in_progress'
  | 'awaiting_information'
  | 'ready_for_review'
  | 'qualified'
  | 'disqualified'
  | 'paused';

export type QualificationInterestLevel = 'high' | 'medium' | 'low' | 'unknown';

export interface IScoreBreakdown {
  needClarity: number;
  solutionFit: number;
  engagement: number;
  timeline: number;
  authority: number;
  budgetReadiness: number;
}

export interface IHumanReview {
  reviewStatus: 'pending' | 'approved_qualified' | 'disqualified' | 'more_info_needed';
  reviewerNotes: string;
  approvedFields?: string[];
  rejectedFields?: string[];
  manualScore?: number;
  finalDecision?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface ILeadQualification {
  _id: string;
  companyId: any;
  contactId: any;
  campaignId?: any;
  sourceConversationId?: string;
  sourceType: 'email' | 'website' | 'manual';
  qualificationStatus: QualificationStatus;
  interestLevel: QualificationInterestLevel;
  businessChallenges: string[];
  currentSystems: string[];
  existingWorkflows: string[];
  requiredSolutions: string[];
  businessPriorities: string[];
  budgetInformation: {
    status: 'disclosed' | 'not_disclosed' | 'not_discussed' | 'constrained';
    details: string;
    rangeEstimated?: string;
  };
  purchasingTimeline: {
    status: 'immediate' | 'within_1_month' | 'within_3_months' | 'within_6_months' | 'later' | 'unknown';
    details: string;
  };
  decisionMakingAuthority: {
    status: 'decision_maker' | 'influencer' | 'researcher' | 'committee' | 'unknown';
    details: string;
    stakeholders?: string[];
  };
  additionalRequirements: string[];
  missingInformation: string[];
  qualificationScore: number;
  scoreBreakdown: IScoreBreakdown;
  qualificationSummary: string;
  aiRecommendation: 'potentially_qualified' | 'needs_more_info' | 'not_qualified' | 'pending';
  lastInteractionAt?: string;
  assignedTo?: string;
  humanReview: IHumanReview;
  disqualificationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IQualificationQuestion {
  _id: string;
  qualificationId: string;
  companyId: string;
  contactId: string;
  question: string;
  category: string;
  purpose: string;
  priority: 'high' | 'medium' | 'low';
  isRequired: boolean;
  questionStatus: 'draft' | 'pending_approval' | 'sent' | 'answered' | 'skipped';
  generatedBy: 'ai' | 'human';
  sourceChannel: 'email' | 'website' | 'manual';
  answerText?: string;
  answeredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IQualificationActivity {
  _id: string;
  qualificationId: string;
  companyId: string;
  contactId: string;
  activityType: string;
  title: string;
  description: string;
  actor: 'ai' | 'human' | 'prospect';
  actorName?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}
