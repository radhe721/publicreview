import bcrypt from 'bcryptjs';
import db from '../config/db.js';
import { setAuthCookie, clearAuthCookie } from '../middleware/auth.js';

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

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

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
    if (!userWithHash) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid email or password.' }
      });
    }

    const isMatch = await bcrypt.compare(password, userWithHash.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid email or password.' }
      });
    }

    const { password_hash, ...user } = userWithHash;
    setAuthCookie(res, user);

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
