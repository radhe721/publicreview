import React from 'react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

export function CategoryBadge({ category = 'Other', clickable = false, className }) {
  const content = (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium text-ink-muted bg-surface-muted border border-border transition-colors select-none',
        clickable && 'hover:text-ink hover:border-border-strong hover:bg-surface-hover cursor-pointer',
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-accent-strong shrink-0" aria-hidden="true" />
      <span>{category}</span>
    </span>
  );

  if (clickable) {
    return (
      <Link to={`/feed?category=${encodeURIComponent(category)}`} onClick={(e) => e.stopPropagation()}>
        {content}
      </Link>
    );
  }

  return content;
}
