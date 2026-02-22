'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Task } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Loading } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import Link from 'next/link';
import { Plus, GripVertical, Search } from 'lucide-react';

const columns = [
  { id: 'TODO', title: 'A Fazer', color: 'border-text-secondary' },
  { id: 'IN_PROGRESS', title: 'Em Progresso', color: 'border-warning' },
  { id: 'DONE', title: 'Concluído', color: 'border-success' },
];

const priorityBadge: Record<string, { variant: any; label: string }> = {
  LOW: { variant: 'default', label: 'Baixa' },
  MEDIUM: { variant: 'info', label: 'Média' },
  HIGH: { variant: 'warning', label: 'Alta' },
  URGENT: { variant: 'error', label: 'Urgente' },
};

export default function TasksPage() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM', assigneeId: '', campaignId: '', dueDate: '' });
  const [saving, setSaving] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [tasksRes, campRes] = await Promise.all([
        api.get('/tasks'),
        api.get('/campaigns'),
      ]);
      setTasks(tasksRes.data.data || []);
      setCampaigns(campRes.data.data || []);
    } catch {
      toast('Erro ao carregar tarefas', 'error');
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
        assigneeId: form.assigneeId || undefined,
        campaignId: form.campaignId || undefined,
        dueDate: form.dueDate || undefined,
      };
      await api.post('/tasks', payload);
      setShowModal(false);
      setForm({ title: '', description: '', priority: 'MEDIUM', assigneeId: '', campaignId: '', dueDate: '' });
      toast('Tarefa criada com sucesso');
      loadData();
    } catch {
      toast('Erro ao criar tarefa', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDrop = async (taskId: string, newStatus: string) => {
    try {
      await api.patch(`/tasks/${taskId}/status`, { status: newStatus });
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus as any } : t));
      toast('Status atualizado');
    } catch {
      toast('Erro ao atualizar status', 'error');
    }
    setDraggingId(null);
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative w-full sm:w-auto">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            placeholder="Buscar tarefas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64 rounded-lg border border-border bg-surface pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <Button onClick={() => setShowModal(true)} className="w-full sm:w-auto">
          <Plus size={18} className="mr-2" /> Nova Tarefa
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {columns.map((col) => {
          const filteredTasks = search
            ? tasks.filter((t) => t.title.toLowerCase().includes(search.toLowerCase()) || t.description?.toLowerCase().includes(search.toLowerCase()))
            : tasks;
          const columnTasks = filteredTasks.filter((t) => t.status === col.id);
          return (
            <div
              key={col.id}
              className="rounded-xl border border-border bg-surface/50 p-4"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => draggingId && handleDrop(draggingId, col.id)}
            >
              <div className={`flex items-center gap-2 mb-4 pb-3 border-b-2 ${col.color}`}>
                <h3 className="font-heading font-semibold text-text-primary">{col.title}</h3>
                <span className="text-xs text-text-secondary bg-surface-hover rounded-full px-2 py-0.5">{columnTasks.length}</span>
              </div>

              <div className="space-y-3 min-h-[200px]">
                {columnTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => setDraggingId(task.id)}
                    className="rounded-lg border border-border bg-surface p-3 cursor-grab active:cursor-grabbing hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <Link href={`/tasks/${task.id}`} className="text-sm font-medium text-text-primary flex-1 hover:text-primary-300 transition-colors">
                        {task.title}
                      </Link>
                      <GripVertical size={14} className="text-text-secondary/50 ml-2 flex-shrink-0" />
                    </div>
                    {task.description && <p className="text-xs text-text-secondary mb-2 line-clamp-2">{task.description}</p>}
                    <div className="flex items-center justify-between">
                      <Badge variant={priorityBadge[task.priority]?.variant}>{priorityBadge[task.priority]?.label}</Badge>
                      {task.assignee && (
                        <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary-300">
                          {task.assignee.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    {task.campaign && <p className="text-xs text-text-secondary mt-2">{task.campaign.name}</p>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nova Tarefa">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Título *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <textarea
            placeholder="Descrição"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary">
            <option value="LOW">Baixa</option>
            <option value="MEDIUM">Média</option>
            <option value="HIGH">Alta</option>
            <option value="URGENT">Urgente</option>
          </select>
          <select value={form.campaignId} onChange={(e) => setForm({ ...form, campaignId: e.target.value })} className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary">
            <option value="">Sem campanha</option>
            {campaigns.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Input label="Prazo" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Criar'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
