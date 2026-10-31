import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { CoverTile } from './ui/cover-tile';
import { CategoryBadge } from './category-badge';
import { Button } from './ui/button';
import { useAuth } from '@/context/AuthContext';
import { MessageSquare, Sparkles, Star, LogIn, Check } from 'lucide-react';
import api from '@/api/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function IdeaRow({
  idea,
  rank,
  showRank = false,
  isFocused = false,
  onRateSuccess,
  className,
  headingTag: Heading = 'h2',
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();

  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [selectedScore, setSelectedScore] = useState(idea.user_rating?.score || 0);
  const [hoverScore, setHoverScore] = useState(0);
  const [reviewNote, setReviewNote] = useState(idea.user_rating?.review_text || '');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  // Optimistic score state
  const [currentScore, setCurrentScore] = useState(Number(idea.stats?.avg_score || 0));
  const [totalRatings, setTotalRatings] = useState(Number(idea.stats?.total_ratings || 0));
  const [hasRated, setHasRated] = useState(Boolean(idea.user_rating));
  const [animatingScore, setAnimatingScore] = useState(false);

  const popoverRef = useRef(null);
  const ratingBoxRef = useRef(null);

  // Early-hours fairness check: default OFF unless enabled in localStorage
  const isEarlyHoursFairness = () => {
    try {
      const enabled = localStorage.getItem('ideapulse_early_fairness') === 'true';
      if (!enabled) return false;
      const hours = new Date().getHours();
      return hours < 4;
    } catch {
      return false;
    }
  };

  const earlyFairnessActive = isEarlyHoursFairness();

  // Close rating popover on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target) &&
        ratingBoxRef.current &&
        !ratingBoxRef.current.contains(event.target)
      ) {
        setIsRatingOpen(false);
      }
    }
    if (isRatingOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isRatingOpen]);

  // Handle optimistic rating submission
  const handleConfirmRating = async (e) => {
    e.stopPropagation();
    if (selectedScore < 1 || selectedScore > 5) {
      toast.error('Select a rating from 1 to 5');
      return;
    }

    if (idea.author?.id === user?.id) {
      toast.error('You cannot rate your own idea');
      setIsRatingOpen(false);
      return;
    }

    // Optimistic calculation
    const prevScore = currentScore;
    const prevTotal = totalRatings;
    const prevHasRated = hasRated;

    const newTotal = prevHasRated ? prevTotal : prevTotal + 1;
    const newAvg = prevHasRated
      ? ((prevScore * prevTotal - (idea.user_rating?.score || prevScore) + selectedScore) / prevTotal)
      : ((prevScore * prevTotal + selectedScore) / newTotal);

    setCurrentScore(Number(newAvg.toFixed(1)));
    setTotalRatings(newTotal);
    setHasRated(true);
    setAnimatingScore(true);
    setIsRatingOpen(false);
    setTimeout(() => setAnimatingScore(false), 300);

    try {
      setIsSubmittingRating(true);
      const res = await api.post(`/ideas/${idea.id}/ratings`, {
        score: selectedScore,
        review_text: reviewNote.trim() || null,
      });
      toast.success('Rating recorded!');
      if (onRateSuccess) {
        onRateSuccess(res.data);
      }
    } catch (err) {
      // Rollback on error
      setCurrentScore(prevScore);
      setTotalRatings(prevTotal);
      setHasRated(prevHasRated);
      toast.error(err.message || 'Failed to submit rating');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const commentsCount = Number(idea.stats?.comments_count || idea.comments_count || 0);
  // Under 5 ratings an average means little, so show progress toward ranking instead of a score.
  const needsVotes = totalRatings < 5;
  const wouldPayPct = Number(idea.stats?.would_pay_pct || 0);
  const demandVotes = Number(idea.stats?.demand_votes || 0);
  const isTop3 = showRank && rank && rank <= 3;

  return (
    <article
      tabIndex={0}
      data-idea-id={idea.id}
      onClick={() => navigate(`/ideas/${idea.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          navigate(`/ideas/${idea.id}`);
        } else if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          setIsRatingOpen((prev) => !prev);
        }
      }}
      className={cn(
        'group relative flex items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 rounded-[12px] border border-border bg-surface transition-colors duration-150 hover:bg-surface-hover cursor-pointer outline-none select-none',
        isFocused && 'ring-2 ring-focus-ring',
        className
      )}
      aria-label={`${idea.title}. Average rating ${currentScore.toFixed(1)}`}
    >
      {/* Left: Rounded-Square Cover Tile (56px desktop, 48px mobile) */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
        <CoverTile
          imageUrl={idea.cover_image || idea.image_url}
          title={idea.title}
          category={idea.category}
          seed={idea.id}
          size="md"
        />

        {/* Center: Lines 1, 2, and 3 */}
        <div className="min-w-0 flex-1">
          {/* Line 1: Rank number plus title */}
          <div className="flex items-center gap-1.5 min-w-0">
            {showRank && rank && (
              <span
                className={cn(
                  'font-bold text-sm sm:text-base tabular-nums shrink-0',
                  isTop3 ? 'text-accent-strong' : 'text-ink-muted'
                )}
              >
                {rank}.
              </span>
            )}
            <Heading className="font-semibold text-[15px] sm:text-[17px] text-ink truncate leading-tight group-hover:text-accent-strong transition-colors">
              {idea.title}
            </Heading>
          </div>

          {/* Line 2: One-line pitch, muted, single line with ellipsis */}
          <p className="text-[13px] sm:text-[14px] text-ink-muted truncate mt-0.5 leading-normal">
            {idea.pitch}
          </p>

          {/* Line 3: Small category pills separated by "•", muted, each clickable */}
          <div className="flex items-center gap-1.5 flex-wrap mt-1 text-[11px] sm:text-[12px] text-ink-faint">
            <CategoryBadge category={idea.category} clickable />
            {idea.tags && idea.tags.length > 0 && (
              <>
                <span className="text-ink-faint select-none">•</span>
                <span className="truncate max-w-[200px] text-ink-muted">
                  #{idea.tags[0]}
                </span>
              </>
            )}
            {idea.is_featured && (
              <>
                <span className="px-1.5 py-0.5 rounded-full bg-accent-strong text-accent-ink font-bold uppercase tracking-wider text-[10px]">Featured</span>
              </>
            )}
            {idea.launch && (
              <>
                <span className="text-ink-faint select-none">•</span>
                <span className="text-success font-semibold whitespace-nowrap">Launched</span>
              </>
            )}
            {needsVotes && (
              <>
                <span className="text-ink-faint select-none">•</span>
                <span className="px-1.5 py-0.5 rounded-full bg-accent-soft text-accent-strong font-semibold whitespace-nowrap">
                  New, needs {5 - totalRatings} more {5 - totalRatings === 1 ? 'vote' : 'votes'}
                </span>
              </>
            )}
            {demandVotes > 0 && (
              <>
                <span className="text-ink-faint select-none">•</span>
                <span className="text-success font-semibold whitespace-nowrap tabular-nums">
                  {wouldPayPct}% would pay
                </span>
              </>
            )}
            {idea.author?.name && (
              <>
                <span className="text-ink-faint select-none hidden sm:inline">•</span>
                <span className="text-ink-faint truncate hidden sm:inline">
                  {idea.author.is_team ? 'Posted by BusinessListe Team' : `by ${idea.author.name}`}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: Two compact boxes side by side (Comment box + Rating box) */}
      <div
        className="flex items-center gap-2 shrink-0 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Comment Box: 56x56, 1px border-strong */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/ideas/${idea.id}?tab=comments`);
          }}
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-[10px] border border-border-strong bg-surface hover:bg-surface-hover hover:border-ink transition-colors flex flex-col items-center justify-center p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          aria-label={`${commentsCount} comments on ${idea.title}`}
        >
          <MessageSquare className="w-4 h-4 text-ink-muted" />
          <span className="text-[11px] sm:text-xs font-semibold text-ink-muted tabular-nums mt-0.5">
            {commentsCount}
          </span>
        </button>

        {/* Rating Box: 56x56, 1px border-strong */}
        <button
          ref={ratingBoxRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsRatingOpen(!isRatingOpen);
          }}
          className={cn(
            'group/rate w-12 h-12 sm:w-14 sm:h-14 rounded-[10px] border transition-all duration-150 flex flex-col items-center justify-center p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
            hasRated
              ? 'bg-accent-soft border-accent-strong text-accent-strong'
              : 'bg-surface border-border-strong hover:border-accent-strong text-ink hover:text-accent-strong'
          )}
          aria-label={needsVotes ? `${totalRatings} of 5 ratings needed to rank. Click to rate.` : `Average rating ${currentScore.toFixed(1)} out of 5. Click to rate.`}
          aria-expanded={isRatingOpen}
        >
          <Sparkles
            className={cn(
              'w-4 h-4 transition-colors',
              hasRated
                ? 'text-accent-strong fill-accent-strong'
                : 'text-ink-muted group-hover/rate:text-accent-strong'
            )}
          />
          <span
            className={cn(
              'text-[12px] sm:text-[13px] font-bold tabular-nums mt-0.5 transition-transform duration-200',
              animatingScore && 'scale-110 text-accent-strong'
            )}
          >
            {earlyFairnessActive ? '—.-' : needsVotes ? `${totalRatings}/5` : currentScore.toFixed(1)}
          </span>
        </button>

        {/* Rating Popover */}
        {isRatingOpen && (
          <div
            ref={popoverRef}
            className="absolute right-0 top-full mt-2 w-72 rounded-[12px] border border-border-strong bg-surface-raised p-4 z-50 animate-in fade-in-50 duration-150 text-left"
            role="dialog"
            aria-label="Rate this idea"
          >
            {!isAuthenticated ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-ink">
                  <LogIn className="w-4 h-4 text-accent-strong" />
                  <p className="text-sm font-semibold">Sign in to rate this idea</p>
                </div>
                <p className="text-xs text-ink-muted leading-relaxed">
                  Join the BusinessListe community to stress-test concepts and vote on early products.
                </p>
                <div className="pt-1">
                  <Button
                    size="sm"
                    className="w-full h-9 rounded-[8px] text-xs font-semibold"
                    onClick={() => {
                      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
                    }}
                  >
                    Sign in
                  </Button>
                </div>
              </div>
            ) : idea.author?.id === user?.id ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-ink">Author's idea</p>
                <p className="text-xs text-ink-muted leading-relaxed">
                  Self-rating is disabled to keep community rankings fair.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-ink">
                    {hasRated ? 'Update your rating' : 'Rate this idea'}
                  </p>
                  <span className="text-xs font-bold text-accent-strong tabular-nums">
                    {(hoverScore || selectedScore) > 0 ? `${hoverScore || selectedScore} / 5` : 'Choose'}
                  </span>
                </div>

                {/* 1-5 Star Picker filling left-to-right */}
                <div
                  className="flex items-center justify-between gap-1 py-1"
                  onMouseLeave={() => setHoverScore(0)}
                >
                  {[1, 2, 3, 4, 5].map((star) => {
                    const activeVal = hoverScore || selectedScore;
                    const isFilled = activeVal >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setSelectedScore(star)}
                        onMouseEnter={() => setHoverScore(star)}
                        className="w-9 h-9 rounded-[8px] flex items-center justify-center hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring"
                        aria-label={`Rate ${star} star`}
                      >
                        <Star
                          className={cn(
                            'w-5 h-5 transition-colors',
                            isFilled
                              ? 'text-accent-strong fill-accent-strong'
                              : 'text-border-strong stroke-1'
                          )}
                        />
                      </button>
                    );
                  })}
                </div>

                {/* Score meaning label */}
                <p className="text-[11px] text-ink-muted italic text-center">
                  {(hoverScore || selectedScore) === 5 && 'Exceptional! Build this immediately.'}
                  {(hoverScore || selectedScore) === 4 && 'Strong concept worth testing.'}
                  {(hoverScore || selectedScore) === 3 && 'Solid, needs differentiation.'}
                  {(hoverScore || selectedScore) === 2 && 'Interesting, but major execution gaps.'}
                  {(hoverScore || selectedScore) === 1 && 'Fatal flaw or unviable premise.'}
                  {!(hoverScore || selectedScore) && 'Hover or tap to select score'}
                </p>

                {/* Confirm Action */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs font-medium px-2.5"
                    onClick={() => setIsRatingOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={selectedScore === 0}
                    isLoading={isSubmittingRating}
                    className="h-8 text-xs font-semibold px-4 rounded-[8px]"
                    onClick={handleConfirmRating}
                  >
                    Rate it
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
