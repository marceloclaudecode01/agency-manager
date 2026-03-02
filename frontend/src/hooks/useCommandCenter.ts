'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';
import { useSocketContext } from '@/contexts/SocketContext';

export interface AgentStatus {
  name: string;
  paused: boolean;
  status: 'running' | 'paused' | 'safe_mode' | 'error';
}

export interface SafeModeInfo {
  enabled: boolean;
  reason?: string;
  activatedBy?: string;
  activatedAt?: string;
}

export interface ErrorCount {
  from: string;
  _count: { id: number };
}

export interface SystemStatus {
  safeMode: SafeModeInfo;
  agents: AgentStatus[];
  errorCounts: ErrorCount[];
  pausedAgents: string[];
}

export interface EngineStatus {
  active: boolean;
  lastCycle: string | null;
  todayPosts: Array<{ id: string; topic: string; scheduledFor: string; status: string; contentType?: string; qualityScore?: number; governorDecision?: string }>;
  weekStats: { generated: number; published: number; failed: number };
}

export interface AgentLog {
  id: string;
  from: string;
  to: string | null;
  type: 'info' | 'action' | 'result' | 'error' | 'communication';
  message: string;
  payload?: any;
  createdAt: string;
}

export function useCommandCenter() {
  const { socket } = useSocketContext();
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const logsRef = useRef<AgentLog[]>([]);

  // New state for expanded data
  const [scheduledPosts, setScheduledPosts] = useState<any[]>([]);
  const [brandConfig, setBrandConfig] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [tokenStatus, setTokenStatus] = useState<any>(null);
  const [performance, setPerformance] = useState<any>(null);
  const [strategy, setStrategy] = useState<any>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [statusRes, engineRes, logsRes, metricsRes, scheduledRes, brandRes, campaignsRes, tokenRes, perfRes, strategyRes] = await Promise.allSettled([
        api.get('/agents/status'),
        api.get('/agents/engine/status'),
        api.get('/agents/logs?limit=200'),
        api.get('/agents/metrics'),
        api.get('/agents/scheduled'),
        api.get('/agents/brand'),
        api.get('/agents/campaigns'),
        api.get('/agents/token/status'),
        api.get('/agents/performance'),
        api.get('/agents/strategy'),
      ]);

      if (statusRes.status === 'fulfilled') setSystemStatus(statusRes.value.data.data);
      if (engineRes.status === 'fulfilled') setEngineStatus(engineRes.value.data.data);
      if (logsRes.status === 'fulfilled') {
        const data = logsRes.value.data.data || [];
        setLogs(data);
        logsRef.current = data;
      }
      if (metricsRes.status === 'fulfilled') setMetrics(metricsRes.value.data.data || []);
      if (scheduledRes.status === 'fulfilled') setScheduledPosts(scheduledRes.value.data.data || []);
      if (brandRes.status === 'fulfilled') setBrandConfig(brandRes.value.data.data || null);
      if (campaignsRes.status === 'fulfilled') setCampaigns(campaignsRes.value.data.data || []);
      if (tokenRes.status === 'fulfilled') setTokenStatus(tokenRes.value.data.data || null);
      if (perfRes.status === 'fulfilled') setPerformance(perfRes.value.data.data || null);
      if (strategyRes.status === 'fulfilled') setStrategy(strategyRes.value.data.data || null);

      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + polling every 30s
  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Real-time log updates via socket
  useEffect(() => {
    if (!socket) return;
    const handler = (log: AgentLog) => {
      logsRef.current = [...logsRef.current, log].slice(-200);
      setLogs([...logsRef.current]);
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

  const overridePost = useCallback(async (postId: string, action: 'approve' | 'reject') => {
    await api.post(`/agents/override/${postId}`, { action });
    await fetchAll();
  }, [fetchAll]);

  const runSentinel = useCallback(async () => {
    const res = await api.post('/agents/sentinel/run');
    await fetchAll();
    return res.data.data;
  }, [fetchAll]);

  const saveBrand = useCallback(async (data: any) => {
    await api.put('/agents/brand', data);
    await fetchAll();
  }, [fetchAll]);

  const saveStrategy = useCallback(async (data: any) => {
    await api.put('/agents/strategy', data);
    await fetchAll();
  }, [fetchAll]);

  // Derived data
  const totalErrors = systemStatus?.errorCounts.reduce((sum, e) => sum + e._count.id, 0) || 0;
  const runningAgents = systemStatus?.agents.filter(a => a.status === 'running').length || 0;
  const totalAgents = systemStatus?.agents.length || 0;

  const globalStatus: 'ONLINE' | 'DEGRADED' | 'SAFE_MODE' | 'ERROR' =
    systemStatus?.safeMode.enabled ? 'SAFE_MODE' :
    totalErrors > 5 ? 'ERROR' :
    totalErrors > 0 ? 'DEGRADED' : 'ONLINE';

  return {
    systemStatus,
    engineStatus,
    logs,
    metrics,
    loading,
    error,
    toggleSafeMode,
    toggleAgent,
    overridePost,
    runSentinel,
    refresh: fetchAll,
    totalErrors,
    runningAgents,
    totalAgents,
    globalStatus,
    // New data
    scheduledPosts,
    brandConfig,
    campaigns,
    tokenStatus,
    performance,
    strategy,
    saveBrand,
    saveStrategy,
  };
}
