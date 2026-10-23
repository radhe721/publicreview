import React from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn('rounded-[8px] animate-skeleton', className)}
      {...props}
    />
  );
}

export function IdeaRowSkeleton() {
  return (
    <div className="flex items-center gap-3.5 sm:gap-4 p-3 sm:p-4 rounded-[12px] border border-border bg-surface">
      {/* 56px Cover tile skeleton */}
      <Skeleton className="w-12 h-12 sm:w-14 sm:h-14 rounded-[10px] shrink-0" />

      {/* Center content */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 sm:h-5 w-1/3 rounded-[6px]" />
        </div>
        <Skeleton className="h-3.5 sm:h-4 w-4/5 rounded-[4px]" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-16 rounded-full" />
          <Skeleton className="h-3 w-12 rounded-full" />
        </div>
      </div>

      {/* Right compact boxes (56x56) */}
      <div className="flex items-center gap-2 shrink-0">
        <Skeleton className="w-12 h-12 sm:w-14 sm:h-14 rounded-[10px]" />
        <Skeleton className="w-12 h-12 sm:w-14 sm:h-14 rounded-[10px]" />
      </div>
    </div>
  );
}

// Keep backwards compatibility for any previous imports
export const IdeaCardSkeleton = IdeaRowSkeleton;
