'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Megaphone } from 'lucide-react';

export default function RegisterPage() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(name, email, password);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
            <Megaphone size={24} className="text-white" />
          </div>
          <h1 className="text-3xl font-heading font-bold text-text-primary">Agency</h1>
        </div>

        <div className="rounded-xl border border-border bg-surface p-8">
          <h2 className="text-xl font-heading font-semibold text-text-primary mb-6">Criar Conta</h2>

          {error && (
            <div className="mb-4 rounded-lg bg-error/10 border border-error/20 p-3 text-sm text-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nome"
              placeholder="Seu nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label="Email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Senha"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Conta'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-text-secondary">
            Já tem conta?{' '}
            <Link href="/login" className="text-primary-300 hover:text-primary-200">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
