import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

function Section({ id, title, children }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="space-y-3 pt-6 border-t border-border scroll-mt-24">
      <h2 id={`${id}-heading`} className="text-lg font-bold text-ink">{title}</h2>
      <div className="space-y-3 text-sm sm:text-[15px] text-ink-muted leading-relaxed">{children}</div>
    </section>
  );
}

export function AboutPage() {
  const { hash } = useLocation();

  // Jump to #ranking, #guidelines, #rules when linked from the menu.
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  return (
    <div className="min-h-screen bg-bg text-ink py-8 sm:py-12">
      <main className="max-w-[720px] mx-auto px-4 sm:px-6 space-y-8">
        <header className="space-y-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">About BusinessListe</h1>
          <p className="text-base text-ink-muted leading-relaxed">
            BusinessListe is where founders find out if real people would pay for their SaaS idea, before they build it.
            Post your idea, and within about a week you see how many people would pay, how much, and who they are.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link to="/submit"><Button className="h-10 rounded-[8px] gap-1.5">Post an idea <ArrowRight className="w-4 h-4" /></Button></Link>
            <Link to="/feed?sort=needs_votes"><Button variant="secondary" className="h-10 rounded-[8px]">Rate ideas that need votes</Button></Link>
          </div>
        </header>

        <Section id="why" title="Why it exists">
          <p>
            Most products fail because nobody wants them, not because they were built badly. Other idea sites sell you ideas
            written by someone else, or an AI opinion. BusinessListe asks real people one question that matters:
            <strong className="text-ink"> would you pay for this, and how much?</strong>
          </p>
          <p>
            <strong className="text-ink">Every number on the site is real.</strong> No fake users and no fake votes. Ideas the
            BusinessListe team added to get things started are labelled <em>Posted by BusinessListe Team</em>.
          </p>
        </Section>

        <Section id="who" title="Who it is for">
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong className="text-ink">Founders and indie hackers</strong> who want proof of demand before building.</li>
            <li><strong className="text-ink">Builders</strong> looking for a validated idea or an open-source SaaS to build on.</li>
            <li><strong className="text-ink">Raters</strong> (founders, operators, freelancers) who enjoy judging ideas honestly.</li>
          </ul>
        </Section>

        <Section id="ranking" title="How ranking works">
          <p>Each idea collects two kinds of votes:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong className="text-ink">Demand:</strong> Not for me · I'd try it · I'd pay for it, plus a monthly price range. This is shown as "% would pay", median price, votes and waitlist size.</li>
            <li><strong className="text-ink">Rating:</strong> 1 to 5 stars, plus four quick questions (is the problem real, would the buyer pay, is the price right, known competitors).</li>
          </ul>
          <p>
            <strong className="text-ink">An idea needs at least 5 ratings to appear in Top lists.</strong> Until then it shows
            "New, needs 5 votes".
          </p>
          <p>
            The ranking score is a weighted average that starts every idea with 5 "average" votes (the same idea IMDb uses).
            Ideas with few votes are pulled toward the site average, so 2 votes of 5.0 cannot beat 40 votes of 4.6:
          </p>
          <pre className="text-xs bg-surface border border-border rounded-[8px] p-3 overflow-x-auto text-ink">
score = (sum of weighted ratings + 5 × site average) / (weighted vote count + 5)
          </pre>
          <p>
            Votes from accounts younger than 24 hours, or with no profile (no bio and no role), count half. Top Today, Week,
            Month and All time use the same score, counting only ratings cast in that period.
          </p>
        </Section>

        <Section id="fairness" title="Keeping votes honest">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>One vote per account per idea. Founders cannot vote on their own ideas.</li>
            <li>A sudden burst of votes from new accounts is held for review and does not count until a moderator approves it.</li>
            <li>Posting and voting are rate limited.</li>
            <li>Waitlist emails are shared with a founder only when the voter ticks the box to share them.</li>
          </ul>
        </Section>

        <Section id="guidelines" title="Reviewer guidelines">
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong className="text-ink">Be honest.</strong> "Not for me" is useful. A polite yes that would never turn into a payment is not.</li>
            <li><strong className="text-ink">Be specific.</strong> Say what would make you pay, which competitor you use, and what price feels right.</li>
            <li><strong className="text-ink">Be kind.</strong> Judge the idea, not the person.</li>
            <li><strong className="text-ink">Set your role</strong> on your profile, so founders see who would pay.</li>
          </ul>
        </Section>

        <Section id="rules" title="Rules">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>No spam and no ads disguised as ideas.</li>
            <li>No hate or harassment.</li>
            <li>No posting someone else's idea as your own.</li>
            <li>Ideas posted here are public. Do not post anything you need to keep secret.</li>
          </ul>
          <p>Use the flag button on any idea to report it. Moderators review every report.</p>
        </Section>
      </main>
    </div>
  );
}
