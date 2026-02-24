'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils';
import { Users, UsersRound, Megaphone, CheckSquare, DollarSign } from 'lucide-react';

const priorityBadge: Record<string, { variant: any; label: string }> = {
  LOW: { variant: 'default', label: 'Baixa' },
  MEDIUM: { variant: 'info', label: 'Média' },
  HIGH: { variant: 'warning', label: 'Alta' },
  URGENT: { variant: 'error', label: 'Urgente' },
};

export default function DashboardPage() {
  const { toast } = useToast();
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

  const kpis = [
    { label: 'Clientes Ativos', value: summary?.kpis?.activeClients ?? 0, icon: Users, color: 'text-blue-400', href: '/clients' },
    { label: 'Campanhas Ativas', value: summary?.kpis?.activeCampaigns ?? 0, icon: Megaphone, color: 'text-primary-300', href: '/campaigns' },
    { label: 'Tarefas Pendentes', value: summary?.kpis?.pendingTasks ?? 0, icon: CheckSquare, color: 'text-warning', href: '/tasks' },
    { label: 'Receita Mensal', value: formatCurrency(summary?.kpis?.monthRevenue ?? 0), icon: DollarSign, color: 'text-success', href: '/finance' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Link key={kpi.label} href={kpi.href}>
            <Card className="hover:border-primary/30 transition-colors cursor-pointer">
              <CardContent className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-xl bg-surface-hover flex items-center justify-center ${kpi.color}`}>
                  <kpi.icon size={24} />
                </div>
                <div>
                  <p className="text-sm text-text-secondary">{kpi.label}</p>
                  <p className="text-2xl font-heading font-bold text-text-primary">{kpi.value}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Campanhas Recentes</CardTitle>
              <Link href="/campaigns" className="text-xs text-primary-300 hover:text-primary-200">Ver todas</Link>
            </div>
          </CardHeader>
          <CardContent>
            {!summary?.recentCampaigns?.length ? (
              <p className="text-sm text-text-secondary">Nenhuma campanha ativa</p>
            ) : (
              <div className="space-y-3">
                {summary.recentCampaigns.map((c: any) => (
                  <Link key={c.id} href={`/campaigns/${c.id}`}>
                    <div className="flex items-center justify-between rounded-lg bg-surface-hover/50 p-3 hover:bg-surface-hover transition-colors">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{c.name}</p>
                        <p className="text-xs text-text-secondary">{c.client?.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-text-secondary">{c.progress ?? 0}%</p>
                        <div className="w-16 h-1.5 bg-surface rounded-full mt-1">
                          <div className="h-1.5 bg-primary rounded-full" style={{ width: `${c.progress ?? 0}%` }} />
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Minhas Tarefas Pendentes</CardTitle>
              <Link href="/tasks" className="text-xs text-primary-300 hover:text-primary-200">Ver todas</Link>
            </div>
          </CardHeader>
          <CardContent>
            {!summary?.myTasks?.length ? (
              <p className="text-sm text-text-secondary">Nenhuma tarefa atribuída</p>
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

      {summary?.recentClients?.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UsersRound size={20} className="text-primary-300" />
                <CardTitle>Clientes Recentes</CardTitle>
              </div>
              <Link href="/clients" className="text-xs text-primary-300 hover:text-primary-200">Ver todos</Link>
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
