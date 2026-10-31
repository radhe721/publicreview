import db from '../config/db.js';
import { isVoteBurst } from '../services/ranking.js';

// Monthly price ranges a voter can pick, with the midpoint used for the median.
export const PRICE_TIERS = [
  { id: '0_5', label: '$0–5', mid: 2.5 },
  { id: '5_15', label: '$5–15', mid: 10 },
  { id: '15_30', label: '$15–30', mid: 22.5 },
  { id: '30_100', label: '$30–100', mid: 65 },
  { id: '100_plus', label: '$100+', mid: 100 }
];
// Ranges used before migration 006; still counted, mapped to the closest current range.
const LEGACY_TIERS = { under_10: '5_15', '10_to_30': '15_30', '30_to_100': '30_100', over_100: '100_plus' };

function normalizeTier(tier) {
  return LEGACY_TIERS[tier] || tier;
}

export async function getDemandSummary(ideaId) {
  const row = await db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN intent = 'pass' THEN 1 ELSE 0 END) AS pass_count,
      SUM(CASE WHEN intent = 'maybe' THEN 1 ELSE 0 END) AS maybe_count,
      SUM(CASE WHEN intent = 'would_pay' THEN 1 ELSE 0 END) AS would_pay_count,
      SUM(join_waitlist) AS waitlist_count
    FROM demand_signals
    WHERE idea_id = ? AND held = 0
  `).get(ideaId);

  const tierRows = await db.prepare(`
    SELECT price_tier, COUNT(*) AS c
    FROM demand_signals
    WHERE idea_id = ? AND held = 0 AND intent = 'would_pay' AND price_tier IS NOT NULL
    GROUP BY price_tier
  `).all(ideaId);

  const roleRows = await db.prepare(`
    SELECT COALESCE(u.role_tag, 'unspecified') AS role,
           COUNT(*) AS total,
           SUM(CASE WHEN d.intent = 'would_pay' THEN 1 ELSE 0 END) AS would_pay
    FROM demand_signals d
    JOIN users u ON u.id = d.user_id
    WHERE d.idea_id = ? AND d.held = 0
    GROUP BY COALESCE(u.role_tag, 'unspecified')
    ORDER BY total DESC
  `).all(ideaId);

  const total = Number(row?.total || 0);
  const pass = Number(row?.pass_count || 0);
  const maybe = Number(row?.maybe_count || 0);
  const wouldPay = Number(row?.would_pay_count || 0);

  const priceTiers = Object.fromEntries(PRICE_TIERS.map((t) => [t.id, 0]));
  for (const r of tierRows) {
    const id = normalizeTier(r.price_tier);
    if (id in priceTiers) priceTiers[id] += Number(r.c);
  }

  // Median monthly price: the range holding the middle "would pay" answer.
  const pricedVotes = Object.values(priceTiers).reduce((a, b) => a + b, 0);
  let medianTier = null;
  if (pricedVotes > 0) {
    const middle = Math.ceil(pricedVotes / 2);
    let seen = 0;
    for (const t of PRICE_TIERS) {
      seen += priceTiers[t.id];
      if (seen >= middle) { medianTier = t; break; }
    }
  }

  // Demand score (0-100): a paying intent counts fully, a "maybe" counts 40%.
  const demandScore = total > 0 ? Math.round(((wouldPay + maybe * 0.4) / total) * 100) : 0;

  return {
    total,
    intents: { pass, maybe, would_pay: wouldPay },
    pay_rate: total > 0 ? Math.round((wouldPay / total) * 100) : 0,
    demand_score: demandScore,
    price_tiers: priceTiers,
    median_price: medianTier ? { tier: medianTier.id, label: medianTier.label } : null,
    by_role: roleRows.map((r) => ({ role: r.role, total: Number(r.total), would_pay: Number(r.would_pay) })),
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

    const existing = await db.prepare('SELECT held FROM demand_signals WHERE idea_id = ? AND user_id = ?').get(ideaId, userId);
    // A first vote in a burst of new accounts is held for review; changing an existing vote keeps its status.
    const held = existing ? Number(existing.held) : ((await isVoteBurst('demand_signals', ideaId, userId)) ? 1 : 0);

    await db.prepare(`
      INSERT INTO demand_signals (user_id, idea_id, intent, price_tier, join_waitlist, held, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, idea_id) DO UPDATE SET
        intent = excluded.intent,
        price_tier = excluded.price_tier,
        join_waitlist = excluded.join_waitlist,
        updated_at = CURRENT_TIMESTAMP
    `).run(userId, ideaId, intent, price_tier, join_waitlist ? 1 : 0, held);

    res.json({
      success: true,
      message: held
        ? 'Thanks! Your vote was recorded and will count once it is reviewed.'
        : 'Thanks! Your signal was recorded.',
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
      WHERE d.idea_id = ? AND d.join_waitlist = 1 AND d.held = 0
      ORDER BY d.updated_at DESC
    `).all(ideaId);

    res.json({
      success: true,
      data: { waitlist: rows.map((r) => ({ ...r, price_tier: r.price_tier ? normalizeTier(r.price_tier) : null })) }
    });
  } catch (err) {
    next(err);
  }
}
