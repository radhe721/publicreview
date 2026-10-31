import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { WaitlistCard } from '@/components/waitlist-card';
import api from '@/api/client';
import { IdeaRow } from '@/components/idea-row';
import { IdeaRowSkeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  ArrowRight,
  MessageSquare,
  Flame,
  Code,
  Palette,
  Users,
  GraduationCap,
  Briefcase,
  Layers,
  ChevronRight,
} from 'lucide-react';

const CATEGORIES_DATA = [
  {
    name: 'Tech',
    desc: 'Developer tools, offline architectures, and AI primitives',
    icon: Code,
  },
  {
    name: 'Design',
    desc: 'Accessible systems, token palettes, and typography playgrounds',
    icon: Palette,
  },
  {
    name: 'Social',
    desc: 'Civic tech, neighborhood swaps, and mutual aid networks',
    icon: Users,
  },
  {
    name: 'Education',
    desc: 'Micro-curricula, tactile STEM proofs, and audio learning',
    icon: GraduationCap,
  },
  {
    name: 'Business',
    desc: 'Micro-SaaS, billing shields, and automated workflows',
    icon: Briefcase,
  },
  {
    name: 'Other',
    desc: 'Hardware hacks, ergonomic layouts, and experimental tools',
    icon: Layers,
  },
];

