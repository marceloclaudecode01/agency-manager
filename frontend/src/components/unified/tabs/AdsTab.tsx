'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Megaphone, Plus, RefreshCw, Wand2 } from 'lucide-react';

const PLATFORMS = ['META', 'GOOGLE', 'TIKTOK'] as const;
const OBJECTIVES = ['AWARENESS', 'TRAFFIC', 'CONVERSIONS', 'LEADS'] as const;

interface AdsTabProps {
  ads: { campaigns: any[]; totalSpend: number; totalBudget: number; activeCount: number };
  onSyncAds: () => Promise<void>;
  onCreateCampaign: (d: any) => Promise<void>;
  onGenerateCreatives: (campaignId: string) => Promise<void>;
}

export function AdsTab({ ads, onSyncAds, onCreateCampaign, onGenerateCreatives }: AdsTabProps) {
  const [syncing, setSyncing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', platform: 'META' as string, objective: 'AWARENESS' as string, budget: '', startDate: '', endDate: '' });
  const [genLoading, setGenLoading] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    try { await onSyncAds(); } finally { setSyncing(false); }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    await onCreateCampaign({ ...form, budget: parseFloat(form.budget) || 0 });
    setForm({ name: '', platform: 'META', objective: 'AWARENESS', budget: '', startDate: '', endDate: '' });
    setShowForm(false);
  };

  const handleCreatives = async (id: string) => {
    setGenLoading(id);
    try { await onGenerateCreatives(id); } finally { setGenLoading(null); }
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/60 bg-surface/80 p-4 text-center">
          <p className="text-2xl font-bold text-text-primary">{ads.campaigns.length}</p>
          <p className="text-xs text-text-secondary">Campanhas</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-surface/80 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{ads.activeCount}</p>
          <p className="text-xs text-text-secondary">Ativas</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-surface/80 p-4 text-center">
          <p className="text-2xl font-bold text-text-primary">R$ {ads.totalBudget.toLocaleString('pt-BR')}</p>
          <p className="text-xs text-text-secondary">Budget Total</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-surface/80 p-4 text-center">
          <p className="text-2xl font-bold text-orange-400">R$ {ads.totalSpend.toLocaleString('pt-BR')}</p>
          <p className="text-xs text-text-secondary">Gasto</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing} className="gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} /> {syncing ? 'Sincronizando...' : 'Sync Ads'}
        </Button>
        <Button size="sm" onClick={() => setShowForm(!showForm)} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Nova Campanha
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border border-border/60 bg-surface/80 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome da campanha *" className="bg-surface-hover border border-border/60 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/50" />
            <select value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })} className="bg-surface-hover border border-border/60 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/50">
              {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={form.objective} onChange={e => setForm({ ...form, objective: e.target.value })} className="bg-surface-hover border border-border/60 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/50">
              {OBJECTIVES.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <input value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} placeholder="Budget (R$)" type="number" className="bg-surface-hover border border-border/60 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/50" />
            <input value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} type="date" className="bg-surface-hover border border-border/60 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/50" />
            <input value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} type="date" className="bg-surface-hover border border-border/60 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/50" />
          </div>
          <Button size="sm" onClick={handleCreate} disabled={!form.name.trim()}>Criar Campanha</Button>
        </div>
      )}

      {/* Campaigns */}
      <div className="space-y-3">
        {ads.campaigns.map((c: any) => {
          const statusV = c.status === 'ACTIVE' ? 'success' : c.status === 'PAUSED' ? 'warning' : 'default';
          return (
            <div key={c.id} className="rounded-xl border border-border/60 bg-surface/80 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{c.name}</p>
                  <div className="flex gap-2 mt-1 text-xs text-text-secondary">
                    <Badge variant="default" className="text-xs">{c.platform}</Badge>
                    <Badge variant="default" className="text-xs">{c.objective}</Badge>
                    {c.budget && <span>R$ {c.budget.toLocaleString('pt-BR')}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCreatives(c.id)}
                    disabled={genLoading === c.id}
                    className="gap-1"
                  >
                    <Wand2 className="w-3.5 h-3.5" /> {genLoading === c.id ? '...' : 'Criativos'}
                  </Button>
                  <Badge variant={statusV} className="text-xs">{c.status || 'DRAFT'}</Badge>
                </div>
              </div>
              {c.creatives && c.creatives.length > 0 && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                  {c.creatives.map((cr: any, i: number) => (
                    <div key={cr.id || i} className="rounded-lg bg-surface-hover p-2 text-xs">
                      <p className="font-semibold text-text-primary truncate">{cr.headline}</p>
                      <p className="text-text-secondary truncate">{cr.body}</p>
                      <div className="flex gap-1 mt-1">
                        {cr.type && <Badge variant="default" className="text-[10px]">{cr.type}</Badge>}
                        {cr.status && <Badge variant={cr.status === 'ACTIVE' ? 'success' : 'default'} className="text-[10px]">{cr.status}</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {ads.campaigns.length === 0 && <p className="text-xs text-text-secondary/50">Nenhuma campanha de ads</p>}
      </div>
    </div>
  );
}
