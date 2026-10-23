import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 py-20 bg-bg text-ink">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Friendly Tokenized SVG Illustration */}
        <div className="w-24 h-24 mx-auto flex items-center justify-center text-accent-strong">
          <svg
            viewBox="0 0 96 96"
            className="w-full h-full fill-none"
            aria-hidden="true"
          >
            {/* Box outline with tokenized border */}
            <rect
              x="12"
              y="16"
              width="72"
              height="64"
              rx="12"
              stroke="var(--border-strong)"
              strokeWidth="2.5"
              fill="var(--surface)"
            />
            {/* Compass / Question / Spark mark */}
            <path
              d="M48 30v24M48 62h.02"
              stroke="var(--accent-strong)"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            {/* Decorative corner spark */}
            <path
              d="M72 10l1.5 4.5L78 16l-4.5 1.5L72 22l-1.5-4.5L66 16l4.5-1.5L72 10z"
              fill="var(--accent)"
            />
          </svg>
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-accent-strong">
            404 Error
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink">
            Page not found
          </h1>
          <p className="text-sm text-ink-muted leading-relaxed max-w-sm mx-auto">
            The idea or page you were looking for doesn't exist or may have been moved.
          </p>
        </div>

        <div className="pt-2 flex justify-center gap-3">
          <Link to="/">
            <Button size="default" className="rounded-[8px] text-sm px-6 font-semibold">
              Explore today's ideas
            </Button>
          </Link>
          <Link to="/feed">
            <Button variant="secondary" size="default" className="rounded-[8px] text-sm px-5">
              Browse all ideas
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
