import React from 'react';
import {
  Search,
  Building2,
  Users,
  Sparkles,
  BookmarkCheck,
  History,
  Send,
  Mail,
  UserCheck,
  Settings,
  Cpu,
  ShieldAlert,
} from 'lucide-react';
import { NavTab } from './Sidebar';

interface WorkspaceNavProps {
  activeTab: NavTab;
  onNavigate: (tab: NavTab) => void;
  savedCount?: number;
}

export const LeadWorkspaceNav: React.FC<WorkspaceNavProps> = ({
  activeTab,
  onNavigate,
  savedCount = 0,
}) => {
  const tabs = [
    { id: 'find' as NavTab, label: 'Discover Leads 📍', icon: Search },
    { id: 'companies' as NavTab, label: 'All Companies', icon: Building2 },
    { id: 'decision-makers' as NavTab, label: 'Decision Makers', icon: Users },
    { id: 'ai-opportunities' as NavTab, label: 'AI Opportunities', icon: Sparkles },
    { id: 'saved' as NavTab, label: 'Saved Leads', icon: BookmarkCheck, badge: savedCount },
    { id: 'history' as NavTab, label: 'Search History', icon: History },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1 p-1 bg-track/70 rounded-xl w-fit text-xs font-semibold mb-6 border border-border shadow-xs">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onNavigate(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              isActive
                ? 'bg-card text-accent shadow-xs font-bold border border-border'
                : 'text-text-secondary hover:text-text hover:bg-card/60'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-accent' : 'text-muted'}`} />
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold font-mono ${
                isActive ? 'bg-accent-soft text-accent' : 'bg-card text-text-secondary border border-border'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export const OutreachWorkspaceNav: React.FC<WorkspaceNavProps> = ({
  activeTab,
  onNavigate,
}) => {
  const tabs = [
    { id: 'campaigns' as NavTab, label: 'Campaign Sequences', icon: Send },
    { id: 'email-drafts' as NavTab, label: 'Review Drafts & Queue', icon: Mail },
    { id: 'lead-management' as NavTab, label: 'Lead Enrollment', icon: UserCheck },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1 p-1 bg-track/70 rounded-xl w-fit text-xs font-semibold mb-6 border border-border shadow-xs">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onNavigate(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              isActive
                ? 'bg-card text-accent shadow-xs font-bold border border-border'
                : 'text-text-secondary hover:text-text hover:bg-card/60'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-accent' : 'text-muted'}`} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export const SettingsWorkspaceNav: React.FC<WorkspaceNavProps> = ({
  activeTab,
  onNavigate,
}) => {
  const tabs = [
    { id: 'settings' as NavTab, label: 'System & Scraper Config', icon: Settings },
    { id: 'cybells-settings' as NavTab, label: 'Cybells Agency Knowledge Base', icon: Cpu },
    { id: 'suppression-list' as NavTab, label: 'Suppression Registry', icon: ShieldAlert },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1 p-1 bg-track/70 rounded-xl w-fit text-xs font-semibold mb-6 border border-border shadow-xs">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onNavigate(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              isActive
                ? 'bg-card text-accent shadow-xs font-bold border border-border'
                : 'text-text-secondary hover:text-text hover:bg-card/60'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-accent' : 'text-muted'}`} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};

