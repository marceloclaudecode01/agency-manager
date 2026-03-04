'use client';

import { Badge } from '@/components/ui/badge';
import { Shield, ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';

interface TokenHealthProps {
  tokenStatus: {
    valid?: boolean;
    isValid?: boolean;
    expiresAt?: string;
    daysUntilExpiry?: number | null;
    scopes?: string[];
    pageName?: string;
    appName?: string;
  } | null;
}

export function TokenHealth({ tokenStatus }: TokenHealthProps) {
  if (!tokenStatus) {
    return (
      <div className="rounded-xl border border-border/60 bg-surface/80 backdrop-blur-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-heading font-semibold text-text-primary">Token Facebook</h3>
        </div>
        <p className="text-xs text-text-secondary/50">Não foi possível verificar</p>
      </div>
    );
  }

  // Support both backend field names: isValid (backend) and valid (legacy)
  const isValid = tokenStatus.isValid ?? tokenStatus.valid ?? false;
  const expiresAt = tokenStatus.expiresAt ? new Date(tokenStatus.expiresAt) : null;
  const daysLeft = tokenStatus.daysUntilExpiry ?? (expiresAt ? Math.ceil((expiresAt.getTime() - Date.now()) / 86400000) : null);

  return (
    <div className={`rounded-xl border bg-surface/80 backdrop-blur-sm p-4 ${
      isValid ? 'border-emerald-500/30' : 'border-red-500/30'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isValid ? (
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-red-400" />
          )}
          <h3 className="text-sm font-heading font-semibold text-text-primary">Token Facebook</h3>
        </div>
        <Badge variant={isValid ? 'success' : 'error'} className="text-xs">
          {isValid ? 'Válido' : 'Inválido'}
        </Badge>
      </div>
      <div className="space-y-1.5 text-xs">
        {(tokenStatus.pageName || tokenStatus.appName) && (
          <p className="text-text-secondary">App: <span className="text-text-primary">{tokenStatus.pageName || tokenStatus.appName}</span></p>
        )}
        {isValid && daysLeft == null ? (
          <p className="text-text-secondary flex items-center gap-1">
            Expira em: <span className="font-mono text-emerald-400">Nunca</span>
          </p>
        ) : daysLeft != null ? (
          <p className="text-text-secondary flex items-center gap-1">
            Expira em: <span className={`font-mono ${daysLeft < 7 ? 'text-red-400' : daysLeft < 30 ? 'text-yellow-400' : 'text-emerald-400'}`}>
              {daysLeft}d
            </span>
            {daysLeft < 7 && <AlertTriangle className="w-3 h-3 text-red-400" />}
          </p>
        ) : null}
        {tokenStatus.scopes && tokenStatus.scopes.length > 0 && (
          <p className="text-text-secondary">Permissões: <span className="text-text-primary font-mono">{tokenStatus.scopes.length}</span></p>
        )}
      </div>
    </div>
  );
}
