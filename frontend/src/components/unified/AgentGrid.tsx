'use client';

import { useState } from 'react';
import { Play, Pause, ChevronDown, ChevronUp } from 'lucide-react';
import type { AgentLog } from '@/hooks/useCommandCenter';

interface AgentInfo {
  name: string;
  paused: boolean;
  status: 'running' | 'paused' | 'safe_mode' | 'error';
}

interface Props {
  agents: AgentInfo[];
  logs: AgentLog[];
  onToggleAgent: (name: string, paused: boolean) => void;
}

const STATUS_DOT: Record<string, string> = {
  running: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]',
  paused: 'bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.4)]',
  safe_mode: 'bg-violet-400 shadow-[0_0_6px_rgba(167,139,250,0.4)]',
  error: 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]',
};

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function AgentGrid({ agents, logs, onToggleAgent }: Props) {
  const [showLogs, setShowLogs] = useState(true);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* Agent Mini Cards */}
      <div className="rounded-xl border border-border/60 bg-surface/80 backdrop-blur-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-heading font-semibold text-text-primary">Agent Grid</h3>
          <span className="text-xs text-text-secondary">{agents.filter(a => a.status === 'running').length} active</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[320px] overflow-y-auto pr-1">
          {agents.map(agent => (
            <div key={agent.name} className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border/40 bg-background/50 text-xs group hover:border-primary/20 transition-all">
              <div className={`h-2 w-2 rounded-full flex-shrink-0 ${STATUS_DOT[agent.status] || STATUS_DOT.paused}`} />
              <span className="text-text-primary truncate flex-1" title={agent.name}>
                {agent.name.replace(/[-_]agent$/i, '').replace(/[-_]/g, ' ')}
              </span>
              <button
                onClick={() => onToggleAgent(agent.name, !agent.paused)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-surface-hover"
                title={agent.paused ? 'Resume' : 'Pause'}
              >
                {agent.paused ? <Play size={12} className="text-emerald-400" /> : <Pause size={12} className="text-yellow-400" />}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Live Activity Feed */}
      <div className="rounded-xl border border-border/60 bg-surface/80 backdrop-blur-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-heading font-semibold text-text-primary">Live Activity</h3>
          <button onClick={() => setShowLogs(!showLogs)} className="text-text-secondary hover:text-text-primary">
            {showLogs ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
        {showLogs && (
          <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
            {logs.length === 0 && <p className="text-xs text-text-secondary">No recent activity</p>}
            {[...logs].reverse().slice(0, 30).map(log => (
              <div key={log.id} className="flex items-start gap-2 text-xs py-1 border-b border-border/20 last:border-0">
                <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5 ${
                  log.type === 'error' ? 'bg-red-400' : log.type === 'action' ? 'bg-blue-400' : log.type === 'result' ? 'bg-emerald-400' : 'bg-gray-400'
                }`} />
                <div className="min-w-0 flex-1">
                  <span className="text-text-secondary">{log.from}</span>
                  <span className="text-text-primary ml-1 break-all">{log.message.slice(0, 120)}</span>
                </div>
                <span className="text-text-secondary flex-shrink-0">{timeAgo(log.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
