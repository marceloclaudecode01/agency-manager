import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  gradient: string;
  iconColor: string;
  href?: string;
}

export function StatCard({ label, value, icon: Icon, gradient, iconColor }: StatCardProps) {
  return (
    <div className={cn(
      'rounded-xl border border-border bg-surface p-6 transition-all duration-200',
      'hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 hover:-translate-y-0.5 cursor-pointer'
    )}>
      <div className="flex items-center gap-4">
        <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center', gradient)}>
          <Icon size={24} className={iconColor} />
        </div>
        <div>
          <p className="text-sm text-text-secondary">{label}</p>
          <p className="text-2xl font-heading font-bold text-text-primary">{value}</p>
        </div>
      </div>
    </div>
  );
}
