'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, User, CheckCircle, XCircle, Mic, MicOff, Bot, Zap, Users, Target, Clock, Shield, ShieldOff, Radar, Info } from 'lucide-react';
import { useEasyorios } from '@/hooks/useEasyorios';
import { useSocketContext } from '@/contexts/SocketContext';
import { useToast } from '@/components/ui/toast';
import { AlertBar } from '@/components/easyorios/AlertBar';
import { ModuleWidget } from '@/components/easyorios/ModuleWidget';

const COMMAND_ACTIONS = [
  { label: 'Safe Mode ON', prompt: 'ativar safe mode', icon: Shield, color: 'text-red-400 border-red-500/30' },
  { label: 'Safe Mode OFF', prompt: 'desativar safe mode', icon: ShieldOff, color: 'text-green-400 border-green-500/30' },
  { label: 'Sentinel Scan', prompt: 'rodar sentinel', icon: Radar, color: 'text-blue-400 border-blue-500/30' },
  { label: 'Status Sistema', prompt: 'status do sistema', icon: Info, color: 'text-yellow-400 border-yellow-500/30' },
];

export default function EasyoriosPage() {
  const { messages, loading, modules, quickActions, alerts, agents, dashboard, sendMessage, fetchMeta, injectMessage } = useEasyorios();
  const { socket } = useSocketContext();
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Listen for real-time Easyorios alerts via socket.io
  useEffect(() => {
    if (!socket) return;
    const alertHandler = (alert: { title: string; message: string; severity: string }) => {
      injectMessage(`🔔 [${alert.title}] ${alert.message}`);
      toast(`${alert.title}: ${alert.message}`, alert.severity === 'critical' ? 'error' : 'warning');
    };
    const scheduledHandler = (data: { actionName: string; result: string; executedAt: string }) => {
      injectMessage(`⏰ [${data.actionName}]\n${data.result}`);
      toast(`Agendamento executado: ${data.actionName}`, 'success');
    };
    socket.on('easyorios:alert', alertHandler);
    socket.on('easyorios:scheduled-result', scheduledHandler);
    return () => {
      socket.off('easyorios:alert', alertHandler);
      socket.off('easyorios:scheduled-result', scheduledHandler);
    };
  }, [socket, injectMessage, toast]);

  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev ? `${prev} ${transcript}` : transcript);
      setIsListening(false);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  useEffect(() => {
    fetchMeta();
    const interval = setInterval(fetchMeta, 60000);
    return () => clearInterval(interval);
  }, [fetchMeta]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage(input);
      setInput('');
    }
  };

  const statusDot = (s: string) =>
    s === 'active' ? 'bg-green-500' : s === 'error' ? 'bg-red-500' : 'bg-zinc-500';

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] gap-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
          <Sparkles size={22} className="text-primary-300" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-text-primary">Easyorios — Assistente Universal</h1>
          <p className="text-xs text-text-secondary">
            {modules.map(m => m.name).join(' + ') || 'Carregando modulos...'}
          </p>
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

      {/* Alerts */}
      <AlertBar alerts={alerts} />

      {/* Quick Actions */}
      {quickActions.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {quickActions.map(action => (
            <button
              key={`${action.moduleId}-${action.label}`}
              onClick={() => sendMessage(action.prompt)}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border bg-surface hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Command Actions */}
      <div className="flex gap-2 flex-wrap">
        {COMMAND_ACTIONS.map((action) => (
          <button
            key={action.label}
            onClick={() => sendMessage(action.prompt)}
            disabled={loading}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border bg-surface hover:bg-surface-hover transition-colors disabled:opacity-50 ${action.color}`}
          >
            <action.icon size={14} />
            {action.label}
          </button>
        ))}
      </div>

      {/* Main Content: Chat + Sidebar */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Chat */}
        <div className="flex-[3] flex flex-col min-h-0 border border-border rounded-xl bg-surface">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="h-8 w-8 rounded-full bg-primary/20 flex-shrink-0 flex items-center justify-center">
                    <Sparkles size={16} className="text-primary-300" />
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
                  {msg.commandExecuted && (
                    <div className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${msg.commandExecuted.success ? 'text-green-400' : 'text-red-400'}`}>
                      {msg.commandExecuted.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
                      {msg.commandExecuted.command}
                    </div>
                  )}
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
                  <Sparkles size={16} className="text-primary-300" />
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
                onChange={e => setInput(e.target.value)}
                placeholder={isListening ? 'Ouvindo...' : 'Pergunte algo ao Easyorios...'}
                className={`flex-1 rounded-xl border bg-background px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/50 ${isListening ? 'border-red-500 animate-pulse' : 'border-border'}`}
                disabled={loading}
              />
              <button
                type="button"
                onClick={toggleVoice}
                className={`rounded-xl px-3 py-2.5 transition-colors ${isListening ? 'bg-red-500 text-white' : 'bg-surface-hover text-text-secondary hover:text-text-primary'}`}
                title={isListening ? 'Parar' : 'Falar'}
              >
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
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

        {/* Sidebar: Modules + Agent Inventory */}
        <div className="flex-[2] flex flex-col gap-3 min-h-0 hidden lg:flex">
          <ModuleWidget modules={modules} />

          {/* Agent Inventory */}
          <div className="flex-1 border border-border rounded-xl bg-surface flex flex-col min-h-0">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">Inventario de Agentes</h2>
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
    </div>
  );
}
