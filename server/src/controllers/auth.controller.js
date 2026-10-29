import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import db from '../config/db.js';
import { env } from '../config/env.js';
import { setAuthCookie, clearAuthCookie } from '../middleware/auth.js';
import { sendMail } from '../services/mailer.js';

// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer-not-a-real-password', 10);

const isPasswordHash = (hash) => typeof hash === 'string' && hash.startsWith('$2');

const RESET_TOKEN_TTL_MINUTES = 60;
const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

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

const FORGOT_PASSWORD_RESPONSE = {
  success: true,
  message: 'If an account exists for that email, a password reset link is on its way.'
};

// Always answers the same way so the endpoint can't be used to discover which emails have accounts.
export async function forgotPassword(req, res, next) {
  try {
    const user = await db.prepare('SELECT id, name, email FROM users WHERE LOWER(email) = LOWER(?)').get(req.body.email);
    if (!user) {
      return res.json(FORGOT_PASSWORD_RESPONSE);
    }

    const token = crypto.randomBytes(32).toString('hex');
    await db.transaction(async (tx) => {
      // Only the newest link works.
      await tx.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);
      await tx.prepare(`
        INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
        VALUES (?, ?, datetime('now', ?))
      `).run(user.id, hashResetToken(token), `+${RESET_TOKEN_TTL_MINUTES} minutes`);
    });

    // In the fragment, not the query string: fragments never reach servers, Referer headers or
    // analytics page_location, so the token stays in the user's browser.
    const link = `${env.CLIENT_URL}/reset-password#token=${token}`;
    // Not awaited: waiting on the mail provider would make known emails measurably slower.
    sendMail({
      to: user.email,
      subject: 'Reset your BusinessListe password',
      text: `Hi ${user.name},\n\nSomeone asked to reset the password for your BusinessListe account. ` +
        `Open this link within ${RESET_TOKEN_TTL_MINUTES} minutes to choose a new one:\n\n${link}\n\n` +
        `If you didn't ask for this, you can ignore this email; your password won't change.`,
      html: `<p>Hi ${escapeHtml(user.name)},</p>` +
        `<p>Someone asked to reset the password for your BusinessListe account. ` +
        `Open this link within ${RESET_TOKEN_TTL_MINUTES} minutes to choose a new one:</p>` +
        `<p><a href="${link}">Reset your password</a></p>` +
        `<p>If you didn't ask for this, you can ignore this email; your password won't change.</p>`
    }).catch((err) => console.error('Password reset email failed:', err.message));

    res.json(FORGOT_PASSWORD_RESPONSE);
  } catch (err) {
    next(err);
  }
}

// Sets a new password from a reset link, signs the user out everywhere else, and signs them in here.
export async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body;
    const password_hash = await bcrypt.hash(password, 12);

    const user = await db.transaction(async (tx) => {
      // Marking the token used in the same statement that checks it keeps it single-use under races.
      const claimed = await tx.prepare(`
        UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP
        WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')
        RETURNING user_id
      `).get(hashResetToken(token));
      if (!claimed) {
        return null;
      }

      await tx.prepare(`
        UPDATE users
        SET password_hash = ?, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(password_hash, claimed.user_id);
      await tx.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(claimed.user_id);
      return tx.prepare('SELECT * FROM users WHERE id = ?').get(claimed.user_id);
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: { message: 'This reset link is invalid or has expired. Please request a new one.' }
      });
    }

    const { password_hash: _hash, token_version, ...publicUser } = user;
    setAuthCookie(res, user);

    res.json({
      success: true,
      data: { user: publicUser }
    });
  } catch (err) {
    next(err);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
