'use client';

import { useState } from 'react';
import { useUnifiedDashboard } from '@/hooks/useUnifiedDashboard';
import { SystemStatusBar } from '@/components/unified/SystemStatusBar';
import { KpiCards } from '@/components/unified/KpiCards';
import { AgentGrid } from '@/components/unified/AgentGrid';
import { ModuleSummaries } from '@/components/unified/ModuleSummaries';
import { UnifiedCharts } from '@/components/unified/UnifiedCharts';
import { CommandTab } from '@/components/unified/tabs/CommandTab';
import { ContentTab } from '@/components/unified/tabs/ContentTab';
import { GrowthTab } from '@/components/unified/tabs/GrowthTab';
import { LeadsTab } from '@/components/unified/tabs/LeadsTab';
import { StrategicTab } from '@/components/unified/tabs/StrategicTab';
import { OperationsTab } from '@/components/unified/tabs/OperationsTab';
import { Loading } from '@/components/ui/loading';
import {
  LayoutDashboard, Terminal, FileText, TrendingUp, Users,
  Target, Settings,
} from 'lucide-react';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'command', label: 'Command', icon: Terminal },
  { id: 'content', label: 'Content', icon: FileText },
  { id: 'growth', label: 'Growth', icon: TrendingUp },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'strategic', label: 'Strategic', icon: Target },
  { id: 'operations', label: 'Operations', icon: Settings },
] as const;

type TabId = typeof TABS[number]['id'];

export default function UnifiedDashboardPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const dashboard = useUnifiedDashboard();

  const {
    system, engine, logs, metrics, scheduledPosts, brandConfig, campaigns,
    tokenStatus, performance, strategy, abTests, aggressiveMode, reputation,
    replicaStats, leads, strategicPlan, audience, compliance, variation,
    loading, globalStatus, totalErrors, runningAgents, totalAgents,
    toggleSafeMode, toggleAgent, overridePost, runSentinel, saveBrand,
    saveStrategy, scanLeads, moveLeadStage, createLead,
    generatePlan, learnAudience, toggleAggressive, measureABTests,
    replicatePost, refresh,
  } = dashboard;

  if (loading && !system) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loading />
      </div>
    );
  }

  const postsToday = engine?.todayPosts?.length || 0;
  const weekPublished = engine?.weekStats?.published || 0;
  const weekGenerated = engine?.weekStats?.generated || 1;
  const growthScore = weekGenerated > 0 ? Math.round((weekPublished / weekGenerated) * 100) : 0;

  return (
    <div className="space-y-4 p-1">
      <SystemStatusBar
        safeMode={system?.safeMode.enabled || false}
        runningAgents={runningAgents}
        totalAgents={totalAgents}
        totalErrors={totalErrors}
        globalStatus={globalStatus}
        onToggleSafeMode={toggleSafeMode}
        onRefresh={refresh}
        loading={loading}
      />

      {/* Tab Navigation */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-primary/20 text-primary border border-primary/40'
                  : 'bg-surface/80 text-text-secondary hover:text-text-primary hover:bg-surface-hover border border-transparent'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <KpiCards
            leadsCount={leads.total}
            postsToday={postsToday}
            growthScore={growthScore}
            compliancePercent={compliance.score}
          />
          <AgentGrid
            agents={system?.agents || []}
            logs={logs}
            onToggleAgent={toggleAgent}
          />
          <ModuleSummaries leads={leads} engine={engine} />
          <UnifiedCharts performance={performance} engine={engine} />
        </div>
      )}

      {activeTab === 'command' && (
        <CommandTab
          agents={system?.agents || []}
          logs={logs}
          tokenStatus={tokenStatus}
          onToggleAgent={toggleAgent}
          onRunSentinel={runSentinel}
        />
      )}

      {activeTab === 'content' && (
        <ContentTab
          scheduledPosts={scheduledPosts}
          replicaStats={replicaStats}
          onOverride={overridePost}
          onReplicate={replicatePost}
        />
      )}

      {activeTab === 'growth' && (
        <GrowthTab
          abTests={abTests}
          aggressiveMode={aggressiveMode}
          reputation={reputation}
          onToggleAggressive={toggleAggressive}
          onMeasureABTests={measureABTests}
        />
      )}

      {activeTab === 'leads' && (
        <LeadsTab
          leads={leads}
          onScan={scanLeads}
          onMoveStage={moveLeadStage}
          onCreate={createLead}
        />
      )}

      {activeTab === 'strategic' && (
        <StrategicTab
          strategicPlan={strategicPlan}
          audience={audience}
          onGeneratePlan={generatePlan}
          onLearnAudience={learnAudience}
        />
      )}

      {activeTab === 'operations' && (
        <OperationsTab
          brandConfig={brandConfig}
          strategy={strategy}
          campaigns={campaigns}
          metrics={metrics}
          performance={performance}
          tokenStatus={tokenStatus}
          onSaveBrand={saveBrand}
          onSaveStrategy={saveStrategy}
        />
      )}
    </div>
  );
}
