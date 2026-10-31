import React, { useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api, { API_HOST } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PRICE_TIERS, ROLE_LABELS, demandHeadline } from '@/components/demand-signal-panel';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Check, Printer, Download } from 'lucide-react';
import { Page, Empty } from './community-pages';

const PLANS = [
  { id: 'free', name: 'Free', price: '$0', who: 'Post, vote, comment, browse open-source SaaS', items: ['5 published ideas every 30 days', 'Demand votes and structured feedback', 'Share links and launch waitlist'] },
  { id: 'report', name: 'Validation Report', price: '$29 one-time', who: 'Founder with one idea to test', items: ['Shown first to raters for 7 days', 'Target: 25 votes, or a free 7-day extension', '% would pay, price chart, votes by role', 'Top objections, competitors, waitlist emails', 'Plain-English verdict, PDF and share link', '"Validated on BusinessListe" badge if it passes'] },
  { id: 'pro', name: 'Pro', price: '$19 / month', who: 'Founder testing ideas regularly', items: ['Unlimited idea posts and private drafts', 'Landing page per idea with email waitlist and CSV export', 'Analytics: views, vote trend, where voters came from', 'One Validation Report credit per month'] },
  { id: 'featured', name: 'Featured', price: '$15 / day', who: 'Founder who wants fast votes', items: ['Pinned at the top of Fresh ideas for 24 hours', 'Clearly labelled "Featured"', 'Only 3 spots a day'] },
];

export function PricingPage() {
  const { isAuthenticated } = useAuth();
  const [params] = useSearchParams();
  const { data: config } = useQuery({ queryKey: ['payments-config'], queryFn: () => api.get('/payments/config') });
  const { data: plan } = useQuery({ queryKey: ['my-plan'], queryFn: () => api.get('/payments/me'), enabled: isAuthenticated });
  const enabled = config?.data?.enabled;
  const [busy, setBusy] = useState(false);

  const buyPro = async () => {
    setBusy(true);
    try {
      const res = await api.post('/payments/checkout', { product: 'pro' });
      if (res.data?.url) window.location.href = res.data.url;
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <Page title="Pricing" intro="Free to post and vote. Pay only when you want faster, deeper proof." width="max-w-[1000px]">
      {params.get('paid') === 'pro' && <p className="p-3 rounded-[8px] bg-success-soft text-sm">Thanks! Pro is active as soon as the payment is confirmed (usually a few seconds).</p>}
      {!enabled && <p className="p-3 rounded-[8px] border border-border bg-surface text-sm text-ink-muted">Paid plans open soon. The first 50 founders who post get a free Validation Report.</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map((p) => (
          <section key={p.id} className="p-5 rounded-[12px] border border-border bg-surface flex flex-col gap-3">
            <div>
              <h2 className="font-bold text-ink">{p.name}</h2>
              <p className="text-xl font-extrabold tabular-nums">{p.price}</p>
              <p className="text-xs text-ink-muted">{p.who}</p>
            </div>
            <ul className="space-y-1.5 text-xs flex-1">
              {p.items.map((i) => <li key={i} className="flex gap-1.5"><Check className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />{i}</li>)}
            </ul>
            {p.id === 'pro' && (plan?.data?.is_pro
              ? <p className="text-xs font-semibold text-success">Pro until {formatDate(plan.data.pro_until)}</p>
              : isAuthenticated
                ? <Button size="sm" disabled={!enabled} isLoading={busy} onClick={buyPro} className="rounded-[8px]">{enabled ? 'Get Pro' : 'Coming soon'}</Button>
                : <Link to="/login?redirect=/pricing"><Button size="sm" className="rounded-[8px] w-full">Sign in</Button></Link>)}
            {(p.id === 'report' || p.id === 'featured') && <p className="text-[11px] text-ink-muted">Buy from your idea's page.</p>}
          </section>
        ))}
      </div>
      <p className="text-xs text-ink-muted">Payments by Stripe. Full refund if a report gets under 25 votes after the free extension.</p>
    </Page>
  );
}

function Bars({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-3 text-xs">
          <span className="w-28 shrink-0 truncate">{r.label}</span>
          <div className="flex-1 h-3 bg-surface-muted rounded-full overflow-hidden"><div className="h-full bg-success rounded-full" style={{ width: `${(r.value / max) * 100}%` }} /></div>
          <span className="w-16 text-right tabular-nums text-ink-muted">{r.note ?? r.value}</span>
        </li>
      ))}
    </ul>
  );
}

function csvCell(v) {
  let t = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return `"${t.replace(/"/g, '""')}"`;
}

