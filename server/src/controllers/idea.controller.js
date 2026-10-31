import db from '../config/db.js';
import {
  weightedRatingsSql,
  RANKING_SCORE_SQL,
  DEMAND_TOTALS_SQL,
  MIN_RATINGS_TO_RANK,
  rankingStats,
  displayAuthor
} from '../services/ranking.js';
import { spamCheck } from '../services/spam.js';

const FREE_IDEAS_PER_MONTH = Number(process.env.FREE_IDEAS_PER_MONTH || (process.env.NODE_ENV === 'test' ? 1000 : 5));
const EXTRA_FIELDS = ['problem', 'target_buyer', 'suggested_price', 'how_it_works', 'competitors', 'link_url'];

function extraFields(r) {
  return {
    problem: r.problem ?? null,
    target_buyer: r.target_buyer ?? null,
    suggested_price: r.suggested_price == null ? null : Number(r.suggested_price),
    how_it_works: r.how_it_works ?? null,
    competitors: r.competitors ?? null,
    link_url: r.link_url ?? null,
    status: r.status || 'published',
    is_featured: Boolean(Number(r.is_featured || 0)),
    is_boosted: Boolean(Number(r.is_boosted || 0)),
    target_roles: r.target_roles ? String(r.target_roles).split(',').filter(Boolean) : [],
    target_industry: r.target_industry ?? null,
    launch: r.launched_url ? {
      url: r.launched_url,
      launched_at: r.launched_at,
      mrr_range: r.mrr_range,
      mrr_verified_cents: r.show_exact_mrr && r.mrr_verified_cents != null ? Number(r.mrr_verified_cents) : null,
      verified: r.mrr_verified_at != null,
      verified_at: r.mrr_verified_at
    } : null
  };
}

const EXTRA_SELECT = `
        i.problem, i.target_buyer, i.suggested_price, i.how_it_works, i.competitors, i.link_url, i.status,
        i.target_roles, i.target_industry,
        i.launched_url, i.launched_at, i.mrr_range, i.mrr_verified_cents, i.mrr_verified_at, i.show_exact_mrr,
        (i.featured_until IS NOT NULL AND i.featured_until > datetime('now')) AS is_featured,
        (i.boosted_until IS NOT NULL AND i.boosted_until > datetime('now')) AS is_boosted,`;

