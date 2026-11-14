import React, { useState, useEffect } from 'react';
import { History, Search, Building2, MapPin, Calendar, AlertCircle, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import { ISearchJob } from '../types';
import { Badge } from '../components/Badge';
import { TableSkeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { LeadWorkspaceNav } from '../components/WorkspaceNav';
import { NavTab } from '../components/Sidebar';

export const SearchHistory: React.FC<{
  onNavigateToFind: () => void;
  onNavigateToCompanies: () => void;
  onNavigate?: (tab: NavTab) => void;
}> = ({
  onNavigateToFind,
  onNavigateToCompanies,
  onNavigate,
}) => {
    const [jobs, setJobs] = useState<ISearchJob[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      loadJobs();
    }, []);

    // Poll search history every 3s if any job is currently queued or running
    useEffect(() => {
      const hasActiveJob = jobs.some((j) => j.status === 'queued' || j.status === 'running');
      if (!hasActiveJob) return;

      const interval = setInterval(async () => {
        try {
          const res = await api.getSearchHistory(50);
          if (res.success) {
            setJobs(res.data);
          }
        } catch (err) {
          console.warn('Error polling history jobs:', err);
        }
      }, 3000);

      return () => clearInterval(interval);
    }, [jobs]);

    const loadJobs = async () => {
      setLoading(true);
      try {
        const res = await api.getSearchHistory(50);
        if (res.success) {
          setJobs(res.data);
        }
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="space-y-6">
        <LeadWorkspaceNav activeTab="history" onNavigate={onNavigate || onNavigateToFind} />
        <div className="bg-card rounded-2xl border border-border p-4 shadow-xs flex items-center justify-between">
          <div>
            <h3 className="font-bold text-text text-sm">Discovery Job Audit History</h3>
            <p className="text-xs text-text-secondary">Track all multi-source discovery queries and execution status</p>
          </div>
          <button
            onClick={onNavigateToFind}
            className="px-3.5 py-2 bg-accent hover:bg-accent-hover text-on-accent rounded-xl text-xs font-semibold shadow-xs shadow-accent/20 transition-all flex items-center gap-1.5 active:scale-98"
          >
            <Search className="w-3.5 h-3.5" />
            <span>New Search</span>
          </button>
        </div>

        {loading ? (
          <TableSkeleton rows={6} />
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={History}
            title="No Past Searches"
            description="Your search queries and discovery runs will be archived here for auditing and re-filtering."
            actionLabel="Launch Search"
            onAction={onNavigateToFind}
          />
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <div
                key={job._id}
                className="bg-card rounded-2xl border border-border p-5 shadow-xs space-y-4 hover:border-[#D6CEBE] transition-all"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-text text-sm">
                        {job.searchCriteria.industry || 'All Industries'}
                      </h4>
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
                    <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
                      {(job.searchCriteria.city || job.searchCriteria.country) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-accent" />
                          {[job.searchCriteria.city, job.searchCriteria.country].filter(Boolean).join(', ')}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-muted" />
                        {new Date(job.createdAt).toLocaleString()}
                      </span>
                      <span>Target: {job.searchCriteria.maxCompanies} companies</span>
                    </div>
                  </div>

                  <button
                    onClick={onNavigateToCompanies}
                    className="flex items-center gap-1 px-3 py-1.5 bg-card hover:bg-card-hover border border-border text-text text-xs font-semibold rounded-xl transition-colors shadow-2xs"
                  >
                    <span>View Companies</span>
                    <ArrowRight className="w-3.5 h-3.5 text-accent" />
                  </button>
                </div>

                {/* Progress and Discovered Metric */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-sidebar p-3.5 rounded-xl border border-border text-xs text-text-secondary">
                  <div>
                    <span className="text-muted block text-[11px]">Discovered</span>
                    <span className="font-bold text-text text-sm tabular-nums">{job.discoveredCount}</span>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px]">Processed</span>
                    <span className="font-bold text-text text-sm tabular-nums">{job.processedCount}</span>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px]">Failed</span>
                    <span className="font-bold text-rose-600 text-sm tabular-nums">{job.failedCount}</span>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px]">Job ID</span>
                    <span className="font-mono text-[10px] text-muted truncate block">
                      {job._id}
                    </span>
                  </div>
                </div>

                {/* Keywords Tag display */}
                {job.searchCriteria.keywords && job.searchCriteria.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-[11px] text-muted">Keywords:</span>
                    {job.searchCriteria.keywords.map((kw, i) => (
                      <span key={i} className="px-2 py-0.5 bg-accent-soft text-accent text-[10px] rounded-lg font-semibold border border-accent/20">
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

