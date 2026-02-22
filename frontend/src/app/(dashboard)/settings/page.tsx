'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import { useToast } from '@/components/ui/toast';
import { User, Shield, Lock } from 'lucide-react';

export default function SettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', email: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.data);
      setProfileForm({ name: data.data.name, email: data.data.email });
    } catch {
      toast('Erro ao carregar perfil', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put('/auth/profile', profileForm);
      setUser(data.data);
      localStorage.setItem('user', JSON.stringify(data.data));
      toast('Perfil atualizado com sucesso');
    } catch (err: any) {
      toast(err.response?.data?.message || 'Erro ao atualizar perfil', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast('As senhas não coincidem', 'error');
      return;
    }
    setSavingPassword(true);
    try {
      await api.put('/auth/profile', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast('Senha alterada com sucesso');
    } catch (err: any) {
      toast(err.response?.data?.message || 'Erro ao alterar senha', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) return <Loading />;

  const roleLabels: Record<string, string> = {
    ADMIN: 'Administrador',
    MANAGER: 'Gerente',
    MEMBER: 'Membro',
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User size={20} className="text-primary-300" />
            <CardTitle>Informações do Perfil</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary-300">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div>
              <p className="text-lg font-heading font-semibold text-text-primary">{user?.name}</p>
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-text-secondary" />
                <span className="text-sm text-text-secondary">{roleLabels[user?.role] || user?.role}</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <Input
              label="Nome"
              value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              required
            />
            <Input
              label="Email"
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
              required
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock size={20} className="text-warning" />
            <CardTitle>Alterar Senha</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <Input
              label="Senha Atual"
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              required
            />
            <Input
              label="Nova Senha"
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              minLength={6}
              required
            />
            <Input
              label="Confirmar Nova Senha"
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              minLength={6}
              required
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={savingPassword}>
                {savingPassword ? 'Alterando...' : 'Alterar Senha'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
