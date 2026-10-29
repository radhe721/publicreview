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
                <Link to="/feed#discussions" className="hover:text-ink transition-colors">
                  Community Discussions
                </Link>
              </li>
              <li>
                <Link to="/feed#guidelines" className="hover:text-ink transition-colors">
                  Critique Guidelines
                </Link>
              </li>
              <li>
                <Link to="/feed#fairness" className="hover:text-ink transition-colors">
                  Early-Hours Fairness
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
            <span>A clean, ranked-list community where the list is the hero.</span>
          </div>
          <div>
            <span>Typeset in Plus Jakarta Sans. Built with tokens and zero hardcoded colors.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
