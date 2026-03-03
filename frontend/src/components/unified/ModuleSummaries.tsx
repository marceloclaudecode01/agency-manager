'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, UserPlus, FileText } from 'lucide-react';

interface Props {
  leads: { pipeline: any[]; total: number };
  engine: { todayPosts: any[]; weekStats: { generated: number; published: number; failed: number } } | null;
}

function CollapsibleSection({ title, icon: Icon, iconColor, children, defaultOpen = true }: {
  title: string; icon: any; iconColor: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border/60 bg-surface/80 backdrop-blur-sm p-4">
      <button onClick={() => setOpen(!open)} className="flex items-center justify-between w-full mb-2">
        <div className="flex items-center gap-2">
          <Icon size={16} className={iconColor} />
          <h3 className="text-sm font-heading font-semibold text-text-primary">{title}</h3>
        </div>
        {open ? <ChevronUp size={14} className="text-text-secondary" /> : <ChevronDown size={14} className="text-text-secondary" />}
      </button>
      {open && <div className="text-xs space-y-1.5">{children}</div>}
    </div>
  );
}

function StatLine({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-border/20 last:border-0">
      <span className="text-text-secondary">{label}</span>
      <span className={`font-medium ${color || 'text-text-primary'}`}>{value}</span>
    </div>
  );
}

export function ModuleSummaries({ leads, engine }: Props) {
  const ws = engine?.weekStats || { generated: 0, published: 0, failed: 0 };
  const pendingPosts = engine?.todayPosts?.filter(p => p.status === 'PENDING').length || 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <CollapsibleSection title="Leads CRM" icon={UserPlus} iconColor="text-blue-400">
        <StatLine label="Total leads" value={leads.total} />
        <StatLine label="In pipeline" value={leads.pipeline.length} />
      </CollapsibleSection>

      <CollapsibleSection title="Content Queue" icon={FileText} iconColor="text-violet-400">
        <StatLine label="Generated (week)" value={ws.generated} />
        <StatLine label="Published" value={ws.published} color="text-emerald-400" />
        <StatLine label="Pending today" value={pendingPosts} color="text-yellow-400" />
        <StatLine label="Failed" value={ws.failed} color={ws.failed > 0 ? 'text-red-400' : undefined} />
      </CollapsibleSection>
    </div>
  );
}
