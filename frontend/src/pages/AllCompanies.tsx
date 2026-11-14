import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Download,
  ExternalLink,
  Sparkles,
  Bookmark,
  BookmarkCheck,
  Trash2,
  Eye,
  CheckSquare,
  Square,
  FileSpreadsheet,
  FileText,
  Building2,
  Mail,
  Phone,
  ChevronLeft,
  ChevronRight,
  Globe,
  RefreshCw,
  Star,
  Briefcase,
} from 'lucide-react';
import { api } from '../services/api';
import { ICompany } from '../types';
import { ScoreBadge, Badge } from '../components/Badge';
import { TableSkeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { ErrorAlert } from '../components/ErrorAlert';
import { CompanyModal } from '../components/CompanyModal';
import { ExportModal, ExportFormat, CsvExportType } from '../components/ExportModal';
import { LeadWorkspaceNav } from '../components/WorkspaceNav';
import { NavTab } from '../components/Sidebar';

interface AllCompaniesProps {
  onNavigateToFind: () => void;
  selectedCompanyId?: string | null;
  onNavigate?: (tab: NavTab) => void;
}

export const AllCompanies: React.FC<AllCompaniesProps> = ({ onNavigateToFind, selectedCompanyId, onNavigate }) => {
  const [companies, setCompanies] = useState<ICompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Sorting
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedSize, setSelectedSize] = useState('All');
  const [hasWebsite, setHasWebsite] = useState(false);
  const [hasEmail, setHasEmail] = useState(false);
  const [hasDecisionMaker, setHasDecisionMaker] = useState(false);
  const [minScore, setMinScore] = useState<number | ''>('');
  const [selectedTier, setSelectedTier] = useState<'' | 'high' | 'medium' | 'low'>('');
  const [isReScoringAll, setIsReScoringAll] = useState(false);

  // Selection & Modal
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [inspectingCompany, setInspectingCompany] = useState<ICompany | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('excel');
  const [exportCsvType, setExportCsvType] = useState<CsvExportType>('companies');

  useEffect(() => {
    loadCompanies();
  }, [page, sortBy, sortOrder, selectedIndustry, selectedCountry, selectedSize, hasWebsite, hasEmail, hasDecisionMaker, minScore, selectedTier]);

  useEffect(() => {
    if (selectedCompanyId) {
      api.getCompanyById(selectedCompanyId).then((res) => {
        if (res.success) setInspectingCompany(res.data);
      });
    }
  }, [selectedCompanyId]);

  const loadCompanies = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = {
        page,
        limit,
        sortBy,
        sortOrder,
      };

      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (selectedIndustry) params.industry = selectedIndustry;
      if (selectedCountry) params.country = selectedCountry;
      if (selectedSize && selectedSize !== 'All') params.companySize = selectedSize;
      if (hasWebsite) params.hasWebsite = 'true';
      if (hasEmail) params.hasEmail = 'true';
      if (hasDecisionMaker) params.hasDecisionMaker = 'true';
      if (minScore !== '') params.minScore = minScore;
      if (selectedTier) params.tier = selectedTier;

      const res = await api.getCompanies(params);
      if (res.success) {
        setCompanies(res.data.companies);
        setTotalPages(res.data.pagination.totalPages);
        setTotalCount(res.data.pagination.total);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch companies');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadCompanies();
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === companies.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(companies.map((c) => c._id));
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleToggleSave = async (company: ICompany) => {
    const nextSaved = !company.isSaved;
    try {
      await api.updateCompany(company._id, { isSaved: nextSaved });
      setCompanies(
        companies.map((c) => (c._id === company._id ? { ...c, isSaved: nextSaved } : c))
      );
    } catch (err: any) {
      alert(err.message || 'Error updating save status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this company lead?')) return;
    try {
      await api.deleteCompany(id);
      setCompanies(companies.filter((c) => c._id !== id));
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } catch (err: any) {
      alert(err.message || 'Error deleting lead');
    }
  };

  const handleTriggerAI = async (id: string) => {
    try {
      const res = await api.analyzeCompany(id);
      if (res.success) {
        const modelUsed = res.data?.aiAnalysis?.modelUsed || 'Gemini';
        alert(`Google Gemini AI analysis (${modelUsed}) completed successfully!`);
        loadCompanies();
        if (inspectingCompany?._id === id) {
          const updated = await api.getCompanyById(id);
          if (updated.success) setInspectingCompany(updated.data);
        }
      }
    } catch (err: any) {
      alert(`❌ Gemini AI Error:\n\n${err.message || 'API key is invalid, quota exceeded, or Google model is unreachable.'}\n\nPlease check your GEMINI_API_KEY in backend/.env.`);
      loadCompanies();
      if (inspectingCompany?._id === id) {
        const updated = await api.getCompanyById(id);
        if (updated.success) setInspectingCompany(updated.data);
      }
    }
  };

  const handleTriggerScrape = async (id: string) => {
    try {
      const res = await api.scrapeCompany(id);
      if (res.success) {
        alert('Website scraping and contact extraction completed!');
        loadCompanies();
        if (inspectingCompany?._id === id) {
          const updated = await api.getCompanyById(id);
          if (updated.success) setInspectingCompany(updated.data);
        }
      }
    } catch (err: any) {
      alert(err.message || 'Scraping failed');
    }
  };

  const handleDiscoverDecisionMakers = async (id: string) => {
    try {
      const res = await api.discoverDecisionMakers(id);
      if (res.success) {
        alert(res.message);
        loadCompanies();
        if (inspectingCompany?._id === id) {
          const updated = await api.getCompanyById(id);
          if (updated.success) setInspectingCompany(updated.data);
        }
      }
    } catch (err: any) {
      alert(err.message || 'Decision-maker discovery failed');
    }
  };

  const handleUpdateCompany = async (id: string, updates: Partial<ICompany>) => {
    const res = await api.updateCompany(id, updates);
    if (res.success) {
      setCompanies(companies.map((c) => (c._id === id ? res.data : c)));
      if (inspectingCompany?._id === id) {
        setInspectingCompany(res.data);
      }
    }
  };

  const handleReScore = async (id: string) => {
    try {
      const res = await api.reScoreCompany(id);
      if (res.success) {
        alert(res.message);
        loadCompanies();
        if (inspectingCompany?._id === id) {
          setInspectingCompany(res.data);
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to re-score company');
    }
  };

  const handleScrapeJobs = async (id: string) => {
    try {
      const res = await api.scrapeCompanyJobs(id);
      if (res.success && res.data) {
        setCompanies((prev) =>
          prev.map((c) =>
            c._id === id
              ? {
                ...c,
                jobPostings: res.data.jobPostings,
                jobsScrapedAt: new Date().toISOString(),
              }
              : c
          )
        );
        if (inspectingCompany?._id === id) {
          setInspectingCompany((prev) =>
            prev
              ? {
                ...prev,
                jobPostings: res.data.jobPostings,
                jobsScrapedAt: new Date().toISOString(),
              }
              : null
          );
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to scrape job postings via JobSpy');
    }
  };

  const handleReScoreAll = async () => {
    if (!window.confirm('Recalculate explainable lead relevance scores for all companies in database?')) return;
    setIsReScoringAll(true);
    try {
      const res = await api.reScoreAllCompanies();
      if (res.success) {
        alert(res.message);
        loadCompanies();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to re-score companies');
    } finally {
      setIsReScoringAll(false);
    }
  };

  return (
    <div className="space-y-6">
      <LeadWorkspaceNav activeTab="companies" onNavigate={onNavigate || onNavigateToFind} />
      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* Control Bar: Search, Filters & Bulk Export */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="w-full lg:w-96 flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search company, domain, services..."
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

          {/* Action buttons & Exports */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
            <button
              onClick={handleReScoreAll}
              disabled={isReScoringAll}
              className="flex items-center gap-1.5 px-3 py-2 bg-accent-soft hover:bg-accent-soft/80 border border-accent/20 text-accent text-xs font-semibold rounded-xl transition-colors shadow-2xs"
              title="Recalculate explainable lead relevance scores across all companies"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReScoringAll ? 'animate-spin' : ''}`} />
              <span>{isReScoringAll ? 'Re-Scoring...' : 'Re-Score All'}</span>
            </button>

            <button
              onClick={() => {
                setExportFormat('excel');
                setIsExportModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl transition-colors shadow-2xs"
              title="Export Multi-Tab Excel Workbook"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Excel {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}</span>
            </button>

            <button
              onClick={() => {
                setExportFormat('csv');
                setIsExportModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-card border border-border hover:bg-card-hover text-text text-xs font-medium rounded-xl transition-colors shadow-2xs"
              title="Export CSV Dataset"
            >
              <FileText className="w-3.5 h-3.5 text-muted" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Lead Tier Tabs */}
        <div className="flex items-center gap-1.5 pt-2 pb-1 border-t border-border text-xs overflow-x-auto">
          <button
            onClick={() => { setSelectedTier(''); setPage(1); }}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${selectedTier === '' ? 'bg-accent text-on-accent shadow-xs shadow-accent/20' : 'text-text-secondary hover:text-text hover:bg-card-hover border border-border'}`}
          >
            All Leads
          </button>
          <button
            onClick={() => { setSelectedTier('high'); setPage(1); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition-all ${selectedTier === 'high' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 bg-emerald-50/70 border border-emerald-200 hover:bg-emerald-100/70'}`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            High Relevance (80–100)
          </button>
          <button
            onClick={() => { setSelectedTier('medium'); setPage(1); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition-all ${selectedTier === 'medium' ? 'bg-amber-600 text-white shadow-xs' : 'text-amber-700 bg-amber-50/70 border border-amber-200 hover:bg-amber-100/70'}`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            Medium Relevance (50–79)
          </button>
          <button
            onClick={() => { setSelectedTier('low'); setPage(1); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold transition-all ${selectedTier === 'low' ? 'bg-slate-700 text-white shadow-xs' : 'text-muted bg-track/50 border border-border hover:bg-card-hover'}`}
          >
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            Low Relevance (&lt;50)
          </button>
        </div>

        {/* Filters Row */}
        <div className="pt-3 border-t border-border flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-text-secondary font-medium">
            <Filter className="w-3.5 h-3.5 text-accent" />
            <span>Filters:</span>
          </div>

          <select
            value={selectedIndustry}
            onChange={(e) => {
              setSelectedIndustry(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 rounded-xl border border-border text-xs bg-card text-text shadow-2xs"
          >
            <option value="">All Industries</option>
            <option value="Technology">Technology</option>
            <option value="Manufacturing">Manufacturing</option>
            <option value="Healthcare">Healthcare</option>
            <option value="Logistics">Logistics</option>
            <option value="Real Estate">Real Estate</option>
            <option value="Retail">Retail</option>
          </select>

          <select
            value={selectedSize}
            onChange={(e) => {
              setSelectedSize(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 rounded-xl border border-border text-xs bg-card text-text shadow-2xs"
          >
            <option value="All">All Sizes</option>
            <option value="Small: 1–50 employees">Small (1-50)</option>
            <option value="Medium: 51–250 employees">Medium (51-250)</option>
            <option value="Large: 251–1000 employees">Large (251-1000)</option>
            <option value="Enterprise: 1000+ employees">Enterprise (1000+)</option>
            <option value="Unknown">Unknown</option>
          </select>

          <label className="flex items-center gap-1.5 cursor-pointer text-text-secondary hover:text-text">
            <input
              type="checkbox"
              checked={hasWebsite}
              onChange={(e) => {
                setHasWebsite(e.target.checked);
                setPage(1);
              }}
              className="rounded border-border text-accent focus:ring-accent"
            />
            <span>Has Website</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-text-secondary hover:text-text">
            <input
              type="checkbox"
              checked={hasEmail}
              onChange={(e) => {
                setHasEmail(e.target.checked);
                setPage(1);
              }}
              className="rounded border-border text-accent focus:ring-accent"
            />
            <span>Has Email</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer text-text-secondary hover:text-text">
            <input
              type="checkbox"
              checked={hasDecisionMaker}
              onChange={(e) => {
                setHasDecisionMaker(e.target.checked);
                setPage(1);
              }}
              className="rounded border-border text-accent focus:ring-accent"
            />
            <span>Has Decision Maker</span>
          </label>

          {/* Min Score Filter */}
          <div className="flex items-center gap-1 text-text-secondary">
            <span>Min Score:</span>
            <input
              type="number"
              min="0"
              max="100"
              placeholder="e.g. 70"
              value={minScore}
              onChange={(e) => {
                setMinScore(e.target.value === '' ? '' : parseInt(e.target.value, 10));
                setPage(1);
              }}
              className="w-16 px-2 py-1 border border-border rounded-lg text-xs bg-card text-text"
            />
          </div>

          {(selectedIndustry || selectedSize !== 'All' || hasWebsite || hasEmail || hasDecisionMaker || minScore !== '') && (
            <button
              onClick={() => {
                setSelectedIndustry('');
                setSelectedSize('All');
                setHasWebsite(false);
                setHasEmail(false);
                setHasDecisionMaker(false);
                setMinScore('');
                setPage(1);
              }}
              className="text-xs text-rose-600 hover:underline font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Companies Results Table */}
      {loading ? (
        <TableSkeleton rows={8} />
      ) : companies.length === 0 ? (
        <EmptyState
          title="No Companies Discovered Yet"
          description="Start a discovery job to find potential business customers matching your industry and region."
          actionLabel="Find Companies Now"
          onAction={onNavigateToFind}
        />
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-sidebar text-text-secondary uppercase font-semibold border-b border-border tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5 w-8">
                    <button onClick={toggleSelectAll}>
                      {selectedIds.length === companies.length ? (
                        <CheckSquare className="w-4 h-4 text-accent" />
                      ) : (
                        <Square className="w-4 h-4 text-muted" />
                      )}
                    </button>
                  </th>
                  <th className="p-3.5">Company Name</th>
                  <th className="p-3.5">Source</th>
                  <th className="p-3.5">Industry</th>
                  <th className="p-3.5">Location</th>
                  <th className="p-3.5">Phone</th>
                  <th className="p-3.5">Website</th>
                  <th className="p-3.5">Public Email</th>
                  <th className="p-3.5">CEO / Decision-Maker</th>
                  <th className="p-3.5">Size</th>
                  <th className="p-3.5">AI Opp</th>
                  <th className="p-3.5">Score</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-text">
                {companies.map((company) => {
                  const isSelected = selectedIds.includes(company._id);
                  const ceo = company.decisionMakers?.find(
                    (dm) => /ceo|founder|owner|president|managing/i.test(dm.jobTitle)
                  ) || company.decisionMakers?.[0];

                  const oppCount = company.aiAnalysis?.opportunities?.length || 0;

                  return (
                    <tr
                      key={company._id}
                      className={`hover:bg-card-hover transition-colors ${isSelected ? 'bg-accent-soft/40' : ''
                        }`}
                    >
                      <td className="p-3.5">
                        <button onClick={() => toggleSelectOne(company._id)}>
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-accent" />
                          ) : (
                            <Square className="w-4 h-4 text-muted" />
                          )}
                        </button>
                      </td>

                      <td className="p-3.5 font-semibold text-text">
                        <div className="flex flex-col">
                          <button
                            onClick={() => setInspectingCompany(company)}
                            className="hover:text-accent text-left font-semibold max-w-[160px] truncate block transition-colors cursor-pointer"
                            title={company.companyName}
                          >
                            {company.companyName}
                          </button>
                          {company.googleRating !== undefined && (
                            <div className="flex items-center gap-1 text-[10px] text-amber-600 font-semibold mt-0.5">
                              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                              <span>{company.googleRating.toFixed(1)}</span>
                              <span className="text-muted font-normal">({company.googleReviewsCount || company.reviews?.length || 0})</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Source */}
                      <td className="p-3.5 whitespace-nowrap">
                        {company.sources?.some((s) => s.sourceType === 'google_maps') ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>Maps 📍</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-track text-text-secondary border border-border">
                            <span>OSM / Web</span>
                          </span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-lg bg-sidebar text-text-secondary border border-border font-medium text-[11px]">
                          {company.industry}
                        </span>
                      </td>

                      <td className="p-3.5 text-text-secondary max-w-[120px] truncate">
                        {[company.city, company.country].filter(Boolean).join(', ') || '—'}
                      </td>

                      {/* Phone */}
                      <td className="p-3.5 font-mono text-[11px] whitespace-nowrap">
                        {company.phoneNumbers && company.phoneNumbers.length > 0 ? (
                          <a
                            href={`tel:${company.phoneNumbers[0]}`}
                            className="text-text hover:text-accent font-medium inline-flex items-center gap-1 transition-colors"
                          >
                            <Phone className="w-3 h-3 text-muted shrink-0" />
                            <span>{company.phoneNumbers[0]}</span>
                          </a>
                        ) : (
                          <span className="text-muted italic">None</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        {company.website ? (
                          <a
                            href={company.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:underline flex items-center gap-1 font-mono text-[11px] max-w-[120px] truncate"
                          >
                            <span>{company.domain || 'Visit'}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        ) : (
                          <span className="text-muted italic">None</span>
                        )}
                      </td>

                      <td className="p-3.5 max-w-[140px] truncate font-mono text-[11px] text-text-secondary">
                        {company.emails && company.emails.length > 0 ? (
                          company.emails[0]
                        ) : (
                          <span className="text-muted italic">None</span>
                        )}
                      </td>

                      <td className="p-3.5 max-w-[150px]">
                        {ceo ? (
                          <div className="truncate">
                            <span className="font-medium text-text block truncate">{ceo.fullName}</span>
                            <span className="text-[10px] text-muted block truncate">{ceo.jobTitle}</span>
                          </div>
                        ) : (
                          <span className="text-muted italic">Not Identified</span>
                        )}
                      </td>

                      <td className="p-3.5 text-text-secondary text-[11px]">
                        {company.companySize.split(':')[0]}
                      </td>

                      <td className="p-3.5">
                        {oppCount > 0 ? (
                          <Badge size="sm" variant="purple">
                            <Sparkles className="w-3 h-3" />
                            {oppCount} Opps
                          </Badge>
                        ) : (
                          <span className="text-muted text-[11px]">—</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <ScoreBadge score={company.leadScore} />
                      </td>

                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {company.website && (
                            <button
                              onClick={() => handleTriggerScrape(company._id)}
                              className="p-1.5 text-text-secondary hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Scrape website for emails & contact numbers"
                            >
                              <Globe className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => handleScrapeJobs(company._id)}
                            className="p-1.5 text-text-secondary hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                            title={
                              company.jobPostings && company.jobPostings.length > 0
                                ? `${company.jobPostings.length} job postings scraped. Click to refresh.`
                                : "Scrape active job postings via JobSpy (LinkedIn, Indeed, Google Jobs)"
                            }
                          >
                            <Briefcase className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleTriggerAI(company._id)}
                            className={`p-1.5 rounded-lg transition-colors ${company.analysisStatus === 'completed'
                                ? 'text-indigo-600 hover:bg-indigo-50'
                                : 'text-text-secondary hover:text-indigo-700 hover:bg-indigo-50'
                              }`}
                            title={
                              company.analysisStatus === 'completed'
                                ? "Gemini analysis completed. Click to re-analyze."
                                : "Analyze company with Gemini AI (pain points & opportunities)"
                            }
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setInspectingCompany(company)}
                            className="p-1.5 text-text-secondary hover:text-accent hover:bg-accent-soft rounded-lg transition-colors"
                            title="View full details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleToggleSave(company)}
                            className={`p-1.5 rounded-lg transition-colors ${company.isSaved
                                ? 'text-amber-600 hover:bg-amber-50'
                                : 'text-muted hover:text-text hover:bg-card-hover'
                              }`}
                            title={company.isSaved ? 'Lead Saved' : 'Save Lead'}
                          >
                            {company.isSaved ? (
                              <BookmarkCheck className="w-3.5 h-3.5 fill-amber-500" />
                            ) : (
                              <Bookmark className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            onClick={() => handleDelete(company._id)}
                            className="p-1.5 text-muted hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete Lead"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="px-6 py-4 bg-sidebar border-t border-border flex items-center justify-between text-xs text-text-secondary">
            <div>
              Showing <span className="font-semibold text-text">{(page - 1) * limit + 1}</span> to{' '}
              <span className="font-semibold text-text">
                {Math.min(page * limit, totalCount)}
              </span>{' '}
              of <span className="font-semibold text-text">{totalCount}</span> companies
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-xl border border-border bg-card text-text disabled:opacity-40 disabled:cursor-not-allowed hover:bg-card-hover shadow-2xs"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-xl border border-border bg-card text-text disabled:opacity-40 disabled:cursor-not-allowed hover:bg-card-hover shadow-2xs"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide-over Detail Modal */}
      {inspectingCompany && (
        <CompanyModal
          company={inspectingCompany}
          onClose={() => setInspectingCompany(null)}
          onUpdate={handleUpdateCompany}
          onAnalyze={handleTriggerAI}
          onScrape={handleTriggerScrape}
          onDiscoverDecisionMakers={handleDiscoverDecisionMakers}
          onScrapeJobs={handleScrapeJobs}
          onReScore={handleReScore}
        />
      )}

      {/* Floating Selection Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-text text-white px-5 py-3 rounded-2xl shadow-xl border border-border/20 flex items-center gap-4 text-xs animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
            <span className="font-semibold">{selectedIds.length} companies selected</span>
          </div>
          <div className="h-4 w-px bg-white/20"></div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setExportFormat('excel');
                setIsExportModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>
            <button
              onClick={() => {
                setExportFormat('csv');
                setIsExportModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl font-medium transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-2 py-1.5 text-white/70 hover:text-white transition-colors"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        selectedIds={selectedIds}
        activeFilters={{
          search: searchTerm.trim() || undefined,
          industry: selectedIndustry || undefined,
          country: selectedCountry || undefined,
          companySize: selectedSize !== 'All' ? selectedSize : undefined,
          hasWebsite: hasWebsite ? 'true' : undefined,
          hasEmail: hasEmail ? 'true' : undefined,
          hasDecisionMaker: hasDecisionMaker ? 'true' : undefined,
          minScore: minScore !== '' ? minScore : undefined,
          tier: selectedTier || undefined,
        }}
        defaultFormat={exportFormat}
        defaultCsvType={exportCsvType}
      />
    </div>
  );
};
