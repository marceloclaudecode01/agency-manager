'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Campaign } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Loading } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils';
import { Plus, Megaphone, Search } from 'lucide-react';

const statusBadge: Record<string, { variant: any; label: string }> = {
  PLANNING: { variant: 'info', label: 'Planejamento' },
  ACTIVE: { variant: 'success', label: 'Ativa' },
  PAUSED: { variant: 'warning', label: 'Pausada' },
  COMPLETED: { variant: 'purple', label: 'Concluída' },
  CANCELLED: { variant: 'error', label: 'Cancelada' },
};

export default function CampaignsPage() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', clientId: '', description: '', startDate: '', endDate: '', budget: '', goals: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [filterStatus, search]);

  const loadData = async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (search) params.set('search', search);
      const [campRes, clientRes] = await Promise.all([
        api.get(`/campaigns?${params}`),
        api.get('/clients'),
      ]);
      setCampaigns(campRes.data.data || []);
      setClients(clientRes.data.data || []);
    } catch {
      toast('Erro ao carregar campanhas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        budget: form.budget ? parseFloat(form.budget) : undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
      };
      await api.post('/campaigns', payload);
      setShowModal(false);
      setForm({ name: '', clientId: '', description: '', startDate: '', endDate: '', budget: '', goals: '' });
      toast('Campanha criada com sucesso');
      loadData();
    } catch {
      toast('Erro ao criar campanha', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-auto">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              placeholder="Buscar campanhas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-auto rounded-lg border border-border bg-surface pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full sm:w-auto rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">Todos os status</option>
            <option value="PLANNING">Planejamento</option>
            <option value="ACTIVE">Ativa</option>
            <option value="PAUSED">Pausada</option>
            <option value="COMPLETED">Concluída</option>
            <option value="CANCELLED">Cancelada</option>
          </select>
        </div>
        <Button onClick={() => setShowModal(true)} className="w-full sm:w-auto">
          <Plus size={18} className="mr-2" /> Nova Campanha
        </Button>
      </div>

      {loading ? (
        <Loading />
      ) : campaigns.length === 0 ? (
        <Card className="text-center py-12">
          <Megaphone size={48} className="mx-auto text-text-secondary/30 mb-4" />
          <p className="text-text-secondary">Nenhuma campanha encontrada</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((campaign) => (
            <Link key={campaign.id} href={`/campaigns/${campaign.id}`}>
              <Card className="hover:border-primary/30 transition-colors cursor-pointer">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-text-primary">{campaign.name}</h3>
                  <Badge variant={statusBadge[campaign.status]?.variant}>
                    {statusBadge[campaign.status]?.label}
                  </Badge>
                </div>
                <p className="text-sm text-text-secondary mb-3">{campaign.client?.name}</p>
                <div className="flex gap-4 text-xs text-text-secondary">
                  {campaign.budget && <span>{formatCurrency(campaign.budget)}</span>}
                  <span>{campaign._count?.tasks || 0} tarefas</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nova Campanha">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Nome *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-text-secondary">Cliente *</label>
            <select
              value={form.clientId}
              onChange={(e) => setForm({ ...form, clientId: e.target.value })}
              className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary"
              required
            >
              <option value="">Selecionar cliente</option>
              {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Input label="Orçamento" type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Início" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <Input label="Fim" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Criar'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
