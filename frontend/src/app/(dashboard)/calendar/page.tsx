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
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Image, Clock, Eye } from 'lucide-react';

interface ScheduledPost {
  id: string;
  topic: string;
  message: string;
  hashtags?: string | null;
  imageUrl?: string | null;
  scheduledFor: string;
  status: string;
  publishedAt?: string | null;
  source?: string | null;
  contentType?: string | null;
  governorDecision?: string | null;
}

const eventColors: Record<string, { variant: any; label: string; bg: string }> = {
  MEETING: { variant: 'info', label: 'Reunião', bg: 'bg-blue-500' },
  DEADLINE: { variant: 'error', label: 'Prazo', bg: 'bg-error' },
  DELIVERY: { variant: 'success', label: 'Entrega', bg: 'bg-success' },
  OTHER: { variant: 'default', label: 'Outro', bg: 'bg-text-secondary' },
};

const postStatusColors: Record<string, { label: string; bg: string; variant: any }> = {
  PENDING: { label: 'Pendente', bg: 'bg-yellow-500', variant: 'warning' },
  APPROVED: { label: 'Aprovado', bg: 'bg-blue-500', variant: 'info' },
  PUBLISHED: { label: 'Publicado', bg: 'bg-green-500', variant: 'success' },
  REJECTED: { label: 'Rejeitado', bg: 'bg-red-500', variant: 'error' },
  FAILED: { label: 'Falhou', bg: 'bg-red-500', variant: 'error' },
};

