import React from 'react';
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-border mt-auto py-12 px-4 sm:px-6 bg-surface text-ink-muted">
      <div className="max-w-[1140px] mx-auto">
        {/* Multi-column Link Groups */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Column 1: Categories */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-ink mb-3.5">
              Categories
            </p>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/feed?category=Tech" className="hover:text-ink transition-colors">
                  Developer Tools & AI
                </Link>
              </li>
              <li>
                <Link to="/feed?category=Design" className="hover:text-ink transition-colors">
                  Design Systems & UI
                </Link>
              </li>
              <li>
                <Link to="/feed?category=Social" className="hover:text-ink transition-colors">
                  Community & Social
                </Link>
              </li>
              <li>
                <Link to="/feed?category=Education" className="hover:text-ink transition-colors">
                  Education & Learning
                </Link>
              </li>
              <li>
                <Link to="/feed?category=Business" className="hover:text-ink transition-colors">
                  Business & SaaS
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Trending Ideas */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-ink mb-3.5">
              Trending Ideas
            </p>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/feed?sort=trending" className="hover:text-ink transition-colors">
                  Today's Breakouts
                </Link>
              </li>
              <li>
                <Link to="/feed?sort=top" className="hover:text-ink transition-colors">
                  Most Upvoted
                </Link>
              </li>
              <li>
                <Link to="/feed?sort=newest" className="hover:text-ink transition-colors">
                  Fresh Submissions
                </Link>
              </li>
              <li>
                <Link to="/feed?sort=most_rated" className="hover:text-ink transition-colors">
                  Most Critiqued
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Top Rated */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-ink mb-3.5">
              Top Rated
            </p>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/leaderboard?timeframe=daily" className="hover:text-ink transition-colors">
                  Daily Leaderboard
                </Link>
              </li>
              <li>
                <Link to="/leaderboard?timeframe=week" className="hover:text-ink transition-colors">
                  Weekly Leaders
                </Link>
              </li>
              <li>
                <Link to="/leaderboard?timeframe=month" className="hover:text-ink transition-colors">
                  Monthly Top 20
                </Link>
              </li>
              <li>
                <Link to="/leaderboard?timeframe=all" className="hover:text-ink transition-colors">
                  All-Time Hall of Fame
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Community */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-ink mb-3.5">
              Community
            </p>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/submit" className="hover:text-ink transition-colors font-semibold text-accent-strong">
                  Post an idea
                </Link>
              </li>
              <li>
                <Link to="/discussions" className="hover:text-ink transition-colors">
                  Discussions
                </Link>
              </li>
              <li>
                <Link to="/cofounders" className="hover:text-ink transition-colors">
                  Co-founder board
                </Link>
              </li>
              <li>
                <Link to="/contributors" className="hover:text-ink transition-colors">
                  Top Contributors
                </Link>
              </li>
              <li>
                <Link to="/launched" className="hover:text-ink transition-colors">
                  Launched products
                </Link>
              </li>
              <li>
                <Link to="/about#guidelines" className="hover:text-ink transition-colors">
                  Reviewer Guidelines
                </Link>
              </li>
              <li>
                <Link to="/about#ranking" className="hover:text-ink transition-colors">
                  How ranking works
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-ink transition-colors">
                  About BusinessListe
                </Link>
              </li>
              <li>
                <Link to="/repos" className="hover:text-ink transition-colors">
                  Open-Source SaaS
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Small Print Bottom Bar */}
        <div className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink-faint">
          <div className="flex items-center gap-2">
            <span className="font-bold text-ink">BusinessListe</span>
            <span>•</span>
            <span>Find out if real people would pay for your idea, before you build it.</span>
          </div>
          <div>
            <span className="flex flex-wrap gap-3">
              <Link to="/pricing" className="hover:text-ink underline">Pricing</Link>
              <Link to="/terms" className="hover:text-ink underline">Terms</Link>
              <Link to="/privacy" className="hover:text-ink underline">Privacy</Link>
              <Link to="/cookies" className="hover:text-ink underline">Cookies</Link>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
