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
  abTests: any[];
  aggressiveMode: any;
  reputation: any;
  replicaStats: any;
  leads: { pipeline: any[]; total: number };
  funnels: any[];
  offers: any[];
  monetizationSuggestions: any[];
  strategicPlan: any;
  audience: any[];
  marketIntel: any[];
  compliance: { score: number; total: number; passed: number };
  variation: { score: number; contentMix?: any[] };
  ads: { campaigns: any[]; totalSpend: number; totalBudget: number; activeCount: number };
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
  abTests: [],
  aggressiveMode: null,
  reputation: null,
  replicaStats: null,
  leads: { pipeline: [], total: 0 },
  funnels: [],
  offers: [],
  monetizationSuggestions: [],
  strategicPlan: null,
  audience: [],
  marketIntel: [],
  compliance: { score: 100, total: 0, passed: 0 },
  variation: { score: 100 },
  ads: { campaigns: [], totalSpend: 0, totalBudget: 0, activeCount: 0 },
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
        api.get('/agents/strategy'),          // 9
        api.get('/agents/ab-tests'),          // 10
        api.get('/agents/aggressive-mode'),   // 11
        api.get('/agents/reputation'),        // 12
        api.get('/agents/replicas/stats'),    // 13
        api.get('/agents/growth/leads/pipeline'),       // 14
        api.get('/agents/growth/funnels'),               // 15
        api.get('/agents/growth/offers'),                // 16
        api.get('/agents/growth/monetization/suggestions'), // 17
        api.get('/agents/growth/strategic-plan'),        // 18
        api.get('/agents/growth/audience'),              // 19
        api.get('/agents/growth/market-intel'),          // 20
        api.get('/agents/growth/compliance/stats'),      // 21
        api.get('/agents/growth/variation/stats'),       // 22
        api.get('/agents/growth/ads'),                   // 23
      ]);

      const get = (i: number) => {
        const r = results[i];
        return r.status === 'fulfilled' ? r.value.data.data : null;
      };

      const logs = get(2) || [];
      logsRef.current = logs;
      const leadsData = get(14);
      const adsData = get(23);
      const compData = get(21);
      const varData = get(22);

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
        strategy: get(9),
        abTests: get(10) || [],
        aggressiveMode: get(11),
        reputation: get(12),
        replicaStats: get(13),
        leads: leadsData
          ? { pipeline: leadsData.pipeline || leadsData || [], total: leadsData.total || (Array.isArray(leadsData) ? leadsData.length : 0) }
          : { pipeline: [], total: 0 },
        funnels: get(15) || [],
        offers: get(16) || [],
        monetizationSuggestions: get(17) || [],
        strategicPlan: get(18),
        audience: get(19) || [],
        marketIntel: get(20) || [],
        compliance: compData
          ? { score: compData.score ?? 100, total: compData.total ?? 0, passed: compData.passed ?? 0 }
          : { score: 100, total: 0, passed: 0 },
        variation: varData
          ? { score: varData.score ?? 100, contentMix: varData.contentMix }
          : { score: 100 },
        ads: adsData
          ? { campaigns: adsData.campaigns || adsData || [], totalSpend: adsData.totalSpend || 0, totalBudget: adsData.totalBudget || 0, activeCount: adsData.activeCount || 0 }
          : { campaigns: [], totalSpend: 0, totalBudget: 0, activeCount: 0 },
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
    await api.put('/agents/strategy', d);
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

  const createFunnel = useCallback(async (d: any) => {
    await api.post('/agents/growth/funnels', d);
    await fetchAll();
  }, [fetchAll]);

  const createOffer = useCallback(async (d: any) => {
    await api.post('/agents/growth/offers', d);
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

  const gatherIntel = useCallback(async () => {
    await api.post('/agents/growth/market-intel/gather');
    await fetchAll();
  }, [fetchAll]);

  const syncAds = useCallback(async () => {
    await api.post('/agents/growth/ads/sync');
    await fetchAll();
  }, [fetchAll]);

  const createCampaign = useCallback(async (d: any) => {
    await api.post('/agents/growth/ads/campaigns', d);
    await fetchAll();
  }, [fetchAll]);

  const generateCreatives = useCallback(async (campaignId: string) => {
    await api.post('/agents/growth/ads/creatives', { campaignId });
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
    await api.post(`/agents/replicas/${postId}`);
    await fetchAll();
  }, [fetchAll]);

  const generateCarousel = useCallback(async (topic: string, slides: number) => {
    const res = await api.post('/agents/carousel', { topic, slides });
    await fetchAll();
    return res.data.data;
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
    createFunnel,
    createOffer,
    generatePlan,
    learnAudience,
    gatherIntel,
    syncAds,
    createCampaign,
    generateCreatives,
    toggleAggressive,
    measureABTests,
    replicatePost,
    generateCarousel,
  };
}
