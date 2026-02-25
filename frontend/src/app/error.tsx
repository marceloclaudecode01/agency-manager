'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-8xl font-heading font-bold text-primary">Erro</h1>
        <h2 className="text-2xl font-heading font-semibold text-text-primary mt-4">Algo deu errado</h2>
        <p className="text-text-secondary mt-2 max-w-md mx-auto">
          Ocorreu um erro inesperado. Tente novamente.
        </p>
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            onClick={reset}
            className="px-6 py-3 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors"
          >
            Tentar novamente
          </button>
          <Link
            href="/dashboard"
            className="px-6 py-3 rounded-lg border border-border text-text-primary font-medium hover:bg-surface transition-colors"
          >
            Voltar ao Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
