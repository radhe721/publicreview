import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/api/client';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';

const INTENT_LABELS = { pass: 'Not for me', maybe: "I'd try it", would_pay: "I'd pay for it" };

// Votes held by burst detection (many new accounts voting on one idea within minutes).
export function HeldVotesPanel() {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(null);
  const { data, isLoading } = useQuery({
    queryKey: ['admin-held-votes'],
    queryFn: () => api.get('/admin/held-votes'),
  });
  const votes = data?.data?.votes || [];

  const review = async (vote, action) => {
    setBusy(`${vote.kind}-${vote.id}`);
    try {
      await api.post(`/admin/held-votes/${vote.kind}/${vote.id}`, { action });
      toast.success(action === 'release' ? 'Vote released and counted.' : 'Vote deleted.');
      queryClient.invalidateQueries({ queryKey: ['admin-held-votes'] });
    } catch (err) {
      toast.error(err.message || 'Could not update the vote.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="held-votes-heading" className="space-y-3">
      <div>
        <h2 id="held-votes-heading" className="text-base font-bold text-ink">Held votes ({votes.length})</h2>
        <p className="text-xs text-ink-muted">
          Votes from brand-new accounts that arrived in a burst. They do not count until released.
        </p>
      </div>
      {isLoading ? (
        <p className="text-xs text-ink-muted">Loading…</p>
      ) : votes.length === 0 ? (
        <p className="p-4 text-xs text-ink-muted text-center rounded-[8px] border border-dashed border-border">No held votes.</p>
      ) : (
        <ul className="divide-y divide-border rounded-[12px] border border-border bg-surface">
          {votes.map((v) => (
            <li key={`${v.kind}-${v.id}`} className="p-3 flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
              <div className="flex-1 min-w-0">
                <Link to={`/ideas/${v.idea_id}`} className="font-semibold text-ink hover:underline truncate block">{v.idea_title}</Link>
                <span className="text-ink-muted">
                  {v.kind === 'rating' ? `${v.value}★ rating` : INTENT_LABELS[v.value] || v.value} by {v.user_name} ({v.user_email}),
                  account {formatRelativeTime(v.user_created_at)}, voted {formatRelativeTime(v.created_at)}
                </span>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="secondary" className="h-8 rounded-[8px]" isLoading={busy === `${v.kind}-${v.id}`} onClick={() => review(v, 'release')}>Release</Button>
                <Button size="sm" variant="danger" className="h-8 rounded-[8px]" disabled={busy === `${v.kind}-${v.id}`} onClick={() => review(v, 'delete')}>Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
