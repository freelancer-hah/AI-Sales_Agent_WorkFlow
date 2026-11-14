import React from 'react';
import { Sidebar, NavTab } from '../components/Sidebar';
import { Navbar } from '../components/Navbar';

interface DashboardLayoutProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  dbConnected: boolean;
  geminiConfigured: boolean;
  savedCount?: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  activeTab,
  onSelectTab,
  dbConnected,
  geminiConfigured,
  savedCount = 0,
  onRefresh,
  isRefreshing,
  children,
}) => {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg text-text font-sans antialiased">
      {/* Fixed Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={onSelectTab}
        savedCount={savedCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Navbar
          activeTab={activeTab}
          onNavigate={onSelectTab}
          dbConnected={dbConnected}
          geminiConfigured={geminiConfigured}
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
        />

        <main className="flex-1 p-5 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-[1600px] mx-auto w-full animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