export function LandingPage() {
  const navigate = useNavigate();
  const [focusedRowIndex, setFocusedRowIndex] = useState(-1);

  // Fresh ideas first while the site is small, so every new idea gets seen and voted on.
  const { data: freshData, isLoading: isFreshLoading } = useQuery({
    queryKey: ['home-fresh-ideas'],
    queryFn: () => api.get('/ideas?limit=10&sort=newest'),
  });

  // Top this week: only ideas with at least 5 ratings this week.
  const { data: weekData, isLoading: isWeekLoading } = useQuery({
    queryKey: ['home-week-top'],
    queryFn: () => api.get('/leaderboard?timeframe=week&limit=5'),
  });

  // Top this month, same rule.
  const { data: monthData, isLoading: isMonthLoading } = useQuery({
    queryKey: ['home-month-top'],
    queryFn: () => api.get('/leaderboard?timeframe=month&limit=5'),
  });

  const todayIdeas = freshData?.data?.ideas || [];
  const weekIdeas = weekData?.data?.leaderboard || [];
  const monthIdeas = monthData?.data?.leaderboard || [];

  // Trending discussions derived from highest comment count
  const trendingDiscussions = [...todayIdeas, ...weekIdeas]
    .filter((idea) => Number(idea.stats?.comments_count || 0) > 0)
    .slice(0, 4);

  // Fallback if low comments in current ideas
  const discussionsList = trendingDiscussions;

  // Keyboard navigation for ranked list
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedRowIndex((prev) => Math.min(prev + 1, todayIdeas.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedRowIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && focusedRowIndex >= 0 && todayIdeas[focusedRowIndex]) {
        e.preventDefault();
        navigate(`/ideas/${todayIdeas[focusedRowIndex].id}`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [todayIdeas, focusedRowIndex, navigate]);

  return (
    <div className="min-h-screen bg-bg text-ink py-8 sm:py-12">
      {/* Centered Main Content Column: Max 860px */}
      <main className="max-w-[860px] mx-auto px-4 sm:px-6 space-y-12">
        {/* Page Header */}
        <div className="space-y-3 border-b border-border pb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                Would people pay for it?
              </h1>
              <p className="text-sm sm:text-base text-ink-muted">
                Post your idea. Find out in 7 days if real people would pay for it.
              </p>
            </div>
            <Link to="/submit" className="shrink-0">
              <Button className="h-10 rounded-[8px] gap-1.5">
                <Sparkles className="w-4 h-4" /> Post an idea
              </Button>
            </Link>
          </div>
        </div>

        {/* Section 1: Fresh ideas (newest first) */}
        <section aria-labelledby="fresh-heading" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 id="fresh-heading" className="text-base font-bold text-ink">
                Fresh ideas
              </h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Newest first. Each one needs 5 ratings to enter the Top lists.
              </p>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-ink-faint font-medium">
              <kbd className="px-1.5 py-0.5 font-mono text-[11px] bg-surface border border-border rounded-[4px]">
                ↑↓
              </kbd>{' '}
              to navigate •{' '}
              <kbd className="px-1.5 py-0.5 font-mono text-[11px] bg-surface border border-border rounded-[4px]">
                R
              </kbd>{' '}
              to rate
            </span>
          </div>

          <div className="space-y-2.5">
            {isFreshLoading ? (
              Array.from({ length: 6 }).map((_, i) => <IdeaRowSkeleton key={i} />)
            ) : todayIdeas.length === 0 ? (
              <div className="p-8 text-center rounded-[12px] border border-dashed border-border bg-surface text-sm text-ink-muted">
                Be the first to post an idea and get real feedback.{' '}
                <Link to="/submit" className="text-accent-strong font-semibold hover:underline">
                  Post an idea
                </Link>
              </div>
            ) : (
              todayIdeas.map((idea, index) => (
                <IdeaRow
                  key={idea.id}
                  idea={idea}
                  isFocused={focusedRowIndex === index}
                  headingTag="h3"
                />
              ))
            )}
          </div>

          {todayIdeas.length > 0 && (
            <div className="pt-2 text-center">
              <Link to="/feed?sort=newest">
                <Button variant="secondary" size="default" className="w-full sm:w-auto px-6 h-11 text-sm font-semibold rounded-[8px]">
                  See all ideas <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </Link>
            </div>
          )}
        </section>

        {/* Section 3: Last Week's Top Ideas (5) */}
        <section aria-labelledby="week-heading" className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 id="week-heading" className="text-base font-bold text-ink">
                Top this week
              </h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Highest weighted score from ratings cast in the last 7 days (minimum 5 ratings)
              </p>
            </div>
            <Link
              to="/leaderboard?timeframe=week"
              className="text-xs font-semibold text-ink-muted hover:text-ink hover:underline inline-flex items-center gap-1"
            >
              See all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {isWeekLoading ? (
              Array.from({ length: 3 }).map((_, i) => <IdeaRowSkeleton key={i} />)
            ) : weekIdeas.length === 0 ? (
              <div className="p-6 text-center rounded-[12px] border border-dashed border-border bg-surface text-sm text-ink-muted">
                No idea has 5 ratings this week yet.{' '}
                <Link to="/feed?sort=needs_votes" className="text-accent-strong font-semibold hover:underline">
                  Rate ideas that need votes
                </Link>
              </div>
            ) : (
              weekIdeas.slice(0, 5).map((idea, index) => (
                <IdeaRow key={idea.id} idea={idea} rank={index + 1} showRank={true} headingTag="h3" />
              ))
            )}
          </div>
        </section>

        {/* Section 4: This Month's Top Ideas (5) */}
        <section aria-labelledby="month-heading" className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 id="month-heading" className="text-base font-bold text-ink">
                Top this month
              </h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Same score over the last 30 days (minimum 5 ratings)
              </p>
            </div>
            <Link
              to="/leaderboard?timeframe=month"
              className="text-xs font-semibold text-ink-muted hover:text-ink hover:underline inline-flex items-center gap-1"
            >
              See all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {isMonthLoading ? (
              Array.from({ length: 3 }).map((_, i) => <IdeaRowSkeleton key={i} />)
            ) : monthIdeas.length === 0 ? (
              <div className="p-6 text-center rounded-[12px] border border-dashed border-border bg-surface text-sm text-ink-muted">
                No idea has 5 ratings this month yet.{' '}
                <Link to="/feed?sort=needs_votes" className="text-accent-strong font-semibold hover:underline">
                  Rate ideas that need votes
                </Link>
              </div>
            ) : (
              monthIdeas.slice(0, 5).map((idea, index) => (
                <IdeaRow key={idea.id} idea={idea} rank={index + 1} showRank={true} headingTag="h3" />
              ))
            )}
          </div>
        </section>

        <WaitlistCard source="weekly_email" />

        {/* Section 5: Trending Discussions Block (4 threads) */}
        <section aria-labelledby="discussions-heading" className="space-y-4 pt-4 border-t border-border" id="discussions">
          <div className="flex items-center justify-between">
            <div>
              <h2 id="discussions-heading" className="text-base font-bold text-ink">
                Trending Discussions
              </h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Live community debates, architectural critiques, and builder questions
              </p>
            </div>
            <Link
              to="/feed"
              className="text-xs font-semibold text-ink-muted hover:text-ink hover:underline inline-flex items-center gap-1"
            >
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {discussionsList.length === 0 && (
            <p className="p-6 text-center rounded-[12px] border border-dashed border-border bg-surface text-sm text-ink-muted">
              No discussions yet. Open an idea and leave the first comment.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {discussionsList.map((idea) => {
              const count = Number(idea.stats?.comments_count || 0);
              return (
                <Link
                  key={idea.id}
                  to={`/ideas/${idea.id}?tab=comments`}
                  className="p-4 rounded-[12px] border border-border bg-surface hover:bg-surface-hover transition-colors group flex flex-col justify-between"
                >
                  <div>
                    <span className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider">
                      {idea.category}
                    </span>
                    <h3 className="text-sm font-semibold text-ink group-hover:text-accent-strong transition-colors line-clamp-1 mt-1">
                      {idea.title}
                    </h3>
                    <p className="text-xs text-ink-muted line-clamp-2 mt-1 leading-relaxed">
                      "{idea.pitch}"
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-border text-xs text-ink-muted">
                    <span className="inline-flex items-center gap-1.5 text-accent-strong font-medium">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span className="tabular-nums font-semibold">{count}</span> remarks
                    </span>
                    <span className="text-ink-faint">Open discussion →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Section 5: Category Browse Block */}
        <section aria-labelledby="categories-heading" className="space-y-4 pt-4 border-t border-border" id="categories">
          <div>
            <h2 id="categories-heading" className="text-base font-bold text-ink">
              Browse by Category
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Explore product concepts grouped by industry and technological domain
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {CATEGORIES_DATA.map((cat) => {
              const Icon = cat.icon;
              return (
                <Link
                  key={cat.name}
                  to={`/feed?category=${cat.name}`}
                  className="p-4 rounded-[12px] border border-border bg-surface hover:bg-surface-hover hover:border-border-strong transition-colors group flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="w-9 h-9 rounded-[10px] bg-surface-muted flex items-center justify-center text-ink-muted group-hover:text-accent-strong transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-semibold text-ink group-hover:text-accent-strong transition-colors">
                      {cat.name}
                    </h3>
                    <p className="text-xs text-ink-muted line-clamp-2 leading-relaxed">
                      {cat.desc}
                    </p>
                  </div>
                  <span className="text-[11px] font-medium text-ink-faint mt-3 pt-2 border-t border-border block">
                    Browse {cat.name} ideas →
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
