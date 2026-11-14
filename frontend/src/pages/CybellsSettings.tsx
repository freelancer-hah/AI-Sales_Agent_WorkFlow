import React, { useState, useEffect } from 'react';
import {
  Settings,
  ShieldCheck,
  Building2,
  Sparkles,
  Award,
  HelpCircle,
  Clock,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Server,
  Lock,
} from 'lucide-react';
import { api } from '../services/api';
import {
  ICybellsConfig,
  ICybellsCapability,
  ICybellsCaseStudy,
  ICybellsFAQ,
  ITransportStatus,
} from '../types';
import { SettingsWorkspaceNav } from '../components/WorkspaceNav';
import { NavTab } from '../components/Sidebar';

export const CybellsSettings: React.FC<{ onNavigate?: (tab: NavTab) => void }> = ({ onNavigate }) => {
  const [config, setConfig] = useState<ICybellsConfig | null>(null);
  const [transportStatus, setTransportStatus] = useState<ITransportStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'capabilities' | 'cases' | 'faqs' | 'rules'>('profile');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await api.getCybellsConfig();
      if (res.success) {
        setConfig(res.data);
        setTransportStatus(res.transportStatus);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load Cybells configuration' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await api.updateCybellsConfig(config);
      if (res.success) {
        setConfig(res.data);
        setFeedback({ type: 'success', message: 'Cybells Knowledge Base and Outreach Settings saved successfully!' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save configuration' });
    } finally {
      setSaving(false);
    }
  };

  // Capabilities Helpers
  const addCapability = () => {
    if (!config) return;
    const newCap: ICybellsCapability = {
      id: `cap-${Date.now()}`,
      title: '',
      description: '',
      typicalUseCases: [],
    };
    setConfig({ ...config, capabilities: [...config.capabilities, newCap] });
  };

  const removeCapability = (index: number) => {
    if (!config) return;
    const updated = [...config.capabilities];
    updated.splice(index, 1);
    setConfig({ ...config, capabilities: updated });
  };

  // Case Studies Helpers
  const addCaseStudy = () => {
    if (!config) return;
    const newCS: ICybellsCaseStudy = {
      id: `cs-${Date.now()}`,
      title: '',
      clientIndustry: '',
      problemSolved: '',
      metricOrResult: '',
      verified: true,
    };
    setConfig({ ...config, caseStudies: [...config.caseStudies, newCS] });
  };

  const removeCaseStudy = (index: number) => {
    if (!config) return;
    const updated = [...config.caseStudies];
    updated.splice(index, 1);
    setConfig({ ...config, caseStudies: updated });
  };

  // FAQ Helpers
  const addFAQ = () => {
    if (!config) return;
    setConfig({
      ...config,
      faqs: [...config.faqs, { question: '', answer: '' }],
    });
  };

  const removeFAQ = (index: number) => {
    if (!config) return;
    const updated = [...config.faqs];
    updated.splice(index, 1);
    setConfig({ ...config, faqs: updated });
  };

  if (loading || !config) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs">
        Loading Cybells Agency Knowledge Base...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <SettingsWorkspaceNav activeTab="cybells-settings" onNavigate={onNavigate || (() => {})} />
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-sm border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
            <Settings className="w-4 h-4" />
            <span>Phase 2: Outreach & Agency Engine</span>
          </div>
          <h2 className="text-xl font-bold">Cybells Knowledge Base & Rules</h2>
          <p className="text-xs text-slate-300 max-w-xl">
            Configure Cybells' agency profile, real AI automation capabilities, verified case studies,
            and compliance rules. Gemini strictly grounds outreach emails and inquiry answers in this data.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-on-accent rounded-xl text-xs font-semibold transition-all shadow-xs shadow-accent/20 shrink-0 active:scale-98"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save Knowledge Base'}</span>
        </button>
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
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-muted hover:text-text font-bold ml-4">
            ×
          </button>
        </div>
      )}

      {/* Transport Status Diagnostic Banner */}
      {transportStatus && (
        <div className="bg-card rounded-2xl border border-border p-4 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border">
            <div className="flex items-center gap-2 text-xs font-semibold text-text">
              <Server className="w-4 h-4 text-accent" />
              <span>Email Transport Environment Status</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                  transportStatus.sendMode === 'live'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                Mode: {transportStatus.sendMode.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 text-xs">
            <div>
              <span className="text-muted block text-[11px]">Outbound Routing</span>
              <span className="font-mono text-text">
                {transportStatus.sendMode === 'sandbox'
                  ? `Sandbox (${transportStatus.sandboxInbox})`
                  : 'Live Prospect Inboxes'}
              </span>
            </div>
            <div>
              <span className="text-muted block text-[11px]">SMTP Provider</span>
              <span className="text-text">
                {transportStatus.smtpHost}:{transportStatus.smtpPort}{' '}
                {transportStatus.smtpConfigured ? '✓ Configured' : '⚠ Missing in .env'}
              </span>
            </div>
            <div>
              <span className="text-muted block text-[11px]">IMAP Reply Listener</span>
              <span className="text-text">
                {transportStatus.imapHost}:{transportStatus.imapPort}{' '}
                {transportStatus.imapConfigured ? '✓ Configured' : '⚠ Missing in .env'}
              </span>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-border flex items-center gap-1.5 text-[11px] text-text-secondary">
            <Lock className="w-3.5 h-3.5 text-muted" />
            <span>Credentials are strictly loaded from backend environment variables and are never sent to the browser.</span>
          </div>
        </div>
      )}

      {/* Tabs Header */}
      <div className="flex items-center gap-2 border-b border-border text-xs overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all ${
            activeTab === 'profile'
              ? 'bg-accent text-on-accent shadow-xs shadow-accent/20'
              : 'text-text-secondary hover:text-text hover:bg-card-hover'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Agency Profile & Voice</span>
        </button>

        <button
          onClick={() => setActiveTab('capabilities')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all ${
            activeTab === 'capabilities'
              ? 'bg-accent text-on-accent shadow-xs shadow-accent/20'
              : 'text-text-secondary hover:text-text hover:bg-card-hover'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>AI Capabilities ({config.capabilities.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('cases')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all ${
            activeTab === 'cases'
              ? 'bg-accent text-on-accent shadow-xs shadow-accent/20'
              : 'text-text-secondary hover:text-text hover:bg-card-hover'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Verified Case Studies ({config.caseStudies.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('faqs')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all ${
            activeTab === 'faqs'
              ? 'bg-accent text-on-accent shadow-xs shadow-accent/20'
              : 'text-text-secondary hover:text-text hover:bg-card-hover'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>Inquiry FAQs ({config.faqs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-all ${
            activeTab === 'rules'
              ? 'bg-accent text-on-accent shadow-xs shadow-accent/20'
              : 'text-text-secondary hover:text-text hover:bg-card-hover'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Sending Rules & Compliance</span>
        </button>
      </div>

      {/* TAB 1: Profile & Voice */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-xs text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-800 mb-1">Agency Name</label>
              <input
                type="text"
                value={config.agencyName}
                onChange={(e) => setConfig({ ...config, agencyName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-800 mb-1">Brand Voice</label>
              <input
                type="text"
                value={config.brandVoice}
                onChange={(e) => setConfig({ ...config, brandVoice: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. Consultative, direct, technical peer-to-peer"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1">Mission Statement</label>
            <textarea
              rows={2}
              value={config.mission}
              onChange={(e) => setConfig({ ...config, mission: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500"
              placeholder="What core business transformation does Cybells deliver for B2B companies?"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1">Target Audience Profile</label>
            <textarea
              rows={2}
              value={config.targetAudience}
              onChange={(e) => setConfig({ ...config, targetAudience: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. Mid-market software, healthcare, logistics, and manufacturing firms with 20–500 employees"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1">Security & Privacy Assurance</label>
            <input
              type="text"
              value={config.securityPrivacyStatement}
              onChange={(e) => setConfig({ ...config, securityPrivacyStatement: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      )}

      {/* TAB 2: Capabilities Matrix */}
      {activeTab === 'capabilities' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Only capabilities listed here will be referenced in outbound emails and inquiry responses.
            </p>
            <button
              onClick={addCapability}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Capability</span>
            </button>
          </div>

          {config.capabilities.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-400 space-y-2">
              <Sparkles className="w-6 h-6 mx-auto text-slate-300" />
              <p>No capabilities added yet. Knowledge base starts empty per Golden Rule 2.</p>
              <button
                onClick={addCapability}
                className="text-indigo-600 hover:underline font-semibold"
              >
                + Add your first AI Capability
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {config.capabilities.map((cap, idx) => (
                <div key={idx} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Capability #{idx + 1}</span>
                    <button
                      onClick={() => removeCapability(idx)}
                      className="text-rose-500 hover:text-rose-700 p-1 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Capability Title (e.g. Intelligent Document Processing)"
                      value={cap.title}
                      onChange={(e) => {
                        const copy = [...config.capabilities];
                        copy[idx].title = e.target.value;
                        setConfig({ ...config, capabilities: copy });
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Comma-separated use cases (e.g. Invoice matching, Freight bills)"
                      value={cap.typicalUseCases.join(', ')}
                      onChange={(e) => {
                        const copy = [...config.capabilities];
                        copy[idx].typicalUseCases = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                        setConfig({ ...config, capabilities: copy });
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                    />
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Detailed Description of how Cybells delivers this solution..."
                    value={cap.description}
                    onChange={(e) => {
                      const copy = [...config.capabilities];
                      copy[idx].description = e.target.value;
                      setConfig({ ...config, capabilities: copy });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Case Studies & Proof Points */}
      {activeTab === 'cases' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Only user-entered, verified case studies will be referenced by Gemini. No fabricated client metrics.
            </p>
            <button
              onClick={addCaseStudy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Proof Point</span>
            </button>
          </div>

          {config.caseStudies.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-400 space-y-2">
              <Award className="w-6 h-6 mx-auto text-slate-300" />
              <p>No case studies entered yet. Emails will pitch capabilities directly without inventing metrics.</p>
              <button onClick={addCaseStudy} className="text-indigo-600 hover:underline font-semibold">
                + Add a real case study
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {config.caseStudies.map((cs, idx) => (
                <div key={idx} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Proof Point #{idx + 1}</span>
                    <button
                      onClick={() => removeCaseStudy(idx)}
                      className="text-rose-500 hover:text-rose-700 p-1 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Title (e.g. Automated Onboarding Pipeline)"
                      value={cs.title}
                      onChange={(e) => {
                        const copy = [...config.caseStudies];
                        copy[idx].title = e.target.value;
                        setConfig({ ...config, caseStudies: copy });
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Client Industry (e.g. Logistics, Healthcare)"
                      value={cs.clientIndustry}
                      onChange={(e) => {
                        const copy = [...config.caseStudies];
                        copy[idx].clientIndustry = e.target.value;
                        setConfig({ ...config, caseStudies: copy });
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Problem Solved (e.g. 48-hour invoice reconciliation backlog)"
                      value={cs.problemSolved}
                      onChange={(e) => {
                        const copy = [...config.caseStudies];
                        copy[idx].problemSolved = e.target.value;
                        setConfig({ ...config, caseStudies: copy });
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Result / Metric (e.g. 70% reduction in processing time)"
                      value={cs.metricOrResult}
                      onChange={(e) => {
                        const copy = [...config.caseStudies];
                        copy[idx].metricOrResult = e.target.value;
                        setConfig({ ...config, caseStudies: copy });
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                    />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={cs.verified}
                      onChange={(e) => {
                        const copy = [...config.caseStudies];
                        copy[idx].verified = e.target.checked;
                        setConfig({ ...config, caseStudies: copy });
                      }}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-semibold text-slate-700">Verified & Approved for AI Outreach</span>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: FAQs */}
      {activeTab === 'faqs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              FAQs used by the website inquiry assistant and for drafting grounded reply suggestions.
            </p>
            <button
              onClick={addFAQ}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add FAQ</span>
            </button>
          </div>

          {config.faqs.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-400 space-y-2">
              <HelpCircle className="w-6 h-6 mx-auto text-slate-300" />
              <p>No FAQs entered yet.</p>
              <button onClick={addFAQ} className="text-indigo-600 hover:underline font-semibold">
                + Add common prospect questions & answers
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {config.faqs.map((faq, idx) => (
                <div key={idx} className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 shadow-2xs text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">FAQ #{idx + 1}</span>
                    <button
                      onClick={() => removeFAQ(idx)}
                      className="text-rose-500 hover:text-rose-700 p-1 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="Question (e.g. How does Cybells integrate with our CRM?)"
                    value={faq.question}
                    onChange={(e) => {
                      const copy = [...config.faqs];
                      copy[idx].question = e.target.value;
                      setConfig({ ...config, faqs: copy });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
                  />
                  <textarea
                    rows={2}
                    placeholder="Answer grounded in Cybells engineering reality..."
                    value={faq.answer}
                    onChange={(e) => {
                      const copy = [...config.faqs];
                      copy[idx].answer = e.target.value;
                      setConfig({ ...config, faqs: copy });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: Sending Rules & Compliance */}
      {activeTab === 'rules' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-xs text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-800 mb-1">Daily Send Cap (Emails/Day)</label>
              <input
                type="number"
                min="5"
                max="100"
                value={config.sendingRules.dailyCap}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    sendingRules: { ...config.sendingRules, dailyCap: parseInt(e.target.value, 10) || 25 },
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Recommended conservative start: 20–30</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-800 mb-1">Min Delay (Seconds)</label>
              <input
                type="number"
                min="15"
                max="300"
                value={config.sendingRules.minDelaySeconds}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    sendingRules: { ...config.sendingRules, minDelaySeconds: parseInt(e.target.value, 10) || 60 },
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-800 mb-1">Max Delay (Seconds)</label>
              <input
                type="number"
                min="30"
                max="600"
                value={config.sendingRules.maxDelaySeconds}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    sendingRules: { ...config.sendingRules, maxDelaySeconds: parseInt(e.target.value, 10) || 180 },
                  })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-800 mb-1">Sender Display Name</label>
              <input
                type="text"
                value={config.senderName}
                onChange={(e) => setConfig({ ...config, senderName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-800 mb-1">Physical Postal Address (CAN-SPAM)</label>
              <input
                type="text"
                value={config.postalAddress}
                onChange={(e) => setConfig({ ...config, postalAddress: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1">Email Signature</label>
            <textarea
              rows={3}
              value={config.signature}
              onChange={(e) => setConfig({ ...config, signature: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-800 mb-1">Opt-Out / Unsubscribe Footer Text</label>
            <textarea
              rows={2}
              value={config.optOutText}
              onChange={(e) => setConfig({ ...config, optOutText: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
};

