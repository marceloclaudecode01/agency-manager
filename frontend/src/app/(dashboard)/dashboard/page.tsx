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

export default function DashboardPage() {
  const { toast } = useToast();
  const [stats, setStats] = useState({ clients: 0, campaigns: 0, tasks: 0, revenue: 0, teamMembers: 0 });
  const [recentCampaigns, setRecentCampaigns] = useState<any[]>([]);
  const [pendingTasks, setPendingTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const [clientsRes, campaignsRes, tasksRes, summaryRes, usersRes] = await Promise.all([
        api.get('/clients?status=ACTIVE'),
        api.get('/campaigns?status=ACTIVE'),
        api.get('/tasks?status=TODO'),
        api.get('/finance/summary').catch(() => ({ data: { data: { totalRevenue: 0 } } })),
        api.get('/users').catch(() => ({ data: { data: [] } })),
      ]);

      setStats({
        clients: clientsRes.data.data?.length || 0,
        campaigns: campaignsRes.data.data?.length || 0,
        tasks: tasksRes.data.data?.length || 0,
        revenue: summaryRes.data.data?.totalRevenue || 0,
        teamMembers: usersRes.data.data?.length || 0,
      });
      setRecentCampaigns((campaignsRes.data.data || []).slice(0, 5));
      setPendingTasks((tasksRes.data.data || []).slice(0, 5));
    } catch {
      toast('Erro ao carregar dashboard', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading />;

  const kpis = [
    { label: 'Clientes Ativos', value: stats.clients, icon: Users, color: 'text-blue-400', href: '/clients' },
    { label: 'Campanhas Ativas', value: stats.campaigns, icon: Megaphone, color: 'text-primary-300', href: '/campaigns' },
    { label: 'Tarefas Pendentes', value: stats.tasks, icon: CheckSquare, color: 'text-warning', href: '/tasks' },
    { label: 'Receita Total', value: formatCurrency(stats.revenue), icon: DollarSign, color: 'text-success', href: '/finance' },
    { label: 'Equipe', value: stats.teamMembers, icon: UsersRound, color: 'text-secondary', href: '/team' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
              <CardTitle>Campanhas Ativas</CardTitle>
              <Link href="/campaigns" className="text-xs text-primary-300 hover:text-primary-200">Ver todas</Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentCampaigns.length === 0 ? (
              <p className="text-sm text-text-secondary">Nenhuma campanha ativa</p>
            ) : (
              <div className="space-y-3">
                {recentCampaigns.map((c: any) => (
                  <Link key={c.id} href={`/campaigns/${c.id}`}>
                    <div className="flex items-center justify-between rounded-lg bg-surface-hover/50 p-3 hover:bg-surface-hover transition-colors">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{c.name}</p>
                        <p className="text-xs text-text-secondary">{c.client?.name}</p>
                      </div>
                      <Badge variant="purple">{c._count?.tasks || 0} tarefas</Badge>
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
              <CardTitle>Tarefas Pendentes</CardTitle>
              <Link href="/tasks" className="text-xs text-primary-300 hover:text-primary-200">Ver todas</Link>
            </div>
          </CardHeader>
          <CardContent>
            {pendingTasks.length === 0 ? (
              <p className="text-sm text-text-secondary">Nenhuma tarefa pendente</p>
            ) : (
              <div className="space-y-3">
                {pendingTasks.map((t: any) => (
                  <Link key={t.id} href={`/tasks/${t.id}`}>
                    <div className="flex items-center justify-between rounded-lg bg-surface-hover/50 p-3 hover:bg-surface-hover transition-colors">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{t.title}</p>
                        <p className="text-xs text-text-secondary">{t.campaign?.name || 'Sem campanha'}</p>
                      </div>
                      <Badge variant={t.priority === 'URGENT' ? 'error' : t.priority === 'HIGH' ? 'warning' : 'default'}>
                        {t.priority}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
