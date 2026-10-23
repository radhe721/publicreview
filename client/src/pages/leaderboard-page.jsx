import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import { IdeaRow } from '@/components/idea-row';
import { IdeaRowSkeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Trophy, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

const TIMEFRAMES = [
  { key: 'daily', label: 'Daily' },
  { key: 'week', label: 'Weekly' },
  { key: 'month', label: 'Monthly' },
  { key: 'all', label: 'All time' },
];

export function LeaderboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPeriod = searchParams.get('timeframe') || 'daily';

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', currentPeriod],
    queryFn: () => {
      return api.get(`/leaderboard?timeframe=${currentPeriod}&limit=25`);
    },
  });

  const leaderboard = data?.data?.leaderboard || [];

  const setPeriod = (p) => {
    const params = new URLSearchParams(searchParams);
    params.set('timeframe', p);
    setSearchParams(params);
  };

  return (
    <div className="min-h-screen bg-bg text-ink py-8 sm:py-12">
      {/* Centered Main Content Column: Max 860px */}
      <main className="max-w-[860px] mx-auto px-4 sm:px-6 space-y-6">
        {/* Page Header */}
        <div className="space-y-1 border-b border-border pb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                Leaderboard
              </h1>
              <p className="text-sm text-ink-muted mt-1">
                The community's highest-rated ideas and breakout concepts.
              </p>
            </div>

            {/* Date / Timeframe Switcher Tabs */}
            <div className="inline-flex p-1 rounded-[8px] border border-border bg-surface text-xs font-semibold self-start sm:self-auto shrink-0">
              {TIMEFRAMES.map((t) => {
                const isActive = currentPeriod === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setPeriod(t.key)}
                    className={cn(
                      'px-3 py-1.5 rounded-[6px] transition-colors',
                      isActive
                        ? 'bg-accent-strong text-accent-ink font-bold'
                        : 'text-ink-muted hover:text-ink hover:bg-surface-hover'
                    )}
                    aria-pressed={isActive}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Ranked List of Idea Rows */}
        <div className="space-y-2.5">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => <IdeaRowSkeleton key={i} />)
          ) : leaderboard.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-border rounded-[12px] bg-surface p-8 space-y-3">
              <div className="w-12 h-12 rounded-full bg-surface-muted text-ink-muted mx-auto flex items-center justify-center">
                <Trophy className="w-5 h-5" />
              </div>
              <h2 className="font-bold text-base text-ink">
                No entries ranked in this timeframe yet
              </h2>
              <p className="text-sm text-ink-muted mt-1 mb-4 leading-relaxed max-w-sm mx-auto">
                Cast the first ballot on recent submissions in the community ideas list.
              </p>
              <Link to="/feed">
                <Button size="sm" variant="secondary" className="text-xs rounded-[8px] px-4">
                  Browse community ideas
                </Button>
              </Link>
            </div>
          ) : (
            leaderboard.map((idea, index) => (
              <IdeaRow
                key={idea.id}
                idea={idea}
                rank={index + 1}
                showRank={true}
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
}
