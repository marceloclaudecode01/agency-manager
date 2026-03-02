'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Send, Brain, User, Bot, BarChart3, Target, Zap, Users, Activity, Clock, Wifi, WifiOff } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Agent {
  name: string;
  function: string;
  specialty: string;
  schedule: string;
  autonomyLevel: string;
  lastRun: string | null;
  status: 'active' | 'idle' | 'error';
}

interface DashboardData {
  totalAgents: number;
  postsToday: number;
  totalLeads: number;
  activeCampaigns: number;
  safeMode: string;
  agentActions24h: number;
  postsPending: number;
  totalRevenue: number;
}

const QUICK_ACTIONS = [
  { label: 'Status Geral', prompt: 'Qual o status geral da agência agora?', icon: Activity },
  { label: 'Performance', prompt: 'Como está a performance dos posts e engajamento?', icon: BarChart3 },
  { label: 'Estratégia', prompt: 'Qual a estratégia atual e recomendações?', icon: Target },
  { label: 'Leads', prompt: 'Como estão os leads e o funil de vendas?', icon: Users },
];

export default function OrionPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Olá! Sou o Orion, o cérebro central da agência. Tenho acesso a todos os dados em tempo real — agentes, posts, leads, campanhas e estratégia. Como posso ajudar?' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const [inv, dash] = await Promise.all([
        api.get('/ai-chat/inventory'),
        api.get('/ai-chat/dashboard'),
      ]);
      setAgents(inv.data.data.agents);
      setDashboard(dash.data.data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    text = text.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await api.post('/ai-chat/message', { message: text, history: messages });
      setMessages((prev) => [...prev, { role: 'assistant', content: data.data.response }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Erro ao processar. Tente novamente.' }]);
    }
    setLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const statusDot = (s: string) =>
    s === 'active' ? 'bg-green-500' : s === 'error' ? 'bg-red-500' : 'bg-zinc-500';

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] gap-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
          <Brain size={22} className="text-primary-300" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-text-primary">Orion — Cérebro Central</h1>
          <p className="text-xs text-text-secondary">CEO · CTO · CMO — Acesso total à infraestrutura</p>
        </div>
        <span className="ml-2 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
      </div>

      {/* Stat Cards */}
      {dashboard && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Agentes', value: dashboard.totalAgents, icon: Bot, color: 'text-blue-400' },
            { label: 'Posts Hoje', value: dashboard.postsToday, icon: Zap, color: 'text-green-400' },
            { label: 'Leads', value: dashboard.totalLeads, icon: Users, color: 'text-purple-400' },
            { label: 'Campanhas', value: dashboard.activeCampaigns, icon: Target, color: 'text-orange-400' },
          ].map((card) => (
            <div key={card.label} className="bg-surface border border-border rounded-xl p-3 flex items-center gap-3">
              <card.icon size={20} className={card.color} />
              <div>
                <p className="text-xl font-bold text-text-primary">{card.value}</p>
                <p className="text-xs text-text-secondary">{card.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-2 flex-wrap">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => sendMessage(action.prompt)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border bg-surface hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
          >
            <action.icon size={14} />
            {action.label}
          </button>
        ))}
      </div>

      {/* Main Content: Chat + Inventory */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Chat (60%) */}
        <div className="flex-[3] flex flex-col min-h-0 border border-border rounded-xl bg-surface">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex-shrink-0 flex items-center justify-center">
                    <Brain size={16} className="text-primary-300" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-primary text-white rounded-br-md'
                      : 'bg-surface-hover text-text-primary rounded-bl-md'
                  }`}
                >
                  {msg.content}
                </div>
                {msg.role === 'user' && (
                  <div className="h-8 w-8 rounded-full bg-surface-hover flex-shrink-0 flex items-center justify-center">
                    <User size={16} className="text-text-secondary" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex-shrink-0 flex items-center justify-center">
                  <Brain size={16} className="text-primary-300" />
                </div>
                <div className="bg-surface-hover rounded-2xl rounded-bl-md px-4 py-3 text-sm text-text-secondary">
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                    <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                    <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSubmit} className="p-3 border-t border-border">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pergunte algo ao Orion..."
                className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/50"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="rounded-xl bg-primary px-4 py-2.5 text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <Send size={18} />
              </button>
            </div>
          </form>
        </div>

        {/* Agent Inventory (40%) */}
        <div className="flex-[2] border border-border rounded-xl bg-surface flex flex-col min-h-0 hidden lg:flex">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Inventário de Agentes</h2>
            <span className="text-xs text-text-secondary">{agents.length} agentes</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface">
                <tr className="text-left text-text-secondary border-b border-border">
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2 hidden xl:table-cell">Especialidade</th>
                  <th className="px-3 py-2">Schedule</th>
                  <th className="px-3 py-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr key={agent.function} className="border-b border-border/50 hover:bg-surface-hover">
                    <td className="px-3 py-2 text-text-primary font-medium">{agent.name}</td>
                    <td className="px-3 py-2 text-text-secondary hidden xl:table-cell">{agent.specialty}</td>
                    <td className="px-3 py-2 text-text-secondary flex items-center gap-1">
                      <Clock size={10} />
                      {agent.schedule}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block h-2 w-2 rounded-full ${statusDot(agent.status)}`} title={agent.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
