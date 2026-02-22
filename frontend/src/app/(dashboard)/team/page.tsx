'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { User } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Loading } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Search, Users, Pencil, Trash2 } from 'lucide-react';

const roleBadge: Record<string, { variant: any; label: string }> = {
  ADMIN: { variant: 'error', label: 'Admin' },
  MANAGER: { variant: 'warning', label: 'Gerente' },
  MEMBER: { variant: 'info', label: 'Membro' },
};

export default function TeamPage() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', role: 'MEMBER' });
  const [editForm, setEditForm] = useState({ name: '', email: '', role: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadUsers(); }, [search, filterRole]);

  const loadUsers = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterRole) params.set('role', filterRole);
      const { data } = await api.get(`/users?${params}`);
      setUsers(data.data || []);
    } catch {
      toast('Erro ao carregar equipe', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/users', createForm);
      setShowCreateModal(false);
      setCreateForm({ name: '', email: '', password: '', role: 'MEMBER' });
      toast('Membro adicionado com sucesso');
      loadUsers();
    } catch {
      toast('Erro ao adicionar membro', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (user: User) => {
    setSelectedUser(user);
    setEditForm({ name: user.name, email: user.email, role: user.role });
    setShowEditModal(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSaving(true);
    try {
      await api.put(`/users/${selectedUser.id}`, editForm);
      setShowEditModal(false);
      toast('Membro atualizado com sucesso');
      loadUsers();
    } catch {
      toast('Erro ao atualizar membro', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/users/${id}`);
      toast('Membro removido com sucesso');
      setShowDeleteConfirm(null);
      loadUsers();
    } catch {
      toast('Erro ao remover membro', 'error');
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-auto">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              placeholder="Buscar membros..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-auto rounded-lg border border-border bg-surface pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="w-full sm:w-auto rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">Todos</option>
            <option value="ADMIN">Admin</option>
            <option value="MANAGER">Gerente</option>
            <option value="MEMBER">Membro</option>
          </select>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="w-full sm:w-auto">
          <Plus size={18} className="mr-2" /> Novo Membro
        </Button>
      </div>

      {users.length === 0 ? (
        <Card className="text-center py-12">
          <Users size={48} className="mx-auto text-text-secondary/30 mb-4" />
          <p className="text-text-secondary">Nenhum membro encontrado</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((u) => (
            <Card key={u.id} className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-primary-300">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">{u.name}</p>
                  <p className="text-xs text-text-secondary">{u.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={roleBadge[u.role]?.variant}>{roleBadge[u.role]?.label}</Badge>
                {currentUser?.id !== u.id && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(u)} className="p-1.5 rounded hover:bg-surface-hover text-text-secondary hover:text-text-primary">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setShowDeleteConfirm(u.id)} className="p-1.5 rounded hover:bg-surface-hover text-text-secondary hover:text-error">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Novo Membro">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Nome *" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required />
          <Input label="Email *" type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} required />
          <Input label="Senha *" type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} required />
          <select
            value={createForm.role}
            onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary"
          >
            <option value="MEMBER">Membro</option>
            <option value="MANAGER">Gerente</option>
            <option value="ADMIN">Admin</option>
          </select>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Criar'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Editar Membro">
        <form onSubmit={handleUpdate} className="space-y-4">
          <Input label="Nome" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
          <Input label="Email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required />
          <select
            value={editForm.role}
            onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
            className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary"
          >
            <option value="MEMBER">Membro</option>
            <option value="MANAGER">Gerente</option>
            <option value="ADMIN">Admin</option>
          </select>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)} title="Confirmar Exclusão">
        <p className="text-sm text-text-secondary mb-6">
          Tem certeza que deseja remover este membro? Esta ação não pode ser desfeita.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowDeleteConfirm(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}>Excluir</Button>
        </div>
      </Modal>
    </div>
  );
}