function downloadCsv(rows, name) {
  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function ReportView({ report, isOwner }) {
  const d = report.demand;
  const shareUrl = `${window.location.origin}/r/${report.public_token}`;
  const badgeUrl = `${API_HOST || window.location.origin}/api/v1/reports/public/${report.public_token}/badge.svg`;
  const embed = `<a href="${shareUrl}"><img src="${badgeUrl}" alt="Validated on BusinessListe"></a>`;
  return (
    <div className="space-y-6 print:space-y-4">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wider font-bold text-ink-muted">Validation Report</p>
        <h2 className="text-xl font-bold">{report.idea.title}</h2>
        <p className="text-sm text-ink-muted">{report.idea.pitch}</p>
        <p className="text-xs text-ink-muted">
          {formatDate(report.started_at)} – {formatDate(report.ends_at)} · {report.finished ? 'Finished' : 'In progress'}{report.extended ? ' · extended 7 days' : ''}
        </p>
      </div>
      <section className="p-5 rounded-[12px] border border-border bg-surface space-y-2">
        <p className="text-lg font-bold tabular-nums">{demandHeadline(d)}</p>
        <p className="text-sm">Demand score <strong className="tabular-nums">{d.demand_score}/100</strong> · {d.total} of {report.target_votes} target votes</p>
        <p className="text-sm text-ink">{report.verdict}</p>
        {report.refund_eligible && isOwner && <p className="text-xs text-danger">This report ended under 25 votes after the extension. You qualify for a full refund: reply to your receipt email.</p>}
      </section>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="p-5 rounded-[12px] border border-border bg-surface space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">Price people would pay / month</h3>
          <Bars rows={PRICE_TIERS.map((t) => ({ label: t.label, value: d.price_tiers[t.id] || 0 }))} />
        </section>
        <section className="p-5 rounded-[12px] border border-border bg-surface space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">Votes by role</h3>
          {d.by_role.length === 0 ? <p className="text-xs text-ink-muted">No votes yet.</p> : (
            <Bars rows={d.by_role.map((r) => ({ label: ROLE_LABELS[r.role] || r.role, value: r.total, note: `${r.would_pay}/${r.total} pay` }))} />
          )}
        </section>
        <section className="p-5 rounded-[12px] border border-border bg-surface space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">Top objections: what would make them pay</h3>
          {report.objections.length === 0 ? <p className="text-xs text-ink-muted">None yet.</p> : (
            <ol className="list-decimal pl-4 space-y-1 text-sm">{report.objections.map((o, i) => <li key={i}>"{o.text}"{o.role && <span className="text-xs text-ink-muted"> ({ROLE_LABELS[o.role]})</span>}</li>)}</ol>
          )}
        </section>
        <section className="p-5 rounded-[12px] border border-border bg-surface space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">Competitors named</h3>
          {report.competitors.length === 0 ? <p className="text-xs text-ink-muted">None named yet.</p> : (
            <ul className="text-sm space-y-1">{report.competitors.map((c) => <li key={c.name}>{c.name} <span className="text-xs text-ink-muted">· {c.mentions}×</span></li>)}</ul>
          )}
        </section>
      </div>
      {isOwner && report.waitlist && (
        <section className="p-5 rounded-[12px] border border-border bg-surface space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">Waitlist emails ({report.waitlist.length}, shared with consent)</h3>
            <Button size="sm" variant="secondary" className="print:hidden rounded-[8px]" disabled={!report.waitlist.length}
              onClick={() => downloadCsv([['Name', 'Email'], ...report.waitlist.map((w) => [w.name, w.email])], 'waitlist.csv')}>
              <Download className="w-3.5 h-3.5 mr-1" /> CSV
            </Button>
          </div>
          <ul className="text-sm">{report.waitlist.map((w) => <li key={w.email}>{w.name} · {w.email}</li>)}</ul>
        </section>
      )}
      {isOwner && (
        <section className="p-5 rounded-[12px] border border-border bg-surface space-y-2 print:hidden">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted">Share</h3>
          <p className="text-xs">Public link (no emails): <a className="text-accent-strong break-all" href={shareUrl}>{shareUrl}</a></p>
          {report.badge_eligible ? (
            <>
              <img src={badgeUrl} alt="Validated on BusinessListe" />
              <p className="text-xs text-ink-muted">Embed on your site or deck:</p>
              <pre className="text-[11px] p-2 bg-bg border border-border rounded overflow-x-auto">{embed}</pre>
            </>
          ) : <p className="text-xs text-ink-muted">The "Validated on BusinessListe" badge unlocks at a demand score of 50 or more from at least 10 votes.</p>}
        </section>
      )}
      <Button variant="secondary" size="sm" className="print:hidden rounded-[8px]" onClick={() => window.print()}><Printer className="w-3.5 h-3.5 mr-1" /> Download PDF</Button>
    </div>
  );
}

export function IdeaReportPage() {
  const { id } = useParams();
  const { isAuthenticated, isLoading } = useAuth();
  const { data, isLoading: loading, error } = useQuery({ queryKey: ['idea-report', Number(id)], queryFn: () => api.get(`/ideas/${id}/report`), enabled: isAuthenticated, retry: false });
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to={`/login?redirect=/ideas/${id}/report`} replace />;
  const report = data?.data?.report;
  return (
    <Page title="Your Validation Report">
      {loading ? null : error ? <Empty>{error.message}</Empty> : !report ? <Empty>No report for this idea yet. <Link to={`/ideas/${id}`} className="text-accent-strong hover:underline">Start one from the idea page.</Link></Empty> : <ReportView report={report} isOwner />}
    </Page>
  );
}

export function PublicReportPage() {
  const { token } = useParams();
  const { data, isLoading, error } = useQuery({ queryKey: ['public-report', token], queryFn: () => api.get(`/reports/public/${token}`), retry: false });
  const report = data?.data?.report;
  return (
    <Page title="Validation Report" intro="Real people on BusinessListe said whether they would pay for this idea.">
      {isLoading ? null : error || !report ? <Empty>Report not found.</Empty> : (
        <>
          <ReportView report={report} isOwner={false} />
          <p className="text-xs text-ink-muted print:hidden"><Link to={`/ideas/${report.idea.id}`} className="text-accent-strong hover:underline">See the idea and vote</Link></p>
        </>
      )}
    </Page>
  );
}

export function AnalyticsPage() {
  const { id } = useParams();
  const { data, isLoading, error } = useQuery({ queryKey: ['idea-analytics', id], queryFn: () => api.get(`/ideas/${id}/analytics`), retry: false });
  const a = data?.data;
  return (
    <Page title="Idea analytics" intro="Last 30 days. Views count page loads; referrers are the site a visitor came from.">
      <Link to={`/ideas/${id}`} className="text-xs text-accent-strong hover:underline">Back to idea</Link>
      {isLoading ? null : error ? <Empty>{error.message} <Link to="/pricing" className="text-accent-strong hover:underline">See Pro</Link></Empty> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="p-5 rounded-[12px] border border-border bg-surface space-y-2 md:col-span-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink-muted">Views per day</h2>
            {a.views.length === 0 ? <p className="text-xs text-ink-muted">No views yet.</p> : <Bars rows={a.views.map((v) => ({ label: v.day, value: v.views }))} />}
          </section>
          <section className="p-5 rounded-[12px] border border-border bg-surface space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink-muted">Where visitors came from</h2>
            {a.referrers.length === 0 ? <p className="text-xs text-ink-muted">No data yet.</p> : <Bars rows={a.referrers.map((r) => ({ label: r.referrer, value: r.views }))} />}
          </section>
          <section className="p-5 rounded-[12px] border border-border bg-surface space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink-muted">Demand votes per day</h2>
            {a.votes.length === 0 ? <p className="text-xs text-ink-muted">No votes yet.</p> : <Bars rows={a.votes.map((v) => ({ label: v.day, value: v.votes, note: `${v.would_pay} pay` }))} />}
          </section>
        </div>
      )}
    </Page>
  );
}

