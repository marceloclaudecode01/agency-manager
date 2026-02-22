import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-8xl font-heading font-bold text-primary">404</h1>
        <h2 className="text-2xl font-heading font-semibold text-text-primary mt-4">Página não encontrada</h2>
        <p className="text-text-secondary mt-2 max-w-md mx-auto">
          A página que você está procurando não existe ou foi movida.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 mt-8 px-6 py-3 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors"
        >
          Voltar ao Dashboard
        </Link>
      </div>
    </div>
  );
}
