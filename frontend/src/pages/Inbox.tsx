import React, { useState, useEffect } from 'react';
import {
  Inbox as InboxIcon,
  Search,
  Filter,
  RefreshCw,
  Send,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  Building2,
  Calendar,
  Clock,
  CheckCircle,
  Check,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  ArrowRight,
  User,
  Mail,
  Loader2,
  HelpCircle,
  Ban,
} from 'lucide-react';
import { api } from '../services/api';
import { IEmailReply, ReplyClassification } from '../types';
import { TableSkeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';

const INTENT_CONFIG: Record<
  ReplyClassification,
  { label: string; bg: string; text: string; border: string; desc: string }
> = {
  interested: {
    label: 'Interested',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    desc: 'Wants demo, call, or more details',
  },
  meeting_request: {
    label: 'Meeting Requested',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    desc: 'Asked to schedule a call / calendar',
  },
  price_inquiry: {
    label: 'Pricing Inquiry',
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    desc: 'Asking for rates, costs, or quotes',
  },
  question: {
    label: 'Question',
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-200',
    desc: 'Asking technical or workflow questions',
  },
  objection: {
    label: 'Objection / Timing',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    desc: 'Budget, timing, or internal team constraints',
  },
  not_interested: {
    label: 'Not Interested',
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-200',
    desc: 'Politely or directly declined',
  },
  out_of_office: {
    label: 'Out of Office',
    bg: 'bg-slate-100',
    text: 'text-slate-500',
    border: 'border-slate-200',
    desc: 'Automated vacation or absence responder',
  },
  unsubscribe: {
    label: 'Unsubscribe',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    desc: 'Requested opt-out (auto-suppressed)',
  },
  unclear: {
    label: 'Unclear',
    bg: 'bg-slate-50',
    text: 'text-slate-500',
    border: 'border-slate-200',
    desc: 'Ambiguous or blank reply',
  },
};

export const Inbox: React.FC<{
  onNavigateToLeads?: () => void;
  onNavigateToQualifications?: () => void;
  onNavigateToMeetings?: () => void;
}> = ({ onNavigateToLeads, onNavigateToQualifications, onNavigateToMeetings }) => {
  const [replies, setReplies] = useState<IEmailReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, unreadCount: 0, interestedCount: 0 });
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Selected thread & conversation state
  const [selectedReply, setSelectedReply] = useState<IEmailReply | null>(null);
  const [threadMessages, setThreadMessages] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Response composer state
  const [replySubject, setReplySubject] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // IMAP Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [imapStatus, setImapStatus] = useState<any>(null);

  // Feedback notifications
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    loadReplies();
    loadImapStatus();
  }, [activeFilter]);

  const loadReplies = async () => {
    setLoading(true);
    try {
      const classificationFilter =
        activeFilter === 'all' || activeFilter === 'unread' ? undefined : activeFilter;
      const unreadFilter = activeFilter === 'unread' ? false : undefined;

      const res = await api.getReplies({
        limit: 50,
        classification: classificationFilter,
        isRead: unreadFilter,
        search: searchTerm || undefined,
      });

      if (res.success) {
        setReplies(res.data.replies);
        setStats(res.data.stats);

        // If no reply selected or current selected is not in list, auto-select first
        if (res.data.replies.length > 0 && !selectedReply) {
          handleSelectReply(res.data.replies[0]);
        }
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to load inbox replies',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadImapStatus = async () => {
    try {
      const res = await api.getImapStatus();
      if (res.success) {
        setImapStatus(res.data);
      }
    } catch {
      // Ignored
    }
  };

  const handleSelectReply = async (reply: IEmailReply) => {
    setSelectedReply(reply);
    setLoadingDetails(true);
    setReplySubject(`Re: ${reply.subject.replace(/^Re:\s*/i, '')}`);
    setReplyBody(reply.suggestedReplyDraft || '');

    try {
      const res = await api.getReplyById(reply._id);
      if (res.success) {
        setThreadMessages(res.data.threadMessages || []);
        // Update local read state
        setReplies((prev) =>
          prev.map((r) => (r._id === reply._id ? { ...r, isRead: true } : r))
        );
        setStats((prev) => ({
          ...prev,
          unreadCount: Math.max(0, prev.unreadCount - 1),
        }));
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to load conversation history',
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleStartQualificationFromReply = async () => {
    if (!selectedReply?.contactId) {
      setFeedback({ type: 'error', message: 'No associated contact found for this thread.' });
      return;
    }
    const contactId =
      typeof selectedReply.contactId === 'object'
        ? (selectedReply.contactId as any)._id
        : selectedReply.contactId;

    try {
      const res = await api.startQualification({
        contactId,
        sourceType: 'email',
        allowManual: true,
      });
      if (res.success) {
        setFeedback({
          type: 'success',
          message: 'Lead qualification started in Phase 3! Redirecting...',
        });
        if (onNavigateToQualifications) {
          setTimeout(onNavigateToQualifications, 600);
        }
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to start lead qualification',
      });
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setFeedback(null);
    try {
      const res = await api.syncInbox();
      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message || 'Inbox synchronized successfully with IMAP mail server.',
        });
        await loadReplies();
        await loadImapStatus();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'IMAP sync failed. Please verify credentials in backend/.env.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRegenerateSuggestedReply = async () => {
    if (!selectedReply) return;
    setIsRegenerating(true);
    try {
      const res = await api.generateReplyResponse(selectedReply._id);
      if (res.success) {
        setReplyBody(res.data.suggestedReplyDraft);
        setSelectedReply((prev) =>
          prev ? { ...prev, suggestedReplyDraft: res.data.suggestedReplyDraft } : null
        );
        setFeedback({
          type: 'success',
          message: 'Generated new grounded AI suggested reply using Cybells Knowledge Base.',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to regenerate response',
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSendApprovedReply = async () => {
    if (!selectedReply || !replyBody.trim()) return;
    setIsSending(true);
    try {
      const res = await api.sendApprovedReply(selectedReply._id, {
        subject: replySubject,
        bodyText: replyBody,
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message || 'Reply sent successfully!',
        });

        // Refresh conversation details
        await handleSelectReply(selectedReply);
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to dispatch reply via email transport.',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleClassificationChange = async (newClass: ReplyClassification) => {
    if (!selectedReply) return;
    try {
      const res = await api.updateReply(selectedReply._id, { classification: newClass });
      if (res.success) {
        setSelectedReply((prev) => (prev ? { ...prev, classification: newClass } : null));
        setReplies((prev) =>
          prev.map((r) => (r._id === selectedReply._id ? { ...r, classification: newClass } : r))
        );
        setFeedback({
          type: 'success',
          message: `Category updated to "${INTENT_CONFIG[newClass].label}". Lead status and stop rules updated.`,
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to update category',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-br from-[#FFF1E6] via-[#FFF8F3] to-card rounded-2xl p-6 text-text shadow-xs border border-border">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-wider">
              <MessageSquare className="w-4 h-4 text-accent" />
              <span>Phase 2: Engage Prospects</span>
            </div>
            <h2 className="text-xl font-bold text-text">Two-Way Inbox & Reply Intelligence</h2>
            <p className="text-xs text-text-secondary max-w-xl">
              Synchronize prospect replies via background IMAP, automatically classify buying sentiment with
              Gemini AI, and review grounded responses before sending.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* IMAP Status Pill */}
            <div className="bg-card border border-border px-3 py-2 rounded-xl text-xs space-y-0.5 shadow-2xs">
              <div className="flex items-center gap-1.5 text-text text-[11px]">
                <div
                  className={`w-2 h-2 rounded-full ${
                    imapStatus?.configured ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                  }`}
                />
                <span className="font-semibold">
                  {imapStatus?.user ? imapStatus.user : 'IMAP Listener'}
                </span>
              </div>
              <p className="text-[10px] text-muted">
                {imapStatus?.syncState?.lastSyncAt
                  ? `Last sync: ${new Date(imapStatus.syncState.lastSyncAt).toLocaleTimeString()}`
                  : 'Ready to sync'}
              </p>
            </div>

            {/* Sync Now Button */}
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-accent hover:bg-accent-hover text-on-accent shadow-xs shadow-accent/20 transition-all disabled:opacity-50 active:scale-98"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Inbox'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Action Feedback Banner */}
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
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
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

      {/* Main Split-Pane Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT PANE: Thread List (4 Columns) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs flex flex-col h-[740px]">
          {/* Search & Filter Bar */}
          <div className="p-3.5 border-b border-slate-200 bg-slate-50/60 space-y-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search replies, sender, keywords..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadReplies()}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
              {[
                { id: 'all', label: `All (${stats.total})` },
                { id: 'unread', label: `Unread (${stats.unreadCount})` },
                { id: 'interested', label: `Interested (${stats.interestedCount})` },
                { id: 'meeting_request', label: 'Meetings' },
                { id: 'question', label: 'Questions' },
                { id: 'objection', label: 'Objections' },
                { id: 'unsubscribe', label: 'Opt-Outs' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id)}
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                    activeFilter === f.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* List of Replies */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="p-4 space-y-3">
                <TableSkeleton rows={6} />
              </div>
            ) : replies.length === 0 ? (
              <div className="p-8 text-center">
                <EmptyState
                  icon={InboxIcon}
                  title="No Replies Found"
                  description="No replies match the current filter. When prospects respond to cold campaigns, they will appear here automatically."
                  actionLabel="Sync IMAP Mailbox"
                  onAction={handleManualSync}
                />
              </div>
            ) : (
              replies.map((reply) => {
                const intent = INTENT_CONFIG[reply.classification] || INTENT_CONFIG.unclear;
                const isSelected = selectedReply?._id === reply._id;
                const companyName = reply.companyId?.companyName || 'Unknown Company';
                const senderDisplay =
                  reply.contactId?.contactName || reply.senderEmail.split('@')[0];

                return (
                  <div
                    key={reply._id}
                    onClick={() => handleSelectReply(reply)}
                    className={`p-3.5 cursor-pointer transition-colors text-left space-y-1.5 ${
                      isSelected
                        ? 'bg-indigo-50/70 border-l-4 border-l-indigo-600'
                        : !reply.isRead
                        ? 'bg-slate-50/60 hover:bg-slate-100/70 font-medium'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        {!reply.isRead && (
                          <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                        )}
                        <span className="font-bold text-slate-900 text-xs truncate">
                          {senderDisplay}
                        </span>
                        <span className="text-slate-400 text-[11px] truncate">({companyName})</span>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {new Date(reply.receivedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>

                    <p className="text-xs text-slate-800 line-clamp-1 font-medium">{reply.subject}</p>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {reply.body}
                    </p>

                    <div className="flex items-center justify-between pt-1">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${intent.bg} ${intent.text} ${intent.border}`}
                      >
                        {intent.label}
                      </span>

                      {reply.reviewedAt && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                          <Check className="w-3 h-3" />
                          <span>Reviewed</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANE: Conversation & Response Workspace (7 Columns) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs flex flex-col h-[740px]">
          {!selectedReply ? (
            <div className="h-full flex items-center justify-center p-8 text-center">
              <div className="space-y-2 max-w-sm">
                <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                  <InboxIcon className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">No Conversation Selected</h3>
                <p className="text-xs text-slate-500">
                  Select a prospect reply from the left panel to view thread history, inspect AI
                  intent classifications, and dispatch a grounded reply.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      {selectedReply.contactId?.contactName || selectedReply.senderEmail}
                    </h3>
                    {selectedReply.contactId?.jobTitle && (
                      <span className="text-xs text-slate-500 font-medium">
                        — {selectedReply.contactId.jobTitle}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-medium text-slate-700">
                      {selectedReply.companyId?.companyName || 'External Organization'}
                    </span>
                    {selectedReply.companyId?.website && (
                      <a
                        href={selectedReply.companyId.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 hover:underline flex items-center gap-0.5"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <span>•</span>
                    <Mail className="w-3 h-3 text-slate-400" />
                    <span>{selectedReply.senderEmail}</span>
                  </div>
                </div>

                {/* Classification Switcher & Action CTAs */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleStartQualificationFromReply}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                    title="Send to Phase 3 Lead Qualification Pipeline"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Qualify in Phase 3</span>
                  </button>

                  {onNavigateToMeetings && (
                    <button
                      onClick={onNavigateToMeetings}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                      title="Schedule Meeting in Phase 4"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Book Meeting</span>
                    </button>
                  )}

                  <div className="flex items-center gap-1.5 pl-1 border-l border-slate-200">
                    <label className="text-[11px] text-slate-500 font-medium">Intent:</label>
                    <select
                      value={selectedReply.classification}
                      onChange={(e) =>
                        handleClassificationChange(e.target.value as ReplyClassification)
                      }
                      className="text-xs font-semibold px-2 py-1 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500"
                    >
                      {Object.keys(INTENT_CONFIG).map((key) => (
                        <option key={key} value={key}>
                          {INTENT_CONFIG[key as ReplyClassification].label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Conversation History Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
                {loadingDetails ? (
                  <div className="space-y-3">
                    <TableSkeleton rows={4} />
                  </div>
                ) : (
                  <>
                    {/* Previous Outbound Messages in Thread */}
                    {threadMessages
                      .filter((m) => m.direction === 'outbound')
                      .map((msg, idx) => (
                        <div key={idx} className="flex justify-end">
                          <div className="max-w-lg bg-indigo-600 text-white rounded-2xl rounded-tr-xs p-3.5 shadow-xs space-y-1 text-xs">
                            <div className="flex items-center justify-between gap-4 text-[10px] text-indigo-200 border-b border-indigo-500/50 pb-1 mb-1">
                              <span>Sent by You ({msg.senderEmail})</span>
                              <span>
                                {msg.sentAt ? new Date(msg.sentAt).toLocaleString() : 'Outreach'}
                              </span>
                            </div>
                            <p className="font-semibold">{msg.subject}</p>
                            <p className="whitespace-pre-line leading-relaxed text-indigo-50">
                              {msg.bodyText}
                            </p>
                          </div>
                        </div>
                      ))}

                    {/* Incoming Prospect Reply Bubble */}
                    <div className="flex justify-start">
                      <div className="max-w-xl bg-white border border-slate-200 rounded-2xl rounded-tl-xs p-4 shadow-sm space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-4 text-[10px] text-slate-500 border-b border-slate-100 pb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-800">
                              {selectedReply.senderEmail}
                            </span>
                            <span>(Prospect Reply)</span>
                          </div>
                          <span>{new Date(selectedReply.receivedAt).toLocaleString()}</span>
                        </div>

                        <p className="font-bold text-slate-900">{selectedReply.subject}</p>
                        <p className="whitespace-pre-line leading-relaxed text-slate-700 bg-slate-50/60 p-3 rounded-xl border border-slate-100 font-sans">
                          {selectedReply.body}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Grounded AI Response Editor Workspace */}
              <div className="border-t border-slate-200 p-4 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        AI Suggested Response (Cybells Grounded)
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        Human approval mandatory. Answers are grounded in Cybells Knowledge Base.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleRegenerateSuggestedReply}
                    disabled={isRegenerating}
                    className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                    <span>Regenerate</span>
                  </button>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={replySubject}
                    onChange={(e) => setReplySubject(e.target.value)}
                    placeholder="Subject..."
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                  />
                  <textarea
                    rows={4}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Type or edit your response..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-sans leading-relaxed focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="text-[11px] text-slate-400">
                    Outbound transport: <span className="font-semibold text-slate-700">SMTP</span>{' '}
                    (Sandbox Guard Active)
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSendApprovedReply}
                      disabled={isSending || !replyBody.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-colors disabled:opacity-50"
                    >
                      {isSending ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Dispatching...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Send Approved Reply</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

