import type { Metadata } from 'next';
import { ToastProvider } from '@/components/ui/toast';
import { SocketProvider } from '@/contexts/SocketContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'Agency Manager',
  description: 'Sistema de gestão para agência de marketing digital',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <ToastProvider><SocketProvider>{children}</SocketProvider></ToastProvider>
      </body>
    </html>
  );
}
