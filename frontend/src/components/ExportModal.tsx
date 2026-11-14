import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  FileText,
  Download,
  CheckCircle2,
  Filter,
  Layers,
  Sparkles,
  Users,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { api } from '../services/api';

export type ExportFormat = 'excel' | 'csv';
export type CsvExportType = 'companies' | 'decision-makers' | 'ai-opportunities' | 'sources';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds?: string[];
  activeFilters?: Record<string, any>;
  defaultFormat?: ExportFormat;
  defaultCsvType?: CsvExportType;
  title?: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  selectedIds = [],
  activeFilters = {},
  defaultFormat = 'excel',
  defaultCsvType = 'companies',
  title = 'Export Lead Intelligence',
}) => {
  const [format, setFormat] = useState<ExportFormat>(defaultFormat);
  const [csvType, setCsvType] = useState<CsvExportType>(defaultCsvType);
  const [scope, setScope] = useState<'selected' | 'filtered'>(
    selectedIds.length > 0 ? 'selected' : 'filtered'
  );
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownload = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const companyIds = scope === 'selected' && selectedIds.length > 0 ? selectedIds : undefined;
      const filters = scope === 'filtered' ? activeFilters : undefined;

      await api.downloadExport(format, {
        type: format === 'csv' ? csvType : undefined,
        companyIds,
        filters,
      });

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to generate export file. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-text/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-sidebar">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-accent-soft text-accent rounded-xl">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text">{title}</h3>
              <p className="text-xs text-text-secondary">
                Enterprise-grade data export with complete auditability
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted hover:text-text rounded-xl hover:bg-card-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs text-text-secondary max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <span className="font-semibold">Export Error:</span> {error}
            </div>
          )}

          {/* Format Selection Cards */}
          <div>
            <label className="block text-xs font-semibold text-text mb-2">
              Choose Export File Format:
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Excel Card */}
              <button
                type="button"
                onClick={() => setFormat('excel')}
                className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${format === 'excel'
                  ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                  : 'border-border hover:border-[#D6CEBE] bg-card'
                  }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    {format === 'excel' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  <div className="font-bold text-text text-sm">Excel Workbook</div>
                  <div className="text-[11px] text-text-secondary mt-1 leading-snug">
                    Multi-Tab structured spreadsheet (.xlsx) with 5 worksheets and stylized headers.
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-border flex items-center gap-1 text-[10px] font-semibold text-emerald-700 uppercase tracking-wider">
                  <Layers className="w-3 h-3" />
                  <span>5 Worksheets Included</span>
                </div>
              </button>

              {/* CSV Card */}
              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${format === 'csv'
                  ? 'border-accent bg-accent-soft ring-2 ring-accent/20'
                  : 'border-border hover:border-[#D6CEBE] bg-card'
                  }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 bg-accent-soft text-accent rounded-xl">
                      <FileText className="w-5 h-5" />
                    </div>
                    {format === 'csv' && (
                      <CheckCircle2 className="w-4 h-4 text-accent" />
                    )}
                  </div>
                  <div className="font-bold text-text text-sm">CSV Spreadsheet</div>
                  <div className="text-[11px] text-text-secondary mt-1 leading-snug">
                    Universal comma-separated format (.csv) compatible with CRMs and databases.
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-border flex items-center gap-1 text-[10px] font-semibold text-accent uppercase tracking-wider">
                  <Filter className="w-3 h-3" />
                  <span>Custom Dataset</span>
                </div>
              </button>
            </div>
          </div>

          {/* Sub-type Selection for CSV */}
          {format === 'csv' && (
            <div className="p-3.5 bg-sidebar rounded-xl border border-border space-y-2 animate-in fade-in duration-150">
              <label className="block text-xs font-semibold text-text">
                Select CSV Dataset to Export:
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setCsvType('companies')}
                  className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-colors ${csvType === 'companies'
                    ? 'border-accent bg-card text-accent font-semibold shadow-2xs'
                    : 'border-border bg-card/60 text-text-secondary hover:bg-card'
                    }`}
                >
                  <span className="w-2 h-2 rounded-full bg-accent"></span>
                  <span>Master Leads</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCsvType('decision-makers')}
                  className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition-colors ${csvType === 'decision-makers'
                    ? 'border-accent bg-card text-accent font-semibold shadow-2xs'
                    : 'border-border bg-card/60 text-text-secondary hover:bg-card'
                    }`}
                >
                  <Users className="w-3.5 h-3.5 text-accent" />
                  <span>Decision Makers</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCsvType('ai-opportunities')}
                  className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-colors ${csvType === 'ai-opportunities'
                    ? 'border-indigo-500 bg-white text-indigo-900 font-semibold shadow-xs'
                    : 'border-slate-200 bg-white/70 text-slate-700 hover:bg-white'
                    }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>AI Opportunities</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCsvType('sources')}
                  className={`p-2.5 rounded-lg border text-left flex items-center gap-2 transition-colors ${csvType === 'sources'
                    ? 'border-indigo-500 bg-white text-indigo-900 font-semibold shadow-xs'
                    : 'border-slate-200 bg-white/70 text-slate-700 hover:bg-white'
                    }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Audit Sources</span>
                </button>
              </div>
            </div>
          )}

          {/* Scope Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-800">
              Export Scope:
            </label>
            <div className="space-y-2">
              {selectedIds.length > 0 && (
                <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    value="selected"
                    checked={scope === 'selected'}
                    onChange={() => setScope('selected')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <div className="font-semibold text-slate-900">
                      Selected Companies Only ({selectedIds.length} chosen)
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Only export records for the checked companies in your view.
                    </div>
                  </div>
                </label>
              )}

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  value="filtered"
                  checked={scope === 'filtered' || selectedIds.length === 0}
                  onChange={() => setScope('filtered')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="font-semibold text-slate-900">
                    All Leads Matching Current Filters
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Exports entire matching dataset based on your active search and filter parameters.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Info Banner on Structure */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Zero-Hallucination Verified Data Engine</span>
            </div>
            <p>
              Exports preserve full provenance: official URLs, timestamped source pages, verified decision-makers, and explainable 5-factor scoring breakdowns.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-2.5 bg-sidebar">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 border border-border text-text-secondary hover:text-text hover:bg-card-hover rounded-xl font-medium text-xs transition-colors shadow-2xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={isExporting}
            className={`flex items-center gap-2 px-5 py-2 text-white font-semibold text-xs rounded-xl shadow-xs transition-all active:scale-98 ${format === 'excel'
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-accent hover:bg-accent-hover shadow-accent/20'
              } ${isExporting ? 'opacity-80 cursor-wait' : ''}`}
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating Export...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>
                  Download {format === 'excel' ? 'Excel (.xlsx)' : `CSV (${csvType})`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

