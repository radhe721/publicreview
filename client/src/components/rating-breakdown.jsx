import React from 'react';
import { cn } from '@/lib/utils';
import { Star } from 'lucide-react';

export function RatingBreakdown({ stats, className }) {
  const avgScore = Number(stats?.avg_score || 0).toFixed(1);
  const totalRatings = Number(stats?.total_ratings || 0);
  const distribution = stats?.distribution || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

  const starLevels = [5, 4, 3, 2, 1];

  return (
    <div className={cn('p-5 sm:p-6 rounded-[12px] border border-border bg-surface text-ink', className)}>
      <div className="flex items-center justify-between border-b border-border pb-3 mb-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
          Rating Distribution
        </h3>
        <span className="text-xs text-ink-muted tabular-nums">
          {totalRatings} {totalRatings === 1 ? 'rating' : 'ratings'} total
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
        {/* Left Average Score Hero */}
        <div className="sm:col-span-5 flex flex-col items-center sm:items-start text-center sm:text-left">
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-ink tabular-nums">
              {avgScore}
            </span>
            <span className="text-sm font-semibold text-ink-muted tabular-nums">/ 5.0</span>
          </div>

          <div className="flex items-center gap-1 my-2 text-accent-strong">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={cn(
                  'w-4 h-4',
                  Number(avgScore) >= s
                    ? 'text-accent fill-accent'
                    : 'text-border-strong stroke-1'
                )}
              />
            ))}
          </div>

          <p className="text-xs text-ink-muted leading-relaxed">
            {totalRatings > 0
              ? `Based on ${totalRatings} community review${totalRatings === 1 ? '' : 's'}.`
              : 'Be the first to rate and critique this idea.'}
          </p>
        </div>

        {/* Right Distribution Bars */}
        <div className="sm:col-span-7 space-y-2.5 w-full">
          {starLevels.map((level) => {
            const count = Number(distribution[level] || 0);
            const percentage = totalRatings > 0 ? Math.round((count / totalRatings) * 100) : 0;

            return (
              <div key={level} className="flex items-center gap-3 text-xs">
                <span className="w-7 text-ink font-semibold flex items-center gap-0.5 tabular-nums">
                  {level}★
                </span>

                {/* Track uses surface-muted, fill uses accent */}
                <div className="flex-1 h-2.5 bg-surface-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                <span className="w-16 text-right text-ink-muted tabular-nums text-xs">
                  {count} ({percentage}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
