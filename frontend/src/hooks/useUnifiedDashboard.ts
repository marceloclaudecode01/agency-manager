'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';
import { useSocketContext } from '@/contexts/SocketContext';
import type { SystemStatus, EngineStatus, AgentLog } from './useCommandCenter';

export interface UnifiedData {
  system: SystemStatus | null;
  engine: EngineStatus | null;
  logs: AgentLog[];
  metrics: any[];
  scheduledPosts: any[];
  brandConfig: any;
  campaigns: any[];
  tokenStatus: any;
  performance: any;
  strategy: any;
  abTests: { running: number; completed: number; avgImprovement: number; recentTests: any[] };
  aggressiveMode: any;
  reputation: { current: any; history: any[] } | null;
  replicaStats: any;
  leads: { pipeline: any[]; total: number };
  strategicPlan: any;
  audience: any[];
  compliance: { complianceRate: number; totalReviewed: number; rejected: number };
  variation: { diversityScore: number; totalRecent: number; contentTypeMix?: any };
}

const INITIAL: UnifiedData = {
  system: null,
  engine: null,
  logs: [],
  metrics: [],
  scheduledPosts: [],
  brandConfig: null,
  campaigns: [],
  tokenStatus: null,
  performance: null,
  strategy: null,
  abTests: { running: 0, completed: 0, avgImprovement: 0, recentTests: [] },
  aggressiveMode: null,
  reputation: null,
  replicaStats: null,
  leads: { pipeline: [], total: 0 },
  strategicPlan: null,
  audience: [],
  compliance: { complianceRate: 100, totalReviewed: 0, rejected: 0 },
  variation: { diversityScore: 100, totalRecent: 0 },
};

