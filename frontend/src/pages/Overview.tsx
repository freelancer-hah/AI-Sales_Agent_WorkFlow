import React, { useState, useEffect } from 'react';
import {
  Building2,
  Globe,
  Mail,
  Phone,
  Users,
  Target,
  ArrowRight,
  TrendingUp,
  Search,
  Calendar,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { api } from '../services/api';
import { IDashboardStats, ICompany, ISearchJob } from '../types';
import { StatCard } from '../components/StatCard';
import { CardSkeleton } from '../components/Skeleton';
import { ErrorAlert } from '../components/ErrorAlert';
import { ScoreBadge, Badge } from '../components/Badge';
import { NavTab } from '../components/Sidebar';

interface OverviewProps {
  onNavigate: (tab: NavTab) => void;
  onSelectCompany: (company: ICompany) => void;
}

const COLORS = ['#C2410C', '#EA580C', '#15803D', '#B45309', '#0284C7', '#7C3AED', '#D97706'];

export const Overview: React.FC<OverviewProps> = ({ onNavigate, onSelectCompany }) => {
  const [stats, setStats] = useState<IDashboardStats | null>(null);
  const [meetingStats, setMeetingStats] = useState<any>(null);
  const [campaignsCount, setCampaignsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, meetRes, campRes] = await Promise.all([
        api.getDashboardStats().catch(() => ({ success: false, data: null })),
        api.getMeetingStats().catch(() => ({ success: false, data: null })),
        api.getCampaigns().catch(() => ({ success: false, data: [] })),
      ]);
      if (res.success) {
        setStats(res.data);
      }
      if (meetRes.success) {
        setMeetingStats(meetRes.data);
      }
      if (campRes.success && Array.isArray(campRes.data)) {
        setCampaignsCount(campRes.data.length);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  const metrics = stats?.metrics || {
    totalCompanies: 0,
    withWebsites: 0,
    withEmails: 0,
    withPhones: 0,
    decisionMakersCount: 0,
    highRelevanceCount: 0,
  };

  const charts = stats?.charts || {
    byIndustry: [],
    byCountry: [],
    byCity: [],
    relevanceDistribution: [],
    byJobTitle: [],
  };

  return (
    <div className="space-y-8">
      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* Executive 4-Phase Sales Funnel Banner */}
      <div className="bg-gradient-to-br from-[#FFF1E6] via-[#FFF8F3] to-card rounded-2xl p-6 shadow-xs border border-border space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs font-bold text-accent uppercase tracking-wider">
                End-to-End Autonomous Sales Pipeline
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-text">Executive Revenue Engine</h2>
            <p className="text-xs text-text-secondary">
              Live progression tracking across business discovery, email sequences, AI BANT qualifications, and closer meetings.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onNavigate('find')}
              className="px-3.5 py-2 bg-accent hover:bg-accent-hover text-on-accent rounded-xl text-xs font-semibold transition-all shadow-xs shadow-accent/20 flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Discover Leads 📍</span>
            </button>
            <button
              onClick={() => onNavigate('meetings')}
              className="px-3.5 py-2 bg-card hover:bg-card-hover border border-border text-text rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5 text-accent" />
              <span>Calendar Hub</span>
            </button>
          </div>
        </div>

        {/* 4 Interactive Funnel Steps */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-border">
          <div
            onClick={() => onNavigate('companies')}
            className="p-3.5 rounded-xl bg-card hover:bg-card-hover border border-border cursor-pointer transition-all space-y-1 group shadow-[0_1px_2px_rgba(28,25,23,0.03)]"
          >
            <div className="flex items-center justify-between text-xs text-text-secondary">
              <span className="font-semibold text-accent">1. Discovery</span>
              <ArrowRight className="w-3.5 h-3.5 text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="text-lg font-bold text-text tabular-nums">{metrics.totalCompanies}</div>
            <div className="text-[10px] text-muted">Google Maps 📍 + Web</div>
          </div>

          <div
            onClick={() => onNavigate('campaigns')}
            className="p-3.5 rounded-xl bg-card hover:bg-card-hover border border-border cursor-pointer transition-all space-y-1 group shadow-[0_1px_2px_rgba(28,25,23,0.03)]"
          >
            <div className="flex items-center justify-between text-xs text-text-secondary">
              <span className="font-semibold text-accent-mid">2. Outreach</span>
              <ArrowRight className="w-3.5 h-3.5 text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="text-lg font-bold text-text tabular-nums">{campaignsCount} Active</div>
            <div className="text-[10px] text-muted">Personalized sequences</div>
          </div>

          <div
            onClick={() => onNavigate('qualifications')}
            className="p-3.5 rounded-xl bg-card hover:bg-card-hover border border-border cursor-pointer transition-all space-y-1 group shadow-[0_1px_2px_rgba(28,25,23,0.03)]"
          >
            <div className="flex items-center justify-between text-xs text-text-secondary">
              <span className="font-semibold text-success">3. Qualification</span>
              <ArrowRight className="w-3.5 h-3.5 text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="text-lg font-bold text-text tabular-nums">{metrics.highRelevanceCount} Priority</div>
            <div className="text-[10px] text-muted">BANT AI Scorecards</div>
          </div>

          <div
            onClick={() => onNavigate('meetings')}
            className="p-3.5 rounded-xl bg-card hover:bg-card-hover border border-border cursor-pointer transition-all space-y-1 group shadow-[0_1px_2px_rgba(28,25,23,0.03)]"
          >
            <div className="flex items-center justify-between text-xs text-text-secondary">
              <span className="font-semibold text-accent">4. Meetings</span>
              <ArrowRight className="w-3.5 h-3.5 text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
            </div>
            <div className="text-lg font-bold text-text tabular-nums">{meetingStats?.confirmed || 0} Booked</div>
            <div className="text-[10px] text-muted">Google Meet + .ics</div>
          </div>
        </div>
      </div>

      {/* 6 Key Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Total Discovered"
          value={metrics.totalCompanies}
          icon={Building2}
          iconColor="text-accent"
          bgColor="bg-accent-soft"
          description="Verified businesses"
        />
        <StatCard
          title="With Websites"
          value={metrics.withWebsites}
          icon={Globe}
          iconColor="text-sky-700"
          bgColor="bg-sky-50"
          description="Official domains"
        />
        <StatCard
          title="With Emails"
          value={metrics.withEmails}
          icon={Mail}
          iconColor="text-emerald-700"
          bgColor="bg-emerald-50"
          description="Public business inboxes"
        />
        <StatCard
          title="With Phones"
          value={metrics.withPhones}
          icon={Phone}
          iconColor="text-amber-700"
          bgColor="bg-amber-50"
          description="Phone numbers"
        />
        <StatCard
          title="Decision Makers"
          value={metrics.decisionMakersCount}
          icon={Users}
          iconColor="text-accent"
          bgColor="bg-accent-soft"
          description="CEOs, founders & execs"
        />
        <StatCard
          title="High Relevance"
          value={metrics.highRelevanceCount}
          icon={Target}
          iconColor="text-rose-700"
          bgColor="bg-rose-50"
          description="Score >= 70/100"
        />
      </div>

      {/* Primary Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Industry Distribution */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-text text-sm">Companies by Industry</h3>
              <p className="text-xs text-text-secondary">Distribution across commercial sectors</p>
            </div>
            <span className="text-xs font-semibold text-accent bg-accent-soft px-2.5 py-0.5 rounded-full border border-accent/20">
              Top Categories
            </span>
          </div>

          <div className="h-64">
            {charts.byIndustry.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.byIndustry}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8E2D9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} stroke="#78716C" />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} stroke="#78716C" />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #E8E2D9', fontSize: 12, backgroundColor: '#FFFFFF', color: '#1C1917' }}
                  />
                  <Bar dataKey="count" fill="#C2410C" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted">
                No industry distribution data yet. Run a search to populate.
              </div>
            )}
          </div>
        </div>

        {/* Lead Relevance Distribution */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-text text-sm">Lead Relevance Distribution</h3>
              <p className="text-xs text-text-secondary">Breakdown of AI explainable scores (0-100)</p>
            </div>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.relevanceDistribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8E2D9" />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} stroke="#78716C" />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} stroke="#78716C" />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #E8E2D9', fontSize: 12, backgroundColor: '#FFFFFF', color: '#1C1917' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {charts.relevanceDistribution.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index >= 3 ? '#15803D' : index === 2 ? '#C2410C' : '#D6CEBE'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Secondary Charts: Geographic & Decision-Makers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* By Country */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-xs">
          <h3 className="font-bold text-text text-sm mb-1">Companies by Country</h3>
          <p className="text-xs text-text-secondary mb-4">Geographic distribution</p>
          <div className="h-52">
            {charts.byCountry.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.byCountry} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E8E2D9" />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} stroke="#78716C" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} stroke="#78716C" />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E2D9', fontSize: 12, backgroundColor: '#FFFFFF' }} />
                  <Bar dataKey="count" fill="#C2410C" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted">
                No location data yet
              </div>
            )}
          </div>
        </div>

        {/* By City */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-xs">
          <h3 className="font-bold text-text text-sm mb-1">Companies by City</h3>
          <p className="text-xs text-text-secondary mb-4">Target metropolitan areas</p>
          <div className="h-52">
            {charts.byCity.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.byCity} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E8E2D9" />
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} stroke="#78716C" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} stroke="#78716C" />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E2D9', fontSize: 12, backgroundColor: '#FFFFFF' }} />
                  <Bar dataKey="count" fill="#EA580C" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted">
                No city data yet
              </div>
            )}
          </div>
        </div>

        {/* Decision-Makers by Job Title */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-xs">
          <h3 className="font-bold text-text text-sm mb-1">Decision-Makers by Title</h3>
          <p className="text-xs text-text-secondary mb-4">Identified roles and leadership</p>
          <div className="h-52">
            {charts.byJobTitle.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.byJobTitle}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="count"
                  >
                    {charts.byJobTitle.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E2D9', fontSize: 12, backgroundColor: '#FFFFFF' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted">
                No leadership data yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity Sections: Recent Searches & Discoveries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Searches */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
            <div>
              <h3 className="font-bold text-text text-sm">Recent Search Queries</h3>
              <p className="text-xs text-text-secondary">Audit of multi-source discovery queries</p>
            </div>
            <button
              onClick={() => onNavigate('history')}
              className="text-xs text-accent hover:text-accent-hover font-semibold flex items-center gap-1 transition-colors"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {stats?.recentSearches && stats.recentSearches.length > 0 ? (
              stats.recentSearches.map((job) => (
                <div
                  key={job._id}
                  className="p-3 bg-sidebar rounded-xl border border-border flex items-center justify-between text-xs"
                >
                  <div className="space-y-1">
                    <div className="font-semibold text-text flex items-center gap-2">
                      <span>{job.searchCriteria.industry || 'All Industries'}</span>
                      {job.searchCriteria.city && (
                        <span className="text-muted">• {job.searchCriteria.city}</span>
                      )}
                    </div>
                    <div className="text-text-secondary text-[11px]">
                      Discovered: {job.discoveredCount} companies
                    </div>
                  </div>
                  <Badge
                    size="sm"
                    variant={
                      job.status === 'completed'
                        ? 'success'
                        : job.status === 'running'
                          ? 'info'
                          : job.status === 'failed'
                            ? 'danger'
                            : 'default'
                    }
                  >
                    {job.status}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-muted">
                No search queries run yet. Start your first discovery!
              </div>
            )}
          </div>
        </div>

        {/* Recent Discoveries */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-border">
            <div>
              <h3 className="font-bold text-text text-sm">Recently Discovered Leads</h3>
              <p className="text-xs text-text-secondary">Latest business entities identified</p>
            </div>
            <button
              onClick={() => onNavigate('companies')}
              className="text-xs text-accent hover:text-accent-hover font-semibold flex items-center gap-1 transition-colors"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {stats?.recentDiscoveries && stats.recentDiscoveries.length > 0 ? (
              stats.recentDiscoveries.map((comp) => (
                <div
                  key={comp._id}
                  onClick={() => comp._id && onSelectCompany(comp as ICompany)}
                  className="p-3 bg-sidebar hover:bg-card-hover cursor-pointer rounded-xl border border-border flex items-center justify-between text-xs transition-colors"
                >
                  <div className="space-y-0.5">
                    <h4 className="font-semibold text-text">{comp.companyName}</h4>
                    <p className="text-[11px] text-text-secondary">
                      {[comp.industry, comp.city, comp.country].filter(Boolean).join(' • ')}
                    </p>
                  </div>
                  <ScoreBadge score={comp.leadScore || 0} />
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-muted">
                No companies discovered yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
