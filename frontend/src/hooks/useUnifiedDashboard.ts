'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';
import { useSocketContext } from '@/contexts/SocketContext';
import type { SystemStatus, EngineStatus, AgentLog } from './useCommandCenter';

export interface UnifiedData {
  system: SystemStatus | null;
  engine: EngineStatus | null;
  logs: AgentLog[];
  leads: { pipeline: any[]; total: number };
  funnels: any[];
  ads: { campaigns: any[]; totalSpend: number };
  compliance: { score: number; total: number; passed: number };
  variation: { score: number };
  performance: any;
  abTests: any[];
  reputation: any;
}

export function useUnifiedDashboard() {
  const { socket } = useSocketContext();
  const [data, setData] = useState<UnifiedData>({
    system: null,
    engine: null,
    logs: [],
    leads: { pipeline: [], total: 0 },
    funnels: [],
    ads: { campaigns: [], totalSpend: 0 },
    compliance: { score: 100, total: 0, passed: 0 },
    variation: { score: 100 },
    performance: null,
    abTests: [],
    reputation: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const logsRef = useRef<AgentLog[]>([]);

  const fetchAll = useCallback(async () => {
    try {
      const [
        statusRes, engineRes, logsRes, leadsRes, funnelsRes,
        adsRes, complianceRes, variationRes, perfRes, abRes, repRes,
      ] = await Promise.allSettled([
        api.get('/agents/status'),
        api.get('/agents/engine/status'),
        api.get('/agents/logs?limit=30'),
        api.get('/agents/growth/leads/pipeline'),
        api.get('/agents/growth/funnels'),
        api.get('/agents/growth/ads'),
        api.get('/agents/growth/compliance/stats'),
        api.get('/agents/growth/variation/stats'),
        api.get('/agents/performance'),
        api.get('/agents/ab-tests'),
        api.get('/agents/reputation'),
      ]);

      const get = (r: PromiseSettledResult<any>) =>
        r.status === 'fulfilled' ? r.value.data.data : null;

      const logs = get(logsRes) || [];
      logsRef.current = logs;

      const leadsData = get(leadsRes);
      const adsData = get(adsRes);
      const compData = get(complianceRes);
      const varData = get(variationRes);

      setData({
        system: get(statusRes),
        engine: get(engineRes),
        logs,
        leads: leadsData ? { pipeline: leadsData.pipeline || leadsData || [], total: leadsData.total || (Array.isArray(leadsData) ? leadsData.length : 0) } : { pipeline: [], total: 0 },
        funnels: get(funnelsRes) || [],
        ads: adsData ? { campaigns: adsData.campaigns || adsData || [], totalSpend: adsData.totalSpend || 0 } : { campaigns: [], totalSpend: 0 },
        compliance: compData ? { score: compData.score ?? 100, total: compData.total ?? 0, passed: compData.passed ?? 0 } : { score: 100, total: 0, passed: 0 },
        variation: varData ? { score: varData.score ?? 100 } : { score: 100 },
        performance: get(perfRes),
        abTests: get(abRes) || [],
        reputation: get(repRes),
      });

      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  useEffect(() => {
    if (!socket) return;
    const handler = (log: AgentLog) => {
      logsRef.current = [...logsRef.current, log].slice(-50);
      setData(prev => ({ ...prev, logs: [...logsRef.current] }));
    };
    socket.on('agent:log', handler);
    return () => { socket.off('agent:log', handler); };
  }, [socket]);

  const toggleSafeMode = useCallback(async (enabled: boolean, reason?: string) => {
    await api.post('/agents/safe-mode', { enabled, reason: reason || 'Toggle manual' });
    await fetchAll();
  }, [fetchAll]);

  const toggleAgent = useCallback(async (agentName: string, paused: boolean) => {
    await api.post(`/agents/pause/${encodeURIComponent(agentName)}`, { paused });
    await fetchAll();
  }, [fetchAll]);

  // Derived
  const totalErrors = data.system?.errorCounts.reduce((s, e) => s + e._count.id, 0) || 0;
  const runningAgents = data.system?.agents.filter(a => a.status === 'running').length || 0;
  const totalAgents = data.system?.agents.length || 0;
  const globalStatus: 'ONLINE' | 'DEGRADED' | 'SAFE_MODE' | 'ERROR' =
    data.system?.safeMode.enabled ? 'SAFE_MODE' :
    totalErrors > 5 ? 'ERROR' :
    totalErrors > 0 ? 'DEGRADED' : 'ONLINE';

  return {
    ...data,
    loading,
    error,
    refresh: fetchAll,
    toggleSafeMode,
    toggleAgent,
    totalErrors,
    runningAgents,
    totalAgents,
    globalStatus,
  };
}
