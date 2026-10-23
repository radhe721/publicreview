import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';

export function ConfirmationDialog({
  open,
  onOpenChange,
  title = 'Delete this idea?',
  description = 'This idea and all its community ratings and comments will be permanently deleted. This cannot be undone.',
  confirmText = 'Delete idea',
  variant = 'danger',
  isLoading = false,
  onConfirm,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <span className="text-xs font-bold uppercase tracking-wider text-danger mb-1 block">
            Warning
          </span>
          <DialogTitle className="text-lg font-bold text-ink">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-ink-muted mt-1 leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-4 pt-3 border-t border-border flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="text-xs rounded-[8px] h-9 px-3.5"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={variant}
            isLoading={isLoading}
            onClick={onConfirm}
            className="text-xs font-semibold rounded-[8px] h-9 px-4"
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
