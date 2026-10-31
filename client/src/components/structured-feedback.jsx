import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/api/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const PRICE_FIT = [
  { id: 'too_low', label: 'Too low' },
  { id: 'right', label: 'About right' },
  { id: 'too_high', label: 'Too high' },
];

function Scale({ label, value, onChange, name }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-semibold text-ink">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${name} ${n} of 5`}
            onClick={() => onChange(n)}
            className={cn(
              'w-9 h-9 rounded-[8px] border text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
              value === n ? 'border-accent-strong bg-accent-soft text-accent-strong' : 'border-border text-ink-muted hover:border-border-strong'
            )}
          >
            {n}
          </button>
        ))}
        <span className="text-[11px] text-ink-faint ml-1">1 = no, 5 = definitely</span>
      </div>
    </fieldset>
  );
}

function FeedbackForm({ ideaId, mine, onSaved }) {
  const [problemReal, setProblemReal] = useState(mine?.problem_real || 0);
  const [buyerWouldPay, setBuyerWouldPay] = useState(mine?.buyer_would_pay || 0);
  const [priceFit, setPriceFit] = useState(mine?.price_fit || null);
  const [competitor, setCompetitor] = useState(mine?.competitor || '');
  const [wouldMakePay, setWouldMakePay] = useState(mine?.would_make_pay || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProblemReal(mine?.problem_real || 0);
    setBuyerWouldPay(mine?.buyer_would_pay || 0);
    setPriceFit(mine?.price_fit || null);
    setCompetitor(mine?.competitor || '');
    setWouldMakePay(mine?.would_make_pay || '');
  }, [mine?.updated_at]);

  const save = async (e) => {
    e.preventDefault();
    if (!problemReal || !buyerWouldPay) {
      toast.error('Answer the first two questions.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.put(`/ideas/${ideaId}/feedback`, {
        problem_real: problemReal,
        buyer_would_pay: buyerWouldPay,
        price_fit: priceFit,
        competitor: competitor.trim() || null,
        would_make_pay: wouldMakePay.trim() || null,
      });
      toast.success(mine ? 'Feedback updated.' : 'Thanks for the feedback!');
      onSaved(res.data);
    } catch (err) {
      toast.error(err.message || 'Could not save your feedback.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="p-5 sm:p-6 rounded-[12px] border border-border bg-surface space-y-4">
      <div className="space-y-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink">Quick feedback</h3>
        <p className="text-xs text-ink-muted">Four questions, about 30 seconds.</p>
      </div>
      <Scale label="1. Is the problem real?" name="Problem is real" value={problemReal} onChange={setProblemReal} />
      <Scale label="2. Would the target buyer pay?" name="Buyer would pay" value={buyerWouldPay} onChange={setBuyerWouldPay} />
      <fieldset className="space-y-1.5">
        <legend className="text-xs font-semibold text-ink">3. Is the price right?</legend>
        <div className="flex flex-wrap gap-2">
          {PRICE_FIT.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={priceFit === p.id}
              onClick={() => setPriceFit(priceFit === p.id ? null : p.id)}
              className={cn(
                'h-9 px-3 rounded-full border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                priceFit === p.id ? 'border-accent-strong bg-accent-soft text-ink' : 'border-border text-ink-muted hover:border-border-strong'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <label htmlFor="fb-competitor" className="text-xs font-semibold text-ink block">4. Do you know a competitor? <span className="font-normal text-ink-muted">(name or link)</span></label>
        <input
          id="fb-competitor"
          value={competitor}
          onChange={(e) => setCompetitor(e.target.value)}
          maxLength={300}
          className="w-full h-10 px-3 rounded-[8px] border border-border bg-bg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus-ring"
          placeholder="e.g. Typeform"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="fb-pay" className="text-xs font-semibold text-ink block">What would make you pay? <span className="font-normal text-ink-muted">(optional)</span></label>
        <textarea
          id="fb-pay"
          value={wouldMakePay}
          onChange={(e) => setWouldMakePay(e.target.value)}
          maxLength={1000}
          rows={2}
          className="w-full px-3 py-2 rounded-[8px] border border-border bg-bg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus-ring"
        />
      </div>
      <Button type="submit" isLoading={saving} className="w-full h-10 rounded-[8px]">
        {mine ? 'Update feedback' : 'Send feedback'}
      </Button>
    </form>
  );
}

function FeedbackSummary({ feedback, ideaId, isAuthor }) {
  const total = feedback?.total || 0;
  if (total === 0) {
    return (
      <div className="p-5 rounded-[12px] border border-dashed border-border bg-surface text-sm text-ink-muted">
        No structured feedback yet.
      </div>
    );
  }
  const fit = feedback.price_fit;
  return (
    <div className="p-5 sm:p-6 rounded-[12px] border border-border bg-surface space-y-4 text-sm">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink">Feedback summary</h3>
        <span className="text-xs text-ink-muted tabular-nums">{total} {total === 1 ? 'answer' : 'answers'}</span>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="text-[11px] text-ink-muted">Problem is real</dt>
          <dd className="text-xl font-bold tabular-nums text-ink">{feedback.problem_real_avg} <span className="text-xs font-normal text-ink-muted">/ 5</span></dd>
        </div>
        <div>
          <dt className="text-[11px] text-ink-muted">Buyer would pay</dt>
          <dd className="text-xl font-bold tabular-nums text-ink">{feedback.buyer_would_pay_avg} <span className="text-xs font-normal text-ink-muted">/ 5</span></dd>
        </div>
      </dl>
      <p className="text-xs text-ink-muted tabular-nums">
        Price: {fit.too_low} too low · {fit.right} about right · {fit.too_high} too high
      </p>
      {feedback.competitors.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Competitors named</h4>
          <ul className="flex flex-wrap gap-1.5">
            {feedback.competitors.map((c, i) => (
              <li key={i} className="text-xs px-2 py-0.5 rounded-full bg-surface-muted border border-border text-ink break-all">{c.text}</li>
            ))}
          </ul>
        </div>
      )}
      {feedback.would_make_pay.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">What would make them pay</h4>
          <ul className="space-y-2">
            {feedback.would_make_pay.map((w, i) => (
              <li key={i} className="text-xs text-ink leading-relaxed">
                "{w.text}" <span className="text-ink-faint">— {w.user_name}</span>
                {isAuthor && <HelpfulButton ideaId={ideaId} userId={w.user_id} />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function HelpfulButton({ ideaId, userId }) {
  const [done, setDone] = useState(false);
  if (done) return <span className="ml-2 text-success font-semibold">Marked helpful</span>;
  return (
    <button
      type="button"
      className="ml-2 text-accent-strong font-semibold hover:underline"
      onClick={async () => {
        try {
          await api.post(`/ideas/${ideaId}/feedback/${userId}/helpful`);
          setDone(true);
          toast.success('Thanks. The rater earned +5 reputation.');
        } catch (err) {
          toast.error(err.message);
        }
      }}
    >
      Helpful
    </button>
  );
}

export function StructuredFeedback({ ideaId, isAuthor, isAuthenticated }) {
  const queryClient = useQueryClient();
  const queryKey = ['idea-feedback', String(ideaId)];
  const { data } = useQuery({ queryKey, queryFn: () => api.get(`/ideas/${ideaId}/feedback`) });
  const feedback = data?.data?.feedback;
  const mine = data?.data?.my_feedback;

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
      <div className="md:col-span-6">
        <FeedbackSummary feedback={feedback} ideaId={ideaId} isAuthor={isAuthor} />
      </div>
      <div className="md:col-span-6">
        {isAuthor ? null : isAuthenticated ? (
          <FeedbackForm ideaId={ideaId} mine={mine} onSaved={(result) => queryClient.setQueryData(queryKey, { success: true, data: result })} />
        ) : (
          <div className="p-6 rounded-[12px] border border-dashed border-border bg-surface text-center space-y-3">
            <p className="text-sm font-semibold text-ink">Help the founder with 4 quick answers</p>
            <Link to={`/login?redirect=${encodeURIComponent(`/ideas/${ideaId}`)}`}>
              <Button size="sm" className="rounded-[8px]">Sign in to give feedback</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
