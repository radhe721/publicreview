import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/api/client';
import { Button } from '@/components/ui/button';
import { AuthorAvatar } from '@/components/ui/author-avatar';
import { cn, formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';
import { Download, Users, ThumbsDown, HelpCircle, Wallet } from 'lucide-react';

const INTENTS = [
  { id: 'pass', label: 'Not for me', hint: "I wouldn't use it", Icon: ThumbsDown, bar: 'bg-border-strong' },
  { id: 'maybe', label: "I'd try it", hint: 'If it were free or cheap', Icon: HelpCircle, bar: 'bg-accent' },
  { id: 'would_pay', label: "I'd pay for it", hint: 'Take my money at launch', Icon: Wallet, bar: 'bg-success' },
];

export const PRICE_TIERS = [
  { id: '0_5', label: '$0–5' },
  { id: '5_15', label: '$5–15' },
  { id: '15_30', label: '$15–30' },
  { id: '30_100', label: '$30–100' },
  { id: '100_plus', label: '$100+' },
];

export const ROLE_LABELS = {
  founder: 'Founders',
  freelancer: 'Freelancers',
  developer: 'Developers',
  agency_owner: 'Agency owners',
  marketer: 'Marketers',
  designer: 'Designers',
  operator: 'Operators',
  student: 'Students',
  other: 'Other',
  unspecified: 'No role set',
};

// "62% would pay · median $15–30/month · 23 votes · 9 on waitlist"
export function demandHeadline(demand) {
  const total = demand?.total || 0;
  if (total === 0) return 'No votes yet. Be the first to say if you would pay.';
  const parts = [`${demand.pay_rate}% would pay`];
  if (demand.median_price) parts.push(`median ${demand.median_price.label}/month`);
  parts.push(`${total} ${total === 1 ? 'vote' : 'votes'}`);
  parts.push(`${demand.waitlist_count || 0} on waitlist`);
  return parts.join(' · ');
}

function demandVerdict(score, total) {
  if (total < 3) return 'Early signal: needs more votes';
  if (score >= 60) return 'Strong demand';
  if (score >= 35) return 'Promising demand';
  return 'Weak demand so far';
}

// Spreadsheet apps execute cells starting with = + - @ as formulas; prefix them so exported
// names typed by other users can't run anything on the creator's machine.
function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadWaitlistCsv(waitlist, ideaTitle) {
  const header = ['Name', 'Email', 'Intent', 'Price per month', 'Joined'];
  const rows = waitlist.map((w) => [
    w.name,
    w.email,
    INTENTS.find((i) => i.id === w.intent)?.label || w.intent,
    PRICE_TIERS.find((t) => t.id === w.price_tier)?.label || '',
    w.joined_at,
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${ideaTitle.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'idea'}-waitlist.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function DemandSummary({ demand }) {
  const total = demand?.total || 0;
  const score = demand?.demand_score || 0;
  const maxTier = Math.max(1, ...PRICE_TIERS.map((t) => demand?.price_tiers?.[t.id] || 0));
  const payingVotes = demand?.intents?.would_pay || 0;

  return (
    <div className="p-5 sm:p-6 rounded-[12px] border border-border bg-surface text-ink space-y-5">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink">Demand Signal</h3>
        <span className="text-xs text-ink-muted tabular-nums">
          {total} {total === 1 ? 'vote' : 'votes'}
        </span>
      </div>

      <p className="text-sm font-semibold text-ink tabular-nums" data-testid="demand-headline">{demandHeadline(demand)}</p>

      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl sm:text-5xl font-extrabold tracking-tight tabular-nums">{score}</span>
            <span className="text-sm font-semibold text-ink-muted tabular-nums">/ 100</span>
          </div>
          <p className="text-xs text-ink-muted mt-1">{demandVerdict(score, total)}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums text-success">{demand?.pay_rate || 0}%</div>
          <p className="text-xs text-ink-muted">would pay</p>
        </div>
      </div>

      {/* Intent split: one stacked bar */}
      <div className="space-y-2">
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-muted gap-px">
          {total > 0 &&
            INTENTS.map((intent) => {
              const count = demand.intents[intent.id] || 0;
              return count > 0 ? (
                <div
                  key={intent.id}
                  className={cn('h-full transition-all duration-300', intent.bar)}
                  style={{ width: `${(count / total) * 100}%` }}
                  title={`${intent.label}: ${count}`}
                />
              ) : null;
            })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
          {INTENTS.map((intent) => (
            <span key={intent.id} className="inline-flex items-center gap-1.5 tabular-nums">
              <span className={cn('w-2 h-2 rounded-full', intent.bar)} />
              {intent.label} · {demand?.intents?.[intent.id] || 0}
            </span>
          ))}
        </div>
      </div>

      {/* Willingness to pay */}
      <div className="space-y-2.5">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
          Price people would pay / month
        </h4>
        {payingVotes === 0 ? (
          <p className="text-xs text-ink-muted">No price signals yet.</p>
        ) : (
          PRICE_TIERS.map((tier) => {
            const count = demand.price_tiers[tier.id] || 0;
            return (
              <div key={tier.id} className="flex items-center gap-3 text-xs">
                <span className="w-16 font-semibold tabular-nums">{tier.label}</span>
                <div className="flex-1 h-2.5 bg-surface-muted rounded-full overflow-hidden">
                  <div className="h-full bg-success rounded-full transition-all duration-300" style={{ width: `${(count / maxTier) * 100}%` }} />
                </div>
                <span className="w-6 text-right text-ink-muted tabular-nums">{count}</span>
              </div>
            );
          })
        )}
      </div>

      {demand?.by_role?.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Who voted</h4>
          <ul className="space-y-1 text-xs">
            {demand.by_role.map((r) => (
              <li key={r.role} className="flex items-center justify-between gap-3 tabular-nums">
                <span className="text-ink">{ROLE_LABELS[r.role] || r.role}</span>
                <span className="text-ink-muted">{r.would_pay} of {r.total} would pay</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-2 pt-3 border-t border-border text-xs text-ink-muted">
        <Users className="w-3.5 h-3.5" />
        <span className="tabular-nums">
          <strong className="text-ink">{demand?.waitlist_count || 0}</strong> on the launch waitlist
        </span>
      </div>
    </div>
  );
}

function SignalForm({ ideaId, mySignal, onSaved }) {
  const [intent, setIntent] = useState(mySignal?.intent || null);
  const [priceTier, setPriceTier] = useState(mySignal?.price_tier || null);
  const [joinWaitlist, setJoinWaitlist] = useState(Boolean(mySignal?.join_waitlist));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIntent(mySignal?.intent || null);
    setPriceTier(mySignal?.price_tier || null);
    setJoinWaitlist(Boolean(mySignal?.join_waitlist));
  }, [mySignal?.intent, mySignal?.price_tier, mySignal?.join_waitlist]);

  const save = async () => {
    if (!intent) return;
    setIsSaving(true);
    try {
      const res = await api.put(`/ideas/${ideaId}/demand`, {
        intent,
        price_tier: intent === 'would_pay' ? priceTier : null,
        join_waitlist: intent !== 'pass' && joinWaitlist,
      });
      toast.success(res.message || (mySignal ? 'Vote updated.' : 'Thanks! Your vote helps the founder validate.'));
      onSaved(res.data);
    } catch (err) {
      toast.error(err.message || 'Could not save your signal.');
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    setIsSaving(true);
    try {
      const res = await api.delete(`/ideas/${ideaId}/demand`);
      toast.success('Signal removed.');
      onSaved(res.data);
    } catch (err) {
      toast.error(err.message || 'Could not remove your signal.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-5 sm:p-6 rounded-[12px] border border-border bg-surface text-ink space-y-4">
      <div className="space-y-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink">Would you pay for this?</h3>
        <p className="text-xs text-ink-muted">Honest answers matter more than nice ones. Only totals are public.</p>
        {mySignal?.held && (
          <p className="text-xs text-ink-muted">Your vote is waiting for a quick review before it counts.</p>
        )}
      </div>

      <div role="radiogroup" aria-label="Your demand signal" className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {INTENTS.map(({ id, label, hint, Icon }) => {
          const selected = intent === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setIntent(id)}
              className={cn(
                'p-3 rounded-[8px] border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                selected ? 'border-accent-strong bg-accent-soft' : 'border-border bg-surface hover:border-border-strong'
              )}
            >
              <Icon className={cn('w-4 h-4 mb-1.5', selected ? 'text-accent-strong' : 'text-ink-muted')} />
              <span className="block text-sm font-semibold">{label}</span>
              <span className="block text-[11px] text-ink-muted">{hint}</span>
            </button>
          );
        })}
      </div>

      {intent === 'would_pay' && (
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted block">
            How much per month?
          </span>
          <div className="flex flex-wrap gap-2">
            {PRICE_TIERS.map((tier) => (
              <button
                key={tier.id}
                type="button"
                aria-pressed={priceTier === tier.id}
                onClick={() => setPriceTier(priceTier === tier.id ? null : tier.id)}
                className={cn(
                  'h-9 px-3 rounded-full border text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                  priceTier === tier.id ? 'border-success bg-success-soft text-ink' : 'border-border text-ink-muted hover:border-border-strong'
                )}
              >
                {tier.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {intent && intent !== 'pass' && (
        <label className="flex items-start gap-2.5 text-xs text-ink cursor-pointer select-none">
          <input
            type="checkbox"
            checked={joinWaitlist}
            onChange={(e) => setJoinWaitlist(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[var(--accent-strong)]"
          />
          <span>
            <strong className="font-semibold">Join the launch waitlist.</strong>{' '}
            <span className="text-ink-muted">Shares your name and email with the creator so they can tell you when it ships.</span>
          </span>
        </label>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button onClick={save} disabled={!intent} isLoading={isSaving} className="flex-1 h-10 rounded-[8px]">
          {mySignal ? 'Update vote' : 'Submit vote'}
        </Button>
        {mySignal && (
          <Button variant="ghost" onClick={remove} disabled={isSaving} className="h-10 rounded-[8px] text-xs">
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

function CreatorWaitlist({ ideaId, ideaTitle }) {
  const { data, isLoading } = useQuery({
    queryKey: ['idea-waitlist', String(ideaId)],
    queryFn: () => api.get(`/ideas/${ideaId}/demand/waitlist`),
  });
  const waitlist = data?.data?.waitlist || [];

  return (
    <div className="p-5 sm:p-6 rounded-[12px] border border-border bg-surface text-ink space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink">Your launch waitlist</h3>
          <p className="text-xs text-ink-muted mt-0.5">Only you can see this. Everyone here opted in.</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={waitlist.length === 0}
          onClick={() => downloadWaitlistCsv(waitlist, ideaTitle)}
          className="rounded-[8px] gap-1.5"
        >
          <Download className="w-3.5 h-3.5" /> CSV
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-ink-muted">Loading…</p>
      ) : waitlist.length === 0 ? (
        <p className="text-xs text-ink-muted p-4 text-center rounded-[8px] border border-dashed border-border">
          No one has joined yet. Share your idea to start collecting early users.
        </p>
      ) : (
        <ul className="divide-y divide-border max-h-72 overflow-y-auto -mx-1">
          {waitlist.map((w) => (
            <li key={w.id} className="flex items-center gap-3 py-2.5 px-1 text-xs">
              <AuthorAvatar name={w.name} avatarUrl={w.avatar_url} size="xs" />
              <div className="min-w-0 flex-1">
                <span className="font-semibold block truncate">{w.name}</span>
                <a href={`mailto:${w.email}`} className="text-ink-muted hover:text-ink truncate block">{w.email}</a>
              </div>
              <span className={cn('shrink-0 px-2 py-0.5 rounded-full font-semibold', w.intent === 'would_pay' ? 'bg-success-soft text-success' : 'bg-surface-muted text-ink-muted')}>
                {w.intent === 'would_pay' ? PRICE_TIERS.find((t) => t.id === w.price_tier)?.label || 'Would pay' : 'Would try'}
              </span>
              <span className="shrink-0 text-ink-faint hidden sm:inline">{formatRelativeTime(w.joined_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DemandSignalPanel({ ideaId, ideaTitle, isAuthor, isAuthenticated, canViewWaitlist }) {
  const queryClient = useQueryClient();
  const queryKey = ['idea-demand', String(ideaId)];
  const { data } = useQuery({
    queryKey,
    queryFn: () => api.get(`/ideas/${ideaId}/demand`),
  });

  const demand = data?.data?.demand;
  const mySignal = data?.data?.my_signal;
  const navigate = useNavigate();
  const pendingKey = `pending_vote:${ideaId}`;

  const handleSaved = (result) => {
    queryClient.setQueryData(queryKey, { success: true, data: result });
  };

  // Vote first, sign in after (spec 9.2): a vote picked while signed out is sent right after sign-in.
  useEffect(() => {
    if (!isAuthenticated || isAuthor || !data) return;
    let pending = null;
    try { pending = JSON.parse(localStorage.getItem(pendingKey) || 'null'); } catch { pending = null; }
    if (!pending) return;
    localStorage.removeItem(pendingKey);
    if (mySignal) return;
    api.put(`/ideas/${ideaId}/demand`, pending)
      .then((res) => { handleSaved(res.data); toast.success('Your vote was counted. Thanks!'); })
      .catch((err) => toast.error(err.message || 'Could not save your vote.'));
  }, [isAuthenticated, isAuthor, Boolean(data)]);

  const voteSignedOut = (intent) => {
    localStorage.setItem(pendingKey, JSON.stringify({ intent, price_tier: null, join_waitlist: false }));
    navigate(`/login?redirect=${encodeURIComponent(`/ideas/${ideaId}`)}`);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
      <div className="md:col-span-6">
        <DemandSummary demand={demand} />
      </div>
      <div className="md:col-span-6">
        {canViewWaitlist ? (
          <CreatorWaitlist ideaId={ideaId} ideaTitle={ideaTitle} />
        ) : isAuthor ? null : isAuthenticated ? (
          <SignalForm ideaId={ideaId} mySignal={mySignal} onSaved={handleSaved} />
        ) : (
          <div className="p-5 sm:p-6 rounded-[12px] border border-border bg-surface space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-ink">Would you pay for this?</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {INTENTS.map(({ id, label, hint, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => voteSignedOut(id)}
                  className="p-3 rounded-[8px] border border-border bg-surface hover:border-accent-strong text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  <Icon className="w-4 h-4 mb-1.5 text-ink-muted" />
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="block text-[11px] text-ink-muted">{hint}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-ink-muted">Tap your answer, then sign in with Google or GitHub (one click) so each person votes once.</p>
          </div>
        )}
      </div>
    </div>
  );
}
