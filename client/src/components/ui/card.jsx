import React from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        'rounded-[12px] border border-border bg-surface text-ink transition-colors',
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('flex flex-col space-y-1.5 p-5 sm:p-6', className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return (
    <h3
      className={cn('font-semibold leading-tight text-lg text-ink', className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }) {
  return (
    <p className={cn('text-sm text-ink-muted leading-relaxed', className)} {...props} />
  );
}

export function CardContent({ className, ...props }) {
  return <div className={cn('p-5 sm:p-6 pt-0', className)} {...props} />;
}

export function CardFooter({ className, ...props }) {
  return <div className={cn('flex items-center p-5 sm:p-6 pt-0 border-t border-border mt-4', className)} {...props} />;
}
