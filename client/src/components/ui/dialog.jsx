import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Dialog({ open, onOpenChange, children }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };
    if (open) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop: solid overlay token, fully opaque */}
          <div
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 bg-overlay"
            aria-hidden="true"
          />

          {/* Modal Content Wrapper */}
          <div className="relative z-50 w-full max-w-lg my-auto">
            {children}
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function DialogContent({ className, children, onClose }) {
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      initial={{ scale: 0.98, y: 6 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0.98, y: 6 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={cn(
        'relative w-full rounded-[12px] border border-border-strong bg-surface-raised p-6 sm:p-7 text-ink',
        className
      )}
    >
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-3.5 top-3.5 rounded-full p-2 text-ink-muted hover:bg-surface-hover hover:text-ink transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          aria-label="Close dialog"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {children}
    </motion.div>
  );
}

export function DialogHeader({ className, ...props }) {
  return <div className={cn('flex flex-col space-y-1 text-left mb-4', className)} {...props} />;
}

export function DialogTitle({ className, ...props }) {
  return <h2 className={cn('text-lg sm:text-xl font-bold tracking-tight text-ink', className)} {...props} />;
}

export function DialogDescription({ className, ...props }) {
  return <p className={cn('text-sm text-ink-muted leading-relaxed', className)} {...props} />;
}

export function DialogFooter({ className, ...props }) {
  return <div className={cn('flex items-center justify-end space-x-2.5 mt-6 pt-4 border-t border-border', className)} {...props} />;
}
