import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  CheckSquare,
  Square,
  Sparkles,
  Building2,
  Mail,
  UserCheck,
  Send,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  BookmarkCheck,
  Layers,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { api } from '../services/api';
import { ICompany, IOutreachContact } from '../types';
import { ScoreBadge, Badge } from '../components/Badge';
import { TableSkeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { ErrorAlert } from '../components/ErrorAlert';
import { OutreachWorkspaceNav } from '../components/WorkspaceNav';
import { NavTab } from '../components/Sidebar';

export const LeadManagement: React.FC<{
  onNavigateToFind: () => void;
  onNavigateToDrafts?: () => void;
  onNavigate?: (tab: NavTab) => void;
}> = ({ onNavigateToFind, onNavigateToDrafts, onNavigate }) => {
  const [activeSubTab, setActiveSubTab] = useState<'discover' | 'enrolled'>('discover');

  // Discover / Phase 1 Leads State
  const [companies, setCompanies] = useState<ICompany[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCompanies, setTotalCompanies] = useState(0);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [hasEmail, setHasEmail] = useState(true);
  const [hasDecisionMaker, setHasDecisionMaker] = useState(false);
  const [minScore, setMinScore] = useState<number | ''>(50);
  const [selectedTier, setSelectedTier] = useState<'' | 'high' | 'medium' | 'low'>('');

  // Selection
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null);

  // Enrolled Outreach Contacts State
  const [outreachContacts, setOutreachContacts] = useState<IOutreachContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactsPage, setContactsPage] = useState(1);
  const [totalContacts, setTotalContacts] = useState(0);

  // Action status feedback
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [generatingContactId, setGeneratingContactId] = useState<string | null>(null);

  useEffect(() => {
    if (activeSubTab === 'discover') {
      loadCompanies();
    } else {
      loadOutreachContacts();
    }
  }, [activeSubTab, page, contactsPage, selectedIndustry, selectedCountry, hasEmail, hasDecisionMaker, minScore, selectedTier]);

  const loadCompanies = async () => {
    setLoadingCompanies(true);
    try {
      const params: Record<string, any> = {
        page,
        limit: 12,
        sortBy: 'leadScore',
        sortOrder: 'desc',
      };
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (selectedIndustry) params.industry = selectedIndustry;
      if (selectedCountry) params.country = selectedCountry;
      if (hasEmail) params.hasEmail = 'true';
      if (hasDecisionMaker) params.hasDecisionMaker = 'true';
      if (minScore !== '') params.minScore = minScore;
      if (selectedTier) params.tier = selectedTier;

      const res = await api.getCompanies(params);
      if (res.success) {
        setCompanies(res.data.companies);
        setTotalPages(res.data.pagination.totalPages);
        setTotalCompanies(res.data.pagination.total);
      }
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Failed to load leads' });
    } finally {
      setLoadingCompanies(false);
    }
  };

  const loadOutreachContacts = async () => {
    setLoadingContacts(true);
    try {
      const res = await api.getOutreachContacts({ page: contactsPage, limit: 15 });
      if (res.success) {
        setOutreachContacts(res.data.contacts);
        setTotalContacts(res.data.pagination.total);
      }
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Failed to load outreach contacts' });
    } finally {
      setLoadingContacts(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadCompanies();
  };

  const toggleSelectAll = () => {
    if (selectedCompanyIds.length === companies.length) {
      setSelectedCompanyIds([]);
    } else {
      setSelectedCompanyIds(companies.map((c) => c._id));
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedCompanyIds.includes(id)) {
      setSelectedCompanyIds(selectedCompanyIds.filter((item) => item !== id));
    } else {
      setSelectedCompanyIds([...selectedCompanyIds, id]);
    }
  };

  const handleSaveForOutreach = async (companyIdsToEnroll?: string[]) => {
    const ids = companyIdsToEnroll || selectedCompanyIds;
    if (ids.length === 0) {
      alert('Please select at least one company to save for outreach.');
      return;
    }

    setIsEnrolling(true);
    setActionFeedback(null);
    try {
      const res = await api.selectContactsForOutreach({ companyIds: ids });
      if (res.success) {
        setActionFeedback({
          type: 'success',
          message: res.message || `Successfully enrolled ${res.data.createdCount} contacts into outreach!`,
        });
        setSelectedCompanyIds([]);
        loadCompanies();
      }
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Failed to enroll contacts for outreach.',
      });
    } finally {
      setIsEnrolling(false);
    }
  };

  return (
    <div className="space-y-6">
      <OutreachWorkspaceNav activeTab="lead-management" onNavigate={onNavigate || onNavigateToDrafts || (() => {})} />
      {/* Top Banner */}
      <div className="bg-gradient-to-br from-[#FFF1E6] via-[#FFF8F3] to-card rounded-2xl p-6 text-text shadow-xs border border-border">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-wider">
              <Users className="w-4 h-4 text-accent" />
              <span>Phase 2: Engage Prospects</span>
            </div>
            <h2 className="text-xl font-bold text-text">Lead Management & Outreach Enrollment</h2>
            <p className="text-xs text-text-secondary max-w-xl">
              Curate discovered companies and decision-makers from Phase 1, verify business email sources,
              and enroll contacts into Cybells' personalized outreach sequences.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-track/70 p-1 rounded-xl border border-border">
            <button
              onClick={() => setActiveSubTab('discover')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeSubTab === 'discover'
                  ? 'bg-card text-accent font-bold shadow-xs border border-border'
                  : 'text-text-secondary hover:text-text'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Phase 1 Discovered Leads ({totalCompanies})</span>
            </button>
            <button
              onClick={() => setActiveSubTab('enrolled')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeSubTab === 'enrolled'
                  ? 'bg-card text-accent font-bold shadow-xs border border-border'
                  : 'text-text-secondary hover:text-text'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Enrolled Contacts ({totalContacts})</span>
            </button>
          </div>
        </div>
      </div>

      {actionFeedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs animate-in fade-in duration-200 ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? (
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{actionFeedback.message}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* SUB-TAB 1: Phase 1 Leads to Enroll */}
      {activeSubTab === 'discover' && (
        <div className="space-y-4">
          {/* Controls & Filter Bar */}
          <div className="bg-card rounded-2xl border border-border p-4 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
              <form onSubmit={handleSearchSubmit} className="w-full lg:w-96 flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search company, industry, domain..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-border text-xs focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card text-text placeholder:text-muted shadow-2xs"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-accent hover:bg-accent-hover text-on-accent rounded-xl text-xs font-semibold shadow-xs shadow-accent/20 transition-all active:scale-98"
                >
                  Search
                </button>
              </form>

              <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
                <button
                  onClick={() => handleSaveForOutreach()}
                  disabled={selectedCompanyIds.length === 0 || isEnrolling}
                  className={`flex items-center gap-1.5 px-4 py-2 text-white font-semibold text-xs rounded-xl shadow-xs transition-all ${
                    selectedCompanyIds.length > 0 && !isEnrolling
                      ? 'bg-accent hover:bg-accent-hover shadow-accent/20 cursor-pointer active:scale-98'
                      : 'bg-track text-muted cursor-not-allowed border border-border'
                  }`}
                >
                  <Send className={`w-3.5 h-3.5 ${isEnrolling ? 'animate-pulse' : ''}`} />
                  <span>
                    {isEnrolling
                      ? 'Enrolling...'
                      : `Save ${selectedCompanyIds.length > 0 ? `(${selectedCompanyIds.length})` : ''} for Outreach`}
                  </span>
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                <Filter className="w-3.5 h-3.5" />
                <span>Filters:</span>
              </div>

              <select
                value={selectedTier}
                onChange={(e) => {
                  setSelectedTier(e.target.value as any);
                  setPage(1);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-700"
              >
                <option value="">All Relevance Tiers</option>
                <option value="high">High Relevance (80–100)</option>
                <option value="medium">Medium Relevance (50–79)</option>
                <option value="low">Low Relevance (&lt;50)</option>
              </select>

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={hasEmail}
                  onChange={(e) => {
                    setHasEmail(e.target.checked);
                    setPage(1);
                  }}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Has Public Email</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                <input
                  type="checkbox"
                  checked={hasDecisionMaker}
                  onChange={(e) => {
                    setHasDecisionMaker(e.target.checked);
                    setPage(1);
                  }}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Has Decision Maker</span>
              </label>

              <div className="flex items-center gap-1 text-slate-700">
                <span>Min Score:</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={minScore}
                  onChange={(e) => {
                    setMinScore(e.target.value === '' ? '' : parseInt(e.target.value, 10));
                    setPage(1);
                  }}
                  className="w-16 px-2 py-1 border border-slate-300 rounded text-xs"
                />
              </div>

              {(selectedTier || !hasEmail || hasDecisionMaker || minScore !== 50) && (
                <button
                  onClick={() => {
                    setSelectedTier('');
                    setHasEmail(true);
                    setHasDecisionMaker(false);
                    setMinScore(50);
                    setPage(1);
                  }}
                  className="text-xs text-rose-600 hover:underline font-medium"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Companies List */}
          {loadingCompanies ? (
            <TableSkeleton rows={8} />
          ) : companies.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No Qualified Leads Found"
              description="Adjust your filters or run a new search to discover companies for outreach."
              actionLabel="Find Companies"
              onAction={onNavigateToFind}
            />
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="p-3 w-10">
                      <button onClick={toggleSelectAll}>
                        {selectedCompanyIds.length === companies.length && companies.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300" />
                        )}
                      </button>
                    </th>
                    <th className="p-3">Company & Domain</th>
                    <th className="p-3">Industry</th>
                    <th className="p-3">Relevance</th>
                    <th className="p-3">Public Emails</th>
                    <th className="p-3">Decision Makers</th>
                    <th className="p-3">Lead Status</th>
                    <th className="p-3 text-right">Enroll Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {companies.map((company) => {
                    const isSelected = selectedCompanyIds.includes(company._id);
                    const isExpanded = expandedCompanyId === company._id;
                    const dmCount = company.decisionMakers?.length || 0;
                    const hasValidDMs = company.decisionMakers?.some((dm) => dm.publicBusinessEmail);

                    return (
                      <React.Fragment key={company._id}>
                        <tr
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isSelected ? 'bg-indigo-50/30' : ''
                          }`}
                        >
                          <td className="p-3">
                            <button onClick={() => toggleSelectOne(company._id)}>
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-indigo-600" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-300" />
                              )}
                            </button>
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-slate-900">{company.companyName}</div>
                            {company.website ? (
                              <a
                                href={company.website}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1 font-mono"
                              >
                                <span>{company.domain}</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-[11px] text-slate-400">No website</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
                              {company.industry || 'General'}
                            </span>
                          </td>
                          <td className="p-3">
                            <ScoreBadge score={company.leadScore} />
                          </td>
                          <td className="p-3">
                            {company.emails && company.emails.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                {company.emails.slice(0, 2).map((em) => (
                                  <span key={em} className="font-mono text-[11px] text-slate-700 truncate max-w-[150px]">
                                    {em}
                                  </span>
                                ))}
                                {company.emails.length > 2 && (
                                  <span className="text-[10px] text-slate-400">
                                    +{company.emails.length - 2} more
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">None</span>
                            )}
                          </td>
                          <td className="p-3">
                            {dmCount > 0 ? (
                              <button
                                onClick={() =>
                                  setExpandedCompanyId(isExpanded ? null : company._id)
                                }
                                className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-semibold"
                              >
                                <span>
                                  {dmCount} Identified {hasValidDMs ? '📧' : ''}
                                </span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                            ) : (
                              <span className="text-slate-400 italic">0 identified</span>
                            )}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                                company.leadStatus === 'contacted'
                                  ? 'bg-blue-100 text-blue-800'
                                  : company.leadStatus === 'reviewed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {company.leadStatus || 'new'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleSaveForOutreach([company._id])}
                              disabled={isEnrolling}
                              className="px-2.5 py-1 bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-indigo-700 text-xs font-medium rounded-lg transition-colors shadow-2xs"
                            >
                              Save for Outreach
                            </button>
                          </td>
                        </tr>

                        {/* Expanded Decision-Makers Details */}
                        {isExpanded && dmCount > 0 && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={8} className="p-4 pl-12 border-b border-slate-200">
                              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5 max-w-2xl">
                                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Identified Decision-Makers at {company.companyName}:</span>
                                </div>
                                <div className="divide-y divide-slate-100">
                                  {company.decisionMakers.map((dm, idx) => (
                                    <div
                                      key={idx}
                                      className="py-2 flex items-center justify-between text-xs"
                                    >
                                      <div>
                                        <span className="font-semibold text-slate-900">
                                          {dm.fullName}
                                        </span>{' '}
                                        <span className="text-slate-500">— {dm.jobTitle}</span>
                                        {dm.publicBusinessEmail && (
                                          <div className="font-mono text-[11px] text-emerald-700">
                                            {dm.publicBusinessEmail}
                                          </div>
                                        )}
                                      </div>
                                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                                        {dm.confidence} confidence
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <div>
                  Showing <span className="font-semibold text-slate-800">{(page - 1) * 12 + 1}</span> to{' '}
                  <span className="font-semibold text-slate-800">
                    {Math.min(page * 12, totalCompanies)}
                  </span>{' '}
                  of <span className="font-semibold text-slate-800">{totalCompanies}</span> leads
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    disabled={page <= 1}
                    className="p-1.5 rounded border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                    disabled={page >= totalPages}
                    className="p-1.5 rounded border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: Enrolled Outreach Contacts */}
      {activeSubTab === 'enrolled' && (
        <div className="space-y-4">
          {loadingContacts ? (
            <TableSkeleton rows={8} />
          ) : outreachContacts.length === 0 ? (
            <EmptyState
              icon={UserCheck}
              title="No Contacts Enrolled in Outreach Yet"
              description="Switch to the 'Phase 1 Discovered Leads' tab above, select promising companies, and click 'Save for Outreach'."
              actionLabel="Browse Discovered Leads"
              onAction={() => setActiveSubTab('discover')}
            />
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="p-3">Contact Name</th>
                    <th className="p-3">Job Title</th>
                    <th className="p-3">Company</th>
                    <th className="p-3">Email Address</th>
                    <th className="p-3">Syntax Validation</th>
                    <th className="p-3">Outreach Status</th>
                    <th className="p-3">Suppression</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {outreachContacts.map((contact) => {
                    const compName =
                      typeof contact.companyId === 'object' && contact.companyId !== null
                        ? (contact.companyId as any).companyName
                        : '—';

                    return (
                      <tr key={contact._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-semibold text-slate-900">
                          {contact.contactName || <span className="text-slate-400 italic">General Contact</span>}
                        </td>
                        <td className="p-3 text-slate-600">
                          {contact.jobTitle || '—'}
                        </td>
                        <td className="p-3 text-slate-700 font-medium">
                          {compName}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-900">
                          {contact.email}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                              contact.validationStatus === 'format_valid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {contact.validationStatus}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                              contact.outreachStatus === 'selected'
                                ? 'bg-indigo-100 text-indigo-800'
                                : contact.outreachStatus === 'contacted'
                                ? 'bg-blue-100 text-blue-800'
                                : contact.outreachStatus === 'interested'
                                ? 'bg-emerald-100 text-emerald-800'
                                : contact.outreachStatus === 'suppressed'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {contact.outreachStatus}
                          </span>
                        </td>
                        <td className="p-3">
                          {contact.suppressionStatus?.isSuppressed ? (
                            <span className="text-rose-600 font-semibold text-[11px]">
                              Suppressed ({contact.suppressionStatus.reason || 'opt-out'})
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Active</span>
                          )}
                        </td>
                        <td className="p-3 text-right space-x-2">
                          {contact.outreachStatus !== 'suppressed' && contact.outreachStatus !== 'unsubscribed' && (
                            <>
                              {contact.outreachStatus === 'pending_approval' && (
                                <button
                                  type="button"
                                  onClick={() => onNavigateToDrafts?.()}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md hover:bg-emerald-100 transition-colors"
                                >
                                  <span>Review Draft</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              )}

                              <button
                                type="button"
                                disabled={generatingContactId !== null}
                                onClick={async () => {
                                  try {
                                    setGeneratingContactId(contact._id);
                                    setActionFeedback({
                                      type: 'success',
                                      message: `Gemini AI is analyzing Masood Textile Mills data & crafting a personalized outreach draft for ${contact.email}...`,
                                    });
                                    const res = await api.generateDraft({ contactId: contact._id });
                                    if (res.success) {
                                      setActionFeedback({
                                        type: 'success',
                                        message: `Personalized email draft created for ${contact.email}! Click "Review Draft" or visit "Email Drafts & Review" to inspect and approve.`,
                                      });
                                      await loadOutreachContacts();
                                    }
                                  } catch (err: any) {
                                    setActionFeedback({
                                      type: 'error',
                                      message: err.message || 'Failed to generate draft. Please ensure GEMINI_API_KEY is configured in backend/.env.',
                                    });
                                  } finally {
                                    setGeneratingContactId(null);
                                  }
                                }}
                                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md transition-colors ${
                                  generatingContactId === contact._id
                                    ? 'bg-indigo-100 text-indigo-700 cursor-wait'
                                    : 'text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100'
                                }`}
                              >
                                {generatingContactId === contact._id ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                                    <span>Generating...</span>
                                  </>
                                ) : contact.outreachStatus === 'pending_approval' ? (
                                  <span>Regenerate</span>
                                ) : (
                                  <>
                                    <Sparkles className="w-3 h-3 text-indigo-600" />
                                    <span>Generate AI Draft</span>
                                  </>
                                )}
                              </button>
                            </>
                          )}
                          {contact.outreachStatus !== 'suppressed' && (
                            <button
                              onClick={async () => {
                                if (window.confirm(`Suppress ${contact.email}? They will never receive outreach and any pending follow-ups will be cancelled.`)) {
                                  try {
                                    await api.addSuppressedEmail({
                                      email: contact.email,
                                      reason: 'manual_suppression',
                                      source: 'lead_management_ui',
                                    });
                                    setActionFeedback({
                                      type: 'success',
                                      message: `Successfully suppressed ${contact.email} and cancelled pending jobs.`,
                                    });
                                    loadOutreachContacts();
                                  } catch (err: any) {
                                    setActionFeedback({
                                      type: 'error',
                                      message: err.message || 'Failed to suppress contact.',
                                    });
                                  }
                                }
                              }}
                              className="text-xs text-rose-600 hover:underline"
                            >
                              Suppress
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Contacts Pagination */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <div>
                  Showing <span className="font-semibold text-slate-800">{(contactsPage - 1) * 15 + 1}</span> to{' '}
                  <span className="font-semibold text-slate-800">
                    {Math.min(contactsPage * 15, totalContacts)}
                  </span>{' '}
                  of <span className="font-semibold text-slate-800">{totalContacts}</span> contacts
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setContactsPage((p) => Math.max(p - 1, 1))}
                    disabled={contactsPage <= 1}
                    className="p-1.5 rounded border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span>Page {contactsPage}</span>
                  <button
                    onClick={() => setContactsPage((p) => p + 1)}
                    disabled={outreachContacts.length < 15}
                    className="p-1.5 rounded border border-slate-200 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Floating in-view action toast */}
      {actionFeedback && (
        <div className="fixed bottom-6 right-6 max-w-md z-50 animate-in slide-in-from-bottom-4 duration-300">
          <div
            className={`p-4 rounded-xl shadow-2xl border flex items-start justify-between gap-3 ${
              actionFeedback.type === 'success'
                ? 'bg-slate-900 border-indigo-500/60 text-white'
                : 'bg-rose-950 border-rose-500/60 text-white'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {actionFeedback.type === 'success' ? (
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1.5">
                <p className="text-xs font-medium leading-relaxed">{actionFeedback.message}</p>
                {actionFeedback.type === 'success' && onNavigateToDrafts && (
                  <button
                    type="button"
                    onClick={() => onNavigateToDrafts()}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-300 hover:text-white bg-indigo-900/60 border border-indigo-700/60 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    <span>Open Email Drafts & Review</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActionFeedback(null)}
              className="text-slate-400 hover:text-white font-bold ml-2 text-sm leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
