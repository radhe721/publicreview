import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';

export function StampRating({
  value = 0,
  max = 5,
  interactive = false,
  onChange,
  size = 'md',
  className,
}) {
  const [hoverValue, setHoverValue] = useState(0);

  const activeValue = hoverValue || value;

  const sizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const handleSelect = (starIndex) => {
    if (onChange) {
      onChange(starIndex);
    }
  };

  const handleKeyDown = (e, starIndex) => {
    if (e.key === 'ArrowRight' && starIndex < max) {
      e.preventDefault();
      handleSelect(starIndex + 1);
    } else if (e.key === 'ArrowLeft' && starIndex > 1) {
      e.preventDefault();
      handleSelect(starIndex - 1);
    } else if (e.key >= '1' && e.key <= String(max)) {
      e.preventDefault();
      handleSelect(Number(e.key));
    }
  };

  return (
    <div
      className={cn('inline-flex items-center gap-1 select-none', className)}
      onMouseLeave={() => interactive && setHoverValue(0)}
      role={interactive ? 'radiogroup' : undefined}
      aria-label={interactive ? `Rate idea out of ${max}` : undefined}
    >
      {Array.from({ length: max }, (_, i) => {
        const starIndex = i + 1;
        const isFilled = activeValue >= starIndex;

        if (!interactive) {
          return (
            <Star
              key={starIndex}
              className={cn(
                sizeClasses[size] || sizeClasses.md,
                'transition-colors',
                isFilled
                  ? 'fill-accent text-accent'
                  : 'fill-surface text-border-strong stroke-1'
              )}
            />
          );
        }

        return (
          <button
            key={starIndex}
            type="button"
            role="radio"
            aria-checked={value === starIndex}
            aria-label={`Rate ${starIndex} of ${max}`}
            onClick={() => handleSelect(starIndex)}
            onMouseEnter={() => setHoverValue(starIndex)}
            onKeyDown={(e) => handleKeyDown(e, starIndex)}
            className="group relative p-1.5 -m-1 rounded-[6px] flex items-center justify-center min-w-[36px] min-h-[36px] transition-transform duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <Star
              className={cn(
                sizeClasses[size] || sizeClasses.md,
                'transition-colors',
                isFilled
                  ? 'fill-accent text-accent'
                  : 'fill-surface text-border-strong group-hover:text-accent stroke-1'
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
