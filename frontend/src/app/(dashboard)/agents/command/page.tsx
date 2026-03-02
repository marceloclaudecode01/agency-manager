'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

interface AgentInfo {
  name: string;
  paused: boolean;
  status: string;
}

interface SafeModeInfo {
  enabled: boolean;
  reason?: string;
  activatedBy?: string;
  activatedAt?: string;
}

interface AgentsStatusData {
  safeMode: SafeModeInfo;
  agents: AgentInfo[];
  errorCounts: { from: string; _count: { id: number } }[];
  pausedAgents: string[];
}

export default function CommandCenterPage() {
  const [data, setData] = useState<AgentsStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/agents/status');
      setData(res.data.data);
    } catch {
      toast({ title: 'Erro ao carregar status', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const toggleSafeMode = async () => {
    if (!data) return;
    try {
      await api.post('/agents/safe-mode', { enabled: !data.safeMode.enabled, reason: 'Toggle manual' });
      toast({ title: data.safeMode.enabled ? 'Safe mode desativado' : 'Safe mode ativado' });
      fetchStatus();
    } catch {
      toast({ title: 'Erro', variant: 'destructive' });
    }
  };

  const toggleAgent = async (name: string, currentlyPaused: boolean) => {
    try {
      await api.post(`/agents/pause/${encodeURIComponent(name)}`, { paused: !currentlyPaused });
      toast({ title: `${name} ${currentlyPaused ? 'retomado' : 'pausado'}` });
      fetchStatus();
    } catch {
      toast({ title: 'Erro', variant: 'destructive' });
    }
  };

  const runSentinel = async () => {
    try {
      const res = await api.post('/agents/sentinel/run');
      toast({ title: 'Sentinel executado', description: JSON.stringify(res.data.data).substring(0, 100) });
      fetchStatus();
    } catch {
      toast({ title: 'Erro', variant: 'destructive' });
    }
  };

  if (loading) return <div className="p-6">Carregando...</div>;
  if (!data) return <div className="p-6">Erro ao carregar dados</div>;

  const getErrorCount = (agentName: string) => {
    const found = data.errorCounts.find((e) => e.from === agentName);
    return found?._count.id || 0;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Centro de Comando</h1>
        <Button variant="outline" onClick={runSentinel}>Executar Sentinel</Button>
      </div>

      {/* Safe Mode Card */}
      <Card className={data.safeMode.enabled ? 'border-red-500 bg-red-50 dark:bg-red-950' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Safe Mode</span>
            <Switch checked={data.safeMode.enabled} onCheckedChange={toggleSafeMode} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.safeMode.enabled ? (
            <div className="space-y-1">
              <Badge variant="destructive">ATIVO</Badge>
              <p className="text-sm text-muted-foreground">Motivo: {data.safeMode.reason}</p>
              <p className="text-sm text-muted-foreground">Por: {data.safeMode.activatedBy} em {data.safeMode.activatedAt ? new Date(data.safeMode.activatedAt).toLocaleString('pt-BR') : '-'}</p>
            </div>
          ) : (
            <Badge variant="outline" className="text-green-600">Desativado — Sistema operando normalmente</Badge>
          )}
        </CardContent>
      </Card>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.agents.map((agent) => {
          const errors = getErrorCount(agent.name);
          return (
            <Card key={agent.name} className={agent.paused ? 'opacity-60' : ''}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{agent.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={agent.status === 'running' ? 'default' : agent.status === 'paused' ? 'secondary' : 'destructive'}>
                        {agent.status}
                      </Badge>
                      {errors > 0 && <Badge variant="destructive">{errors} erros</Badge>}
                    </div>
                  </div>
                  <Switch checked={!agent.paused} onCheckedChange={() => toggleAgent(agent.name, agent.paused)} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
