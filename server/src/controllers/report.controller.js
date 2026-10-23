import db from '../config/db.js';

export async function createReport(req, res, next) {
  try {
    const { idea_id, reason } = req.body;
    const reporterId = req.user.id;

    const idea = await db.prepare('SELECT id FROM ideas WHERE id = ?').get(idea_id);
    if (!idea) {
      return res.status(404).json({ success: false, error: { message: 'Idea not found.' } });
    }

    // Check if user already reported this idea (one report per user per idea)
    const existing = await db.prepare('SELECT id FROM reports WHERE reporter_id = ? AND idea_id = ?').get(reporterId, idea_id);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { message: 'You have already reported this idea.' }
      });
    }

    const stmt = db.prepare(`
      INSERT INTO reports (reporter_id, idea_id, reason, status)
      VALUES (?, ?, ?, 'pending')
    `);

    const result = await stmt.run(reporterId, idea_id, reason);

    res.status(201).json({
      success: true,
      message: 'Report submitted. Our moderation team will review it shortly.',
      data: { report_id: result.lastInsertRowid }
    });
  } catch (err) {
    next(err);
  }
}

export async function getReports(req, res, next) {
  try {
    const { status } = req.query;

    let filter = '';
    const params = [];
    if (status) {
      filter = 'WHERE rep.status = ?';
      params.push(status);
    }

    const sql = `
      SELECT
        rep.id,
        rep.reason,
        rep.status,
        rep.created_at,
        u.id AS reporter_id,
        u.name AS reporter_name,
        u.email AS reporter_email,
        i.id AS idea_id,
        i.title AS idea_title,
        i.category AS idea_category,
        author.name AS idea_author_name
      FROM reports rep
      JOIN users u ON rep.reporter_id = u.id
      JOIN ideas i ON rep.idea_id = i.id
      JOIN users author ON i.user_id = author.id
      ${filter}
      ORDER BY rep.created_at DESC
    `;

    const reports = await db.prepare(sql).all(...params);

    res.json({
      success: true,
      data: { reports }
    });
  } catch (err) {
    next(err);
  }
}

export async function updateReportStatus(req, res, next) {
  try {
    const reportId = Number(req.params.id);
    const { status } = req.body;

    const report = await db.prepare('SELECT id FROM reports WHERE id = ?').get(reportId);
    if (!report) {
      return res.status(404).json({ success: false, error: { message: 'Report not found.' } });
    }

    await db.prepare('UPDATE reports SET status = ? WHERE id = ?').run(status, reportId);

    res.json({
      success: true,
      message: `Report status updated to ${status}.`
    });
  } catch (err) {
    next(err);
  }
}
