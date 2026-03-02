'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Globe, ShieldCheck, Shuffle, Eye } from 'lucide-react';

const TYPE_COLORS: Record<string, string> = {
  COMPETITOR: 'text-red-400 border-red-500/30 bg-red-500/10',
  TREND: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  OPPORTUNITY: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
  THREAT: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
};

interface IntelTabProps {
  marketIntel: any[];
  compliance: { score: number; total: number; passed: number };
  variation: { score: number; contentMix?: any[] };
  onGatherIntel: () => Promise<void>;
}

export function IntelTab({ marketIntel, compliance, variation, onGatherIntel }: IntelTabProps) {
  const [gathering, setGathering] = useState(false);

  const handleGather = async () => {
    setGathering(true);
    try { await onGatherIntel(); } finally { setGathering(false); }
  };

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/60 bg-surface/80 p-4 text-center">
          <p className={`text-2xl font-bold ${compliance.score >= 90 ? 'text-emerald-400' : compliance.score >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
            {compliance.score}%
          </p>
          <p className="text-xs text-text-secondary">Compliance</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-surface/80 p-4 text-center">
          <p className={`text-2xl font-bold ${variation.score >= 80 ? 'text-emerald-400' : variation.score >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
            {variation.score}%
          </p>
          <p className="text-xs text-text-secondary">Diversidade</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-surface/80 p-4 text-center">
          <p className="text-2xl font-bold text-text-primary">{marketIntel.length}</p>
          <p className="text-xs text-text-secondary">Insights</p>
        </div>
      </div>

      {/* Market Intel */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-heading font-semibold text-text-primary flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" /> Market Intelligence
          </h3>
          <Button size="sm" variant="outline" onClick={handleGather} disabled={gathering} className="gap-1.5">
            <Eye className="w-3.5 h-3.5" /> {gathering ? 'Coletando...' : 'Coletar Intel'}
          </Button>
        </div>
        {marketIntel.length === 0 ? (
          <p className="text-xs text-text-secondary/50">Nenhum insight de mercado</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {marketIntel.map((intel: any, i: number) => {
              const type = (intel.type || 'TREND').toUpperCase();
              const colorClass = TYPE_COLORS[type] || TYPE_COLORS.TREND;
              return (
                <div key={intel.id || i} className="rounded-lg border border-border/60 bg-surface/80 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-text-primary">{intel.title || intel.topic}</span>
                    <Badge className={`text-xs border ${colorClass}`}>{type}</Badge>
                  </div>
                  {intel.description && <p className="text-xs text-text-secondary">{intel.description}</p>}
                  <div className="flex gap-3 mt-1.5 text-xs text-text-secondary">
                    {intel.relevance != null && (
                      <div className="flex items-center gap-1">
                        <span>Relevância:</span>
                        <div className="w-16 h-1.5 bg-surface-hover rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${intel.relevance * 100}%` }} />
                        </div>
                      </div>
                    )}
                    {intel.expiresAt && <span>Exp: {new Date(intel.expiresAt).toLocaleDateString('pt-BR')}</span>}
                  </div>
                  {intel.recommendation && (
                    <p className="text-xs text-primary/80 mt-1">{intel.recommendation}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Compliance Details */}
      <div className="rounded-xl border border-border/60 bg-surface/80 p-4">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-heading font-semibold text-text-primary">Compliance</h3>
        </div>
        <p className="text-xs text-text-secondary">{compliance.passed}/{compliance.total} checks passaram</p>
      </div>

      {/* Content Mix */}
      {variation.contentMix && variation.contentMix.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-surface/80 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shuffle className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-heading font-semibold text-text-primary">Content Mix (30d)</h3>
          </div>
          <div className="flex gap-2 flex-wrap">
            {variation.contentMix.map((m: any, i: number) => (
              <Badge key={i} variant="default" className="text-xs">
                {m.type || m.name}: {m.count || m.percentage}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
