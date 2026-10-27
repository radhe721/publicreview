import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { z } from 'zod';

// Same rule the server applies, so anything accepted here isn't rejected after submitting.
const emailSchema = z.string().trim().email().max(100);

// Shown only once the list is big enough to be reassuring rather than empty.
const SOCIAL_PROOF_MIN = 10;

export function WaitlistCard({ source = 'landing' }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [useCase, setUseCase] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [joined, setJoined] = useState(false);

  const { data } = useQuery({
    queryKey: ['waitlist-count'],
    queryFn: () => api.get('/waitlist/count'),
    staleTime: 1000 * 60,
  });
  const total = data?.data?.total || 0;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!emailSchema.safeParse(email).success) {
      setError('Please enter a valid email address.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await api.post('/waitlist', {
        email: email.trim(),
        name: name.trim() || null,
        use_case: useCase.trim() || null,
        source,
        website,
      });
      queryClient.setQueryData(['waitlist-count'], { success: true, data: { total: res.data.total } });
      setJoined(true);
    } catch (err) {
      // Validation errors arrive as "field: reason"; show the reason rather than "Validation failed".
      const detail = err.details?.[0]?.replace(/^[\w.]+:\s*/, '');
      setError(detail || err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (joined) {
    return (
      <section aria-live="polite" className="p-6 rounded-[12px] border border-border bg-surface flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
        <div>
          <h2 className="text-base font-bold text-ink">You're on the list!</h2>
          <p className="text-sm text-ink-muted mt-0.5">
            We'll email <strong className="text-ink">{email.trim()}</strong> when new features launch. Thanks for the early support.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="waitlist-heading" className="p-5 sm:p-6 rounded-[12px] border border-border bg-surface space-y-4">
      <div className="space-y-1">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-accent-strong">
          <Sparkles className="w-3.5 h-3.5" /> Early access
        </span>
        <h2 id="waitlist-heading" className="text-lg sm:text-xl font-bold tracking-tight text-ink">
          Join the IdeaPulse waitlist
        </h2>
        <p className="text-sm text-ink-muted">
          Be first to try new validation tools and get launch updates.
          {total >= SOCIAL_PROOF_MIN && (
            <> <strong className="text-ink tabular-nums">{total.toLocaleString()}</strong> people have already joined.</>
          )}
        </p>
      </div>

      <form onSubmit={onSubmit} noValidate className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="waitlist-email" className="text-xs font-bold uppercase tracking-wider text-ink block">
              Email <span className="text-danger">*</span>
            </label>
            <Input
              id="waitlist-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              hasError={!!error}
              maxLength={100}
              className="h-11"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="waitlist-name" className="text-xs font-bold uppercase tracking-wider text-ink block">
              Name <span className="font-normal normal-case text-ink-muted">(optional)</span>
            </label>
            <Input
              id="waitlist-name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={80}
              className="h-11"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label htmlFor="waitlist-use" className="text-xs font-bold uppercase tracking-wider text-ink block">
            What would you use it for? <span className="font-normal normal-case text-ink-muted">(optional)</span>
          </label>
          <Input
            id="waitlist-use"
            value={useCase}
            onChange={(e) => setUseCase(e.target.value)}
            placeholder="e.g. Testing demand for my SaaS idea before building"
            maxLength={300}
            className="h-11"
          />
        </div>

        {/* Honeypot: invisible to people, tempting to bots. Its label and id deliberately avoid words
            like "website" or "url" that browser and password-manager autofill would fill in for real people. */}
        <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden">
          <label htmlFor="waitlist-hp">Leave this empty</label>
          <input id="waitlist-hp" name="hp_field" type="text" tabIndex={-1} autoComplete="off" data-1p-ignore data-lpignore="true" data-bwignore value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>

        {error && <p role="alert" className="text-xs text-danger">{error}</p>}

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Button type="submit" isLoading={isSubmitting} className="h-11 px-6 rounded-[8px]">
            Join the waitlist
          </Button>
          <span className="text-xs text-ink-muted">No spam. Unsubscribe anytime.</span>
        </div>
      </form>
    </section>
  );
}
