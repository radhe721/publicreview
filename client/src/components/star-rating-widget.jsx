import React, { useState, useEffect } from 'react';
import { StampRating } from './ui/stamp-rating';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { Link } from 'react-router-dom';
import api from '@/api/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Sparkles, CheckCircle2 } from 'lucide-react';

const SCORE_DESCRIPTIONS = {
  1: '1 — Fatal flaw or wrong problem',
  2: '2 — Interesting premise, major execution gaps',
  3: '3 — Solid foundation, needs sharper differentiation',
  4: '4 — Strong concept! Worth building and testing',
  5: '5 — Exceptional! Build this immediately',
};

export function StarRatingWidget({
  ideaId,
  isAuthor,
  existingRating,
  onRatingUpdated,
  onRatingRemoved,
  className,
}) {
  const { isAuthenticated } = useAuth();
  const [score, setScore] = useState(existingRating?.score || 0);
  const [reviewText, setReviewText] = useState(existingRating?.review_text || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showReviewInput, setShowReviewInput] = useState(Boolean(existingRating?.review_text));

  useEffect(() => {
    if (existingRating) {
      setScore(existingRating.score);
      setReviewText(existingRating.review_text || '');
      setShowReviewInput(Boolean(existingRating.review_text));
    } else {
      setScore(0);
      setReviewText('');
    }
  }, [existingRating]);

  if (!isAuthenticated) {
    return (
      <div className={cn('p-6 rounded-[12px] border border-dashed border-border bg-surface text-center space-y-4', className)}>
        <div className="w-10 h-10 rounded-full bg-accent-soft text-accent-strong mx-auto flex items-center justify-center">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-base text-ink mb-1">
            Want to rate this idea?
          </h3>
          <p className="text-xs text-ink-muted max-w-sm mx-auto leading-relaxed">
            Sign in to record your rating and leave critical feedback for the creator.
          </p>
        </div>
        <div className="flex justify-center gap-2.5 pt-1">
          <Link to={`/login?redirect=/ideas/${ideaId}`}>
            <Button size="sm" className="font-semibold text-xs px-4 rounded-[8px]">
              Sign in to rate
            </Button>
          </Link>
          <Link to="/signup">
            <Button variant="secondary" size="sm" className="font-medium text-xs px-4 rounded-[8px]">
              Create account
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isAuthor) {
    return (
      <div className={cn('p-5 rounded-[12px] border border-border bg-surface flex items-start gap-3', className)}>
        <div className="w-2.5 h-2.5 rounded-full bg-accent-strong mt-1 shrink-0" />
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-ink">
            Author's Submission
          </p>
          <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">
            You authored this idea. Self-rating is disabled to keep community scores fair.
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (score < 1 || score > 5) {
      toast.error('Select a score from 1 to 5');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post(`/ideas/${ideaId}/ratings`, {
        score,
        review_text: reviewText.trim() || null,
      });

      toast.success(existingRating ? 'Rating updated.' : 'Rating recorded!');
      if (onRatingUpdated) {
        onRatingUpdated(res.data);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to submit rating.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!existingRating) return;
    setIsDeleting(true);
    try {
      const res = await api.delete(`/ideas/${ideaId}/ratings`);
      setScore(0);
      setReviewText('');
      setShowReviewInput(false);
      toast.info('Rating removed.');
      if (onRatingRemoved) {
        onRatingRemoved(res.data);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to remove rating.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={cn('p-5 sm:p-6 rounded-[12px] border border-border bg-surface space-y-4 transition-all relative overflow-hidden', className)}>
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-2">
            {existingRating ? 'Your Rating' : 'Rate this idea'}
            {existingRating && (
              <span className="text-[10px] text-accent-strong border border-accent bg-accent-soft px-2 py-0.5 rounded-full font-bold">
                Recorded
              </span>
            )}
          </h3>
          <p className="text-xs text-ink-muted mt-0.5">
            {SCORE_DESCRIPTIONS[score] || 'Select 1–5 marks to rate this concept'}
          </p>
        </div>

        {existingRating && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="text-xs text-ink-muted hover:text-danger underline transition-colors min-h-[32px] px-1 flex items-center"
          >
            Remove rating
          </button>
        )}
      </div>

      {/* Interactive Stamp Marks */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <div className="flex items-center gap-2">
          <StampRating
            value={score}
            max={5}
            size="lg"
            interactive
            onChange={(newScore) => {
              setScore(newScore);
              if (!showReviewInput) setShowReviewInput(true);
            }}
          />
        </div>

        <span className="text-xs font-semibold text-ink bg-surface-muted px-3 py-1 rounded-[6px] border border-border tabular-nums select-none">
          {score > 0 ? `${score} / 5` : 'Unrated'}
        </span>
      </div>

      {/* Optional Critique Box */}
      {(showReviewInput || score > 0) && (
        <div className="space-y-3 pt-3 border-t border-border">
          <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
            <label htmlFor="ballot-critique" className="text-ink cursor-pointer">
              Optional written critique:
            </label>
            <span className="text-ink-muted font-normal tabular-nums normal-case">{reviewText.length}/1000</span>
          </div>

          <Textarea
            id="ballot-critique"
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="What will break first? What should the author test next?"
            maxLength={1000}
            className="text-sm min-h-[90px] rounded-[8px] bg-bg text-ink border-border-strong focus:border-accent-strong leading-relaxed"
          />

          <div className="flex justify-end items-center pt-1">
            <Button
              size="sm"
              onClick={handleSubmit}
              isLoading={isSubmitting}
              disabled={score === 0}
              className="text-xs font-semibold px-5 h-9 rounded-[8px]"
            >
              Rate it
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
