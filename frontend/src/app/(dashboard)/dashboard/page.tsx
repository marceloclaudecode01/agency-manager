'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { StatCard } from '@/components/ui/stat-card';
import { formatCurrency } from '@/lib/utils';
import { Users, UsersRound, Megaphone, CheckSquare, DollarSign, Briefcase, CalendarDays } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const priorityBadge: Record<string, { variant: any; label: string }> = {
  LOW: { variant: 'default', label: 'Baixa' },
  MEDIUM: { variant: 'info', label: 'Média' },
  HIGH: { variant: 'warning', label: 'Alta' },
  URGENT: { variant: 'error', label: 'Urgente' },
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function progressColor(pct: number) {
  if (pct >= 70) return 'bg-success';
  if (pct >= 30) return 'bg-warning';
  return 'bg-error';
}

export default function DashboardPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const { data } = await api.get('/dashboard/summary');
      setSummary(data.data);
    } catch {
      toast('Erro ao carregar dashboard', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading />;

  const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  const kpis = [
    { label: 'Clientes Ativos', value: summary?.kpis?.activeClients ?? 0, icon: Users, gradient: 'bg-blue-500/15', iconColor: 'text-blue-400', href: '/clients' },
    { label: 'Campanhas Ativas', value: summary?.kpis?.activeCampaigns ?? 0, icon: Megaphone, gradient: 'bg-purple-500/15', iconColor: 'text-purple-400', href: '/campaigns' },
    { label: 'Tarefas Pendentes', value: summary?.kpis?.pendingTasks ?? 0, icon: CheckSquare, gradient: 'bg-amber-500/15', iconColor: 'text-amber-400', href: '/tasks' },
    { label: 'Receita Mensal', value: formatCurrency(summary?.kpis?.monthRevenue ?? 0), icon: DollarSign, gradient: 'bg-emerald-500/15', iconColor: 'text-emerald-400', href: '/finance' },
  ];

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-text-primary">
            {getGreeting()}, {user?.name?.split(' ')[0] || 'Gestor'}
          </h1>
          <p className="text-sm text-text-secondary mt-0.5 flex items-center gap-1.5">
            <CalendarDays size={14} />
            {today.charAt(0).toUpperCase() + today.slice(1)}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Link key={kpi.label} href={kpi.href}>
            <StatCard
              label={kpi.label}
              value={kpi.value}
              icon={kpi.icon}
              gradient={kpi.gradient}
              iconColor={kpi.iconColor}
            />
          </Link>
        ))}
      </div>

      {/* Campaigns + Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Campanhas Recentes</CardTitle>
              <Link href="/campaigns" className="text-xs text-primary-300 hover:text-primary-200 transition-colors">Ver todas</Link>
            </div>
          </CardHeader>
          <CardContent>
            {!summary?.recentCampaigns?.length ? (
              <div className="flex flex-col items-center justify-center py-8 text-text-secondary">
                <Megaphone size={32} className="opacity-30 mb-2" />
                <p className="text-sm">Nenhuma campanha ativa</p>
              </div>
            ) : (
              <div className="space-y-3">
                {summary.recentCampaigns.map((c: any) => {
                  const pct = c.progress ?? 0;
                  return (
                    <Link key={c.id} href={`/campaigns/${c.id}`}>
                      <div className="flex items-center justify-between rounded-lg bg-surface-hover/50 p-3 hover:bg-surface-hover transition-colors">
                        <div>
                          <p className="text-sm font-medium text-text-primary">{c.name}</p>
                          <p className="text-xs text-text-secondary">{c.client?.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-text-secondary">{pct}%</p>
                          <div className="w-16 h-1.5 bg-surface rounded-full mt-1">
                            <div className={`h-1.5 ${progressColor(pct)} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Minhas Tarefas Pendentes</CardTitle>
              <Link href="/tasks" className="text-xs text-primary-300 hover:text-primary-200 transition-colors">Ver todas</Link>
            </div>
          </CardHeader>
          <CardContent>
            {!summary?.myTasks?.length ? (
              <div className="flex flex-col items-center justify-center py-8 text-text-secondary">
                <CheckSquare size={32} className="opacity-30 mb-2" />
                <p className="text-sm">Nenhuma tarefa atribuída</p>
              </div>
            ) : (
              <div className="space-y-3">
                {summary.myTasks.map((t: any) => (
                  <Link key={t.id} href={`/tasks/${t.id}`}>
                    <div className="flex items-center justify-between rounded-lg bg-surface-hover/50 p-3 hover:bg-surface-hover transition-colors">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{t.title}</p>
                        <p className="text-xs text-text-secondary">{t.campaign?.name || 'Sem campanha'}</p>
                      </div>
                      <Badge variant={priorityBadge[t.priority]?.variant}>
                        {priorityBadge[t.priority]?.label}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Clients */}
      {summary?.recentClients?.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UsersRound size={20} className="text-primary-300" />
                <CardTitle>Clientes Recentes</CardTitle>
              </div>
              <Link href="/clients" className="text-xs text-primary-300 hover:text-primary-200 transition-colors">Ver todos</Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {summary.recentClients.map((c: any) => (
                <Link key={c.id} href={`/clients/${c.id}`}>
                  <div className="flex items-center gap-3 rounded-lg bg-surface-hover/50 p-3 hover:bg-surface-hover transition-colors">
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary-300 flex-shrink-0">
                      {c.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{c.name}</p>
                      <p className="text-xs text-text-secondary truncate">{c.company || '-'}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
