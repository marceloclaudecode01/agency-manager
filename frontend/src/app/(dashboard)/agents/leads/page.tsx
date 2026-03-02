'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { UserPlus, Search, ArrowRight, Phone, Mail, MessageSquare, RefreshCw } from 'lucide-react';

const STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'];
const STAGE_COLORS: Record<string, string> = {
  NEW: 'bg-blue-500/20 text-blue-400',
  CONTACTED: 'bg-yellow-500/20 text-yellow-400',
  QUALIFIED: 'bg-purple-500/20 text-purple-400',
  PROPOSAL: 'bg-orange-500/20 text-orange-400',
  WON: 'bg-green-500/20 text-green-400',
  LOST: 'bg-red-500/20 text-red-400',
};

export default function LeadsPage() {
  const [pipeline, setPipeline] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' });
  const { toast } = useToast();

  const loadPipeline = async () => {
    try {
      const { data } = await api.get('/agents/growth/leads/pipeline');
      setPipeline(data.data || {});
    } catch { toast('Erro ao carregar pipeline', 'error'); }
    setLoading(false);
  };

  useEffect(() => { loadPipeline(); }, []);

  const scanNow = async () => {
    setScanning(true);
    try {
      const { data } = await api.post('/agents/growth/leads/scan');
      toast(`${data.data?.created || 0} leads capturados`);
      loadPipeline();
    } catch { toast('Erro no scan', 'error'); }
    setScanning(false);
  };

  const moveStage = async (leadId: string, stage: string) => {
    try {
      await api.patch(`/agents/growth/leads/${leadId}/stage`, { stage });
      loadPipeline();
    } catch { toast('Erro ao mover lead', 'error'); }
  };

  const createLead = async () => {
    try {
      await api.post('/agents/growth/leads', { ...form, source: 'manual' });
      toast('Lead criado');
      setForm({ name: '', email: '', phone: '', notes: '' });
      setShowForm(false);
      loadPipeline();
    } catch { toast('Erro ao criar lead', 'error'); }
  };

  if (loading) return <Loading />;

  const totalLeads = Object.values(pipeline).reduce((s, arr) => s + arr.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <UserPlus className="text-blue-400" /> Leads CRM
          </h1>
          <p className="text-text-secondary mt-1">{totalLeads} leads no pipeline</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={scanNow} disabled={scanning}>
            <Search size={16} className="mr-1" /> {scanning ? 'Escaneando...' : 'Scan Comentários'}
          </Button>
          <Button onClick={() => setShowForm(!showForm)}>
            <UserPlus size={16} className="mr-1" /> Novo Lead
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="border-primary/30">
          <CardContent className="p-4 grid grid-cols-2 gap-3">
            <input className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary" placeholder="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary" placeholder="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <Button onClick={createLead} className="col-span-2">Salvar Lead</Button>
          </CardContent>
        </Card>
      )}

      {/* Kanban Pipeline */}
      <div className="grid grid-cols-6 gap-3 overflow-x-auto">
        {STAGES.map((stage) => (
          <div key={stage} className="min-w-[200px]">
            <div className="flex items-center justify-between mb-2">
              <Badge className={STAGE_COLORS[stage]}>{stage}</Badge>
              <span className="text-xs text-text-secondary">{(pipeline[stage] || []).length}</span>
            </div>
            <div className="space-y-2">
              {(pipeline[stage] || []).map((lead: any) => (
                <Card key={lead.id} className="border-border/60 hover:border-primary/40 transition-colors">
                  <CardContent className="p-3 space-y-2">
                    <p className="text-sm font-medium text-text-primary truncate">{lead.name || 'Sem nome'}</p>
                    <div className="flex items-center gap-2 text-xs text-text-secondary">
                      <span>Score: {lead.score}</span>
                      <span className="text-text-secondary/40">|</span>
                      <span>{lead.source}</span>
                    </div>
                    {lead.email && <p className="text-xs text-text-secondary flex items-center gap-1"><Mail size={10} /> {lead.email}</p>}
                    {lead.phone && <p className="text-xs text-text-secondary flex items-center gap-1"><Phone size={10} /> {lead.phone}</p>}
                    <div className="flex gap-1 flex-wrap">
                      {STAGES.filter((s) => s !== stage).slice(0, 3).map((s) => (
                        <button key={s} onClick={() => moveStage(lead.id, s)} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-hover text-text-secondary hover:text-primary transition-colors">
                          {s}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
