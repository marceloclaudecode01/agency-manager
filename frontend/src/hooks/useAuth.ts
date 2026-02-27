'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { User } from '@/types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Fetch current user from server using the httpOnly cookie
    api.get('/auth/me')
      .then(({ data }) => {
        setUser(data.data);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    // Cookie is set by the server via Set-Cookie header
    setUser(data.data.user);
    router.push('/dashboard');
  };

  const register = async (name: string, email: string, password: string) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    // Cookie is set by the server via Set-Cookie header
    setUser(data.data.user);
    router.push('/dashboard');
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Proceed with client-side cleanup even if the request fails
    }
    setUser(null);
    router.push('/login');
  };

  const updateUser = (updated: User) => {
    setUser(updated);
  };

  return { user, loading, login, register, logout, updateUser };
}
