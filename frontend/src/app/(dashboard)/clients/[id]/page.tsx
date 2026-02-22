'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Client } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';

export default function ClientDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', status: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadClient();
  }, [id]);

  const loadClient = async () => {
    try {
      const { data } = await api.get(`/clients/${id}`);
      setClient(data.data);
      setForm({
        name: data.data.name || '',
        email: data.data.email || '',
        phone: data.data.phone || '',
        company: data.data.company || '',
        status: data.data.status,
        notes: data.data.notes || '',
      });
    } catch {
      router.push('/clients');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/clients/${id}`, form);
      setShowEdit(false);
      toast('Cliente atualizado com sucesso');
      loadClient();
    } catch {
      toast('Erro ao atualizar cliente', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/clients/${id}`);
      toast('Cliente excluído com sucesso');
      router.push('/clients');
    } catch {
      toast('Erro ao excluir cliente', 'error');
    }
  };

  if (loading) return <Loading />;
  if (!client) return null;

  const statusBadge: Record<string, { variant: any; label: string }> = {
    ACTIVE: { variant: 'success', label: 'Ativo' },
    INACTIVE: { variant: 'error', label: 'Inativo' },
    LEAD: { variant: 'warning', label: 'Lead' },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/clients')} className="text-text-secondary hover:text-text-primary">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-heading font-bold text-text-primary">{client.name}</h2>
            {client.company && <p className="text-text-secondary">{client.company}</p>}
          </div>
          <Badge variant={statusBadge[client.status]?.variant}>{statusBadge[client.status]?.label}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowEdit(true)}><Pencil size={16} className="mr-2" /> Editar</Button>
          <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}><Trash2 size={16} className="mr-2" /> Excluir</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle>Informações</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {client.email && <div><span className="text-text-secondary">Email:</span> <span className="text-text-primary ml-2">{client.email}</span></div>}
            {client.phone && <div><span className="text-text-secondary">Telefone:</span> <span className="text-text-primary ml-2">{client.phone}</span></div>}
            <div><span className="text-text-secondary">Criado em:</span> <span className="text-text-primary ml-2">{formatDate(client.createdAt)}</span></div>
            {client.notes && <div><span className="text-text-secondary">Notas:</span> <p className="text-text-primary mt-1">{client.notes}</p></div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Campanhas</CardTitle></CardHeader>
          <CardContent>
            {!client.campaigns?.length ? (
              <p className="text-sm text-text-secondary">Nenhuma campanha</p>
            ) : (
              <div className="space-y-2">
                {client.campaigns.map((c) => (
                  <Link key={c.id} href={`/campaigns/${c.id}`}>
                    <div className="flex items-center justify-between rounded-lg bg-surface-hover/50 p-2 hover:bg-surface-hover transition-colors">
                      <span className="text-sm text-text-primary">{c.name}</span>
                      <Badge variant={c.status === 'ACTIVE' ? 'success' : 'default'}>{c.status}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Faturas</CardTitle></CardHeader>
          <CardContent>
            {!client.invoices?.length ? (
              <p className="text-sm text-text-secondary">Nenhuma fatura</p>
            ) : (
              <div className="space-y-2">
                {client.invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between rounded-lg bg-surface-hover/50 p-2">
                    <span className="text-sm text-text-primary">{formatCurrency(inv.amount)}</span>
                    <Badge variant={inv.status === 'PAID' ? 'success' : inv.status === 'OVERDUE' ? 'error' : 'warning'}>{inv.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Editar Cliente">
        <form onSubmit={handleUpdate} className="space-y-4">
          <Input label="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Empresa" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary"
          >
            <option value="ACTIVE">Ativo</option>
            <option value="INACTIVE">Inativo</option>
            <option value="LEAD">Lead</option>
          </select>
          <textarea
            placeholder="Notas"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowEdit(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Confirmar Exclusão">
        <p className="text-sm text-text-secondary mb-6">
          Tem certeza que deseja excluir o cliente <strong className="text-text-primary">{client.name}</strong>? Esta ação não pode ser desfeita.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDelete}>Excluir</Button>
        </div>
      </Modal>
    </div>
  );
}
