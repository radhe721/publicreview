import db from '../config/db.js';

export async function joinWaitlist(req, res, next) {
  try {
    const { email, name, use_case, source } = req.body;

    // Same response whether or not the email was already on the list, so this endpoint
    // can't be used to check who has signed up.
    await db.prepare(`
      INSERT INTO waitlist_signups (email, name, use_case, source)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(email) DO NOTHING
    `).run(email, name || null, use_case || null, source || null);

    const row = await db.prepare('SELECT COUNT(*) AS total FROM waitlist_signups').get();

    res.status(201).json({
      success: true,
      message: "You're on the list! We'll email you when we launch.",
      data: { total: Number(row?.total || 0) }
    });
  } catch (err) {
    next(err);
  }
}

// Public total, used as social proof on the landing page.
export async function getWaitlistCount(req, res, next) {
  try {
    const row = await db.prepare('SELECT COUNT(*) AS total FROM waitlist_signups').get();
    res.json({ success: true, data: { total: Number(row?.total || 0) } });
  } catch (err) {
    next(err);
  }
}

export async function getWaitlist(req, res, next) {
  try {
    const stats = await db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN created_at >= datetime('now', 'start of day') THEN 1 ELSE 0 END) AS today,
        SUM(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS last_7_days
      FROM waitlist_signups
    `).get();

    // Signups per UTC day for the last 30 days (days with no signups are filled in by the client).
    const daily = await db.prepare(`
      SELECT date(created_at) AS day, COUNT(*) AS count
      FROM waitlist_signups
      WHERE created_at >= datetime('now', '-29 days', 'start of day')
      GROUP BY date(created_at)
      ORDER BY day
    `).all();

    const signups = await db.prepare(`
      SELECT id, email, name, use_case, source, created_at
      FROM waitlist_signups
      ORDER BY created_at DESC, id DESC
      LIMIT 500
    `).all();

    res.json({
      success: true,
      data: {
        stats: {
          total: Number(stats?.total || 0),
          today: Number(stats?.today || 0),
          last_7_days: Number(stats?.last_7_days || 0)
        },
        daily: daily.map((d) => ({ day: d.day, count: Number(d.count) })),
        signups
      }
    });
  } catch (err) {
    next(err);
  }
}

// Spreadsheet apps execute cells starting with = + - @ as formulas; prefix them so text typed
// by the public can't run anything when an admin opens the export.
function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function exportWaitlistCsv(req, res, next) {
  try {
    const rows = await db.prepare(`
      SELECT email, name, use_case, source, created_at
      FROM waitlist_signups
      ORDER BY created_at ASC, id ASC
    `).all();

    const header = ['Email', 'Name', 'What they would use it for', 'Source', 'Joined (UTC)'];
    const lines = [header, ...rows.map((r) => [r.email, r.name, r.use_case, r.source, r.created_at])]
      .map((r) => r.map(csvCell).join(','));

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ideapulse-waitlist.csv"');
    res.send(`﻿${lines.join('\n')}`);
  } catch (err) {
    next(err);
  }
}
