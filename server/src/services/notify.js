import db from '../config/db.js';
import { env } from '../config/env.js';
import { sendMail } from './mailer.js';

// Every notification type, its default for in-app and email, and the label shown in settings.
export const NOTIFICATION_TYPES = {
  vote: { label: 'New vote on my idea', inapp: true, email: false },
  comment: { label: 'New comment or reply', inapp: true, email: true },
  milestone: { label: 'My idea reached 5 ratings', inapp: true, email: true },
  build_interest: { label: 'Someone wants to build my idea', inapp: true, email: true },
  report: { label: 'Validation Report updates', inapp: true, email: true },
  weekly: { label: 'Weekly email: top validated ideas', inapp: false, email: true }
};

export function resolvePrefs(raw) {
  let saved = {};
  try { saved = raw ? JSON.parse(raw) : {}; } catch { saved = {}; }
  return Object.fromEntries(Object.entries(NOTIFICATION_TYPES).map(([type, d]) => [
    type,
    { inapp: saved[type]?.inapp ?? d.inapp, email: saved[type]?.email ?? d.email }
  ]));
}

// Never throws: a failed email must not break the request that triggered it.
export async function notify(userId, type, title, link) {
  try {
    if (!userId) return;
    const user = await db.prepare('SELECT id, email, name, notify_prefs FROM users WHERE id = ?').get(userId);
    if (!user) return;
    const prefs = resolvePrefs(user.notify_prefs)[type] || { inapp: true, email: false };
    if (prefs.inapp) {
      await db.prepare('INSERT INTO notifications (user_id, type, title, link) VALUES (?, ?, ?, ?)').run(userId, type, title, link || null);
    }
    if (prefs.email && user.email && !String(user.email).endsWith('@businessliste.com')) {
      const url = link ? `${env.CLIENT_URL}${link}` : env.CLIENT_URL;
      await sendMail({
        to: user.email,
        subject: title,
        text: `${title}\n\n${url}\n\nChange which emails you get: ${env.CLIENT_URL}/notifications`
      });
    }
  } catch (err) {
    if (env.NODE_ENV !== 'test') console.error('notify failed:', err.message);
  }
}
