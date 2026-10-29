import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { CoverTile } from '@/components/ui/cover-tile';
import { CategoryBadge } from '@/components/category-badge';
import { AuthorAvatar } from '@/components/ui/author-avatar';
import { RatingBreakdown } from '@/components/rating-breakdown';
import { StarRatingWidget } from '@/components/star-rating-widget';
import { CommentSection } from '@/components/comment-section';
import { DemandSignalPanel } from '@/components/demand-signal-panel';
import { ReportModal } from '@/components/report-modal';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Flag,
  Share2,
  Sparkles,
  MessageSquare,
  Star,
  Check,
} from 'lucide-react';
import { formatDate, formatRelativeTime, cn } from '@/lib/utils';
import { toast } from 'sonner';

export function IdeaDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isAdmin } = useAuth();

  const activeTab = searchParams.get('tab') || 'overview';

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: ideaData, isLoading: ideaLoading, isError } = useQuery({
    queryKey: ['idea-detail', id],
    queryFn: () => api.get(`/ideas/${id}`),
  });

  const { data: commentsData } = useQuery({
    queryKey: ['idea-comments', id],
    queryFn: () => api.get(`/ideas/${id}/comments`),
  });

  const { data: ratingsData } = useQuery({
    queryKey: ['idea-ratings', id],
    queryFn: () => api.get(`/ideas/${id}/ratings`),
  });

  const idea = ideaData?.data?.idea;
  const comments = commentsData?.data?.comments || [];
  const ratings = ratingsData?.data?.ratings || [];

  const isAuthor = user && idea && user.id === idea.author?.id;
  const canManage = isAuthor || isAdmin;

  const setTab = (tab) => {
    const params = new URLSearchParams(searchParams);
    params.set('tab', tab);
    setSearchParams(params);
  };

  const handleDeleteIdea = async () => {
    setIsDeleting(true);
    try {
      await api.delete(`/ideas/${id}`);
      toast.success('Idea deleted.');
      queryClient.invalidateQueries(['ideas-feed']);
      navigate('/feed');
    } catch (err) {
      toast.error(err.message || 'Failed to delete idea.');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: idea?.title,
        text: idea?.pitch,
        url: window.location.href,
      }).catch(() => null);
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard.');
    }
  };

  if (ideaLoading) {
    return (
      <div className="min-h-screen bg-bg text-ink py-8 sm:py-12">
        <div className="max-w-[860px] mx-auto px-4 sm:px-6 space-y-6">
          <Skeleton className="h-6 w-28 rounded-[8px]" />
          <div className="flex items-center gap-4">
            <Skeleton className="w-16 h-16 sm:w-18 sm:h-18 rounded-[10px]" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-7 w-3/4 rounded-[8px]" />
              <Skeleton className="h-4 w-1/2 rounded-[6px]" />
            </div>
          </div>
          <Skeleton className="h-48 w-full rounded-[12px]" />
        </div>
      </div>
    );
  }

  if (isError || !idea) {
    return (
      <div className="min-h-screen bg-bg text-ink py-20">
        <div className="max-w-md mx-auto px-4 text-center space-y-4">
          <h1 className="text-2xl font-bold text-ink">
            Idea not found
          </h1>
          <p className="text-sm text-ink-muted">
            This idea may have been deleted or archived.
          </p>
          <Link to="/feed">
            <Button variant="secondary" size="default" className="rounded-[8px]">
              Back to all ideas
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const avgScore = Number(idea.stats?.avg_score || 0).toFixed(1);
  const totalRatings = Number(idea.stats?.total_ratings || 0);

  return (
    <div className="min-h-screen bg-bg text-ink py-8 sm:py-12">
      <main className="max-w-[860px] mx-auto px-4 sm:px-6 space-y-8">
        {/* Back Link */}
        <Link
          to="/feed"
          className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring rounded-[4px]"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to ideas
        </Link>

        {/* Header Block: Large Cover Tile (72px), Title, Pitch, Pills, Author, Date, Rate & Share buttons */}
        <section className="space-y-6 border-b border-border pb-8">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
            <div className="flex items-start gap-4 sm:gap-5 flex-1 min-w-0">
              <CoverTile
                imageUrl={idea.cover_image || idea.image_url}
                title={idea.title}
                category={idea.category}
                seed={idea.id}
                size="lg"
              />

              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2 flex-wrap text-xs text-ink-muted">
                  <CategoryBadge category={idea.category} clickable />
                  <span className="text-ink-faint select-none">•</span>
                  <span>Posted {formatDate(idea.created_at)}</span>
                  {idea.author?.name && (
                    <>
                      <span className="text-ink-faint select-none">•</span>
                      <span>by <Link to={`/profile/${idea.author.id}`} className="font-semibold text-ink hover:underline">{idea.author.name}</Link></span>
                    </>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink leading-tight">
                  {idea.title}
                </h1>

                <p className="text-sm sm:text-base text-ink-muted leading-relaxed">
                  {idea.pitch}
                </p>
              </div>
            </div>

            {/* Prominent Rate and Share Buttons */}
            <div className="flex sm:flex-col items-center sm:items-end gap-2.5 w-full sm:w-auto shrink-0">
              <Button
                variant="primary"
                size="default"
                onClick={() => setTab('ratings')}
                className="flex-1 sm:flex-none h-11 px-5 rounded-[8px] gap-2 text-sm font-semibold"
              >
                <Sparkles className="w-4 h-4" />
                <span>Rate it ({avgScore})</span>
              </Button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="secondary"
                  size="default"
                  onClick={handleShare}
                  className="flex-1 sm:flex-none h-11 px-4 rounded-[8px] gap-1.5 text-xs font-semibold"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </Button>

                {isAuthenticated && !isAuthor && (
                  <button
                    type="button"
                    onClick={() => setReportModalOpen(true)}
                    className="h-11 px-3 rounded-[8px] border border-border-strong text-ink-muted hover:text-danger hover:border-danger transition-colors text-xs flex items-center justify-center"
                    title="Report idea"
                    aria-label="Report idea"
                  >
                    <Flag className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {canManage && (
                <div className="flex items-center gap-2 pt-2 border-t border-border w-full justify-end">
                  <Link to={`/ideas/${idea.id}/edit`}>
                    <Button variant="secondary" size="sm" className="h-8 text-xs rounded-[8px] gap-1 px-2.5">
                      <Edit2 className="w-3 h-3" /> Edit
                    </Button>
                  </Link>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setDeleteDialogOpen(true)}
                    className="h-8 text-xs rounded-[8px] gap-1 px-2.5"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Tab Bar: Overview, Comments, Ratings */}
        <div role="tablist" aria-label="Idea tabs" className="flex items-center gap-2 border-b border-border pb-px text-sm font-semibold">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'comments', label: `Comments (${comments.length})` },
            { id: 'ratings', label: `Ratings (${totalRatings})` },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTab(tab.id)}
                className={cn(
                  'px-4 py-2.5 border-b-2 transition-colors -mb-px focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring rounded-t-[6px]',
                  isActive
                    ? 'border-accent-strong text-ink'
                    : 'border-surface text-ink-muted hover:text-ink hover:border-border-strong'
                )}
                aria-selected={isActive}
                role="tab"
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content: Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-in fade-in-50 duration-150">
            {/* Description / Story */}
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                Description & Blueprint
              </h2>
              <div className="text-sm sm:text-base text-ink leading-relaxed whitespace-pre-wrap">
                {idea.description}
              </div>

              {idea.tags && idea.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-3">
                  {idea.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs text-ink-muted bg-surface-muted px-2.5 py-1 rounded-full border border-border"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* Author Card */}
            <section className="p-5 rounded-[12px] border border-border bg-surface flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <AuthorAvatar name={idea.author?.name} avatarUrl={idea.author?.avatar_url} size="lg" />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-ink">
                    {idea.author?.name}
                    {isAuthor && <span className="ml-1.5 text-xs text-accent-strong font-semibold">(You)</span>}
                  </h3>
                  <p className="text-xs text-ink-muted line-clamp-1 mt-0.5">
                    {idea.author?.bio || 'BusinessListe community builder'}
                  </p>
                </div>
              </div>
              <Link to={`/profile/${idea.author?.id}`}>
                <Button variant="secondary" size="sm" className="rounded-[8px] text-xs h-9">
                  View profile
                </Button>
              </Link>
            </section>

            {/* Rating Breakdown Section */}
            <section className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                Community Scorecard
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                <div className="md:col-span-6">
                  <RatingBreakdown stats={idea.stats} />
                </div>
                <div className="md:col-span-6">
                  <StarRatingWidget
                    ideaId={idea.id}
                    isAuthor={isAuthor}
                    existingRating={idea.user_rating}
                    onRatingUpdated={(result) => {
                      queryClient.invalidateQueries(['idea-detail', id]);
                      queryClient.invalidateQueries(['idea-ratings', id]);
                    }}
                    onRatingRemoved={(result) => {
                      queryClient.invalidateQueries(['idea-detail', id]);
                      queryClient.invalidateQueries(['idea-ratings', id]);
                    }}
                  />
                </div>
              </div>
            </section>

            {/* Demand Validation: would people actually use / pay for it? */}
            <section className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                Market Demand
              </h2>
              <DemandSignalPanel
                ideaId={idea.id}
                ideaTitle={idea.title}
                isAuthor={isAuthor}
                isAuthenticated={isAuthenticated}
                canViewWaitlist={canManage}
              />
            </section>
          </div>
        )}

        {/* Tab Content: Comments */}
        {activeTab === 'comments' && (
          <div className="animate-in fade-in-50 duration-150">
            <CommentSection
              ideaId={idea.id}
              comments={comments}
              onCommentAdded={() => {
                queryClient.invalidateQueries(['idea-comments', id]);
                queryClient.invalidateQueries(['idea-detail', id]);
              }}
              onCommentDeleted={() => {
                queryClient.invalidateQueries(['idea-comments', id]);
                queryClient.invalidateQueries(['idea-detail', id]);
              }}
            />
          </div>
        )}

        {/* Tab Content: Ratings */}
        {activeTab === 'ratings' && (
          <div className="space-y-8 animate-in fade-in-50 duration-150">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              <div className="md:col-span-6">
                <RatingBreakdown stats={idea.stats} />
              </div>
              <div className="md:col-span-6">
                <StarRatingWidget
                  ideaId={idea.id}
                  isAuthor={isAuthor}
                  existingRating={idea.user_rating}
                  onRatingUpdated={() => {
                    queryClient.invalidateQueries(['idea-detail', id]);
                    queryClient.invalidateQueries(['idea-ratings', id]);
                  }}
                  onRatingRemoved={() => {
                    queryClient.invalidateQueries(['idea-detail', id]);
                    queryClient.invalidateQueries(['idea-ratings', id]);
                  }}
                />
              </div>
            </div>

            {/* List of Community Ratings / Reviews */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
                Community Ballots ({ratings.length})
              </h2>

              {ratings.length === 0 ? (
                <div className="p-8 text-center rounded-[12px] border border-dashed border-border bg-surface text-sm text-ink-muted">
                  No written reviews cast yet. Rate above to leave the first note!
                </div>
              ) : (
                <div className="space-y-3">
                  {ratings.map((r) => (
                    <div
                      key={r.id}
                      className="p-4 rounded-[12px] border border-border bg-surface space-y-2 text-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AuthorAvatar name={r.user?.name} avatarUrl={r.user?.avatar_url} size="xs" />
                          <span className="font-semibold text-ink text-xs">{r.user?.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-accent-strong font-bold tabular-nums">
                          <Star className="w-3.5 h-3.5 fill-accent text-accent" />
                          <span>{r.score} / 5</span>
                          <span className="text-ink-faint font-normal tabular-nums ml-1">
                            {formatRelativeTime(r.created_at)}
                          </span>
                        </div>
                      </div>
                      {r.review_text && (
                        <p className="text-sm text-ink-muted leading-relaxed pl-6">
                          "{r.review_text}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dialogs */}
        <ReportModal
          open={reportModalOpen}
          onOpenChange={setReportModalOpen}
          ideaId={idea.id}
          ideaTitle={idea.title}
        />

        <ConfirmationDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="Delete this idea?"
          description={`Permanently remove "${idea.title}" and its ratings and comments. This cannot be undone.`}
          confirmText="Delete idea"
          isLoading={isDeleting}
          onConfirm={handleDeleteIdea}
        />
      </main>
    </div>
  );
}
