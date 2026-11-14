import React, { useState, useEffect } from 'react';
import {
  BookmarkCheck,
  Building2,
  ExternalLink,
  Mail,
  Trash2,
  FileSpreadsheet,
  FileText,
  Eye,
  Edit3,
} from 'lucide-react';
import { api } from '../services/api';
import { ICompany, ReviewStatus } from '../types';
import { ScoreBadge, Badge } from '../components/Badge';
import { TableSkeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { CompanyModal } from '../components/CompanyModal';
import { ExportModal, ExportFormat } from '../components/ExportModal';
import { LeadWorkspaceNav } from '../components/WorkspaceNav';
import { NavTab } from '../components/Sidebar';

export const SavedLeads: React.FC<{
  onNavigateToFind: () => void;
  onNavigate?: (tab: NavTab) => void;
}> = ({ onNavigateToFind, onNavigate }) => {
  const [savedCompanies, setSavedCompanies] = useState<ICompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<ICompany | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('excel');

  useEffect(() => {
    loadSavedLeads();
  }, []);

  const loadSavedLeads = async () => {
    setLoading(true);
    try {
      const res = await api.getCompanies({ isSaved: true, limit: 100 });
      if (res.success) {
        setSavedCompanies(res.data.companies);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveSaved = async (id: string) => {
    await api.updateCompany(id, { isSaved: false });
    setSavedCompanies(savedCompanies.filter((c) => c._id !== id));
  };

  const handleUpdateStatus = async (id: string, status: ReviewStatus) => {
    await api.updateCompany(id, { reviewStatus: status });
    setSavedCompanies(
      savedCompanies.map((c) => (c._id === id ? { ...c, reviewStatus: status } : c))
    );
  };

  return (
    <div className="space-y-6">
      <LeadWorkspaceNav activeTab="saved" onNavigate={onNavigate || onNavigateToFind} savedCount={savedCompanies.length} />
      {/* Top Banner and Export Actions */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-text text-sm">Saved Qualified Leads ({savedCompanies.length})</h3>
          <p className="text-xs text-text-secondary">Curated high-potential companies earmarked for outreach</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setExportFormat('csv');
              setIsExportModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border hover:bg-card-hover text-text text-xs font-medium rounded-xl shadow-2xs transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-muted" />
            <span>Export Saved CSV</span>
          </button>
          <button
            onClick={() => {
              setExportFormat('excel');
              setIsExportModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-xl shadow-2xs transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Saved Excel</span>
          </button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} />
      ) : savedCompanies.length === 0 ? (
        <EmptyState
          icon={BookmarkCheck}
          title="No Saved Leads Yet"
          description="Bookmark promising companies from 'All Companies' or run a search to start building your qualified target list."
          actionLabel="Find Companies"
          onAction={onNavigateToFind}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {savedCompanies.map((company) => (
            <div
              key={company._id}
              className="bg-card rounded-2xl border border-border p-5 shadow-xs space-y-4 flex flex-col justify-between hover:shadow-md hover:border-[#D6CEBE] transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-text text-sm truncate max-w-[200px]" title={company.companyName}>
                      {company.companyName}
                    </h4>
                    <p className="text-xs text-text-secondary">{company.industry}</p>
                  </div>
                  <ScoreBadge score={company.leadScore} />
                </div>

                <div className="text-xs text-text-secondary space-y-1.5 bg-sidebar p-3 rounded-xl border border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Location:</span>
                    <span className="font-medium text-text">
                      {[company.city, company.country].filter(Boolean).join(', ') || '—'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted">Website:</span>
                    {company.website ? (
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline flex items-center gap-1 font-mono text-[11px]"
                      >
                        <span>Visit</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-muted italic">None</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted">Review Status:</span>
                    <select
                      value={company.reviewStatus || 'new'}
                      onChange={(e) => handleUpdateStatus(company._id, e.target.value as ReviewStatus)}
                      className="text-xs border border-border rounded-lg px-2 py-0.5 bg-card font-medium text-text shadow-2xs"
                    >
                      <option value="new">New</option>
                      <option value="reviewed">Reviewed</option>
                      <option value="contacted">Contacted</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                </div>

                {company.notes && (
                  <p className="text-xs text-text-secondary bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/60">
                    <strong className="text-amber-900">Notes: </strong>{company.notes}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-between">
                <button
                  onClick={() => setSelectedCompany(company)}
                  className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover font-semibold transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Details</span>
                </button>

                <button
                  onClick={() => handleRemoveSaved(company._id)}
                  className="p-1.5 text-muted hover:text-rose-600 rounded-lg transition-colors"
                  title="Remove from saved"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedCompany && (
        <CompanyModal
          company={selectedCompany}
          onClose={() => setSelectedCompany(null)}
          onUpdate={async (id, updates) => {
            const res = await api.updateCompany(id, updates);
            if (res.success) {
              setSavedCompanies(savedCompanies.map((c) => (c._id === id ? res.data : c)));
              setSelectedCompany(res.data);
            }
          }}
        />
      )}

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        activeFilters={{ isSaved: true }}
        defaultFormat={exportFormat}
        title="Export Saved Leads"
      />
    </div>
  );
};

