'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { Compass, Target, RefreshCw, TrendingUp, Brain } from 'lucide-react';

export default function StrategicPage() {
  const [plan, setPlan] = useState<any>(null);
  const [audience, setAudience] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [learningNow, setLearningNow] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    try {
      const [p, a] = await Promise.all([
        api.get('/agents/growth/strategic-plan'),
        api.get('/agents/growth/audience'),
      ]);
      setPlan(p.data.data);
      setAudience(a.data.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const generateNow = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post('/agents/growth/strategic-plan/generate');
      setPlan(data.data);
      toast('Plano estratégico gerado');
    } catch { toast('Erro ao gerar plano', 'error'); }
    setGenerating(false);
  };

  const learnNow = async () => {
    setLearningNow(true);
    try {
      const { data } = await api.post('/agents/growth/audience/learn');
      toast(`Aprendizado: ${data.data?.processed || 0} insights`);
      load();
    } catch { toast('Erro', 'error'); }
    setLearningNow(false);
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Compass className="text-cyan-400" /> Strategic Command AI
          </h1>
          <p className="text-text-secondary mt-1">
            {plan ? `Plano ativo: ${plan.period}` : 'Nenhum plano ativo'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={learnNow} disabled={learningNow}>
            <Brain size={16} className="mr-1" /> {learningNow ? 'Aprendendo...' : 'Niche Learning'}
          </Button>
          <Button onClick={generateNow} disabled={generating}>
            <RefreshCw size={16} className={`mr-1 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Gerando...' : 'Gerar Plano'}
          </Button>
        </div>
      </div>

      {plan && (
        <>
          {/* Goals */}
          <Card><CardContent className="p-4">
            <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2"><Target size={18} className="text-red-400" /> Objetivos</h3>
            <div className="space-y-2">
              {(plan.goals || []).map((g: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2 rounded bg-surface-hover">
                  <span className="text-sm text-text-primary">{g.metric}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-secondary">Meta: {g.target}</span>
                    <Badge variant="default" className={g.priority === 'high' ? 'text-red-400' : g.priority === 'medium' ? 'text-yellow-400' : 'text-green-400'}>{g.priority}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent></Card>

          {/* Tactics */}
          <Card><CardContent className="p-4">
            <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2"><TrendingUp size={18} className="text-green-400" /> Táticas</h3>
            <div className="grid grid-cols-2 gap-3">
              {(plan.tactics || []).map((t: any, i: number) => (
                <div key={i} className="p-3 rounded-lg bg-surface-hover">
                  <p className="text-sm font-medium text-text-primary">{t.name}</p>
                  <p className="text-xs text-text-secondary mt-1">{t.description}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="default" className="text-xs">{t.channel}</Badge>
                    <span className="text-xs text-text-secondary">{t.frequency}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent></Card>

          {/* KPIs */}
          <Card><CardContent className="p-4">
            <h3 className="font-semibold text-text-primary mb-3">KPIs</h3>
            <div className="grid grid-cols-3 gap-3">
              {(plan.kpis || []).map((k: any, i: number) => (
                <div key={i} className="p-3 rounded-lg bg-surface-hover text-center">
                  <p className="text-xs text-text-secondary">{k.name}</p>
                  <p className="text-lg font-bold text-text-primary">{k.current || '-'}</p>
                  <p className="text-xs text-green-400">Meta: {k.target}</p>
                </div>
              ))}
            </div>
          </CardContent></Card>

          {/* Budget Allocation */}
          {plan.budgetAlloc && (
            <Card><CardContent className="p-4">
              <h3 className="font-semibold text-text-primary mb-3">Alocação de Budget</h3>
              <div className="flex gap-4">
                {Object.entries(plan.budgetAlloc).map(([key, val]) => (
                  <div key={key} className="flex-1 p-3 rounded-lg bg-surface-hover text-center">
                    <p className="text-xs text-text-secondary capitalize">{key}</p>
                    <p className="text-xl font-bold text-primary">{val as number}%</p>
                  </div>
                ))}
              </div>
            </CardContent></Card>
          )}
        </>
      )}

      {/* Audience Insights (Niche Learning) */}
      {audience && audience.total > 0 && (
        <Card><CardContent className="p-4">
          <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2"><Brain size={18} className="text-violet-400" /> Audience Insights ({audience.total})</h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(audience.byCategory || {}).map(([cat, items]: [string, any]) => (
              <div key={cat}>
                <Badge variant="default" className="mb-2 capitalize">{cat.replace('_', ' ')}</Badge>
                <div className="space-y-1">
                  {items.slice(0, 3).map((item: any) => (
                    <p key={item.id} className="text-xs text-text-secondary">
                      {item.insight} <span className="text-text-secondary/60">({Math.round(item.confidence * 100)}%)</span>
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}
    </div>
  );
}
