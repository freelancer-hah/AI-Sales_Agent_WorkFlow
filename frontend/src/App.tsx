import React, { useState, useEffect } from 'react';
import { DashboardLayout } from './layouts/DashboardLayout';
import { NavTab } from './components/Sidebar';
import { Overview } from './pages/Overview';
import { FindCompanies } from './pages/FindCompanies';
import { AllCompanies } from './pages/AllCompanies';
import { DecisionMakers } from './pages/DecisionMakers';
import { AIOpportunities } from './pages/AIOpportunities';
import { SavedLeads } from './pages/SavedLeads';
import { SearchHistory } from './pages/SearchHistory';
import { Settings } from './pages/Settings';
import { LeadManagement } from './pages/LeadManagement';
import { EmailDrafts } from './pages/EmailDrafts';
import { Campaigns } from './pages/Campaigns';
import { Inbox } from './pages/Inbox';
import { CybellsSettings } from './pages/CybellsSettings';
import { SuppressionList } from './pages/SuppressionList';
import { QualificationDashboard } from './pages/QualificationDashboard';
import { MeetingsHub } from './pages/MeetingsHub';
import { api } from './services/api';
import { ICompany } from './types';

export function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [dbConnected, setDbConnected] = useState(false);
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  useEffect(() => {
    checkHealth();
    loadSavedCount();
  }, [activeTab]);

  const checkHealth = async () => {
    try {
      const [health, settings] = await Promise.all([
        api.getHealth().catch(() => null),
        api.getSettings().catch(() => null),
      ]);

      if (health?.database?.status === 'connected') {
        setDbConnected(true);
      } else {
        setDbConnected(false);
      }

      if (settings?.data?.gemini?.configured) {
        setGeminiConfigured(true);
      } else {
        setGeminiConfigured(false);
      }
    } catch {
      setDbConnected(false);
      setGeminiConfigured(false);
    }
  };

  const loadSavedCount = async () => {
    try {
      const res = await api.getCompanies({ isSaved: true, limit: 1 });
      if (res.success) {
        setSavedCount(res.data.pagination.total);
      }
    } catch {
      // Ignored if DB offline
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await checkHealth();
    await loadSavedCount();
    setIsRefreshing(false);
  };

  const handleSelectCompanyFromOverview = (company: ICompany) => {
    setSelectedCompanyId(company._id);
    setActiveTab('companies');
  };

  return (
    <DashboardLayout
      activeTab={activeTab}
      onSelectTab={(tab) => {
        setSelectedCompanyId(null);
        setActiveTab(tab);
      }}
      dbConnected={dbConnected}
      geminiConfigured={geminiConfigured}
      savedCount={savedCount}
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
    >
      {activeTab === 'overview' && (
        <Overview
          onNavigate={setActiveTab}
          onSelectCompany={handleSelectCompanyFromOverview}
        />
      )}

      {activeTab === 'find' && (
        <FindCompanies
          onNavigate={setActiveTab}
          onJobStarted={() => {
            // Can switch or show feedback
          }}
        />
      )}

      {activeTab === 'companies' && (
        <AllCompanies
          onNavigateToFind={() => setActiveTab('find')}
          selectedCompanyId={selectedCompanyId}
          onNavigate={setActiveTab}
        />
      )}

      {activeTab === 'decision-makers' && (
        <DecisionMakers onNavigateToFind={() => setActiveTab('find')} onNavigate={setActiveTab} />
      )}

      {activeTab === 'ai-opportunities' && (
        <AIOpportunities onNavigateToFind={() => setActiveTab('find')} onNavigate={setActiveTab} />
      )}

      {activeTab === 'saved' && (
        <SavedLeads onNavigateToFind={() => setActiveTab('find')} onNavigate={setActiveTab} />
      )}

      {activeTab === 'history' && (
        <SearchHistory
          onNavigateToFind={() => setActiveTab('find')}
          onNavigateToCompanies={() => setActiveTab('companies')}
          onNavigate={setActiveTab}
        />
      )}

      {activeTab === 'settings' && <Settings onNavigate={setActiveTab} />}

      {activeTab === 'lead-management' && (
        <LeadManagement
          onNavigateToFind={() => setActiveTab('find')}
          onNavigateToDrafts={() => setActiveTab('email-drafts')}
          onNavigate={setActiveTab}
        />
      )}

      {activeTab === 'email-drafts' && (
        <EmailDrafts onNavigateToLeads={() => setActiveTab('lead-management')} onNavigate={setActiveTab} />
      )}

      {activeTab === 'campaigns' && (
        <Campaigns
          onNavigateToDrafts={() => setActiveTab('email-drafts')}
          onNavigateToLeads={() => setActiveTab('lead-management')}
          onNavigate={setActiveTab}
        />
      )}

      {activeTab === 'inbox' && (
        <Inbox
          onNavigateToLeads={() => setActiveTab('lead-management')}
          onNavigateToQualifications={() => setActiveTab('qualifications')}
          onNavigateToMeetings={() => setActiveTab('meetings')}
        />
      )}

      {activeTab === 'cybells-settings' && <CybellsSettings onNavigate={setActiveTab} />}

      {activeTab === 'suppression-list' && <SuppressionList onNavigate={setActiveTab} />}

      {activeTab === 'qualifications' && (
        <QualificationDashboard onNavigateToMeetings={() => setActiveTab('meetings')} />
      )}

      {activeTab === 'meetings' && <MeetingsHub />}
    </DashboardLayout>
  );
}

export default App;

