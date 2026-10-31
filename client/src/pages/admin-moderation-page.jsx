import React, { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { CategoryBadge } from '@/components/category-badge';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelativeTime, cn } from '@/lib/utils';
import { toast } from 'sonner';
import { HeldVotesPanel } from '@/components/held-votes-panel';
import { AdminOverview } from '@/components/admin-overview';
import { Shield, ExternalLink, CheckCircle } from 'lucide-react';

export function AdminModerationPage() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-reports', statusFilter],
    queryFn: () => {
      const q = statusFilter ? `?status=${statusFilter}` : '';
      return api.get(`/reports${q}`);
    },
    enabled: isAdmin,
  });

  const reports = data?.data?.reports || [];

  if (authLoading) {
    return (
      <main className="min-h-screen bg-bg text-ink py-16 flex items-center justify-center" aria-busy="true">
        <h1 className="sr-only">Moderation Queue</h1>
        <div className="w-6 h-6 border-2 border-border-strong border-t-accent-strong rounded-full animate-spin" />
      </main>
    );
  }
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleUpdateStatus = async (reportId, newStatus) => {
    try {
      await api.patch(`/reports/${reportId}`, { status: newStatus });
      toast.success(`Flag marked as ${newStatus}.`);
      queryClient.invalidateQueries(['admin-reports']);
    } catch (err) {
      toast.error(err.message || 'Failed to update report.');
    }
  };

  const handleDeleteIdea = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.delete(`/ideas/${deleteTarget.idea_id}`);
      toast.success('Idea and ratings deleted from community.');
      await api.patch(`/reports/${deleteTarget.id}`, { status: 'resolved' }).catch(() => null);
      queryClient.invalidateQueries(['admin-reports']);
      queryClient.invalidateQueries(['ideas-feed']);
    } catch (err) {
      toast.error(err.message || 'Failed to delete idea.');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-ink py-8 sm:py-12">
      <main className="max-w-[860px] mx-auto px-4 sm:px-6 space-y-8">
        {/* Header */}
        <div className="border-b border-border pb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-accent-strong">
              Moderation Desk
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink mt-1">
              Moderation Queue
            </h1>
            <p className="text-sm text-ink-muted mt-1">
              Review community reports and flags regarding rules or duplicates.
            </p>
          </div>

          {/* Filter */}
          <div className="inline-flex p-1 rounded-[8px] border border-border bg-surface text-xs font-semibold self-start sm:self-auto" role="group" aria-label="Filter moderation queue">
            {[
              { key: '', label: 'All' },
              { key: 'pending', label: 'Pending' },
              { key: 'resolved', label: 'Resolved' },
              { key: 'dismissed', label: 'Dismissed' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={cn(
                  'px-3 py-1.5 rounded-[6px] transition-colors min-h-[32px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                  statusFilter === f.key
                    ? 'bg-accent-strong text-accent-ink font-bold'
                    : 'text-ink-muted hover:text-ink'
                )}
                aria-pressed={statusFilter === f.key}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-36 w-full rounded-[12px]" />
            <Skeleton className="h-36 w-full rounded-[12px]" />
          </div>
        ) : reports.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-border rounded-[12px] bg-surface p-6 space-y-3">
            <div className="w-12 h-12 rounded-full bg-surface-muted text-success mx-auto flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-success" />
            </div>
            <h2 className="font-bold text-base text-ink">
              Moderation queue is clear
            </h2>
            <p className="text-sm text-ink-muted mt-1">
              No {statusFilter ? statusFilter : ''} flags currently require review.
            </p>
          </div>
        ) : (
          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink-muted">
              Reported Ideas ({reports.length})
            </h2>
            <div className="space-y-3.5">
              {reports.map((report) => (
                <article
                  key={report.id}
                  className="p-5 sm:p-6 rounded-[12px] border border-border bg-surface space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3 text-xs font-medium">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border',
                          report.status === 'pending'
                            ? 'border-danger text-danger bg-danger-soft font-bold'
                            : report.status === 'resolved'
                            ? 'border-success text-success bg-success-soft font-bold'
                            : 'border-border text-ink-muted bg-surface-muted'
                        )}
                      >
                        {report.status}
                      </span>
                      <CategoryBadge category={report.idea_category} />
                      <span className="text-ink-muted tabular-nums">
                        Reported {formatRelativeTime(report.created_at)}
                      </span>
                    </div>

                    <div className="text-ink-faint text-xs">
                      By {report.reporter_name}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-bold text-base text-ink">
                      <Link
                        to={`/ideas/${report.idea_id}`}
                        className="hover:text-accent-strong transition-colors inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring rounded-[4px]"
                      >
                        {report.idea_title} <ExternalLink className="w-3.5 h-3.5 text-ink-muted" />
                      </Link>
                    </h3>
                    <p className="text-xs text-ink-muted">
                      Submitted by {report.idea_author_name}
                    </p>

                    <div className="p-3 bg-surface-muted rounded-[8px] border border-border text-xs text-ink italic leading-relaxed">
                      <strong className="not-italic text-[10px] uppercase font-bold text-ink-muted block mb-0.5">
                        Flag Reason:
                      </strong>
                      "{report.reason}"
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border text-xs">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleUpdateStatus(report.id, 'resolved')}
                        disabled={report.status === 'resolved'}
                        className="h-8 text-xs rounded-[8px] px-3"
                      >
                        Resolve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUpdateStatus(report.id, 'dismissed')}
                        disabled={report.status === 'dismissed'}
                        className="h-8 text-xs px-3"
                      >
                        Dismiss
                      </Button>
                    </div>

                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setDeleteTarget(report)}
                      className="h-8 text-xs rounded-[8px] px-3 font-semibold"
                    >
                      Delete idea
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <ConfirmationDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title="Delete reported idea?"
          description={`Permanently remove "${deleteTarget?.idea_title}" and all its community evaluations? This cannot be undone.`}
          confirmText="Delete idea"
          isLoading={isDeleting}
          onConfirm={handleDeleteIdea}
        />
        <AdminOverview />
        <HeldVotesPanel />
      </main>
    </div>
  );
}
