'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Budget, Invoice } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Loading } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import { DollarSign, Plus, TrendingUp, Clock, CheckCircle2 } from 'lucide-react';

const budgetStatusBadge: Record<string, { variant: any; label: string }> = {
  DRAFT: { variant: 'default', label: 'Rascunho' },
  SENT: { variant: 'info', label: 'Enviado' },
  APPROVED: { variant: 'success', label: 'Aprovado' },
  REJECTED: { variant: 'error', label: 'Rejeitado' },
};

const invoiceStatusBadge: Record<string, { variant: any; label: string }> = {
  PENDING: { variant: 'warning', label: 'Pendente' },
  PAID: { variant: 'success', label: 'Pago' },
  OVERDUE: { variant: 'error', label: 'Atrasado' },
  CANCELLED: { variant: 'default', label: 'Cancelado' },
};

export default function FinancePage() {
  const { toast } = useToast();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState({ totalRevenue: 0, pendingAmount: 0, pendingCount: 0, paidCount: 0 });
  const [clients, setClients] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'budgets' | 'invoices'>('budgets');
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [budgetForm, setBudgetForm] = useState({ title: '', clientId: '', campaignId: '', total: '', status: 'DRAFT' });
  const [invoiceForm, setInvoiceForm] = useState({ clientId: '', amount: '', dueDate: '' });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'budget' | 'invoice'; id: string } | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [budgetsRes, invoicesRes, summaryRes, clientsRes, campRes] = await Promise.all([
        api.get('/finance/budgets'),
        api.get('/finance/invoices'),
        api.get('/finance/summary'),
        api.get('/clients'),
        api.get('/campaigns'),
      ]);
      setBudgets(budgetsRes.data.data || []);
      setInvoices(invoicesRes.data.data || []);
      setSummary(summaryRes.data.data || {});
      setClients(clientsRes.data.data || []);
      setCampaigns(campRes.data.data || []);
    } catch {
      toast('Erro ao carregar dados financeiros', 'error');
    } finally {
      setLoading(false);
    }
  };

  const createBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/finance/budgets', {
        title: budgetForm.title,
        clientId: budgetForm.clientId,
        campaignId: budgetForm.campaignId || undefined,
        total: parseFloat(budgetForm.total),
        status: budgetForm.status,
      });
      setShowBudgetModal(false);
      setBudgetForm({ title: '', clientId: '', campaignId: '', total: '', status: 'DRAFT' });
      toast('Orçamento criado com sucesso');
      loadData();
    } catch {
      toast('Erro ao criar orçamento', 'error');
    } finally { setSaving(false); }
  };

  const createInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/finance/invoices', { clientId: invoiceForm.clientId, amount: parseFloat(invoiceForm.amount), dueDate: invoiceForm.dueDate || undefined });
      setShowInvoiceModal(false);
      setInvoiceForm({ clientId: '', amount: '', dueDate: '' });
      toast('Fatura criada com sucesso');
      loadData();
    } catch {
      toast('Erro ao criar fatura', 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await api.delete(`/finance/${deleteConfirm.type === 'budget' ? 'budgets' : 'invoices'}/${deleteConfirm.id}`);
      toast(deleteConfirm.type === 'budget' ? 'Orçamento excluído' : 'Fatura excluída');
      setDeleteConfirm(null);
      loadData();
    } catch {
      toast('Erro ao excluir', 'error');
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center text-success"><TrendingUp size={24} /></div>
          <div><p className="text-sm text-text-secondary">Receita Total</p><p className="text-2xl font-heading font-bold text-text-primary">{formatCurrency(summary.totalRevenue)}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-warning/10 flex items-center justify-center text-warning"><Clock size={24} /></div>
          <div><p className="text-sm text-text-secondary">Pendente</p><p className="text-2xl font-heading font-bold text-text-primary">{formatCurrency(summary.pendingAmount)}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary-300"><DollarSign size={24} /></div>
          <div><p className="text-sm text-text-secondary">Faturas Pendentes</p><p className="text-2xl font-heading font-bold text-text-primary">{summary.pendingCount}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-success/10 flex items-center justify-center text-success"><CheckCircle2 size={24} /></div>
          <div><p className="text-sm text-text-secondary">Faturas Pagas</p><p className="text-2xl font-heading font-bold text-text-primary">{summary.paidCount}</p></div>
        </CardContent></Card>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex gap-2">
          <button onClick={() => setTab('budgets')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'budgets' ? 'bg-primary text-white' : 'text-text-secondary hover:bg-surface-hover'}`}>Orçamentos</button>
          <button onClick={() => setTab('invoices')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'invoices' ? 'bg-primary text-white' : 'text-text-secondary hover:bg-surface-hover'}`}>Faturas</button>
        </div>
        <Button onClick={() => tab === 'budgets' ? setShowBudgetModal(true) : setShowInvoiceModal(true)}>
          <Plus size={18} className="mr-2" /> {tab === 'budgets' ? 'Novo Orçamento' : 'Nova Fatura'}
        </Button>
      </div>

      {tab === 'budgets' ? (
        <div className="rounded-xl border border-border overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead><tr className="bg-surface-hover/50 text-left">
              <th className="px-4 py-3 text-xs font-medium text-text-secondary">Título</th>
              <th className="px-4 py-3 text-xs font-medium text-text-secondary">Cliente</th>
              <th className="px-4 py-3 text-xs font-medium text-text-secondary">Campanha</th>
              <th className="px-4 py-3 text-xs font-medium text-text-secondary">Total</th>
              <th className="px-4 py-3 text-xs font-medium text-text-secondary">Status</th>
              <th className="px-4 py-3 text-xs font-medium text-text-secondary">Data</th>
              <th className="px-4 py-3 text-xs font-medium text-text-secondary"></th>
            </tr></thead>
            <tbody>
              {budgets.map((b) => (
                <tr key={b.id} className="border-t border-border hover:bg-surface-hover/30">
                  <td className="px-4 py-3 text-sm text-text-primary font-medium">{b.title}</td>
                  <td className="px-4 py-3 text-sm text-text-primary">{b.client?.name}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary">{b.campaign?.name || '-'}</td>
                  <td className="px-4 py-3 text-sm text-text-primary font-medium">{formatCurrency(b.total)}</td>
                  <td className="px-4 py-3"><Badge variant={budgetStatusBadge[b.status]?.variant}>{budgetStatusBadge[b.status]?.label}</Badge></td>
                  <td className="px-4 py-3 text-sm text-text-secondary">{formatDate(b.createdAt)}</td>
                  <td className="px-4 py-3"><button onClick={() => setDeleteConfirm({ type: 'budget', id: b.id })} className="text-xs text-error hover:text-red-400">Excluir</button></td>
                </tr>
              ))}
              {budgets.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-text-secondary">Nenhum orçamento</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead><tr className="bg-surface-hover/50 text-left">
              <th className="px-4 py-3 text-xs font-medium text-text-secondary">Cliente</th>
              <th className="px-4 py-3 text-xs font-medium text-text-secondary">Valor</th>
              <th className="px-4 py-3 text-xs font-medium text-text-secondary">Status</th>
              <th className="px-4 py-3 text-xs font-medium text-text-secondary">Vencimento</th>
              <th className="px-4 py-3 text-xs font-medium text-text-secondary">Criação</th>
              <th className="px-4 py-3 text-xs font-medium text-text-secondary"></th>
            </tr></thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t border-border hover:bg-surface-hover/30">
                  <td className="px-4 py-3 text-sm text-text-primary">{inv.client?.name}</td>
                  <td className="px-4 py-3 text-sm text-text-primary font-medium">{formatCurrency(inv.amount)}</td>
                  <td className="px-4 py-3"><Badge variant={invoiceStatusBadge[inv.status]?.variant}>{invoiceStatusBadge[inv.status]?.label}</Badge></td>
                  <td className="px-4 py-3 text-sm text-text-secondary">{inv.dueDate ? formatDate(inv.dueDate) : '-'}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary">{formatDate(inv.createdAt)}</td>
                  <td className="px-4 py-3"><button onClick={() => setDeleteConfirm({ type: 'invoice', id: inv.id })} className="text-xs text-error hover:text-red-400">Excluir</button></td>
                </tr>
              ))}
              {invoices.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-text-secondary">Nenhuma fatura</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={showBudgetModal} onClose={() => setShowBudgetModal(false)} title="Novo Orçamento">
        <form onSubmit={createBudget} className="space-y-4">
          <Input label="Título *" value={budgetForm.title} onChange={(e) => setBudgetForm({ ...budgetForm, title: e.target.value })} required />
          <div className="space-y-1">
            <label className="block text-sm font-medium text-text-secondary">Cliente *</label>
            <select value={budgetForm.clientId} onChange={(e) => setBudgetForm({ ...budgetForm, clientId: e.target.value })} className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary" required>
              <option value="">Selecionar</option>
              {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-text-secondary">Campanha</label>
            <select value={budgetForm.campaignId} onChange={(e) => setBudgetForm({ ...budgetForm, campaignId: e.target.value })} className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary">
              <option value="">Sem campanha</option>
              {campaigns.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Input label="Total *" type="number" value={budgetForm.total} onChange={(e) => setBudgetForm({ ...budgetForm, total: e.target.value })} required />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowBudgetModal(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Criar'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showInvoiceModal} onClose={() => setShowInvoiceModal(false)} title="Nova Fatura">
        <form onSubmit={createInvoice} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-text-secondary">Cliente *</label>
            <select value={invoiceForm.clientId} onChange={(e) => setInvoiceForm({ ...invoiceForm, clientId: e.target.value })} className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary" required>
              <option value="">Selecionar</option>
              {clients.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Input label="Valor *" type="number" value={invoiceForm.amount} onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })} required />
          <Input label="Vencimento" type="date" value={invoiceForm.dueDate} onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowInvoiceModal(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Criar'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Confirmar Exclusão">
        <p className="text-sm text-text-secondary mb-6">
          Tem certeza que deseja excluir {deleteConfirm?.type === 'budget' ? 'este orçamento' : 'esta fatura'}? Esta ação não pode ser desfeita.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
          <Button variant="danger" onClick={handleDelete}>Excluir</Button>
        </div>
      </Modal>
    </div>
  );
}
