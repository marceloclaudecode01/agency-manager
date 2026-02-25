'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '16px', textAlign: 'center', padding: '16px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 600 }}>Algo deu errado</h2>
          <button
            onClick={reset}
            style={{ padding: '10px 24px', borderRadius: '8px', background: '#6366f1', color: 'white', border: 'none', cursor: 'pointer', fontSize: '14px' }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
