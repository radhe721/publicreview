import React from 'react';
import { cn } from '@/lib/utils';

export function Badge({ className, variant = 'default', children, ...props }) {
  const variants = {
    default: 'bg-accent-soft text-accent-strong border border-accent-soft',
    secondary: 'bg-surface-muted text-ink-muted border border-border',
    outline: 'bg-surface text-ink border border-border',
    destructive: 'bg-danger-soft text-danger border border-danger-soft',
    success: 'bg-success-soft text-success border border-success-soft',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors select-none',
        variants[variant] || variants.default,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
