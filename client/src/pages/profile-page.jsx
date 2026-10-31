import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ROLE_LABELS } from '@/components/demand-signal-panel';
import { toast } from 'sonner';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { IdeaRow } from '@/components/idea-row';
import { CategoryBadge } from '@/components/category-badge';
import { AuthorAvatar } from '@/components/ui/author-avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatRelativeTime, cn } from '@/lib/utils';
import { ExternalLink, FileText, Star, MessageSquare, BadgeCheck, Award } from 'lucide-react';
import { mrrText, MRR_LABELS } from '@/components/idea-panels';

const ROLE_OPTIONS = ['founder', 'freelancer', 'developer', 'agency_owner', 'marketer', 'designer', 'operator', 'student', 'other'];

// Singular label for a role tag ("Freelancers" -> "Freelancer").
function roleName(tag) {
  const label = ROLE_LABELS[tag] || tag;
  return label.endsWith('s') && tag !== 'other' ? label.slice(0, -1) : label;
}

function ProfileEditor({ user, onSaved }) {
  const [roleTag, setRoleTag] = useState(user.role_tag || '');
  const [bio, setBio] = useState(user.bio || '');
  const [industry, setIndustry] = useState(user.industry || '');
  const [country, setCountry] = useState(user.country || '');
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/users/me', { role_tag: roleTag || null, bio: bio.trim() || null, industry: industry.trim() || null, country: country.trim() || null });
      toast.success('Profile saved.');
      onSaved();
    } catch (err) {
      toast.error(err.message || 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="pt-6 border-t border-border space-y-3 text-left">
      <p className="text-xs text-ink-muted">
        Your role shows founders who voted (for example "3 of 5 freelancers would pay"). Votes from accounts with a role or bio count fully in rankings.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label htmlFor="profile-role" className="text-xs font-bold uppercase tracking-wider text-ink block">Your role</label>
          <select
            id="profile-role"
            value={roleTag}
            onChange={(e) => setRoleTag(e.target.value)}
            className="w-full h-10 px-3 rounded-[8px] border border-border bg-bg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus-ring"
          >
            <option value="">Choose a role</option>
            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{roleName(r)}</option>)}
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <label htmlFor="profile-bio" className="text-xs font-bold uppercase tracking-wider text-ink block">Bio</label>
          <input
            id="profile-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={250}
            placeholder="What you do, in one line"
            className="w-full h-10 px-3 rounded-[8px] border border-border bg-bg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus-ring"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="profile-industry" className="text-xs font-bold uppercase tracking-wider text-ink block">Industry</label>
          <input id="profile-industry" value={industry} onChange={(e) => setIndustry(e.target.value)} maxLength={60} placeholder="e.g. Fintech"
            className="w-full h-10 px-3 rounded-[8px] border border-border bg-bg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus-ring" />
        </div>
        <div className="space-y-1">
          <label htmlFor="profile-country" className="text-xs font-bold uppercase tracking-wider text-ink block">Country</label>
          <input id="profile-country" value={country} onChange={(e) => setCountry(e.target.value)} maxLength={60} placeholder="e.g. India"
            className="w-full h-10 px-3 rounded-[8px] border border-border bg-bg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus-ring" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" isLoading={saving} className="rounded-[8px]">Save profile</Button>
        <Link to="/notifications" className="text-xs text-accent-strong hover:underline">Notification settings</Link>
      </div>
    </form>
  );
}

