import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/api/client';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';

const CATEGORIES = ['Tech', 'Business', 'Design', 'Social', 'Education', 'Other'];

function Stat({ label, value }) {
  return (
    <div className="p-3 rounded-[8px] border border-border bg-surface">
      <p className="text-[11px] uppercase tracking-wider text-ink-muted font-semibold">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

const th = 'text-left p-2 font-semibold text-ink-muted';
const td = 'p-2 align-top';

export function AdminOverview() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-overview'], queryFn: () => api.get('/admin/overview') });
  const o = data?.data;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-overview'] });

  const run = async (fn, ok) => {
    try { await fn(); toast.success(ok); refresh(); } catch (err) { toast.error(err.message); }
  };

  if (isLoading || !o) return <p className="text-xs text-ink-muted">Loading dashboard…</p>;
  const c = o.counts;

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Published ideas" value={c.ideas} />
        <Stat label="Users" value={c.users} />
        <Stat label="Active raters (30d)" value={c.active_raters} />
        <Stat label="Demand votes" value={c.demand_votes} />
        <Stat label="Email subscribers" value={c.subscribers} />
        <Stat label="Repos" value={c.repos} />
        <Stat label="Paid purchases" value={c.paid_purchases} />
        <Stat label="Revenue" value={`$${(c.revenue_cents / 100).toFixed(0)}`} />
      </section>

      <section className="space-y-2 overflow-x-auto">
        <h2 className="text-base font-bold">Newest ideas</h2>
        <table className="w-full text-xs border border-border rounded-[8px]">
          <thead className="bg-surface-muted"><tr><th className={th}>Idea</th><th className={th}>Status</th><th className={th}>Category</th><th className={th}>Actions</th></tr></thead>
          <tbody>
            {o.ideas.map((i) => (
              <tr key={i.id} className="border-t border-border">
                <td className={td}>
                  <Link to={`/ideas/${i.id}`} className="font-semibold hover:underline">{i.title}</Link>
                  <div className="text-ink-faint">{i.is_team_seed ? 'Team seed' : i.author_name} · {formatRelativeTime(i.created_at)}</div>
                </td>
                <td className={td}>{i.status}</td>
                <td className={td}>
                  <select aria-label={`Category of ${i.title}`} value={i.category} className="h-8 px-1 rounded border border-border bg-bg"
                    onChange={(e) => run(() => api.patch(`/admin/ideas/${i.id}`, { category: e.target.value }), 'Category changed.')}>
                    {CATEGORIES.map((cat) => <option key={cat}>{cat}</option>)}
                  </select>
                </td>
                <td className={`${td} space-x-1 whitespace-nowrap`}>
                  {i.status === 'hidden'
                    ? <Button size="sm" variant="secondary" className="h-7" onClick={() => run(() => api.patch(`/admin/ideas/${i.id}`, { status: 'published' }), 'Restored.')}>Restore</Button>
                    : i.status === 'published' && <Button size="sm" variant="secondary" className="h-7" onClick={() => run(() => api.patch(`/admin/ideas/${i.id}`, { status: 'hidden' }), 'Hidden.')}>Hide</Button>}
                  {i.status === 'published' && <Button size="sm" variant="secondary" className="h-7" onClick={() => run(() => api.post('/admin/grant', { product: 'report', idea_id: i.id }), 'Free report started.')}>Free report</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-bold">Reported comments and repos ({o.content_reports.length})</h2>
        {o.content_reports.length === 0 ? <p className="text-xs text-ink-muted">Nothing to review.</p> : (
          <ul className="divide-y divide-border border border-border rounded-[8px] text-xs">
            {o.content_reports.map((r) => (
              <li key={r.id} className="p-2 flex flex-wrap items-center justify-between gap-2">
                <span>{r.target_type} #{r.target_id}: "{r.reason}" by {r.reporter}</span>
                <span className="space-x-1">
                  <Button size="sm" variant="danger" className="h-7" onClick={() => run(async () => { await api.patch(`/admin/hide/${r.target_type}/${r.target_id}`, { hidden: true }); await api.patch(`/admin/content-reports/${r.id}`, { status: 'resolved' }); }, 'Hidden.')}>Hide</Button>
                  <Button size="sm" variant="secondary" className="h-7" onClick={() => run(() => api.patch(`/admin/hide/${r.target_type}/${r.target_id}`, { hidden: false }), 'Kept and reports dismissed.')}>Keep</Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2 overflow-x-auto">
        <h2 className="text-base font-bold">Newest users</h2>
        <table className="w-full text-xs border border-border rounded-[8px]">
          <thead className="bg-surface-muted"><tr><th className={th}>User</th><th className={th}>Role</th><th className={th}>Reputation</th><th className={th}>Plan</th></tr></thead>
          <tbody>
            {o.users.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className={td}><Link to={`/profile/${u.id}`} className="font-semibold hover:underline">{u.name}</Link><div className="text-ink-faint">{u.email}</div></td>
                <td className={td}>{u.role_tag || '—'}</td>
                <td className={td}>{u.reputation}</td>
                <td className={td}>{Number(u.is_pro) ? 'Pro' : (
                  <Button size="sm" variant="secondary" className="h-7" onClick={() => run(() => api.post('/admin/grant', { product: 'pro', user_id: u.id }), 'Granted 1 month of Pro.')}>Grant Pro</Button>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="space-y-2 overflow-x-auto">
        <h2 className="text-base font-bold">Payments</h2>
        {o.purchases.length === 0 ? <p className="text-xs text-ink-muted">No purchases yet.</p> : (
          <table className="w-full text-xs border border-border rounded-[8px]">
            <thead className="bg-surface-muted"><tr><th className={th}>When</th><th className={th}>Product</th><th className={th}>Status</th><th className={th}>Amount</th><th className={th}>User</th></tr></thead>
            <tbody>
              {o.purchases.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className={td}>{formatRelativeTime(p.created_at)}</td>
                  <td className={td}>{p.product}{p.idea_id ? <> · <Link to={`/ideas/${p.idea_id}`} className="underline">idea</Link></> : null}</td>
                  <td className={td}>{p.status}</td>
                  <td className={td}>${(p.amount_cents / 100).toFixed(2)}</td>
                  <td className={td}>{p.user_email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="space-y-2 text-xs">
        <h2 className="text-base font-bold">Newest repos</h2>
        <ul className="divide-y divide-border border border-border rounded-[8px]">
          {o.repos.map((r) => (
            <li key={r.id} className="p-2 flex items-center justify-between gap-2">
              <span>{r.full_name} <span className="text-ink-faint">by {r.shared_by}</span></span>
              <Button size="sm" variant="secondary" className="h-7" onClick={() => run(() => api.patch(`/admin/hide/repo/${r.id}`, { hidden: !Number(r.hidden) }), Number(r.hidden) ? 'Restored.' : 'Hidden.')}>
                {Number(r.hidden) ? 'Restore' : 'Hide'}
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
