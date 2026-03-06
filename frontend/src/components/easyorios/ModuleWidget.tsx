'use client';

import { Package } from 'lucide-react';

interface ModuleInfo {
  id: string;
  name: string;
  icon: string;
  commandCount: number;
}

interface ModuleWidgetProps {
  modules: ModuleInfo[];
}

export function ModuleWidget({ modules }: ModuleWidgetProps) {
  if (modules.length === 0) return null;

  return (
    <div className="border border-border rounded-xl bg-surface p-3">
      <h3 className="text-sm font-semibold text-text-primary mb-2">Modulos Ativos</h3>
      <div className="space-y-2">
        {modules.map(mod => (
          <div key={mod.id} className="flex items-center gap-2 text-xs">
            <Package size={14} className="text-primary-300" />
            <span className="text-text-primary font-medium">{mod.name}</span>
            <span className="text-text-secondary ml-auto">{mod.commandCount} cmd</span>
          </div>
        ))}
      </div>
    </div>
  );
}
