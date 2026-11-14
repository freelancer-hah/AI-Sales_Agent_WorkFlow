import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Video,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Plus,
  ExternalLink,
  Download,
  FileText,
  X,
  User,
  Building2,
  Mail,
  Send,
  Sliders,
  Check,
  Sparkles,
  XCircle,
  ChevronRight,
} from 'lucide-react';
import { api } from '../services/api';
import { CalBookingModal } from '../components/CalBookingModal';

export function MeetingsHub() {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    total: 0,
    upcoming: 0,
    confirmed: 0,
    completed: 0,
    rescheduled: 0,
    cancelled: 0,
    noShow: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modals state
  const [selectedMeeting, setSelectedMeeting] = useState<any>(null);
  const [dossierModal, setDossierModal] = useState<any>(null);
  const [rescheduleModal, setRescheduleModal] = useState<any>(null);
  const [cancelModal, setCancelModal] = useState<any>(null);
  const [outcomeModal, setOutcomeModal] = useState<any>(null);
  const [availabilityModal, setAvailabilityModal] = useState<boolean>(false);
  const [hostSettings, setHostSettings] = useState<any>(null);
  const [calModalOpen, setCalModalOpen] = useState<boolean>(false);

  // New Schedule Modal State
  const [scheduleModal, setScheduleModal] = useState<boolean>(false);
  const [availableContacts, setAvailableContacts] = useState<any[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [newMeetingTitle, setNewMeetingTitle] = useState<string>('');
  const [newMeetingStartTime, setNewMeetingStartTime] = useState<string>('');
  const [newMeetingDuration, setNewMeetingDuration] = useState<number>(30);
  const [newMeetingCloser, setNewMeetingCloser] = useState<string>('Hafiz (Sales Closer)');
  const [aiTimeSnippet, setAiTimeSnippet] = useState<string>('');
  const [aiTimeLoading, setAiTimeLoading] = useState<boolean>(false);
  const [aiTimeFeedback, setAiTimeFeedback] = useState<{ type: 'success' | 'warn' | 'error'; text: string } | null>(null);

  // Form states
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [cancellationReason, setCancellationReason] = useState('');
  const [outcomeType, setOutcomeType] = useState('deal_in_progress');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadData();
  }, [statusFilter, page]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [meetingsRes, statsRes] = await Promise.all([
        api.getMeetings({
          status: statusFilter === 'all' ? undefined : statusFilter,
          page,
          limit: 15,
        }),
        api.getMeetingStats(),
      ]);

      if (meetingsRes.success) {
        setMeetings(meetingsRes.data);
        setTotalPages(meetingsRes.pagination.totalPages || 1);
      }
      if (statsRes.success) {
        setStats(statsRes.data);
      }
    } catch (err: any) {
      console.error('Failed to load meetings data', err);
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // View Dossier
  const handleOpenDossier = async (meeting: any) => {
    setSelectedMeeting(meeting);
    setActionLoading(true);
    try {
      const res = await api.getMeetingDossier(meeting._id);
      if (res.success) {
        setDossierModal(res.data);
      }
    } catch (err: any) {
      showNotification(err.message || 'Failed to load executive closer dossier', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Reschedule
  const handleRescheduleSubmit = async () => {
    if (!rescheduleTime) {
      showNotification('Please select a new date and time', 'error');
      return;
    }
    setActionLoading(true);
    try {
      const res = await api.rescheduleMeeting(rescheduleModal._id, rescheduleTime, rescheduleReason);
      if (res.success) {
        showNotification('Meeting successfully rescheduled. Sequence updated.', 'success');
        setRescheduleModal(null);
        setRescheduleTime('');
        setRescheduleReason('');
        loadData();
      }
    } catch (err: any) {
      showNotification(err.message || 'Failed to reschedule meeting', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Cancellation
  const handleCancelSubmit = async () => {
    if (!cancellationReason.trim()) {
      showNotification('Please enter a cancellation reason', 'error');
      return;
    }
    setActionLoading(true);
    try {
      const res = await api.cancelMeeting(cancelModal._id, cancellationReason);
      if (res.success) {
        showNotification('Meeting cancelled and calendar release issued.', 'success');
        setCancelModal(null);
        setCancellationReason('');
        loadData();
      }
    } catch (err: any) {
      showNotification(err.message || 'Failed to cancel meeting', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Outcome
  const handleOutcomeSubmit = async () => {
    setActionLoading(true);
    try {
      const res = await api.recordMeetingOutcome(outcomeModal._id, outcomeType, outcomeNotes);
      if (res.success) {
        showNotification('Meeting outcome recorded. Contact status converted if deal won/active.', 'success');
        setOutcomeModal(null);
        setOutcomeNotes('');
        loadData();
      }
    } catch (err: any) {
      showNotification(err.message || 'Failed to log meeting outcome', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Send Reminder
  const handleSendReminder = async (meetingId: string, type: '24h' | '1h') => {
    setActionLoading(true);
    try {
      const res = await api.sendMeetingReminder(meetingId, type);
      if (res.success) {
        showNotification(`${type} reminder draft generated for review.`, 'success');
        loadData();
      }
    } catch (err: any) {
      showNotification(err.message || 'Failed to send reminder', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Availability Settings
  const handleOpenAvailability = async () => {
    try {
      const res = await api.getHostAvailability();
      if (res.success) {
        setHostSettings(res.data);
        setAvailabilityModal(true);
      }
    } catch (err: any) {
      showNotification('Failed to load host availability', 'error');
    }
  };

  // Save Availability Settings
  const handleSaveAvailability = async () => {
    if (!hostSettings) return;
    setActionLoading(true);
    try {
      const res = await api.updateHostAvailability(hostSettings);
      if (res.success) {
        showNotification('Host availability settings updated successfully', 'success');
        setAvailabilityModal(false);
      }
    } catch (err: any) {
      showNotification(err.message || 'Failed to update availability', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenScheduleModal = async () => {
    setScheduleModal(true);
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(15, 0, 0, 0);
    const pad = (n: number) => n.toString().padStart(2, '0');
    setNewMeetingStartTime(
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
    setNewMeetingTitle('Cybells AI Automation Discovery Session');
    setSelectedContactId('');
    setAiTimeSnippet('');
    setAiTimeFeedback(null);
    try {
      const res = await api.getOutreachContacts({ limit: 50 });
      if (res.success && res.data) {
        setAvailableContacts(res.data.contacts || res.data || []);
      }
    } catch {
      // Ignored
    }
  };

  const handleContactChange = async (contactId: string) => {
    setSelectedContactId(contactId);
    if (!contactId) {
      setAiTimeSnippet('');
      setAiTimeFeedback(null);
      return;
    }

    const contactObj = availableContacts.find((c) => c._id === contactId);
    const compName = contactObj?.companyId?.companyName || 'Prospect Organization';
    setNewMeetingTitle(`Cybells AI Automation Discovery Session — ${compName}`);

    // AUTO-FETCH latest inbound reply from this contact & parse time slot!
    setAiTimeLoading(true);
    setAiTimeFeedback(null);
    try {
      const res = await api.parseMeetingSlots({ contactId });
      if (res.success && res.data) {
        const data = res.data;
        if (data.sourceMessage) {
          setAiTimeSnippet(data.sourceMessage);
        }
        if (data.parsedDateTime) {
          const d = new Date(data.parsedDateTime);
          const pad = (n: number) => n.toString().padStart(2, '0');
          const formattedLocal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          setNewMeetingStartTime(formattedLocal);
          if (data.durationMinutes) {
            setNewMeetingDuration(data.durationMinutes);
          }
          if (data.isSlotAvailable === false) {
            setAiTimeFeedback({
              type: 'warn',
              text: `Auto-loaded from prospect message: ${d.toLocaleString()} (Note: Host has a conflict: ${data.conflictReason || 'slot unavailable'})`,
            });
          } else {
            const senderName = contactObj?.contactName || 'client';
            setAiTimeFeedback({
              type: 'success',
              text: `✨ Auto-detected from ${senderName}'s email: ${d.toLocaleString()} (${data.durationMinutes || 30} mins) — Host free & auto-filled below!`,
            });
          }
        } else if (data.sourceMessage) {
          setAiTimeFeedback({
            type: 'warn',
            text: `Auto-loaded prospect's latest message, but no specific date/time was stated. Default set to tomorrow 3:00 PM (or pick custom).`,
          });
        }
      }
    } catch {
      // Soft fallback
    } finally {
      setAiTimeLoading(false);
    }
  };

  const handleExtractTimeWithGemini = async () => {
    if (!aiTimeSnippet.trim()) return;
    setAiTimeLoading(true);
    setAiTimeFeedback(null);
    try {
      const res = await api.parseMeetingSlots({ messageText: aiTimeSnippet, contactId: selectedContactId || undefined });
      if (res.success && res.data) {
        const data = res.data;
        if (data.parsedDateTime) {
          const d = new Date(data.parsedDateTime);
          const pad = (n: number) => n.toString().padStart(2, '0');
          const formattedLocal = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          setNewMeetingStartTime(formattedLocal);
          if (data.durationMinutes) {
            setNewMeetingDuration(data.durationMinutes);
          }
          if (data.isSlotAvailable === false) {
            setAiTimeFeedback({
              type: 'warn',
              text: `Detected: ${d.toLocaleString()} (Note: Host has a conflict or it's outside business hours: ${data.conflictReason || 'slot unavailable'})`,
            });
          } else {
            setAiTimeFeedback({
              type: 'success',
              text: `✨ Successfully extracted: ${d.toLocaleString()} (${data.durationMinutes || 30} mins) — Host free & verified!`,
            });
          }
        } else {
          setAiTimeFeedback({
            type: 'error',
            text: data.notes || 'No specific date or time detected in this snippet. Please specify or pick manually below.',
          });
        }
      }
    } catch (err: any) {
      setAiTimeFeedback({
        type: 'error',
        text: err.message || 'Failed to extract meeting time with AI',
      });
    } finally {
      setAiTimeLoading(false);
    }
  };

  const handleCreateMeetingSubmit = async () => {
    if (!selectedContactId || !newMeetingStartTime) {
      showNotification('Please select an outreach contact and start date/time', 'error');
      return;
    }
    const contactObj = availableContacts.find((c) => c._id === selectedContactId);
    const compId = contactObj?.companyId?._id || contactObj?.companyId;
    if (!compId) {
      showNotification('Selected contact has no associated company', 'error');
      return;
    }
    setActionLoading(true);
    try {
      const res = await api.createMeeting({
        companyId: compId,
        contactId: selectedContactId,
        startTime: new Date(newMeetingStartTime).toISOString(),
        durationMinutes: newMeetingDuration,
        title: newMeetingTitle,
        assignedAE: newMeetingCloser,
        force: true,
      });
      if (res.success) {
        showNotification(
          'Sales discovery meeting booked successfully! Google Meet & .ics generated.',
          'success'
        );
        setScheduleModal(false);
        setSelectedContactId('');
        loadData();
      }
    } catch (err: any) {
      showNotification(err.message || 'Failed to schedule meeting', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">Confirmed</span>;
      case 'rescheduled':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200">Rescheduled</span>;
      case 'completed':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">Completed</span>;
      case 'cancelled':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 border border-rose-200">Cancelled</span>;
      case 'no_show':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-300">No Show</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-200">Proposed</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between shadow-md transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-rose-50 text-rose-900 border border-rose-200'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)}>
            <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
          </button>
        </div>
      )}

      {/* Header Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-card p-4 rounded-2xl border border-border shadow-xs hover:border-[#D6CEBE] hover:shadow-md transition-all flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-soft text-accent flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Total Booked</p>
            <p className="text-xl font-bold text-text tabular-nums">{stats.total}</p>
          </div>
        </div>

        <div className="bg-card p-4 rounded-2xl border border-border shadow-xs hover:border-[#D6CEBE] hover:shadow-md transition-all flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Upcoming Calls</p>
            <p className="text-xl font-bold text-text tabular-nums">{stats.upcoming}</p>
          </div>
        </div>

        <div className="bg-card p-4 rounded-2xl border border-border shadow-xs hover:border-[#D6CEBE] hover:shadow-md transition-all flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Completed Calls</p>
            <p className="text-xl font-bold text-text tabular-nums">{stats.completed}</p>
          </div>
        </div>

        <div className="bg-card p-4 rounded-2xl border border-border shadow-xs hover:border-[#D6CEBE] hover:shadow-md transition-all flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-track text-text-secondary flex items-center justify-center shrink-0">
            <RefreshCw className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Rescheduled</p>
            <p className="text-xl font-bold text-text tabular-nums">{stats.rescheduled}</p>
          </div>
        </div>

        <div className="bg-card p-4 rounded-2xl border border-border shadow-xs hover:border-[#D6CEBE] hover:shadow-md transition-all flex items-center gap-3 sm:col-span-2 lg:col-span-1">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Cancelled / No-Show</p>
            <p className="text-xl font-bold text-text tabular-nums">{stats.cancelled + stats.noShow}</p>
          </div>
        </div>
      </div>

      {/* Action Toolbar & Filters */}
      <div className="bg-card p-4 rounded-2xl border border-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'All Sessions' },
            { id: 'confirmed', label: 'Confirmed' },
            { id: 'rescheduled', label: 'Rescheduled' },
            { id: 'completed', label: 'Completed' },
            { id: 'cancelled', label: 'Cancelled' },
            { id: 'no_show', label: 'No Show' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
                statusFilter === tab.id
                  ? 'bg-accent text-on-accent shadow-xs shadow-accent/20'
                  : 'text-text-secondary hover:text-text hover:bg-card-hover'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setCalModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all shadow-2xs active:scale-98 cursor-pointer"
            title="Open Cal.diy live interactive calendar scheduler"
          >
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>⚡ Cal.diy Live Scheduler</span>
          </button>
          <button
            onClick={handleOpenScheduleModal}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-on-accent bg-accent hover:bg-accent-hover rounded-xl transition-all shadow-xs shadow-accent/20 active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>+ Schedule Meeting</span>
          </button>
          <button
            onClick={handleOpenAvailability}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-text bg-card hover:bg-card-hover border border-border rounded-xl transition-colors shadow-2xs"
          >
            <Sliders className="w-4 h-4 text-muted" />
            <span>Host Working Hours</span>
          </button>
        </div>
      </div>

      {/* Meetings Table / List */}
      <div className="bg-card rounded-2xl border border-border shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-accent" />
            <p className="text-sm">Loading scheduled meetings...</p>
          </div>
        ) : meetings.length === 0 ? (
          <div className="p-12 text-center text-muted">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-muted" />
            <p className="text-base font-semibold text-text">No discovery meetings found</p>
            <p className="text-xs text-text-secondary mt-1">
              Schedule a discovery session for any qualified lead to generate Google Meet &amp; .ics calendar invites.
            </p>
            <button
              onClick={handleOpenScheduleModal}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-on-accent rounded-xl text-xs font-bold transition shadow-xs shadow-accent/20 active:scale-98"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule Discovery Meeting</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-sidebar text-text-secondary text-xs font-semibold border-b border-border uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Prospect & Company</th>
                  <th className="py-3 px-4">Meeting Title & URL</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">AE Assigned</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {meetings.map((m) => {
                  const sDate = new Date(m.startTime);
                  const pad = (n: number) => n.toString().padStart(2, '0');
                  const dateStr = sDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });
                  const timeStr = `${pad(sDate.getHours())}:${pad(sDate.getMinutes())}`;

                  return (
                    <tr key={m._id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Date & Time */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{dateStr}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {timeStr} ({m.timezone || 'PKT'}) • {m.durationMinutes}m
                          </span>
                        </div>
                      </td>

                      {/* Prospect & Company */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">
                          {m.contactId?.contactName || 'Valued Prospect'}
                        </div>
                        <div className="text-xs text-slate-500">{m.contactId?.jobTitle || 'Executive'}</div>
                        <div className="text-xs text-blue-600 font-semibold flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3" />
                          <span>{m.companyId?.companyName || 'Target Company'}</span>
                        </div>
                      </td>

                      {/* Title & Meeting URL */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900 line-clamp-1">{m.title}</div>
                        {m.meetingUrl && (
                          <a
                            href={m.meetingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1 mt-0.5"
                          >
                            <Video className="w-3.5 h-3.5" />
                            <span>Join Google Meet</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">{getStatusBadge(m.status)}</td>

                      {/* Assigned AE */}
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-medium text-slate-700">
                          {m.assignedAE || 'Cybells Specialist'}
                        </div>
                        {m.remindersSent > 0 && (
                          <div className="text-[10px] text-emerald-600 font-medium">
                            {m.remindersSent} reminder(s) sent
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Closer Dossier */}
                          <button
                            onClick={() => handleOpenDossier(m)}
                            title="View Closer Dossier"
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-200"
                          >
                            <FileText className="w-4 h-4" />
                          </button>

                          {/* Download .ics */}
                          <a
                            href={api.getMeetingIcsDownloadUrl(m._id)}
                            download={`invite-${m._id}.ics`}
                            title="Download .ics Calendar Invite"
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                          >
                            <Download className="w-4 h-4" />
                          </a>

                          {/* Reschedule */}
                          {m.status !== 'cancelled' && m.status !== 'completed' && (
                            <button
                              onClick={() => setRescheduleModal(m)}
                              title="Reschedule Meeting"
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-amber-200"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}

                          {/* Log Outcome */}
                          {m.status !== 'cancelled' && (
                            <button
                              onClick={() => {
                                setOutcomeModal(m);
                                setOutcomeType(m.meetingOutcome?.outcome || 'deal_in_progress');
                                setOutcomeNotes(m.meetingOutcome?.notes || '');
                              }}
                              title="Log Meeting Outcome"
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-emerald-200"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}

                          {/* Cancel */}
                          {m.status !== 'cancelled' && m.status !== 'completed' && (
                            <button
                              onClick={() => setCancelModal(m)}
                              title="Cancel Meeting"
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-rose-200"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* 1. Closer Dossier Drawer Modal                                      */}
      {/* ==================================================================== */}
      {dossierModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-end">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl p-6 overflow-y-auto flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Executive Closer Dossier</h2>
                    <p className="text-xs text-slate-500">1-Page Pre-Call Brief for Human Sales Team</p>
                  </div>
                </div>
                <button
                  onClick={() => setDossierModal(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Dossier Content */}
              <div className="mt-6 space-y-6">
                {/* Score & Urgency Banner */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
                      Qualification Score
                    </div>
                    <div className="text-2xl font-black text-slate-900 mt-0.5">
                      {dossierModal.qualificationSummary?.score}/100
                    </div>
                    <div className="text-xs text-slate-600 mt-1">
                      Status: <strong className="text-emerald-600">{dossierModal.qualificationSummary?.status}</strong> •
                      Interest: <strong>{dossierModal.qualificationSummary?.interestLevel}</strong>
                    </div>
                  </div>
                  <a
                    href={dossierModal.meetingDetails?.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg shadow-sm flex items-center gap-2"
                  >
                    <Video className="w-4 h-4" />
                    <span>Join Call</span>
                  </a>
                </div>

                {/* Company & Contact */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-xs font-semibold text-slate-500 uppercase">Target Account</div>
                    <div className="text-sm font-bold text-slate-900 mt-1">
                      {dossierModal.companyProfile?.name}
                    </div>
                    <div className="text-xs text-slate-600">{dossierModal.companyProfile?.industry}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {dossierModal.companyProfile?.city ? `${dossierModal.companyProfile?.city}, ` : ''}
                      {dossierModal.companyProfile?.country}
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-xs font-semibold text-slate-500 uppercase">Decision Maker</div>
                    <div className="text-sm font-bold text-slate-900 mt-1">
                      {dossierModal.decisionMaker?.name}
                    </div>
                    <div className="text-xs text-slate-600">{dossierModal.decisionMaker?.jobTitle}</div>
                    <div className="text-xs text-indigo-600 font-mono mt-1">
                      {dossierModal.decisionMaker?.email}
                    </div>
                  </div>
                </div>

                {/* BANT Intelligence */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Phase 3 BANT Intelligence
                  </h3>
                  <div>
                    <div className="text-xs font-semibold text-slate-600">Core Bottlenecks:</div>
                    <ul className="list-disc list-inside text-xs text-slate-700 space-y-0.5 mt-1">
                      {dossierModal.qualificationSummary?.identifiedBottlenecks?.map((b: string, i: number) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-slate-600">Current Systems / Software:</div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {dossierModal.qualificationSummary?.currentSystems?.map((s: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-mono text-slate-800">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                    <div>
                      <span className="font-semibold text-slate-600">Timeline:</span>{' '}
                      <span className="text-slate-800">{dossierModal.qualificationSummary?.purchasingTimeline}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-600">Budget:</span>{' '}
                      <span className="text-slate-800">{dossierModal.qualificationSummary?.budgetReadiness}</span>
                    </div>
                  </div>
                </div>

                {/* Tailored Solution Pitch */}
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-2">
                  <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                    Recommended Cybells Commercial Angle
                  </h3>
                  <p className="text-xs font-semibold text-emerald-950">
                    {dossierModal.tailoredSolutionPitch?.recommendedOffering}
                  </p>
                  <p className="text-xs text-emerald-900 leading-relaxed">
                    {dossierModal.tailoredSolutionPitch?.automationValueProp}
                  </p>
                </div>

                {/* Discovery Questions */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Recommended Discovery Questions for Closer
                  </h3>
                  <div className="text-xs text-slate-700 space-y-1.5">
                    {dossierModal.recommendedDiscoveryQuestions?.map((q: string, i: number) => (
                      <p key={i} className="leading-relaxed">{q}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-6 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => setDossierModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Close
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSendReminder(selectedMeeting._id, '24h')}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Draft 24h Reminder
                </button>
                <button
                  onClick={() => handleSendReminder(selectedMeeting._id, '1h')}
                  className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg"
                >
                  Draft 1h Reminder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. Reschedule Modal                                                 */}
      {/* ==================================================================== */}
      {rescheduleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-amber-500" />
                <span>Reschedule Meeting</span>
              </h3>
              <button onClick={() => setRescheduleModal(null)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">New Date & Time</label>
                <input
                  type="datetime-local"
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Reschedule Reason</label>
                <textarea
                  rows={3}
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="e.g. Prospect requested shift due to factory inspection..."
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
                Rescheduling automatically updates the sequence counter, validates conflict with host hours, and updates calendar invites.
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setRescheduleModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleRescheduleSubmit}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg"
              >
                {actionLoading ? 'Updating...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. Cancel Meeting Modal                                             */}
      {/* ==================================================================== */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <X className="w-5 h-5 text-rose-500" />
                <span>Cancel Discovery Call</span>
              </h3>
              <button onClick={() => setCancelModal(null)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Cancellation Reason</label>
                <textarea
                  rows={3}
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="e.g. Prospect notified project deferred to next quarter..."
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="text-[11px] text-rose-600 bg-rose-50 p-3 rounded-lg border border-rose-200">
                Cancelling issues an RFC 5545 cancellation update and immediately releases the slot back to the host availability pool.
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setCancelModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Close
              </button>
              <button
                onClick={handleCancelSubmit}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
              >
                {actionLoading ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. Log Outcome Modal                                                */}
      {/* ==================================================================== */}
      {outcomeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                <span>Log Meeting Outcome</span>
              </h3>
              <button onClick={() => setOutcomeModal(null)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Call Outcome</label>
                <select
                  value={outcomeType}
                  onChange={(e) => setOutcomeType(e.target.value)}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="deal_in_progress">Deal In Progress (POC / Pilot)</option>
                  <option value="closed_won">Closed Won (Contract Signed)</option>
                  <option value="follow_up_needed">Follow Up Needed</option>
                  <option value="closed_lost">Closed Lost (Not a fit)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Closer Notes</label>
                <textarea
                  rows={3}
                  value={outcomeNotes}
                  onChange={(e) => setOutcomeNotes(e.target.value)}
                  placeholder="e.g. Decision maker agreed to 30-day garment manifest automation trial..."
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
                Recording "Deal In Progress" or "Closed Won" automatically converts the contact to converted in the pipeline.
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setOutcomeModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Close
              </button>
              <button
                onClick={handleOutcomeSubmit}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
              >
                {actionLoading ? 'Saving...' : 'Save Outcome'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. Host Availability Settings Modal                                 */}
      {/* ==================================================================== */}
      {availabilityModal && hostSettings && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white max-w-lg w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto animate-fade-in">
            <div className="shrink-0 p-5 flex items-center justify-between border-b border-slate-100 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-blue-600" />
                <span>Host Working Hours & Availability</span>
              </h3>
              <button onClick={() => setAvailabilityModal(false)} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Host Specialist Name</label>
                  <input
                    type="text"
                    value={hostSettings.hostName}
                    onChange={(e) => setHostSettings({ ...hostSettings, hostName: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Host Email</label>
                  <input
                    type="email"
                    value={hostSettings.hostEmail}
                    onChange={(e) => setHostSettings({ ...hostSettings, hostEmail: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">Permanent Video Link (Google Meet / Zoom)</label>
                  <a
                    href="https://meet.google.com/new"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <span>Create New Google Meet</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <input
                  type="url"
                  placeholder="e.g. https://meet.google.com/abc-defg-hij or your Zoom link"
                  value={hostSettings.defaultMeetingUrl || ''}
                  onChange={(e) => setHostSettings({ ...hostSettings, defaultMeetingUrl: e.target.value })}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Leave blank to auto-launch instant rooms via Google Meet on call time.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Duration (Mins)</label>
                  <input
                    type="number"
                    value={hostSettings.meetingDurationMinutes}
                    onChange={(e) => setHostSettings({ ...hostSettings, meetingDurationMinutes: parseInt(e.target.value, 10) })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Buffer (Mins)</label>
                  <input
                    type="number"
                    value={hostSettings.bufferMinutes}
                    onChange={(e) => setHostSettings({ ...hostSettings, bufferMinutes: parseInt(e.target.value, 10) })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Max Daily Calls</label>
                  <input
                    type="number"
                    value={hostSettings.maxMeetingsPerDay}
                    onChange={(e) => setHostSettings({ ...hostSettings, maxMeetingsPerDay: parseInt(e.target.value, 10) })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Working Days */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Weekly Schedule</label>
                <div className="space-y-1.5">
                  {hostSettings.weeklySchedule?.map((day: any, idx: number) => {
                    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                    return (
                      <div key={idx} className="flex items-center justify-between text-xs p-2 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={day.isEnabled}
                            onChange={(e) => {
                              const updated = [...hostSettings.weeklySchedule];
                              updated[idx].isEnabled = e.target.checked;
                              setHostSettings({ ...hostSettings, weeklySchedule: updated });
                            }}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span className={`font-semibold ${day.isEnabled ? 'text-slate-900' : 'text-slate-400'}`}>
                            {dayNames[day.dayOfWeek]}
                          </span>
                        </div>
                        {day.isEnabled && (
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <span>{day.startTime}</span>
                            <span>–</span>
                            <span>{day.endTime}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="shrink-0 p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setAvailabilityModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAvailability}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-xs"
              >
                {actionLoading ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Meeting Modal — Premium Wide 2-Column Layout */}
      {scheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-fade-in my-auto">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Schedule Sales Discovery Meeting</h3>
                  <p className="text-xs text-slate-500">Auto-configured Google Meet room &amp; RFC 5545 calendar invite</p>
                </div>
              </div>
              <button
                onClick={() => setScheduleModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Top AI Context / Quote Pill (Sleek, Compact) */}
            <div className="p-5 pb-0">
              {aiTimeSnippet || aiTimeFeedback ? (
                <div className="p-3 bg-gradient-to-r from-indigo-50/80 via-blue-50/50 to-slate-50 border border-indigo-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="p-1 rounded-lg bg-indigo-100 text-indigo-700 shrink-0 mt-0.5">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 text-xs">
                      <div className="text-slate-500 text-[11px] font-medium flex items-center gap-1.5">
                        <span>Prospect Email Snippet:</span>
                        {aiTimeLoading && <span className="text-indigo-600 font-bold animate-pulse">Parsing with Gemini...</span>}
                      </div>
                      <p className="font-semibold text-slate-800 italic truncate max-w-md">
                        "{aiTimeSnippet || 'Checking inbox for message...'}"
                      </p>
                      {aiTimeFeedback && (
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold mt-0.5 ${
                          aiTimeFeedback.type === 'success' ? 'text-emerald-700' : aiTimeFeedback.type === 'warn' ? 'text-amber-700' : 'text-rose-700'
                        }`}>
                          {aiTimeFeedback.type === 'success' && <CheckCircle className="w-3 h-3 shrink-0" />}
                          {aiTimeFeedback.type === 'warn' && <AlertTriangle className="w-3 h-3 shrink-0" />}
                          {aiTimeFeedback.type === 'error' && <XCircle className="w-3 h-3 shrink-0" />}
                          <span>{aiTimeFeedback.text}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <input
                      type="text"
                      value={aiTimeSnippet}
                      onChange={(e) => setAiTimeSnippet(e.target.value)}
                      placeholder="Edit snippet or paste time..."
                      className="w-44 text-[11px] p-1.5 bg-white border border-indigo-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleExtractTimeWithGemini();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleExtractTimeWithGemini}
                      disabled={aiTimeLoading || !aiTimeSnippet.trim()}
                      className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
                      title="Re-extract time with Gemini"
                    >
                      {aiTimeLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Re-parse'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    <span className="text-[11px]">Paste any client message to auto-detect time:</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-1 max-w-sm">
                    <input
                      type="text"
                      value={aiTimeSnippet}
                      onChange={(e) => setAiTimeSnippet(e.target.value)}
                      placeholder="e.g. 'Can we do Thursday at 3:30 PM?'"
                      className="w-full text-[11px] p-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleExtractTimeWithGemini();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleExtractTimeWithGemini}
                      disabled={aiTimeLoading || !aiTimeSnippet.trim()}
                      className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shrink-0 disabled:opacity-50"
                    >
                      {aiTimeLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Auto-Fill'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Main Form: 2 Balanced Columns */}
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* LEFT COLUMN: Prospect Details & Title */}
              <div className="space-y-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Target Prospect / Contact:</label>
                  <select
                    value={selectedContactId}
                    onChange={(e) => handleContactChange(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">-- Select Contact to Auto-Load Email --</option>
                    {availableContacts.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.contactName || 'Executive'} ({c.email}) — {c.companyId?.companyName || 'Company'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Meeting Title:</label>
                  <input
                    type="text"
                    value={newMeetingTitle}
                    onChange={(e) => setNewMeetingTitle(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Assigned Sales Closer (AE):</label>
                  <input
                    type="text"
                    value={newMeetingCloser}
                    onChange={(e) => setNewMeetingCloser(e.target.value)}
                    placeholder="e.g. Hafiz (Sales Closer)"
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* RIGHT COLUMN: Date/Time, Duration Pills, Google Meet Badge */}
              <div className="space-y-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Start Date &amp; Time:</label>
                  <input
                    type="datetime-local"
                    value={newMeetingStartTime}
                    onChange={(e) => setNewMeetingStartTime(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Meeting Duration:</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[15, 30, 45, 60].map((dur) => (
                      <button
                        key={dur}
                        type="button"
                        onClick={() => setNewMeetingDuration(dur)}
                        className={`py-2 px-1 text-center text-xs rounded-xl font-bold transition border ${
                          newMeetingDuration === dur
                            ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {dur} mins
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-center gap-3 mt-1">
                  <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Video className="w-4 h-4" />
                  </div>
                  <div className="text-[11px] leading-tight text-blue-900">
                    <span className="font-bold block">Instant Google Meet &amp; Calendar (.ics)</span>
                    <span className="text-blue-700 text-[10px]">Secure room link generated and added to your calendar</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div className="text-[11px] text-slate-500 font-medium hidden sm:flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Host Zone: Asia/Karachi (09:00 - 18:00)</span>
              </div>
              <div className="flex items-center gap-2.5 ml-auto">
                <button
                  type="button"
                  onClick={() => setScheduleModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateMeetingSubmit}
                  disabled={actionLoading || !selectedContactId || !newMeetingStartTime}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {actionLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Scheduling...</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm &amp; Schedule Call</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Cal.diy Live Interactive Scheduler Modal */}
      <CalBookingModal
        isOpen={calModalOpen}
        onClose={() => setCalModalOpen(false)}
        onBookingSuccess={() => {
          showNotification('Meeting confirmed via Cal.diy! Synchronizing...', 'success');
          loadData();
        }}
      />
    </div>
  );
}

