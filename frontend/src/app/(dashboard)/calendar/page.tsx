'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { CalendarEvent } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Loading } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

const eventColors: Record<string, { variant: any; label: string; bg: string }> = {
  MEETING: { variant: 'info', label: 'Reunião', bg: 'bg-blue-500' },
  DEADLINE: { variant: 'error', label: 'Prazo', bg: 'bg-error' },
  DELIVERY: { variant: 'success', label: 'Entrega', bg: 'bg-success' },
  OTHER: { variant: 'default', label: 'Outro', bg: 'bg-text-secondary' },
};

const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function CalendarPage() {
  const { toast } = useToast();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', type: 'OTHER', date: '', endDate: '', campaignId: '' });
  const [saving, setSaving] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => { loadData(); }, [year, month]);

  const loadData = async () => {
    try {
      const [eventsRes, campRes] = await Promise.all([
        api.get(`/calendar?year=${year}&month=${month + 1}`),
        api.get('/campaigns'),
      ]);
      setEvents(eventsRes.data.data || []);
      setCampaigns(campRes.data.data || []);
    } catch {
      toast('Erro ao carregar calendário', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/calendar', { ...form, campaignId: form.campaignId || undefined, endDate: form.endDate || undefined, description: form.description || undefined });
      setShowModal(false);
      setForm({ title: '', description: '', type: 'OTHER', date: '', endDate: '', campaignId: '' });
      toast('Evento criado com sucesso');
      loadData();
    } catch {
      toast('Erro ao criar evento', 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/calendar/${id}`);
      toast('Evento excluído com sucesso');
      setShowDeleteConfirm(null);
      loadData();
    } catch {
      toast('Erro ao excluir evento', 'error');
    }
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1));

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const getEventsForDay = (day: number) => {
    return events.filter((e) => {
      const d = new Date(e.date);
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
    });
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-surface-hover text-text-secondary"><ChevronLeft size={20} /></button>
          <h2 className="text-xl font-heading font-semibold text-text-primary w-52 text-center">{months[month]} {year}</h2>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-surface-hover text-text-secondary"><ChevronRight size={20} /></button>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={18} className="mr-2" /> Novo Evento
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="grid grid-cols-7">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
            <div key={d} className="px-2 py-3 text-center text-xs font-medium text-text-secondary border-b border-border bg-surface-hover/30">{d}</div>
          ))}
          {days.map((day, i) => {
            const dayEvents = day ? getEventsForDay(day) : [];
            const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
            return (
              <div key={i} className={`min-h-[80px] md:min-h-[100px] border-b border-r border-border p-1 ${!day ? 'bg-surface-hover/10' : ''}`}>
                {day && (
                  <>
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm ${isToday ? 'bg-primary text-white font-bold' : 'text-text-secondary'}`}>{day}</span>
                    <div className="mt-1 space-y-1">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <div key={ev.id} className={`text-xs px-1.5 py-0.5 rounded truncate text-white ${eventColors[ev.type]?.bg || 'bg-text-secondary'}`} title={ev.title}>
                          {ev.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && <span className="text-xs text-text-secondary">+{dayEvents.length - 3} mais</span>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <CalendarIcon size={20} className="text-primary-300" />
          <h3 className="font-heading font-semibold text-text-primary">Eventos do Mês</h3>
        </div>
        {events.length === 0 ? (
          <p className="text-sm text-text-secondary">Nenhum evento neste mês</p>
        ) : (
          <div className="space-y-2">
            {events.map((ev) => (
              <div key={ev.id} className="flex items-center justify-between rounded-lg bg-surface-hover/50 p-3">
                <div className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${eventColors[ev.type]?.bg}`} />
                  <div>
                    <p className="text-sm font-medium text-text-primary">{ev.title}</p>
                    <p className="text-xs text-text-secondary">
                      {new Date(ev.date).toLocaleDateString('pt-BR')}
                      {ev.campaign && ` · ${ev.campaign.name}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={eventColors[ev.type]?.variant}>{eventColors[ev.type]?.label}</Badge>
                  <button onClick={() => setShowDeleteConfirm(ev.id)} className="text-xs text-error hover:text-red-400">Excluir</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Novo Evento">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Título *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-text-secondary">Descrição</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" placeholder="Detalhes do evento..." />
          </div>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary">
            <option value="MEETING">Reunião</option>
            <option value="DEADLINE">Prazo</option>
            <option value="DELIVERY">Entrega</option>
            <option value="OTHER">Outro</option>
          </select>
          <Input label="Data *" type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          <Input label="Data Final" type="datetime-local" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          <select value={form.campaignId} onChange={(e) => setForm({ ...form, campaignId: e.target.value })} className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary">
            <option value="">Sem campanha</option>
            {campaigns.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Criar'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)} title="Confirmar Exclusão">
        <p className="text-sm text-text-secondary mb-6">Tem certeza que deseja excluir este evento? Esta ação não pode ser desfeita.</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}>Excluir</Button>
        </div>
      </Modal>
    </div>
  );
}
