import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { AuthorAvatar } from './ui/author-avatar';
import { formatRelativeTime } from '@/lib/utils';
import { Link } from 'react-router-dom';
import api from '@/api/client';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

export function CommentSection({ ideaId, comments = [], onCommentAdded, onCommentDeleted }) {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await api.post(`/ideas/${ideaId}/comments`, { content: content.trim() });
      setContent('');
      toast.success('Comment posted.');
      if (onCommentAdded) {
        onCommentAdded(res.data.comment);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to post comment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId) => {
    setDeletingId(commentId);
    try {
      await api.delete(`/ideas/comments/${commentId}`);
      toast.info('Comment removed.');
      if (onCommentDeleted) {
        onCommentDeleted(commentId);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to delete comment.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
          Comments ({comments.length})
        </h3>
      </div>

      {/* Composer */}
      {isAuthenticated ? (
        <form onSubmit={handleSubmit} className="space-y-3 p-4 sm:p-5 rounded-[12px] border border-border bg-surface">
          <div className="flex items-start gap-3">
            <AuthorAvatar name={user?.name} avatarUrl={user?.avatar_url} size="sm" className="mt-1" />
            <div className="flex-1 space-y-2">
              <label htmlFor="comment-textarea" className="sr-only">
                Add a comment
              </label>
              <Textarea
                id="comment-textarea"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What do you think? Share actionable critique or questions..."
                maxLength={1000}
                className="text-sm min-h-[90px] rounded-[8px] bg-bg text-ink border-border-strong focus:border-accent-strong leading-relaxed"
              />
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-ink-muted tabular-nums">{content.length}/1000</span>
                <Button
                  type="submit"
                  size="sm"
                  isLoading={isSubmitting}
                  disabled={!content.trim() || content.trim().length < 2}
                  className="h-9 text-xs font-semibold rounded-[8px] px-4"
                >
                  Post comment
                </Button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="p-5 rounded-[12px] border border-dashed border-border bg-surface text-center text-sm text-ink-muted">
          <Link to="/login" className="font-semibold text-accent-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
            Sign in
          </Link>{' '}
          to join the conversation and leave a critique.
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-3">
        {comments.length === 0 ? (
          <div className="p-8 text-center rounded-[12px] border border-dashed border-border bg-surface text-sm text-ink-muted italic">
            No comments yet. Start the discussion!
          </div>
        ) : (
          comments.map((comment) => {
            const canDelete = user && (user.id === comment.user?.id || isAdmin);
            return (
              <div
                key={comment.id}
                className="p-4 sm:p-5 rounded-[12px] border border-border bg-surface space-y-2.5 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <Link
                    to={`/profile/${comment.user?.id}`}
                    className="flex items-center gap-2 group/author focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring rounded-full"
                  >
                    <AuthorAvatar name={comment.user?.name} avatarUrl={comment.user?.avatar_url} size="xs" />
                    <span className="font-semibold text-ink group-hover/author:text-accent-strong transition-colors">
                      {comment.user?.name}
                    </span>
                    {comment.user?.role === 'admin' && (
                      <span className="text-[10px] text-accent-strong border border-accent bg-accent-soft px-1.5 py-0.5 rounded-full font-bold">
                        Admin
                      </span>
                    )}
                  </Link>

                  <div className="flex items-center gap-2 text-ink-muted">
                    <span className="tabular-nums">{formatRelativeTime(comment.created_at)}</span>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDelete(comment.id)}
                        disabled={deletingId === comment.id}
                        className="text-ink-muted hover:text-danger p-1 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring min-w-[28px] min-h-[28px] flex items-center justify-center transition-colors"
                        title="Delete comment"
                        aria-label="Delete comment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed pl-7">
                  {comment.content}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
