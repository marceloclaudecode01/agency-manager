'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, User, CheckCircle, XCircle } from 'lucide-react';
import { useEasyorios } from '@/hooks/useEasyorios';
import { AlertBar } from '@/components/easyorios/AlertBar';
import { ModuleWidget } from '@/components/easyorios/ModuleWidget';

export default function EasyoriosPage() {
  const { messages, loading, modules, quickActions, alerts, sendMessage, fetchMeta } = useEasyorios();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

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
                placeholder="Pergunte algo ao Easyorios..."
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

        {/* Sidebar: Modules */}
        <div className="flex-[1] flex flex-col gap-3 min-h-0 hidden lg:flex">
          <ModuleWidget modules={modules} />
        </div>
      </div>
    </div>
  );
}
