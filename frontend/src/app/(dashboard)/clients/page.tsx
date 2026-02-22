'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Client } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Loading } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { Plus, Search, Building2 } from 'lucide-react';

const statusBadge = {
  ACTIVE: { variant: 'success' as const, label: 'Ativo' },
  INACTIVE: { variant: 'error' as const, label: 'Inativo' },
  LEAD: { variant: 'warning' as const, label: 'Lead' },
};

export default function ClientsPage() {
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', status: 'LEAD', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadClients();
  }, [search, filterStatus]);

  const loadClients = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterStatus) params.set('status', filterStatus);
      const { data } = await api.get(`/clients?${params}`);
      setClients(data.data || []);
    } catch {
      toast('Erro ao carregar clientes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/clients', form);
      setShowModal(false);
      setForm({ name: '', email: '', phone: '', company: '', status: 'LEAD', notes: '' });
      toast('Cliente criado com sucesso');
      loadClients();
    } catch {
      toast('Erro ao criar cliente', 'error');
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
              placeholder="Buscar clientes..."
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
            <option value="">Todos</option>
            <option value="ACTIVE">Ativo</option>
            <option value="INACTIVE">Inativo</option>
            <option value="LEAD">Lead</option>
          </select>
        </div>
        <Button onClick={() => setShowModal(true)} className="w-full sm:w-auto">
          <Plus size={18} className="mr-2" /> Novo Cliente
        </Button>
      </div>

      {loading ? (
        <Loading />
      ) : clients.length === 0 ? (
        <Card className="text-center py-12">
          <Building2 size={48} className="mx-auto text-text-secondary/30 mb-4" />
          <p className="text-text-secondary">Nenhum cliente encontrado</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <Link key={client.id} href={`/clients/${client.id}`}>
              <Card className="hover:border-primary/30 transition-colors cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-text-primary">{client.name}</h3>
                    {client.company && <p className="text-sm text-text-secondary">{client.company}</p>}
                  </div>
                  <Badge variant={statusBadge[client.status].variant}>
                    {statusBadge[client.status].label}
                  </Badge>
                </div>
                {client.email && <p className="text-sm text-text-secondary">{client.email}</p>}
                <div className="mt-3 flex gap-4 text-xs text-text-secondary">
                  <span>{client._count?.campaigns || 0} campanhas</span>
                  <span>{client._count?.invoices || 0} faturas</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Novo Cliente">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Nome *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Empresa" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Criar'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
