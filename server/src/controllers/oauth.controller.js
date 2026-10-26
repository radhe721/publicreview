import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import db from '../config/db.js';
import { env } from '../config/env.js';
import { setAuthCookie, baseCookieOptions } from '../middleware/auth.js';

const STATE_COOKIE = 'ideapulse_oauth';
const STATE_COOKIE_PATH = '/api/v1/auth/oauth';
const STATE_TTL_SECONDS = 10 * 60;

// Marker stored in users.password_hash for accounts without a password. It is not a bcrypt
// hash, so password login can never succeed against it.
export const NO_PASSWORD = '!oauth';

const providers = {
  google: {
    clientId: () => env.GOOGLE_CLIENT_ID,
    clientSecret: () => env.GOOGLE_CLIENT_SECRET,
    usePkce: true,
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    authorizeParams: { scope: 'openid email profile', prompt: 'select_account' },
    async fetchProfile(code, redirectUri, codeVerifier) {
      const token = await postForm('https://oauth2.googleapis.com/token', {
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier
      });
      const info = await getJson('https://openidconnect.googleapis.com/v1/userinfo', token.access_token);
      return {
        providerUserId: String(info.sub),
        email: info.email_verified === true ? info.email : null,
        name: info.name || info.given_name,
        avatarUrl: info.picture
      };
    }
  },
  github: {
    clientId: () => env.GITHUB_CLIENT_ID,
    clientSecret: () => env.GITHUB_CLIENT_SECRET,
    usePkce: false,
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    authorizeParams: { scope: 'read:user user:email', allow_signup: 'true' },
    async fetchProfile(code, redirectUri) {
      const token = await postForm('https://github.com/login/oauth/access_token', {
        code,
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        redirect_uri: redirectUri
      });
      const profile = await getJson('https://api.github.com/user', token.access_token);
      const emails = await getJson('https://api.github.com/user/emails', token.access_token);
      const primary = Array.isArray(emails) ? emails.find((e) => e.primary && e.verified) : null;
      return {
        providerUserId: String(profile.id),
        email: primary ? primary.email : null,
        name: profile.name || profile.login,
        avatarUrl: profile.avatar_url
      };
    }
  }
};

async function postForm(url, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(10000)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`OAuth token exchange failed (${res.status}): ${data.error || 'no access token'}`);
  }
  return data;
}

async function getJson(url, accessToken) {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'IdeaPulse'
    },
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) {
    throw new Error(`OAuth profile request failed (${res.status}) for ${url}`);
  }
  return res.json();
}

function isConfigured(name) {
  const p = providers[name];
  return Boolean(p && p.clientId() && p.clientSecret());
}

function callbackUrl(req, provider) {
  const base = env.SERVER_URL || `${req.protocol}://${req.get('host')}`;
  return `${base}/api/v1/auth/oauth/${provider}/callback`;
}

// Only same-site relative paths, so the redirect can't be used to bounce users to another domain.
function safeRedirectPath(value) {
  if (typeof value !== 'string' || value.length > 200 || !/^\/(?![/\\])/.test(value)) {
    return '/feed';
  }
  return value;
}

function redirectToClient(res, pathWithQuery) {
  res.redirect(302, `${env.CLIENT_URL}${pathWithQuery}`);
}

function failRedirect(res, code) {
  redirectToClient(res, `/login?error=${encodeURIComponent(code)}`);
}

function base64url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

export function getProviders(req, res) {
  res.json({
    success: true,
    data: {
      providers: {
        google: isConfigured('google'),
        github: isConfigured('github')
      }
    }
  });
}

export function startOAuth(req, res) {
  const { provider } = req.params;
  if (!isConfigured(provider)) {
    return failRedirect(res, 'oauth_unavailable');
  }

  const config = providers[provider];
  const state = base64url(crypto.randomBytes(32));
  const codeVerifier = config.usePkce ? base64url(crypto.randomBytes(48)) : undefined;

  // The state, PKCE verifier and post-login destination travel in a short-lived signed cookie,
  // so the callback can prove it was started by this browser (login CSRF protection).
  const statePayload = jwt.sign(
    { state, cv: codeVerifier, rd: safeRedirectPath(req.query.redirect), p: provider },
    env.JWT_SECRET,
    { expiresIn: STATE_TTL_SECONDS, algorithm: 'HS256' }
  );
  // Lax (not None) so the cookie survives the top-level redirect back from the provider.
  res.cookie(STATE_COOKIE, statePayload, {
    ...baseCookieOptions,
    sameSite: 'lax',
    path: STATE_COOKIE_PATH,
    maxAge: STATE_TTL_SECONDS * 1000
  });

  const params = new URLSearchParams({
    client_id: config.clientId(),
    redirect_uri: callbackUrl(req, provider),
    response_type: 'code',
    state,
    ...config.authorizeParams
  });
  if (codeVerifier) {
    params.set('code_challenge', base64url(crypto.createHash('sha256').update(codeVerifier).digest()));
    params.set('code_challenge_method', 'S256');
  }

  res.redirect(302, `${config.authorizeUrl}?${params.toString()}`);
}

