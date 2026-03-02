'use client';

import { UserPlus, DollarSign, FileText, TrendingUp, Zap, ShieldCheck } from 'lucide-react';

interface Props {
  leadsCount: number;
  funnelsRevenue: number;
  postsToday: number;
  growthScore: number;
  adSpend: number;
  compliancePercent: number;
}

const KPI_ITEMS = [
  { key: 'leads', label: 'Leads', icon: UserPlus, gradient: 'bg-gradient-to-br from-blue-500/20 to-blue-600/10', iconColor: 'text-blue-400', format: (v: number) => String(v) },
  { key: 'revenue', label: 'Revenue', icon: DollarSign, gradient: 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10', iconColor: 'text-emerald-400', format: (v: number) => `R$${v.toLocaleString()}` },
  { key: 'posts', label: 'Posts Today', icon: FileText, gradient: 'bg-gradient-to-br from-violet-500/20 to-violet-600/10', iconColor: 'text-violet-400', format: (v: number) => String(v) },
  { key: 'growth', label: 'Growth Score', icon: TrendingUp, gradient: 'bg-gradient-to-br from-amber-500/20 to-amber-600/10', iconColor: 'text-amber-400', format: (v: number) => `${v}%` },
  { key: 'adSpend', label: 'Ad Spend', icon: Zap, gradient: 'bg-gradient-to-br from-rose-500/20 to-rose-600/10', iconColor: 'text-rose-400', format: (v: number) => `R$${v.toLocaleString()}` },
  { key: 'compliance', label: 'Compliance', icon: ShieldCheck, gradient: 'bg-gradient-to-br from-teal-500/20 to-teal-600/10', iconColor: 'text-teal-400', format: (v: number) => `${v}%` },
];

export function KpiCards({ leadsCount, funnelsRevenue, postsToday, growthScore, adSpend, compliancePercent }: Props) {
  const values: Record<string, number> = {
    leads: leadsCount,
    revenue: funnelsRevenue,
    posts: postsToday,
    growth: growthScore,
    adSpend,
    compliance: compliancePercent,
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {KPI_ITEMS.map(item => {
        const Icon = item.icon;
        const val = values[item.key] ?? 0;
        return (
          <div key={item.key} className="rounded-xl border border-border/60 bg-surface/80 backdrop-blur-sm p-4 transition-all duration-200 hover:border-primary/20 hover:shadow-glow-sm">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${item.gradient}`}>
                <Icon size={20} className={item.iconColor} />
              </div>
              <div>
                <p className="text-xs text-text-secondary">{item.label}</p>
                <p className="text-lg font-heading font-bold text-text-primary">{item.format(val)}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
