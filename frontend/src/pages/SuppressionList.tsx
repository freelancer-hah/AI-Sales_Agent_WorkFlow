import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  Plus,
  Trash2,
  Download,
  RefreshCw,
  Mail,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  ChevronLeft,
  ChevronRight,
  Shield,
  Upload,
} from 'lucide-react';
import { api } from '../services/api';
import { ISuppressionEntry, SuppressionReason } from '../types';
import { TableSkeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { ErrorAlert } from '../components/ErrorAlert';
import { SettingsWorkspaceNav } from '../components/WorkspaceNav';
import { NavTab } from '../components/Sidebar';

export const SuppressionList: React.FC<{ onNavigate?: (tab: NavTab) => void }> = ({ onNavigate }) => {
  const [entries, setEntries] = useState<ISuppressionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalEntries, setTotalEntries] = useState(0);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReason, setSelectedReason] = useState<string>('');

  // Add / Bulk Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [singleEmail, setSingleEmail] = useState('');
  const [bulkEmails, setBulkEmails] = useState('');
  const [modalMode, setModalMode] = useState<'single' | 'bulk'>('single');
  const [addReason, setAddReason] = useState<SuppressionReason>('manual_suppression');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Feedback Notification
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    loadSuppressionEntries();
  }, [page, selectedReason]);

  const loadSuppressionEntries = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await api.getSuppressionList({
        page,
        limit: 15,
        reason: selectedReason || undefined,
        search: searchTerm.trim() || undefined,
      });

      if (res.success) {
        setEntries(res.data.entries as ISuppressionEntry[]);
        setTotalPages(res.data.pagination.totalPages);
        setTotalEntries(res.data.pagination.total);
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to fetch suppression list',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadSuppressionEntries();
  };

  const handleAddSuppression = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    try {
      let payload: { email?: string; emails?: string[]; reason: string; source: string };

      if (modalMode === 'single') {
        if (!singleEmail.trim()) {
          alert('Please enter an email address.');
          setIsSubmitting(false);
          return;
        }
        payload = {
          email: singleEmail.trim(),
          reason: addReason,
          source: 'manual_ui',
        };
      } else {
        const parsed = bulkEmails
          .split(/[\n,;]+/)
          .map((em) => em.trim())
          .filter(Boolean);

        if (parsed.length === 0) {
          alert('Please enter at least one email address in the bulk field.');
          setIsSubmitting(false);
          return;
        }
        payload = {
          emails: parsed,
          reason: addReason,
          source: 'bulk_manual_import',
        };
      }

      const res = await api.addSuppressedEmail(payload);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message || 'Successfully added to suppression list!',
        });
        setIsModalOpen(false);
        setSingleEmail('');
        setBulkEmails('');
        loadSuppressionEntries();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to suppress email(s)',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (id: string, email: string) => {
    if (!window.confirm(`Are you sure you want to remove ${email} from suppression? This contact will become eligible for future outreach.`)) {
      return;
    }

    try {
      const res = await api.removeSuppressedEmail(id);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message || `Removed ${email} from suppression list.`,
        });
        loadSuppressionEntries();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to remove entry.',
      });
    }
  };

  const handleExportCsv = () => {
    if (entries.length === 0) {
      alert('No entries to export.');
      return;
    }

    const headers = ['Email', 'Reason', 'Source', 'SuppressedAt'];
    const rows = entries.map((e) => [
      `"${e.email}"`,
      `"${e.reason}"`,
      `"${e.source || 'manual'}"`,
      `"${new Date(e.createdAt).toISOString()}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `suppression_list_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const getReasonBadge = (reason: SuppressionReason) => {
    switch (reason) {
      case 'unsubscribe':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <XCircle className="w-3 h-3 text-amber-600" />
            Unsubscribed (Opt-Out)
          </span>
        );
      case 'hard_bounce':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            Hard Bounce
          </span>
        );
      case 'spam_complaint':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <ShieldAlert className="w-3 h-3 text-purple-600" />
            Spam Complaint
          </span>
        );
      case 'manual_suppression':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <Shield className="w-3 h-3 text-slate-500" />
            Manual Suppression
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <SettingsWorkspaceNav activeTab="suppression-list" onNavigate={onNavigate || (() => { })} />
      {/* Top Banner */}
      <div className="bg-gradient-to-br from-[#FFF1E6] via-[#FFF8F3] to-card rounded-2xl p-6 text-text shadow-xs border border-border">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 text-accent" />
              <span>Phase 2: Compliance & Deliverability</span>
            </div>
            <h2 className="text-xl font-bold text-text">Suppression & Do-Not-Contact Registry</h2>
            <p className="text-xs text-text-secondary max-w-2xl">
              Strictly enforces CAN-SPAM, GDPR, and RFC 8058 one-click opt-outs. Emails listed here are blocked
              from all future campaign drafts, enrollments, and scheduled sequence jobs.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-2 bg-card hover:bg-card-hover text-text text-xs font-semibold rounded-xl border border-border transition-colors shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-muted" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-on-accent text-xs font-semibold rounded-xl transition-all shadow-xs shadow-accent/20 active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>Add Suppressed Email</span>
            </button>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs animate-in fade-in duration-200 ${feedback.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Compliance Information Card */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 text-xs text-amber-900 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-amber-950">Strict Sending Safety & Auto-Cancellation Rules</p>
          <p className="text-amber-800 leading-relaxed text-[11px]">
            When an email address is added to this suppression registry (via an unsubscribe click, hard bounce, or manual addition),
            Cybells automatically marks any existing contact records as <code className="bg-amber-100/80 px-1 py-0.5 rounded text-amber-900">suppressed</code>,
            and cancels all pending follow-up scheduled jobs and pending messages immediately. Suppressed emails are permanently barred from campaign generation.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <form onSubmit={handleSearchSubmit} className="w-full sm:w-96 flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search email address in suppression registry..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
            >
              Search
            </button>
          </form>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end text-xs">
            <div className="flex items-center gap-1.5 text-slate-500 font-medium">
              <Filter className="w-3.5 h-3.5" />
              <span>Reason:</span>
            </div>
            <select
              value={selectedReason}
              onChange={(e) => {
                setSelectedReason(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white text-slate-700"
            >
              <option value="">All Reasons ({totalEntries})</option>
              <option value="unsubscribe">Unsubscribe (Opt-Out)</option>
              <option value="hard_bounce">Hard Bounce</option>
              <option value="manual_suppression">Manual Suppression</option>
              <option value="spam_complaint">Spam Complaint</option>
            </select>

            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedReason('');
                setPage(1);
                loadSuppressionEntries();
              }}
              title="Reset filters"
              className="p-2 text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200 hover:bg-slate-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Suppression Registry Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={8} />
          </div>
        ) : entries.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Shield}
              title="No Suppressed Emails Found"
              description={
                searchTerm || selectedReason
                  ? 'No entries match your search query or filter selection.'
                  : 'Your suppression registry is empty. Emails that opt out or hard-bounce will automatically appear here.'
              }
              actionLabel={searchTerm || selectedReason ? 'Clear Filters' : 'Add First Suppressed Email'}
              onAction={
                searchTerm || selectedReason
                  ? () => {
                    setSearchTerm('');
                    setSelectedReason('');
                    setPage(1);
                    loadSuppressionEntries();
                  }
                  : () => setIsModalOpen(true)
              }
            />
          </div>
        ) : (
          <div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="p-3.5">Suppressed Email</th>
                  <th className="p-3.5">Reason</th>
                  <th className="p-3.5">Origin / Source</th>
                  <th className="p-3.5">Date Suppressed</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((entry) => (
                  <tr key={entry._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-mono text-slate-900 font-medium">{entry.email}</span>
                      </div>
                    </td>
                    <td className="p-3.5">{getReasonBadge(entry.reason)}</td>
                    <td className="p-3.5 text-slate-600 font-mono text-[11px]">
                      {entry.source || 'system'}
                    </td>
                    <td className="p-3.5 text-slate-500 text-[11px]">
                      {new Date(entry.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => handleRemove(entry._id, entry.email)}
                        className="inline-flex items-center gap-1 text-slate-400 hover:text-rose-600 font-medium transition-colors p-1"
                        title="Remove from suppression registry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="text-[11px]">Remove</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <div>
                Showing <span className="font-semibold text-slate-800">{(page - 1) * 15 + 1}</span> to{' '}
                <span className="font-semibold text-slate-800">
                  {Math.min(page * 15, totalEntries)}
                </span>{' '}
                of <span className="font-semibold text-slate-800">{totalEntries}</span> suppressed addresses
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

      {/* Add Suppressed Email Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add to Suppression Registry</h3>
                  <p className="text-xs text-slate-500">Bar address(es) from receiving any outreach</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddSuppression} className="space-y-4">
              {/* Single vs Bulk Mode Toggle */}
              <div className="flex border border-slate-200 rounded-lg p-1 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setModalMode('single')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${modalMode === 'single'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  Single Email
                </button>
                <button
                  type="button"
                  onClick={() => setModalMode('bulk')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${modalMode === 'bulk'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                  Bulk Import (List)
                </button>
              </div>

              {modalMode === 'single' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="prospect@company.com"
                    value={singleEmail}
                    onChange={(e) => setSingleEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Paste Multiple Emails (one per line, comma, or semicolon separated){' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={5}
                    required
                    placeholder="lead1@company.com&#10;lead2@domain.org&#10;lead3@firm.co"
                    value={bulkEmails}
                    onChange={(e) => setBulkEmails(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Suppression Reason
                </label>
                <select
                  value={addReason}
                  onChange={(e) => setAddReason(e.target.value as SuppressionReason)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-rose-500"
                >
                  <option value="manual_suppression">Manual Suppression (User Decision)</option>
                  <option value="unsubscribe">Unsubscribe (Prospect Requested Opt-Out)</option>
                  <option value="hard_bounce">Hard Bounce (Undeliverable / Inactive)</option>
                  <option value="spam_complaint">Spam Complaint</option>
                </select>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <p className="font-semibold text-slate-700">What happens next?</p>
                <p>
                  1. The email is permanently saved to the suppression list.
                </p>
                <p>
                  2. Any matching outreach contacts will be marked as <code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-slate-800">suppressed</code>.
                </p>
                <p>
                  3. Any pending follow-up sequence jobs for this email are automatically cancelled.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-3.5 h-3.5" />
                      <span>Confirm & Suppress</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
