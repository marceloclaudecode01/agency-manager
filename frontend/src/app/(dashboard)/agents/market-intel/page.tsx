'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { Radar, RefreshCw, TrendingUp, AlertTriangle, Target, Eye } from 'lucide-react';

const TYPE_CONFIG: Record<string, { icon: any; color: string }> = {
  competitor: { icon: Eye, color: 'text-red-400' },
  trend: { icon: TrendingUp, color: 'text-green-400' },
  opportunity: { icon: Target, color: 'text-blue-400' },
  threat: { icon: AlertTriangle, color: 'text-orange-400' },
};

export default function MarketIntelPage() {
  const [insights, setInsights] = useState<any[]>([]);
  const [complianceStats, setComplianceStats] = useState<any>(null);
  const [variationStats, setVariationStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [gathering, setGathering] = useState(false);
  const [filter, setFilter] = useState<string>('');
  const { toast } = useToast();

  const load = async () => {
    try {
      const url = filter ? `/agents/growth/market-intel?type=${filter}` : '/agents/growth/market-intel';
      const [i, c, v] = await Promise.all([
        api.get(url),
        api.get('/agents/growth/compliance/stats'),
        api.get('/agents/growth/variation/stats'),
      ]);
      setInsights(i.data.data || []);
      setComplianceStats(c.data.data);
      setVariationStats(v.data.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const gatherNow = async () => {
    setGathering(true);
    try {
      const { data } = await api.post('/agents/growth/market-intel/gather');
      toast(`${data.data?.created || 0} insights coletados`);
      load();
    } catch { toast('Erro', 'error'); }
    setGathering(false);
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Radar className="text-emerald-400" /> Market Intelligence
          </h1>
          <p className="text-text-secondary mt-1">{insights.length} insights ativos</p>
        </div>
        <Button onClick={gatherNow} disabled={gathering}>
          <RefreshCw size={16} className={`mr-1 ${gathering ? 'animate-spin' : ''}`} />
          {gathering ? 'Coletando...' : 'Coletar Intel'}
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{complianceStats?.complianceRate || 100}%</p>
          <p className="text-xs text-text-secondary">Compliance Rate</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-purple-400">{variationStats?.diversityScore || 0}%</p>
          <p className="text-xs text-text-secondary">Content Diversity</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">{insights.length}</p>
          <p className="text-xs text-text-secondary">Active Insights</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['', 'competitor', 'trend', 'opportunity', 'threat'].map((t) => (
          <Button key={t} variant={filter === t ? 'primary' : 'outline'} size="sm" onClick={() => setFilter(t)}>
            {t || 'Todos'}
          </Button>
        ))}
      </div>

      {/* Insights Grid */}
      <div className="grid grid-cols-2 gap-4">
        {insights.map((insight: any) => {
          const config = TYPE_CONFIG[insight.type] || TYPE_CONFIG.trend;
          const Icon = config.icon;
          return (
            <Card key={insight.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className={config.color} />
                    <Badge variant="default" className="text-xs">{insight.type}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(10, insight.relevance) }).map((_, i) => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary" />
                    ))}
                  </div>
                </div>
                <h4 className="font-medium text-text-primary text-sm">{insight.title}</h4>
                <p className="text-xs text-text-secondary mt-1">{insight.summary}</p>
                {insight.details?.actionable && (
                  <p className="text-xs text-green-400 mt-2">Action: {insight.details.actionable}</p>
                )}
                <p className="text-[10px] text-text-secondary/60 mt-2">
                  {new Date(insight.createdAt).toLocaleDateString('pt-BR')}
                  {insight.expiresAt && ` | Expira: ${new Date(insight.expiresAt).toLocaleDateString('pt-BR')}`}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Content Type Mix (from variation stats) */}
      {variationStats?.contentTypeMix && Object.keys(variationStats.contentTypeMix).length > 0 && (
        <Card><CardContent className="p-4">
          <h3 className="font-semibold text-text-primary mb-3">Content Type Mix (últimos 30 posts)</h3>
          <div className="flex gap-3 flex-wrap">
            {Object.entries(variationStats.contentTypeMix).map(([type, count]) => (
              <div key={type} className="px-3 py-2 rounded-lg bg-surface-hover text-center">
                <p className="text-sm font-medium text-text-primary capitalize">{type}</p>
                <p className="text-xs text-text-secondary">{count as number}x</p>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}
    </div>
  );
}
