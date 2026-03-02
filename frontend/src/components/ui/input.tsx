'use client';

import { cn } from '@/lib/utils';
import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-medium text-text-secondary">{label}</label>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full rounded-lg border bg-surface/60 backdrop-blur-sm px-4 py-2.5 text-sm text-text-primary placeholder:text-text-secondary/50 transition-all focus:outline-none focus:border-primary focus:shadow-[0_0_12px_rgba(108,43,217,0.3)]',
            error ? 'border-error' : 'border-border',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-error">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
export { Input };
