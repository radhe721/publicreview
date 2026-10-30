import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AuthorAvatar } from '@/components/ui/author-avatar';
import { IdeaRowSkeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Github,
  Star,
  GitFork,
  ArrowBigUp,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';

const PAGE_SIZE = 20;

const SORT_OPTIONS = [
  { value: 'top', label: 'Top' },
  { value: 'newest', label: 'Newest' },
];

const NOTE_MAX = 280;

function formatCount(n) {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
}

function ShareRepoForm({ onShared }) {
  const { isAuthenticated } = useAuth();
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isAuthenticated) {
    return (
      <section className="p-5 rounded-[12px] border border-border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-ink">Found a great repo?</h2>
          <p className="text-sm text-ink-muted mt-0.5">Sign in to share it with the community.</p>
        </div>
        <Link to="/login">
          <Button size="sm" className="px-4">Sign in to share</Button>
        </Link>
      </section>
    );
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!url.trim()) {
      setError('Paste a GitHub repository link.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await api.post('/repos', { url: url.trim(), note: note.trim() || null });
      toast.success(`Shared ${res.data.repo.full_name}`);
      setUrl('');
      setNote('');
      onShared();
    } catch (err) {
      // Validation errors arrive as "field: reason"; show the reason rather than "Validation failed".
      const detail = err.details?.[0]?.replace(/^[\w.]+:\s*/, '');
      setError(detail || err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section aria-labelledby="share-repo-heading" className="p-5 rounded-[12px] border border-border bg-surface space-y-3">
      <h2 id="share-repo-heading" className="text-base font-bold text-ink flex items-center gap-2">
        <Github className="w-4 h-4" /> Share a GitHub repo
      </h2>
      <form onSubmit={onSubmit} noValidate className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="repo-url" className="text-xs font-bold uppercase tracking-wider text-ink block">
            Repository link <span className="text-danger">*</span>
          </label>
          <Input
            id="repo-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            hasError={!!error}
            maxLength={300}
            autoComplete="off"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="repo-note" className="text-xs font-bold uppercase tracking-wider text-ink block">
            Why is it worth a look? <span className="font-normal normal-case text-ink-muted">(optional)</span>
          </label>
          <Textarea
            id="repo-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Replaced three paid tools for me. Setup takes 5 minutes."
            maxLength={NOTE_MAX}
            className="min-h-[72px]"
          />
          <p className="text-[11px] text-ink-faint text-right tabular-nums">{note.length}/{NOTE_MAX}</p>
        </div>

        {error && <p role="alert" className="text-xs text-danger">{error}</p>}

        <Button type="submit" isLoading={isSubmitting} className="px-6">
          Share repo
        </Button>
      </form>
    </section>
  );
}

function RepoRow({ repo, onChanged }) {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [upvotes, setUpvotes] = useState(repo.upvotes);
  const [hasUpvoted, setHasUpvoted] = useState(repo.has_upvoted);
  const [isVoting, setIsVoting] = useState(false);

  useEffect(() => {
    setUpvotes(repo.upvotes);
    setHasUpvoted(repo.has_upvoted);
  }, [repo.upvotes, repo.has_upvoted]);

  const canRemove = isAuthenticated && (isAdmin || user?.id === repo.shared_by.id);

  const toggleUpvote = async () => {
    if (!isAuthenticated) {
      toast.error('Sign in to upvote repos');
      return;
    }
    const next = !hasUpvoted;
    setHasUpvoted(next);
    setUpvotes((n) => n + (next ? 1 : -1));
    setIsVoting(true);
    try {
      const res = next
        ? await api.post(`/repos/${repo.id}/upvote`)
        : await api.delete(`/repos/${repo.id}/upvote`);
      setUpvotes(res.data.repo.upvotes);
      setHasUpvoted(res.data.repo.has_upvoted);
    } catch (err) {
      setHasUpvoted(!next);
      setUpvotes((n) => n - (next ? 1 : -1));
      toast.error(err.message || 'Could not save your vote');
    } finally {
      setIsVoting(false);
    }
  };

  const handleRemove = async () => {
    try {
      await api.delete(`/repos/${repo.id}`);
      toast.success(`Removed ${repo.full_name}`);
      onChanged();
    } catch (err) {
      toast.error(err.message || 'Could not remove this repo');
    }
  };

  return (
    <article className="flex gap-3.5 sm:gap-4 p-3 sm:p-4 rounded-[12px] border border-border bg-surface">
      {repo.owner_avatar ? (
        <img
          src={repo.owner_avatar}
          alt=""
          loading="lazy"
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-[10px] shrink-0 bg-surface-muted object-cover"
        />
      ) : (
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-[10px] shrink-0 bg-surface-muted flex items-center justify-center text-ink-muted">
          <Github className="w-5 h-5" />
        </div>
      )}

      <div className="flex-1 min-w-0 space-y-1.5">
        <h2 className="text-sm sm:text-base font-bold text-ink break-words">
          <a
            href={repo.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent-strong inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded-[4px]"
          >
            {repo.full_name}
            <ExternalLink className="w-3.5 h-3.5 text-ink-faint shrink-0" aria-hidden="true" />
          </a>
        </h2>

        {repo.description && (
          <p className="text-sm text-ink-muted line-clamp-2">{repo.description}</p>
        )}

        {repo.note && (
          <blockquote className="text-sm text-ink border-l-2 border-accent-strong pl-3 py-0.5">
            {repo.note}
          </blockquote>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
          {repo.language && <span className="font-medium text-ink">{repo.language}</span>}
          <span className="inline-flex items-center gap-1 tabular-nums" title={`${repo.stars.toLocaleString()} stars`}>
            <Star className="w-3.5 h-3.5" /> {formatCount(repo.stars)}
          </span>
          <span className="inline-flex items-center gap-1 tabular-nums" title={`${repo.forks.toLocaleString()} forks`}>
            <GitFork className="w-3.5 h-3.5" /> {formatCount(repo.forks)}
          </span>
          {repo.topics.slice(0, 4).map((topic) => (
            <span key={topic} className="px-2 py-0.5 rounded-full bg-surface-muted text-[11px]">
              {topic}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-ink-muted pt-0.5">
          <Link to={`/profile/${repo.shared_by.id}`} className="inline-flex items-center gap-1.5 hover:text-ink">
            <AuthorAvatar name={repo.shared_by.name} avatarUrl={repo.shared_by.avatar_url} size="xs" />
            <span className="font-medium">{repo.shared_by.name}</span>
          </Link>
          <span aria-hidden="true">·</span>
          <span>{formatRelativeTime(repo.created_at)}</span>
          {canRemove && (
            <>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={handleRemove}
                className="inline-flex items-center gap-1 text-ink-muted hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded-[4px]"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </button>
            </>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={toggleUpvote}
        disabled={isVoting}
        aria-pressed={hasUpvoted}
        aria-label={`${hasUpvoted ? 'Remove upvote from' : 'Upvote'} ${repo.full_name}`}
        className={cn(
          'w-12 h-14 sm:w-14 shrink-0 self-start rounded-[10px] border flex flex-col items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
          hasUpvoted
            ? 'bg-accent-soft border-accent-strong text-accent-strong'
            : 'bg-surface border-border text-ink-muted hover:text-ink hover:border-border-strong hover:bg-surface-hover'
        )}
      >
        <ArrowBigUp className={cn('w-5 h-5', hasUpvoted && 'fill-current')} />
        <span className="text-xs font-bold tabular-nums">{upvotes}</span>
      </button>
    </article>
  );
}

export function ReposPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const currentSort = searchParams.get('sort') === 'newest' ? 'newest' : 'top';
  const currentPage = Number(searchParams.get('page') || 1);
  const currentSearch = searchParams.get('search') || '';

  const [searchInput, setSearchInput] = useState(currentSearch);

  useEffect(() => {
    setSearchInput(currentSearch);
  }, [currentSearch]);

  const updateParam = (key, value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    if (key !== 'page') newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    updateParam('search', searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput('');
    updateParam('search', '');
  };

  const { data, isLoading } = useQuery({
    queryKey: ['repos', currentSort, currentPage, currentSearch],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(PAGE_SIZE),
        sort: currentSort,
      });
      if (currentSearch) params.set('search', currentSearch);
      return api.get(`/repos?${params.toString()}`);
    },
  });

  const repos = data?.data?.repos || [];
  const pagination = data?.data?.pagination || { total: 0, totalPages: 1 };

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['repos'] });

  return (
    <div className="min-h-screen bg-bg text-ink py-8 sm:py-12">
      <main className="max-w-[860px] mx-auto px-4 sm:px-6 space-y-6">
        <div className="space-y-1 border-b border-border pb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                GitHub Repos
              </h1>
              <p className="text-sm text-ink-muted mt-1">
                Useful open-source projects shared and upvoted by the community.
              </p>
            </div>

            <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72">
              <label htmlFor="repo-search-input" className="sr-only">
                Search repos
              </label>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
              <Input
                id="repo-search-input"
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search repos, topics, languages..."
                className="pl-9 pr-9 rounded-[8px] h-10 text-xs bg-surface border-border-strong text-ink placeholder:text-ink-faint focus:border-accent-strong"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink p-1 rounded-[4px]"
                  aria-label="Clear search query"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>
          </div>
        </div>

        <ShareRepoForm onShared={refresh} />

        <div className="flex items-center justify-between gap-3 pb-2 border-b border-border">
          <p className="text-xs text-ink-muted">
            <span className="font-bold text-ink tabular-nums">{pagination.total}</span> repos shared
          </p>
          <div className="inline-flex p-1 rounded-[8px] border border-border bg-surface text-xs font-semibold shrink-0">
            {SORT_OPTIONS.map((s) => {
              const isSelected = currentSort === s.value;
              return (
                <button
                  key={s.value}
                  onClick={() => updateParam('sort', s.value)}
                  className={cn(
                    'px-3 py-1 rounded-[6px] transition-colors',
                    isSelected
                      ? 'bg-accent-strong text-accent-ink font-bold'
                      : 'text-ink-muted hover:text-ink hover:bg-surface-hover'
                  )}
                  aria-pressed={isSelected}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2.5">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <IdeaRowSkeleton key={i} />)
          ) : repos.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-border rounded-[12px] bg-surface p-8 space-y-4">
              <div className="w-12 h-12 rounded-full bg-surface-muted text-ink-muted mx-auto flex items-center justify-center">
                <Github className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-ink">No repos found</h2>
                <p className="text-sm text-ink-muted mt-1 max-w-sm mx-auto leading-relaxed">
                  {currentSearch
                    ? `No repos match "${currentSearch}".`
                    : 'Nobody has shared a repo yet. Be the first!'}
                </p>
              </div>
              {currentSearch && (
                <div className="pt-2 flex justify-center">
                  <Button variant="secondary" size="sm" onClick={handleClearSearch} className="rounded-[8px] text-xs">
                    Clear search
                  </Button>
                </div>
              )}
            </div>
          ) : (
            repos.map((repo) => <RepoRow key={repo.id} repo={repo} onChanged={refresh} />)
          )}
        </div>

        {pagination.totalPages > 1 && (
          <div className="pt-6 border-t border-border flex items-center justify-between text-xs">
            <p className="text-ink-muted">
              Showing page <span className="font-bold text-ink">{currentPage}</span> of{' '}
              <span className="font-bold text-ink">{pagination.totalPages}</span>
            </p>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => updateParam('page', String(currentPage - 1))}
                className="rounded-[8px] h-9 px-3 gap-1 text-xs"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={currentPage >= pagination.totalPages}
                onClick={() => updateParam('page', String(currentPage + 1))}
                className="rounded-[8px] h-9 px-3 gap-1 text-xs"
              >
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
