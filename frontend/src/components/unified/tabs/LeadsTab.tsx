'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Search, ArrowRight } from 'lucide-react';

const STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'] as const;
const STAGE_COLORS: Record<string, string> = {
  NEW: 'bg-blue-500/20 border-blue-500/40 text-blue-400',
  CONTACTED: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400',
  QUALIFIED: 'bg-violet-500/20 border-violet-500/40 text-violet-400',
  PROPOSAL: 'bg-amber-500/20 border-amber-500/40 text-amber-400',
  WON: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400',
  LOST: 'bg-red-500/20 border-red-500/40 text-red-400',
};

interface LeadsTabProps {
  leads: { pipeline: any[]; total: number };
  onScan: () => Promise<void>;
  onMoveStage: (leadId: string, stage: string) => Promise<void>;
  onCreate: (data: any) => Promise<void>;
}

export function LeadsTab({ leads, onScan, onMoveStage, onCreate }: LeadsTabProps) {
  const [scanning, setScanning] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' });

  const handleScan = async () => {
    setScanning(true);
    try { await onScan(); } finally { setScanning(false); }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    await onCreate(form);
    setForm({ name: '', email: '', phone: '', notes: '' });
    setShowForm(false);
  };

  const pipeline = leads.pipeline || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-heading font-semibold text-text-primary flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-400" /> Leads Pipeline
          <Badge variant="default" className="text-xs">{leads.total} total</Badge>
        </h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleScan} disabled={scanning} className="gap-1.5">
            <Search className="w-3.5 h-3.5" /> {scanning ? 'Escaneando...' : 'Scan Comments'}
          </Button>
          <Button size="sm" onClick={() => setShowForm(!showForm)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Novo Lead
          </Button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border/60 bg-surface/80 p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome *" className="bg-surface-hover border border-border/60 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/50" />
            <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email" className="bg-surface-hover border border-border/60 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/50" />
            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Telefone" className="bg-surface-hover border border-border/60 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/50" />
            <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notas" className="bg-surface-hover border border-border/60 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary/50" />
          </div>
          <Button size="sm" onClick={handleCreate} disabled={!form.name.trim()}>Criar Lead</Button>
        </div>
      )}

      {/* Kanban Board */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {STAGES.map(stage => {
          const stageLeads = pipeline.filter((l: any) => (l.stage || l.status) === stage);
          return (
            <div key={stage} className="space-y-2">
              <div className={`rounded-lg border px-3 py-1.5 text-center text-xs font-bold ${STAGE_COLORS[stage]}`}>
                {stage} ({stageLeads.length})
              </div>
              <div className="space-y-2 min-h-[80px]">
                {stageLeads.map((lead: any) => (
                  <div key={lead.id} className="rounded-lg border border-border/60 bg-surface/80 p-2.5 text-xs space-y-1">
                    <p className="font-semibold text-text-primary truncate">{lead.name}</p>
                    {lead.score != null && <p className="text-text-secondary">Score: {lead.score}</p>}
                    {lead.source && <Badge variant="default" className="text-[10px]">{lead.source}</Badge>}
                    <div className="flex gap-1 flex-wrap pt-1">
                      {STAGES.filter(s => s !== stage && s !== 'LOST').map(s => (
                        <button
                          key={s}
                          onClick={() => onMoveStage(lead.id, s)}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-surface-hover hover:bg-primary/20 text-text-secondary hover:text-primary transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
