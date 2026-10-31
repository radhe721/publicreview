import db from '../config/db.js';

async function getFeedbackSummary(ideaId) {
  const row = await db.prepare(`
    SELECT
      COUNT(*) AS total,
      ROUND(AVG(CAST(problem_real AS REAL)), 1) AS problem_real_avg,
      ROUND(AVG(CAST(buyer_would_pay AS REAL)), 1) AS buyer_would_pay_avg,
      SUM(CASE WHEN price_fit = 'too_low' THEN 1 ELSE 0 END) AS too_low,
      SUM(CASE WHEN price_fit = 'right' THEN 1 ELSE 0 END) AS just_right,
      SUM(CASE WHEN price_fit = 'too_high' THEN 1 ELSE 0 END) AS too_high
    FROM idea_feedback
    WHERE idea_id = ?
  `).get(ideaId);

  const competitors = await db.prepare(`
    SELECT f.competitor AS text, u.id AS user_id, u.name AS user_name, f.updated_at
    FROM idea_feedback f JOIN users u ON u.id = f.user_id
    WHERE f.idea_id = ? AND COALESCE(TRIM(f.competitor), '') != ''
    ORDER BY f.updated_at DESC
    LIMIT 20
  `).all(ideaId);

  const wouldMakePay = await db.prepare(`
    SELECT f.would_make_pay AS text, u.id AS user_id, u.name AS user_name, u.role_tag, f.updated_at
    FROM idea_feedback f JOIN users u ON u.id = f.user_id
    WHERE f.idea_id = ? AND COALESCE(TRIM(f.would_make_pay), '') != ''
    ORDER BY f.updated_at DESC
    LIMIT 20
  `).all(ideaId);

  return {
    total: Number(row?.total || 0),
    problem_real_avg: row?.problem_real_avg == null ? null : Number(row.problem_real_avg),
    buyer_would_pay_avg: row?.buyer_would_pay_avg == null ? null : Number(row.buyer_would_pay_avg),
    price_fit: {
      too_low: Number(row?.too_low || 0),
      right: Number(row?.just_right || 0),
      too_high: Number(row?.too_high || 0)
    },
    competitors,
    would_make_pay: wouldMakePay
  };
}

async function getMyFeedback(ideaId, userId) {
  return db.prepare(`
    SELECT problem_real, buyer_would_pay, price_fit, competitor, would_make_pay, updated_at
    FROM idea_feedback WHERE idea_id = ? AND user_id = ?
  `).get(ideaId, userId);
}

export async function getFeedback(req, res, next) {
  try {
    const ideaId = Number(req.params.id);
    const idea = await db.prepare('SELECT id FROM ideas WHERE id = ?').get(ideaId);
    if (!idea) {
      return res.status(404).json({ success: false, error: { message: 'Idea not found.' } });
    }
    res.json({
      success: true,
      data: {
        feedback: await getFeedbackSummary(ideaId),
        my_feedback: req.user ? await getMyFeedback(ideaId, req.user.id) : null
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function submitFeedback(req, res, next) {
  try {
    const ideaId = Number(req.params.id);
    const userId = req.user.id;
    const idea = await db.prepare('SELECT id, user_id FROM ideas WHERE id = ?').get(ideaId);
    if (!idea) {
      return res.status(404).json({ success: false, error: { message: 'Idea not found.' } });
    }
    if (Number(idea.user_id) === Number(userId)) {
      return res.status(400).json({ success: false, error: { message: 'You cannot give feedback on your own idea.' } });
    }

    const { problem_real, buyer_would_pay, price_fit, competitor, would_make_pay } = req.body;
    await db.prepare(`
      INSERT INTO idea_feedback (user_id, idea_id, problem_real, buyer_would_pay, price_fit, competitor, would_make_pay, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, idea_id) DO UPDATE SET
        problem_real = excluded.problem_real,
        buyer_would_pay = excluded.buyer_would_pay,
        price_fit = excluded.price_fit,
        competitor = excluded.competitor,
        would_make_pay = excluded.would_make_pay,
        updated_at = CURRENT_TIMESTAMP
    `).run(userId, ideaId, problem_real, buyer_would_pay, price_fit || null, competitor || null, would_make_pay || null);

    res.json({
      success: true,
      message: 'Thanks for the feedback!',
      data: {
        feedback: await getFeedbackSummary(ideaId),
        my_feedback: await getMyFeedback(ideaId, userId)
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteFeedback(req, res, next) {
  try {
    const ideaId = Number(req.params.id);
    const result = await db.prepare('DELETE FROM idea_feedback WHERE idea_id = ? AND user_id = ?').run(ideaId, req.user.id);
    if (!result.rowsAffected) {
      return res.status(404).json({ success: false, error: { message: 'No feedback found to remove.' } });
    }
    res.json({
      success: true,
      message: 'Feedback removed.',
      data: { feedback: await getFeedbackSummary(ideaId), my_feedback: null }
    });
  } catch (err) {
    next(err);
  }
}
