'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils';
import { BarChart3, TrendingUp, Users } from 'lucide-react';

export default function ReportsPage() {
  const { toast } = useToast();
  const [revenue, setRevenue] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [topClients, setTopClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [revRes, campRes, clientRes] = await Promise.all([
        api.get('/reports/revenue'),
        api.get('/reports/campaigns'),
        api.get('/reports/clients'),
      ]);
      setRevenue(revRes.data.data || []);
      setCampaigns(campRes.data.data || []);
      setTopClients(clientRes.data.data || []);
    } catch {
      toast('Erro ao carregar relatórios', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading />;

  const maxRevenue = Math.max(...revenue.map((r) => r.total), 1);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp size={20} className="text-success" />
            <CardTitle>Receita por Mês</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {revenue.length === 0 ? (
            <p className="text-sm text-text-secondary">Sem dados de receita</p>
          ) : (
            <div className="space-y-3">
              {revenue.map((r) => (
                <div key={r.month} className="flex items-center gap-4">
                  <span className="w-20 text-sm text-text-secondary flex-shrink-0">{r.month}</span>
                  <div className="flex-1 h-8 bg-surface-hover rounded-lg overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-lg transition-all flex items-center px-3"
                      style={{ width: `${(r.total / maxRevenue) * 100}%` }}
                    >
                      <span className="text-xs text-white font-medium whitespace-nowrap">{formatCurrency(r.total)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 size={20} className="text-primary-300" />
              <CardTitle>Performance das Campanhas</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {campaigns.length === 0 ? (
              <p className="text-sm text-text-secondary">Sem campanhas</p>
            ) : (
              <div className="space-y-4">
                {campaigns.map((c: any) => (
                  <div key={c.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{c.name}</p>
                        <p className="text-xs text-text-secondary">{c.client?.name}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium text-text-primary">{c.progress}%</span>
                        <p className="text-xs text-text-secondary">{c.doneTasks}/{c.totalTasks} tarefas</p>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-surface-hover">
                      <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${c.progress}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users size={20} className="text-secondary" />
              <CardTitle>Clientes Mais Rentáveis</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {topClients.length === 0 ? (
              <p className="text-sm text-text-secondary">Sem dados</p>
            ) : (
              <div className="space-y-3">
                {topClients.slice(0, 10).map((client: any, index: number) => (
                  <div key={client.id} className="flex items-center justify-between rounded-lg bg-surface-hover/50 p-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-text-secondary w-6">#{index + 1}</span>
                      <div>
                        <p className="text-sm font-medium text-text-primary">{client.name}</p>
                        {client.company && <p className="text-xs text-text-secondary">{client.company}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-success">{formatCurrency(client.totalRevenue)}</p>
                      <p className="text-xs text-text-secondary">{client.campaignCount} campanhas</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
