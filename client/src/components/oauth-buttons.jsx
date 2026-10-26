import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api, { API_HOST } from '@/api/client';

const OAUTH_ERRORS = {
  oauth_unavailable: 'That sign-in method is not available right now.',
  oauth_cancelled: 'Sign-in was cancelled.',
  oauth_state: 'Your sign-in session expired. Please try again.',
  oauth_email_unverified: 'Your account needs a verified email address to sign in.',
  oauth_account_conflict: 'This IdeaPulse account is already linked to a different account with that provider.',
  oauth_failed: 'We could not complete sign-in. Please try again.',
};

export function oauthErrorMessage(code) {
  return code ? OAUTH_ERRORS[code] || OAUTH_ERRORS.oauth_failed : null;
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.82-.07-1.6-.2-2.36H12v4.46h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.72z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.29 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.28a12 12 0 0 0 0 10.78l4.01-3.1z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.28 6.61l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
      <path d="M12 .5a12 12 0 0 0-3.8 23.39c.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .5z" />
    </svg>
  );
}

const PROVIDERS = [
  { id: 'google', label: 'Continue with Google', Icon: GoogleIcon },
  { id: 'github', label: 'Continue with GitHub', Icon: GitHubIcon },
];

export function OAuthButtons({ redirectPath = '/feed' }) {
  const { data } = useQuery({
    queryKey: ['auth-providers'],
    queryFn: () => api.get('/auth/providers'),
    staleTime: 1000 * 60 * 10,
  });

  const enabled = PROVIDERS.filter((p) => data?.data?.providers?.[p.id]);
  if (enabled.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {enabled.map(({ id, label, Icon }) => (
          // A full-page navigation (not fetch): the API redirects to the provider's consent screen.
          <a
            key={id}
            href={`${API_HOST}/api/v1/auth/oauth/${id}?redirect=${encodeURIComponent(redirectPath)}`}
            className="w-full h-11 rounded-[8px] border border-border-strong bg-surface text-ink hover:bg-surface-hover transition-colors text-sm font-semibold flex items-center justify-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <Icon />
            <span>{label}</span>
          </a>
        ))}
      </div>

      <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
        <span className="h-px flex-1 bg-border" />
        <span>or with email</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
