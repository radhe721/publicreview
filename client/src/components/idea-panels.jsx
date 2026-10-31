import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuthorAvatar } from '@/components/ui/author-avatar';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';
import { ExternalLink, Hammer, Rocket, BadgeCheck, Star, BarChart3, FileText, Pin, Globe } from 'lucide-react';

export const MRR_LABELS = {
  pre_revenue: 'Pre-revenue',
  under_1k: 'Under $1k MRR',
  '1k_5k': '$1k–5k MRR',
  '5k_20k': '$5k–20k MRR',
  '20k_100k': '$20k–100k MRR',
  over_100k: '$100k+ MRR',
};

export function mrrText(launch) {
  if (!launch) return '';
  if (launch.mrr_verified_cents != null) return `$${Math.round(launch.mrr_verified_cents / 100).toLocaleString()} MRR`;
  return MRR_LABELS[launch.mrr_range] || 'Revenue not shared';
}

function Panel({ title, children, icon: Icon }) {
  return (
    <section className="p-5 rounded-[12px] border border-border bg-surface space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5" />} {title}
      </h2>
      {children}
    </section>
  );
}

// Problem, buyer, price, how it works, competitors, link.
export function IdeaDetailsBlock({ idea }) {
  const rows = [
    ['Problem', idea.problem],
    ['Target buyer', idea.target_buyer],
    ['Suggested price', idea.suggested_price != null ? `$${idea.suggested_price}/month` : null],
    ['How it works', idea.how_it_works],
    ['Competitors', idea.competitors],
  ].filter(([, v]) => v);
  if (rows.length === 0 && !idea.link_url) return null;
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 rounded-[12px] border border-border bg-surface text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className={label === 'How it works' || label === 'Problem' ? 'sm:col-span-2' : ''}>
          <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{label}</dt>
          <dd className="text-ink whitespace-pre-wrap mt-0.5">{value}</dd>
        </div>
      ))}
      {idea.link_url && (
        <div className="sm:col-span-2">
          <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">Link</dt>
          <dd className="mt-0.5">
            <a href={idea.link_url} target="_blank" rel="noopener noreferrer nofollow" className="text-accent-strong hover:underline inline-flex items-center gap-1 break-all">
              {idea.link_url} <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          </dd>
        </div>
      )}
    </dl>
  );
}