export function ProfilePage() {
  const { id } = useParams();
  const { user: currentUser, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('ideas');

  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ['user-profile', id],
    queryFn: () => api.get(`/users/${id}`),
  });

  const { data: ideasData, isLoading: ideasLoading } = useQuery({
    queryKey: ['user-ideas', id],
    queryFn: () => api.get(`/users/${id}/ideas`),
  });

  const { data: ratingsData, isLoading: ratingsLoading } = useQuery({
    queryKey: ['user-ratings', id],
    queryFn: () => api.get(`/users/${id}/ratings`),
  });

  const { data: repData } = useQuery({ queryKey: ['user-rep', id], queryFn: () => api.get(`/users/${id}/reputation`) });
  const { data: reposData } = useQuery({ queryKey: ['user-repos', id], queryFn: () => api.get(`/users/${id}/repos`) });
  const { data: launchData } = useQuery({ queryKey: ['user-launches', id], queryFn: () => api.get(`/users/${id}/launches`) });
  const { data: draftData } = useQuery({
    queryKey: ['my-drafts'],
    queryFn: () => api.get('/ideas/drafts/mine'),
    enabled: Boolean(currentUser && String(currentUser.id) === String(id)),
  });
  const rep = repData?.data;
  const sharedRepos = reposData?.data?.repos || [];
  const launches = launchData?.data?.launches || [];
  const drafts = draftData?.data?.ideas || [];
  const user = profileData?.data?.user;
  const ideas = ideasData?.data?.ideas || [];
  const ratings = ratingsData?.data?.ratings || [];

  const isOwnProfile = currentUser && user && currentUser.id === user.id;

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-bg text-ink py-12">
        <div className="max-w-[860px] mx-auto px-4 sm:px-6 space-y-6">
          <Skeleton className="h-40 w-full rounded-[12px]" />
          <Skeleton className="h-48 w-full rounded-[12px]" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-bg text-ink py-20">
        <div className="max-w-md mx-auto px-4 text-center space-y-3">
          <h1 className="text-xl font-bold text-ink">User profile not found</h1>
          <p className="text-xs text-ink-muted">
            This account does not exist or has been removed.
          </p>
          <Link to="/feed">
            <Button variant="secondary" size="sm" className="rounded-[8px]">
              Browse community ideas
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const ideasPosted = user.stats?.ideas_count || ideas.length || 0;
  const ratingsGiven = user.stats?.ratings_given_count || ratings.length || 0;
  const avgReceived = user.stats?.avg_received_score ? Number(user.stats.avg_received_score).toFixed(1) : '—';

  return (
    <div className="min-h-screen bg-bg text-ink py-8 sm:py-12">
      <main className="max-w-[860px] mx-auto px-4 sm:px-6 space-y-8">
        {/* Profile Card Header */}
        <div className="border border-border bg-surface p-6 sm:p-8 rounded-[12px] space-y-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
            <AuthorAvatar name={user.name} avatarUrl={user.avatar_url} size="xl" />

            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-ink leading-tight">
                    {user.name}
                  </h1>
                  {user.email && (
                    <p className="text-xs text-ink-muted mt-0.5">{user.email}</p>
                  )}
                </div>

                {user.role === 'admin' && (
                  <span className="self-center sm:self-start text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-accent text-accent-strong bg-accent-soft">
                    Platform Admin
                  </span>
                )}
              </div>

              <p className="text-sm text-ink-muted max-w-xl leading-relaxed">
                {user.bio || 'Product builder and reviewer in the BusinessListe community.'}
              </p>

              <p className="text-xs text-ink-faint pt-1">
                {user.role_tag && <span className="font-semibold text-ink-muted">{roleName(user.role_tag)} · </span>}
                Member since {formatDate(user.created_at)}
                {user.country && <span> · {user.country}</span>}
                {user.industry && <span> · {user.industry}</span>}
              </p>
              {rep && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] font-semibold">
                  <span className="px-2 py-0.5 rounded-full bg-accent-soft text-accent-strong inline-flex items-center gap-1">
                    <Award className="w-3 h-3" /> {rep.level.label} · {rep.reputation} pts
                  </span>
                  {rep.verified_revenue && (
                    <span className="px-2 py-0.5 rounded-full bg-success-soft text-success inline-flex items-center gap-1">
                      <BadgeCheck className="w-3 h-3" /> Verified revenue
                    </span>
                  )}
                  {rep.badges.map((b) => (
                    <span key={b.id} className="px-2 py-0.5 rounded-full bg-surface-muted border border-border text-ink">{b.label}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {isOwnProfile && (
            <ProfileEditor
              user={user}
              onSaved={() => {
                queryClient.invalidateQueries(['user-profile', id]);
                refreshUser?.();
              }}
            />
          )}

          {/* Quiet Stat Row: Ideas posted, average score received, ratings given */}
          <div className="pt-6 border-t border-border grid grid-cols-3 gap-4 text-center sm:text-left">
            <div className="p-3.5 bg-surface-muted rounded-[8px] border border-border">
              <span className="text-xs text-ink-muted uppercase tracking-wider block font-medium">
                Ideas posted
              </span>
              <span className="text-2xl font-bold text-ink tabular-nums">
                {ideasPosted}
              </span>
            </div>

            <div className="p-3.5 bg-surface-muted rounded-[8px] border border-border">
              <span className="text-xs text-ink-muted uppercase tracking-wider block font-medium">
                Average score received
              </span>
              <span className="text-2xl font-bold text-ink tabular-nums">
                {avgReceived !== '—' ? `${avgReceived} ★` : '—'}
              </span>
            </div>

            <div className="p-3.5 bg-surface-muted rounded-[8px] border border-border">
              <span className="text-xs text-ink-muted uppercase tracking-wider block font-medium">
                Ratings given
              </span>
              <span className="text-2xl font-bold text-ink tabular-nums">
                {ratingsGiven}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation: Ideas, Ratings, Comments */}
        <div role="tablist" aria-label="Profile tabs" className="flex items-center gap-6 border-b border-border text-sm font-semibold">
          {[
            { id: 'ideas', label: `Ideas (${ideas.length})` },
            { id: 'ratings', label: `Ratings (${ratings.length})` },
            { id: 'repos', label: `Repos shared (${sharedRepos.length})` },
            { id: 'launches', label: `Launched (${launches.length})` },
            ...(isOwnProfile ? [{ id: 'drafts', label: `Drafts (${drafts.length})` }] : []),
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'pb-3 border-b-2 transition-colors -mb-px focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring',
                  isActive
                    ? 'border-accent-strong text-ink font-bold'
                    : 'border-surface text-ink-muted hover:text-ink'
                )}
                aria-selected={isActive}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content: Ideas */}
        {activeTab === 'ideas' && (
          <div className="space-y-3">
            {ideasLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-[12px]" />)
            ) : ideas.length === 0 ? (
              <div className="text-center py-14 border border-dashed border-border rounded-[12px] bg-surface p-6 space-y-3">
                <div className="w-10 h-10 rounded-full bg-surface-muted text-ink-muted mx-auto flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <h2 className="font-bold text-base text-ink">No ideas posted yet</h2>
                <p className="text-xs text-ink-muted max-w-sm mx-auto">
                  Post a product concept to gather honest ratings and critical feedback.
                </p>
                {isOwnProfile && (
                  <div className="pt-2">
                    <Link to="/submit">
                      <Button size="sm" className="rounded-[8px] text-xs px-4">
                        Post an idea
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                {ideas.map((idea) => (
                  <IdeaRow
                    key={idea.id}
                    idea={{
                      ...idea,
                      author: {
                        id: user.id,
                        name: user.name,
                        avatar_url: user.avatar_url,
                      },
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Ratings */}
        {activeTab === 'ratings' && (
          <div className="space-y-3">
            {ratingsLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-[12px]" />)
            ) : ratings.length === 0 ? (
              <div className="text-center py-14 border border-dashed border-border rounded-[12px] bg-surface p-6 space-y-2">
                <div className="w-10 h-10 rounded-full bg-surface-muted text-ink-muted mx-auto flex items-center justify-center">
                  <Star className="w-5 h-5" />
                </div>
                <h2 className="font-bold text-base text-ink">No ratings given yet</h2>
                <p className="text-xs text-ink-muted max-w-sm mx-auto">
                  This user has not recorded any evaluations on community ideas yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {ratings.map((r) => (
                  <div
                    key={r.id}
                    className="p-4 sm:p-5 rounded-[12px] border border-border bg-surface space-y-2 text-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="flex items-center gap-2.5">
                        <CategoryBadge category={r.idea?.category} />
                        <Link
                          to={`/ideas/${r.idea?.id}`}
                          className="font-bold text-sm text-ink hover:text-accent-strong transition-colors inline-flex items-center gap-1"
                        >
                          {r.idea?.title} <ExternalLink className="w-3 h-3 text-ink-muted" />
                        </Link>
                      </div>

                      <div className="flex items-center gap-2 text-ink-muted">
                        <span className="font-bold text-accent-strong tabular-nums text-xs">
                          {r.score} / 5 ★
                        </span>
                        <span>•</span>
                        <span className="tabular-nums">{formatRelativeTime(r.created_at)}</span>
                      </div>
                    </div>

                    {r.review_text && (
                      <p className="p-3 rounded-[8px] bg-surface-muted text-ink italic leading-relaxed">
                        "{r.review_text}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Comments */}
        {activeTab === 'repos' && (
          sharedRepos.length === 0 ? <p className="p-8 text-center border border-dashed border-border rounded-[12px] bg-surface text-sm text-ink-muted">No repos shared yet.</p> : (
            <ul className="space-y-2">
              {sharedRepos.map((r) => (
                <li key={r.id} className="p-3 rounded-[12px] border border-border bg-surface text-sm">
                  <a href={r.html_url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-accent-strong">{r.full_name}</a>
                  <span className="text-xs text-ink-muted"> · {r.stars.toLocaleString()} stars{r.license ? ` · ${r.license}` : ''}</span>
                  {r.description && <p className="text-xs text-ink-muted line-clamp-1">{r.description}</p>}
                </li>
              ))}
            </ul>
          )
        )}
        {activeTab === 'launches' && (
          launches.length === 0 ? <p className="p-8 text-center border border-dashed border-border rounded-[12px] bg-surface text-sm text-ink-muted">No launched products yet.</p> : (
            <ul className="space-y-2">
              {launches.map((l) => (
                <li key={l.id} className="p-3 rounded-[12px] border border-border bg-surface text-sm flex items-center justify-between gap-3">
                  <Link to={`/ideas/${l.id}`} className="font-semibold hover:text-accent-strong">{l.title}</Link>
                  <span className="text-xs font-semibold inline-flex items-center gap-1">
                    {MRR_LABELS[l.mrr_range] || 'Revenue not shared'}
                    {l.verified && <BadgeCheck className="w-3.5 h-3.5 text-success" aria-label="Verified" />}
                  </span>
                </li>
              ))}
            </ul>
          )
        )}
        {activeTab === 'drafts' && isOwnProfile && (
          drafts.length === 0 ? <p className="p-8 text-center border border-dashed border-border rounded-[12px] bg-surface text-sm text-ink-muted">No drafts. Drafts are private until you publish them.</p> : (
            <ul className="space-y-2">
              {drafts.map((d) => (
                <li key={d.id} className="p-3 rounded-[12px] border border-border bg-surface text-sm flex items-center justify-between gap-3">
                  <span className="font-semibold">{d.title}</span>
                  <Link to={`/ideas/${d.id}/edit`} className="text-xs text-accent-strong font-semibold hover:underline">Edit and publish</Link>
                </li>
              ))}
            </ul>
          )
        )}
      </main>
    </div>
  );
}
