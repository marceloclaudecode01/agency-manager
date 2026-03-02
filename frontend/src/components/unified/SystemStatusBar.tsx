'use client';

import { Shield, ShieldOff, Activity, AlertTriangle, RefreshCw, Wifi } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Props {
  safeMode: boolean;
  runningAgents: number;
  totalAgents: number;
  totalErrors: number;
  globalStatus: 'ONLINE' | 'DEGRADED' | 'SAFE_MODE' | 'ERROR';
  onToggleSafeMode: (enabled: boolean) => void;
  onRefresh: () => void;
  loading: boolean;
}

const STATUS_CONFIG = {
  ONLINE: { label: 'ONLINE', variant: 'success' as const, icon: Wifi },
  DEGRADED: { label: 'DEGRADED', variant: 'warning' as const, icon: AlertTriangle },
  SAFE_MODE: { label: 'SAFE MODE', variant: 'purple' as const, icon: Shield },
  ERROR: { label: 'ERROR', variant: 'error' as const, icon: AlertTriangle },
};

export function SystemStatusBar({ safeMode, runningAgents, totalAgents, totalErrors, globalStatus, onToggleSafeMode, onRefresh, loading }: Props) {
  const status = STATUS_CONFIG[globalStatus];
  const StatusIcon = status.icon;

  return (
    <div className="rounded-xl border border-border/60 bg-surface/80 backdrop-blur-sm px-5 py-3 flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <StatusIcon size={18} className={globalStatus === 'ONLINE' ? 'text-emerald-400' : globalStatus === 'ERROR' ? 'text-red-400' : 'text-yellow-400'} />
          <span className="font-heading font-bold text-text-primary text-sm">UNIFIED COMMAND</span>
        </div>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <button
          onClick={() => onToggleSafeMode(!safeMode)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${
            safeMode
              ? 'border-primary/40 bg-primary/10 text-primary-300'
              : 'border-border/40 bg-surface-hover text-text-secondary hover:text-text-primary'
          }`}
        >
          {safeMode ? <Shield size={14} /> : <ShieldOff size={14} />}
          Safe Mode: {safeMode ? 'ON' : 'OFF'}
        </button>

        <div className="flex items-center gap-1.5 text-text-secondary">
          <Activity size={14} className="text-emerald-400" />
          <span className="text-text-primary font-medium">{runningAgents}/{totalAgents}</span> agents
        </div>

        {totalErrors > 0 && (
          <div className="flex items-center gap-1.5 text-red-400">
            <AlertTriangle size={14} />
            <span className="font-medium">{totalErrors}</span> errors
          </div>
        )}

        <button
          onClick={onRefresh}
          className="p-1.5 rounded-lg border border-border/40 text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-all"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
    </div>
  );
}