function normalizeName(name) {
  const clean = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 50);
  return clean.length >= 2 ? clean : 'IdeaPulse member';
}

function normalizeAvatar(url, name) {
  if (typeof url === 'string' && url.startsWith('https://') && url.length <= 500) {
    return url;
  }
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=0284c7,0d9488,4f46e5`;
}

/**
 * Finds the user for a provider identity, linking or creating as needed.
 * Linking to an existing email/password account only happens with a provider-verified email.
 * Because IdeaPulse does not verify emails at signup, someone could have pre-registered that
 * email with a password; so on first link the password is disabled and old sessions revoked,
 * leaving the verified owner as the only one who can sign in.
 */
export async function findOrCreateOAuthUser(provider, profile) {
  return db.transaction(async (tx) => {
    const linked = await tx.prepare(`
      SELECT u.* FROM oauth_accounts oa JOIN users u ON u.id = oa.user_id
      WHERE oa.provider = ? AND oa.provider_user_id = ?
    `).get(provider, profile.providerUserId);
    if (linked) {
      return linked;
    }

    const email = profile.email.toLowerCase();
    const existing = await tx.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(email);
    let userId;

    if (existing) {
      userId = existing.id;
      await tx.prepare(`
        UPDATE users
        SET password_hash = ?, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND password_hash != ?
      `).run(NO_PASSWORD, userId, NO_PASSWORD);
    } else {
      const name = normalizeName(profile.name);
      const result = await tx.prepare(`
        INSERT INTO users (name, email, password_hash, role, avatar_url)
        VALUES (?, ?, ?, 'user', ?)
      `).run(name, email, NO_PASSWORD, normalizeAvatar(profile.avatarUrl, name));
      userId = result.lastInsertRowid;
    }

    // UNIQUE(user_id, provider): an account already linked to a *different* identity of the same
    // provider must not silently gain a second one.
    await tx.prepare(`
      INSERT INTO oauth_accounts (user_id, provider, provider_user_id, email) VALUES (?, ?, ?, ?)
    `).run(userId, provider, profile.providerUserId, email);

    return tx.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  });
}

export async function oauthCallback(req, res) {
  const { provider } = req.params;
  const cookie = req.cookies?.[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE, { ...baseCookieOptions, sameSite: 'lax', path: STATE_COOKIE_PATH });

  if (!isConfigured(provider)) {
    return failRedirect(res, 'oauth_unavailable');
  }
  if (req.query.error) {
    // The user cancelled on the provider's consent screen.
    return failRedirect(res, 'oauth_cancelled');
  }

  let saved;
  try {
    saved = jwt.verify(cookie || '', env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return failRedirect(res, 'oauth_state');
  }
  if (saved.p !== provider || typeof req.query.state !== 'string' || !safeEqual(saved.state, req.query.state)) {
    return failRedirect(res, 'oauth_state');
  }
  if (typeof req.query.code !== 'string' || !req.query.code) {
    return failRedirect(res, 'oauth_failed');
  }

  try {
    const profile = await providers[provider].fetchProfile(req.query.code, callbackUrl(req, provider), saved.cv);
    if (!profile.email) {
      return failRedirect(res, 'oauth_email_unverified');
    }

    const user = await findOrCreateOAuthUser(provider, profile);
    setAuthCookie(res, user);
    redirectToClient(res, safeRedirectPath(saved.rd));
  } catch (err) {
    if (String(err.message).includes('UNIQUE constraint failed: oauth_accounts.user_id')) {
      return failRedirect(res, 'oauth_account_conflict');
    }
    if (process.env.NODE_ENV !== 'test') {
      console.error(`OAuth ${provider} callback failed:`, err.message);
    }
    failRedirect(res, 'oauth_failed');
  }
}
