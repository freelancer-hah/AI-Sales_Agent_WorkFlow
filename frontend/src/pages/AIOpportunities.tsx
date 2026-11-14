import React, { useState, useEffect } from 'react';
import { Sparkles, Building2, ExternalLink, Lightbulb, CheckCircle2, ChevronRight, Eye, Download } from 'lucide-react';
import { api } from '../services/api';
import { ICompany, IAIOpportunity } from '../types';
import { Badge, ScoreBadge } from '../components/Badge';
import { TableSkeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { CompanyModal } from '../components/CompanyModal';
import { ExportModal } from '../components/ExportModal';
import { LeadWorkspaceNav } from '../components/WorkspaceNav';
import { NavTab } from '../components/Sidebar';

export const AIOpportunities: React.FC<{
  onNavigateToFind: () => void;
  onNavigate?: (tab: NavTab) => void;
}> = ({ onNavigateToFind, onNavigate }) => {
  const [companies, setCompanies] = useState<ICompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<ICompany | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  useEffect(() => {
    loadAnalyzedCompanies();
  }, []);

  const loadAnalyzedCompanies = async () => {
    setLoading(true);
    try {
      const res = await api.getCompanies({ limit: 50 });
      if (res.success) {
        setCompanies(res.data.companies.filter((c) => c.aiAnalysis?.opportunities?.length));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <LeadWorkspaceNav activeTab="ai-opportunities" onNavigate={onNavigate || onNavigateToFind} />
      {/* Overview Banner */}
      <div className="bg-gradient-to-br from-[#FFF1E6] via-[#FFF8F3] to-card rounded-2xl p-6 text-text flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs border border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-accent" />
            <span>Google Gemini AI Reasoning Engine</span>
          </div>
          <h3 className="text-xl font-bold text-text">Identified AI Automation Opportunities</h3>
          <p className="text-xs text-text-secondary max-w-xl">
            Pain point hypotheses, tailored automation architectures, and business value propositions
            derived strictly from verified company website research.
          </p>
        </div>

        {companies.length > 0 && (
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-hover text-on-accent font-semibold text-xs rounded-xl transition-all shadow-xs shadow-accent/20 shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Export AI Opportunities</span>
          </button>
        )}
      </div>

      {loading ? (
        <TableSkeleton rows={4} />
      ) : companies.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No AI Automation Opportunities Yet"
          description="Discover companies and trigger Gemini AI analysis to identify potential automation, workflow, or AI support opportunities."
          actionLabel="Find Companies to Analyze"
          onAction={onNavigateToFind}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {companies.map((company) => (
            <div
              key={company._id}
              className="bg-card rounded-2xl border border-border p-6 shadow-xs space-y-5"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent-soft text-accent font-bold flex items-center justify-center">
                    {company.companyName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-text text-base">{company.companyName}</h4>
                      <ScoreBadge score={company.leadScore} />
                    </div>
                    <p className="text-xs text-text-secondary">
                      {[company.industry, company.city, company.country].filter(Boolean).join(' • ')}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedCompany(company)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-card hover:bg-card-hover border border-border text-text text-xs font-semibold rounded-xl transition-colors shadow-2xs"
                >
                  <Eye className="w-3.5 h-3.5 text-muted" />
                  <span>View Full Profile</span>
                </button>
              </div>

              {/* Score Explanation */}
              {company.aiAnalysis?.scoreExplanation && (
                <div className="bg-sidebar rounded-xl p-3.5 border border-border text-xs text-text-secondary">
                  <strong className="text-text">Lead Qualification Context: </strong>
                  {company.aiAnalysis.scoreExplanation}
                </div>
              )}

              {/* Opportunities Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {company.aiAnalysis?.opportunities.map((opp, idx) => (
                  <div
                    key={idx}
                    className="bg-card border border-border rounded-xl p-4 shadow-2xs space-y-3 flex flex-col justify-between hover:border-[#D6CEBE] transition-colors"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
                          <h5 className="font-bold text-text text-xs">{opp.title}</h5>
                        </div>
                        <Badge
                          size="sm"
                          variant={opp.confidence === 'high' ? 'success' : opp.confidence === 'medium' ? 'warning' : 'slate'}
                        >
                          {opp.confidence}
                        </Badge>
                      </div>

                      <div className="text-xs space-y-1.5 text-text-secondary">
                        <p>
                          <strong className="text-text">Observed Challenge: </strong>
                          {opp.businessProblem}
                        </p>
                        <p>
                          <strong className="text-text">Solution: </strong>
                          {opp.recommendedSolution}
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border bg-emerald-50/70 border border-emerald-200/60 p-2.5 rounded-xl text-[11px] text-emerald-950">
                      <strong>Expected ROI: </strong>
                      {opp.benefits}
                    </div>
                  </div>
                ))}
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
              setCompanies(companies.map((c) => (c._id === id ? res.data : c)));
              setSelectedCompany(res.data);
            }
          }}
        />
      )}

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        defaultFormat="csv"
        defaultCsvType="ai-opportunities"
        title="Export AI Opportunities & Value Props"
      />
    </div>
  );
};

