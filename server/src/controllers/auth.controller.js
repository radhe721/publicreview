import bcrypt from 'bcryptjs';
import db from '../config/db.js';
import { setAuthCookie, clearAuthCookie } from '../middleware/auth.js';

// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer-not-a-real-password', 10);

const isPasswordHash = (hash) => typeof hash === 'string' && hash.startsWith('$2');

export async function register(req, res, next) {
  try {
    const { name, email, password, bio } = req.body;

    const existing = await db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { message: 'An account with this email address already exists.' }
      });
    }

    const password_hash = await bcrypt.hash(password, 12);

    // Default avatar
    const avatar_url = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=0284c7,0d9488,4f46e5`;

    const stmt = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, avatar_url, bio)
      VALUES (?, LOWER(?), ?, 'user', ?, ?)
    `);

    const result = await stmt.run(name, email, password_hash, avatar_url, bio || null);
    const user = await db.prepare('SELECT id, name, email, role, avatar_url, bio, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);

    setAuthCookie(res, user);

    res.status(201).json({
      success: true,
      data: { user }
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const userWithHash = await db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email);
    const hasPassword = userWithHash && isPasswordHash(userWithHash.password_hash);

    const isMatch = await bcrypt.compare(password, hasPassword ? userWithHash.password_hash : DUMMY_HASH);
    if (!hasPassword || !isMatch) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid email or password.' }
      });
    }

    const { password_hash, token_version, ...user } = userWithHash;
    setAuthCookie(res, userWithHash);

    res.json({
      success: true,
      data: { user }
    });
  } catch (err) {
    next(err);
  }
}

export function logout(req, res) {
  clearAuthCookie(res);
  res.json({
    success: true,
    message: 'Logged out successfully.'
  });
}

// Signs the user out on every device by invalidating all previously issued tokens.
export async function logoutAll(req, res, next) {
  try {
    await db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').run(req.user.id);
    clearAuthCookie(res);
    res.json({
      success: true,
      message: 'Signed out of all devices.'
    });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req, res, next) {
  try {
    if (!req.user) {
      return res.json({
        success: true,
        data: { user: null }
      });
    }

    const stats = await db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM ideas WHERE user_id = ?) AS ideas_count,
        (SELECT COUNT(*) FROM ratings WHERE user_id = ?) AS ratings_count,
        (
          SELECT ROUND(COALESCE(AVG(CAST(r.score AS REAL)), 0.0), 2)
          FROM ratings r
          JOIN ideas i ON r.idea_id = i.id
          WHERE i.user_id = ?
        ) AS avg_received_score
    `).get(req.user.id, req.user.id, req.user.id);

    res.json({
      success: true,
      data: {
        user: {
          ...req.user,
          stats: {
            ideas_count: Number(stats?.ideas_count || 0),
            ratings_count: Number(stats?.ratings_count || 0),
            avg_received_score: Number(stats?.avg_received_score || 0)
          }
        }
      }
    });
  } catch (err) {
    next(err);
  }
}