const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function CalendarPage() {
  const { toast } = useToast();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [form, setForm] = useState({ title: '', description: '', type: 'OTHER', date: '', endDate: '', campaignId: '' });
  const [saving, setSaving] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => { loadData(); }, [year, month]);

  const loadData = async () => {
    try {
      const [eventsRes, campRes, postsRes] = await Promise.all([
        api.get(`/calendar?year=${year}&month=${month + 1}`),
        api.get('/campaigns'),
        api.get('/agents/scheduled'),
      ]);
      setEvents(eventsRes.data.data || []);
      setCampaigns(campRes.data.data || []);
      setScheduledPosts(postsRes.data.data || []);
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

  const getPostsForDay = (day: number) => {
    return scheduledPosts.filter((p) => {
      const d = new Date(p.scheduledFor);
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
    });
  };

  const getMonthPosts = () => {
    return scheduledPosts.filter((p) => {
      const d = new Date(p.scheduledFor);
      return d.getMonth() === month && d.getFullYear() === year;
    }).sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
  };

  if (loading) return <Loading />;

  const monthPosts = getMonthPosts();

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

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(eventColors).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`h-2.5 w-2.5 rounded-full ${val.bg}`} />
            <span className="text-text-secondary">{val.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-purple-500" />
          <span className="text-text-secondary">Post Agendado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
          <span className="text-text-secondary">Publicado</span>
        </div>
      </div>

      <Card className="p-0 overflow-hidden bg-surface/80 backdrop-blur-sm border-border/60">
        <div className="grid grid-cols-7">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
            <div key={d} className="px-2 py-3 text-center text-xs font-medium text-text-secondary border-b border-border/60 bg-surface-hover/30">{d}</div>
          ))}
          {days.map((day, i) => {
            const dayEvents = day ? getEventsForDay(day) : [];
            const dayPosts = day ? getPostsForDay(day) : [];
            const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
            const totalItems = dayEvents.length + dayPosts.length;
            return (
              <div key={i} className={`min-h-[80px] md:min-h-[100px] border-b border-r border-border p-1 ${!day ? 'bg-surface-hover/10' : ''}`}>
                {day && (
                  <>
                    <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm ${isToday ? 'bg-primary text-white font-bold' : 'text-text-secondary'}`}>{day}</span>
                    <div className="mt-1 space-y-0.5">
                      {dayEvents.slice(0, 2).map((ev) => (
                        <div key={ev.id} className={`text-[10px] px-1 py-0.5 rounded truncate text-white ${eventColors[ev.type]?.bg || 'bg-text-secondary'}`} title={ev.title}>
                          {ev.title}
                        </div>
                      ))}
                      {dayPosts.slice(0, 2).map((post) => (
                        <div
                          key={post.id}
                          onClick={() => setSelectedPost(post)}
                          className={`text-[10px] px-1 py-0.5 rounded truncate text-white cursor-pointer hover:opacity-80 flex items-center gap-0.5 ${post.status === 'PUBLISHED' ? 'bg-green-500' : 'bg-purple-500'}`}
                          title={`${post.topic} (${postStatusColors[post.status]?.label || post.status})`}
                        >
                          {post.imageUrl && <Image size={8} className="shrink-0" />}
                          {post.topic || post.message.substring(0, 20)}
                        </div>
                      ))}
                      {totalItems > 4 && <span className="text-[10px] text-text-secondary">+{totalItems - 4} mais</span>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Scheduled Posts this month */}
      {monthPosts.length > 0 && (
        <Card className="bg-surface/80 backdrop-blur-sm border-border/60">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={20} className="text-purple-400" />
            <h3 className="font-heading font-semibold text-text-primary">Publicações do Mês</h3>
            <Badge variant="default">{monthPosts.length}</Badge>
          </div>
          <div className="space-y-2">
            {monthPosts.map((post) => {
              const statusInfo = postStatusColors[post.status] || postStatusColors.PENDING;
              const d = new Date(post.scheduledFor);
              return (
                <div
                  key={post.id}
                  onClick={() => setSelectedPost(post)}
                  className="flex items-center justify-between rounded-lg bg-surface-hover/50 p-3 cursor-pointer hover:bg-surface-hover/80 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {post.imageUrl ? (
                      <img src={post.imageUrl} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-purple-500/20 flex items-center justify-center shrink-0">
                        <Image size={16} className="text-purple-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{post.topic || post.message.substring(0, 50)}</p>
                      <p className="text-xs text-text-secondary">
                        {d.toLocaleDateString('pt-BR')} às {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        {post.source && ` · ${post.source}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    <Eye size={14} className="text-text-secondary" />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Calendar Events this month */}
      <Card className="bg-surface/80 backdrop-blur-sm border-border/60">
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

      {/* Create Event Modal */}
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

      {/* Delete Event Confirm */}
      <Modal isOpen={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)} title="Confirmar Exclusão">
        <p className="text-sm text-text-secondary mb-6">Tem certeza que deseja excluir este evento? Esta ação não pode ser desfeita.</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}>Excluir</Button>
        </div>
      </Modal>

      {/* Post Detail Modal */}
      <Modal isOpen={!!selectedPost} onClose={() => setSelectedPost(null)} title="Detalhes da Publicação">
        {selectedPost && (
          <div className="space-y-4">
            {selectedPost.imageUrl && (
              <img src={selectedPost.imageUrl} alt="" className="w-full rounded-lg object-cover max-h-64" />
            )}
            <div>
              <p className="text-xs text-text-secondary mb-1">Tema</p>
              <p className="text-sm font-medium text-text-primary">{selectedPost.topic}</p>
            </div>
            <div>
              <p className="text-xs text-text-secondary mb-1">Mensagem</p>
              <p className="text-sm text-text-primary whitespace-pre-line">{selectedPost.message}</p>
            </div>
            {selectedPost.hashtags && (
              <div>
                <p className="text-xs text-text-secondary mb-1">Hashtags</p>
                <p className="text-sm text-purple-400">{selectedPost.hashtags}</p>
              </div>
            )}
            <div className="flex items-center gap-4 text-xs text-text-secondary">
              <div>
                <span className="font-medium">Agendado:</span>{' '}
                {new Date(selectedPost.scheduledFor).toLocaleString('pt-BR')}
              </div>
              {selectedPost.publishedAt && (
                <div>
                  <span className="font-medium">Publicado:</span>{' '}
                  {new Date(selectedPost.publishedAt).toLocaleString('pt-BR')}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={postStatusColors[selectedPost.status]?.variant || 'default'}>
                {postStatusColors[selectedPost.status]?.label || selectedPost.status}
              </Badge>
              {selectedPost.source && (
                <Badge variant="default">{selectedPost.source}</Badge>
              )}
              {selectedPost.governorDecision && (
                <Badge variant={selectedPost.governorDecision === 'APPROVE' ? 'success' : 'error'}>
                  Gov: {selectedPost.governorDecision}
                </Badge>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
