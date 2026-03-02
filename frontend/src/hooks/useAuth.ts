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
    // Set a client-side cookie so Next.js middleware can detect auth state
    // Uses different name (auth_flag) to avoid conflict with httpOnly 'token' cookie from backend
    document.cookie = `auth_flag=1; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=None; Secure`;
    setUser(data.data.user);
    window.location.href = '/dashboard';
  };

  const register = async (name: string, email: string, password: string) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    document.cookie = `auth_flag=1; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=None; Secure`;
    setUser(data.data.user);
    window.location.href = '/dashboard';
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Proceed with client-side cleanup even if the request fails
    }
    // Clear the client-side auth cookie
    document.cookie = 'auth_flag=; path=/; max-age=0; SameSite=None; Secure';
    setUser(null);
    router.push('/login');
  };

  const updateUser = (updated: User) => {
    setUser(updated);
  };

  return { user, loading, login, register, logout, updateUser };
}
