import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import api from '@/api/client';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

// Spec 3.1 fields shared by the submit and edit forms (react-hook-form `register`).
export const extraFieldsSchema = {
  problem: z.string().trim().min(10, 'Describe the problem in at least 10 characters').max(1000),
  target_buyer: z.string().trim().min(3, 'Who would pay for it?').max(200),
  suggested_price: z.union([z.literal(''), z.coerce.number().int().min(0).max(100000)]).optional(),
  how_it_works: z.string().trim().max(3000).optional(),
  competitors: z.string().trim().max(500).optional(),
  link_url: z.union([z.literal(''), z.string().trim().url('Use a full link (https://...)')]).optional(),
};

export const extraFieldsDefaults = { problem: '', target_buyer: '', suggested_price: '', how_it_works: '', competitors: '', link_url: '' };

export function extraFieldsPayload(values) {
  return {
    problem: values.problem?.trim() || null,
    target_buyer: values.target_buyer?.trim() || null,
    suggested_price: values.suggested_price === '' || values.suggested_price == null ? null : Number(values.suggested_price),
    how_it_works: values.how_it_works?.trim() || null,
    competitors: values.competitors?.trim() || null,
    link_url: values.link_url?.trim() || null,
  };
}

function Field({ id, label, required, hint, error, children }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-bold uppercase tracking-wider text-ink block">
        {label} {required ? <span className="text-danger">*</span> : <span className="font-normal normal-case text-ink-muted">(optional)</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[11px] text-ink-muted">{hint}</p>}
      {error && <p className="text-xs text-danger">{error.message}</p>}
    </div>
  );
}

export function IdeaExtraFields({ register, errors }) {
  return (
    <div className="space-y-5">
      <Field id="idea-problem" label="Problem" required error={errors.problem}
        hint='Example: "Freelancers spend 3 hours a month chasing late invoices."'>
        <Textarea id="idea-problem" {...register('problem')} maxLength={1000} className="min-h-[80px]" hasError={!!errors.problem} />
      </Field>
      <Field id="idea-buyer" label="Target buyer" required error={errors.target_buyer}
        hint='Example: "Freelance designers billing 5+ clients a month."'>
        <Input id="idea-buyer" {...register('target_buyer')} maxLength={200} className="h-11" hasError={!!errors.target_buyer} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field id="idea-price" label="Suggested price ($/month)" error={errors.suggested_price} hint="Example: 12">
          <Input id="idea-price" type="number" min="0" inputMode="numeric" {...register('suggested_price')} className="h-11" />
        </Field>
        <Field id="idea-link" label="Landing page or repo link" error={errors.link_url} hint="https://...">
          <Input id="idea-link" type="url" {...register('link_url')} maxLength={300} className="h-11" />
        </Field>
      </div>
      <Field id="idea-how" label="How it works" error={errors.how_it_works} hint="The 2–3 steps a customer goes through.">
        <Textarea id="idea-how" {...register('how_it_works')} maxLength={3000} className="min-h-[80px]" />
      </Field>
      <Field id="idea-competitors" label="Competitors" error={errors.competitors} hint="Example: Chaser, InvoiceSherpa">
        <Input id="idea-competitors" {...register('competitors')} maxLength={500} className="h-11" />
      </Field>
    </div>
  );
}

// Shows similar existing ideas while the founder types a title.
export function DuplicateHint({ title, excludeId }) {
  const [matches, setMatches] = useState([]);
  useEffect(() => {
    const q = (title || '').trim();
    if (q.length < 6) { setMatches([]); return undefined; }
    const t = setTimeout(async () => {
      try {
        const res = await api.get(`/ideas/similar-titles?q=${encodeURIComponent(q)}`);
        setMatches((res.data.ideas || []).filter((i) => i.id !== excludeId));
      } catch { setMatches([]); }
    }, 400);
    return () => clearTimeout(t);
  }, [title, excludeId]);

  if (matches.length === 0) return null;
  return (
    <div className="p-3 rounded-[8px] border border-border bg-surface-muted text-xs space-y-1.5" role="status">
      <p className="font-semibold text-ink">Similar ideas already here. Check they are not the same:</p>
      <ul className="space-y-1">
        {matches.map((m) => (
          <li key={m.id}><Link to={`/ideas/${m.id}`} target="_blank" className="text-accent-strong hover:underline">{m.title}</Link></li>
        ))}
      </ul>
    </div>
  );
}