export async function getIdeas(req, res, next) {
  try {
    const {
      page = 1,
      limit = 12,
      search,
      category,
      sort = 'top',
      time_window,
      timeframe,
      tag
    } = req.query;

    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
    const offset = (safePage - 1) * safeLimit;

    const conditions = ["i.status = 'published'"];
    const params = [];

    const priceMin = Number(req.query.price_min);
    const priceMax = Number(req.query.price_max);
    if (Number.isFinite(priceMin) && req.query.price_min !== undefined && req.query.price_min !== '') {
      conditions.push('i.suggested_price >= ?');
      params.push(priceMin);
    }
    if (Number.isFinite(priceMax) && req.query.price_max !== undefined && req.query.price_max !== '') {
      conditions.push('i.suggested_price <= ?');
      params.push(priceMax);
    }
    if (String(req.query.launched) === 'true') {
      conditions.push('i.launched_url IS NOT NULL');
    }

    if (category && category !== 'All') {
      conditions.push('i.category = ?');
      params.push(category);
    }

    if (search) {
      conditions.push('(i.title LIKE ? OR i.pitch LIKE ? OR i.description LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (tag) {
      conditions.push(`i.id IN (
        SELECT it.idea_id FROM idea_tags it
        JOIN tags t ON it.tag_id = t.id
        WHERE LOWER(t.name) = LOWER(?)
      )`);
      params.push(tag);
    }

    // Time window filtering (today, yesterday, week, month, all)
    const tw = (time_window || timeframe || '').toLowerCase();
    if (tw === 'today') {
      conditions.push("date(i.created_at, 'localtime') = date('now', 'localtime')");
    } else if (tw === 'yesterday') {
      conditions.push("date(i.created_at, 'localtime') = date('now', '-1 day', 'localtime')");
    } else if (tw === 'week') {
      conditions.push("i.created_at >= datetime('now', '-7 days', 'localtime')");
    } else if (tw === 'month') {
      conditions.push("i.created_at >= datetime('now', '-30 days', 'localtime')");
    }

    const normalizedSort = (sort || 'top').toLowerCase().replace(/\s+/g, '_');
    const orderParams = [];
    // Top: ideas with enough ratings first (by weighted Bayesian score), then the rest by score.
    let orderBy = `(COALESCE(ws.n, 0) >= ${MIN_RATINGS_TO_RANK}) DESC, ranking_score DESC, COALESCE(ws.n, 0) DESC, i.created_at DESC`;
    if (normalizedSort === 'newest' || normalizedSort === 'fresh') {
      // Paid featured ideas (max 3 a day, clearly labelled) are pinned at the top of Fresh.
      orderBy = "(i.featured_until IS NOT NULL AND i.featured_until > datetime('now')) DESC, i.created_at DESC, i.id DESC";
    } else if (normalizedSort === 'most_discussed' || normalizedSort === 'discussed') {
      orderBy = 's.comments_count DESC, ranking_score DESC';
    } else if (normalizedSort === 'most_rated') {
      orderBy = 's.total_ratings DESC, ranking_score DESC';
    } else if (normalizedSort === 'would_pay' || normalizedSort === 'most_would_pay') {
      orderBy = 'COALESCE(dm.would_pay_votes, 0) DESC, COALESCE(dm.demand_votes, 0) DESC, i.created_at DESC';
    } else if (normalizedSort === 'needs_votes') {
      conditions.push(`COALESCE((SELECT COUNT(*) FROM ratings rr WHERE rr.idea_id = i.id AND rr.held = 0), 0) < ${MIN_RATINGS_TO_RANK}`);
      // Ideas with a running Validation Report are shown to raters first.
      orderBy = "(i.boosted_until IS NOT NULL AND i.boosted_until > datetime('now')) DESC, i.created_at DESC, i.id DESC";
      // Pro targeted raters: ideas aimed at the viewer's role or industry come first.
      if (req.user && (req.user.role_tag || req.user.industry)) {
        orderBy = `((i.target_roles IS NOT NULL AND (',' || i.target_roles || ',') LIKE ?)
          OR (i.target_industry IS NOT NULL AND LOWER(i.target_industry) = LOWER(?))) DESC, ${orderBy}`;
        orderParams.push(`%,${req.user.role_tag || '-'},%`, req.user.industry || '-');
      }
    } else if (normalizedSort === 'trending') {
      // Time-decayed popularity score
      orderBy = '((COALESCE(s.total_ratings, 0) * 3.0 + COALESCE(s.avg_score, 0) * 2.0) / (MAX(1, (strftime(\'%s\', \'now\') - strftime(\'%s\', i.created_at)) / 3600.0) + 2.0)) DESC';
    }
    if (String(req.query.ranked_only) === 'true') {
      conditions.push(`COALESCE((SELECT COUNT(*) FROM ratings rr WHERE rr.idea_id = i.id AND rr.held = 0), 0) >= ${MIN_RATINGS_TO_RANK}`);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total count query
    const countSql = `
      SELECT COUNT(DISTINCT i.id) AS total
      FROM ideas i
      ${whereClause}
    `;
    const countRow = await db.prepare(countSql).get(...params);
    const total = countRow ? Number(countRow.total) : 0;
    const totalPages = Math.ceil(total / safeLimit) || 1;

    // Items query with view join
    const itemsSql = `
      SELECT
        i.id,
        i.title,
        i.pitch,
        i.description,
        i.category,
        i.created_at,
        i.updated_at,
        u.id AS author_id,
        u.name AS author_name,
        u.avatar_url AS author_avatar,
        i.is_team_seed,${EXTRA_SELECT}
        COALESCE(s.avg_score, 0.0) AS avg_score,
        COALESCE(s.total_ratings, 0) AS total_ratings,
        COALESCE(s.comments_count, 0) AS comments_count,
        ws.n AS ws_n,
        ${RANKING_SCORE_SQL} AS ranking_score,
        dm.demand_votes,
        dm.would_pay_votes,
        (
          SELECT json_group_array(t.name)
          FROM idea_tags it
          JOIN tags t ON it.tag_id = t.id
          WHERE it.idea_id = i.id
        ) AS tags_json
      FROM ideas i
      JOIN users u ON i.user_id = u.id
      LEFT JOIN idea_stats_view s ON i.id = s.idea_id
      LEFT JOIN (${weightedRatingsSql()}) ws ON ws.idea_id = i.id
      LEFT JOIN (${DEMAND_TOTALS_SQL}) dm ON dm.idea_id = i.id
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const rows = await db.prepare(itemsSql).all(...params, ...orderParams, safeLimit, offset);

    const ideas = rows.map(r => ({
      id: r.id,
      title: r.title,
      pitch: r.pitch,
      description: r.description,
      category: r.category,
      created_at: r.created_at,
      updated_at: r.updated_at,
      is_team_seed: Boolean(Number(r.is_team_seed)),
      ...extraFields(r),
      author: displayAuthor(r),
      stats: {
        avg_score: Number(r.avg_score),
        total_ratings: Number(r.total_ratings),
        comments_count: Number(r.comments_count),
        ...rankingStats(r)
      },
      tags: r.tags_json ? JSON.parse(r.tags_json).filter(Boolean) : []
    }));

    res.json({
      success: true,
      data: {
        ideas,
        pagination: {
          total,
          page: safePage,
          limit: safeLimit,
          totalPages
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getIdeaById(req, res, next) {
  try {
    const ideaId = Number(req.params.id);
    if (!ideaId) {
      return res.status(400).json({ success: false, error: { message: 'Invalid idea ID.' } });
    }

    const sql = `
      SELECT
        i.id,
        i.title,
        i.pitch,
        i.description,
        i.category,
        i.created_at,
        i.updated_at,
        u.id AS author_id,
        u.name AS author_name,
        u.avatar_url AS author_avatar,
        u.bio AS author_bio,
        i.is_team_seed,
        i.user_id AS owner_id,${EXTRA_SELECT}
        ws.n AS ws_n,
        ${RANKING_SCORE_SQL} AS ranking_score,
        dm.demand_votes,
        dm.would_pay_votes,
        COALESCE(s.avg_score, 0.0) AS avg_score,
        COALESCE(s.total_ratings, 0) AS total_ratings,
        COALESCE(s.score_5_count, 0) AS score_5_count,
        COALESCE(s.score_4_count, 0) AS score_4_count,
        COALESCE(s.score_3_count, 0) AS score_3_count,
        COALESCE(s.score_2_count, 0) AS score_2_count,
        COALESCE(s.score_1_count, 0) AS score_1_count,
        COALESCE(s.comments_count, 0) AS comments_count,
        (
          SELECT json_group_array(t.name)
          FROM idea_tags it
          JOIN tags t ON it.tag_id = t.id
          WHERE it.idea_id = i.id
        ) AS tags_json
      FROM ideas i
      JOIN users u ON i.user_id = u.id
      LEFT JOIN idea_stats_view s ON i.id = s.idea_id
      LEFT JOIN (${weightedRatingsSql()}) ws ON ws.idea_id = i.id
      LEFT JOIN (${DEMAND_TOTALS_SQL}) dm ON dm.idea_id = i.id
      WHERE i.id = ?
    `;

    const row = await db.prepare(sql).get(ideaId);
    // Drafts and hidden ideas are visible only to their author and admins.
    const canSeeUnpublished = req.user && (Number(req.user.id) === Number(row?.owner_id) || req.user.role === 'admin');
    if (!row || (row.status !== 'published' && !canSeeUnpublished)) {
      return res.status(404).json({
        success: false,
        error: { message: 'Idea not found.' }
      });
    }

    // Check if the current user has rated this idea
    let userRating = null;
    if (req.user) {
      const userRatingRow = await db.prepare('SELECT id, score, review_text, created_at FROM ratings WHERE idea_id = ? AND user_id = ?').get(ideaId, req.user.id);
      if (userRatingRow) {
        userRating = {
          id: userRatingRow.id,
          score: userRatingRow.score,
          review_text: userRatingRow.review_text,
          created_at: userRatingRow.created_at
        };
      }
    }

    const idea = {
      id: row.id,
      title: row.title,
      pitch: row.pitch,
      description: row.description,
      category: row.category,
      created_at: row.created_at,
      updated_at: row.updated_at,
      is_team_seed: Boolean(Number(row.is_team_seed)),
      ...extraFields(row),
      edited: row.updated_at && row.created_at && row.updated_at !== row.created_at,
      author: displayAuthor(row, { withBio: true }),
      stats: {
        avg_score: Number(row.avg_score),
        total_ratings: Number(row.total_ratings),
        distribution: {
          5: Number(row.score_5_count),
          4: Number(row.score_4_count),
          3: Number(row.score_3_count),
          2: Number(row.score_2_count),
          1: Number(row.score_1_count)
        },
        comments_count: Number(row.comments_count),
        ...rankingStats(row)
      },
      tags: row.tags_json ? JSON.parse(row.tags_json).filter(Boolean) : [],
      user_rating: userRating
    };

    res.json({
      success: true,
      data: { idea }
    });
  } catch (err) {
    next(err);
  }
}

export async function createIdea(req, res, next) {
  try {
    const { title, pitch, description, category, tags = [] } = req.body;
    const status = req.body.status === 'draft' ? 'draft' : 'published';
    const userId = req.user.id;

    const spam = await spamCheck(userId, description, { table: 'ideas', column: 'description' })
      || await spamCheck(userId, pitch, { table: 'ideas', column: 'pitch' });
    if (spam) {
      return res.status(400).json({ success: false, error: { message: spam } });
    }

    if (status === 'published') {
      const limitError = await freePlanLimitError(req.user);
      if (limitError) return res.status(403).json({ success: false, error: { message: limitError, code: 'FREE_LIMIT' } });
    }

    const ideaId = await db.transaction(async (tx) => {
      const stmt = tx.prepare(`
        INSERT INTO ideas (user_id, title, pitch, description, category, status, ${EXTRA_FIELDS.join(', ')})
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = await stmt.run(userId, title, pitch, description, category, status, ...EXTRA_FIELDS.map((f) => req.body[f] ?? null));
      const insertedId = result.lastInsertRowid;

      if (tags && tags.length > 0) {
        const insertTag = tx.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
        const getTag = tx.prepare('SELECT id FROM tags WHERE name = ?');
        const insertIdeaTag = tx.prepare('INSERT OR IGNORE INTO idea_tags (idea_id, tag_id) VALUES (?, ?)');

        for (const rawTag of tags) {
          const cleanTag = rawTag.trim().replace(/^#/, '');
          if (cleanTag) {
            await insertTag.run(cleanTag);
            const tagRow = await getTag.get(cleanTag);
            if (tagRow) {
              await insertIdeaTag.run(insertedId, tagRow.id);
            }
          }
        }
      }

      return insertedId;
    });

    res.status(201).json({
      success: true,
      data: {
        idea: {
          id: ideaId,
          title,
          pitch,
          description,
          category,
          tags,
          status,
          author: {
            id: req.user.id,
            name: req.user.name,
            avatar_url: req.user.avatar_url
          }
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function updateIdea(req, res, next) {
  try {
    const ideaId = Number(req.params.id);
    const { title, pitch, description, category, tags } = req.body;

    const idea = await db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId);
    if (!idea) {
      return res.status(404).json({ success: false, error: { message: 'Idea not found.' } });
    }

    if (idea.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: { message: 'You are not authorized to edit this idea.' } });
    }

    if (req.body.status === 'published' && idea.status === 'draft') {
      const limitError = await freePlanLimitError(req.user);
      if (limitError) return res.status(403).json({ success: false, error: { message: limitError, code: 'FREE_LIMIT' } });
    }

    const textChanged = (title !== undefined && title !== idea.title)
      || (pitch !== undefined && pitch !== idea.pitch)
      || (description !== undefined && description !== idea.description);

    await db.transaction(async (tx) => {
      const updates = [];
      const params = [];

      // Keep the previous published wording, so raters can see what they voted on.
      if (textChanged && idea.status === 'published') {
        await tx.prepare('INSERT INTO idea_revisions (idea_id, user_id, title, pitch, description) VALUES (?, ?, ?, ?, ?)')
          .run(ideaId, req.user.id, idea.title, idea.pitch, idea.description);
      }
      for (const f of EXTRA_FIELDS) {
        if (req.body[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
      }
      if (req.body.status === 'published' || req.body.status === 'draft') {
        // Only drafts can go back and forth; a hidden idea stays hidden until an admin restores it.
        if (idea.status !== 'hidden') { updates.push('status = ?'); params.push(req.body.status); }
      }

      if (title !== undefined) { updates.push('title = ?'); params.push(title); }
      if (pitch !== undefined) { updates.push('pitch = ?'); params.push(pitch); }
      if (description !== undefined) { updates.push('description = ?'); params.push(description); }
      if (category !== undefined) { updates.push('category = ?'); params.push(category); }

      updates.push("updated_at = CURRENT_TIMESTAMP");

      if (updates.length > 0) {
        await tx.prepare(`UPDATE ideas SET ${updates.join(', ')} WHERE id = ?`).run(...params, ideaId);
      }

      if (Array.isArray(tags)) {
        await tx.prepare('DELETE FROM idea_tags WHERE idea_id = ?').run(ideaId);
        const insertTag = tx.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
        const getTag = tx.prepare('SELECT id FROM tags WHERE name = ?');
        const insertIdeaTag = tx.prepare('INSERT OR IGNORE INTO idea_tags (idea_id, tag_id) VALUES (?, ?)');

        for (const rawTag of tags) {
          const cleanTag = rawTag.trim().replace(/^#/, '');
          if (cleanTag) {
            await insertTag.run(cleanTag);
            const tagRow = await getTag.get(cleanTag);
            if (tagRow) {
              await insertIdeaTag.run(ideaId, tagRow.id);
            }
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Idea updated successfully.'
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteIdea(req, res, next) {
  try {
    const ideaId = Number(req.params.id);

    const idea = await db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId);
    if (!idea) {
      return res.status(404).json({ success: false, error: { message: 'Idea not found.' } });
    }

    if (idea.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: { message: 'You are not authorized to delete this idea.' } });
    }

    await db.prepare('DELETE FROM ideas WHERE id = ?').run(ideaId);

    res.json({
      success: true,
      message: 'Idea deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
}

// Admins label seed content honestly as "Posted by BusinessListe Team".
export async function setTeamSeed(req, res, next) {
  try {
    const ideaId = Number(req.params.id);
    const idea = await db.prepare('SELECT id FROM ideas WHERE id = ?').get(ideaId);
    if (!idea) {
      return res.status(404).json({ success: false, error: { message: 'Idea not found.' } });
    }
    const isTeamSeed = Boolean(req.body.is_team_seed);
    await db.prepare('UPDATE ideas SET is_team_seed = ? WHERE id = ?').run(isTeamSeed ? 1 : 0, ideaId);
    res.json({ success: true, data: { id: ideaId, is_team_seed: isTeamSeed } });
  } catch (err) {
    next(err);
  }
}

// Free plan: FREE_IDEAS_PER_MONTH published ideas per 30 days. Pro and admins are unlimited.
async function freePlanLimitError(user) {
  if (user.role === 'admin') return null;
  const row = await db.prepare(`
    SELECT (pro_until IS NOT NULL AND pro_until > datetime('now')) AS is_pro,
           (SELECT COUNT(*) FROM ideas WHERE user_id = ? AND status = 'published' AND created_at >= datetime('now', '-30 days')) AS recent
    FROM users WHERE id = ?
  `).get(user.id, user.id);
  if (Number(row?.is_pro)) return null;
  if (Number(row?.recent || 0) >= FREE_IDEAS_PER_MONTH) {
    return `The free plan includes ${FREE_IDEAS_PER_MONTH} published ideas every 30 days. Save this one as a draft, or upgrade to Pro for unlimited posts.`;
  }
  return null;
}
