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
  Link as LinkIcon,
  PhoneCall,
  Zap,
} from 'lucide-react';
import { api } from '../services/api';
import { IEmailReply, ReplyClassification } from '../types';
import { TableSkeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';

const INTENT_CONFIG: Record<
  ReplyClassification,
  { label: string; bg: string; text: string; border: string; desc: string; dot: string }
> = {
  interested: {
    label: 'Interested',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-500/20',
    dot: 'bg-emerald-500',
    desc: 'Wants demo, call, or more details',
  },
  meeting_request: {
    label: 'Meeting Requested',
    bg: 'bg-purple-500/10',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-500/20',
    dot: 'bg-purple-500',
    desc: 'Asked to schedule a call / calendar',
  },
  price_inquiry: {
    label: 'Pricing Inquiry',
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-700 dark:text-indigo-400',
    border: 'border-indigo-500/20',
    dot: 'bg-indigo-500',
    desc: 'Asking for rates, costs, or quotes',
  },
  question: {
    label: 'Question',
    bg: 'bg-sky-500/10',
    text: 'text-sky-700 dark:text-sky-400',
    border: 'border-sky-500/20',
    dot: 'bg-sky-500',
    desc: 'Asking technical or workflow questions',
  },
  objection: {
    label: 'Objection / Timing',
    bg: 'bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-500/20',
    dot: 'bg-amber-500',
    desc: 'Budget, timing, or team constraints',
  },
  not_interested: {
    label: 'Not Interested',
    bg: 'bg-zinc-500/10',
    text: 'text-zinc-600 dark:text-zinc-400',
    border: 'border-zinc-500/20',
    dot: 'bg-zinc-400',
    desc: 'Politely or directly declined',
  },
  out_of_office: {
    label: 'Out of Office',
    bg: 'bg-zinc-500/10',
    text: 'text-zinc-500 dark:text-zinc-400',
    border: 'border-zinc-500/20',
    dot: 'bg-zinc-400',
    desc: 'Automated absence responder',
  },
  unsubscribe: {
    label: 'Unsubscribe',
    bg: 'bg-rose-500/10',
    text: 'text-rose-700 dark:text-rose-400',
    border: 'border-rose-500/20',
    dot: 'bg-rose-500',
    desc: 'Requested opt-out (auto-suppressed)',
  },
  unclear: {
    label: 'Unclear',
    bg: 'bg-zinc-500/10',
    text: 'text-zinc-500 dark:text-zinc-400',
    border: 'border-zinc-500/20',
    dot: 'bg-zinc-400',
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

  const insertBookingSnippet = () => {
    const snippet = `\n\nYou can easily book a convenient time directly on my calendar here:\nhttps://cal.com/abdulhannan-digitalsofts/30min\n\nLooking forward to speaking with you!`;
    setReplyBody((prev) => prev.trim() + snippet);
  };

  const insertCallPitch = () => {
    const pitch = `\n\nWould you be open to a quick 15-minute introductory call this week to see how this fits your workflow?`;
    setReplyBody((prev) => prev.trim() + pitch);
  };

  return (
    <div className="space-y-6">
      {/* Modern Header Banner */}
      <div className="bg-card rounded-2xl p-6 text-text shadow-xs border border-border">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-accent text-xs font-bold uppercase tracking-wider">
              <span className="p-1 rounded-md bg-accent-soft text-accent">
                <MessageSquare className="w-3.5 h-3.5" />
              </span>
              <span>Inbound Communications</span>
            </div>
            <h2 className="text-xl font-bold text-text tracking-tight">Two-Way Inbox & Reply Intelligence</h2>
            <p className="text-xs text-text-secondary max-w-xl leading-relaxed">
              Real-time synchronization with your mail server, automated buying intent classification via
              Gemini AI, and grounded response suggestions before dispatch.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Metrics Strip */}
            <div className="flex items-center gap-2 bg-surface border border-border/80 px-3.5 py-2 rounded-xl text-xs shadow-2xs">
              <div className="flex items-center gap-1.5 pr-2.5 border-r border-border/80">
                <span className="w-2 h-2 rounded-full bg-accent" />
                <span className="text-muted text-[11px]">Total:</span>
                <span className="font-bold text-text">{stats.total}</span>
              </div>
              <div className="flex items-center gap-1.5 pr-2.5 border-r border-border/80">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-muted text-[11px]">Unread:</span>
                <span className="font-bold text-amber-600">{stats.unreadCount}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-muted text-[11px]">Interested:</span>
                <span className="font-bold text-emerald-600">{stats.interestedCount}</span>
              </div>
            </div>

            {/* IMAP Status Pill */}
            <div className="bg-surface border border-border/80 px-3 py-2 rounded-xl text-xs space-y-0.5 shadow-2xs">
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
                  ? `Synced: ${new Date(imapStatus.syncState.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : 'Ready to sync'}
              </p>
            </div>

            {/* Sync Now Button */}
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-accent hover:bg-accent-hover text-on-accent shadow-xs shadow-accent/20 transition-all disabled:opacity-50 active:scale-98 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Mailbox'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Action Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {feedback.type === 'success' ? (
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-muted hover:text-text font-bold ml-4 text-sm"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Split-Pane Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT PANE: Thread List (5 Columns) */}
        <div className="lg:col-span-5 bg-card rounded-2xl border border-border overflow-hidden shadow-xs flex flex-col h-[740px]">
          {/* Search & Filter Bar */}
          <div className="p-3.5 border-b border-border bg-surface space-y-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search conversations, keywords, sender..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadReplies()}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-border text-xs bg-card text-text placeholder:text-muted focus:ring-2 focus:ring-accent/20 focus:border-accent"
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
                  className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    activeFilter === f.id
                      ? 'bg-accent text-on-accent font-semibold shadow-xs'
                      : 'bg-card text-text-secondary border border-border hover:bg-card-hover hover:text-text'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* List of Replies */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/60">
            {loading ? (
              <div className="p-4 space-y-3">
                <TableSkeleton rows={6} />
              </div>
            ) : replies.length === 0 ? (
              <div className="p-8 text-center my-auto">
                <EmptyState
                  icon={InboxIcon}
                  title="No Inbound Messages"
                  description="No replies match the current filter. When prospects respond to your cold emails, they appear here instantly."
                  actionLabel="Sync IMAP Mailbox"
                  onAction={handleManualSync}
                />
              </div>
            ) : (
              replies.map((reply) => {
                const intent = INTENT_CONFIG[reply.classification] || INTENT_CONFIG.unclear;
                const isSelected = selectedReply?._id === reply._id;
                const companyName = reply.companyId?.companyName || 'Lead Organization';
                const senderDisplay =
                  reply.contactId?.contactName || reply.senderEmail.split('@')[0];
                const initials = senderDisplay
                  .split(' ')
                  .map((n: string) => n[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase();

                return (
                  <div
                    key={reply._id}
                    onClick={() => handleSelectReply(reply)}
                    className={`p-3.5 cursor-pointer transition-all text-left space-y-1.5 ${
                      isSelected
                        ? 'bg-accent-soft/30 border-l-4 border-l-accent'
                        : !reply.isRead
                        ? 'bg-surface font-medium hover:bg-card-hover'
                        : 'hover:bg-surface/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate">
                        {/* Avatar */}
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 ${
                            isSelected
                              ? 'bg-accent text-on-accent'
                              : 'bg-accent-soft text-accent'
                          }`}
                        >
                          {initials || 'C'}
                        </div>

                        <div className="truncate">
                          <div className="flex items-center gap-1.5">
                            {!reply.isRead && (
                              <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                            )}
                            <span className="font-bold text-text text-xs truncate">
                              {senderDisplay}
                            </span>
                          </div>
                          <span className="text-muted text-[11px] truncate block">
                            {companyName}
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] text-muted shrink-0 font-medium">
                        {new Date(reply.receivedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>

                    <p className="text-xs text-text font-semibold truncate pl-9">{reply.subject}</p>
                    <p className="text-[11px] text-text-secondary line-clamp-2 leading-relaxed pl-9">
                      {reply.body}
                    </p>

                    <div className="flex items-center justify-between pt-1 pl-9">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${intent.bg} ${intent.text} ${intent.border}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${intent.dot}`} />
                        <span>{intent.label}</span>
                      </span>

                      {reply.reviewedAt && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
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
        <div className="lg:col-span-7 bg-card rounded-2xl border border-border overflow-hidden shadow-xs flex flex-col h-[740px]">
          {!selectedReply ? (
            <div className="h-full flex items-center justify-center p-8 text-center my-auto">
              <div className="space-y-3 max-w-sm">
                <div className="w-12 h-12 rounded-2xl bg-accent-soft text-accent flex items-center justify-center mx-auto">
                  <InboxIcon className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-text">No Conversation Selected</h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Select a prospect reply from the left panel to inspect the email thread, review Gemini
                  buying signals, and dispatch a grounded reply.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <div className="p-4 border-b border-border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-text">
                      {selectedReply.contactId?.contactName || selectedReply.senderEmail}
                    </h3>
                    {selectedReply.contactId?.jobTitle && (
                      <span className="text-xs text-text-secondary font-medium">
                        — {selectedReply.contactId.jobTitle}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-text-secondary flex-wrap">
                    <Building2 className="w-3.5 h-3.5 text-muted" />
                    <span className="font-semibold text-text">
                      {selectedReply.companyId?.companyName || 'External Organization'}
                    </span>
                    {selectedReply.companyId?.website && (
                      <a
                        href={selectedReply.companyId.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent hover:underline flex items-center gap-0.5"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <span>•</span>
                    <Mail className="w-3 h-3 text-muted" />
                    <span className="font-mono text-[11px]">{selectedReply.senderEmail}</span>
                  </div>
                </div>

                {/* Classification Switcher & Action CTAs */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleStartQualificationFromReply}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-on-accent rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                    title="Send to Phase 3 Lead Qualification Pipeline"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Qualify Lead</span>
                  </button>

                  {onNavigateToMeetings && (
                    <button
                      onClick={onNavigateToMeetings}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface hover:bg-card-hover border border-border text-text rounded-xl text-xs font-semibold transition-all shadow-2xs cursor-pointer"
                      title="Schedule Meeting in Phase 4"
                    >
                      <Calendar className="w-3.5 h-3.5 text-accent" />
                      <span>Book Meeting</span>
                    </button>
                  )}

                  <div className="flex items-center gap-1.5 pl-2 border-l border-border">
                    <label className="text-[11px] text-muted font-medium">Intent:</label>
                    <select
                      value={selectedReply.classification}
                      onChange={(e) =>
                        handleClassificationChange(e.target.value as ReplyClassification)
                      }
                      className="text-xs font-semibold px-2 py-1 rounded-lg border border-border bg-card text-text focus:ring-2 focus:ring-accent/20 cursor-pointer shadow-2xs"
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
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface/40">
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
                          <div className="max-w-lg bg-card border border-border/80 rounded-2xl rounded-tr-xs p-4 shadow-2xs space-y-1.5 text-xs">
                            <div className="flex items-center justify-between gap-4 text-[10px] text-muted border-b border-border/60 pb-1 mb-1">
                              <span className="font-semibold text-accent">Sent by You (Outreach)</span>
                              <span>
                                {msg.sentAt ? new Date(msg.sentAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Outreach'}
                              </span>
                            </div>
                            <p className="font-bold text-text">{msg.subject}</p>
                            <p className="whitespace-pre-line leading-relaxed text-text-secondary font-sans">
                              {msg.bodyText}
                            </p>
                          </div>
                        </div>
                      ))}

                    {/* Incoming Prospect Reply Bubble */}
                    <div className="flex justify-start">
                      <div className="max-w-xl bg-card border border-accent/20 rounded-2xl rounded-tl-xs p-4 shadow-xs space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-4 text-[10px] text-muted border-b border-border pb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-text">
                              {selectedReply.senderEmail}
                            </span>
                            <span className="text-accent font-semibold">(Prospect Inbound)</span>
                          </div>
                          <span>{new Date(selectedReply.receivedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                        </div>

                        <p className="font-bold text-text">{selectedReply.subject}</p>
                        <p className="whitespace-pre-line leading-relaxed text-text bg-surface/80 p-3.5 rounded-xl border border-border/80 font-sans">
                          {selectedReply.body}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Grounded AI Response Editor Workspace */}
              <div className="border-t border-border p-4 bg-card space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-accent-soft text-accent rounded-lg">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-text flex items-center gap-2">
                        <span>AI Suggested Response</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-accent-soft text-accent font-normal">
                          Grounded in Cybells Knowledge Base
                        </span>
                      </h4>
                      <p className="text-[10px] text-muted">
                        Human approval gate active. Customize freely before sending.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={insertBookingSnippet}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:text-accent-hover bg-accent-soft/50 hover:bg-accent-soft px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                      title="Insert your Cal.com scheduling URL"
                    >
                      <LinkIcon className="w-3 h-3" />
                      <span>+ Cal Booking Link</span>
                    </button>

                    <button
                      type="button"
                      onClick={insertCallPitch}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-text-secondary hover:text-text bg-surface hover:bg-card-hover border border-border px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                      title="Insert a polite 15-minute call request"
                    >
                      <PhoneCall className="w-3 h-3" />
                      <span>+ Pitch 15-Min Call</span>
                    </button>

                    <button
                      onClick={handleRegenerateSuggestedReply}
                      disabled={isRegenerating}
                      className="flex items-center gap-1 text-[11px] font-semibold text-text-secondary hover:text-text bg-surface hover:bg-card-hover border border-border px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                      <span>Regenerate</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    value={replySubject}
                    onChange={(e) => setReplySubject(e.target.value)}
                    placeholder="Subject line..."
                    className="w-full px-3 py-1.5 rounded-xl border border-border text-xs font-semibold bg-surface text-text focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  />
                  <textarea
                    rows={4}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Type or customize your response..."
                    className="w-full px-3 py-2 rounded-xl border border-border text-xs font-sans leading-relaxed bg-surface text-text focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  />
                </div>

                <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                  <div className="text-[11px] text-muted flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Outbound transport: <strong className="text-text font-mono text-[10px]">SMTP Active</strong> (Sandbox Safe)</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSendApprovedReply}
                      disabled={isSending || !replyBody.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-accent hover:bg-accent-hover text-on-accent shadow-xs shadow-accent/20 transition-all disabled:opacity-50 active:scale-98 cursor-pointer"
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
