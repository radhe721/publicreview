import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function CookieBanner() {
  const [choice, setChoice] = useState(() => {
    try { return localStorage.getItem('cookie_consent'); } catch { return 'declined'; }
  });
  if (choice) return null;

  const decide = (value) => {
    try { localStorage.setItem('cookie_consent', value); } catch { /* private mode */ }
    if (value === 'accepted' && typeof window.gtag === 'function') {
      window.gtag('consent', 'update', { analytics_storage: 'granted' });
    }
    setChoice(value);
  };

  return (
    <div role="region" aria-label="Cookie choice" className="fixed bottom-3 inset-x-3 sm:left-auto sm:right-4 sm:max-w-sm z-50 p-4 rounded-[12px] border border-border-strong bg-surface-raised text-ink shadow-lg space-y-3">
      <p className="text-xs leading-relaxed">
        We use one cookie to keep you signed in. Analytics cookies are optional and off until you accept. <Link to="/cookies" className="underline">Details</Link>
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" className="rounded-[8px] flex-1" onClick={() => decide('declined')}>Decline</Button>
        <Button size="sm" className="rounded-[8px] flex-1" onClick={() => decide('accepted')}>Accept analytics</Button>
      </div>
    </div>
  );
}
