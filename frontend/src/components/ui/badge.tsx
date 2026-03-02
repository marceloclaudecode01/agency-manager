import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple';
  className?: string;
}

const variantStyles = {
  default: 'bg-surface-hover text-text-secondary border-border/40',
  success: 'bg-success/10 text-success border-success/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  error: 'bg-error/10 text-error border-error/20',
  info: 'bg-blue-500/10 text-blue-400 border-blue-400/20',
  purple: 'bg-primary/10 text-primary-300 border-primary/20',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider', variantStyles[variant], className)}>
      {children}
    </span>
  );
}
