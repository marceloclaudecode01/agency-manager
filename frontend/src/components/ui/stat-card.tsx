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
      'rounded-xl border border-border/60 bg-surface/80 backdrop-blur-sm p-6 transition-all duration-300',
      'hover:shadow-glow-md hover:border-primary/30 hover:scale-[1.02] cursor-pointer'
    )}>
      <div className="flex items-center gap-4">
        <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center shadow-glow-sm', gradient)}>
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
