import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import db from '../config/db.js';

export const COOKIE_NAME = 'ideapulse_token';

const isProd = env.NODE_ENV === 'production';

// SameSite=None is required when the client and API live on different sites (e.g. Vercel + Render).
// Cross-site request forgery is blocked separately by the Origin check in middleware/csrf.js.
export const baseCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax',
  path: '/'
};

export function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, tv: Number(user.token_version || 0) },
    env.JWT_SECRET,
    { expiresIn: '7d', algorithm: 'HS256' }
  );
}

export function setAuthCookie(res, user) {
  const token = signToken(user);
  res.cookie(COOKIE_NAME, token, {
    ...baseCookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  return token;
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, baseCookieOptions);
}

const USER_COLUMNS = 'id, name, email, role, avatar_url, bio, role_tag, industry, created_at, token_version';

// Returns the user for a valid token, or null. Tokens issued before the user's
// token_version was bumped (logout-everywhere, password invalidation) are rejected.
async function userFromToken(token) {
  const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  const user = await db.prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(decoded.id);
  if (!user || Number(user.token_version || 0) !== Number(decoded.tv || 0)) {
    return null;
  }
  const { token_version, ...publicUser } = user;
  return publicUser;
}

function extractToken(req) {
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    return req.cookies[COOKIE_NAME];
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

export async function requireAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: { message: 'Authentication required. Please log in.' }
    });
  }

  try {
    const user = await userFromToken(token);

    if (!user) {
      clearAuthCookie(res);
      return res.status(401).json({
        success: false,
        error: { message: 'User session no longer valid.' }
      });
    }

    req.user = user;
    next();
  } catch (err) {
    clearAuthCookie(res);
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid or expired authentication session.' }
    });
  }
}

export async function optionalAuth(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    req.user = await userFromToken(token);
  } catch {
    req.user = null;
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: { message: 'Admin access required.' }
    });
  }
  next();
}
