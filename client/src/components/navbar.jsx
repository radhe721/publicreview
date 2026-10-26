import React, { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Button } from './ui/button';
import { AuthorAvatar } from './ui/author-avatar';
import {
  Sun,
  Moon,
  Laptop,
  Plus,
  Shield,
  Menu,
  X,
  ChevronDown,
  Search,
  Sparkles,
  Trophy,
  MessageSquare,
  Compass,
  Info,
  Calendar,
  Layers,
  Award,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function Navbar({ onOpenCommandPalette }) {
  const { user, isAuthenticated, isAdmin, logout, logoutAll } = useAuth();
  const { theme, resolvedTheme, cycleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const dropdownTimeoutRef = useRef(null);
  const navigate = useNavigate();

  const handleMouseEnter = (name) => {
    if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current);
    setActiveDropdown(name);
  };

  const handleMouseLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 120);
  };

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logout();
    navigate('/');
  };

  const handleLogoutAll = async () => {
    setUserMenuOpen(false);
    await logoutAll();
    navigate('/');
  };

  const themeIcon = () => {
    if (theme === 'system') {
      return <Laptop className="w-4 h-4 text-ink-muted" />;
    }
    return resolvedTheme === 'dark' ? (
      <Moon className="w-4 h-4 text-ink-muted" />
    ) : (
      <Sun className="w-4 h-4 text-ink-muted" />
    );
  };

  const themeLabel = () => {
    if (theme === 'system') return `Theme: System (${resolvedTheme})`;
    return `Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`;
  };

  const navDropdowns = {
    ideas: {
      label: 'Ideas',
      path: '/feed',
      items: [
        {
          title: 'Browse All Ideas',
          desc: 'Explore real-time community submissions and concepts',
          path: '/feed',
          icon: Compass,
        },
        {
          title: "Today's Top",
          desc: 'Highest rated concepts launched today',
          path: '/feed?sort=top',
          icon: Sparkles,
        },
        {
          title: 'Newest Ideas',
          desc: 'Fresh submissions seeking their first honest reviews',
          path: '/feed?sort=newest',
          icon: Calendar,
        },
        {
          title: 'Categories',
          desc: 'Filter by Tech, Design, Social, Education, and more',
          path: '/feed#categories',
          icon: Layers,
        },
      ],
    },
    leaderboard: {
      label: 'Leaderboard',
      path: '/leaderboard',
      items: [
        {
          title: 'Daily Top',
          desc: "Today's community standouts ranked by validation score",
          path: '/leaderboard?timeframe=daily',
          icon: Trophy,
        },
        {
          title: 'Weekly Leaders',
          desc: 'The top performing concepts over the last 7 days',
          path: '/leaderboard?timeframe=week',
          icon: Award,
        },
        {
          title: 'Monthly Stars',
          desc: 'The best-rated ideas of the past 30 days',
          path: '/leaderboard?timeframe=month',
          icon: Sparkles,
        },
        {
          title: 'All-Time Hall of Fame',
          desc: 'Highest validated ideas in IdeaPulse history',
          path: '/leaderboard?timeframe=all',
          icon: Trophy,
        },
      ],
    },
    community: {
      label: 'Community',
      path: '/feed#discussions',
      items: [
        {
          title: 'Trending Discussions',
          desc: 'Community conversations and architectural feedback',
          path: '/feed#discussions',
          icon: MessageSquare,
        },
        {
          title: 'Reviewer Guidelines',
          desc: 'How to provide honest, constructive, and actionable ratings',
          path: '/feed#guidelines',
          icon: Info,
        },
        {
          title: 'Top Contributors',
          desc: 'Builders and reviewers shaping the ecosystem',
          path: '/leaderboard',
          icon: Award,
        },
      ],
    },
    about: {
      label: 'About',
      path: '/about',
      items: [
        {
          title: 'The IdeaPulse Manifesto',
          desc: 'Why we validate and stress-test ideas before building',
          path: '/feed#manifesto',
          icon: Info,
        },
        {
          title: 'Scoring Methodology',
          desc: 'How the 1-5 rating formula and Bayesian scoring works',
          path: '/feed#scoring',
          icon: Sparkles,
        },
        {
          title: 'Early-Hours Fairness',
          desc: 'Preventing herd bias during the first hours of voting',
          path: '/feed#fairness',
          icon: Compass,
        },
      ],
    },
  };

  return (
    <header className="sticky top-0 z-40 w-full h-16 min-h-[64px] border-b border-border bg-bg transition-colors">
      <div className="max-w-[1140px] mx-auto h-full flex items-center justify-between px-4 sm:px-6">
        {/* Left Section: Wordmark & Navigation Dropdowns */}
        <div className="flex items-center gap-6 lg:gap-8">
          <Link
            to="/"
            className="flex items-center gap-2.5 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded-[8px]"
          >
            {/* Custom Brand Mark */}
            <div className="w-8 h-8 rounded-[10px] bg-accent-strong text-accent-ink flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
              </svg>
            </div>
            <span className="font-bold text-[18px] text-ink tracking-tight leading-none">
              IdeaPulse
            </span>
          </Link>

          {/* Desktop Nav Items with Hover Dropdowns */}
          <nav aria-label="Main navigation" className="hidden lg:flex items-center gap-1">
            {Object.entries(navDropdowns).map(([key, group]) => {
              const isOpen = activeDropdown === key;
              return (
                <div
                  key={key}
                  className="relative"
                  onMouseEnter={() => handleMouseEnter(key)}
                  onMouseLeave={handleMouseLeave}
                >
                  <NavLink
                    to={group.path}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-[8px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                        isOpen || isActive
                          ? 'text-ink bg-surface-hover'
                          : 'text-ink-muted hover:text-ink hover:bg-surface-hover'
                      )
                    }
                  >
                    <span>{group.label}</span>
                    <ChevronDown
                      className={cn(
                        'w-3.5 h-3.5 transition-transform duration-150',
                        isOpen && 'rotate-180'
                      )}
                    />
                  </NavLink>

                  {/* Dropdown Menu */}
                  {isOpen && (
                    <div
                      className="absolute left-0 top-full pt-1.5 w-72 z-50 animate-in fade-in-50 duration-100"
                      role="menu"
                    >
                      <div className="rounded-[12px] border border-border-strong bg-surface-raised p-1.5">
                        {group.items.map((item) => {
                          const ItemIcon = item.icon;
                          return (
                            <Link
                              key={item.title}
                              to={item.path}
                              onClick={() => setActiveDropdown(null)}
                              className="flex items-start gap-3 p-2.5 rounded-[8px] hover:bg-surface-hover transition-colors text-left group"
                              role="menuitem"
                            >
                              <div className="w-8 h-8 rounded-[8px] bg-surface-muted flex items-center justify-center shrink-0 mt-0.5 text-ink-muted group-hover:text-accent-strong transition-colors">
                                <ItemIcon className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-ink group-hover:text-accent-strong transition-colors">
                                  {item.title}
                                </p>
                                <p className="text-xs text-ink-muted line-clamp-1 mt-0.5">
                                  {item.desc}
                                </p>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {isAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-[8px] transition-colors',
                    isActive ? 'text-accent-strong bg-accent-soft' : 'text-accent-strong hover:bg-surface-hover'
                  )
                }
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Moderation</span>
              </NavLink>
            )}
          </nav>
        </div>

        {/* Center/Right: Search field & Actions */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Search field with "/" shortcut hint */}
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="hidden sm:flex items-center gap-2 h-10 px-3 rounded-[8px] border border-border bg-surface text-xs text-ink-muted hover:border-border-strong hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring select-none min-w-[180px] lg:min-w-[220px]"
            aria-label="Search ideas (Press / to focus)"
          >
            <Search className="w-3.5 h-3.5 text-ink-faint shrink-0" />
            <span className="flex-1 text-left text-ink-faint">Search ideas...</span>
            <kbd className="px-1.5 py-0.5 text-[11px] font-mono bg-surface-muted border border-border rounded-[4px] text-ink-muted">
              /
            </kbd>
          </button>

          {/* Theme Switcher Toggle (Light, Dark, System) with Tooltip */}
          <button
            type="button"
            onClick={cycleTheme}
            className="hidden sm:flex w-10 h-10 min-w-[40px] min-h-[40px] rounded-[8px] border border-border bg-surface items-center justify-center hover:bg-surface-hover hover:border-border-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring text-ink"
            title={themeLabel()}
            aria-label={themeLabel()}
          >
            {themeIcon()}
          </button>

          {/* "Post an idea" Verb Button */}
          <Link to="/submit" className="hidden sm:inline-flex">
            <Button size="default" className="h-10 min-h-[40px] px-3.5 text-sm font-semibold rounded-[8px] gap-1.5">
              <Plus className="w-4 h-4" />
              <span>Post an idea</span>
            </Button>
          </Link>

          {/* User Account / Sign In */}
          {isAuthenticated ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-1.5 p-1 rounded-full hover:ring-2 hover:ring-border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                aria-label={`${user?.name || 'User'} menu`}
                aria-expanded={userMenuOpen}
              >
                <AuthorAvatar name={user?.name} avatarUrl={user?.avatar_url} size="sm" />
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div
                    className="absolute right-0 mt-2 w-56 rounded-[12px] border border-border-strong bg-surface-raised p-1.5 z-50 text-sm"
                    role="menu"
                  >
                    <div className="px-3 py-2 border-b border-border">
                      <p className="font-semibold text-ink truncate">{user?.name}</p>
                      <p className="text-xs text-ink-muted truncate">{user?.email}</p>
                    </div>

                    <div className="py-1">
                      <Link
                        to={`/profile/${user?.id}`}
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center px-3 py-2 rounded-[8px] hover:bg-surface-hover text-ink transition-colors font-medium text-sm"
                        role="menuitem"
                      >
                        My Profile & Ratings
                      </Link>
                      {isAdmin && (
                        <Link
                          to="/admin"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center px-3 py-2 rounded-[8px] hover:bg-surface-hover text-accent-strong transition-colors font-medium text-sm"
                          role="menuitem"
                        >
                          Moderation Queue
                        </Link>
                      )}
                    </div>

                    <div className="pt-1 border-t border-border">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full text-left px-3 py-2 rounded-[8px] text-danger hover:bg-danger-soft transition-colors font-medium text-sm"
                        role="menuitem"
                      >
                        Sign out
                      </button>
                      <button
                        type="button"
                        onClick={handleLogoutAll}
                        className="w-full text-left px-3 py-2 rounded-[8px] text-ink-muted hover:bg-surface-hover hover:text-ink transition-colors text-xs"
                        role="menuitem"
                      >
                        Sign out of all devices
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Link to="/login">
                <Button variant="ghost" size="sm" className="h-10 min-h-[40px] px-2.5 sm:px-3 text-xs sm:text-sm font-semibold">
                  Sign in
                </Button>
              </Link>
            </div>
          )}

          {/* Mobile Search & Menu Toggle: 44px tap targets */}
          <div className="flex items-center gap-1 lg:hidden">
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="w-10 h-10 sm:w-11 sm:h-11 min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] rounded-[8px] border border-border bg-surface flex items-center justify-center text-ink hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-10 h-10 sm:w-11 sm:h-11 min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] rounded-[8px] border border-border bg-surface flex items-center justify-center text-ink hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-border bg-surface px-4 py-4 space-y-4">
          <Link
            to="/submit"
            onClick={() => setMobileMenuOpen(false)}
            className="w-full py-2.5 px-4 text-sm font-semibold rounded-[8px] bg-accent-strong text-accent-ink block min-h-[44px] flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Post an idea</span>
          </Link>

          <nav aria-label="Mobile navigation" className="flex flex-col space-y-1">
            <NavLink
              to="/feed"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2.5 text-sm font-medium text-ink hover:bg-surface-hover rounded-[8px] min-h-[44px] flex items-center"
            >
              Ideas
            </NavLink>
            <NavLink
              to="/leaderboard"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2.5 text-sm font-medium text-ink hover:bg-surface-hover rounded-[8px] min-h-[44px] flex items-center"
            >
              Leaderboard
            </NavLink>
            {isAdmin && (
              <NavLink
                to="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 text-sm font-medium text-accent-strong hover:bg-surface-hover rounded-[8px] min-h-[44px] flex items-center gap-2"
              >
                <Shield className="w-4 h-4" /> Moderation
              </NavLink>
            )}
            <button
              type="button"
              onClick={cycleTheme}
              className="px-3 py-2.5 text-sm font-medium text-ink hover:bg-surface-hover rounded-[8px] min-h-[44px] flex items-center justify-between w-full text-left"
            >
              <span className="flex items-center gap-2">
                {themeIcon()}
                <span>{themeLabel()}</span>
              </span>
              <span className="text-xs text-ink-muted">Tap to switch</span>
            </button>
          </nav>

          <div className="pt-3 border-t border-border">
            {isAuthenticated ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 px-2">
                  <AuthorAvatar name={user?.name} avatarUrl={user?.avatar_url} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink truncate">{user?.name}</p>
                    <p className="text-xs text-ink-muted truncate">{user?.email}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link
                    to={`/profile/${user?.id}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex-1 text-center py-2.5 text-xs font-semibold rounded-[8px] border border-border min-h-[44px] flex items-center justify-center hover:bg-surface-hover text-ink"
                  >
                    My Profile
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-4 py-2.5 text-xs font-semibold rounded-[8px] border border-border text-danger min-h-[44px] flex items-center justify-center hover:bg-danger-soft"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="secondary" size="default" className="w-full text-sm h-11 rounded-[8px]">
                    Sign in
                  </Button>
                </Link>
                <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="primary" size="default" className="w-full text-sm h-11 rounded-[8px]">
                    Sign up
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
