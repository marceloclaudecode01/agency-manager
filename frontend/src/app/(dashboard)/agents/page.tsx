'use client';

import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { useSocketContext } from '@/contexts/SocketContext';
import {
  Bot, Clock, Zap, Brain, TrendingUp, ShoppingCart, Link,
  BarChart3, Shield, MessageSquare, Calendar, Activity,
  CheckCircle, RefreshCw, ArrowRight, Filter,
} from 'lucide-react';

// ──────────────────────────────────────────────────────────
// Definição dos 13 agentes
// ──────────────────────────────────────────────────────────
const AGENTS = [
  {
    name: 'Autonomous Engine',
    role: 'Motor Autônomo',
    description: 'Orquestra o ciclo diário: aciona estrategista, criador de conteúdo e scheduler para gerar e agendar posts.',
    schedule: 'Todo dia às 07:00',
    icon: Zap,
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10 border-yellow-400/30',
  },
  {
    name: 'Scheduler',
    role: 'Publicador',
    description: 'Verifica a cada 5 minutos os posts aprovados e os publica no Facebook no horário certo.',
    schedule: 'A cada 5 minutos',
    icon: Clock,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10 border-blue-400/30',
  },
  {
    name: 'Content Strategist',
    role: 'Estrategista',
    description: 'Define quantos posts criar, sobre quais tópicos e quais horários, com base no dia da semana e tendências.',
    schedule: 'Acionado pelo Motor',
    icon: Brain,
    color: 'text-purple-400',
    bg: 'bg-purple-400/10 border-purple-400/30',
  },
  {
    name: 'Content Creator',
    role: 'Criador de Conteúdo',
    description: 'Escreve posts completos com texto e hashtags a partir de um tópico e contexto fornecidos.',
    schedule: 'Acionado pelo Motor',
    icon: MessageSquare,
    color: 'text-green-400',
    bg: 'bg-green-400/10 border-green-400/30',
  },
  {
    name: 'Comment Responder',
    role: 'Respondedor',
    description: 'Lê comentários dos posts e responde automaticamente, priorizando intenções de compra com templates de produto.',
    schedule: 'A cada 30 minutos',
    icon: MessageSquare,
    color: 'text-pink-400',
    bg: 'bg-pink-400/10 border-pink-400/30',
  },
  {
    name: 'Metrics Analyzer',
    role: 'Analista de Métricas',
    description: 'Coleta dados do Facebook (seguidores, alcance, engajamento) e gera relatório com score de crescimento.',
    schedule: 'Todo dia às 08:00',
    icon: BarChart3,
    color: 'text-orange-400',
    bg: 'bg-orange-400/10 border-orange-400/30',
  },
  {
    name: 'Growth Analyst',
    role: 'Analista de Crescimento',
    description: 'Analisa padrões de crescimento e identifica os melhores horários e tipos de conteúdo para postar.',
    schedule: 'Sob demanda',
    icon: TrendingUp,
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10 border-cyan-400/30',
  },
  {
    name: 'Trending Topics',
    role: 'Pesquisador de Tendências',
    description: 'Toda segunda-feira analisa tendências via Gemini AI e alimenta o estrategista com temas em alta.',
    schedule: 'Toda segunda às 06:00',
    icon: TrendingUp,
    color: 'text-red-400',
    bg: 'bg-red-400/10 border-red-400/30',
  },
  {
    name: 'Product Orchestrator',
    role: 'Orquestrador de Produtos',
    description: 'Coordena o fluxo TikTok Shop: aciona o Researcher, repassa para o Copywriter e agenda os posts.',
    schedule: 'Às 10:00 e 15:00',
    icon: ShoppingCart,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10 border-emerald-400/30',
  },
  {
    name: 'TikTok Researcher',
    role: 'Pesquisador TikTok',
    description: 'Busca produtos em alta no TikTok Shop por categoria e tendência para monetização via post.',
    schedule: 'Acionado pelo Orquestrador',
    icon: Activity,
    color: 'text-rose-400',
    bg: 'bg-rose-400/10 border-rose-400/30',
  },
  {
    name: 'Copywriter',
    role: 'Copywriter',
    description: 'Escreve copies persuasivos para produtos com chamadas para ação e templates de resposta automática.',
    schedule: 'Acionado pelo Orquestrador',
    icon: Brain,
    color: 'text-violet-400',
    bg: 'bg-violet-400/10 border-violet-400/30',
  },
  {
    name: 'Link Analyzer',
    role: 'Analisador de Links',
    description: 'Extrai nome, preço e descrição de qualquer produto a partir de uma URL para criação de campanhas.',
    schedule: 'Sob demanda',
    icon: Link,
    color: 'text-teal-400',
    bg: 'bg-teal-400/10 border-teal-400/30',
  },
  {
    name: 'Token Monitor',
    role: 'Monitor de Token',
    description: 'Verifica diariamente a validade do token do Facebook e alerta antes de expirar para evitar interrupções.',
    schedule: 'Todo dia às 09:00',
    icon: Shield,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10 border-amber-400/30',
  },
];

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  info:          { label: 'Info',          color: 'text-gray-400',   dot: 'bg-gray-400' },
  action:        { label: 'Ação',          color: 'text-blue-400',   dot: 'bg-blue-400' },
  communication: { label: 'Comunicação',   color: 'text-purple-400', dot: 'bg-purple-400' },
  result:        { label: 'Resultado',     color: 'text-green-400',  dot: 'bg-green-400' },
  error:         { label: 'Erro',          color: 'text-red-400',    dot: 'bg-red-400' },
};

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s atrás`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

// ──────────────────────────────────────────────────────────
// Componente
// ──────────────────────────────────────────────────────────
export default function AgentsPage() {
  const { socket } = useSocketContext();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAgent, setFilterAgent] = useState('');
  const [filterType, setFilterType] = useState('');
  const [activeTab, setActiveTab] = useState<'agents' | 'chat'>('agents');
  const bottomRef = useRef<HTMLDivElement>(null);

  const [activeAgents, setActiveAgents] = useState<Set<string>>(new Set());
  const [lastLogByAgent, setLastLogByAgent] = useState<Record<string, string>>({});
  const [logCountByAgent, setLogCountByAgent] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('agent:log', (log: any) => {
      setLogs(prev => [...prev, log].slice(-200));
      setActiveAgents(prev => { const s = new Set(Array.from(prev)); s.add(log.from); return s; });
      setLastLogByAgent(prev => ({ ...prev, [log.from]: log.createdAt }));
      setLogCountByAgent(prev => ({ ...prev, [log.from]: (prev[log.from] || 0) + 1 }));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    });
    return () => { socket.off('agent:log'); };
  }, [socket]);

  async function fetchLogs() {
    try {
      const res = await api.get('/agents/logs?limit=150');
      const data = res.data.data || [];
      setLogs(data);

      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const recentArr: string[] = data
        .filter((l: any) => new Date(l.createdAt).getTime() > twoHoursAgo)
        .map((l: any) => l.from as string);
      setActiveAgents(new Set<string>(recentArr));

      // Build last log and count per agent
      const lastLog: Record<string, string> = {};
      const countMap: Record<string, number> = {};
      data.forEach((l: any) => {
        if (!lastLog[l.from] || new Date(l.createdAt) > new Date(lastLog[l.from])) {
          lastLog[l.from] = l.createdAt;
        }
        if (new Date(l.createdAt).getTime() > todayStart.getTime()) {
          countMap[l.from] = (countMap[l.from] || 0) + 1;
        }
      });
      setLastLogByAgent(lastLog);
      setLogCountByAgent(countMap);
    } catch {
      // sem logs ainda é ok
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = logs.filter(l => {
    if (filterAgent && l.from !== filterAgent && l.to !== filterAgent) return false;
    if (filterType && l.type !== filterType) return false;
    return true;
  });

  if (loading) return <Loading />;

  const activeCount = activeAgents.size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bot className="w-6 h-6 text-purple-400" />
            Agentes da Agência
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {AGENTS.length} agentes autônomos gerenciando suas redes sociais
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${
            activeCount > 0
              ? 'text-green-400 bg-green-400/10 border-green-400/30'
              : 'text-gray-400 bg-gray-400/10 border-gray-400/30'
          }`}>
            <span className={`w-2 h-2 rounded-full ${activeCount > 0 ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
            {activeCount} {activeCount === 1 ? 'agente ativo' : 'agentes ativos'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700 pb-0">
        {(['agents', 'chat'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab === 'agents' ? 'Todos os Agentes' : 'Chat entre Agentes'}
          </button>
        ))}
      </div>

      {/* ── TAB: AGENTES ── */}
      {activeTab === 'agents' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {AGENTS.map(agent => {
            const Icon = agent.icon;
            const isActive = activeAgents.has(agent.name);
            const lastRun = lastLogByAgent[agent.name];
            const todayCount = logCountByAgent[agent.name] || 0;
            return (
              <Card key={agent.name} className={`border ${agent.bg} bg-gray-800/50 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${agent.bg} flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${agent.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white text-sm">{agent.name}</h3>
                        <span className={`flex items-center gap-1 text-xs ${isActive ? 'text-green-400' : 'text-gray-500'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
                          {isActive ? 'ativo' : 'standby'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">{agent.role}</p>
                      <p className="text-xs text-gray-400 leading-relaxed">{agent.description}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-gray-500" />
                          <span className="text-xs text-gray-500">{agent.schedule}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {todayCount > 0 && (
                            <span className="text-xs text-gray-500 bg-gray-700/50 px-1.5 py-0.5 rounded">
                              {todayCount}x hoje
                            </span>
                          )}
                        </div>
                      </div>
                      {lastRun && (
                        <p className="text-xs text-gray-600 mt-1.5">
                          Última ação: {timeAgo(lastRun)}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── TAB: CHAT ── */}
      {activeTab === 'chat' && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={filterAgent}
                onChange={e => setFilterAgent(e.target.value)}
                className="bg-gray-700 border border-gray-600 text-gray-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-500"
              >
                <option value="">Todos os agentes</option>
                {AGENTS.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
              </select>
            </div>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="bg-gray-700 border border-gray-600 text-gray-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-500"
            >
              <option value="">Todos os tipos</option>
              {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <button
              onClick={fetchLogs}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 bg-gray-700 border border-gray-600 px-3 py-1.5 rounded-lg transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Atualizar
            </button>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              Recebendo em tempo real via Socket.io
            </span>
          </div>

          {/* Feed de logs */}
          <Card className="bg-gray-900 border-gray-700">
            <CardContent className="p-0">
              <div className="h-[580px] overflow-y-auto p-4 space-y-2 font-mono text-xs">
                {filteredLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <Bot className="w-12 h-12 mb-3 opacity-30" />
                    <p>Nenhuma comunicação registrada ainda.</p>
                    <p className="text-xs mt-1">Os logs aparecerão aqui quando os agentes trabalharem.</p>
                  </div>
                ) : (
                  filteredLogs.map((log, idx) => {
                    const cfg = TYPE_CONFIG[log.type] || TYPE_CONFIG.info;
                    const agentDef = AGENTS.find(a => a.name === log.from);
                    const AgIcon = agentDef?.icon || Bot;
                    return (
                      <div
                        key={log.id || idx}
                        className="flex items-start gap-3 py-2 border-b border-gray-800/60 last:border-0 group hover:bg-gray-800/30 rounded px-2 -mx-2 transition-colors"
                      >
                        <div className={`p-1.5 rounded flex-shrink-0 mt-0.5 ${agentDef?.bg || 'bg-gray-700'}`}>
                          <AgIcon className={`w-3 h-3 ${agentDef?.color || 'text-gray-400'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className={`font-semibold ${agentDef?.color || 'text-gray-300'}`}>
                              {log.from}
                            </span>
                            {log.to && (
                              <>
                                <ArrowRight className="w-3 h-3 text-gray-500" />
                                <span className="text-gray-400">{log.to}</span>
                              </>
                            )}
                            <span className={`px-1.5 py-0.5 rounded text-xs ${cfg.color} bg-gray-800 border border-gray-700`}>
                              {cfg.label}
                            </span>
                            <span className="text-gray-600 ml-auto text-xs">{timeAgo(log.createdAt)}</span>
                          </div>
                          <p className="text-gray-300 leading-relaxed">{log.message}</p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>
            </CardContent>
          </Card>

          {/* Legenda */}
          <div className="flex gap-4 flex-wrap">
            {Object.entries(TYPE_CONFIG).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className={`w-2 h-2 rounded-full ${v.dot}`} />
                {v.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
