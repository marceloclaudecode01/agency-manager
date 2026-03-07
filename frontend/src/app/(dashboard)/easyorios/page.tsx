'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, User, CheckCircle, XCircle, Mic, MicOff, Bot, Zap, Users, Target, Shield, ShieldOff, Radar, Info, ChevronDown, ChevronUp, LayoutDashboard } from 'lucide-react';
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
  const [showPanel, setShowPanel] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Listen for real-time Easyorios alerts via socket.io
  useEffect(() => {
    if (!socket) return;
    const alertHandler = (alert: { title: string; message: string; severity: string }) => {
      injectMessage(`[${alert.title}] ${alert.message}`);
      toast(`${alert.title}: ${alert.message}`, alert.severity === 'critical' ? 'error' : 'warning');
    };
    const scheduledHandler = (data: { actionName: string; result: string; executedAt: string }) => {
      injectMessage(`[${data.actionName}]\n${data.result}`);
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
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Compact Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center">
            <Sparkles size={20} className="text-primary-300" />
          </div>
          <div>
            <h1 className="text-base font-bold text-text-primary">Easyorios</h1>
            <p className="text-[10px] text-text-secondary leading-tight">
              {modules.length} modulos ativos
              {dashboard ? ` | ${dashboard.totalAgents} agentes | ${dashboard.postsToday} posts hoje` : ''}
            </p>
          </div>
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        </div>

        <div className="flex items-center gap-2">
          {/* Quick command buttons - compact */}
          {COMMAND_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => sendMessage(action.prompt)}
              disabled={loading}
              className={`p-2 rounded-lg border bg-surface hover:bg-surface-hover transition-colors disabled:opacity-50 ${action.color}`}
              title={action.label}
            >
              <action.icon size={14} />
            </button>
          ))}

          {/* Toggle panel button */}
          <button
            onClick={() => setShowPanel(!showPanel)}
            className="p-2 rounded-lg border border-border bg-surface hover:bg-surface-hover text-text-secondary transition-colors"
            title={showPanel ? 'Esconder painel' : 'Mostrar painel'}
          >
            <LayoutDashboard size={14} />
          </button>
        </div>
      </div>

      {/* Alerts - only show if there are alerts */}
      {alerts.length > 0 && (
        <div className="px-4 pt-2">
          <AlertBar alerts={alerts} />
        </div>
      )}

      {/* Main Area */}
      <div className="flex-1 flex min-h-0">
        {/* Chat - takes full width or 3/5 when panel open */}
        <div className={`flex flex-col min-h-0 ${showPanel ? 'flex-[3]' : 'flex-1'}`}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-text-secondary gap-3">
                <Sparkles size={40} className="text-primary/30" />
                <p className="text-sm">Pergunte algo ao Easyorios...</p>
                {/* Quick action chips */}
                <div className="flex flex-wrap gap-2 justify-center max-w-md mt-2">
                  {quickActions.slice(0, 6).map(action => (
                    <button
                      key={`${action.moduleId}-${action.label}`}
                      onClick={() => sendMessage(action.prompt)}
                      disabled={loading}
                      className="px-3 py-1.5 text-xs rounded-full border border-border bg-surface hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="h-7 w-7 rounded-full bg-primary/20 flex-shrink-0 flex items-center justify-center mt-0.5">
                    <Sparkles size={14} className="text-primary-300" />
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-primary text-white rounded-br-sm'
                      : 'bg-surface-hover text-text-primary rounded-bl-sm border border-border/50'
                  }`}
                >
                  {msg.content}
                  {msg.commandExecuted && (
                    <div className={`mt-1.5 flex items-center gap-1.5 text-[11px] font-medium ${msg.commandExecuted.success ? 'text-green-400' : 'text-red-400'}`}>
                      {msg.commandExecuted.success ? <CheckCircle size={12} /> : <XCircle size={12} />}
                      {msg.commandExecuted.command}
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="h-7 w-7 rounded-full bg-surface-hover flex-shrink-0 flex items-center justify-center mt-0.5">
                    <User size={14} className="text-text-secondary" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5 justify-start">
                <div className="h-7 w-7 rounded-full bg-primary/20 flex-shrink-0 flex items-center justify-center">
                  <Sparkles size={14} className="text-primary-300" />
                </div>
                <div className="bg-surface-hover rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-text-secondary border border-border/50">
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

          {/* Input */}
          <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-border bg-surface">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={isListening ? 'Ouvindo...' : 'Mensagem...'}
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

        {/* Side Panel - only visible when toggled */}
        {showPanel && (
          <div className="flex-[2] flex flex-col gap-3 min-h-0 border-l border-border p-3 bg-surface/50 hidden lg:flex">
            {/* Dashboard Stats */}
            {dashboard && (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Agentes', value: dashboard.totalAgents, icon: Bot, color: 'text-blue-400' },
                  { label: 'Posts Hoje', value: dashboard.postsToday, icon: Zap, color: 'text-green-400' },
                  { label: 'Leads', value: dashboard.totalLeads, icon: Users, color: 'text-purple-400' },
                  { label: 'Campanhas', value: dashboard.activeCampaigns, icon: Target, color: 'text-orange-400' },
                ].map((card) => (
                  <div key={card.label} className="border border-border rounded-lg p-2.5 flex items-center gap-2">
                    <card.icon size={16} className={card.color} />
                    <div>
                      <p className="text-lg font-bold text-text-primary leading-none">{card.value}</p>
                      <p className="text-[10px] text-text-secondary">{card.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Modules */}
            <ModuleWidget modules={modules} />

            {/* Quick Actions */}
            {quickActions.length > 0 && (
              <div className="border border-border rounded-lg p-2.5">
                <p className="text-xs font-semibold text-text-primary mb-2">Acoes Rapidas</p>
                <div className="flex flex-wrap gap-1.5">
                  {quickActions.map(action => (
                    <button
                      key={`${action.moduleId}-${action.label}`}
                      onClick={() => sendMessage(action.prompt)}
                      disabled={loading}
                      className="px-2.5 py-1 text-[10px] rounded-md border border-border bg-surface hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Agent Inventory */}
            <div className="flex-1 border border-border rounded-lg flex flex-col min-h-0">
              <div className="p-2.5 border-b border-border flex items-center justify-between">
                <h2 className="text-xs font-semibold text-text-primary">Agentes</h2>
                <span className="text-[10px] text-text-secondary">{agents.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-surface">
                    <tr className="text-left text-text-secondary border-b border-border">
                      <th className="px-2.5 py-1.5">Nome</th>
                      <th className="px-2.5 py-1.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((agent) => (
                      <tr key={agent.function} className="border-b border-border/30 hover:bg-surface-hover">
                        <td className="px-2.5 py-1.5 text-text-primary">{agent.name}</td>
                        <td className="px-2.5 py-1.5 text-center">
                          <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusDot(agent.status)}`} title={agent.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
