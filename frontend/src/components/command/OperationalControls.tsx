'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Settings, Save } from 'lucide-react';

interface StrategyData {
  weeklyPostLimit?: number;
  cooldownHours?: number;
  contentMix?: Record<string, number>;
  focusTopics?: string[];
}

interface OperationalControlsProps {
  strategy: StrategyData | null;
  onSaveStrategy: (data: StrategyData) => Promise<void>;
}

export function OperationalControls({ strategy, onSaveStrategy }: OperationalControlsProps) {
  const [form, setForm] = useState<StrategyData>(strategy || {});
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveStrategy(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/60 bg-surface/80 backdrop-blur-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-heading font-semibold text-text-primary">Controles Operacionais</h3>
        </div>
        <Button size="sm" variant="outline" onClick={handleSave} disabled={saving} className="gap-1.5">
          <Save className="w-3.5 h-3.5" /> {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-text-secondary mb-1 block">Posts por Semana (limite)</label>
          <input
            type="number"
            value={form.weeklyPostLimit || 30}
            onChange={(e) => setForm({ ...form, weeklyPostLimit: parseInt(e.target.value) || 30 })}
            className="w-full bg-surface-hover border border-border/60 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/50"
          />
        </div>
        <div>
          <label className="text-xs text-text-secondary mb-1 block">Cooldown entre Posts (horas)</label>
          <input
            type="number"
            value={form.cooldownHours || 4}
            onChange={(e) => setForm({ ...form, cooldownHours: parseInt(e.target.value) || 4 })}
            className="w-full bg-surface-hover border border-border/60 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/50"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-text-secondary mb-1 block">Tópicos Foco (separados por vírgula)</label>
          <input
            value={(form.focusTopics || []).join(', ')}
            onChange={(e) => setForm({ ...form, focusTopics: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
            className="w-full bg-surface-hover border border-border/60 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/50"
            placeholder="ex: slots, cassino, promoções"
          />
        </div>
      </div>
    </div>
  );
}
