import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import api from '@/api/client';
import { toast } from 'sonner';

export function ReportModal({ open, onOpenChange, ideaId, ideaTitle }) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 5) {
      toast.error('Please describe the issue (at least 5 characters).');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/reports', {
        idea_id: ideaId,
        reason: reason.trim(),
      });
      toast.success('Report submitted for moderator review.');
      setReason('');
      onOpenChange(false);
    } catch (err) {
      toast.error(err.message || 'Failed to submit report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <span className="text-xs font-bold uppercase tracking-wider text-danger mb-1 block">
              Flag Submission
            </span>
            <DialogTitle className="text-lg font-bold text-ink">
              Report an Issue
            </DialogTitle>
            <DialogDescription className="text-sm text-ink-muted leading-relaxed mt-1">
              Flagging <strong className="text-ink font-semibold">"{ideaTitle}"</strong> sends it to the moderation team for review against community guidelines.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider">
              <label htmlFor="report-reason" className="text-ink">
                Reason for report <span className="text-danger">*</span>
              </label>
              <span className="text-ink-muted font-normal tabular-nums normal-case">{reason.length}/500</span>
            </div>
            <Textarea
              id="report-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the issue clearly (e.g. copyright violation, scam, abusive content, duplicate)..."
              maxLength={500}
              className="min-h-[100px] rounded-[8px] bg-bg text-sm text-ink border-border-strong focus:border-accent-strong"
              required
            />
          </div>

          <DialogFooter className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="text-xs rounded-[8px] h-9 px-4"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              isLoading={isSubmitting}
              disabled={reason.trim().length < 5}
              className="text-xs font-semibold rounded-[8px] h-9 px-4"
            >
              Report idea
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
