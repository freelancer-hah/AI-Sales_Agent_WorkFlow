import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Sparkles,
  Database,
  Globe,
  Search,
  Server,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';
import { Badge } from '../components/Badge';
import { SettingsWorkspaceNav } from '../components/WorkspaceNav';
import { NavTab } from '../components/Sidebar';

export const Settings: React.FC<{ onNavigate?: (tab: NavTab) => void }> = ({ onNavigate }) => {
  const [integrations, setIntegrations] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [intRes, setRes] = await Promise.all([
        api.getIntegrations(),
        api.getSettings(),
      ]);
      if (intRes.success) setIntegrations(intRes.data);
      if (setRes.success) setSettings(setRes.data);
    } catch {
      // Degraded / offline state fallback
    } finally {
      setLoading(false);
    }
  };

  const isGeminiReady = integrations?.gemini?.status === 'configured';
  const isMongoReady = integrations?.mongodb?.status === 'connected';

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <SettingsWorkspaceNav activeTab="settings" onNavigate={onNavigate || (() => {})} />
      {/* Settings Header */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-xs flex items-center justify-between">
        <div>
          <h3 className="font-bold text-text text-base">System Configuration & Integrations</h3>
          <p className="text-xs text-text-secondary">Service connectivity, environment variables, and zero-paid API health</p>
        </div>
        <button
          onClick={loadSettings}
          className="p-2 border border-border hover:bg-card-hover rounded-xl text-text-secondary hover:text-text transition-colors shadow-2xs"
          title="Refresh integration status"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Google Gemini AI */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-xs hover:border-[#D6CEBE] hover:shadow-md transition-all space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-accent-soft text-accent">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-text text-sm">Google Gemini AI</h4>
                <p className="text-[11px] text-text-secondary">Official @google/genai SDK</p>
              </div>
            </div>
            <Badge size="sm" variant={isGeminiReady ? 'success' : 'warning'}>
              {isGeminiReady ? 'Configured' : 'Missing Key'}
            </Badge>
          </div>

          <p className="text-xs text-text-secondary">
            Powers company automation analysis, business problem hypothesis generation, and explainable lead scores.
          </p>

          <div className="bg-sidebar p-3 rounded-xl border border-border text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted">Model:</span>
              <span className="font-mono text-text font-medium">
                {settings?.gemini?.model || 'gemini-2.5-flash'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Key Status:</span>
              <span className="font-mono text-text">
                {settings?.gemini?.apiKeyMasked || 'Not set in backend/.env'}
              </span>
            </div>
          </div>
        </div>

        {/* MongoDB Database */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-xs hover:border-[#D6CEBE] hover:shadow-md transition-all space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-text text-sm">MongoDB Database</h4>
                <p className="text-[11px] text-text-secondary">Community Edition / Atlas</p>
              </div>
            </div>
            <Badge size="sm" variant={isMongoReady ? 'success' : 'warning'}>
              {isMongoReady ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>

          <p className="text-xs text-text-secondary">
            Stores companies, decision makers, research jobs, and full provenance source links.
          </p>

          <div className="bg-sidebar p-3 rounded-xl border border-border text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted">Target Host:</span>
              <span className="font-mono text-text">{integrations?.mongodb?.host || 'localhost:27017'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Database Name:</span>
              <span className="font-mono text-text">{integrations?.mongodb?.dbName || 'sales_agent'}</span>
            </div>
          </div>
        </div>

        {/* OpenStreetMap / Overpass API */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-xs hover:border-[#D6CEBE] hover:shadow-md transition-all space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-sky-50 text-sky-700 border border-sky-200">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-text text-sm">OpenStreetMap Overpass</h4>
                <p className="text-[11px] text-text-secondary">Free Public Geographic Discovery</p>
              </div>
            </div>
            <Badge size="sm" variant="success">Active</Badge>
          </div>

          <p className="text-xs text-text-secondary">
            Queries global commercial business tags, websites, phone numbers, and coordinates without paid APIs.
          </p>

          <div className="bg-sidebar p-3 rounded-xl border border-border text-xs truncate font-mono text-text">
            {settings?.sources?.overpassUrl || 'https://overpass-api.de/api/interpreter'}
          </div>
        </div>

        {/* SearXNG Self-Hosted Meta-Search */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-xs hover:border-[#D6CEBE] hover:shadow-md transition-all space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-accent-soft text-accent border border-accent/20">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-text text-sm">SearXNG Meta-Search</h4>
                <p className="text-[11px] text-text-secondary">Free Open-Source Web Search</p>
              </div>
            </div>
            <Badge size="sm" variant="info">Configured</Badge>
          </div>

          <p className="text-xs text-text-secondary">
            Finds official company domains, leadership pages, and public profile listings cleanly.
          </p>

          <div className="bg-sidebar p-3 rounded-xl border border-border text-xs truncate font-mono text-text">
            {settings?.sources?.searxngUrl || 'http://localhost:8080'}
          </div>
        </div>
      </div>

      {/* Security & Zero Paid Dependencies Notice */}
      <div className="bg-card text-text rounded-2xl p-6 space-y-3 border border-border shadow-xs">
        <div className="flex items-center gap-2 text-accent font-semibold text-xs uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4 text-accent" />
          <span>Zero Paid Dependency Architecture</span>
        </div>
        <p className="text-xs text-text-secondary leading-relaxed">
          This system strictly operates without paid SaaS APIs (no Firecrawl, Apollo, Hunter, or OpenAI).
          All web intelligence is sourced from OpenStreetMap, SearXNG, self-hosted Crawl4AI / BeautifulSoup,
          and your provided Google Gemini API key.
        </p>
      </div>
    </div>
  );
};
