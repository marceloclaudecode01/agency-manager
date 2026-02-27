'use client';

import { useEffect, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import api from '@/lib/api';
import { Task } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Loading } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { Plus, Search } from 'lucide-react';
import { KanbanColumn } from '@/components/tasks/KanbanColumn';
import { TaskCard } from '@/components/tasks/TaskCard';

const columns = [
  { id: 'TODO', title: 'A Fazer', color: 'border-text-secondary' },
  { id: 'IN_PROGRESS', title: 'Em Progresso', color: 'border-warning' },
  { id: 'DONE', title: 'Concluído', color: 'border-success' },
];

export default function TasksPage() {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    assigneeId: '',
    campaignId: '',
    dueDate: '',
  });
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // PointerSensor for mouse/desktop, TouchSensor with delay for iOS Safari.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
  );

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

  // --- dnd-kit handlers ---

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    // Guard: nothing to drop on
    if (!over) return;

    const taskId = String(active.id);
    const newStatus = String(over.id) as Task['status'];

    // Find the task being dragged to get its current status
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Guard: same column — no API call needed
    if (task.status === newStatus) return;

    // Validate newStatus is a known column value
    const validStatuses: Task['status'][] = ['TODO', 'IN_PROGRESS', 'DONE'];
    if (!validStatuses.includes(newStatus)) return;

    // Snapshot current state for rollback on failure
    const previousTasks = tasks;

    // Optimistic update: move card immediately before API call
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
    );

    setPendingTaskId(taskId);
    try {
      await api.patch(`/tasks/${taskId}/status`, { status: newStatus });
      toast('Status da tarefa atualizado');
      loadData();
    } catch (err: unknown) {
      // Rollback to snapshot on API failure
      setTasks(previousTasks);
      const message =
        err instanceof Error ? err.message : 'Erro ao atualizar status da tarefa';
      toast(message, 'error');
    } finally {
      setPendingTaskId(null);
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  // -------------------------

  if (loading) return <Loading />;

  const filteredTasks = search
    ? tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(search.toLowerCase()) ||
          t.description?.toLowerCase().includes(search.toLowerCase()),
      )
    : tasks;

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) ?? null : null;

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

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {columns.map((col) => {
            const columnTasks = filteredTasks.filter((t) => t.status === col.id);
            return (
              <KanbanColumn
                key={col.id}
                id={col.id}
                title={col.title}
                color={col.color}
                count={columnTasks.length}
              >
                {columnTasks.map((task) => (
                  <TaskCard key={task.id} task={task} isPending={pendingTaskId === task.id} />
                ))}
              </KanbanColumn>
            );
          })}
        </div>

        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} overlay /> : null}
        </DragOverlay>
      </DndContext>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nova Tarefa">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Título *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <textarea
            placeholder="Descrição"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary"
          >
            <option value="LOW">Baixa</option>
            <option value="MEDIUM">Média</option>
            <option value="HIGH">Alta</option>
            <option value="URGENT">Urgente</option>
          </select>
          <select
            value={form.campaignId}
            onChange={(e) => setForm({ ...form, campaignId: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary"
          >
            <option value="">Sem campanha</option>
            {campaigns.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
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
