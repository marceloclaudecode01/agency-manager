'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { Coins, TrendingUp, Plus, Lightbulb, BarChart3 } from 'lucide-react';

export default function MonetizationPage() {
  const [funnelData, setFunnelData] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFunnelForm, setShowFunnelForm] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [funnelForm, setFunnelForm] = useState({ name: '', type: 'awareness', steps: '[]' });
  const [offerForm, setOfferForm] = useState({ name: '', type: 'product', price: '', description: '', ctaUrl: '', funnelId: '' });
  const { toast } = useToast();

  const load = async () => {
    try {
      const [f, o] = await Promise.all([
        api.get('/agents/growth/funnels'),
        api.get('/agents/growth/offers'),
      ]);
      setFunnelData(f.data.data);
      setOffers(o.data.data || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const getSuggestions = async () => {
    try {
      const { data } = await api.get('/agents/growth/monetization/suggestions');
      setSuggestions(data.data?.suggestions || []);
      toast('Sugestões geradas');
    } catch { toast('Erro', 'error'); }
  };

  const createFunnel = async () => {
    try {
      await api.post('/agents/growth/funnels', { ...funnelForm, steps: JSON.parse(funnelForm.steps || '[]') });
      toast('Funil criado');
      setShowFunnelForm(false);
      load();
    } catch { toast('Erro ao criar funil', 'error'); }
  };

  const createOffer = async () => {
    try {
      await api.post('/agents/growth/offers', {
        ...offerForm,
        price: offerForm.price ? parseFloat(offerForm.price) : null,
        funnelId: offerForm.funnelId || null,
      });
      toast('Oferta criada');
      setShowOfferForm(false);
      load();
    } catch { toast('Erro ao criar oferta', 'error'); }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Coins className="text-yellow-400" /> Monetization Engine
          </h1>
          <p className="text-text-secondary mt-1">
            {funnelData?.totalFunnels || 0} funis | R$ {(funnelData?.totalRevenue || 0).toLocaleString('pt-BR')} receita total
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={getSuggestions}><Lightbulb size={16} className="mr-1" /> Sugestões IA</Button>
          <Button variant="outline" onClick={() => setShowFunnelForm(!showFunnelForm)}><Plus size={16} className="mr-1" /> Funil</Button>
          <Button onClick={() => setShowOfferForm(!showOfferForm)}><Plus size={16} className="mr-1" /> Oferta</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{funnelData?.activeFunnels || 0}</p>
          <p className="text-xs text-text-secondary">Funis Ativos</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{offers.length}</p>
          <p className="text-xs text-text-secondary">Ofertas</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">R$ {(funnelData?.totalRevenue || 0).toLocaleString('pt-BR')}</p>
          <p className="text-xs text-text-secondary">Receita Total</p>
        </CardContent></Card>
      </div>

      {showFunnelForm && (
        <Card className="border-primary/30"><CardContent className="p-4 grid grid-cols-2 gap-3">
          <input className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary" placeholder="Nome do funil" value={funnelForm.name} onChange={(e) => setFunnelForm({ ...funnelForm, name: e.target.value })} />
          <select className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary" value={funnelForm.type} onChange={(e) => setFunnelForm({ ...funnelForm, type: e.target.value })}>
            <option value="awareness">Awareness</option><option value="consideration">Consideration</option>
            <option value="conversion">Conversion</option><option value="retention">Retention</option>
          </select>
          <Button onClick={createFunnel} className="col-span-2">Criar Funil</Button>
        </CardContent></Card>
      )}

      {showOfferForm && (
        <Card className="border-primary/30"><CardContent className="p-4 grid grid-cols-2 gap-3">
          <input className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary" placeholder="Nome da oferta" value={offerForm.name} onChange={(e) => setOfferForm({ ...offerForm, name: e.target.value })} />
          <select className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary" value={offerForm.type} onChange={(e) => setOfferForm({ ...offerForm, type: e.target.value })}>
            <option value="product">Produto</option><option value="service">Serviço</option>
            <option value="lead_magnet">Lead Magnet</option><option value="upsell">Upsell</option>
          </select>
          <input className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary" placeholder="Preço (R$)" value={offerForm.price} onChange={(e) => setOfferForm({ ...offerForm, price: e.target.value })} />
          <input className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary" placeholder="URL do CTA" value={offerForm.ctaUrl} onChange={(e) => setOfferForm({ ...offerForm, ctaUrl: e.target.value })} />
          <input className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary col-span-2" placeholder="Descrição" value={offerForm.description} onChange={(e) => setOfferForm({ ...offerForm, description: e.target.value })} />
          <Button onClick={createOffer} className="col-span-2">Criar Oferta</Button>
        </CardContent></Card>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <Card className="border-yellow-500/30"><CardContent className="p-4">
          <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2"><Lightbulb className="text-yellow-400" size={18} /> Sugestões IA</h3>
          <div className="space-y-2">
            {suggestions.map((s: any, i: number) => (
              <div key={i} className="p-3 rounded-lg bg-surface-hover">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="default">{s.type}</Badge>
                  <span className="font-medium text-sm text-text-primary">{s.name}</span>
                </div>
                <p className="text-xs text-text-secondary">{s.description}</p>
                <p className="text-xs text-green-400 mt-1">Receita est.: {s.estimatedRevenue} | Esforço: {s.effort}</p>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}

      {/* Funnels */}
      <h3 className="font-semibold text-text-primary">Funis</h3>
      <div className="grid grid-cols-2 gap-4">
        {(funnelData?.funnels || []).map((funnel: any) => (
          <Card key={funnel.id}><CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-text-primary">{funnel.name}</h4>
              <Badge variant="default">{funnel.type}</Badge>
            </div>
            <div className="flex gap-4 text-xs text-text-secondary">
              <span>Conv: {funnel.conversionRate.toFixed(1)}%</span>
              <span>Ofertas: {funnel.offers?.length || 0}</span>
              <span>{funnel.status}</span>
            </div>
          </CardContent></Card>
        ))}
      </div>

      {/* Offers */}
      <h3 className="font-semibold text-text-primary">Ofertas</h3>
      <div className="grid grid-cols-3 gap-4">
        {offers.map((offer: any) => (
          <Card key={offer.id}><CardContent className="p-4">
            <h4 className="font-medium text-text-primary text-sm">{offer.name}</h4>
            <div className="flex gap-3 text-xs text-text-secondary mt-2">
              <span>{offer.type}</span>
              {offer.price && <span>R$ {offer.price}</span>}
              <span>{offer.conversions} conv.</span>
              <span>R$ {offer.revenue}</span>
            </div>
          </CardContent></Card>
        ))}
      </div>
    </div>
  );
}
