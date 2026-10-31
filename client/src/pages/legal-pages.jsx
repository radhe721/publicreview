import React from 'react';
import { Link } from 'react-router-dom';
import { Page } from './community-pages';

const P = ({ children }) => <p className="text-sm text-ink-muted leading-relaxed">{children}</p>;
const H = ({ children }) => <h2 className="text-base font-bold text-ink pt-2">{children}</h2>;

export function TermsPage() {
  return (
    <Page title="Terms of Use" intro="Last updated 1 November 2026. Plain English.">
      <H>Ideas you post are public</H>
      <P>Anything you publish (ideas, comments, feedback, shared repos) can be read by anyone. Do not post anything you need to keep secret. Drafts stay private until you publish them.</P>
      <H>Be honest and fair</H>
      <P>One account per person. Do not buy, trade or fake votes, and do not vote on your own ideas. We may hold, remove or discount votes that look fake, and suspend accounts that break these rules.</P>
      <H>Content rules</H>
      <P>No spam, no ads disguised as ideas, no hate or harassment, and no posting someone else's idea as your own. Content reported by 3 people is hidden until a moderator reviews it. See the <Link to="/about#rules" className="text-accent-strong underline">rules</Link>.</P>
      <H>Paid features</H>
      <P>Validation Reports, Pro and Featured spots are paid through Stripe. A report that gets under 25 votes after its free 7-day extension is refunded in full. Pro renews only when you buy it again.</P>
      <H>No guarantees</H>
      <P>Votes show what people say they would do, not what they will do. Use the results as one input, not a promise of sales. Open-source projects listed here belong to their owners; check each license yourself.</P>
    </Page>
  );
}

export function PrivacyPage() {
  return (
    <Page title="Privacy Policy" intro="Last updated 1 November 2026.">
      <H>What we store</H>
      <P>Your name, email, profile details you add (bio, role, industry, country), your votes, feedback and comments. Sign-in with Google or GitHub shares your name, email and photo with us. We never see or store your Google or GitHub password.</P>
      <H>Who sees your email</H>
      <P>Only us, unless you tick "Join the launch waitlist" on an idea: then that idea's founder sees your name and email. Landing page signups go only to that idea's founder.</P>
      <H>Payments and revenue</H>
      <P>Payments are handled by Stripe; we never see your card number. If a founder verifies revenue, we read their monthly revenue once with a read-only key and never store the key.</P>
      <H>Analytics and cookies</H>
      <P>We count idea page views by the website a visitor came from, without personal data. Google Analytics runs only if you accept analytics cookies. See the <Link to="/cookies" className="text-accent-strong underline">cookie notice</Link>.</P>
      <H>Emails</H>
      <P>We send notifications you can turn off on the <Link to="/notifications" className="text-accent-strong underline">notifications page</Link>, and a weekly email with an unsubscribe link in every message.</P>
      <H>Your rights</H>
      <P>You can ask us to export or delete your account and data at any time by contacting us through the site.</P>
    </Page>
  );
}

export function CookiesPage() {
  const reset = () => { localStorage.removeItem('cookie_consent'); window.location.reload(); };
  return (
    <Page title="Cookie notice" intro="Last updated 1 November 2026.">
      <H>Needed cookies</H>
      <P>One sign-in cookie keeps you logged in. It is required for the site to work and is never used for tracking.</P>
      <H>Optional analytics</H>
      <P>Google Analytics helps us see which pages are useful. It is off until you click "Accept analytics" in the cookie banner.</P>
      <button type="button" onClick={reset} className="text-sm text-accent-strong underline">Change my cookie choice</button>
    </Page>
  );
}
