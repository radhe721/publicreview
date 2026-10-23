import React from 'react';
import { cn } from '@/lib/utils';

export const Textarea = React.forwardRef(({ className, hasError, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        'flex min-h-[100px] w-full rounded-[8px] border border-border-strong bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint transition-colors focus-visible:outline-none focus-visible:border-accent-strong focus-visible:ring-1 focus-visible:ring-focus-ring disabled:cursor-not-allowed disabled:bg-disabled-bg disabled:text-disabled-ink disabled:border-border leading-relaxed',
        hasError && 'border-danger focus-visible:border-danger focus-visible:ring-danger',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});

Textarea.displayName = 'Textarea';
