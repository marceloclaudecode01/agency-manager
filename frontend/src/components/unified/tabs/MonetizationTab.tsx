'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Plus, Lightbulb, ShoppingBag } from 'lucide-react';

const FUNNEL_TYPES = ['AWARENESS', 'CONSIDERATION', 'CONVERSION', 'RETENTION'] as const;
const OFFER_TYPES = ['PRODUCT', 'SERVICE', 'LEAD_MAGNET', 'UPSELL'] as const;

interface MonetizationTabProps {
  funnels: any[];
  offers: any[];
  suggestions: any[];
  onCreateFunnel: (d: any) => Promise<void>;
  onCreateOffer: (d: any) => Promise<void>;
}

export function MonetizationTab({ funnels, offers, suggestions, onCreateFunnel, onCreateOffer }: MonetizationTabProps) {
  const [showFunnelForm, setShowFunnelForm] = useState(false);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [funnelForm, setFunnelForm] = useState({ name: '', type: 'AWARENESS' as string, description: '' });
  const [offerForm, setOfferForm] = useState({ name: '', type: 'PRODUCT' as string, price: '', description: '' });

  const totalRevenue = funnels.reduce((s: number, f: any) => s + (f.revenue || 0), 0);

  const handleCreateFunnel = async () => {
    if (!funnelForm.name.trim()) return;
    await onCreateFunnel(funnelForm);
    setFunnelForm({ name: '', type: 'AWARENESS', description: '' });
    setShowFunnelForm(false);
  };

  const handleCreateOffer = async () => {
    if (!offerForm.name.trim()) return;
    await onCreateOffer({ ...offerForm, price: parseFloat(offerForm.price) || 0 });
    setOfferForm({ name: '', type: 'PRODUCT', price: '', description: '' });
    setShowOfferForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/60 bg-surface/80 p-4 text-center">
          <p className="text-2xl font-bold text-text-primary">{funnels.length}</p>
          <p className="text-xs text-text-secondary">Funis Ativos</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-surface/80 p-4 text-center">
          <p className="text-2xl font-bold text-text-primary">{offers.length}</p>
          <p className="text-xs text-text-secondary">Ofertas</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-surface/80 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">R$ {totalRevenue.toLocaleString('pt-BR')}</p>
          <p className="text-xs text-text-secondary">Revenue Total</p>
        </div>
      </div>

      {/* Funnels */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-heading font-semibold text-text-primary flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" /> Funis
          </h3>
          <Button size="sm" onClick={() => setShowFunnelForm(!showFunnelForm)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Novo Funil
          </Button>
        </div>
        {showFunnelForm && (
          <div className="rounded-xl border border-border/60 bg-surface/80 p-4 space-y-3 mb-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input value={funnelForm.name} onChange={e => setFunnelForm({ ...funnelForm, name: e.target.value })} placeholder="Nome do funil *" className="bg-surface-hover border border-border/60 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/50" />
              <select value={funnelForm.type} onChange={e => setFunnelForm({ ...funnelForm, type: e.target.value })} className="bg-surface-hover border border-border/60 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/50">
                {FUNNEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input value={funnelForm.description} onChange={e => setFunnelForm({ ...funnelForm, description: e.target.value })} placeholder="Descrição" className="bg-surface-hover border border-border/60 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/50" />
            </div>
            <Button size="sm" onClick={handleCreateFunnel} disabled={!funnelForm.name.trim()}>Criar Funil</Button>
          </div>
        )}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {funnels.map((f: any) => (
            <div key={f.id} className="rounded-lg border border-border/60 bg-surface/80 p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">{f.name}</p>
                <p className="text-xs text-text-secondary">{f.type} {f.revenue ? `— R$ ${f.revenue.toLocaleString('pt-BR')}` : ''}</p>
              </div>
              <Badge variant={f.status === 'ACTIVE' ? 'success' : 'default'} className="text-xs">{f.status || 'ACTIVE'}</Badge>
            </div>
          ))}
          {funnels.length === 0 && <p className="text-xs text-text-secondary/50">Nenhum funil criado</p>}
        </div>
      </div>

      {/* Offers */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-heading font-semibold text-text-primary flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-violet-400" /> Ofertas
          </h3>
          <Button size="sm" onClick={() => setShowOfferForm(!showOfferForm)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Nova Oferta
          </Button>
        </div>
        {showOfferForm && (
          <div className="rounded-xl border border-border/60 bg-surface/80 p-4 space-y-3 mb-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input value={offerForm.name} onChange={e => setOfferForm({ ...offerForm, name: e.target.value })} placeholder="Nome *" className="bg-surface-hover border border-border/60 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/50" />
              <select value={offerForm.type} onChange={e => setOfferForm({ ...offerForm, type: e.target.value })} className="bg-surface-hover border border-border/60 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/50">
                {OFFER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input value={offerForm.price} onChange={e => setOfferForm({ ...offerForm, price: e.target.value })} placeholder="Preço" type="number" className="bg-surface-hover border border-border/60 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/50" />
              <input value={offerForm.description} onChange={e => setOfferForm({ ...offerForm, description: e.target.value })} placeholder="Descrição" className="bg-surface-hover border border-border/60 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/50" />
            </div>
            <Button size="sm" onClick={handleCreateOffer} disabled={!offerForm.name.trim()}>Criar Oferta</Button>
          </div>
        )}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {offers.map((o: any) => (
            <div key={o.id} className="rounded-lg border border-border/60 bg-surface/80 p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">{o.name}</p>
                <p className="text-xs text-text-secondary">{o.type} {o.price ? `— R$ ${o.price}` : ''}</p>
              </div>
              <Badge variant="default" className="text-xs">{o.status || o.type}</Badge>
            </div>
          ))}
          {offers.length === 0 && <p className="text-xs text-text-secondary/50">Nenhuma oferta criada</p>}
        </div>
      </div>

      {/* AI Suggestions */}
      {suggestions.length > 0 && (
        <div>
          <h3 className="text-sm font-heading font-semibold text-text-primary flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-yellow-400" /> Sugestões IA
          </h3>
          <div className="space-y-2">
            {suggestions.map((s: any, i: number) => (
              <div key={i} className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
                <p className="text-sm text-text-primary">{s.suggestion || s.description || s.name}</p>
                <div className="flex gap-3 mt-1 text-xs text-text-secondary">
                  {s.estimatedRevenue && <span className="text-emerald-400">Est. R$ {s.estimatedRevenue}</span>}
                  {s.effort && <span>Esforço: {s.effort}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
