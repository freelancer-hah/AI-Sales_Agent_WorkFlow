import React, { useState, useEffect } from 'react';
import {
  Mail,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Filter,
  Search,
  ExternalLink,
  Edit3,
  Trash2,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  Layers,
  Check,
  AlertTriangle,
  Lightbulb,
  Send,
  Loader2,
} from 'lucide-react';
import { api } from '../services/api';
import { IEmailDraft, DraftApprovalStatus, OutreachFramework } from '../types';
import { TableSkeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { OutreachWorkspaceNav } from '../components/WorkspaceNav';
import { NavTab } from '../components/Sidebar';

export const EmailDrafts: React.FC<{
  onNavigateToLeads?: () => void;
  onNavigate?: (tab: NavTab) => void;
}> = ({ onNavigateToLeads, onNavigate }) => {
  const [drafts, setDrafts] = useState<IEmailDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDrafts, setTotalDrafts] = useState(0);

  // Filters
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedFramework, setSelectedFramework] = useState<string>('');

  // Review & Edit Modal
  const [selectedDraft, setSelectedDraft] = useState<IEmailDraft | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBodyText, setEditedBodyText] = useState('');
  const [editedVariantIndex, setEditedVariantIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'text' | 'html'>('text');
  const [isSaving, setIsSaving] = useState(false);
  const [sendingDraftId, setSendingDraftId] = useState<string | null>(null);

  // Status feedback
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    loadDrafts();
  }, [page, activeFilter, selectedFramework]);

  const loadDrafts = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await api.getDrafts({
        page,
        limit: 12,
        approvalStatus: activeFilter === 'all' ? undefined : activeFilter,
        framework: selectedFramework || undefined,
      });

      if (res.success) {
        setDrafts(res.data.drafts);
        setTotalPages(res.data.pagination.totalPages);
        setTotalDrafts(res.data.pagination.total);
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to load email drafts',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReview = (draft: IEmailDraft) => {
    setSelectedDraft(draft);
    setEditedSubject(draft.subject);
    setEditedBodyText(draft.bodyText);
    setEditedVariantIndex(draft.subjectVariantUsed || 0);
    setViewMode('text');
    setIsModalOpen(true);
  };

  const handleSelectVariant = (variant: string, index: number) => {
    setEditedSubject(variant);
    setEditedVariantIndex(index);
  };

  const handleUpdateStatus = async (
    draftId: string,
    newStatus: DraftApprovalStatus,
    saveEditsFirst: boolean = false
  ) => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const payload: Record<string, any> = {
        approvalStatus: newStatus,
      };

      if (saveEditsFirst) {
        payload.subject = editedSubject;
        payload.bodyText = editedBodyText;
        payload.bodyHtml = editedBodyText
          .split('\n\n')
          .map((p: string) => `<p style="margin: 0 0 12px 0; line-height: 1.6; color: #1e293b;">${p.replace(/\n/g, '<br/>')}</p>`)
          .join('');
        payload.subjectVariantUsed = editedVariantIndex;
      }

      const res = await api.updateDraft(draftId, payload);
      if (res.success) {
        setFeedback({
          type: 'success',
          message:
            newStatus === 'approved'
              ? 'Draft approved successfully! Contact is now ready for outreach sending.'
              : newStatus === 'rejected'
              ? 'Draft marked as rejected.'
              : 'Draft updated successfully.',
        });

        setIsModalOpen(false);
        loadDrafts();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to update draft status',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (draftId: string) => {
    if (!window.confirm('Are you sure you want to delete this email draft?')) {
      return;
    }

    try {
      const res = await api.deleteDraft(draftId);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: 'Draft deleted successfully.',
        });
        loadDrafts();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to delete draft',
      });
    }
  };

  const getStatusBadge = (status: DraftApprovalStatus) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3 h-3 text-emerald-600" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            Rejected
          </span>
        );
      case 'draft':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            Pending Approval
          </span>
        );
    }
  };

  const getSpamScoreBadge = (score: number) => {
    if (score < 20) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <ShieldCheck className="w-3 h-3 text-emerald-600" />
          Clean ({score}/100)
        </span>
      );
    }
    if (score < 40) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle className="w-3 h-3 text-amber-600" />
          Moderate ({score}/100)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
        <ShieldAlert className="w-3 h-3 text-rose-600" />
        High Risk ({score}/100)
      </span>
    );
  };

  const getFrameworkLabel = (framework: OutreachFramework) => {
    switch (framework) {
      case 'question_value_cta':
        return 'Question - Value - CTA';
      case 'before_after_bridge':
        return 'Before - After - Bridge';
      case 'observation_idea_question':
        return 'Observation - Idea - Question';
      case 'pain_agitate_solve':
      default:
        return 'Problem - Agitate - Solve';
    }
  };

  return (
    <div className="space-y-6">
      <OutreachWorkspaceNav activeTab="email-drafts" onNavigate={onNavigate || onNavigateToLeads || (() => {})} />
      {/* Top Banner */}
      <div className="bg-gradient-to-br from-[#FFF1E6] via-[#FFF8F3] to-card rounded-2xl p-6 text-text shadow-xs border border-border">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-accent" />
              <span>Phase 2: Gemini Personalization & Safety</span>
            </div>
            <h2 className="text-xl font-bold text-text">Email Outreach Drafts & Human Review</h2>
            <p className="text-xs text-text-secondary max-w-2xl">
              Strictly grounded on Phase 1 company facts and Cybells Knowledge Base capabilities. Review, customize,
              and approve cold outreach messages. <strong className="text-accent">No email is ever auto-sent without explicit human approval.</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateToLeads && (
              <button
                onClick={onNavigateToLeads}
                className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-on-accent text-xs font-semibold rounded-xl transition-all shadow-xs shadow-accent/20 active:scale-98"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Enroll Leads to Draft</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-muted hover:text-text font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Filter and Framework Bar */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex border border-border rounded-xl p-1 bg-track/70 w-full sm:w-auto">
            <button
              onClick={() => {
                setActiveFilter('all');
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeFilter === 'all'
                  ? 'bg-card text-accent font-bold shadow-xs border border-border'
                  : 'text-text-secondary hover:text-text'
              }`}
            >
              All Drafts ({totalDrafts})
            </button>
            <button
              onClick={() => {
                setActiveFilter('draft');
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeFilter === 'draft'
                  ? 'bg-card text-amber-700 font-bold shadow-xs border border-border'
                  : 'text-text-secondary hover:text-text'
              }`}
            >
              Pending Approval
            </button>
            <button
              onClick={() => {
                setActiveFilter('approved');
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeFilter === 'approved'
                  ? 'bg-card text-emerald-700 font-bold shadow-xs border border-border'
                  : 'text-text-secondary hover:text-text'
              }`}
            >
              Approved (Ready)
            </button>
            <button
              onClick={() => {
                setActiveFilter('rejected');
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeFilter === 'rejected'
                  ? 'bg-card text-rose-700 font-bold shadow-xs border border-border'
                  : 'text-text-secondary hover:text-text'
              }`}
            >
              Rejected
            </button>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end text-xs">
            <div className="flex items-center gap-1.5 text-text-secondary font-medium">
              <Filter className="w-3.5 h-3.5 text-accent" />
              <span>Framework:</span>
            </div>
            <select
              value={selectedFramework}
              onChange={(e) => {
                setSelectedFramework(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 rounded-xl border border-border text-xs bg-card text-text shadow-2xs"
            >
              <option value="">All Copywriting Frameworks</option>
              <option value="pain_agitate_solve">Problem - Agitate - Solve (PAS)</option>
              <option value="question_value_cta">Question - Value - CTA (QVC)</option>
              <option value="before_after_bridge">Before - After - Bridge (BAB)</option>
              <option value="observation_idea_question">Observation - Idea - Question (OIQ)</option>
            </select>

            <button
              onClick={() => {
                setActiveFilter('all');
                setSelectedFramework('');
                setPage(1);
                loadDrafts();
              }}
              title="Refresh drafts"
              className="p-2 text-text-secondary hover:text-text rounded-xl border border-border hover:bg-card-hover shadow-2xs transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Drafts List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={8} />
          </div>
        ) : drafts.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Mail}
              title="No Email Drafts Found"
              description={
                activeFilter !== 'all' || selectedFramework
                  ? 'No drafts match your current filter selection.'
                  : 'No outreach drafts have been generated yet. Go to Lead Management, select enrolled contacts, and generate AI personalized drafts.'
              }
              actionLabel={onNavigateToLeads ? 'Go to Lead Management' : undefined}
              onAction={onNavigateToLeads}
            />
          </div>
        ) : (
          <div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="p-3.5">Recipient & Company</th>
                  <th className="p-3.5">Subject Line</th>
                  <th className="p-3.5">Framework</th>
                  <th className="p-3.5">Deliverability (Spam Score)</th>
                  <th className="p-3.5">Approval Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {drafts.map((draft) => {
                  const contact = typeof draft.contactId === 'object' && draft.contactId !== null ? draft.contactId : ({} as any);
                  const company = typeof draft.companyId === 'object' && draft.companyId !== null ? draft.companyId : ({} as any);

                  return (
                    <tr key={draft._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-900">
                          {contact.contactName || 'General Contact'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {contact.jobTitle ? `${contact.jobTitle} • ` : ''}
                          <span className="font-medium text-slate-700">{company.companyName || '—'}</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">{contact.email}</div>
                      </td>
                      <td className="p-3.5 max-w-xs">
                        <div className="font-medium text-slate-800 truncate" title={draft.subject}>
                          {draft.subject}
                        </div>
                        <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                          {draft.bodyText}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {getFrameworkLabel(draft.framework)}
                        </span>
                      </td>
                      <td className="p-3.5">{getSpamScoreBadge(draft.spamScore)}</td>
                      <td className="p-3.5">{getStatusBadge(draft.approvalStatus)}</td>
                      <td className="p-3.5 text-right space-x-2">
                        {draft.approvalStatus === 'approved' && (
                          <button
                            type="button"
                            disabled={sendingDraftId === draft._id}
                            onClick={async () => {
                              try {
                                setSendingDraftId(draft._id);
                                const res = await api.sendSingleApprovedMessage({ draftId: draft._id });
                                if (res.success) {
                                  setFeedback({
                                    type: 'success',
                                    message: `Email dispatched successfully in Sandbox mode! Sent to: ${res.data.recipient}. Check your Gmail inbox now.`,
                                  });
                                }
                              } catch (err: any) {
                                setFeedback({
                                  type: 'error',
                                  message: err.message || 'Failed to dispatch email.',
                                });
                              } finally {
                                setSendingDraftId(null);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] transition-colors shadow-xs disabled:opacity-50"
                            title="Send email immediately to your sandbox inbox"
                          >
                            {sendingDraftId === draft._id ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Sending...</span>
                              </>
                            ) : (
                              <>
                                <Send className="w-3.5 h-3.5" />
                                <span>Send Test Now</span>
                              </>
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenReview(draft)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[11px] transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Review & Approve</span>
                        </button>
                        <button
                          onClick={() => handleDelete(draft._id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                          title="Delete draft"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <div>
                Showing <span className="font-semibold text-slate-800">{(page - 1) * 12 + 1}</span> to{' '}
                <span className="font-semibold text-slate-800">
                  {Math.min(page * 12, totalDrafts)}
                </span>{' '}
                of <span className="font-semibold text-slate-800">{totalDrafts}</span> drafts
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

      {/* Review & Edit Modal */}
      {isModalOpen && selectedDraft && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">Review & Approve Outreach Draft</h3>
                    {getStatusBadge(selectedDraft.approvalStatus)}
                  </div>
                  <p className="text-xs text-slate-500">
                    Recipient:{' '}
                    <span className="font-semibold text-slate-700">
                      {(selectedDraft.contactId as any)?.contactName || 'Prospect'}
                    </span>{' '}
                    ({(selectedDraft.contactId as any)?.email}) at{' '}
                    <span className="font-semibold text-slate-700">
                      {(selectedDraft.companyId as any)?.companyName}
                    </span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
              >
                ×
              </button>
            </div>

            {/* Modal Body: Two Column Layout */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Editor & Subject Variants (2 Cols) */}
              <div className="lg:col-span-2 space-y-5">
                {/* 3 AI Subject Options */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                    AI Subject Line Options (Select or Customize)
                  </label>
                  <div className="space-y-2">
                    {(selectedDraft.subjectOptions || []).map((opt, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSelectVariant(opt, idx)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                          editedVariantIndex === idx
                            ? 'bg-indigo-50/80 border-indigo-400 ring-1 ring-indigo-400'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full mt-0.5 flex items-center justify-center text-[10px] shrink-0 font-bold ${
                            editedVariantIndex === idx
                              ? 'bg-indigo-600 text-white'
                              : 'border border-slate-300 text-slate-400'
                          }`}
                        >
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <span className="font-medium text-slate-900">{opt}</span>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {idx === 0 ? 'Curiosity Angle' : idx === 1 ? 'Pain-Point Angle' : 'Observation Angle'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Subject Editor */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                    Active Subject Line
                  </label>
                  <input
                    type="text"
                    value={editedSubject}
                    onChange={(e) => setEditedSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Body Editor with Plain / HTML toggle */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Personalized Message Body
                    </label>
                    <div className="flex border border-slate-200 rounded-md p-0.5 bg-slate-50 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setViewMode('text')}
                        className={`px-2 py-0.5 rounded font-semibold ${
                          viewMode === 'text' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
                        }`}
                      >
                        Plain Text
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('html')}
                        className={`px-2 py-0.5 rounded font-semibold ${
                          viewMode === 'html' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
                        }`}
                      >
                        HTML Preview
                      </button>
                    </div>
                  </div>

                  {viewMode === 'text' ? (
                    <textarea
                      rows={10}
                      value={editedBodyText}
                      onChange={(e) => setEditedBodyText(e.target.value)}
                      className="w-full p-3 border border-slate-300 rounded-xl text-xs font-mono leading-relaxed focus:ring-2 focus:ring-indigo-500"
                    />
                  ) : (
                    <div
                      className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 text-xs text-slate-800 leading-relaxed max-h-72 overflow-y-auto prose prose-xs"
                      dangerouslySetInnerHTML={{ __html: selectedDraft.bodyHtml }}
                    />
                  )}
                </div>
              </div>

              {/* Right Column: Grounded Evidence & Deliverability Audit */}
              <div className="space-y-5">
                {/* Personalization Evidence Panel */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
                    <Lightbulb className="w-4 h-4 text-amber-500" />
                    <span>Grounding Evidence (Phase 1)</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Cybells Capability Matched:</span>
                      <p className="font-semibold text-indigo-700">
                        {selectedDraft.personalizationEvidence?.cybellsCapabilityUsed || 'General AI Automation'}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Phase 1 Problems Targeted:</span>
                      <ul className="list-disc list-inside space-y-1 text-slate-700 font-medium text-[11px] mt-1">
                        {(selectedDraft.personalizationEvidence?.phase1ProblemsUsed || []).map((prob, i) => (
                          <li key={i}>{prob}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Strategic Alignment:</span>
                      <p className="text-slate-600 italic text-[11px] mt-0.5">
                        "{selectedDraft.personalizationEvidence?.matchedReasoning}"
                      </p>
                    </div>
                  </div>
                </div>

                {/* Spam Scorer & Deliverability Check */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
                      <ShieldAlert className="w-4 h-4 text-indigo-600" />
                      <span>Deliverability Audit</span>
                    </div>
                    {getSpamScoreBadge(selectedDraft.spamScore)}
                  </div>

                  {selectedDraft.spamFlags && selectedDraft.spamFlags.length > 0 ? (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-semibold text-rose-600">Flagged Risk Triggers:</span>
                      <ul className="space-y-1">
                        {selectedDraft.spamFlags.map((flag, idx) => (
                          <li
                            key={idx}
                            className="text-[11px] text-rose-700 bg-rose-50 border border-rose-100 px-2 py-1 rounded"
                          >
                            • {flag}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 p-2.5 rounded-lg flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Pristine email copy. No aggressive spam trigger phrases or formatting flags.</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                    Model: <span className="font-mono text-slate-600">{selectedDraft.geminiModel || 'gemini'}</span>
                  </div>
                </div>

                {/* Unsubscribe & Postal Notice Warning */}
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 text-[11px] text-indigo-900 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <p>
                    Compliant one-click unsubscribe token and postal address are automatically injected into the footer
                    prior to dispatch.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer: Action Buttons */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleUpdateStatus(selectedDraft._id, 'rejected', false)}
                disabled={isSaving}
                className="px-4 py-2 border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-semibold rounded-lg transition-colors"
              >
                Reject Draft
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(selectedDraft._id, 'draft', true)}
                  disabled={isSaving}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-white text-xs font-semibold rounded-lg transition-colors shadow-xs"
                >
                  Save Edits (Keep as Draft)
                </button>

                <button
                  type="button"
                  onClick={() => handleUpdateStatus(selectedDraft._id, 'approved', true)}
                  disabled={isSaving || !editedBodyText.trim() || editedBodyText.replace(/---\s*If you prefer[\s\S]*$/i, '').trim().length < 20}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                  title={!editedBodyText.trim() ? "Cannot approve empty body" : "Approve for outreach"}
                >
                  <Check className="w-4 h-4" />
                  <span>Approve for Outreach</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

