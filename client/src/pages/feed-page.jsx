import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import { IdeaRow } from '@/components/idea-row';
import { IdeaRowSkeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORIES = ['All', 'Tech', 'Business', 'Design', 'Social', 'Education', 'Other'];

const SORT_OPTIONS = [
  { value: 'top', label: 'Top' },
  { value: 'newest', label: 'Newest' },
  { value: 'would_pay', label: 'Most would-pay' },
  { value: 'needs_votes', label: 'Needs votes' },
  { value: 'most_discussed', label: 'Most discussed' },
];

export function FeedPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const currentCategory = searchParams.get('category') || 'All';
  const currentSort = searchParams.get('sort') || 'top';
  const currentPage = Number(searchParams.get('page') || 1);
  const currentSearch = searchParams.get('search') || '';

  const [searchInput, setSearchInput] = useState(currentSearch);
  const [focusedRowIndex, setFocusedRowIndex] = useState(-1);

  useEffect(() => {
    setSearchInput(currentSearch);
  }, [currentSearch]);

  const updateParam = (key, value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value && value !== 'All' && value !== '') {
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
    queryKey: ['ideas-feed', currentCategory, currentSort, currentPage, currentSearch],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: '15',
        sort: currentSort,
      });
      if (currentCategory !== 'All') params.set('category', currentCategory);
      if (currentSearch) params.set('search', currentSearch);
      return api.get(`/ideas?${params.toString()}`);
    },
    keepPreviousData: true,
  });

  const ideas = data?.data?.ideas || [];
  const pagination = data?.data?.pagination || { total: 0, totalPages: 1 };

  // Keyboard navigation for rows
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedRowIndex((prev) => Math.min(prev + 1, ideas.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedRowIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && focusedRowIndex >= 0 && ideas[focusedRowIndex]) {
        e.preventDefault();
        navigate(`/ideas/${ideas[focusedRowIndex].id}`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ideas, focusedRowIndex, navigate]);

  return (
    <div className="min-h-screen bg-bg text-ink py-8 sm:py-12">
      {/* Centered Main Content Column: Max 860px */}
      <main className="max-w-[860px] mx-auto px-4 sm:px-6 space-y-6">
        {/* Page Title & Muted Helper Line */}
        <div className="space-y-1 border-b border-border pb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                Community Ideas
              </h1>
              <p className="text-sm text-ink-muted mt-1">
                Explore, vote, and stress-test raw product concepts ranked by the community.
              </p>
            </div>

            {/* Search Input with "/" shortcut */}
            <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72">
              <label htmlFor="feed-search-input" className="sr-only">
                Search ideas
              </label>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
              <Input
                id="feed-search-input"
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search ideas or tags..."
                className="pl-9 pr-12 rounded-[8px] h-10 text-xs bg-surface border-border-strong text-ink placeholder:text-ink-faint focus:border-accent-strong"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {searchInput ? (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="text-ink-muted hover:text-ink p-1 rounded-[4px]"
                    aria-label="Clear search query"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-ink-muted bg-surface-muted border border-border rounded-[4px]">
                    /
                  </kbd>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Toolbar: Category Pills & Sort Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pb-2 border-b border-border">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 sm:pb-0 scrollbar-none text-xs font-medium -mx-4 px-4 sm:mx-0 sm:px-0">
            {CATEGORIES.map((cat) => {
              const isSelected = currentCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => updateParam('category', cat)}
                  className={cn(
                    'px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap min-h-[32px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                    isSelected
                      ? 'bg-ink text-surface border-ink font-bold'
                      : 'border-border bg-surface text-ink-muted hover:text-ink hover:border-border-strong hover:bg-surface-hover'
                  )}
                  aria-pressed={isSelected}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Sort Segments: Top, Newest, Most discussed */}
          <div className="inline-flex p-1 rounded-[8px] border border-border bg-surface text-xs font-semibold self-start sm:self-auto shrink-0">
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

        {/* Ideas Ranked List */}
        <div className="space-y-2.5">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <IdeaRowSkeleton key={i} />)
          ) : ideas.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-border rounded-[12px] bg-surface p-8 space-y-4">
              <div className="w-12 h-12 rounded-full bg-surface-muted text-ink-muted mx-auto flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-ink">
                  No ideas found
                </h2>
                <p className="text-sm text-ink-muted mt-1 max-w-sm mx-auto leading-relaxed">
                  {currentSearch
                    ? `No concepts match "${currentSearch}". Try resetting your filters.`
                    : 'No ideas have been posted in this category yet.'}
                </p>
              </div>
              <div className="pt-2 flex justify-center gap-3">
                {currentSearch && (
                  <Button variant="secondary" size="sm" onClick={handleClearSearch} className="rounded-[8px] text-xs">
                    Clear search
                  </Button>
                )}
                <Link to="/submit">
                  <Button size="sm" className="rounded-[8px] text-xs px-4">
                    Post an idea
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            ideas.map((idea, index) => {
              const rank = (currentPage - 1) * 15 + index + 1;
              return (
                <IdeaRow
                  key={idea.id}
                  idea={idea}
                  rank={rank}
                  showRank={currentSort === 'top'}
                  isFocused={focusedRowIndex === index}
                />
              );
            })
          )}
        </div>

        {/* Pagination */}
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
