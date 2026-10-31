import React, { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AuthorAvatar } from '@/components/ui/author-avatar';
import { formatDate, formatRelativeTime, cn } from '@/lib/utils';
import { ROLE_LABELS, demandHeadline } from '@/components/demand-signal-panel';
import { mrrText } from '@/components/idea-panels';
import { toast } from 'sonner';
import { BadgeCheck, MessageSquare, Search as SearchIcon, Star } from 'lucide-react';

function Page({ title, intro, children, width = 'max-w-[860px]' }) {
  return (
    <div className="min-h-screen bg-bg text-ink py-8 sm:py-12">
      <main className={cn(width, 'mx-auto px-4 sm:px-6 space-y-6')}>
        <header className="space-y-1 border-b border-border pb-5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">{title}</h1>
          {intro && <p className="text-sm text-ink-muted">{intro}</p>}
        </header>
        {children}
      </main>
    </div>
  );
}

const Empty = ({ children }) => (
  <p className="p-8 text-center rounded-[12px] border border-dashed border-border bg-surface text-sm text-ink-muted">{children}</p>
);

// ---------- Notifications + settings ----------
export function NotificationsPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['notifications'], queryFn: () => api.get('/notifications'), enabled: isAuthenticated });
  const { data: prefsData } = useQuery({ queryKey: ['notification-prefs'], queryFn: () => api.get('/notifications/prefs'), enabled: isAuthenticated });

  useEffect(() => {
    if (data?.data?.unread > 0) {
      api.post('/notifications/read').then(() => queryClient.invalidateQueries(['notifications-count'])).catch(() => null);
    }
  }, [data?.data?.unread]);

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login?redirect=/notifications" replace />;

  const notes = data?.data?.notifications || [];
  const prefs = prefsData?.data?.prefs || {};
  const types = prefsData?.data?.types || {};

  const setPref = async (type, channel, value) => {
    try {
      const res = await api.put('/notifications/prefs', { [type]: { [channel]: value } });
      queryClient.setQueryData(['notification-prefs'], { data: { ...prefsData.data, prefs: res.data.prefs } });
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Page title="Notifications" intro="Votes, comments and milestones on your ideas.">
      {notes.length === 0 ? <Empty>No notifications yet.</Empty> : (
        <ul className="divide-y divide-border rounded-[12px] border border-border bg-surface">
          {notes.map((n) => (
            <li key={n.id} className={cn('p-3 text-sm flex items-center justify-between gap-3', !n.read_at && 'bg-accent-soft')}>
              {n.link ? <Link to={n.link} className="text-ink hover:underline">{n.title}</Link> : <span>{n.title}</span>}
              <span className="text-xs text-ink-faint shrink-0">{formatRelativeTime(n.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
      <section aria-labelledby="prefs-heading" className="space-y-3">
        <h2 id="prefs-heading" className="text-base font-bold">Settings</h2>
        <table className="w-full text-sm border border-border rounded-[12px] overflow-hidden">
          <thead className="bg-surface-muted text-xs text-ink-muted">
            <tr><th className="text-left p-3">Notification</th><th className="p-3">In app</th><th className="p-3">Email</th></tr>
          </thead>
          <tbody>
            {Object.entries(types).map(([type, label]) => (
              <tr key={type} className="border-t border-border">
                <td className="p-3">{label}</td>
                {['inapp', 'email'].map((ch) => (
                  <td key={ch} className="p-3 text-center">
                    <input type="checkbox" aria-label={`${label}: ${ch === 'inapp' ? 'in app' : 'email'}`}
                      checked={Boolean(prefs[type]?.[ch])} onChange={(e) => setPref(type, ch, e.target.checked)}
                      className="w-4 h-4 accent-[var(--accent-strong)]" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Page>
  );
}

// ---------- Top contributors ----------
export function ContributorsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['contributors'], queryFn: () => api.get('/contributors') });
  const rows = data?.data?.contributors || [];
  return (
    <Page title="Top Contributors" intro="Raters who earned the most reputation in the last 30 days. +1 per rating, +5 when a founder marks feedback helpful, +10 when an idea you said you'd pay for shows verified revenue.">
      {isLoading ? null : rows.length === 0 ? <Empty>No ratings in the last 30 days yet. <Link to="/feed?sort=needs_votes" className="text-accent-strong hover:underline">Rate an idea</Link> to be first.</Empty> : (
        <ol className="divide-y divide-border rounded-[12px] border border-border bg-surface">
          {rows.map((c) => (
            <li key={c.id} className="p-3 flex items-center gap-3 text-sm">
              <span className="w-6 text-right font-bold tabular-nums text-ink-muted">{c.rank}</span>
              <AuthorAvatar name={c.name} avatarUrl={c.avatar_url} size="sm" />
              <div className="flex-1 min-w-0">
                <Link to={`/profile/${c.id}`} className="font-semibold text-ink hover:underline">{c.name}</Link>
                <p className="text-xs text-ink-muted">{c.level.label}{c.role_tag ? ` · ${ROLE_LABELS[c.role_tag] || c.role_tag}` : ''} · {c.ratings} ratings · {c.helpful} helpful</p>
              </div>
              <span className="font-bold tabular-nums">+{c.month_points}</span>
            </li>
          ))}
        </ol>
      )}
    </Page>
  );
}

// ---------- Co-founder board ----------
export function CofoundersPage() {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['cofounders', Boolean(isAuthenticated)], queryFn: () => api.get('/cofounders') });
  const posts = data?.data?.posts || [];
  const mine = posts.find((p) => p.user_id === user?.id);
  const [form, setForm] = useState({ skills: '', looking_for: '', contact: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (mine) setForm({ skills: mine.skills, looking_for: mine.looking_for, contact: mine.contact || '' }); }, [mine?.id]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put('/cofounders', form);
      toast.success('Your post is live.');
      queryClient.invalidateQueries(['cofounders']);
    } catch (err) {
      toast.error(err.details?.[0]?.replace(/^[\w.]+:\s*/, '') || err.message);
    } finally { setBusy(false); }
  };
  const remove = async () => {
    await api.delete('/cofounders');
    setForm({ skills: '', looking_for: '', contact: '' });
    queryClient.invalidateQueries(['cofounders']);
  };

  return (
    <Page title="Co-founder board" intro="Post your skills and what you want to build. Contact details are shown to signed-in members only.">
      {isAuthenticated ? (
        <form onSubmit={save} className="p-5 rounded-[12px] border border-border bg-surface space-y-3">
          <h2 className="text-sm font-bold">{mine ? 'Your post' : 'Add your post'}</h2>
          <Input aria-label="Your skills" placeholder="Your skills, e.g. React, sales to agencies" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} maxLength={300} className="h-10" />
          <Textarea aria-label="What you want to build" placeholder="What you want to build, or who you are looking for" value={form.looking_for} onChange={(e) => setForm({ ...form, looking_for: e.target.value })} maxLength={500} />
          <Input aria-label="How to reach you" placeholder="How to reach you (email, X handle, LinkedIn)" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} maxLength={200} className="h-10" />
          <div className="flex gap-2">
            <Button type="submit" size="sm" isLoading={busy} className="rounded-[8px]">{mine ? 'Update post' : 'Post'}</Button>
            {mine && <Button type="button" size="sm" variant="ghost" onClick={remove}>Remove</Button>}
          </div>
        </form>
      ) : (
        <p className="text-sm text-ink-muted"><Link to="/login?redirect=/cofounders" className="text-accent-strong font-semibold hover:underline">Sign in</Link> to post and see contact details.</p>
      )}
      {posts.length === 0 ? <Empty>No posts yet. Be the first.</Empty> : (
        <ul className="space-y-3">
          {posts.map((p) => (
            <li key={p.id} className="p-4 rounded-[12px] border border-border bg-surface space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <AuthorAvatar name={p.name} avatarUrl={p.avatar_url} size="xs" />
                <Link to={`/profile/${p.user_id}`} className="font-semibold hover:underline">{p.name}</Link>
                <span className="text-xs text-ink-muted">{p.role_tag ? ROLE_LABELS[p.role_tag] : ''}{p.country ? ` · ${p.country}` : ''} · {formatRelativeTime(p.updated_at)}</span>
              </div>
              <p><strong>Skills:</strong> {p.skills}</p>
              <p><strong>Wants:</strong> {p.looking_for}</p>
              {p.contact && <p className="text-xs text-ink-muted">Contact: {p.contact}</p>}
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

// ---------- Launched from BusinessListe ----------
export function LaunchedPage() {
  const { data, isLoading } = useQuery({ queryKey: ['launches'], queryFn: () => api.get('/ideas/launches') });
  const launches = data?.data?.launches || [];
  return (
    <Page title="Launched from BusinessListe" intro="Ideas that were rated here and became real products, with their original demand and today's revenue.">
      {isLoading ? null : launches.length === 0 ? <Empty>No launches yet. Built something from an idea here? Open your idea and click "Save launch".</Empty> : (
        <ul className="space-y-3">
          {launches.map((l) => (
            <li key={l.id} className="p-4 rounded-[12px] border border-border bg-surface space-y-1 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link to={`/ideas/${l.id}`} className="font-bold text-ink hover:text-accent-strong">{l.title}</Link>
                <span className="font-bold inline-flex items-center gap-1">
                  {mrrText(l.launch)}
                  {l.launch.verified && <BadgeCheck className="w-4 h-4 text-success" aria-label="Verified with Stripe" />}
                </span>
              </div>
              <p className="text-ink-muted">{l.pitch}</p>
              <p className="text-xs text-ink-muted">
                Rated here {formatDate(l.posted_at)}: {demandHeadline(l.demand)}. Launched {formatDate(l.launch.launched_at)} ·{' '}
                <a href={l.launch.url} target="_blank" rel="noopener noreferrer" className="text-accent-strong hover:underline">visit</a>
              </p>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

// ---------- Search ----------
export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const [input, setInput] = useState(q);
  const { data } = useQuery({ queryKey: ['search', q], queryFn: () => api.get(`/search?q=${encodeURIComponent(q)}`), enabled: q.length >= 2 });
  const r = data?.data || { ideas: [], repos: [], users: [] };
  return (
    <Page title="Search" intro="Ideas, open-source projects and people.">
      <form onSubmit={(e) => { e.preventDefault(); setParams({ q: input.trim() }); }} className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
        <Input autoFocus aria-label="Search" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Search..." className="pl-9 h-11" />
      </form>
      {q.length >= 2 && (
        <div className="space-y-6">
          <section className="space-y-2"><h2 className="text-sm font-bold">Ideas ({r.ideas.length})</h2>
            {r.ideas.map((i) => <Link key={i.id} to={`/ideas/${i.id}`} className="block p-3 rounded-[8px] border border-border bg-surface hover:bg-surface-hover"><span className="font-semibold">{i.title}</span><span className="block text-xs text-ink-muted">{i.pitch}</span></Link>)}
          </section>
          <section className="space-y-2"><h2 className="text-sm font-bold">Open-source projects ({r.repos.length})</h2>
            {r.repos.map((p) => <a key={p.id} href={`https://github.com/${p.full_name}`} target="_blank" rel="noopener noreferrer" className="block p-3 rounded-[8px] border border-border bg-surface hover:bg-surface-hover"><span className="font-semibold">{p.full_name}</span> <span className="text-xs text-ink-muted inline-flex items-center gap-1"><Star className="w-3 h-3" />{p.stars.toLocaleString()}</span><span className="block text-xs text-ink-muted">{p.description}</span></a>)}
          </section>
          <section className="space-y-2"><h2 className="text-sm font-bold">People ({r.users.length})</h2>
            {r.users.map((u) => <Link key={u.id} to={`/profile/${u.id}`} className="flex items-center gap-2 p-3 rounded-[8px] border border-border bg-surface hover:bg-surface-hover"><AuthorAvatar name={u.name} avatarUrl={u.avatar_url} size="xs" /><span className="font-semibold">{u.name}</span><span className="text-xs text-ink-muted truncate">{u.bio}</span></Link>)}
          </section>
        </div>
      )}
    </Page>
  );
}

// ---------- Trending discussions ----------
export function DiscussionsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['discussions'], queryFn: () => api.get('/discussions') });
  const rows = data?.data?.discussions || [];
  return (
    <Page title="Trending Discussions" intro="Ideas with the most recent comments first. Please follow the reviewer guidelines.">
      <p className="text-xs text-ink-muted"><Link to="/about#guidelines" className="text-accent-strong hover:underline">Reviewer guidelines</Link></p>
      {isLoading ? null : rows.length === 0 ? <Empty>No discussions yet.</Empty> : (
        <ul className="space-y-2">
          {rows.map((d) => (
            <li key={d.id}>
              <Link to={`/ideas/${d.id}?tab=comments`} className="block p-4 rounded-[12px] border border-border bg-surface hover:bg-surface-hover">
                <span className="font-semibold text-ink">{d.title}</span>
                <span className="block text-xs text-ink-muted mt-0.5 inline-flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {d.comments} comments · last {formatRelativeTime(d.last_activity)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

// ---------- Unsubscribe ----------
export function UnsubscribePage() {
  const [params] = useSearchParams();
  const [state, setState] = useState('working');
  useEffect(() => {
    api.post(`/unsubscribe?token=${encodeURIComponent(params.get('token') || '')}`)
      .then(() => setState('done')).catch(() => setState('error'));
  }, []);
  return (
    <Page title="Weekly email">
      <p className="text-sm">{state === 'working' ? 'Unsubscribing…' : state === 'done' ? 'You are unsubscribed. You will not get the weekly email any more.' : 'This link is not valid. It may have been used already.'}</p>
    </Page>
  );
}

export { Page, Empty };
