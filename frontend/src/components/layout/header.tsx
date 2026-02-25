'use client';

import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { Menu, Bell, CheckCheck, BellOff, ClipboardList, Clock } from 'lucide-react';
import { useSocketContext } from '@/contexts/SocketContext';
import { formatDateTime } from '@/lib/utils';
import Link from 'next/link';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/clients': 'Clientes',
  '/campaigns': 'Campanhas',
  '/tasks': 'Tarefas',
  '/finance': 'Financeiro',
  '/reports': 'Relatórios',
  '/calendar': 'Calendário',
  '/team': 'Equipe',
  '/social': 'Social Media',
  '/chat': 'Chat',
  '/settings': 'Configurações',
};

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const basePath = '/' + (pathname.split('/')[1] || '');
  const title = pageTitles[basePath] || 'Agency Manager';
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useSocketContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-border bg-surface/80 backdrop-blur-sm flex items-center px-6 gap-4">
      <button onClick={onMenuClick} className="lg:hidden text-text-secondary hover:text-text-primary">
        <Menu size={24} />
      </button>
      <h1 className="text-xl font-heading font-semibold text-text-primary flex-1">{title}</h1>

      {/* Sino de notificações */}
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="relative p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-error text-white text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-12 w-80 rounded-xl border border-border bg-surface shadow-2xl z-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold text-text-primary">Notificações</span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-xs text-text-secondary hover:text-primary-300 transition-colors"
                >
                  <CheckCheck size={14} />
                  Marcar todas como lidas
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <BellOff size={28} className="text-text-secondary opacity-40" />
                  <p className="text-sm text-text-secondary">Nenhuma notificação</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b border-border last:border-0 flex items-start gap-3 hover:bg-surface-hover transition-colors ${!n.read ? 'bg-primary/5' : ''}`}
                  >
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${n.type === 'TASK_DUE' ? 'bg-warning/10' : 'bg-primary/10'}`}>
                      {n.type === 'TASK_DUE'
                        ? <Clock size={16} className="text-warning" />
                        : <ClipboardList size={16} className="text-primary-300" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-text-primary">{n.title}</p>
                      <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{n.message}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-text-secondary">{formatDateTime(n.createdAt)}</span>
                        {!n.read && (
                          <button
                            onClick={() => markAsRead(n.id)}
                            className="text-[10px] text-primary-300 hover:underline"
                          >
                            Marcar como lida
                          </button>
                        )}
                      </div>
                      {n.taskId && (
                        <Link
                          href={`/tasks/${n.taskId}`}
                          onClick={() => { markAsRead(n.id); setOpen(false); }}
                          className="text-[10px] text-primary-300 hover:underline"
                        >
                          Ver tarefa →
                        </Link>
                      )}
                    </div>
                    {!n.read && (
                      <div className="h-2 w-2 rounded-full bg-primary-300 flex-shrink-0 mt-1" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
