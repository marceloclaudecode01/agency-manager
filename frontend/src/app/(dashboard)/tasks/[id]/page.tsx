'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Task } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { formatDate } from '@/lib/utils';
import { ArrowLeft, Pencil, Trash2, Calendar, User, Flag, Megaphone } from 'lucide-react';

const statusBadge: Record<string, { variant: any; label: string }> = {
  TODO: { variant: 'default', label: 'A Fazer' },
  IN_PROGRESS: { variant: 'warning', label: 'Em Progresso' },
  DONE: { variant: 'success', label: 'Concluído' },
};

const priorityBadge: Record<string, { variant: any; label: string }> = {
  LOW: { variant: 'default', label: 'Baixa' },
  MEDIUM: { variant: 'info', label: 'Média' },
  HIGH: { variant: 'warning', label: 'Alta' },
  URGENT: { variant: 'error', label: 'Urgente' },
};

export default function TaskDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [task, setTask] = useState<Task | null>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', status: '', priority: '', campaignId: '', assigneeId: '', dueDate: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadTask(); }, [id]);

  const loadTask = async () => {
    try {
      const [taskRes, campRes, usersRes] = await Promise.all([
        api.get(`/tasks/${id}`),
        api.get('/campaigns'),
        api.get('/users'),
      ]);
      const t = taskRes.data.data;
      setTask(t);
      setCampaigns(campRes.data.data || []);
      setUsers(usersRes.data.data || []);
      setForm({
        title: t.title || '',
        description: t.description || '',
        status: t.status,
        priority: t.priority,
        campaignId: t.campaignId || '',
        assigneeId: t.assigneeId || '',
        dueDate: t.dueDate ? t.dueDate.split('T')[0] : '',
      });
    } catch {
      router.push('/tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/tasks/${id}`, {
        ...form,
        campaignId: form.campaignId || undefined,
        assigneeId: form.assigneeId || undefined,
        dueDate: form.dueDate || undefined,
      });
      setShowEdit(false);
      toast('Tarefa atualizada com sucesso');
      loadTask();
    } catch {
      toast('Erro ao atualizar tarefa', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/tasks/${id}`);
      toast('Tarefa excluída com sucesso');
      router.push('/tasks');
    } catch {
      toast('Erro ao excluir tarefa', 'error');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await api.patch(`/tasks/${id}/status`, { status: newStatus });
      toast('Status atualizado');
      loadTask();
    } catch {
      toast('Erro ao atualizar status', 'error');
    }
  };

  if (loading) return <Loading />;
  if (!task) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/tasks')} className="text-text-secondary hover:text-text-primary">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-heading font-bold text-text-primary">{task.title}</h2>
            {task.campaign && <p className="text-text-secondary">{task.campaign.name}</p>}
          </div>
          <Badge variant={statusBadge[task.status]?.variant}>{statusBadge[task.status]?.label}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowEdit(true)}><Pencil size={16} className="mr-2" /> Editar</Button>
          <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}><Trash2 size={16} className="mr-2" /> Excluir</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Detalhes</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {task.description ? (
              <p className="text-sm text-text-primary whitespace-pre-wrap">{task.description}</p>
            ) : (
              <p className="text-sm text-text-secondary italic">Sem descrição</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
              <div className="flex items-center gap-3">
                <Flag size={16} className="text-text-secondary" />
                <div>
                  <p className="text-xs text-text-secondary">Prioridade</p>
                  <Badge variant={priorityBadge[task.priority]?.variant}>{priorityBadge[task.priority]?.label}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-text-secondary" />
                <div>
                  <p className="text-xs text-text-secondary">Prazo</p>
                  <p className="text-sm text-text-primary">{task.dueDate ? formatDate(task.dueDate) : 'Sem prazo'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <User size={16} className="text-text-secondary" />
                <div>
                  <p className="text-xs text-text-secondary">Responsável</p>
                  <p className="text-sm text-text-primary">{task.assignee?.name || 'Não atribuído'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Megaphone size={16} className="text-text-secondary" />
                <div>
                  <p className="text-xs text-text-secondary">Campanha</p>
                  <p className="text-sm text-text-primary">{task.campaign?.name || 'Sem campanha'}</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-border">
              <p className="text-xs text-text-secondary mb-1">Criado em {formatDate(task.createdAt)}</p>
              <p className="text-xs text-text-secondary">Atualizado em {formatDate(task.updatedAt)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Alterar Status</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {['TODO', 'IN_PROGRESS', 'DONE'].map((s) => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                className={`w-full text-left rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                  task.status === s
                    ? 'bg-primary/10 text-primary-300 border border-primary/30'
                    : 'bg-surface-hover/50 text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                }`}
              >
                {statusBadge[s]?.label}
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Editar Tarefa">
        <form onSubmit={handleUpdate} className="space-y-4">
          <Input label="Título *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <textarea
            placeholder="Descrição"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary">
            <option value="TODO">A Fazer</option>
            <option value="IN_PROGRESS">Em Progresso</option>
            <option value="DONE">Concluído</option>
          </select>
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary">
            <option value="LOW">Baixa</option>
            <option value="MEDIUM">Média</option>
            <option value="HIGH">Alta</option>
            <option value="URGENT">Urgente</option>
          </select>
          <select value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })} className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary">
            <option value="">Sem responsável</option>
            {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select value={form.campaignId} onChange={(e) => setForm({ ...form, campaignId: e.target.value })} className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary">
            <option value="">Sem campanha</option>
            {campaigns.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Input label="Prazo" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowEdit(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Confirmar Exclusão">
        <p className="text-sm text-text-secondary mb-6">
          Tem certeza que deseja excluir a tarefa <strong className="text-text-primary">{task.title}</strong>? Esta ação não pode ser desfeita.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDelete}>Excluir</Button>
        </div>
      </Modal>
    </div>
  );
}
