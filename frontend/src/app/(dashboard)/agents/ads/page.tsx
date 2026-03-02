'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { Zap, Plus, RefreshCw, DollarSign, Eye, MousePointerClick, Wand2 } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-500/20 text-gray-400',
  ACTIVE: 'bg-green-500/20 text-green-400',
  PAUSED: 'bg-yellow-500/20 text-yellow-400',
  COMPLETED: 'bg-blue-500/20 text-blue-400',
};

export default function AdsPage() {
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [generatingCreatives, setGeneratingCreatives] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', platform: 'meta', objective: 'traffic', budget: '', startDate: '', endDate: '' });
  const { toast } = useToast();

  const load = async () => {
    try {
      const { data } = await api.get('/agents/growth/ads');
      setDashboard(data.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const syncNow = async () => {
    setSyncing(true);
    try {
      await api.post('/agents/growth/ads/sync');
      toast('Sync concluído');
      load();
    } catch { toast('Erro', 'error'); }
    setSyncing(false);
  };

  const createCampaign = async () => {
    try {
      await api.post('/agents/growth/ads/campaigns', {
        ...form,
        budget: parseFloat(form.budget) || 0,
        startDate: form.startDate ? new Date(form.startDate) : null,
        endDate: form.endDate ? new Date(form.endDate) : null,
      });
      toast('Campanha criada');
      setShowForm(false);
      load();
    } catch { toast('Erro', 'error'); }
  };

  const genCreatives = async (campaignId: string) => {
    setGeneratingCreatives(campaignId);
    try {
      const { data } = await api.post('/agents/growth/ads/creatives', { campaignId, count: 3 });
      toast(`${data.data?.length || 0} criativos gerados`);
      load();
    } catch { toast('Erro ao gerar criativos', 'error'); }
    setGeneratingCreatives(null);
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Zap className="text-amber-400" /> Paid Traffic War Machine
          </h1>
          <p className="text-text-secondary mt-1">
            {dashboard?.activeCampaigns || 0} campanhas ativas | {dashboard?.totalCreatives || 0} criativos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={syncNow} disabled={syncing}>
            <RefreshCw size={16} className={`mr-1 ${syncing ? 'animate-spin' : ''}`} /> Sync
          </Button>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus size={16} className="mr-1" /> Campanha
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{dashboard?.totalCampaigns || 0}</p>
          <p className="text-xs text-text-secondary">Campanhas</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{dashboard?.activeCampaigns || 0}</p>
          <p className="text-xs text-text-secondary">Ativas</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">R$ {(dashboard?.totalBudget || 0).toLocaleString('pt-BR')}</p>
          <p className="text-xs text-text-secondary">Budget Total</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-red-400">R$ {(dashboard?.totalSpent || 0).toLocaleString('pt-BR')}</p>
          <p className="text-xs text-text-secondary">Gasto Total</p>
        </CardContent></Card>
      </div>

      {showForm && (
        <Card className="border-primary/30"><CardContent className="p-4 grid grid-cols-3 gap-3">
          <input className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary" placeholder="Nome da campanha" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
            <option value="meta">Meta Ads</option><option value="google">Google Ads</option><option value="tiktok">TikTok Ads</option>
          </select>
          <select className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary" value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })}>
            <option value="awareness">Awareness</option><option value="traffic">Traffic</option>
            <option value="conversions">Conversions</option><option value="leads">Leads</option>
          </select>
          <input className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary" placeholder="Budget (R$)" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
          <input className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          <input className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          <Button onClick={createCampaign} className="col-span-3">Criar Campanha</Button>
        </CardContent></Card>
      )}

      {/* Campaigns */}
      <div className="space-y-4">
        {(dashboard?.campaigns || []).map((campaign: any) => (
          <Card key={campaign.id} className="hover:border-primary/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h4 className="font-medium text-text-primary">{campaign.name}</h4>
                  <Badge className={STATUS_COLORS[campaign.status] || STATUS_COLORS.DRAFT}>{campaign.status}</Badge>
                  <Badge variant="default" className="text-xs">{campaign.platform}</Badge>
                  <Badge variant="default" className="text-xs">{campaign.objective}</Badge>
                </div>
                <Button variant="outline" size="sm" onClick={() => genCreatives(campaign.id)} disabled={generatingCreatives === campaign.id}>
                  <Wand2 size={14} className="mr-1" />
                  {generatingCreatives === campaign.id ? 'Gerando...' : 'Gerar Criativos'}
                </Button>
              </div>

              <div className="flex gap-6 text-sm text-text-secondary">
                <span className="flex items-center gap-1"><DollarSign size={14} /> Budget: R$ {campaign.budget}</span>
                <span className="flex items-center gap-1"><DollarSign size={14} className="text-red-400" /> Gasto: R$ {campaign.spent}</span>
                <span>{campaign.creatives?.length || 0} criativos</span>
              </div>

              {/* Creatives */}
              {campaign.creatives?.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {campaign.creatives.map((creative: any) => (
                    <div key={creative.id} className="p-2 rounded bg-surface-hover">
                      <p className="text-xs font-medium text-text-primary truncate">{creative.headline}</p>
                      <p className="text-[10px] text-text-secondary truncate">{creative.body}</p>
                      <div className="flex gap-1 mt-1">
                        <Badge variant="default" className="text-[9px]">{creative.type}</Badge>
                        <Badge variant="default" className="text-[9px]">{creative.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