// Pro fake-door landing page: public, email-only waitlist.
export function IdeaLandingPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({ queryKey: ['landing', id], queryFn: () => api.get(`/ideas/${id}/landing`), retry: false });
  const { data: signupData } = useQuery({ queryKey: ['landing-signups', id], queryFn: () => api.get(`/ideas/${id}/landing/signups`), enabled: Boolean(user), retry: false });
  const [email, setEmail] = useState('');
  const [hp, setHp] = useState('');
  const [done, setDone] = useState(false);
  const queryClient = useQueryClient();
  const idea = data?.data?.idea;
  const signups = signupData?.data?.signups;

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/ideas/${id}/landing/signup`, { email, website: hp });
      setDone(true);
      queryClient.invalidateQueries(['landing', id]);
    } catch (err) { toast.error(err.details?.[0]?.replace(/^[\w.]+:\s*/, '') || err.message); }
  };

  if (isLoading) return null;
  if (error || !idea) return <Page title="Not found"><Empty>This page does not exist.</Empty></Page>;
  return (
    <div className="min-h-screen bg-bg text-ink py-16">
      <main className="max-w-[640px] mx-auto px-4 space-y-6 text-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{idea.title}</h1>
        <p className="text-lg text-ink-muted">{idea.pitch}</p>
        {idea.problem && <p className="text-sm">{idea.problem}</p>}
        {idea.how_it_works && <p className="text-sm text-ink-muted whitespace-pre-wrap">{idea.how_it_works}</p>}
        {idea.suggested_price != null && <p className="text-sm font-semibold">Planned price: ${idea.suggested_price}/month</p>}
        {done ? <p className="p-4 rounded-[12px] bg-success-soft text-sm">You're on the list. We'll email you at launch.</p> : (
          <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
            <Input type="email" required aria-label="Email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
            <div aria-hidden="true" className="absolute -left-[9999px]"><input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} /></div>
            <Button type="submit" className="h-11 rounded-[8px]">Get early access</Button>
          </form>
        )}
        <p className="text-xs text-ink-muted">{data.data.signups} people joined · Your email goes only to the founder. <Link to={`/ideas/${id}`} className="underline">Vote on BusinessListe</Link></p>
        {signups && (
          <section className="text-left p-4 rounded-[12px] border border-border bg-surface space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Signups (only you see this)</h2>
              <Button size="sm" variant="secondary" disabled={!signups.length} onClick={() => downloadCsv([['Email', 'Joined'], ...signups.map((s) => [s.email, s.created_at])], 'landing-signups.csv')}>CSV</Button>
            </div>
            <ul className="text-xs space-y-0.5">{signups.map((s) => <li key={s.email}>{s.email}</li>)}</ul>
          </section>
        )}
      </main>
    </div>
  );
}
