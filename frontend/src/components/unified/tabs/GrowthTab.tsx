'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, FlaskConical, Shield, TrendingUp, AlertTriangle } from 'lucide-react';

interface GrowthTabProps {
  abTests: { running: number; completed: number; avgImprovement: number; recentTests: any[] };
  aggressiveMode: any;
  reputation: { current: any; history: any[] } | null;
  onToggleAggressive: (enabled: boolean) => Promise<void>;
  onMeasureABTests: () => Promise<void>;
}

export function GrowthTab({ abTests, aggressiveMode, reputation, onToggleAggressive, onMeasureABTests }: GrowthTabProps) {
  const [measuring, setMeasuring] = useState(false);

  const handleMeasure = async () => {
    setMeasuring(true);
    try { await onMeasureABTests(); } finally { setMeasuring(false); }
  };

  const runningCount = abTests.running ?? 0;
  const completedCount = abTests.completed ?? 0;
  const avgImprovement = abTests.avgImprovement ?? 0;
  const recentTests = abTests.recentTests || [];

  const repCurrent = reputation?.current;
  const repHistory = reputation?.history || [];
  const repStatus = repCurrent?.overallHealth || 'HEALTHY';
  const repColor = repStatus === 'HEALTHY' ? 'text-emerald-400' : repStatus === 'WARNING' ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="space-y-6">
      {/* Aggressive Mode */}
      <div className="rounded-xl border border-border/60 bg-surface/80 backdrop-blur-sm p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-orange-400" />
            <h3 className="text-sm font-heading font-semibold text-text-primary">Modo Agressivo</h3>
          </div>
          <Button
            size="sm"
            variant={aggressiveMode?.enabled ? 'danger' : 'outline'}
            onClick={() => onToggleAggressive(!aggressiveMode?.enabled)}
            className="gap-1.5"
          >
            <Zap className="w-3.5 h-3.5" />
            {aggressiveMode?.enabled ? 'ATIVO — Desligar' : 'Ativar'}
          </Button>
        </div>
        {aggressiveMode?.enabled && (
          <p className="text-xs text-orange-400/80 mt-2">Frequência aumentada, +A/B tests, até 8 posts/dia</p>
        )}
      </div>

      {/* A/B Tests */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-heading font-semibold text-text-primary flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-violet-400" /> A/B Tests
            <Badge variant="default" className="text-xs">{runningCount} rodando</Badge>
            <Badge variant="success" className="text-xs">{completedCount} completos</Badge>
          </h3>
          <Button size="sm" variant="outline" onClick={handleMeasure} disabled={measuring} className="gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" /> {measuring ? 'Medindo...' : 'Medir'}
          </Button>
        </div>
        {avgImprovement > 0 && (
          <p className="text-xs text-emerald-400 mb-2">Melhoria média: +{avgImprovement}%</p>
        )}
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {recentTests.map((test, i) => (
            <div key={test.id || i} className="rounded-lg border border-border/60 bg-surface/80 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-primary font-medium">{test.topic || test.name || 'Test'}</span>
                {test.winner && <Badge variant="success" className="text-xs">Concluído</Badge>}
              </div>
              {test.winner && <p className="text-xs text-emerald-400 mt-1">Vencedor: {test.winner}</p>}
              {test.scoreA != null && (
                <div className="flex gap-4 mt-1 text-xs text-text-secondary">
                  <span>A: {test.scoreA}</span>
                  <span>B: {test.scoreB}</span>
                </div>
              )}
            </div>
          ))}
          {recentTests.length === 0 && <p className="text-xs text-text-secondary/50">Nenhum teste A/B</p>}
        </div>
      </div>

      {/* Reputation */}
      <div className="rounded-xl border border-border/60 bg-surface/80 backdrop-blur-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-heading font-semibold text-text-primary">Reputação</h3>
          <span className={`text-sm font-mono font-bold ${repColor}`}>{repStatus}</span>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-lg font-bold text-text-primary">{repCurrent?.totalComments || 0}</p>
            <p className="text-xs text-text-secondary">Comentários</p>
          </div>
          <div>
            <p className="text-lg font-bold text-yellow-400">{repCurrent?.negativeComments || 0}</p>
            <p className="text-xs text-text-secondary">Negativos</p>
          </div>
          <div>
            <p className="text-lg font-bold text-red-400">{repCurrent?.crisisCount || 0}</p>
            <p className="text-xs text-text-secondary">Crises</p>
          </div>
        </div>
        {repHistory.length > 0 && (
          <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
            {repHistory.slice(0, 5).map((ev: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs text-text-secondary">
                <div className={`w-2 h-2 rounded-full ${ev.severity === 'HIGH' ? 'bg-red-400' : ev.severity === 'MEDIUM' ? 'bg-yellow-400' : 'bg-blue-400'}`} />
                <span className="flex-1 truncate">{ev.type}: {ev.details || ev.description}</span>
                <span className="text-text-secondary/50">{ev.createdAt ? new Date(ev.createdAt).toLocaleDateString('pt-BR') : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
