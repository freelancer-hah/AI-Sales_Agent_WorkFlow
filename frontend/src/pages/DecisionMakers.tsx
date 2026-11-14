import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  Mail,
  ExternalLink,
  Building2,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { api } from '../services/api';
import { IDecisionMaker } from '../types';
import { Badge } from '../components/Badge';
import { TableSkeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { ErrorAlert } from '../components/ErrorAlert';
import { ExportModal, ExportFormat, CsvExportType } from '../components/ExportModal';
import { FileSpreadsheet, Download } from 'lucide-react';
import { LeadWorkspaceNav } from '../components/WorkspaceNav';
import { NavTab } from '../components/Sidebar';

interface DecisionMakerWithCompany extends IDecisionMaker {
  companyName?: string;
  companyWebsite?: string;
  industry?: string;
}

export const DecisionMakers: React.FC<{
  onNavigateToFind: () => void;
  onNavigate?: (tab: NavTab) => void;
}> = ({ onNavigateToFind, onNavigate }) => {
  const [decisionMakers, setDecisionMakers] = useState<DecisionMakerWithCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [jobTitleFilter, setJobTitleFilter] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState('');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');

  useEffect(() => {
    loadDecisionMakers();
  }, [page, jobTitleFilter, confidenceFilter]);

  const loadDecisionMakers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = { page, limit: 15 };
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (jobTitleFilter) params.jobTitle = jobTitleFilter;
      if (confidenceFilter) params.confidence = confidenceFilter;

      const res = await api.getDecisionMakers(params);
      if (res.success) {
        setDecisionMakers(res.data.decisionMakers);
        setTotalPages(res.data.pagination.totalPages);
        setTotalCount(res.data.pagination.total);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch decision makers');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadDecisionMakers();
  };

  return (
    <div className="space-y-6">
      <LeadWorkspaceNav activeTab="decision-makers" onNavigate={onNavigate || onNavigateToFind} />
      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* Filter and Search Bar */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearch} className="w-full md:w-80 flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, title, or company..."
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

        <div className="flex flex-wrap items-center gap-3 text-xs w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-text-secondary font-medium">
            <Filter className="w-3.5 h-3.5 text-accent" />
            <span>Role:</span>
          </div>

          <select
            value={jobTitleFilter}
            onChange={(e) => {
              setJobTitleFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 rounded-xl border border-border text-xs bg-card text-text shadow-2xs"
          >
            <option value="">All Positions</option>
            <option value="CEO">CEO / President</option>
            <option value="Founder">Founder / Co-Founder</option>
            <option value="Operations">Operations / COO</option>
            <option value="Managing Director">Managing Director</option>
            <option value="Sales">Sales Director</option>
          </select>

          <select
            value={confidenceFilter}
            onChange={(e) => {
              setConfidenceFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 rounded-xl border border-border text-xs bg-card text-text shadow-2xs"
          >
            <option value="">All Confidence</option>
            <option value="high">High Confidence</option>
            <option value="medium">Medium Confidence</option>
            <option value="low">Low Confidence</option>
          </select>

          <button
            onClick={() => {
              setExportFormat('csv');
              setIsExportModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-soft hover:bg-accent-soft/80 border border-accent/20 text-accent font-semibold rounded-xl transition-colors shadow-2xs ml-auto"
            title="Export Decision Makers"
          >
            <Download className="w-3.5 h-3.5 text-accent" />
            <span>Export Contacts</span>
          </button>
        </div>
      </div>

      {/* Decision Makers Table */}
      {loading ? (
        <TableSkeleton rows={8} />
      ) : decisionMakers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Decision-Makers Identified Yet"
          description="Identify founders, executives, and department leaders by scanning company leadership and team pages."
          actionLabel="Start Company Search"
          onAction={onNavigateToFind}
        />
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-sidebar text-text-secondary uppercase font-semibold border-b border-border tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5">Full Name</th>
                  <th className="p-3.5">Job Title</th>
                  <th className="p-3.5">Company</th>
                  <th className="p-3.5">Business Email</th>
                  <th className="p-3.5">Public Profile</th>
                  <th className="p-3.5">Public Evidence</th>
                  <th className="p-3.5">Confidence</th>
                  <th className="p-3.5">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-text">
                {decisionMakers.map((dm, idx) => (
                  <tr key={idx} className="hover:bg-card-hover transition-colors">
                    <td className="p-3.5 font-semibold text-text">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-accent-soft text-accent flex items-center justify-center font-bold text-xs shrink-0">
                          {dm.fullName.charAt(0)}
                        </div>
                        <span className="truncate max-w-[140px]">{dm.fullName}</span>
                      </div>
                    </td>

                    <td className="p-3.5 font-medium text-text">
                      <span className="px-2 py-0.5 rounded-lg bg-sidebar border border-border text-text-secondary">
                        {dm.jobTitle}
                      </span>
                    </td>

                    <td className="p-3.5 font-semibold text-text truncate max-w-[140px]">
                      {dm.companyName || '—'}
                    </td>

                    <td className="p-3.5 font-mono text-[11px] truncate max-w-[160px]">
                      {dm.publicBusinessEmail ? (
                        <a
                          href={`mailto:${dm.publicBusinessEmail}`}
                          className="hover:underline flex items-center gap-1 text-text hover:text-accent transition-colors"
                        >
                          <Mail className="w-3 h-3 text-muted" />
                          <span>{dm.publicBusinessEmail}</span>
                        </a>
                      ) : (
                        <span className="text-muted italic">Not found</span>
                      )}
                    </td>

                    <td className="p-3.5">
                      {dm.professionalProfileUrl ? (
                        <a
                          href={dm.professionalProfileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:underline flex items-center gap-1 text-[11px] font-medium"
                        >
                          <span>Profile</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-muted italic">None</span>
                      )}
                    </td>

                    <td className="p-3.5 text-[11px] text-text-secondary max-w-[220px] truncate" title={dm.evidence}>
                      {dm.evidence ? `"${dm.evidence}"` : '—'}
                    </td>

                    <td className="p-3.5">
                      <Badge
                        size="sm"
                        variant={dm.confidence === 'high' ? 'success' : dm.confidence === 'medium' ? 'warning' : 'slate'}
                      >
                        {dm.confidence}
                      </Badge>
                    </td>

                    <td className="p-3.5">
                      {dm.sourceUrl ? (
                        <a
                          href={dm.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted hover:text-text p-1 transition-colors"
                          title={dm.sourceUrl}
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 bg-sidebar border-t border-border flex items-center justify-between text-xs text-text-secondary">
            <div>
              Showing <span className="font-semibold text-text">{(page - 1) * 15 + 1}</span> to{' '}
              <span className="font-semibold text-text">
                {Math.min(page * 15, totalCount)}
              </span>{' '}
              of <span className="font-semibold text-text">{totalCount}</span> decision makers
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-xl border border-border bg-card text-text disabled:opacity-40 disabled:cursor-not-allowed hover:bg-card-hover shadow-2xs"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>
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

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        defaultFormat={exportFormat}
        defaultCsvType="decision-makers"
        title="Export Decision Makers"
        activeFilters={{
          search: searchTerm.trim() || undefined,
          jobTitle: jobTitleFilter || undefined,
          confidence: confidenceFilter || undefined,
        }}
      />
    </div>
  );
};

