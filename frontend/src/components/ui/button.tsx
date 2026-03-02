'use client';

import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'hud';
  size?: 'sm' | 'md' | 'lg';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed',
          {
            'bg-primary hover:bg-primary-600 hover:shadow-glow-sm text-white': variant === 'primary',
            'bg-secondary hover:bg-secondary-600 text-black': variant === 'secondary',
            'border border-border hover:bg-surface-hover hover:border-primary/30 text-text-primary': variant === 'outline',
            'hover:bg-surface-hover text-text-primary': variant === 'ghost',
            'bg-error hover:bg-red-600 text-white': variant === 'danger',
            'border border-primary/40 bg-primary/10 text-primary-300 hover:bg-primary/20 hover:shadow-glow-md hover:border-primary/60': variant === 'hud',
          },
          {
            'px-3 py-1.5 text-sm': size === 'sm',
            'px-4 py-2 text-sm': size === 'md',
            'px-6 py-3 text-base': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export { Button };
