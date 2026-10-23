import React from 'react';
import { cn } from '@/lib/utils';
import { getTileHueIndex } from './cover-tile';

export function AuthorAvatar({ name = 'Anonymous', avatarUrl, size = 'md', className }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'A';

  const hueIdx = getTileHueIndex(name);

  const sizeClasses = {
    xs: 'w-5 h-5 text-[10px]',
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-11 h-11 text-base',
    xl: 'w-14 h-14 text-lg',
  };

  if (avatarUrl) {
    return (
      <div
        className={cn(
          'rounded-full overflow-hidden shrink-0 border border-border select-none bg-surface-muted',
          sizeClasses[size] || sizeClasses.md,
          className
        )}
      >
        <img
          src={avatarUrl}
          alt={name}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>
    );
  }

  const style = {
    backgroundColor: `var(--tile-${hueIdx}-bg)`,
    color: `var(--tile-${hueIdx}-ink)`,
  };

  return (
    <div
      style={style}
      className={cn(
        'rounded-full flex items-center justify-center font-bold border border-border select-none shrink-0 tracking-tight',
        sizeClasses[size] || sizeClasses.md,
        className
      )}
      title={name}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
