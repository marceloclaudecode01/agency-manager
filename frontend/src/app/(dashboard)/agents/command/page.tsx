'use client';

import { useState, useRef, useEffect } from 'react';
import { useCommandCenter, AgentLog } from '@/hooks/useCommandCenter';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import {
  Shield, ShieldAlert, ShieldCheck, Activity, Zap, Clock, Brain, MessageSquare,
  BarChart3, TrendingUp, ShoppingCart, Link, Eye, AlertTriangle, CheckCircle,
  XCircle, Pause, Play, RefreshCw, Radio, ArrowRight, ChevronDown, ChevronUp,
  Cpu, Flame, Target, Bot, Radar,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════
// Agent definitions with metadata
// ═══════════════════════════════════════════════════════════════
const AGENT_META: Record<string, { icon: any; color: string; glow: string; role: string; schedule: string }> = {
  'Scheduler':            { icon: Clock,         color: 'text-blue-400',    glow: 'shadow-blue-500/20',    role: 'Publicador',              schedule: '*/5min' },
  'Comment Responder':    { icon: MessageSquare,  color: 'text-pink-400',    glow: 'shadow-pink-500/20',    role: 'Respondedor',             schedule: '*/30min' },
  'Metrics Analyzer':     { icon: BarChart3,      color: 'text-orange-400',  glow: 'shadow-orange-500/20',  role: 'Analista de Métricas',    schedule: '08:00' },
  'Autonomous Engine':    { icon: Zap,            color: 'text-yellow-400',  glow: 'shadow-yellow-500/20',  role: 'Motor Autônomo',          schedule: '07:00' },
  'Trending Topics':      { icon: TrendingUp,     color: 'text-red-400',     glow: 'shadow-red-500/20',     role: 'Pesquisador',             schedule: 'Seg 06:00' },
  'Product Orchestrator': { icon: ShoppingCart,    color: 'text-emerald-400', glow: 'shadow-emerald-500/20', role: 'Produtos TikTok',         schedule: '10:00/15:00' },
  'Token Monitor':        { icon: Shield,          color: 'text-amber-400',   glow: 'shadow-amber-500/20',   role: 'Monitor de Token',        schedule: '09:00' },
  'Content Governor':     { icon: Eye,             color: 'text-purple-400',  glow: 'shadow-purple-500/20',  role: 'Governador de Conteúdo',  schedule: '*/10min' },
  'Growth Director':      { icon: Target,          color: 'text-cyan-400',    glow: 'shadow-cyan-500/20',    role: 'Diretor de Crescimento',  schedule: 'Dom 22:00' },
  'System Sentinel':      { icon: Radar,           color: 'text-red-400',     glow: 'shadow-red-500/20',     role: 'Sentinela do Sistema',    schedule: '*/5min' },
  'Performance Learner':  { icon: Brain,           color: 'text-violet-400',  glow: 'shadow-violet-500/20',  role: 'Aprendizado',             schedule: '23:00' },
};

const LOG_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  info:          { label: 'INFO',    color: 'text-gray-400',   bg: 'bg-gray-500/10' },
  action:        { label: 'ACTION',  color: 'text-blue-400',   bg: 'bg-blue-500/10' },
  communication: { label: 'COMM',    color: 'text-purple-400', bg: 'bg-purple-500/10' },
  result:        { label: 'RESULT',  color: 'text-green-400',  bg: 'bg-green-500/10' },
  error:         { label: 'ERROR',   color: 'text-red-400',    bg: 'bg-red-500/10' },
};

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

