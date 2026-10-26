import db from '../config/db.js';

const PRICE_TIERS = ['under_10', '10_to_30', '30_to_100', 'over_100'];

async function getDemandSummary(ideaId) {
  const row = await db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN intent = 'pass' THEN 1 ELSE 0 END) AS pass_count,
      SUM(CASE WHEN intent = 'maybe' THEN 1 ELSE 0 END) AS maybe_count,
      SUM(CASE WHEN intent = 'would_pay' THEN 1 ELSE 0 END) AS would_pay_count,
      SUM(join_waitlist) AS waitlist_count,
      SUM(CASE WHEN price_tier = 'under_10' THEN 1 ELSE 0 END) AS tier_under_10,
      SUM(CASE WHEN price_tier = '10_to_30' THEN 1 ELSE 0 END) AS tier_10_to_30,
      SUM(CASE WHEN price_tier = '30_to_100' THEN 1 ELSE 0 END) AS tier_30_to_100,
      SUM(CASE WHEN price_tier = 'over_100' THEN 1 ELSE 0 END) AS tier_over_100
    FROM demand_signals
    WHERE idea_id = ?
  `).get(ideaId);

  const total = Number(row?.total || 0);
  const pass = Number(row?.pass_count || 0);
  const maybe = Number(row?.maybe_count || 0);
  const wouldPay = Number(row?.would_pay_count || 0);

  const priceTiers = Object.fromEntries(PRICE_TIERS.map((t) => [t, Number(row?.[`tier_${t}`] || 0)]));

  // Demand score (0-100): a paying intent counts fully, a "maybe" counts 40%.
  const demandScore = total > 0 ? Math.round(((wouldPay + maybe * 0.4) / total) * 100) : 0;

  return {
    total,
    intents: { pass, maybe, would_pay: wouldPay },
    pay_rate: total > 0 ? Math.round((wouldPay / total) * 100) : 0,
    demand_score: demandScore,
    price_tiers: priceTiers,
    waitlist_count: Number(row?.waitlist_count || 0)
  };
}

async function getMySignal(ideaId, userId) {
  const row = await db.prepare(`
    SELECT intent, price_tier, join_waitlist, updated_at
    FROM demand_signals
    WHERE idea_id = ? AND user_id = ?
  `).get(ideaId, userId);
  return row ? { ...row, join_waitlist: Boolean(row.join_waitlist) } : null;
}

export async function getDemand(req, res, next) {
  try {
    const ideaId = Number(req.params.id);
    const idea = await db.prepare('SELECT id FROM ideas WHERE id = ?').get(ideaId);
    if (!idea) {
      return res.status(404).json({ success: false, error: { message: 'Idea not found.' } });
    }

    res.json({
      success: true,
      data: {
        demand: await getDemandSummary(ideaId),
        my_signal: req.user ? await getMySignal(ideaId, req.user.id) : null
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function submitDemand(req, res, next) {
  try {
    const ideaId = Number(req.params.id);
    const userId = req.user.id;
    const { intent, price_tier, join_waitlist } = req.body;

    const idea = await db.prepare('SELECT id, user_id FROM ideas WHERE id = ?').get(ideaId);
    if (!idea) {
      return res.status(404).json({ success: false, error: { message: 'Idea not found.' } });
    }

    if (idea.user_id === userId) {
      return res.status(400).json({
        success: false,
        error: { message: 'You cannot signal demand for your own idea.' }
      });
    }

    await db.prepare(`
      INSERT INTO demand_signals (user_id, idea_id, intent, price_tier, join_waitlist, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, idea_id) DO UPDATE SET
        intent = excluded.intent,
        price_tier = excluded.price_tier,
        join_waitlist = excluded.join_waitlist,
        updated_at = CURRENT_TIMESTAMP
    `).run(userId, ideaId, intent, price_tier, join_waitlist ? 1 : 0);

    res.json({
      success: true,
      message: 'Thanks! Your signal was recorded.',
      data: {
        demand: await getDemandSummary(ideaId),
        my_signal: await getMySignal(ideaId, userId)
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteDemand(req, res, next) {
  try {
    const ideaId = Number(req.params.id);
    const result = await db.prepare('DELETE FROM demand_signals WHERE idea_id = ? AND user_id = ?').run(ideaId, req.user.id);
    if (!result.rowsAffected) {
      return res.status(404).json({ success: false, error: { message: 'No signal found to remove.' } });
    }

    res.json({
      success: true,
      message: 'Signal removed.',
      data: { demand: await getDemandSummary(ideaId), my_signal: null }
    });
  } catch (err) {
    next(err);
  }
}

// Only the idea's creator (or an admin) sees who joined the waitlist. Voters explicitly
// consented to share their name and email when they joined.
export async function getWaitlist(req, res, next) {
  try {
    const ideaId = Number(req.params.id);
    const idea = await db.prepare('SELECT id, user_id FROM ideas WHERE id = ?').get(ideaId);
    if (!idea) {
      return res.status(404).json({ success: false, error: { message: 'Idea not found.' } });
    }

    if (idea.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: { message: 'Only the creator can view this waitlist.' } });
    }

    const rows = await db.prepare(`
      SELECT u.id, u.name, u.email, u.avatar_url, d.intent, d.price_tier, d.updated_at AS joined_at
      FROM demand_signals d
      JOIN users u ON u.id = d.user_id
      WHERE d.idea_id = ? AND d.join_waitlist = 1
      ORDER BY d.updated_at DESC
    `).all(ideaId);

    res.json({
      success: true,
      data: { waitlist: rows }
    });
  } catch (err) {
    next(err);
  }
}