export function useUnifiedDashboard() {
  const { socket } = useSocketContext();
  const [data, setData] = useState<UnifiedData>(INITIAL);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const logsRef = useRef<AgentLog[]>([]);

  const fetchAll = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        api.get('/agents/status'),           // 0
        api.get('/agents/engine/status'),     // 1
        api.get('/agents/logs?limit=200'),    // 2
        api.get('/agents/metrics'),           // 3
        api.get('/agents/scheduled'),         // 4
        api.get('/agents/brand'),             // 5
        api.get('/agents/campaigns'),         // 6
        api.get('/agents/token/status'),      // 7
        api.get('/agents/performance'),       // 8
        // 9: strategy removed (no GET route exists)
        api.get('/agents/ab-tests'),          // 9
        api.get('/agents/aggressive-mode'),   // 10
        api.get('/agents/reputation'),        // 11
        api.get('/agents/replicas/stats'),    // 12
        api.get('/agents/growth/leads/pipeline'),       // 13
        api.get('/agents/growth/strategic-plan'),        // 14
        api.get('/agents/growth/audience'),              // 15
        api.get('/agents/growth/compliance/stats'),      // 16
        api.get('/agents/growth/variation/stats'),       // 17
      ]);

      const get = (i: number) => {
        const r = results[i];
        return r.status === 'fulfilled' ? r.value.data.data : null;
      };

      const logs = get(2) || [];
      logsRef.current = logs;

      // Leads: backend returns Record<string, any[]> keyed by stage, flatten to array
      const leadsRaw = get(13);
      let leadsArray: any[] = [];
      let leadsTotal = 0;
      if (leadsRaw && typeof leadsRaw === 'object' && !Array.isArray(leadsRaw)) {
        leadsArray = Object.entries(leadsRaw).flatMap(([stage, items]) =>
          (Array.isArray(items) ? items : []).map((item: any) => ({ ...item, stage: item.stage || stage }))
        );
        leadsTotal = leadsArray.length;
      } else if (Array.isArray(leadsRaw)) {
        leadsArray = leadsRaw;
        leadsTotal = leadsRaw.length;
      }

      const compData = get(16);
      const varData = get(17);

      // AB Tests: backend returns { running, completed, avgImprovement, recentTests }
      const abRaw = get(9);
      const abTests = abRaw
        ? { running: abRaw.running ?? 0, completed: abRaw.completed ?? 0, avgImprovement: abRaw.avgImprovement ?? 0, recentTests: abRaw.recentTests || [] }
        : { running: 0, completed: 0, avgImprovement: 0, recentTests: [] };

      // Audience: backend returns { insights, byCategory, total }
      const audienceRaw = get(15);
      const audience = audienceRaw?.insights || (Array.isArray(audienceRaw) ? audienceRaw : []);

      setData({
        system: get(0),
        engine: get(1),
        logs,
        metrics: get(3) || [],
        scheduledPosts: get(4) || [],
        brandConfig: get(5),
        campaigns: get(6) || [],
        tokenStatus: get(7),
        performance: get(8),
        strategy: null,
        abTests,
        aggressiveMode: get(10),
        reputation: get(11),
        replicaStats: get(12),
        leads: { pipeline: leadsArray, total: leadsTotal },
        strategicPlan: get(14),
        audience,
        compliance: compData
          ? { complianceRate: compData.complianceRate ?? 100, totalReviewed: compData.totalReviewed ?? 0, rejected: compData.rejected ?? 0 }
          : { complianceRate: 100, totalReviewed: 0, rejected: 0 },
        variation: varData
          ? { diversityScore: varData.diversityScore ?? 100, totalRecent: varData.totalRecent ?? 0, contentTypeMix: varData.contentTypeMix }
          : { diversityScore: 100, totalRecent: 0 },
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
      logsRef.current = [...logsRef.current, log].slice(-200);
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

  const overridePost = useCallback(async (postId: string, action: 'approve' | 'reject') => {
    await api.post(`/agents/override/${postId}`, { action });
    await fetchAll();
  }, [fetchAll]);

  const runSentinel = useCallback(async () => {
    const res = await api.post('/agents/sentinel/run');
    await fetchAll();
    return res.data.data;
  }, [fetchAll]);

  const saveBrand = useCallback(async (d: any) => {
    await api.put('/agents/brand', d);
    await fetchAll();
  }, [fetchAll]);

  const saveStrategy = useCallback(async (d: any) => {
    await api.post('/agents/strategy', d);
    await fetchAll();
  }, [fetchAll]);

  const scanLeads = useCallback(async () => {
    await api.post('/agents/growth/leads/scan');
    await fetchAll();
  }, [fetchAll]);

  const moveLeadStage = useCallback(async (leadId: string, stage: string) => {
    await api.patch(`/agents/growth/leads/${leadId}/stage`, { stage });
    await fetchAll();
  }, [fetchAll]);

  const createLead = useCallback(async (d: any) => {
    await api.post('/agents/growth/leads', d);
    await fetchAll();
  }, [fetchAll]);

  const generatePlan = useCallback(async () => {
    await api.post('/agents/growth/strategic-plan/generate');
    await fetchAll();
  }, [fetchAll]);

  const learnAudience = useCallback(async () => {
    await api.post('/agents/growth/audience/learn');
    await fetchAll();
  }, [fetchAll]);

  const toggleAggressive = useCallback(async (enabled: boolean) => {
    await api.post('/agents/aggressive-mode', { enabled });
    await fetchAll();
  }, [fetchAll]);

  const measureABTests = useCallback(async () => {
    await api.post('/agents/ab-tests/measure');
    await fetchAll();
  }, [fetchAll]);

  const replicatePost = useCallback(async (postId: string) => {
    await api.post('/agents/replicate', { postId });
    await fetchAll();
  }, [fetchAll]);

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
    totalErrors,
    runningAgents,
    totalAgents,
    globalStatus,
    toggleSafeMode,
    toggleAgent,
    overridePost,
    runSentinel,
    saveBrand,
    saveStrategy,
    scanLeads,
    moveLeadStage,
    createLead,
    generatePlan,
    learnAudience,
    toggleAggressive,
    measureABTests,
    replicatePost,
  };
}
