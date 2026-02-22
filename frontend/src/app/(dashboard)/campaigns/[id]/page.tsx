'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Campaign } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';
import { ArrowLeft, Pencil, Trash2, Calendar, Target } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';

const statusBadge: Record<string, { variant: any; label: string }> = {
  PLANNING: { variant: 'info', label: 'Planejamento' },
  ACTIVE: { variant: 'success', label: 'Ativa' },
  PAUSED: { variant: 'warning', label: 'Pausada' },
  COMPLETED: { variant: 'purple', label: 'Concluída' },
  CANCELLED: { variant: 'error', label: 'Cancelada' },
};

export default function CampaignDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', status: '', budget: '', goals: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadCampaign(); }, [id]);

  const loadCampaign = async () => {
    try {
      const { data } = await api.get(`/campaigns/${id}`);
      setCampaign(data.data);
      setForm({
        name: data.data.name,
        description: data.data.description || '',
        status: data.data.status,
        budget: data.data.budget?.toString() || '',
        goals: data.data.goals || '',
      });
    } catch { router.push('/campaigns'); }
    finally { setLoading(false); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/campaigns/${id}`, { ...form, budget: form.budget ? parseFloat(form.budget) : undefined });
      setShowEdit(false);
      toast('Campanha atualizada com sucesso');
      loadCampaign();
    } catch {
      toast('Erro ao atualizar campanha', 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/campaigns/${id}`);
      toast('Campanha excluída com sucesso');
      router.push('/campaigns');
    } catch {
      toast('Erro ao excluir campanha', 'error');
    }
  };

  if (loading) return <Loading />;
  if (!campaign) return null;

  const totalTasks = campaign.tasks?.length || 0;
  const doneTasks = campaign.tasks?.filter((t) => t.status === 'DONE').length || 0;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/campaigns')} className="text-text-secondary hover:text-text-primary">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-heading font-bold text-text-primary">{campaign.name}</h2>
            <p className="text-text-secondary">{campaign.client?.name}</p>
          </div>
          <Badge variant={statusBadge[campaign.status]?.variant}>{statusBadge[campaign.status]?.label}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowEdit(true)}><Pencil size={16} className="mr-2" /> Editar</Button>
          <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}><Trash2 size={16} className="mr-2" /> Excluir</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent>
          <p className="text-sm text-text-secondary">Orçamento</p>
          <p className="text-2xl font-heading font-bold text-text-primary">{campaign.budget ? formatCurrency(campaign.budget) : '-'}</p>
        </CardContent></Card>
        <Card><CardContent>
          <p className="text-sm text-text-secondary">Progresso</p>
          <p className="text-2xl font-heading font-bold text-text-primary">{progress}%</p>
          <div className="mt-2 h-2 rounded-full bg-surface-hover">
            <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </CardContent></Card>
        <Card><CardContent>
          <p className="text-sm text-text-secondary">Tarefas</p>
          <p className="text-2xl font-heading font-bold text-text-primary">{doneTasks}/{totalTasks}</p>
        </CardContent></Card>
        <Card><CardContent>
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={14} className="text-text-secondary" />
            <p className="text-sm text-text-secondary">Período</p>
          </div>
          <p className="text-sm font-medium text-text-primary">
            {campaign.startDate ? formatDate(campaign.startDate) : 'Sem início'}
          </p>
          <p className="text-xs text-text-secondary">
            até {campaign.endDate ? formatDate(campaign.endDate) : 'Sem fim'}
          </p>
        </CardContent></Card>
      </div>

      {(campaign.description || campaign.goals) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {campaign.description && (
            <Card>
              <CardHeader><CardTitle>Descrição</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm text-text-primary whitespace-pre-wrap">{campaign.description}</p>
              </CardContent>
            </Card>
          )}
          {campaign.goals && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Target size={18} className="text-primary-300" />
                  <CardTitle>Objetivos</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-text-primary whitespace-pre-wrap">{campaign.goals}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Tarefas</CardTitle></CardHeader>
        <CardContent>
          {!campaign.tasks?.length ? (
            <p className="text-sm text-text-secondary">Nenhuma tarefa vinculada</p>
          ) : (
            <div className="space-y-2">
              {campaign.tasks.map((t) => (
                <Link key={t.id} href={`/tasks/${t.id}`}>
                  <div className="flex items-center justify-between rounded-lg bg-surface-hover/50 p-3 hover:bg-surface-hover transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${t.status === 'DONE' ? 'bg-success' : t.status === 'IN_PROGRESS' ? 'bg-warning' : 'bg-text-secondary'}`} />
                      <span className="text-sm text-text-primary">{t.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {t.assignee && <span className="text-xs text-text-secondary">{t.assignee.name}</span>}
                      <Badge variant={t.priority === 'URGENT' ? 'error' : t.priority === 'HIGH' ? 'warning' : 'default'}>{t.priority}</Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Editar Campanha">
        <form onSubmit={handleUpdate} className="space-y-4">
          <Input label="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary">
            <option value="PLANNING">Planejamento</option>
            <option value="ACTIVE">Ativa</option>
            <option value="PAUSED">Pausada</option>
            <option value="COMPLETED">Concluída</option>
            <option value="CANCELLED">Cancelada</option>
          </select>
          <Input label="Orçamento" type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
          <textarea
            placeholder="Descrição"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <textarea
            placeholder="Objetivos"
            value={form.goals}
            onChange={(e) => setForm({ ...form, goals: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary min-h-[60px] focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowEdit(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Confirmar Exclusão">
        <p className="text-sm text-text-secondary mb-6">
          Tem certeza que deseja excluir a campanha <strong className="text-text-primary">{campaign.name}</strong>? Esta ação não pode ser desfeita.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDelete}>Excluir</Button>
        </div>
      </Modal>
    </div>
  );
}
