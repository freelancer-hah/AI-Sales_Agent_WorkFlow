import React, { useState, useEffect } from 'react';
import {
  Search,
  Building2,
  MapPin,
  Sparkles,
  Layers,
  CheckCircle2,
  Loader2,
  Plus,
  X,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';
import { api } from '../services/api';
import { ISearchCriteria, ISearchJob } from '../types';
import { NavTab } from '../components/Sidebar';
import { LeadWorkspaceNav } from '../components/WorkspaceNav';

interface FindCompaniesProps {
  onNavigate: (tab: NavTab) => void;
  onJobStarted?: (jobId: string) => void;
}

const INDUSTRIES = [
  'Manufacturing',
  'Healthcare',
  'Real Estate',
  'E-commerce',
  'Education',
  'Logistics',
  'Construction',
  'Retail',
  'Finance',
  'Hospitality',
  'Technology',
  'Automotive',
  'Food and Beverage',
  'Professional Services',
  'Other',
];

const COMPANY_SIZES = [
  'Small: 1–50 employees',
  'Medium: 51–250 employees',
  'Large: 251–1000 employees',
  'Enterprise: 1000+ employees',
  'Unknown',
];

const AI_REQUIREMENTS = [
  'AI Customer Support',
  'AI Chatbots',
  'Sales Automation',
  'Marketing Automation',
  'Workflow Automation',
  'Inventory Automation',
  'Document Processing',
  'Data Entry Automation',
  'AI Business Analytics',
  'Custom AI Solutions',
];

const RESULT_LIMITS = [10, 25, 50, 100];

export const FindCompanies: React.FC<FindCompaniesProps> = ({ onNavigate, onJobStarted }) => {
  const [industry, setIndustry] = useState('Technology');
  const [customIndustry, setCustomIndustry] = useState('');
  const [category, setCategory] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>(['B2B software', 'automation']);
  const [country, setCountry] = useState('United States');
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('San Francisco');
  const [companySize, setCompanySize] = useState('Unknown');
  const [serviceInput, setServiceInput] = useState('');
  const [services, setServices] = useState<string[]>(['Cloud Solutions']);
  const [selectedAiRequirements, setSelectedAiRequirements] = useState<string[]>([
    'Workflow Automation',
    'AI Customer Support',
  ]);
  const [maxCompanies, setMaxCompanies] = useState<number>(25);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeJob, setActiveJob] = useState<ISearchJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAddKeyword = () => {
    if (keywordInput.trim() && !keywords.includes(keywordInput.trim())) {
      setKeywords([...keywords, keywordInput.trim()]);
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (index: number) => {
    setKeywords(keywords.filter((_, i) => i !== index));
  };

  const handleAddService = () => {
    if (serviceInput.trim() && !services.includes(serviceInput.trim())) {
      setServices([...services, serviceInput.trim()]);
      setServiceInput('');
    }
  };

  const handleRemoveService = (index: number) => {
    setServices(services.filter((_, i) => i !== index));
  };

  const toggleAiRequirement = (req: string) => {
    if (selectedAiRequirements.includes(req)) {
      setSelectedAiRequirements(selectedAiRequirements.filter((r) => r !== req));
    } else {
      setSelectedAiRequirements([...selectedAiRequirements, req]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const targetIndustry = industry === 'Other' && customIndustry.trim() ? customIndustry.trim() : industry;

    const payload: ISearchCriteria = {
      industry: targetIndustry,
      category,
      keywords,
      country,
      region,
      city,
      companySize,
      services,
      aiRequirements: selectedAiRequirements,
      maxCompanies,
    };

    try {
      const response = await api.startSearch(payload);
      if (response.success) {
        if (onJobStarted) onJobStarted(response.data.jobId);
        // Fetch job detail
        const jobRes = await api.getSearchJob(response.data.jobId);
        setActiveJob(jobRes.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize discovery search');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-poll active job status every 2 seconds until completed or failed
  useEffect(() => {
    if (!activeJob) return;
    if (activeJob.status === 'completed' || activeJob.status === 'failed') return;

    const pollTimer = setInterval(async () => {
      try {
        const res = await api.getSearchJob(activeJob._id);
        if (res.success && res.data) {
          setActiveJob(res.data);
          if (res.data.status === 'completed' || res.data.status === 'failed') {
            clearInterval(pollTimer);
          }
        }
      } catch (pollErr) {
        console.warn('Discovery status polling error:', pollErr);
      }
    }, 2000);

    return () => clearInterval(pollTimer);
  }, [activeJob?._id, activeJob?.status]);

  const getJobPhaseDescription = (job: ISearchJob): string => {
    if (job.status === 'queued') return 'Job queued • Initializing discovery engine...';
    if (job.status === 'failed') return 'Discovery halted due to an issue.';
    if (job.status === 'completed') {
      return job.discoveredCount > 0
        ? `Discovery complete: Successfully saved ${job.discoveredCount} companies to MongoDB!`
        : 'Discovery complete: 0 companies found with these specific parameters.';
    }

    if (job.progress < 25) return 'Step 1/5: Geocoding location & preparing query filters...';
    if (job.progress < 50) return 'Step 2/5: Querying Google Maps (Tier-1) & OpenStreetMap for verified businesses...';
    if (job.progress < 70) return 'Step 3/5: Querying SearXNG web search engine for company profiles...';
    if (job.progress < 85) return 'Step 4/5: Normalizing company records & removing duplicate domains...';
    return 'Step 5/5: Persisting company entities and sources to MongoDB...';
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <LeadWorkspaceNav activeTab="find" onNavigate={onNavigate} />
      {/* Search Header Banner */}
      <div className="bg-gradient-to-br from-[#FFF1E6] via-[#FFF8F3] to-card rounded-2xl p-7 shadow-xs relative overflow-hidden border border-border">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-soft text-accent text-xs font-semibold uppercase tracking-wider mb-3 border border-accent/20">
            <Sparkles className="w-3.5 h-3.5" />
            Phase 1 Multi-Source Lead Finder (Google Maps 📍 + OSM + SearXNG)
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-text mb-2">
            Targeted Business Customer Discovery
          </h2>
          <p className="text-text-secondary text-sm leading-relaxed">
            Discover verified companies, retrieve official websites, extract public contact details,
            identify decision makers, and analyze AI automation opportunities with Google Gemini.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <p className="text-xs">{error}</p>
        </div>
      )}

      {/* Active Job Progress & Results Card */}
      {activeJob && (
        <div
          className={`rounded-2xl border p-6 shadow-md space-y-5 transition-all ${activeJob.status === 'completed'
            ? activeJob.discoveredCount > 0
              ? 'bg-emerald-50/50 border-emerald-200'
              : 'bg-amber-50/50 border-amber-200'
            : activeJob.status === 'failed'
              ? 'bg-rose-50/50 border-rose-200'
              : 'bg-white border-indigo-200 ring-2 ring-indigo-500/10'
            }`}
        >
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div
                className={`p-3 rounded-xl shrink-0 ${activeJob.status === 'completed'
                  ? activeJob.discoveredCount > 0
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                  : activeJob.status === 'failed'
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-indigo-100 text-indigo-700'
                  }`}
              >
                {activeJob.status === 'running' || activeJob.status === 'queued' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : activeJob.status === 'completed' ? (
                  activeJob.discoveredCount > 0 ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-slate-900 text-base">
                    Search Job: {activeJob.searchCriteria.industry || 'Companies'} in{' '}
                    {[activeJob.searchCriteria.city, activeJob.searchCriteria.country].filter(Boolean).join(', ')}
                  </h4>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${activeJob.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : activeJob.status === 'running'
                        ? 'bg-indigo-100 text-indigo-800 animate-pulse'
                        : activeJob.status === 'failed'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                  >
                    {activeJob.status === 'running' ? `Running (${activeJob.progress}%)` : activeJob.status}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 font-medium">
                  {getJobPhaseDescription(activeJob)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                type="button"
                onClick={() => onNavigate('history')}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <span>View History</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              {(activeJob.status === 'completed' || activeJob.status === 'failed') && (
                <button
                  type="button"
                  onClick={() => setActiveJob(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                  title="Dismiss card"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Dynamic Progress Bar */}
          <div className="space-y-1.5">
            <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${activeJob.status === 'completed'
                  ? activeJob.discoveredCount > 0
                    ? 'bg-emerald-600'
                    : 'bg-amber-500'
                  : activeJob.status === 'failed'
                    ? 'bg-rose-500'
                    : 'bg-indigo-600'
                  }`}
                style={{ width: `${Math.max(activeJob.progress, 6)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-semibold text-slate-500">
              <span>Pipeline Stage Progress</span>
              <span>{activeJob.progress}%</span>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/80 p-3 rounded-xl border border-slate-200/60 shadow-xs">
              <span className="text-[11px] text-slate-500 block">Target Limit</span>
              <span className="text-base font-bold text-slate-800">{activeJob.searchCriteria.maxCompanies}</span>
            </div>
            <div className="bg-white/80 p-3 rounded-xl border border-slate-200/60 shadow-xs">
              <span className="text-[11px] text-slate-500 block">Discovered & Saved</span>
              <span
                className={`text-base font-bold ${activeJob.discoveredCount > 0 ? 'text-emerald-700' : 'text-slate-700'
                  }`}
              >
                {activeJob.discoveredCount}
              </span>
            </div>
            <div className="bg-white/80 p-3 rounded-xl border border-slate-200/60 shadow-xs">
              <span className="text-[11px] text-slate-500 block">Processed</span>
              <span className="text-base font-bold text-slate-700">{activeJob.processedCount}</span>
            </div>
            <div className="bg-white/80 p-3 rounded-xl border border-slate-200/60 shadow-xs">
              <span className="text-[11px] text-slate-500 block">Failed / Skipped</span>
              <span className="text-base font-bold text-slate-500">{activeJob.failedCount}</span>
            </div>
          </div>

          {/* Completion Action Banners */}
          {activeJob.status === 'completed' && activeJob.discoveredCount > 0 && (
            <div className="bg-emerald-600/10 border border-emerald-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-emerald-900 font-semibold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Companies discovered and saved to MongoDB. Ready for scraping and Gemini AI analysis!</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('companies')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 shrink-0"
              >
                <span>View {activeJob.discoveredCount} Companies</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {activeJob.status === 'completed' && activeJob.discoveredCount === 0 && (
            <div className="bg-amber-500/10 border border-amber-300 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1.5 text-xs text-amber-950">
                  <p className="font-bold">No companies were discovered with these specific search criteria.</p>
                  <p className="text-slate-600 leading-relaxed">
                    <strong>Why this happens:</strong> Google Maps Scraper or OpenStreetMap in this region returned no matches for these specific keywords, and SearXNG web discovery was offline or returned no direct hits.
                  </p>
                  <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200 text-slate-700 space-y-1">
                    <p className="font-semibold text-slate-800">💡 Suggested Actions to Find Companies:</p>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-600">
                      <li><strong>Launch Google Maps Scraper:</strong> Run <code>gosom/google-maps-scraper</code> on port 8080 for deep local business coverage.</li>
                      <li><strong>Broaden keywords or industry:</strong> Use general categories like "Textile", "Manufacturing", "Clinics", or "Software".</li>
                      <li><strong>Try a major commercial hub:</strong> Search cities like <em>Karachi</em>, <em>Lahore</em>, <em>Dubai</em>, <em>Munich</em>, or <em>London</em>.</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setKeywords([]);
                    setActiveJob(null);
                  }}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                >
                  Clear Keywords & Reset
                </button>
                <button
                  type="button"
                  onClick={() => setActiveJob(null)}
                  className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {activeJob.status === 'failed' && (
            <div className="bg-rose-500/10 border border-rose-300 rounded-xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-rose-900 font-semibold text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  {activeJob.errors && activeJob.errors.length > 0
                    ? activeJob.errors[0].message
                    : 'Discovery job encountered an unhandled exception.'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveJob(null)}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Search Configuration Form */}
      <form onSubmit={handleSubmit} className="bg-card rounded-2xl border border-border shadow-xs p-8 space-y-8">
        {/* Section A: Industry & Category */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Building2 className="w-4 h-4 text-accent" />
            <h3 className="font-bold text-sm text-text">A. Industry & Business Category</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                Primary Industry
              </label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card text-text shadow-2xs"
              >
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                Specific Sub-Category / Niche
              </label>
              <input
                type="text"
                placeholder="e.g. Precision CNC Machining, SaaS, Dental Clinics"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card text-text placeholder:text-muted shadow-2xs"
              />
            </div>
          </div>

          {industry === 'Other' && (
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                Specify Custom Industry
              </label>
              <input
                type="text"
                placeholder="Enter custom industry"
                value={customIndustry}
                onChange={(e) => setCustomIndustry(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card text-text placeholder:text-muted shadow-2xs"
              />
            </div>
          )}
        </div>

        {/* Section B: Search Keywords */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Search className="w-4 h-4 text-accent" />
            <h3 className="font-bold text-sm text-text">B. Target Keywords</h3>
          </div>

          <div>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Add keyword (e.g. industrial equipment, production company, AI automation)"
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddKeyword();
                  }
                }}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-border text-sm focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card text-text placeholder:text-muted shadow-2xs"
              />
              <button
                type="button"
                onClick={handleAddKeyword}
                className="px-4 py-2.5 bg-sidebar hover:bg-card-hover border border-border text-text text-xs font-semibold rounded-xl transition-colors flex items-center gap-1 shadow-2xs"
              >
                <Plus className="w-4 h-4 text-accent" />
                Add
              </button>
            </div>

            <div className="flex flex-wrap gap-2 min-h-8">
              {keywords.map((kw, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent-soft text-accent rounded-xl text-xs font-medium border border-accent/20"
                >
                  {kw}
                  <button
                    type="button"
                    onClick={() => handleRemoveKeyword(idx)}
                    className="hover:text-accent-hover"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Section C: Location */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <MapPin className="w-4 h-4 text-accent" />
            <h3 className="font-bold text-sm text-text">C. Location Criteria</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Country</label>
              <input
                type="text"
                placeholder="e.g. United States, Germany, United Kingdom"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card text-text placeholder:text-muted shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">Region / State</label>
              <input
                type="text"
                placeholder="e.g. California, Bavaria, Ontario"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card text-text placeholder:text-muted shadow-2xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">City</label>
              <input
                type="text"
                placeholder="e.g. New York, Berlin, London"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card text-text placeholder:text-muted shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* Section D: Company Size & Business Services */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <Layers className="w-4 h-4 text-accent" />
              <h3 className="font-bold text-sm text-text">D. Company Size Target</h3>
            </div>
            <select
              value={companySize}
              onChange={(e) => setCompanySize(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border text-sm focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card text-text shadow-2xs"
            >
              {COMPANY_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted">
              *Company size is confirmed only when supported by verifiable public evidence.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-border pb-2">
              <Layers className="w-4 h-4 text-accent" />
              <h3 className="font-bold text-sm text-text">E. Target Business Services</h3>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Logistics, Consulting, SaaS"
                value={serviceInput}
                onChange={(e) => setServiceInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddService();
                  }
                }}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-border text-sm focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card text-text placeholder:text-muted shadow-2xs"
              />
              <button
                type="button"
                onClick={handleAddService}
                className="px-4 py-2.5 bg-sidebar hover:bg-card-hover border border-border text-text text-xs font-semibold rounded-xl shadow-2xs"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {services.map((svc, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-sidebar text-text-secondary border border-border rounded-lg text-xs"
                >
                  {svc}
                  <button type="button" onClick={() => handleRemoveService(idx)} className="hover:text-text">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Section F: Desired AI Automation Services */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <h3 className="font-bold text-sm text-text">F. Desired AI Automation Requirements</h3>
          </div>
          <p className="text-xs text-text-secondary">
            Select the automation workflows you want Gemini AI to evaluate for potential fit:
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {AI_REQUIREMENTS.map((req) => {
              const isSelected = selectedAiRequirements.includes(req);
              return (
                <button
                  type="button"
                  key={req}
                  onClick={() => toggleAiRequirement(req)}
                  className={`p-3 rounded-xl border text-left text-xs font-medium transition-all ${isSelected
                    ? 'bg-accent-soft border-accent text-accent font-semibold shadow-xs'
                    : 'bg-card border-border text-text-secondary hover:bg-card-hover hover:border-[#D6CEBE]'
                    }`}
                >
                  <div className="flex items-start justify-between">
                    <span>{req}</span>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section G: Result Limit & Submit CTA */}
        <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-text-secondary">G. Max Results:</span>
            <div className="flex gap-1.5">
              {RESULT_LIMITS.map((limit) => (
                <button
                  type="button"
                  key={limit}
                  onClick={() => setMaxCompanies(limit)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${maxCompanies === limit
                    ? 'bg-accent text-on-accent font-bold shadow-xs shadow-accent/20'
                    : 'bg-card text-text-secondary hover:text-text border border-border hover:bg-card-hover'
                    }`}
                >
                  {limit}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto px-8 py-3.5 bg-accent hover:bg-accent-hover text-on-accent text-sm font-bold rounded-xl shadow-xs shadow-accent/20 hover:shadow transition-all flex items-center justify-center gap-2 active:scale-98"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Initializing Discovery Job...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Find Companies</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
