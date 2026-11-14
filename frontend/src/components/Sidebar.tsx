import React from 'react';
import {
  LayoutDashboard,
  Building2,
  Send,
  MessageSquare,
  Award,
  Calendar,
  Settings,
  Bot,
  Search,
  Users,
  Sparkles,
  BookmarkCheck,
  History,
  Mail,
  UserCheck,
  ShieldAlert,
  Cpu,
  ChevronDown,
  Zap,
} from 'lucide-react';

export type NavTab =
  | 'overview'
  | 'find'
  | 'companies'
  | 'decision-makers'
  | 'ai-opportunities'
  | 'saved'
  | 'history'
  | 'settings'
  | 'lead-management'
  | 'email-drafts'
  | 'campaigns'
  | 'inbox'
  | 'cybells-settings'
  | 'suppression-list'
  | 'qualifications'
  | 'meetings';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  savedCount?: number;
}

export type WorkspaceId =
  | 'overview'
  | 'leads'
  | 'outreach'
  | 'inbox'
  | 'qualifications'
  | 'meetings'
  | 'settings';

export const getWorkspaceForTab = (tab: NavTab): WorkspaceId => {
  switch (tab) {
    case 'overview':
      return 'overview';
    case 'find':
    case 'companies':
    case 'decision-makers':
    case 'ai-opportunities':
    case 'saved':
    case 'history':
      return 'leads';
    case 'campaigns':
    case 'email-drafts':
    case 'lead-management':
      return 'outreach';
    case 'inbox':
      return 'inbox';
    case 'qualifications':
      return 'qualifications';
    case 'meetings':
      return 'meetings';
    case 'settings':
    case 'cybells-settings':
    case 'suppression-list':
      return 'settings';
    default:
      return 'overview';
  }
};

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  savedCount = 0,
}) => {
  const currentWorkspace = getWorkspaceForTab(activeTab);

  const workspaces: {
    id: WorkspaceId;
    defaultTab: NavTab;
    label: string;
    icon: React.ElementType;
    badge?: number;
    subItems?: { id: NavTab; label: string; icon: React.ElementType; badge?: number }[];
  }[] = [
    {
      id: 'overview',
      defaultTab: 'overview',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'leads',
      defaultTab: 'companies',
      label: 'Find Customers',
      icon: Search,
      badge: savedCount,
      subItems: [
        { id: 'find', label: 'Discover Leads 📍', icon: Search },
        { id: 'companies', label: 'All Companies', icon: Building2 },
        { id: 'decision-makers', label: 'Decision Makers', icon: Users },
        { id: 'ai-opportunities', label: 'AI Opportunities', icon: Sparkles },
        { id: 'saved', label: 'Saved Leads', icon: BookmarkCheck, badge: savedCount },
        { id: 'history', label: 'Search History', icon: History },
      ],
    },
    {
      id: 'outreach',
      defaultTab: 'campaigns',
      label: 'Campaigns & Engage',
      icon: Send,
      subItems: [
        { id: 'campaigns', label: 'Sequences & Engine', icon: Send },
        { id: 'email-drafts', label: 'Review Drafts', icon: Mail },
        { id: 'lead-management', label: 'Lead Enrollment', icon: UserCheck },
      ],
    },
    {
      id: 'inbox',
      defaultTab: 'inbox',
      label: 'Inbox & Sentiment',
      icon: MessageSquare,
    },
    {
      id: 'qualifications',
      defaultTab: 'qualifications',
      label: 'Qualify & Pipeline',
      icon: Award,
    },
    {
      id: 'meetings',
      defaultTab: 'meetings',
      label: 'Sales Meetings',
      icon: Calendar,
    },
  ];

  const configWorkspace = {
    id: 'settings' as WorkspaceId,
    defaultTab: 'settings' as NavTab,
    label: 'Settings & Agency KB',
    icon: Settings,
    subItems: [
      { id: 'settings' as NavTab, label: 'System & Scrapers', icon: Settings },
      { id: 'cybells-settings' as NavTab, label: 'Agency Knowledge Base', icon: Cpu },
      { id: 'suppression-list' as NavTab, label: 'Suppression Registry', icon: ShieldAlert },
    ],
  };

  return (
    <aside className="w-[225px] bg-sidebar text-text-secondary flex flex-col shrink-0 h-screen border-r border-border select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-border flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-accent text-white flex items-center justify-center shadow-sm shadow-accent/25 shrink-0">
          <Bot size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm text-text tracking-tight leading-none truncate">
            Cybells AI
          </div>
          <div className="text-[10px] text-accent font-semibold tracking-wider uppercase mt-1 truncate">
            Autonomous SDR
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2.5 space-y-1 overflow-y-auto">
        <div className="text-[10px] font-bold text-muted uppercase tracking-wider px-2.5 py-1">
          Workspaces
        </div>

        {workspaces.map((ws) => {
          const Icon = ws.icon;
          const isWsActive = currentWorkspace === ws.id;

          return (
            <div key={ws.id} className="space-y-0.5">
              <button
                type="button"
                onClick={() => onSelectTab(ws.defaultTab)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isWsActive
                    ? 'bg-accent text-on-accent font-semibold shadow-sm shadow-accent/20'
                    : 'text-text-secondary hover:text-text hover:bg-black/[0.03]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    size={16}
                    className={isWsActive ? 'text-on-accent' : 'text-muted'}
                  />
                  <span className="truncate">{ws.label}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {ws.badge !== undefined && ws.badge > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                        isWsActive
                          ? 'bg-white/20 text-on-accent'
                          : 'bg-black/[0.04] text-text-secondary'
                      }`}
                    >
                      {ws.badge}
                    </span>
                  )}
                  {ws.subItems && (
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-200 ${
                        isWsActive ? 'rotate-180 text-on-accent/80' : 'text-muted'
                      }`}
                    />
                  )}
                </div>
              </button>

              {/* Sub-items list (When workspace is active) */}
              {isWsActive && ws.subItems && (
                <div className="pl-4 pr-1 py-1 space-y-0.5 border-l border-border/80 ml-3.5 animate-fade-in">
                  {ws.subItems.map((sub) => {
                    const SubIcon = sub.icon;
                    const isSubActive = activeTab === sub.id;

                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => onSelectTab(sub.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          isSubActive
                            ? 'bg-card text-accent font-bold border border-border shadow-2xs'
                            : 'text-text-secondary hover:text-text hover:bg-black/[0.02]'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <SubIcon
                            size={14}
                            className={isSubActive ? 'text-accent' : 'text-muted'}
                          />
                          <span className="truncate">{sub.label}</span>
                        </div>
                        {sub.badge !== undefined && sub.badge > 0 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-[#EEE8DF] text-text-secondary">
                            {sub.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div className="pt-3">
          <div className="text-[10px] font-bold text-muted uppercase tracking-wider px-2.5 py-1">
            System
          </div>
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => onSelectTab(configWorkspace.defaultTab)}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                currentWorkspace === 'settings'
                  ? 'bg-accent text-on-accent font-semibold shadow-sm shadow-accent/20'
                  : 'text-text-secondary hover:text-text hover:bg-black/[0.03]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Settings
                  size={16}
                  className={currentWorkspace === 'settings' ? 'text-on-accent' : 'text-muted'}
                />
                <span className="truncate">{configWorkspace.label}</span>
              </div>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${
                  currentWorkspace === 'settings' ? 'rotate-180 text-on-accent/80' : 'text-muted'
                }`}
              />
            </button>

            {currentWorkspace === 'settings' && (
              <div className="pl-4 pr-1 py-1 space-y-0.5 border-l border-border/80 ml-3.5 animate-fade-in">
                {configWorkspace.subItems.map((sub) => {
                  const SubIcon = sub.icon;
                  const isSubActive = activeTab === sub.id;

                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => onSelectTab(sub.id)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        isSubActive
                          ? 'bg-card text-accent font-bold border border-border shadow-2xs'
                          : 'text-text-secondary hover:text-text hover:bg-black/[0.02]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <SubIcon
                          size={14}
                          className={isSubActive ? 'text-accent' : 'text-muted'}
                        />
                        <span className="truncate">{sub.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Footer Status Pill */}
      <div className="p-3 border-t border-border bg-card/60">
        <div className="p-2 rounded-xl bg-card border border-border shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="font-semibold text-text">SDR Engine</span>
            </div>
            <span className="text-[10px] text-accent font-semibold font-mono bg-accent-soft px-1.5 py-0.2 rounded border border-accent/20">
              Active
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-text-secondary">
            <Zap size={11} className="text-accent" />
            <span>Google Maps 📍 Connected</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
