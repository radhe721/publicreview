import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import {
  Search,
  Plus,
  Compass,
  Trophy,
  User,
  Sun,
  Moon,
  Laptop,
  ArrowRight,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function CommandPalette({ open, onOpenChange }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();

  // Search ideas if query is entered
  const { data: searchData } = useQuery({
    queryKey: ['palette-search', query],
    queryFn: () => (query.trim() ? api.get(`/ideas?search=${encodeURIComponent(query.trim())}&limit=5`) : null),
    enabled: Boolean(query.trim()),
  });

  const matchingIdeas = searchData?.data?.ideas || [];

  // Default actions list
  const defaultActions = [
    {
      id: 'post',
      title: 'Post an idea',
      category: 'Actions',
      icon: Plus,
      shortcut: 'N',
      perform: () => navigate('/submit'),
    },
    {
      id: 'archive',
      title: 'Browse all ideas',
      category: 'Navigation',
      icon: Compass,
      shortcut: '/',
      perform: () => navigate('/feed'),
    },
    {
      id: 'leaderboard',
      title: 'View Leaderboard',
      category: 'Navigation',
      icon: Trophy,
      shortcut: 'L',
      perform: () => navigate('/leaderboard'),
    },
    {
      id: 'theme-light',
      title: 'Set Theme: Light',
      category: 'Preferences',
      icon: Sun,
      shortcut: 'T 1',
      perform: () => setTheme('light'),
    },
    {
      id: 'theme-dark',
      title: 'Set Theme: Dark',
      category: 'Preferences',
      icon: Moon,
      shortcut: 'T 2',
      perform: () => setTheme('dark'),
    },
    {
      id: 'theme-system',
      title: 'Set Theme: System',
      category: 'Preferences',
      icon: Laptop,
      shortcut: 'T 3',
      perform: () => setTheme('system'),
    },
  ];

  if (isAuthenticated && user) {
    defaultActions.push({
      id: 'profile',
      title: 'My Profile & Ratings',
      category: 'Navigation',
      icon: User,
      shortcut: 'P',
      perform: () => navigate(`/profile/${user.id}`),
    });
  }

  // Filter actions based on query
  const filteredActions = query.trim()
    ? defaultActions.filter(
        (a) =>
          a.title.toLowerCase().includes(query.toLowerCase()) ||
          a.category.toLowerCase().includes(query.toLowerCase())
      )
    : defaultActions;

  // Combine actions and matching ideas into flat selectable list
  const allItems = [
    ...filteredActions.map((a) => ({ ...a, type: 'action' })),
    ...matchingIdeas.map((idea) => ({
      id: `idea-${idea.id}`,
      title: idea.title,
      subtitle: `${idea.category} • Score ${Number(idea.stats?.avg_score || 0).toFixed(1)}/5`,
      category: 'Ideas',
      icon: Sparkles,
      type: 'idea',
      perform: () => navigate(`/ideas/${idea.id}`),
    })),
  ];

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (allItems.length > 0 ? (prev + 1) % allItems.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (allItems.length > 0 ? (prev - 1 + allItems.length) % allItems.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems[selectedIndex]) {
        allItems[selectedIndex].perform();
        onOpenChange(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onOpenChange(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-overlay"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Palette Container */}
      <div
        className="relative z-50 w-full max-w-xl rounded-[12px] border border-border-strong bg-surface-raised text-ink overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-border gap-3">
          <Search className="w-4 h-4 text-ink-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search ideas..."
            className="flex-1 bg-surface-raised text-sm text-ink placeholder:text-ink-muted outline-none border-none"
            aria-label="Search command palette"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded-[6px] text-ink-muted hover:text-ink"
              aria-label="Clear search query"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-xs font-mono text-ink-muted bg-surface border border-border rounded-[4px]">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {allItems.length === 0 ? (
            <div className="py-10 text-center text-sm text-ink-muted">
              No matching commands or ideas found for "{query}".
            </div>
          ) : (
            allItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              const Icon = item.icon;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    item.perform();
                    onOpenChange(false);
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    'flex items-center justify-between px-3.5 py-2.5 rounded-[8px] cursor-pointer text-sm font-medium transition-colors',
                    isSelected ? 'bg-surface-hover text-ink' : 'text-ink-muted hover:bg-surface-hover hover:text-ink'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={cn('w-4 h-4 shrink-0', isSelected ? 'text-accent-strong' : 'text-ink-muted')} />
                    <div className="truncate">
                      <span className={cn('block truncate', isSelected ? 'text-ink font-semibold' : 'text-ink')}>
                        {item.title}
                      </span>
                      {item.subtitle && (
                        <span className="text-xs truncate block font-normal text-ink-muted">
                          {item.subtitle}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-3 shrink-0">
                    {item.shortcut && (
                      <kbd className="px-1.5 py-0.5 text-xs font-mono rounded-[4px] border border-border bg-surface text-ink-muted">
                        {item.shortcut}
                      </kbd>
                    )}
                    <ArrowRight className="w-3.5 h-3.5 text-ink-faint" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 border-t border-border bg-surface text-xs text-ink-muted flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono bg-surface-muted px-1.5 py-0.5 rounded-[4px] border border-border mr-1">↑↓</kbd> to navigate
            </span>
            <span>
              <kbd className="font-mono bg-surface-muted px-1.5 py-0.5 rounded-[4px] border border-border mr-1">↵</kbd> to select
            </span>
          </div>
          <span className="text-[11px] text-ink-faint">Product Hunt Style</span>
        </div>
      </div>
    </div>
  );
}
