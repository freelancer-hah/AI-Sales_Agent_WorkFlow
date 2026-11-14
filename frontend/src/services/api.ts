import {
  ICompany,
  IDashboardStats,
  IDecisionMaker,
  ISearchJob,
  ISearchCriteria,
} from '../types';

const API_BASE = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error?.message || data.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // Health
  getHealth: async () => {
    return request<{ status: string; uptime: number; database: any; version: string }>('/health');
  },

  // Dashboard Stats
  getDashboardStats: async (): Promise<{ success: boolean; data: IDashboardStats }> => {
    return request<{ success: boolean; data: IDashboardStats }>('/dashboard/stats');
  },

  // Companies
  getCompanies: async (params: Record<string, any> = {}) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, String(value));
      }
    }
    const qStr = query.toString();
    return request<{
      success: boolean;
      data: {
        companies: ICompany[];
        pagination: { total: number; page: number; limit: number; totalPages: number };
      };
    }>(`/companies${qStr ? `?${qStr}` : ''}`);
  },

  getCompanyById: async (id: string): Promise<{ success: boolean; data: ICompany }> => {
    return request<{ success: boolean; data: ICompany }>(`/companies/${id}`);
  },

  updateCompany: async (id: string, updates: Partial<ICompany>): Promise<{ success: boolean; data: ICompany }> => {
    return request<{ success: boolean; data: ICompany }>(`/companies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  deleteCompany: async (id: string): Promise<{ success: boolean; message: string }> => {
    return request<{ success: boolean; message: string }>(`/companies/${id}`, {
      method: 'DELETE',
    });
  },

  reScoreCompany: async (id: string): Promise<{ success: boolean; message: string; data: ICompany }> => {
    return request<{ success: boolean; message: string; data: ICompany }>(`/companies/${id}/re-score`, {
      method: 'POST',
    });
  },

  reScoreAllCompanies: async (): Promise<{ success: boolean; message: string; data: { totalProcessed: number; updatedCount: number } }> => {
    return request<{ success: boolean; message: string; data: { totalProcessed: number; updatedCount: number } }>('/companies/re-score-all', {
      method: 'POST',
    });
  },

  // Decision Makers
  getDecisionMakers: async (params: Record<string, any> = {}) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) query.append(key, String(value));
    }
    const qStr = query.toString();
    return request<{
      success: boolean;
      data: {
        decisionMakers: (IDecisionMaker & { companyName?: string; companyWebsite?: string; industry?: string })[];
        pagination: { total: number; page: number; limit: number; totalPages: number };
      };
    }>(`/decision-makers${qStr ? `?${qStr}` : ''}`);
  },

  getCompanyDecisionMakers: async (companyId: string) => {
    return request<{ success: boolean; data: { companyId: string; companyName: string; decisionMakers: IDecisionMaker[] } }>(
      `/decision-makers/company/${companyId}`
    );
  },

  discoverDecisionMakers: async (companyId: string) => {
    return request<{
      success: boolean;
      message: string;
      data: { companyId: string; companyName: string; decisionMakers: IDecisionMaker[]; newlyDiscoveredCount: number };
    }>(`/companies/${companyId}/decision-makers/discover`, {
      method: 'POST',
    });
  },

  // Search Jobs
  startSearch: async (criteria: ISearchCriteria): Promise<{ success: boolean; data: { jobId: string; status: string; progress: number } }> => {
    return request<{ success: boolean; data: { jobId: string; status: string; progress: number } }>('/search', {
      method: 'POST',
      body: JSON.stringify(criteria),
    });
  },

  getSearchJob: async (jobId: string): Promise<{ success: boolean; data: ISearchJob }> => {
    return request<{ success: boolean; data: ISearchJob }>(`/search/${jobId}`);
  },

  getSearchHistory: async (limit = 20): Promise<{ success: boolean; data: ISearchJob[] }> => {
    return request<{ success: boolean; data: ISearchJob[] }>(`/search/history?limit=${limit}`);
  },

  // AI & Scraping
  analyzeCompany: async (companyId: string) => {
    return request<{ success: boolean; message: string; data: any }>(`/ai/${companyId}/analyze`, {
      method: 'POST',
    });
  },

  scrapeCompany: async (companyId: string) => {
    return request<{ success: boolean; message: string; data: any }>(`/companies/${companyId}/scrape`, {
      method: 'POST',
    });
  },

  scrapeCompanyJobs: async (companyId: string) => {
    return request<{
      success: boolean;
      message: string;
      data: { companyId: string; companyName: string; totalJobs: number; jobPostings: any[] };
    }>(`/companies/${companyId}/jobs/scrape`, {
      method: 'POST',
    });
  },

  // Settings & Integrations
  getSettings: async () => {
    return request<{ success: boolean; data: any }>('/settings');
  },

  getIntegrations: async () => {
    return request<{ success: boolean; data: any }>('/settings/integrations');
  },

  // Export URLs & Download Helpers
  getExportCsvUrl: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams(params).toString();
    return `/api/companies/export/csv${query ? `?${query}` : ''}`;
  },

  getExportExcelUrl: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams(params).toString();
    return `/api/companies/export/excel${query ? `?${query}` : ''}`;
  },

  downloadExport: async (
    format: 'excel' | 'csv',
    options: {
      type?: 'companies' | 'decision-makers' | 'ai-opportunities' | 'sources';
      filters?: Record<string, any>;
      companyIds?: string[];
    } = {}
  ): Promise<void> => {
    const url = `/api/export/${format}`;
    const payload: Record<string, any> = { ...(options.filters || {}) };
    if (options.type) payload.type = options.type;
    if (options.companyIds && options.companyIds.length > 0) {
      payload.companyIds = options.companyIds;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error || errJson.message || `Export failed with status ${response.status}`);
    }

    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition');
    let filename =
      format === 'excel'
        ? `sales_leads_intelligence_${Date.now()}.xlsx`
        : `leads_${options.type || 'companies'}_${Date.now()}.csv`;

    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) filename = match[1];
    }

    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  },

  // Phase 2: Cybells Knowledge Base & Outreach
  getCybellsConfig: async () => {
    return request<{ success: boolean; data: any; transportStatus: any }>('/cybells/config');
  },

  updateCybellsConfig: async (updates: Record<string, any>) => {
    return request<{ success: boolean; message: string; data: any }>('/cybells/config', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  getOutreachContacts: async (params: Record<string, any> = {}) => {
    const query = new URLSearchParams(params).toString();
    return request<{
      success: boolean;
      data: {
        contacts: any[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      };
    }>(`/outreach/contacts${query ? `?${query}` : ''}`);
  },

  selectContactsForOutreach: async (payload: {
    companyIds?: string[];
    contactSelections?: Array<{
      companyId: string;
      email: string;
      contactName?: string;
      jobTitle?: string;
      decisionMakerId?: string;
      emailSourceUrl?: string;
    }>;
  }) => {
    return request<{
      success: boolean;
      message: string;
      data: {
        createdCount: number;
        skippedCount: number;
        suppressedCount: number;
        contacts: any[];
      };
    }>('/outreach/contacts/select', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateOutreachContact: async (id: string, updates: Record<string, any>) => {
    return request<{ success: boolean; message: string; data: any }>(`/outreach/contacts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  // Milestone 2: Suppression List Management
  getSuppressionList: async (params: { page?: number; limit?: number; reason?: string; search?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.reason) query.set('reason', params.reason);
    if (params.search) query.set('search', params.search);

    return request<{
      success: boolean;
      data: {
        entries: Array<{
          _id: string;
          email: string;
          reason: string;
          source: string;
          createdAt: string;
        }>;
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      };
    }>(`/suppression${query.toString() ? `?${query.toString()}` : ''}`);
  },

  addSuppressedEmail: async (payload: {
    email?: string;
    emails?: string[];
    reason?: string;
    source?: string;
  }) => {
    return request<{
      success: boolean;
      message: string;
      data: {
        suppressedCount: number;
        contactsUpdated: number;
        jobsCancelled: number;
        messagesCancelled: number;
        emails: string[];
      };
    }>('/suppression', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  removeSuppressedEmail: async (idOrEmail: string) => {
    return request<{ success: boolean; message: string }>(`/suppression/${encodeURIComponent(idOrEmail)}`, {
      method: 'DELETE',
    });
  },

  // Milestone 3: Email Personalization & Drafts
  generateDraft: async (payload: {
    contactId?: string;
    contactIds?: string[];
    framework?: string;
    customInstructions?: string;
    sequenceStep?: number;
  }) => {
    return request<{
      success: boolean;
      message: string;
      data: {
        drafts: any[];
        errors: Array<{ contactId: string; error: string }>;
      };
    }>('/outreach/drafts/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getDrafts: async (params: {
    page?: number;
    limit?: number;
    approvalStatus?: string;
    contactId?: string;
    companyId?: string;
    framework?: string;
  } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.approvalStatus) query.set('approvalStatus', params.approvalStatus);
    if (params.contactId) query.set('contactId', params.contactId);
    if (params.companyId) query.set('companyId', params.companyId);
    if (params.framework) query.set('framework', params.framework);

    return request<{
      success: boolean;
      data: {
        drafts: any[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      };
    }>(`/outreach/drafts${query.toString() ? `?${query.toString()}` : ''}`);
  },

  getDraftById: async (id: string) => {
    return request<{ success: boolean; data: any }>(`/outreach/drafts/${id}`);
  },

  updateDraft: async (id: string, updates: {
    subject?: string;
    bodyHtml?: string;
    bodyText?: string;
    approvalStatus?: string;
    subjectVariantUsed?: number;
  }) => {
    return request<{ success: boolean; message: string; data: any }>(`/outreach/drafts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  deleteDraft: async (id: string) => {
    return request<{ success: boolean; message: string }>(`/outreach/drafts/${id}`, {
      method: 'DELETE',
    });
  },

  // Milestone 4: Campaign Sequencing, Schedulers & Sending Engine
  getCampaigns: async (params: { page?: number; limit?: number; status?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.status) query.set('status', params.status);

    return request<{
      success: boolean;
      data: {
        campaigns: any[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      };
    }>(`/campaigns${query.toString() ? `?${query.toString()}` : ''}`);
  },

  getCampaignById: async (id: string) => {
    return request<{
      success: boolean;
      data: {
        campaign: any;
        messages: any[];
        followUpJobs: any[];
      };
    }>(`/campaigns/${id}`);
  },

  createCampaign: async (payload: {
    name: string;
    description?: string;
    selectedContacts?: string[];
    sequence?: any[];
    sendingLimits?: any;
    schedule?: any;
  }) => {
    return request<{ success: boolean; message: string; data: any }>('/campaigns', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateCampaign: async (id: string, updates: Record<string, any>) => {
    return request<{ success: boolean; message: string; data: any }>(`/campaigns/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  launchCampaign: async (id: string, payload: { startDate?: string } = {}) => {
    return request<{ success: boolean; message: string; data: any }>(`/campaigns/${id}/launch`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  pauseCampaign: async (id: string) => {
    return request<{ success: boolean; message: string; data: any }>(`/campaigns/${id}/pause`, {
      method: 'POST',
    });
  },

  resumeCampaign: async (id: string) => {
    return request<{ success: boolean; message: string; data: any }>(`/campaigns/${id}/resume`, {
      method: 'POST',
    });
  },

  cancelCampaign: async (id: string) => {
    return request<{ success: boolean; message: string; data: any }>(`/campaigns/${id}/cancel`, {
      method: 'POST',
    });
  },

  getOutreachMessages: async (params: { page?: number; limit?: number; campaignId?: string; status?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.campaignId) query.set('campaignId', params.campaignId);
    if (params.status) query.set('status', params.status);

    return request<{
      success: boolean;
      data: {
        messages: any[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      };
    }>(`/outreach/messages${query.toString() ? `?${query.toString()}` : ''}`);
  },

  sendSingleApprovedMessage: async (payload: { draftId: string }) => {
    return request<{
      success: boolean;
      message: string;
      data: {
        messageId: string;
        sandboxRedirected: boolean;
        recipient: string;
        sentAt: string;
      };
    }>('/outreach/send-single', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Milestone 7: Two-Way Inbox & Replies
  getReplies: async (params: {
    page?: number;
    limit?: number;
    classification?: string;
    isRead?: boolean;
    reviewed?: boolean;
    search?: string;
    companyId?: string;
  } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.classification) query.set('classification', params.classification);
    if (params.isRead !== undefined) query.set('isRead', String(params.isRead));
    if (params.reviewed !== undefined) query.set('reviewed', String(params.reviewed));
    if (params.search) query.set('search', params.search);
    if (params.companyId) query.set('companyId', params.companyId);

    return request<{
      success: boolean;
      data: {
        replies: any[];
        stats: {
          total: number;
          unreadCount: number;
          interestedCount: number;
        };
        pagination: { page: number; limit: number; total: number; totalPages: number };
      };
    }>(`/replies${query.toString() ? `?${query.toString()}` : ''}`);
  },

  getReplyById: async (id: string) => {
    return request<{
      success: boolean;
      data: {
        reply: any;
        threadMessages: any[];
      };
    }>(`/replies/${id}`);
  },

  updateReply: async (id: string, updates: Record<string, any>) => {
    return request<{ success: boolean; message: string; data: { reply: any } }>(`/replies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  generateReplyResponse: async (id: string) => {
    return request<{
      success: boolean;
      message: string;
      data: {
        reply: any;
        classification: string;
        reasoning: string;
        suggestedReplyDraft: string;
      };
    }>(`/replies/${id}/generate-response`, {
      method: 'POST',
    });
  },

  sendApprovedReply: async (id: string, payload: { subject: string; bodyText: string; bodyHtml?: string }) => {
    return request<{
      success: boolean;
      message: string;
      data: {
        messageId: string;
        sandboxRedirected: boolean;
        recipient: string;
      };
    }>(`/replies/${id}/send-reply`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  syncInbox: async () => {
    return request<{
      success: boolean;
      message: string;
      data: {
        success: boolean;
        messagesFetched: number;
        repliesCreated: number;
        bouncesHandled: number;
        errors: string[];
        lastSyncAt: string;
      };
    }>('/replies/sync', {
      method: 'POST',
    });
  },

  getImapStatus: async () => {
    return request<{
      success: boolean;
      data: {
        configured: boolean;
        host: string;
        port: number;
        user: string;
        syncState: {
          lastSyncAt: string | null;
          lastUid: number;
          status: string;
          lastError: string;
          processedCount: number;
        };
      };
    }>('/replies/status');
  },

  testImapConnection: async () => {
    return request<{
      success: boolean;
      message: string;
      details?: any;
    }>('/replies/test-connection', {
      method: 'POST',
    });
  },

  // --- PHASE 3: LEAD QUALIFICATION ---

  getQualifications: async (params: Record<string, any> = {}) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, String(value));
      }
    }
    const qStr = query.toString();
    return request<{
      success: boolean;
      data: {
        qualifications: any[];
        pagination: { total: number; page: number; limit: number; totalPages: number };
        stats: {
          total: number;
          inProgress: number;
          awaitingInfo: number;
          readyForReview: number;
          qualified: number;
          disqualified: number;
          highPotential: number;
        };
      };
    }>(`/qualifications${qStr ? `?${qStr}` : ''}`);
  },

  getQualificationById: async (id: string) => {
    return request<{
      success: boolean;
      data: {
        qualification: any;
        questions: any[];
        activities: any[];
      };
    }>(`/qualifications/${id}`);
  },

  startQualification: async (payload: { contactId: string; allowManual?: boolean; sourceType?: string }) => {
    return request<{
      success: boolean;
      message: string;
      data: any;
    }>('/qualifications/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateQualification: async (id: string, updates: Record<string, any>) => {
    return request<{
      success: boolean;
      message: string;
      data: any;
    }>(`/qualifications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  updateQualificationStatus: async (id: string, status: string, reason?: string) => {
    return request<{
      success: boolean;
      message: string;
      data: any;
    }>(`/qualifications/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    });
  },

  extractQualificationInfo: async (id: string, payload: { messageText: string; sourceChannel?: string }) => {
    return request<{
      success: boolean;
      message: string;
      data: {
        extracted: any;
        qualification: any;
      };
    }>(`/qualifications/${id}/extract`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  generateQualificationQuestion: async (id: string, payload: { focusCategory?: string } = {}) => {
    return request<{
      success: boolean;
      message: string;
      data: any;
    }>(`/qualifications/${id}/generate-question`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  generateQualificationDraft: async (id: string, payload: { questionId: string; inReplyToSubject?: string }) => {
    return request<{
      success: boolean;
      message: string;
      data: {
        draft: any;
        emailDraftRecord: any;
      };
    }>(`/qualifications/${id}/generate-draft`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  scoreQualification: async (id: string) => {
    return request<{
      success: boolean;
      message: string;
      data: {
        scoringResult: any;
        qualification: any;
      };
    }>(`/qualifications/${id}/score`, {
      method: 'POST',
    });
  },

  submitQualificationReview: async (id: string, payload: {
    decision: 'approved_qualified' | 'disqualified' | 'more_info_needed';
    reviewerNotes: string;
    reviewerName?: string;
    manualScore?: number;
    approvedFields?: string[];
    rejectedFields?: string[];
    disqualificationReason?: string;
  }) => {
    return request<{
      success: boolean;
      message: string;
      data: any;
    }>(`/qualifications/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getQualificationQuestions: async (id: string, status?: string) => {
    return request<{
      success: boolean;
      data: {
        questions: any[];
        total: number;
      };
    }>(`/qualifications/${id}/questions${status ? `?status=${status}` : ''}`);
  },

  updateQualificationQuestion: async (id: string, questionId: string, payload: Record<string, any>) => {
    return request<{
      success: boolean;
      message: string;
      data: any;
    }>(`/qualifications/${id}/questions/${questionId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  handoffQualification: async (id: string, payload: { assignedSalesAgent?: string; actorName?: string } = {}) => {
    return request<{
      success: boolean;
      message: string;
      data: any;
    }>(`/qualifications/${id}/handoff`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getQualificationsExportCsvUrl: (params: Record<string, any> = {}) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, String(value));
      }
    }
    const qStr = query.toString();
    return `/api/qualifications/export/csv${qStr ? `?${qStr}` : ''}`;
  },

  getQualificationExportJsonUrl: (id: string) => {
    return `/api/qualifications/${id}/export`;
  },

  // ==========================================
  // Phase 4: Sales Meetings & Conversion Hub
  // ==========================================
  getMeetings: async (params: Record<string, any> = {}) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, String(value));
      }
    }
    const qStr = query.toString();
    return request<{
      success: boolean;
      data: any[];
      pagination: { total: number; page: number; totalPages: number };
    }>(`/meetings${qStr ? `?${qStr}` : ''}`);
  },

  getMeetingStats: async () => {
    return request<{
      success: boolean;
      data: {
        total: number;
        upcoming: number;
        confirmed: number;
        completed: number;
        rescheduled: number;
        cancelled: number;
        noShow: number;
      };
    }>('/meetings/stats');
  },

  getMeetingById: async (id: string) => {
    return request<{ success: boolean; data: any }>(`/meetings/${id}`);
  },

  createMeeting: async (payload: {
    companyId: string;
    contactId: string;
    qualificationId?: string;
    startTime: string;
    endTime?: string;
    durationMinutes?: number;
    title?: string;
    description?: string;
    assignedAE?: string;
    force?: boolean;
  }) => {
    return request<{ success: boolean; message: string; data: any }>('/meetings', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateMeetingStatus: async (id: string, status: string, extraData: Record<string, any> = {}) => {
    return request<{ success: boolean; message: string; data: any }>(`/meetings/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, ...extraData }),
    });
  },

  rescheduleMeeting: async (id: string, newStartTime: string, reason?: string) => {
    return request<{ success: boolean; message: string; data: any }>(`/meetings/${id}/reschedule`, {
      method: 'POST',
      body: JSON.stringify({ newStartTime, reason }),
    });
  },

  cancelMeeting: async (id: string, reason: string) => {
    return request<{ success: boolean; message: string; data: any }>(`/meetings/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  recordMeetingOutcome: async (id: string, outcome: string, notes?: string) => {
    return request<{ success: boolean; message: string; data: any }>(`/meetings/${id}/outcome`, {
      method: 'POST',
      body: JSON.stringify({ outcome, notes }),
    });
  },

  sendMeetingReminder: async (id: string, reminderType: '24h' | '1h' | 'followup' | 'noshow') => {
    return request<{ success: boolean; message: string; data: any }>(`/meetings/${id}/remind`, {
      method: 'POST',
      body: JSON.stringify({ reminderType }),
    });
  },

  getMeetingDossier: async (id: string) => {
    return request<{ success: boolean; data: any }>(`/meetings/${id}/dossier`);
  },

  generateMeetingDossier: async (id: string) => {
    return request<{ success: boolean; message: string; data: any }>(`/meetings/${id}/dossier/generate`, {
      method: 'POST',
    });
  },

  getMeetingIcsDownloadUrl: (id: string) => {
    return `/api/meetings/${id}/ics`;
  },

  getHostAvailability: async () => {
    return request<{ success: boolean; data: any }>('/meetings/availability/settings');
  },

  updateHostAvailability: async (payload: Record<string, any>) => {
    return request<{ success: boolean; message: string; data: any }>('/meetings/availability/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  getAvailableSlots: async (params: { startDate?: string; endDate?: string; timezone?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.timezone) query.append('timezone', params.timezone);
    const qStr = query.toString();
    return request<{ success: boolean; count: number; data: any[] }>(
      `/meetings/availability/slots${qStr ? `?${qStr}` : ''}`
    );
  },

  parseMeetingSlots: async (payload: { messageText?: string; contactId?: string; companyId?: string } | string) => {
    const body = typeof payload === 'string' ? { messageText: payload } : payload;
    return request<{ success: boolean; data: any }>('/meetings/parse-slots', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  generateMeetingInviteDraft: async (id: string) => {
    return request<{ success: boolean; message: string; data: any }>(`/meetings/${id}/generate-invite-draft`, {
      method: 'POST',
    });
  },

  getCalConfig: async () => {
    return request<{
      success: boolean;
      data: {
        calOrigin: string;
        closerSlug: string;
        eventSlug: string;
        defaultCalLink: string;
      };
    }>('/webhooks/cal/config');
  },
};
