'use client';

import { useUnifiedDashboard } from '@/hooks/useUnifiedDashboard';
import { SystemStatusBar } from '@/components/unified/SystemStatusBar';
import { KpiCards } from '@/components/unified/KpiCards';
import { AgentGrid } from '@/components/unified/AgentGrid';
import { ModuleSummaries } from '@/components/unified/ModuleSummaries';
import { UnifiedCharts } from '@/components/unified/UnifiedCharts';
import { Loading } from '@/components/ui/loading';

export default function UnifiedDashboardPage() {
  const {
    system, engine, logs, leads, funnels, ads, compliance, performance,
    loading, globalStatus, totalErrors, runningAgents, totalAgents,
    toggleSafeMode, toggleAgent, refresh,
  } = useUnifiedDashboard();

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

      <KpiCards
        leadsCount={leads.total}
        funnelsRevenue={funnels.reduce((s: number, f: any) => s + (f.revenue || 0), 0)}
        postsToday={postsToday}
        growthScore={growthScore}
        adSpend={ads.totalSpend}
        compliancePercent={compliance.score}
      />

      <AgentGrid
        agents={system?.agents || []}
        logs={logs}
        onToggleAgent={toggleAgent}
      />

      <ModuleSummaries
        leads={leads}
        engine={engine}
        funnels={funnels}
        ads={ads}
      />

      <UnifiedCharts
        performance={performance}
        engine={engine}
      />
    </div>
  );
}
