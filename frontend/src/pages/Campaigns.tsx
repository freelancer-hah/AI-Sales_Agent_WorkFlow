import React, { useState, useEffect } from 'react';
import {
  Send,
  Play,
  Pause,
  XCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Calendar,
  Layers,
  ShieldCheck,
  ShieldAlert,
  Mail,
  RefreshCw,
  Users,
  ChevronRight,
  ChevronLeft,
  Settings,
  Info,
  Check,
  Eye,
} from 'lucide-react';
import { api } from '../services/api';
import { ICampaign, CampaignStatus, ICampaignSequenceStep, IOutreachMessage } from '../types';
import { TableSkeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
import { OutreachWorkspaceNav } from '../components/WorkspaceNav';
import { NavTab } from '../components/Sidebar';

export const Campaigns: React.FC<{
  onNavigateToDrafts?: () => void;
  onNavigateToLeads?: () => void;
  onNavigate?: (tab: NavTab) => void;
}> = ({ onNavigateToDrafts, onNavigateToLeads, onNavigate }) => {
  const [campaigns, setCampaigns] = useState<ICampaign[]>([]);
  const [messages, setMessages] = useState<IOutreachMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [transportStatus, setTransportStatus] = useState<any>(null);

  // Active Tab
  const [activeSubTab, setActiveSubTab] = useState<'campaigns' | 'logs'>('campaigns');

  // Create Campaign Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [campaignDesc, setCampaignDesc] = useState('');
  const [sequenceSteps, setSequenceSteps] = useState<ICampaignSequenceStep[]>([
    { step: 0, dayOffset: 0, subject: '', body: '' },
    { step: 1, dayOffset: 3, subject: 'Quick follow up regarding our previous note', body: '' },
    { step: 2, dayOffset: 7, subject: 'Following up on AI automation workflow', body: '' },
    { step: 3, dayOffset: 12, subject: 'Closing the loop on workflow automation', body: '' },
  ]);
  const [dailyCapInput, setDailyCapInput] = useState<number>(25);
  const [minDelayInput, setMinDelayInput] = useState<number>(60);
  const [maxDelayInput, setMaxDelayInput] = useState<number>(180);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Enrolled contacts for campaign enrollment
  const [enrolledContacts, setEnrolledContacts] = useState<any[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  // Action feedback
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, [activeSubTab]);

  const loadData = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const [campRes, configRes] = await Promise.all([
        api.getCampaigns({ limit: 50 }),
        api.getCybellsConfig().catch(() => null),
      ]);

      if (campRes.success) {
        setCampaigns(campRes.data.campaigns);
      }
      if (configRes?.transportStatus) {
        setTransportStatus(configRes.transportStatus);
      }

      if (activeSubTab === 'logs') {
        const msgRes = await api.getOutreachMessages({ limit: 50 });
        if (msgRes.success) {
          setMessages(msgRes.data.messages);
        }
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load campaigns' });
    } finally {
      setLoading(false);
    }
  };

  const loadEnrolledContacts = async () => {
    try {
      const res = await api.getOutreachContacts({ limit: 100 });
      if (res.success) {
        setEnrolledContacts(res.data.contacts);
        // Default select contacts that are 'ready' or 'pending_approval'
        const readyIds = res.data.contacts
          .filter((c: any) => c.outreachStatus === 'ready' || c.outreachStatus === 'pending_approval' || c.outreachStatus === 'selected')
          .map((c: any) => c._id);
        setSelectedContactIds(readyIds);
      }
    } catch {
      // Ignored
    }
  };

  const handleOpenCreateModal = () => {
    loadEnrolledContacts();
    setIsCreateModalOpen(true);
  };

  const handleAddStep = () => {
    const nextStep = sequenceSteps.length;
    const lastOffset = sequenceSteps[sequenceSteps.length - 1]?.dayOffset || 0;
    setSequenceSteps([
      ...sequenceSteps,
      {
        step: nextStep,
        dayOffset: lastOffset + 4,
        subject: `Follow up step ${nextStep}`,
        body: '',
      },
    ]);
  };

  const handleRemoveStep = (index: number) => {
    if (sequenceSteps.length <= 1) return; // Keep at least Step 0
    setSequenceSteps(sequenceSteps.filter((_, i) => i !== index));
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignName.trim()) {
      alert('Please enter a campaign name.');
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await api.createCampaign({
        name: campaignName.trim(),
        description: campaignDesc.trim(),
        selectedContacts: selectedContactIds,
        sequence: sequenceSteps,
        sendingLimits: {
          dailyCap: dailyCapInput,
          minDelaySeconds: minDelayInput,
          maxDelaySeconds: maxDelayInput,
        },
      });

      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Campaign "${res.data.name}" created! Ready to launch sequences.`,
        });
        setIsCreateModalOpen(false);
        setCampaignName('');
        setCampaignDesc('');
        loadData();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to create campaign' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLaunchCampaign = async (campaign: ICampaign) => {
    const isSandbox = transportStatus?.sendMode !== 'live';

    const confirmMsg = isSandbox
      ? `Launch campaign "${campaign.name}" in SANDBOX mode?\n\n• Safety Guard Active: All outbound emails will be safely redirected to ${transportStatus?.sandboxInbox || 'your sandbox inbox'}.\n• No real prospect will receive emails.\n• Approved drafts will be dispatched according to the sequence schedule.`
      : `⚠️ ATTENTION: LIVE OUTREACH MODE IS ACTIVE!\n\nAre you sure you want to launch "${campaign.name}"?\nEmails WILL be sent to real prospects via SMTP.`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      const res = await api.launchCampaign(campaign._id);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: res.message || 'Campaign launched successfully!',
        });
        loadData();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to launch campaign. Please check that drafts are approved.',
      });
    }
  };

  const handlePauseCampaign = async (id: string) => {
    try {
      const res = await api.pauseCampaign(id);
      if (res.success) {
        setFeedback({ type: 'warning', message: res.message });
        loadData();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleResumeCampaign = async (id: string) => {
    try {
      const res = await api.resumeCampaign(id);
      if (res.success) {
        setFeedback({ type: 'success', message: res.message });
        loadData();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const handleCancelCampaign = async (id: string) => {
    if (!window.confirm('Cancel this campaign? All pending scheduled emails and follow-ups will be permanently cancelled.')) {
      return;
    }
    try {
      const res = await api.cancelCampaign(id);
      if (res.success) {
        setFeedback({ type: 'warning', message: res.message });
        loadData();
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message });
    }
  };

  const getStatusBadge = (status: CampaignStatus) => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Running
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Pause className="w-3 h-3 text-blue-600" />
            Paused
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <CheckCircle2 className="w-3 h-3 text-purple-600" />
            Completed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            Cancelled
          </span>
        );
      case 'draft':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3 h-3 text-slate-500" />
            Draft
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <OutreachWorkspaceNav activeTab="campaigns" onNavigate={onNavigate || onNavigateToDrafts || (() => { })} />
      {/* Top Banner with Sandbox Guard Indicator */}
      <div className="bg-gradient-to-br from-[#FFF1E6] via-[#FFF8F3] to-card rounded-2xl p-6 text-text shadow-xs border border-border">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-accent text-xs font-semibold uppercase tracking-wider">
              <Layers className="w-4 h-4 text-accent" />
              <span>Phase 2: Automated Campaign Sequencing</span>
            </div>
            <h2 className="text-xl font-bold text-text">Campaigns & Multi-Step Follow-Up Engine</h2>
            <p className="text-xs text-text-secondary max-w-2xl">
              Schedule multi-touch outreach sequences (Intro → Follow-up 1 → Follow-up 2 → Break-up).
              Enforces daily send caps, anti-spam delay jitter, and automatic reply/unsubscribe cancellation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenCreateModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover text-on-accent text-xs font-semibold rounded-xl transition-all shadow-xs shadow-accent/20 active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>New Campaign</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sandbox Guard Notification Card */}
      <div
        className={`rounded-2xl p-4 border flex items-start gap-3 text-xs shadow-2xs ${transportStatus?.sendMode === 'live'
          ? 'bg-rose-50 border-rose-200 text-rose-900'
          : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
          }`}
      >
        {transportStatus?.sendMode === 'live' ? (
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
        ) : (
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        )}
        <div className="space-y-1 flex-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm">
              {transportStatus?.sendMode === 'live'
                ? 'LIVE SENDING MODE ACTIVE'
                : 'SANDBOX SAFETY GUARD ACTIVE (SEND_MODE=sandbox)'}
            </span>
            <span
              className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider ${transportStatus?.sendMode === 'live'
                ? 'bg-rose-200 text-rose-900'
                : 'bg-emerald-200 text-emerald-900'
                }`}
            >
              {transportStatus?.sendMode || 'sandbox'}
            </span>
          </div>
          <p className="leading-relaxed text-[11px]">
            {transportStatus?.sendMode === 'live'
              ? 'Warning: Emails launched from this system will be delivered to real prospect inboxes via SMTP.'
              : `Safe Testing Protection: All outbound emails are automatically redirected to your test inbox (${transportStatus?.sandboxInbox || 'configured in .env'}). Subject lines are prefixed with [SANDBOX to: prospect@company.com]. No real client will receive emails.`}
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs animate-in fade-in duration-200 ${feedback.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : feedback.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-muted hover:text-text font-bold ml-4">
            ×
          </button>
        </div>
      )}

      {/* Sub-tab Navigation */}
      <div className="flex border-b border-border text-xs font-semibold text-text-secondary">
        <button
          onClick={() => setActiveSubTab('campaigns')}
          className={`pb-3 px-4 border-b-2 transition-colors flex items-center gap-2 ${activeSubTab === 'campaigns'
            ? 'border-accent text-accent font-bold'
            : 'border-transparent hover:text-text'
            }`}
        >
          <Layers className="w-4 h-4" />
          <span>Active Campaigns ({campaigns.length})</span>
        </button>
        <button
          onClick={() => setActiveSubTab('logs')}
          className={`pb-3 px-4 border-b-2 transition-colors flex items-center gap-2 ${activeSubTab === 'logs'
            ? 'border-accent text-accent font-bold'
            : 'border-transparent hover:text-text'
            }`}
        >
          <Mail className="w-4 h-4" />
          <span>Outreach Message Logs</span>
        </button>
      </div>

      {/* Sub-tab 1: Campaigns List */}
      {activeSubTab === 'campaigns' && (
        <div className="space-y-4">
          {loading ? (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-xs">
              <TableSkeleton rows={6} />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border p-8 shadow-xs">
              <EmptyState
                icon={Layers}
                title="No Campaigns Created Yet"
                description="Create your first multi-step outreach campaign to begin dispatching personalized emails to approved leads."
                actionLabel="Create First Campaign"
                onAction={handleOpenCreateModal}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campaigns.map((camp) => (
                <div
                  key={camp._id}
                  className="bg-card rounded-2xl border border-border p-5 shadow-xs hover:border-[#D6CEBE] hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-text text-sm">{camp.name}</h3>
                        <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">
                          {camp.description || 'No description provided.'}
                        </p>
                      </div>
                      {getStatusBadge(camp.status)}
                    </div>

                    {/* Sequence Steps Pills */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {(camp.sequence || []).map((step, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-mono bg-sidebar text-text border border-border"
                        >
                          Step {step.step}: Day +{step.dayOffset}
                        </span>
                      ))}
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 bg-sidebar p-3 rounded-xl border border-border text-center text-xs">
                      <div>
                        <div className="text-[10px] font-semibold text-muted uppercase">Enrolled</div>
                        <div className="font-bold text-text tabular-nums">{camp.stats?.totalEnrolled || 0}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-muted uppercase">Sent</div>
                        <div className="font-bold text-accent tabular-nums">{camp.stats?.sentCount || 0}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-muted uppercase">Scheduled</div>
                        <div className="font-bold text-text-secondary tabular-nums">{camp.stats?.scheduledCount || 0}</div>
                      </div>
                    </div>
                  </div>

                  {/* Action Controls */}
                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="text-[11px] text-slate-400">
                      Cap: {camp.sendingLimits?.dailyCap || 25}/day
                    </div>

                    <div className="flex items-center gap-1.5">
                      {camp.status === 'draft' && (
                        <button
                          onClick={() => handleLaunchCampaign(camp)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Launch Sequence</span>
                        </button>
                      )}

                      {camp.status === 'running' && (
                        <button
                          onClick={() => handlePauseCampaign(camp._id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold shadow-xs"
                        >
                          <Pause className="w-3.5 h-3.5" />
                          <span>Pause</span>
                        </button>
                      )}

                      {camp.status === 'paused' && (
                        <button
                          onClick={() => handleResumeCampaign(camp._id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Resume</span>
                        </button>
                      )}

                      {camp.status !== 'cancelled' && (
                        <button
                          onClick={() => handleCancelCampaign(camp._id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                          title="Cancel campaign"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sub-tab 2: Outreach Message Logs */}
      {activeSubTab === 'logs' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          {messages.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Mail}
                title="No Outreach Messages Dispatched Yet"
                description="When your campaign launches or single messages are dispatched, delivery logs, message IDs, and sandbox redirection flags will appear here."
              />
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="p-3.5">Recipient</th>
                  <th className="p-3.5">Subject</th>
                  <th className="p-3.5">Delivery Status</th>
                  <th className="p-3.5">Message ID</th>
                  <th className="p-3.5">Sent Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {messages.map((msg) => (
                  <tr key={msg._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5 font-mono text-slate-900 font-medium">
                      {msg.recipientEmail}
                      {msg.sandboxRedirected && (
                        <span className="block text-[10px] text-amber-600 font-sans mt-0.5">
                          [Sandbox Redirected]
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 max-w-sm truncate text-slate-800 font-medium">
                      {msg.subject}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${msg.status === 'sent'
                          ? 'bg-emerald-100 text-emerald-800'
                          : msg.status === 'scheduled'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-rose-100 text-rose-800'
                          }`}
                      >
                        {msg.status}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-[10px] text-slate-500 truncate max-w-xs">
                      {msg.messageId || '—'}
                    </td>
                    <td className="p-3.5 text-slate-500 text-[11px]">
                      {msg.sentAt ? new Date(msg.sentAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Multi-Step Campaign Sequence Builder Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Create Campaign & Multi-Step Sequence</h3>
                  <p className="text-xs text-slate-500">Configure sequence delay offsets and select approved contacts</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateCampaign} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Campaign Name & Description */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Campaign Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Texas Logistics Q4 AI Outreach"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Target Goal</label>
                  <input
                    type="text"
                    placeholder="e.g. Outreach sequence for freight fleet managers"
                    value={campaignDesc}
                    onChange={(e) => setCampaignDesc(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Multi-Step Sequence Configuration */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Outreach Sequence Steps ({sequenceSteps.length} Steps)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddStep}
                    className="text-xs text-indigo-600 font-semibold hover:text-indigo-800 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Follow-Up Step</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {sequenceSteps.map((step, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-4 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center shrink-0">
                          {step.step}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">
                            {step.step === 0 ? 'Step 0: Initial Outreach (Day 0)' : `Step ${step.step}: Follow-Up`}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {step.step === 0 ? 'Sends approved Gemini draft immediately upon launch' : step.subject}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-slate-500">Delay:</span>
                          <input
                            type="number"
                            min={0}
                            value={step.dayOffset}
                            disabled={step.step === 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              const updated = [...sequenceSteps];
                              updated[idx].dayOffset = val;
                              setSequenceSteps(updated);
                            }}
                            className="w-16 px-2 py-1 border border-slate-300 rounded text-center font-bold text-xs bg-white"
                          />
                          <span className="text-[11px] text-slate-500">days</span>
                        </div>

                        {step.step > 0 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveStep(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Target Contacts Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Enroll Contacts ({selectedContactIds.length} Selected of {enrolledContacts.length} Available)
                </label>
                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs bg-white">
                  {enrolledContacts.map((contact) => (
                    <div
                      key={contact._id}
                      onClick={() => {
                        if (selectedContactIds.includes(contact._id)) {
                          setSelectedContactIds(selectedContactIds.filter((id) => id !== contact._id));
                        } else {
                          setSelectedContactIds([...selectedContactIds, contact._id]);
                        }
                      }}
                      className="p-2.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedContactIds.includes(contact._id)}
                          onChange={() => { }}
                          className="rounded text-indigo-600"
                        />
                        <span className="font-semibold text-slate-800">{contact.contactName || 'General Contact'}</span>
                        <span className="text-slate-400 font-mono text-[11px]">{contact.email}</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-slate-500">{contact.outreachStatus}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sending Rules & Limits */}
              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Daily Send Cap</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={dailyCapInput}
                    onChange={(e) => setDailyCapInput(parseInt(e.target.value, 10) || 25)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Min Delay (Sec)</label>
                  <input
                    type="number"
                    min={10}
                    value={minDelayInput}
                    onChange={(e) => setMinDelayInput(parseInt(e.target.value, 10) || 60)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Max Delay (Sec)</label>
                  <input
                    type="number"
                    min={30}
                    value={maxDelayInput}
                    onChange={(e) => setMaxDelayInput(parseInt(e.target.value, 10) || 180)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 -mx-6 -mb-6 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm"
                >
                  {isSubmitting ? 'Creating...' : 'Create Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

