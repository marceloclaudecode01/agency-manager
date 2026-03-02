'use client';

import { Badge } from '@/components/ui/badge';
import { Megaphone, Calendar } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  status: string;
  startDate?: string;
  endDate?: string;
  postsGenerated?: number;
  postsPublished?: number;
}

interface CampaignsPanelProps {
  campaigns: Campaign[];
}

export function CampaignsPanel({ campaigns }: CampaignsPanelProps) {
  if (campaigns.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-surface/80 backdrop-blur-sm p-6 text-center">
        <Megaphone className="w-8 h-8 text-text-secondary/30 mx-auto mb-2" />
        <p className="text-sm text-text-secondary/50">Nenhuma campanha ativa</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {campaigns.map((c) => {
        const statusVariant = c.status === 'ACTIVE' ? 'success' : c.status === 'PAUSED' ? 'warning' : 'default';
        return (
          <div key={c.id} className="rounded-xl border border-border/60 bg-surface/80 backdrop-blur-sm p-4 hover:border-primary/30 transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">{c.name}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
                  {c.startDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(c.startDate).toLocaleDateString('pt-BR')}
                      {c.endDate && ` — ${new Date(c.endDate).toLocaleDateString('pt-BR')}`}
                    </span>
                  )}
                  {c.postsPublished != null && (
                    <span>{c.postsPublished}/{c.postsGenerated || 0} posts</span>
                  )}
                </div>
              </div>
              <Badge variant={statusVariant} className="text-xs">{c.status}</Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}
