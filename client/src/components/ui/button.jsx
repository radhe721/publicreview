import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export const Button = React.forwardRef(
  (
    {
      className,
      variant = 'primary',
      size = 'default',
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'relative inline-flex items-center justify-center whitespace-nowrap rounded-[8px] font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg active:scale-[0.98] disabled:bg-disabled-bg disabled:text-disabled-ink disabled:border-border disabled:cursor-not-allowed disabled:pointer-events-none select-none';

    const variants = {
      primary:
        'bg-accent-strong text-accent-ink border border-accent-strong hover:bg-accent-strong',
      default:
        'bg-accent-strong text-accent-ink border border-accent-strong hover:bg-accent-strong',
      secondary:
        'border border-border-strong bg-surface text-ink hover:bg-surface-hover',
      outline:
        'border border-border-strong bg-surface text-ink hover:bg-surface-hover',
      ghost:
        'text-ink-muted hover:text-ink hover:bg-surface-hover bg-transparent border border-transparent',
      danger:
        'bg-danger text-accent-ink border border-danger hover:bg-danger',
      destructive:
        'bg-danger text-accent-ink border border-danger hover:bg-danger',
      link:
        'text-accent-strong underline-offset-4 hover:underline p-0 h-auto min-h-0 bg-transparent active:scale-100 border-none',
    };

    const sizes = {
      default: 'h-11 min-h-[44px] px-4 text-sm',
      sm: 'h-9 min-h-[36px] px-3 text-xs',
      lg: 'h-12 min-h-[48px] px-6 text-base',
      icon: 'h-11 w-11 min-h-[44px] min-w-[44px] p-0',
      'icon-sm': 'h-9 w-9 min-h-[36px] min-w-[36px] p-0',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant] || variants.primary, sizes[size] || sizes.default, className)}
        {...props}
      >
        {isLoading && (
          <span className="absolute inset-0 flex items-center justify-center bg-inherit rounded-[8px]" aria-hidden="true">
            <Loader2 className="h-4 w-4 animate-spin text-current" />
          </span>
        )}
        <span className={cn('inline-flex items-center justify-center gap-1.5', isLoading && 'invisible')}>
          {children}
        </span>
      </button>
    );
  }
);

Button.displayName = 'Button';
