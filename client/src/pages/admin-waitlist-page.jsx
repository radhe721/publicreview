import React, { useMemo, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api, { API_HOST } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelativeTime, cn } from '@/lib/utils';
import { Download, Users, Shield } from 'lucide-react';

const DAYS = 30;

// Server groups by UTC day; build the same 30 UTC days so empty days show as gaps.
function lastNDays(daily) {
  const counts = Object.fromEntries(daily.map((d) => [d.day, d.count]));
  const today = new Date();
  return Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (DAYS - 1 - i)));
    const key = d.toISOString().slice(0, 10);
    return { day: key, label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }), count: counts[key] || 0 };
  });
}

function StatTile({ label, value }) {
  return (
    <div className="p-4 sm:p-5 rounded-[12px] border border-border bg-surface">
      <div className="text-xs font-bold uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink tabular-nums mt-1">{value.toLocaleString()}</div>
    </div>
  );
}

function SignupsChart({ days }) {
  const [hover, setHover] = useState(null);
  const [asTable, setAsTable] = useState(false);
  const max = Math.max(1, ...days.map((d) => d.count));
  const peakIndex = days.reduce((best, d, i) => (d.count > days[best].count ? i : best), 0);

  return (
    <section className="p-5 sm:p-6 rounded-[12px] border border-border bg-surface space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-ink">Signups per day · last 30 days</h2>
        <button
          type="button"
          onClick={() => setAsTable(!asTable)}
          className="text-xs font-semibold text-ink-muted hover:text-ink underline-offset-4 hover:underline"
        >
          {asTable ? 'View as chart' : 'View as table'}
        </button>
      </div>

      {asTable ? (
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-muted"><th className="py-1.5 font-semibold">Day (UTC)</th><th className="py-1.5 font-semibold text-right">Signups</th></tr>
            </thead>
            <tbody>
              {[...days].reverse().map((d) => (
                <tr key={d.day} className="border-t border-border"><td className="py-1.5 text-ink">{d.label}</td><td className="py-1.5 text-right tabular-nums text-ink">{d.count}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <div className="flex items-end h-44 gap-[2px] border-b border-border" onMouseLeave={() => setHover(null)}>
            {days.map((d, i) => (
              <button
                key={d.day}
                type="button"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${d.label}: ${d.count} signup${d.count === 1 ? '' : 's'}`}
                className="relative flex-1 h-full flex flex-col justify-end items-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring rounded-t-[4px]"
              >
                {i === peakIndex && d.count > 0 && (
                  <span className="text-[11px] font-semibold text-ink-muted tabular-nums mb-1">{d.count}</span>
                )}
                {d.count > 0 && (
                  <span
                    className={cn('w-full max-w-[18px] rounded-t-[4px] bg-chart-bar transition-opacity', hover !== null && hover !== i && 'opacity-50')}
                    style={{ height: `${(d.count / max) * 82}%` }}
                  />
                )}
              </button>
            ))}
          </div>
          {hover !== null && (
            <div
              role="status"
              className={cn(
                'absolute top-0 px-2.5 py-1.5 rounded-[8px] bg-surface-raised border border-border-strong text-xs text-ink whitespace-nowrap pointer-events-none shadow-sm',
                // Keep the tooltip inside the card near either edge.
                hover < 5 ? 'translate-x-0' : hover > days.length - 6 ? '-translate-x-full' : '-translate-x-1/2'
              )}
              style={{ left: `${((hover + (hover < 5 ? 0 : hover > days.length - 6 ? 1 : 0.5)) / days.length) * 100}%` }}
            >
              <span className="text-ink-muted">{days[hover].label}</span> · <strong className="tabular-nums">{days[hover].count}</strong> signup{days[hover].count === 1 ? '' : 's'}
            </div>
          )}
          <div className="flex justify-between text-[11px] text-ink-muted mt-1.5">
            <span>{days[0].label}</span>
            <span>Today</span>
          </div>
        </div>
      )}
    </section>
  );
}

export function AdminWaitlistPage() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-waitlist'],
    queryFn: () => api.get('/waitlist'),
    enabled: isAdmin,
  });
  const stats = data?.data?.stats;
  const signups = data?.data?.signups || [];
  const days = useMemo(() => lastNDays(data?.data?.daily || []), [data]);

  if (authLoading) {
    return (
      <main className="min-h-screen bg-bg text-ink py-16 flex items-center justify-center" aria-busy="true">
        <h1 className="sr-only">Waitlist</h1>
        <div className="w-6 h-6 border-2 border-border-strong border-t-accent-strong rounded-full animate-spin" />
      </main>
    );
  }
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-bg text-ink py-8 sm:py-12">
      <main className="max-w-[860px] mx-auto px-4 sm:px-6 space-y-6">
        <div className="border-b border-border pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-accent-strong">Admin</span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink mt-1">Waitlist</h1>
            <p className="text-sm text-ink-muted mt-1">Everyone who joined from the landing page.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin">
              <Button variant="secondary" size="sm" className="rounded-[8px] gap-1.5"><Shield className="w-3.5 h-3.5" /> Moderation</Button>
            </Link>
            <a href={`${API_HOST}/api/v1/waitlist/export.csv`}>
              <Button size="sm" className="rounded-[8px] gap-1.5" disabled={!stats?.total}><Download className="w-3.5 h-3.5" /> Download CSV</Button>
            </a>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-3 gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-[12px]" />)}</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <StatTile label="Total signups" value={stats?.total || 0} />
              <StatTile label="Last 7 days" value={stats?.last_7_days || 0} />
              <StatTile label="Today (UTC)" value={stats?.today || 0} />
            </div>

            <SignupsChart days={days} />

            <section className="rounded-[12px] border border-border bg-surface overflow-hidden">
              <h2 className="px-5 py-4 text-xs font-bold uppercase tracking-wider text-ink border-b border-border">
                Latest signups {signups.length >= 500 && <span className="font-normal normal-case text-ink-muted">(newest 500 · download CSV for all)</span>}
              </h2>
              {signups.length === 0 ? (
                <div className="p-10 text-center text-sm text-ink-muted space-y-2">
                  <Users className="w-6 h-6 mx-auto text-ink-faint" />
                  <p>No signups yet. Share your site to start collecting interest.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-ink-muted bg-surface-muted">
                        <th className="px-5 py-2.5 font-semibold">Email</th>
                        <th className="px-3 py-2.5 font-semibold">Name</th>
                        <th className="px-3 py-2.5 font-semibold">Would use it for</th>
                        <th className="px-5 py-2.5 font-semibold text-right whitespace-nowrap">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {signups.map((s) => (
                        <tr key={s.id} className="border-t border-border align-top">
                          <td className="px-5 py-2.5"><a href={`mailto:${s.email}`} className="text-ink hover:underline break-all">{s.email}</a></td>
                          <td className="px-3 py-2.5 text-ink">{s.name || <span className="text-ink-faint">—</span>}</td>
                          <td className="px-3 py-2.5 text-ink-muted max-w-[280px]">{s.use_case || <span className="text-ink-faint">—</span>}</td>
                          <td className="px-5 py-2.5 text-right text-ink-muted whitespace-nowrap">{formatRelativeTime(s.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