// ═══════════════════════════════════════════════════════════════
// GLOBAL STATUS INDICATOR
// ═══════════════════════════════════════════════════════════════
function GlobalStatusBanner({ status, safeMode }: { status: string; safeMode: any }) {
  const config: Record<string, { bg: string; border: string; text: string; pulse: string; icon: any; label: string }> = {
    ONLINE:    { bg: 'bg-emerald-500/5',  border: 'border-emerald-500/30', text: 'text-emerald-400', pulse: 'bg-emerald-400', icon: ShieldCheck,  label: 'SISTEMA OPERACIONAL' },
    DEGRADED:  { bg: 'bg-yellow-500/5',   border: 'border-yellow-500/30',  text: 'text-yellow-400',  pulse: 'bg-yellow-400',  icon: AlertTriangle, label: 'DEGRADADO' },
    SAFE_MODE: { bg: 'bg-red-500/5',      border: 'border-red-500/30',     text: 'text-red-400',     pulse: 'bg-red-400',     icon: ShieldAlert,   label: 'SAFE MODE' },
    ERROR:     { bg: 'bg-red-500/10',     border: 'border-red-500/50',     text: 'text-red-400',     pulse: 'bg-red-500',     icon: XCircle,       label: 'ERRO CRÍTICO' },
  };
  const c = config[status] || config.ONLINE;
  const Icon = c.icon;

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} p-4 backdrop-blur-sm`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Icon className={`w-6 h-6 ${c.text}`} />
            <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${c.pulse} animate-pulse`} />
          </div>
          <div>
            <p className={`text-sm font-bold font-heading tracking-wider ${c.text}`}>{c.label}</p>
            {safeMode?.enabled && (
              <p className="text-xs text-red-300/70 mt-0.5">
                {safeMode.reason} — ativado por {safeMode.activatedBy}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary font-mono">
            {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STAT CARDS ROW
// ═══════════════════════════════════════════════════════════════
function StatsRow({ running, total, errors, published, failed, todayPosts }: {
  running: number; total: number; errors: number; published: number; failed: number; todayPosts: number;
}) {
  const stats = [
    { label: 'Agentes Ativos', value: `${running}/${total}`, icon: Cpu, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    { label: 'Posts Hoje', value: todayPosts, icon: Radio, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    { label: 'Publicados (7d)', value: published, icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
    { label: 'Falhas (7d)', value: failed, icon: XCircle, color: failed > 0 ? 'text-red-400' : 'text-gray-500', bg: failed > 0 ? 'bg-red-500/10' : 'bg-gray-500/10', border: failed > 0 ? 'border-red-500/20' : 'border-gray-500/20' },
    { label: 'Erros (30min)', value: errors, icon: AlertTriangle, color: errors > 0 ? 'text-yellow-400' : 'text-gray-500', bg: errors > 0 ? 'bg-yellow-500/10' : 'bg-gray-500/10', border: errors > 0 ? 'border-yellow-500/20' : 'border-gray-500/20' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div key={s.label} className={`rounded-xl border ${s.border} ${s.bg} p-4 backdrop-blur-sm`}>
            <div className="flex items-center gap-3">
              <Icon className={`w-5 h-5 ${s.color}`} />
              <div>
                <p className="text-xs text-text-secondary">{s.label}</p>
                <p className={`text-xl font-heading font-bold ${s.color}`}>{s.value}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AGENT CARD (expandable)
// ═══════════════════════════════════════════════════════════════
function AgentCard({ agent, errorCount, logs, onToggle }: {
  agent: { name: string; paused: boolean; status: string };
  errorCount: number;
  logs: AgentLog[];
  onToggle: (name: string, paused: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = AGENT_META[agent.name] || { icon: Bot, color: 'text-gray-400', glow: '', role: 'Agente', schedule: '-' };
  const Icon = meta.icon;
  const recentLogs = logs.filter(l => l.from === agent.name).slice(-5);
  const lastLog = recentLogs[recentLogs.length - 1];

  const statusColor = agent.status === 'running' ? 'bg-emerald-400' :
    agent.status === 'paused' ? 'bg-gray-500' :
    agent.status === 'safe_mode' ? 'bg-red-400' : 'bg-yellow-400';

  return (
    <div className={`rounded-xl border border-border/60 bg-surface/80 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 ${agent.paused ? 'opacity-50' : ''} ${expanded ? meta.glow + ' shadow-lg' : ''}`}>
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg bg-surface-hover/80 border border-border/50`}>
              <Icon className={`w-5 h-5 ${meta.color}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-text-primary">{agent.name}</h3>
                <span className={`w-2 h-2 rounded-full ${statusColor} ${agent.status === 'running' ? 'animate-pulse' : ''}`} />
              </div>
              <p className="text-xs text-text-secondary">{meta.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {errorCount > 0 && (
              <Badge variant="error" className="text-xs">{errorCount}</Badge>
            )}
            <button
              onClick={() => onToggle(agent.name, !agent.paused)}
              className={`p-1.5 rounded-lg transition-colors ${agent.paused ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400' : 'bg-surface-hover hover:bg-red-500/10 text-text-secondary hover:text-red-400'}`}
              title={agent.paused ? 'Retomar' : 'Pausar'}
            >
              {agent.paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg bg-surface-hover hover:bg-surface-hover/80 text-text-secondary transition-colors"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 text-xs text-text-secondary">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {meta.schedule}
          </span>
          {lastLog && (
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3" /> {timeAgo(lastLog.createdAt)} atrás
            </span>
          )}
        </div>
      </div>

      {/* Expanded: Recent logs */}
      {expanded && (
        <div className="border-t border-border/50 p-3 space-y-1.5 max-h-48 overflow-y-auto">
          {recentLogs.length === 0 ? (
            <p className="text-xs text-text-secondary text-center py-2">Sem logs recentes</p>
          ) : (
            recentLogs.map((log) => {
              const cfg = LOG_TYPE_CONFIG[log.type] || LOG_TYPE_CONFIG.info;
              return (
                <div key={log.id} className="flex items-start gap-2 text-xs">
                  <span className={`px-1.5 py-0.5 rounded font-mono ${cfg.color} ${cfg.bg} flex-shrink-0`}>
                    {cfg.label}
                  </span>
                  <span className="text-text-secondary truncate flex-1">{log.message}</span>
                  <span className="text-text-secondary/50 flex-shrink-0">{timeAgo(log.createdAt)}</span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MISSION LOG (Real-time feed)
// ═══════════════════════════════════════════════════════════════
function MissionLog({ logs, filterAgent, setFilterAgent }: {
  logs: AgentLog[];
  filterAgent: string;
  setFilterAgent: (v: string) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs.length, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  };

  const filtered = filterAgent
    ? logs.filter(l => l.from === filterAgent || l.to === filterAgent)
    : logs;

  const recent = filtered.slice(-100);

  return (
    <div className="rounded-xl border border-border/60 bg-surface/80 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="text-sm font-heading font-semibold text-text-primary">Mission Log</span>
          <Badge variant="purple" className="text-xs">{recent.length}</Badge>
        </div>
        <select
          value={filterAgent}
          onChange={e => setFilterAgent(e.target.value)}
          className="bg-surface-hover border border-border text-text-secondary text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-primary"
        >
          <option value="">Todos</option>
          {Object.keys(AGENT_META).map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {/* Feed */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-[400px] overflow-y-auto p-3 space-y-1 font-mono text-xs"
      >
        {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-secondary/50">
            <Radar className="w-10 h-10 mb-2 opacity-30" />
            <p>Aguardando sinais dos agentes...</p>
          </div>
        ) : (
          recent.map((log) => {
            const cfg = LOG_TYPE_CONFIG[log.type] || LOG_TYPE_CONFIG.info;
            const meta = AGENT_META[log.from];
            return (
              <div
                key={log.id}
                className={`flex items-start gap-2 py-1.5 px-2 rounded transition-colors hover:bg-surface-hover/50 ${log.type === 'error' ? 'bg-red-500/5' : ''}`}
              >
                <span className="text-text-secondary/40 flex-shrink-0 w-10 text-right">
                  {timeAgo(log.createdAt)}
                </span>
                <span className={`px-1 py-0.5 rounded ${cfg.color} ${cfg.bg} flex-shrink-0 w-14 text-center`}>
                  {cfg.label}
                </span>
                <span className={`font-semibold flex-shrink-0 ${meta?.color || 'text-gray-400'}`}>
                  {log.from}
                </span>
                {log.to && (
                  <>
                    <ArrowRight className="w-3 h-3 text-text-secondary/30 flex-shrink-0 mt-0.5" />
                    <span className="text-text-secondary/60 flex-shrink-0">{log.to}</span>
                  </>
                )}
                <span className="text-text-secondary truncate">{log.message}</span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TODAY'S POSTS TIMELINE
// ═══════════════════════════════════════════════════════════════
function TodayTimeline({ posts }: { posts: Array<{ id: string; topic: string; scheduledFor: string; status: string }> }) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-6 text-text-secondary/50 text-sm">
        Nenhum post agendado para hoje
      </div>
    );
  }

  const statusConfig: Record<string, { color: string; icon: any }> = {
    PUBLISHED: { color: 'text-emerald-400', icon: CheckCircle },
    APPROVED:  { color: 'text-blue-400',    icon: Clock },
    PENDING:   { color: 'text-yellow-400',  icon: Clock },
    REJECTED:  { color: 'text-red-400',     icon: XCircle },
    FAILED:    { color: 'text-red-400',     icon: XCircle },
  };

  return (
    <div className="space-y-2">
      {posts.map((post) => {
        const cfg = statusConfig[post.status] || statusConfig.PENDING;
        const Icon = cfg.icon;
        const time = new Date(post.scheduledFor).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return (
          <div key={post.id} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-surface-hover/30 hover:bg-surface-hover/60 transition-colors">
            <span className="text-xs font-mono text-text-secondary w-12">{time}</span>
            <Icon className={`w-4 h-4 ${cfg.color} flex-shrink-0`} />
            <span className="text-sm text-text-primary truncate flex-1">{post.topic}</span>
            <Badge variant={post.status === 'PUBLISHED' ? 'success' : post.status === 'FAILED' ? 'error' : 'default'} className="text-xs">
              {post.status}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// METRICS MINI CHART (simple bar visualization)
// ═══════════════════════════════════════════════════════════════
function MetricsMini({ metrics }: { metrics: any[] }) {
  const recent = metrics.slice(0, 7).reverse();
  if (recent.length === 0) {
    return <p className="text-xs text-text-secondary/50 text-center py-4">Sem dados de métricas</p>;
  }
  const maxScore = Math.max(...recent.map(m => m.growthScore || 0), 1);

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-1.5 h-24">
        {recent.map((m: any, i: number) => {
          const height = Math.max(8, (m.growthScore / maxScore) * 100);
          const color = m.growthScore >= 7 ? 'bg-emerald-400' : m.growthScore >= 4 ? 'bg-yellow-400' : 'bg-red-400';
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs text-text-secondary/50">{m.growthScore}</span>
              <div className={`w-full rounded-t ${color}/70 transition-all`} style={{ height: `${height}%` }} />
            </div>
          );
        })}
      </div>
      {recent.length > 0 && (
        <p className="text-xs text-text-secondary">
          Growth Score atual: <span className="text-text-primary font-semibold">{recent[recent.length - 1]?.growthScore}/10</span>
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMMAND CENTER PAGE
// ═══════════════════════════════════════════════════════════════
export default function CommandCenterPage() {
  const {
    systemStatus, engineStatus, logs, metrics, loading,
    toggleSafeMode, toggleAgent, runSentinel, refresh,
    totalErrors, runningAgents, totalAgents, globalStatus,
  } = useCommandCenter();
  const { toast } = useToast();
  const [logFilter, setLogFilter] = useState('');
  const [sentinelLoading, setSentinelLoading] = useState(false);

  const handleSafeMode = async () => {
    try {
      const newState = !systemStatus?.safeMode.enabled;
      await toggleSafeMode(newState);
      toast(newState ? 'Safe Mode ativado — publicações pausadas' : 'Safe Mode desativado — sistema normal', newState ? 'warning' : 'info');
    } catch { toast('Erro ao alterar safe mode', 'error'); }
  };

  const handleToggleAgent = async (name: string, paused: boolean) => {
    try {
      await toggleAgent(name, paused);
      toast(`${name} ${paused ? 'pausado' : 'retomado'}`, 'info');
    } catch { toast('Erro', 'error'); }
  };

  const handleSentinel = async () => {
    setSentinelLoading(true);
    try {
      const report = await runSentinel();
      toast(`Sentinel: ${report.safeModeTriggered ? 'SAFE MODE ATIVADO' : 'Sistema OK'} — ${report.apiErrors} erros, ${report.failedPosts} falhas`, report.safeModeTriggered ? 'warning' : 'info');
    } catch { toast('Erro ao executar Sentinel', 'error'); }
    setSentinelLoading(false);
  };

  if (loading) return <Loading />;
  if (!systemStatus) return <div className="p-6 text-text-secondary">Erro ao carregar dados do sistema</div>;

  const getErrorCount = (name: string) => systemStatus.errorCounts.find(e => e.from === name)?._count.id || 0;

  return (
    <div className="space-y-5 pb-8">
      {/* ─── HEADER ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
            <Flame className="w-6 h-6 text-primary-300" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold text-text-primary">Centro de Comando</h1>
            <p className="text-xs text-text-secondary">Monitoramento em tempo real da agência autônoma</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={refresh} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </Button>
          <Button size="sm" variant="outline" onClick={handleSentinel} disabled={sentinelLoading} className="gap-1.5">
            <Radar className={`w-3.5 h-3.5 ${sentinelLoading ? 'animate-spin' : ''}`} /> Sentinel
          </Button>
          <Button
            size="sm"
            variant={systemStatus.safeMode.enabled ? 'danger' : 'outline'}
            onClick={handleSafeMode}
            className="gap-1.5"
          >
            <Shield className="w-3.5 h-3.5" />
            {systemStatus.safeMode.enabled ? 'Desativar Safe Mode' : 'Safe Mode'}
          </Button>
        </div>
      </div>

      {/* ─── GLOBAL STATUS BANNER ─── */}
      <GlobalStatusBanner status={globalStatus} safeMode={systemStatus.safeMode} />

      {/* ─── STATS ROW ─── */}
      <StatsRow
        running={runningAgents}
        total={totalAgents}
        errors={totalErrors}
        published={engineStatus?.weekStats.published || 0}
        failed={engineStatus?.weekStats.failed || 0}
        todayPosts={engineStatus?.todayPosts.length || 0}
      />

      {/* ─── MAIN GRID ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* LEFT: Agents Grid (2 cols) */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-primary-300" />
            <h2 className="text-sm font-heading font-semibold text-text-primary">Painel de Agentes</h2>
            <Badge variant="purple" className="text-xs">{totalAgents}</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {systemStatus.agents.map((agent) => (
              <AgentCard
                key={agent.name}
                agent={agent}
                errorCount={getErrorCount(agent.name)}
                logs={logs}
                onToggle={handleToggleAgent}
              />
            ))}
          </div>
        </div>

        {/* RIGHT: Sidebar panels */}
        <div className="space-y-4">
          {/* Today's Posts */}
          <div className="rounded-xl border border-border/60 bg-surface/80 backdrop-blur-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Radio className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-heading font-semibold text-text-primary">Posts de Hoje</h2>
              <Badge variant="info" className="text-xs">{engineStatus?.todayPosts.length || 0}</Badge>
            </div>
            <TodayTimeline posts={engineStatus?.todayPosts || []} />
          </div>

          {/* Growth Score */}
          <div className="rounded-xl border border-border/60 bg-surface/80 backdrop-blur-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-heading font-semibold text-text-primary">Growth Score</h2>
            </div>
            <MetricsMini metrics={metrics} />
          </div>

          {/* Quick Alerts */}
          <div className="rounded-xl border border-border/60 bg-surface/80 backdrop-blur-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <h2 className="text-sm font-heading font-semibold text-text-primary">Alertas</h2>
            </div>
            {(() => {
              const alerts: Array<{ msg: string; severity: 'error' | 'warning' | 'info' }> = [];
              if (systemStatus.safeMode.enabled) alerts.push({ msg: `Safe Mode: ${systemStatus.safeMode.reason}`, severity: 'error' });
              if (totalErrors > 5) alerts.push({ msg: `${totalErrors} erros em 30min`, severity: 'error' });
              else if (totalErrors > 0) alerts.push({ msg: `${totalErrors} erros em 30min`, severity: 'warning' });
              if ((engineStatus?.weekStats.failed || 0) > 3) alerts.push({ msg: `${engineStatus?.weekStats.failed} posts falharam esta semana`, severity: 'warning' });
              if (systemStatus.pausedAgents.length > 0) alerts.push({ msg: `${systemStatus.pausedAgents.length} agentes pausados`, severity: 'warning' });
              if (alerts.length === 0) alerts.push({ msg: 'Nenhum alerta ativo', severity: 'info' });

              return (
                <div className="space-y-2">
                  {alerts.map((a, i) => (
                    <div key={i} className={`flex items-center gap-2 text-xs py-1.5 px-2 rounded-lg ${
                      a.severity === 'error' ? 'bg-red-500/10 text-red-400' :
                      a.severity === 'warning' ? 'bg-yellow-500/10 text-yellow-400' :
                      'bg-surface-hover/50 text-text-secondary'
                    }`}>
                      {a.severity === 'error' ? <XCircle className="w-3.5 h-3.5" /> :
                       a.severity === 'warning' ? <AlertTriangle className="w-3.5 h-3.5" /> :
                       <CheckCircle className="w-3.5 h-3.5" />}
                      {a.msg}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ─── MISSION LOG (Full width) ─── */}
      <MissionLog logs={logs} filterAgent={logFilter} setFilterAgent={setLogFilter} />
    </div>
  );
}
