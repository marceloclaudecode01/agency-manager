'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import {
  Flame, Activity, Shield, ShieldAlert, TrendingUp, TrendingDown,
  Zap, ToggleLeft, ToggleRight, RefreshCw, Trophy, AlertTriangle,
  CheckCircle, XCircle, Target, BarChart3,
} from 'lucide-react';

export default function GrowthLabPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [abStats, setAbStats] = useState<any>(null);
  const [aggressiveMode, setAggressiveMode] = useState(false);
  const [reputation, setReputation] = useState<any>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [abRes, aggRes, repRes] = await Promise.all([
        api.get('/agents/ab-tests').catch(() => ({ data: { data: null } })),
        api.get('/agents/aggressive-mode').catch(() => ({ data: { data: { enabled: false } } })),
        api.get('/agents/reputation').catch(() => ({ data: { data: null } })),
      ]);
      setAbStats(abRes.data.data);
      setAggressiveMode(aggRes.data.data?.enabled ?? false);
      setReputation(repRes.data.data);
    } catch {} finally {
      setLoading(false);
    }
  }

  async function toggleAggressive() {
    setToggling(true);
    try {
      const newState = !aggressiveMode;
      await api.post('/agents/aggressive-mode', { enabled: newState });
      setAggressiveMode(newState);
      toast(`Modo agressivo ${newState ? 'ATIVADO' : 'desativado'}`, 'success');
    } catch {
      toast('Erro ao alterar modo', 'error');
    } finally {
      setToggling(false);
    }
  }

  async function runABMeasure() {
    try {
      const res = await api.post('/agents/ab-tests/measure');
      toast(`${res.data.data?.measured || 0} testes medidos`, 'success');
      loadAll();
    } catch {
      toast('Erro ao medir testes', 'error');
    }
  }

  if (loading) return <Loading />;

  const health = reputation?.current?.overallHealth || 'HEALTHY';
  const healthConfig: Record<string, { color: string; bg: string; icon: any; label: string }> = {
    HEALTHY: { color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/30', icon: CheckCircle, label: 'Saudável' },
    WARNING: { color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/30', icon: AlertTriangle, label: 'Atenção' },
    DANGER:  { color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/30', icon: ShieldAlert, label: 'Perigo' },
  };
  const hc = healthConfig[health] || healthConfig.HEALTHY;
  const HIcon = hc.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Flame className="w-6 h-6 text-orange-400" />
            Growth Lab
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            A/B Testing, Viral Mechanics e controle de crescimento agressivo
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAll}>
          <RefreshCw className="w-4 h-4 mr-1" /> Atualizar
        </Button>
      </div>

      {/* Top Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Aggressive Mode Toggle */}
        <Card className={`border ${aggressiveMode ? 'bg-orange-500/5 border-orange-400/40' : 'bg-surface/60 border-border/60'} transition-all`}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className={`w-5 h-5 ${aggressiveMode ? 'text-orange-400' : 'text-text-secondary'}`} />
                <h3 className="font-semibold text-text-primary text-sm">Modo Agressivo</h3>
              </div>
              <button
                onClick={toggleAggressive}
                disabled={toggling}
                className="transition-transform hover:scale-105"
              >
                {aggressiveMode
                  ? <ToggleRight className="w-8 h-8 text-orange-400" />
                  : <ToggleLeft className="w-8 h-8 text-text-secondary" />
                }
              </button>
            </div>
            <p className="text-xs text-text-secondary">
              {aggressiveMode
                ? 'ATIVO: +frequência, +testes A/B, até 8 posts/dia'
                : 'Desativado: modo conservador (5 posts/dia, 50% A/B)'
              }
            </p>
          </CardContent>
        </Card>

        {/* A/B Testing Summary */}
        <Card className="bg-surface/60 border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-5 h-5 text-indigo-400" />
              <h3 className="font-semibold text-text-primary text-sm">Testes A/B</h3>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-indigo-400">{abStats?.running ?? 0}</p>
                <p className="text-xs text-text-secondary">Rodando</p>
              </div>
              <div>
                <p className="text-lg font-bold text-green-400">{abStats?.completed ?? 0}</p>
                <p className="text-xs text-text-secondary">Concluídos</p>
              </div>
              <div>
                <p className="text-lg font-bold text-yellow-400">{abStats?.avgImprovement ?? 0}%</p>
                <p className="text-xs text-text-secondary">Melhoria</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reputation Health */}
        <Card className={`border ${hc.bg}`}>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <HIcon className={`w-5 h-5 ${hc.color}`} />
              <h3 className="font-semibold text-text-primary text-sm">Reputação</h3>
              <Badge variant="default" className={`ml-auto ${hc.color} border-current text-xs`}>
                {hc.label}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-text-primary">{reputation?.current?.totalComments ?? 0}</p>
                <p className="text-xs text-text-secondary">Comentários</p>
              </div>
              <div>
                <p className={`text-lg font-bold ${(reputation?.current?.negativeComments ?? 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {reputation?.current?.negativeComments ?? 0}
                </p>
                <p className="text-xs text-text-secondary">Negativos</p>
              </div>
              <div>
                <p className="text-lg font-bold text-text-primary">{reputation?.current?.crisisCount ?? 0}</p>
                <p className="text-xs text-text-secondary">Crises</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* A/B Test Results */}
      <Card className="bg-surface/60 border-border/60">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-text-primary flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              Resultados dos Testes A/B
            </h3>
            <Button variant="outline" size="sm" onClick={runABMeasure}>
              <BarChart3 className="w-3 h-3 mr-1" /> Medir Agora
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {(!abStats?.recentTests || abStats.recentTests.length === 0) ? (
            <div className="text-center py-8 text-text-secondary">
              <Activity className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum teste A/B concluído ainda.</p>
              <p className="text-xs mt-1">Os testes são criados automaticamente pelo Motor Autônomo.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {abStats.recentTests.map((test: any) => (
                <div key={test.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-hover/30 border border-border/40">
                  <Trophy className={`w-4 h-4 flex-shrink-0 ${test.winner === 'A' ? 'text-blue-400' : 'text-purple-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary font-medium truncate">{test.topic}</p>
                    <p className="text-xs text-text-secondary">{test.reason}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className={`px-2 py-1 rounded ${test.winner === 'A' ? 'bg-blue-400/10 text-blue-400 font-bold' : 'text-text-secondary'}`}>
                      A: {test.scoreA?.toFixed(1)}
                    </span>
                    <span className={`px-2 py-1 rounded ${test.winner === 'B' ? 'bg-purple-400/10 text-purple-400 font-bold' : 'text-text-secondary'}`}>
                      B: {test.scoreB?.toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reputation History + Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recommendations */}
        <Card className="bg-surface/60 border-border/60">
          <CardHeader className="pb-2">
            <h3 className="font-semibold text-text-primary flex items-center gap-2">
              <Target className="w-4 h-4 text-cyan-400" />
              Recomendações
            </h3>
          </CardHeader>
          <CardContent>
            {(!reputation?.current?.recommendations || reputation.current.recommendations.length === 0) ? (
              <div className="text-center py-6 text-text-secondary">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-400 opacity-50" />
                <p className="text-sm">Tudo bem! Nenhuma recomendação no momento.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {reputation.current.recommendations.map((rec: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    {rec}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Reputation Events */}
        <Card className="bg-surface/60 border-border/60">
          <CardHeader className="pb-2">
            <h3 className="font-semibold text-text-primary flex items-center gap-2">
              <Shield className="w-4 h-4 text-rose-400" />
              Eventos de Reputação (7 dias)
            </h3>
          </CardHeader>
          <CardContent>
            {(!reputation?.history || reputation.history.length === 0) ? (
              <div className="text-center py-6 text-text-secondary">
                <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum evento registrado.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {reputation.history.map((event: any) => (
                  <div key={event.id} className="flex items-center gap-2 p-2 rounded bg-surface-hover/30 border border-border/40">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      event.severity === 'HIGH' || event.severity === 'CRITICAL' ? 'bg-red-400' :
                      event.severity === 'MEDIUM' ? 'bg-yellow-400' : 'bg-text-secondary'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-text-primary">{event.type.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-text-secondary truncate">
                        {event.actionTaken || event.severity}
                      </p>
                    </div>
                    <span className="text-xs text-text-secondary/50">
                      {new Date(event.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
