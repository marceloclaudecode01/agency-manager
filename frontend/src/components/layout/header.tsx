'use client';

import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/clients': 'Clientes',
  '/campaigns': 'Campanhas',
  '/tasks': 'Tarefas',
  '/finance': 'Financeiro',
  '/reports': 'Relatórios',
  '/calendar': 'Calendário',
  '/team': 'Equipe',
  '/settings': 'Configurações',
};

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const basePath = '/' + (pathname.split('/')[1] || '');
  const title = pageTitles[basePath] || 'Agency Manager';

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-border bg-surface/80 backdrop-blur-sm flex items-center px-6 gap-4">
      <button onClick={onMenuClick} className="lg:hidden text-text-secondary hover:text-text-primary">
        <Menu size={24} />
      </button>
      <h1 className="text-xl font-heading font-semibold text-text-primary">{title}</h1>
    </header>
  );
}
