import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import db from '../config/db.js';

export const COOKIE_NAME = 'ideapulse_token';

export function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function setAuthCookie(res, user) {
  const token = signToken(user);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  return token;
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax'
  });
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
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const user = await db.prepare('SELECT id, name, email, role, avatar_url, bio FROM users WHERE id = ?').get(decoded.id);

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
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const user = await db.prepare('SELECT id, name, email, role, avatar_url, bio FROM users WHERE id = ?').get(decoded.id);
    req.user = user || null;
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
