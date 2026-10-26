import { env } from '../config/env.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const devOrigins = ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

export const allowedOrigins = new Set(
  [...env.CLIENT_URLS, ...(env.NODE_ENV === 'production' ? [] : devOrigins)].map((o) => o.replace(/\/$/, ''))
);

export function isAllowedOrigin(origin) {
  return allowedOrigins.has(String(origin).replace(/\/$/, ''));
}

function originFromReferer(referer) {
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

/**
 * Blocks cross-site request forgery. Auth cookies are SameSite=None in production, so a
 * malicious page could otherwise submit a form to this API with the victim's session.
 * Browsers always attach Origin (or at least Referer) to cross-site state-changing requests,
 * so any unsafe request whose origin is neither an allowed client nor this server is rejected.
 * Requests with neither header come from non-browser clients (curl, server-to-server), which
 * cannot ride on a victim's browser cookies.
 */
export function csrfProtection(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const origin = req.get('origin') || (req.get('referer') && originFromReferer(req.get('referer')));
  if (!origin) {
    return next();
  }

  const selfOrigin = `${req.protocol}://${req.get('host')}`;
  if (origin === selfOrigin || isAllowedOrigin(origin)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: { message: 'Cross-origin request blocked.' }
  });
}
