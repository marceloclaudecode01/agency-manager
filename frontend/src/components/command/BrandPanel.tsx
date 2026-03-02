'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Palette, Save } from 'lucide-react';

interface BrandConfig {
  persona?: string;
  toneOfVoice?: string;
  values?: string;
  targetAudience?: string;
  contentPillars?: string;
}

interface BrandPanelProps {
  brand: BrandConfig | null;
  onSave: (data: BrandConfig) => Promise<void>;
}

export function BrandPanel({ brand, onSave }: BrandPanelProps) {
  const [form, setForm] = useState<BrandConfig>(brand || {});
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  const fields: { key: keyof BrandConfig; label: string; multiline?: boolean }[] = [
    { key: 'persona', label: 'Persona / Nome da Marca' },
    { key: 'toneOfVoice', label: 'Tom de Voz', multiline: true },
    { key: 'values', label: 'Valores da Marca', multiline: true },
    { key: 'targetAudience', label: 'Público-Alvo' },
    { key: 'contentPillars', label: 'Pilares de Conteúdo', multiline: true },
  ];

  return (
    <div className="rounded-xl border border-border/60 bg-surface/80 backdrop-blur-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-heading font-semibold text-text-primary">Brand Config</h3>
        </div>
        <Button size="sm" variant="outline" onClick={handleSave} disabled={saving} className="gap-1.5">
          <Save className="w-3.5 h-3.5" /> {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
      <div className="space-y-3">
        {fields.map(({ key, label, multiline }) => (
          <div key={key}>
            <label className="text-xs text-text-secondary mb-1 block">{label}</label>
            {multiline ? (
              <textarea
                value={form[key] || ''}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                rows={3}
                className="w-full bg-surface-hover border border-border/60 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/50 resize-none"
              />
            ) : (
              <input
                value={form[key] || ''}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="w-full bg-surface-hover border border-border/60 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/50"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
