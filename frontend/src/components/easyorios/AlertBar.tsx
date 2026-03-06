'use client';

import { AlertTriangle, Info, AlertCircle } from 'lucide-react';

interface Alert {
  id: string;
  moduleId: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

interface AlertBarProps {
  alerts: Alert[];
}

const severityConfig = {
  info: { icon: Info, bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-400' },
  warning: { icon: AlertTriangle, bg: 'bg-yellow-500/10 border-yellow-500/30', text: 'text-yellow-400' },
  critical: { icon: AlertCircle, bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-400' },
};

export function AlertBar({ alerts }: AlertBarProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {alerts.map(alert => {
        const config = severityConfig[alert.severity];
        const Icon = config.icon;
        return (
          <div key={alert.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${config.bg}`}>
            <Icon size={16} className={config.text} />
            <span className={`text-xs font-medium ${config.text}`}>{alert.title}:</span>
            <span className="text-xs text-text-secondary">{alert.message}</span>
          </div>
        );
      })}
    </div>
  );
}
