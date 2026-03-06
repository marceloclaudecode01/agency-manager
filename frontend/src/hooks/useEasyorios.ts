import { useState, useCallback } from 'react';
import api from '@/lib/api';

interface CommandExecuted {
  command: string;
  success: boolean;
  message: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  commandExecuted?: CommandExecuted | null;
}

interface ModuleInfo {
  id: string;
  name: string;
  icon: string;
  commandCount: number;
}

interface QuickAction {
  label: string;
  prompt: string;
  icon: string;
  moduleId: string;
}

interface ModuleAlert {
  id: string;
  moduleId: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  createdAt: string;
}

export function useEasyorios() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Ola! Sou o Easyorios, seu assistente pessoal universal. Tenho modulos de marketing, notas, lembretes e to-dos. Como posso ajudar?' },
  ]);
  const [loading, setLoading] = useState(false);
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [alerts, setAlerts] = useState<ModuleAlert[]>([]);

  const fetchMeta = useCallback(async () => {
    try {
      const [modRes, qaRes, alertRes] = await Promise.allSettled([
        api.get('/easyorios/modules'),
        api.get('/easyorios/quick-actions'),
        api.get('/easyorios/alerts'),
      ]);
      if (modRes.status === 'fulfilled') setModules(modRes.value.data.data.modules);
      if (qaRes.status === 'fulfilled') setQuickActions(qaRes.value.data.data.actions);
      if (alertRes.status === 'fulfilled') setAlerts(alertRes.value.data.data.alerts);
    } catch {}
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    text = text.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const { data } = await api.post('/easyorios/message', {
        message: text,
        history: messages,
      });
      const cmdExec = data.data.commandExecuted || null;
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.data.response,
        commandExecuted: cmdExec,
      }]);
      if (cmdExec) fetchMeta();
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Erro ao processar. Tente novamente.',
      }]);
    }
    setLoading(false);
  }, [loading, messages, fetchMeta]);

  return {
    messages,
    loading,
    modules,
    quickActions,
    alerts,
    sendMessage,
    fetchMeta,
  };
}