export function SimilarIdeas({ ideaId }) {
  const { data } = useQuery({ queryKey: ['idea-similar', ideaId], queryFn: () => api.get(`/ideas/${ideaId}/similar`) });
  const ideas = data?.data?.ideas || [];
  if (ideas.length === 0) return null;
  return (
    <Panel title="Similar ideas on BusinessListe">
      <ul className="space-y-2 text-sm">
        {ideas.map((i) => (
          <li key={i.id}>
            <Link to={`/ideas/${i.id}`} className="font-semibold text-ink hover:text-accent-strong">{i.title}</Link>
            <p className="text-xs text-ink-muted line-clamp-1">{i.pitch}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function RelatedRepos({ ideaId }) {
  const { data } = useQuery({ queryKey: ['idea-repos', ideaId], queryFn: () => api.get(`/ideas/${ideaId}/repos`) });
  const repos = data?.data?.repos || [];
  if (repos.length === 0) return null;
  return (
    <Panel title="Similar open-source projects">
      <ul className="space-y-2 text-sm">
        {repos.map((r) => (
          <li key={r.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <a href={r.html_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink hover:text-accent-strong break-all">{r.full_name}</a>
              <p className="text-xs text-ink-muted line-clamp-1">{r.description}</p>
            </div>
            <span className="text-xs text-ink-muted shrink-0 inline-flex items-center gap-1 tabular-nums"><Star className="w-3 h-3" />{r.stars.toLocaleString()}</span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-ink-muted">Check each license before building a business on it. <Link to="/repos" className="text-accent-strong hover:underline">Browse all</Link></p>
    </Panel>
  );
}

export function EditHistory({ ideaId }) {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({ queryKey: ['idea-revisions', ideaId], queryFn: () => api.get(`/ideas/${ideaId}/revisions`) });
  const revisions = data?.data?.revisions || [];
  if (revisions.length === 0) return null;
  return (
    <div className="text-xs text-ink-muted">
      <button type="button" onClick={() => setOpen(!open)} className="hover:text-ink underline">
        Edited {revisions.length} {revisions.length === 1 ? 'time' : 'times'}: {open ? 'hide' : 'show'} history
      </button>
      {open && (
        <ol className="mt-2 space-y-2">
          {revisions.map((r) => (
            <li key={r.id} className="p-3 rounded-[8px] border border-border bg-surface">
              <p className="text-[11px] text-ink-faint">Before {formatDate(r.replaced_at)}</p>
              <p className="font-semibold text-ink">{r.title}</p>
              <p>{r.pitch}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function BuildInterest({ ideaId, isAuthor, isAuthenticated }) {
  const queryClient = useQueryClient();
  const key = ['idea-build', ideaId];
  const { data } = useQuery({ queryKey: key, queryFn: () => api.get(`/ideas/${ideaId}/build`) });
  const info = data?.data;
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      const res = info?.interested ? await api.delete(`/ideas/${ideaId}/build`) : await api.put(`/ideas/${ideaId}/build`, {});
      queryClient.setQueryData(key, res);
      if (!info?.interested) toast.success('The founder can now see you want to build this.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Builders" icon={Hammer}>
      <p className="text-sm text-ink">
        <strong className="tabular-nums">{info?.count || 0}</strong> {info?.count === 1 ? 'person wants' : 'people want'} to build this.
      </p>
      {isAuthor ? (
        info?.builders?.length > 0 && (
          <ul className="space-y-2">
            {info.builders.map((b) => (
              <li key={b.id} className="flex items-center gap-2 text-xs">
                <AuthorAvatar name={b.name} avatarUrl={b.avatar_url} size="xs" />
                <Link to={`/profile/${b.id}`} className="font-semibold text-ink hover:underline">{b.name}</Link>
                {b.note && <span className="text-ink-muted truncate">· {b.note}</span>}
              </li>
            ))}
          </ul>
        )
      ) : isAuthenticated ? (
        <Button size="sm" variant={info?.interested ? 'secondary' : 'primary'} isLoading={busy} onClick={toggle} className="rounded-[8px]">
          {info?.interested ? "You're interested (undo)" : 'I want to build this'}
        </Button>
      ) : (
        <Link to={`/login?redirect=/ideas/${ideaId}`}><Button size="sm" variant="secondary" className="rounded-[8px]">Sign in to join as a builder</Button></Link>
      )}
      <p className="text-[11px] text-ink-muted">Looking for a co-founder? <Link to="/cofounders" className="text-accent-strong hover:underline">Co-founder board</Link></p>
    </Panel>
  );
}

function LaunchForm({ idea, onDone }) {
  const [url, setUrl] = useState(idea.launch?.url || '');
  const [date, setDate] = useState(idea.launch?.launched_at || new Date().toISOString().slice(0, 10));
  const [range, setRange] = useState(idea.launch?.mrr_range || '');
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put(`/ideas/${idea.id}/launch`, { launched_url: url.trim(), launched_at: date, mrr_range: range || null });
      toast.success('Marked as launched.');
      onDone();
    } catch (err) {
      toast.error(err.details?.[0] || err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={save} className="space-y-2">
      <Input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-product.com" aria-label="Product URL" className="h-10" />
      <div className="grid grid-cols-2 gap-2">
        <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} aria-label="Launch date" className="h-10" />
        <select value={range} onChange={(e) => setRange(e.target.value)} aria-label="Monthly revenue" className="h-10 px-2 rounded-[8px] border border-border bg-bg text-sm text-ink">
          <option value="">Revenue (optional)</option>
          {Object.entries(MRR_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <Button type="submit" size="sm" isLoading={busy} className="rounded-[8px]">Save launch</Button>
    </form>
  );
}

function VerifyRevenue({ ideaId, onDone }) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const verify = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post(`/ideas/${ideaId}/verify-revenue`, { stripe_key: key.trim() });
      setKey('');
      toast.success(res.message);
      onDone();
    } catch (err) {
      toast.error(err.details?.[0]?.replace(/^[\w.]+:\s*/, '') || err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={verify} className="space-y-2 pt-2 border-t border-border">
      <p className="text-xs text-ink-muted">
        Verify revenue with a Stripe <strong>restricted key</strong> that can only read subscriptions. We read your MRR once and never store the key.
      </p>
      <Input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="rk_live_..." aria-label="Stripe restricted key" className="h-10" />
      <Button type="submit" size="sm" variant="secondary" isLoading={busy} disabled={!key} className="rounded-[8px]">Verify revenue</Button>
    </form>
  );
}

export function LaunchPanel({ idea, canManage }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const refresh = () => { setEditing(false); queryClient.invalidateQueries(['idea-detail', String(idea.id)]); };
  if (!idea.launch && !canManage) return null;
  return (
    <Panel title="Launch" icon={Rocket}>
      {idea.launch && !editing ? (
        <div className="space-y-1 text-sm">
          <p>
            <span className="text-ink-muted">Launched {formatDate(idea.launch.launched_at)} · </span>
            <a href={idea.launch.url} target="_blank" rel="noopener noreferrer" className="text-accent-strong hover:underline break-all">{idea.launch.url}</a>
          </p>
          <p className="font-bold text-ink inline-flex items-center gap-1.5">
            {mrrText(idea.launch)}
            {idea.launch.verified
              ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success"><BadgeCheck className="w-3.5 h-3.5" /> Verified with Stripe</span>
              : idea.launch.mrr_range && <span className="text-[11px] font-normal text-ink-muted">(self-reported)</span>}
          </p>
          {canManage && <button type="button" onClick={() => setEditing(true)} className="text-xs text-ink-muted underline">Edit launch</button>}
        </div>
      ) : canManage ? (
        <>
          <p className="text-xs text-ink-muted">Built it? Show the votes next to your revenue. It is the strongest proof this works.</p>
          <LaunchForm idea={idea} onDone={refresh} />
        </>
      ) : null}
      {canManage && idea.launch && !idea.launch.verified && <VerifyRevenue ideaId={idea.id} onDone={refresh} />}
    </Panel>
  );
}

// Founder tools: Validation Report, Featured spot, Pro analytics and landing page.
export function FounderTools({ idea }) {
  const queryClient = useQueryClient();
  const { data: config } = useQuery({ queryKey: ['payments-config'], queryFn: () => api.get('/payments/config'), staleTime: 300000 });
  const { data: plan } = useQuery({ queryKey: ['my-plan'], queryFn: () => api.get('/payments/me') });
  const { data: reportData } = useQuery({ queryKey: ['idea-report', idea.id], queryFn: () => api.get(`/ideas/${idea.id}/report`) });
  const [busy, setBusy] = useState(null);
  const enabled = config?.data?.enabled;
  const isPro = plan?.data?.is_pro;
  const credits = plan?.data?.report_credits || 0;
  const report = reportData?.data?.report;

  const buy = async (product) => {
    setBusy(product);
    try {
      const res = await api.post('/payments/checkout', { product, idea_id: idea.id });
      if (res.data?.url) { window.location.href = res.data.url; return; }
      toast.success(res.message || 'Started.');
      queryClient.invalidateQueries(['idea-report', idea.id]);
      queryClient.invalidateQueries(['my-plan']);
      queryClient.invalidateQueries(['idea-detail', String(idea.id)]);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel title="Founder tools" icon={FileText}>
      <div className="space-y-3 text-sm">
        <div className="space-y-1">
          <p className="font-semibold text-ink">Validation Report</p>
          {report ? (
            <p className="text-xs text-ink-muted">
              {report.finished ? 'Finished' : `Running until ${formatDate(report.ends_at)}`} · {report.demand.total} of {report.target_votes} target votes.{' '}
              <Link to={`/ideas/${idea.id}/report`} className="text-accent-strong font-semibold hover:underline">Open report</Link>
            </p>
          ) : (
            <>
              <p className="text-xs text-ink-muted">Your idea is shown first to raters for 7 days. You get % would pay, price chart, votes by role, top objections, competitors, waitlist emails and a verdict. Under 25 votes: free 7-day extension, then a full refund.</p>
              <Button size="sm" isLoading={busy === 'report'} disabled={!enabled && credits === 0} onClick={() => buy('report')} className="rounded-[8px]">
                {credits > 0 ? 'Start report (uses your Pro credit)' : enabled ? 'Get a report · $29' : 'Reports coming soon'}
              </Button>
            </>
          )}
        </div>
        <div className="space-y-1 pt-3 border-t border-border">
          <p className="font-semibold text-ink inline-flex items-center gap-1"><Pin className="w-3.5 h-3.5" /> Featured spot</p>
          {idea.is_featured ? (
            <p className="text-xs text-success font-semibold">Featured at the top of Fresh ideas right now.</p>
          ) : (
            <>
              <p className="text-xs text-ink-muted">Pinned at the top of Fresh ideas for 24 hours, labelled "Featured". Only 3 spots a day.</p>
              <Button size="sm" variant="secondary" isLoading={busy === 'featured'} disabled={!enabled} onClick={() => buy('featured')} className="rounded-[8px]">
                {enabled ? 'Feature for 24h · $15' : 'Featured spots coming soon'}
              </Button>
            </>
          )}
        </div>
        <div className="space-y-1 pt-3 border-t border-border text-xs text-ink-muted">
          {isPro ? (
            <p className="flex flex-wrap gap-3">
              <Link to={`/ideas/${idea.id}/analytics`} className="text-accent-strong font-semibold hover:underline inline-flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" /> Analytics</Link>
              <Link to={`/l/${idea.id}`} className="text-accent-strong font-semibold hover:underline inline-flex items-center gap-1"><Globe className="w-3.5 h-3.5" /> Landing page</Link>
            </p>
          ) : (
            <p>Analytics and a landing page with an email waitlist come with <Link to="/pricing" className="text-accent-strong font-semibold hover:underline">Pro</Link>.</p>
          )}
        </div>
      </div>
    </Panel>
  );
}

export function TimeAgo({ date }) {
  return <span>{formatRelativeTime(date)}</span>;
}
