'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, Pause, AlertTriangle, Shield, Activity, Zap } from 'lucide-react';
import { TokenHealth } from '@/components/command/TokenHealth';
import type { AgentStatus, AgentLog } from '@/hooks/useCommandCenter';

const AGENT_META: Record<string, { role: string; schedule: string }> = {
  'Scheduler': { role: 'Publica posts agendados', schedule: '*/5min' },
  'Comment Responder': { role: 'Responde comentários IA', schedule: '*/30min' },
  'Metrics Analyzer': { role: 'Analisa engajamento', schedule: '08:00' },
  'Autonomous Engine': { role: 'Gera posts do dia', schedule: '07:00' },
  'Trending Topics': { role: 'Analisa tendências', schedule: 'Seg 06:00' },
  'Product Orchestrator': { role: 'Posts de produtos', schedule: '10:00/15:00' },
  'Token Monitor': { role: 'Verifica token FB', schedule: '09:00' },
  'Content Governor': { role: 'Aprova/rejeita posts', schedule: '*/10min' },
  'Growth Director': { role: 'Ajusta estratégia', schedule: 'Dom 22:00' },
  'System Sentinel': { role: 'Monitora saúde', schedule: '*/5min' },
  'Performance Learner': { role: 'Aprende padrões', schedule: '23:00' },
  'Content Replicator': { role: 'Replica conteúdo', schedule: 'On-demand' },
  'Platform Optimizer': { role: 'Otimiza plataformas', schedule: 'On-demand' },
  'Carousel Generator': { role: 'Gera carousels', schedule: 'On-demand' },
  'A/B Testing': { role: 'Testes A/B', schedule: '*/6h' },
  'Viral Mechanics': { role: 'Hooks virais', schedule: 'On-demand' },
  'Reputation Monitor': { role: 'Monitora reputação', schedule: '*/2h' },
  'Lead Capture': { role: 'Captura leads', schedule: '*/30min' },
  'Monetization Engine': { role: 'Funis e conversões', schedule: '11:00' },
  'Strategic Command': { role: 'Plano estratégico', schedule: '1st/month' },
  'Market Intelligence': { role: 'Intel de mercado', schedule: 'Wed+Sat' },
  'Niche Learning': { role: 'Aprende audiência', schedule: 'Dom 05:00' },
  'Paid Traffic': { role: 'Sync ads', schedule: '*/4h' },
  'Policy Compliance': { role: 'Verifica políticas', schedule: 'Inline' },
  'Pattern Variation': { role: 'Evita repetição', schedule: 'Inline' },
};

interface CommandTabProps {
  agents: AgentStatus[];
  logs: AgentLog[];
  tokenStatus: any;
  onToggleAgent: (name: string, paused: boolean) => Promise<void>;
  onRunSentinel: () => Promise<any>;
}

export function CommandTab({ agents, logs, tokenStatus, onToggleAgent, onRunSentinel }: CommandTabProps) {
  const errorCounts: Record<string, number> = {};
  logs.filter(l => l.type === 'error').forEach(l => {
    errorCounts[l.from] = (errorCounts[l.from] || 0) + 1;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-heading font-semibold text-text-primary flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-400" /> Agent Command
        </h3>
        <Button size="sm" variant="outline" onClick={onRunSentinel} className="gap-1.5">
          <Shield className="w-3.5 h-3.5" /> Run Sentinel
        </Button>
      </div>

      <TokenHealth tokenStatus={tokenStatus} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {agents.map(agent => {
          const meta = AGENT_META[agent.name] || { role: 'Agente', schedule: '—' };
          const errors = errorCounts[agent.name] || 0;
          const statusColor = agent.status === 'running' ? 'bg-emerald-400' :
            agent.status === 'error' ? 'bg-red-400' : 'bg-yellow-400';

          return (
            <div key={agent.name} className="rounded-xl border border-border/60 bg-surface/80 backdrop-blur-sm p-4 hover:border-primary/30 transition-all">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${statusColor} ${agent.status === 'running' ? 'animate-pulse' : ''}`} />
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{agent.name}</p>
                    <p className="text-xs text-text-secondary">{meta.role}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onToggleAgent(agent.name, !agent.paused)}
                  className="h-7 w-7 p-0"
                >
                  {agent.paused ? <Play className="w-3.5 h-3.5 text-emerald-400" /> : <Pause className="w-3.5 h-3.5 text-yellow-400" />}
                </Button>
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-text-secondary">
                <span className="font-mono">{meta.schedule}</span>
                {errors > 0 && (
                  <Badge variant="error" className="text-xs gap-1">
                    <AlertTriangle className="w-3 h-3" /> {errors}
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
