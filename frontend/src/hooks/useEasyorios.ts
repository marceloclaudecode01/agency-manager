import { useState, useCallback, useEffect, useRef } from 'react';
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

const WELCOME_MSG: Message = {
  role: 'assistant',
  content: 'Ola! Sou o Easyorios, o cerebro da sua agencia de marketing digital. Gerencio seus agentes autonomos, publicacoes, clientes e metricas. Tambem cuido das suas financas pessoais, lembretes, to-dos, pesquisas web, comunicacao via Telegram e dispositivos smart home. Pergunte qualquer coisa!',
};

export function useEasyorios() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MSG]);
  const [loading, setLoading] = useState(false);
  const historyLoaded = useRef(false);

  // Load persisted conversation history on mount
  useEffect(() => {
    if (historyLoaded.current) return;
    historyLoaded.current = true;
    api.get('/easyorios/history').then(({ data }) => {
      const history: Message[] = data.data?.messages || [];
      if (history.length > 0) {
        setMessages([WELCOME_MSG, ...history]);
      }
    }).catch(() => {});
  }, []);
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [alerts, setAlerts] = useState<ModuleAlert[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  const fetchMeta = useCallback(async () => {
    try {
      const [modRes, qaRes, alertRes, invRes, dashRes] = await Promise.allSettled([
        api.get('/easyorios/modules'),
        api.get('/easyorios/quick-actions'),
        api.get('/easyorios/alerts'),
        api.get('/easyorios/inventory'),
        api.get('/easyorios/dashboard'),
      ]);
      if (modRes.status === 'fulfilled') setModules(modRes.value.data.data.modules);
      if (qaRes.status === 'fulfilled') setQuickActions(qaRes.value.data.data.actions);
      if (alertRes.status === 'fulfilled') setAlerts(alertRes.value.data.data.alerts);
      if (invRes.status === 'fulfilled') setAgents(invRes.value.data.data.agents || []);
      if (dashRes.status === 'fulfilled') setDashboard(dashRes.value.data.data || null);
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

  const injectMessage = useCallback((content: string) => {
    setMessages(prev => [...prev, { role: 'assistant', content }]);
  }, []);

  return {
    messages,
    loading,
    modules,
    quickActions,
    alerts,
    agents,
    dashboard,
    sendMessage,
    fetchMeta,
    injectMessage,
  };
}
