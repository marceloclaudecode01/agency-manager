'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function DashboardError({
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
    <div className="flex flex-col items-center justify-center h-[60vh] gap-4 text-center px-4">
      <h2 className="text-2xl font-heading font-semibold text-text-primary">Algo deu errado</h2>
      <p className="text-text-secondary max-w-md">
        Ocorreu um erro inesperado nesta página. Tente novamente.
      </p>
      <div className="flex items-center gap-4 mt-2">
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors"
        >
          Tentar novamente
        </button>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 rounded-lg border border-border text-text-primary font-medium hover:bg-surface-hover transition-colors"
        >
          Ir ao Dashboard
        </Link>
      </div>
    </div>
  );
}
