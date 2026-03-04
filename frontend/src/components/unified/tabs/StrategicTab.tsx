'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, Target, BookOpen, Sparkles } from 'lucide-react';

interface StrategicTabProps {
  strategicPlan: any;
  audience: any[]; // Already flattened from { insights } in hook
  onGeneratePlan: () => Promise<void>;
  onLearnAudience: () => Promise<void>;
}

export function StrategicTab({ strategicPlan, audience, onGeneratePlan, onLearnAudience }: StrategicTabProps) {
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [learning, setLearning] = useState(false);

  const handleGenerate = async () => {
    setGeneratingPlan(true);
    try { await onGeneratePlan(); } finally { setGeneratingPlan(false); }
  };

  const handleLearn = async () => {
    setLearning(true);
    try { await onLearnAudience(); } finally { setLearning(false); }
  };

  const goals = strategicPlan?.goals || [];
  const tactics = strategicPlan?.tactics || [];
  const kpis = strategicPlan?.kpis || [];
  const budget = strategicPlan?.budgetAllocation || [];

  return (
    <div className="space-y-6">
      {/* Strategic Plan */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-heading font-semibold text-text-primary flex items-center gap-2">
            <Target className="w-4 h-4 text-red-400" /> Plano Estratégico
          </h3>
          <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generatingPlan} className="gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> {generatingPlan ? 'Gerando...' : 'Gerar Plano'}
          </Button>
        </div>

        {!strategicPlan ? (
          <p className="text-xs text-text-secondary/50">Nenhum plano estratégico gerado</p>
        ) : (
          <div className="space-y-4">
            {/* Goals */}
            {goals.length > 0 && (
              <div className="rounded-xl border border-border/60 bg-surface/80 p-4">
                <h4 className="text-xs font-semibold text-text-secondary uppercase mb-2">Metas</h4>
                <div className="space-y-2">
                  {goals.map((g: any, i: number) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm text-text-primary">{g.metric || g.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-secondary">Alvo: {g.target}</span>
                        <Badge variant={g.priority === 'HIGH' ? 'error' : g.priority === 'MEDIUM' ? 'warning' : 'default'} className="text-xs">
                          {g.priority || 'MEDIUM'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tactics */}
            {tactics.length > 0 && (
              <div className="rounded-xl border border-border/60 bg-surface/80 p-4">
                <h4 className="text-xs font-semibold text-text-secondary uppercase mb-2">Táticas</h4>
                <div className="space-y-2">
                  {tactics.map((t: any, i: number) => (
                    <div key={i} className="rounded-lg bg-surface-hover p-2.5">
                      <p className="text-sm font-medium text-text-primary">{t.name}</p>
                      <p className="text-xs text-text-secondary mt-0.5">{t.description}</p>
                      <div className="flex gap-2 mt-1">
                        {t.channel && <Badge variant="default" className="text-[10px]">{t.channel}</Badge>}
                        {t.frequency && <Badge variant="default" className="text-[10px]">{t.frequency}</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* KPIs + Budget */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {kpis.length > 0 && (
                <div className="rounded-xl border border-border/60 bg-surface/80 p-4">
                  <h4 className="text-xs font-semibold text-text-secondary uppercase mb-2">KPIs</h4>
                  {kpis.map((k: any, i: number) => (
                    <div key={i} className="flex justify-between text-xs py-1">
                      <span className="text-text-primary">{k.name || k.metric}</span>
                      <span className="text-text-secondary font-mono">{k.target || k.value}</span>
                    </div>
                  ))}
                </div>
              )}
              {budget.length > 0 && (
                <div className="rounded-xl border border-border/60 bg-surface/80 p-4">
                  <h4 className="text-xs font-semibold text-text-secondary uppercase mb-2">Budget Allocation</h4>
                  {budget.map((b: any, i: number) => (
                    <div key={i} className="flex justify-between text-xs py-1">
                      <span className="text-text-primary">{b.category || b.channel}</span>
                      <span className="text-emerald-400 font-mono">{b.percentage || b.amount}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Audience / Niche Learning */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-heading font-semibold text-text-primary flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-400" /> Niche Learning
          </h3>
          <Button size="sm" variant="outline" onClick={handleLearn} disabled={learning} className="gap-1.5">
            <Brain className="w-3.5 h-3.5" /> {learning ? 'Aprendendo...' : 'Aprender'}
          </Button>
        </div>
        {audience.length === 0 ? (
          <p className="text-xs text-text-secondary/50">Nenhum insight de audiência</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {audience.map((a: any, i: number) => (
              <div key={a.id || i} className="rounded-lg border border-border/60 bg-surface/80 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text-primary">{a.category || a.topic}</span>
                  {a.confidence != null && (
                    <span className={`text-xs font-mono ${a.confidence >= 0.7 ? 'text-emerald-400' : a.confidence >= 0.4 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {Math.round(a.confidence * 100)}%
                    </span>
                  )}
                </div>
                {a.insights && (
                  <div className="mt-1 space-y-0.5">
                    {(Array.isArray(a.insights) ? a.insights : [a.insights]).slice(0, 3).map((ins: any, j: number) => (
                      <p key={j} className="text-xs text-text-secondary">{typeof ins === 'string' ? ins : ins.text || ins.description}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
