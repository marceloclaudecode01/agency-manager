'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { Notification } from '@/types';
import { useToast } from '@/components/ui/toast';
import api from '@/lib/api';

interface SocketContextType {
  socket: Socket | null;
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  notifications: [],
  unreadCount: 0,
  markAsRead: () => {},
  markAllAsRead: () => {},
});

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return;

    // Carregar notificações existentes
    api.get('/notifications').then(({ data }) => {
      setNotifications(data.data || []);
    }).catch(() => {});

    // Conectar socket
    const s = io(process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3333', {
      auth: { token },
    });

    s.on('notification', (notif: Notification) => {
      setNotifications((prev) => [notif, ...prev]);
      toast(notif.title + ': ' + notif.message, notif.type === 'TASK_DUE' ? 'warning' : 'info');
    });

    setSocket(s);

    return () => { s.disconnect(); };
  }, []);

  const markAsRead = useCallback((id: string) => {
    api.patch(`/notifications/${id}/read`).catch(() => {});
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllAsRead = useCallback(() => {
    api.patch('/notifications/read-all').catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <SocketContext.Provider value={{ socket, notifications, unreadCount, markAsRead, markAllAsRead }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketContext() {
  return useContext(SocketContext);
}
