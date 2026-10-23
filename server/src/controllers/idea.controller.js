import db from '../config/db.js';

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

    const conditions = [];
    const params = [];

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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const normalizedSort = (sort || 'top').toLowerCase().replace(/\s+/g, '_');
    let orderBy = 's.avg_score DESC, s.total_ratings DESC, i.created_at DESC';
    if (normalizedSort === 'newest') {
      orderBy = 'i.created_at DESC';
    } else if (normalizedSort === 'most_discussed' || normalizedSort === 'discussed') {
      orderBy = 's.comments_count DESC, s.avg_score DESC, s.total_ratings DESC';
    } else if (normalizedSort === 'most_rated') {
      orderBy = 's.total_ratings DESC, s.avg_score DESC';
    } else if (normalizedSort === 'trending') {
      // Time-decayed popularity score
      orderBy = '((COALESCE(s.total_ratings, 0) * 3.0 + COALESCE(s.avg_score, 0) * 2.0) / (MAX(1, (strftime(\'%s\', \'now\') - strftime(\'%s\', i.created_at)) / 3600.0) + 2.0)) DESC';
    }

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
        COALESCE(s.avg_score, 0.0) AS avg_score,
        COALESCE(s.total_ratings, 0) AS total_ratings,
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
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const rows = await db.prepare(itemsSql).all(...params, safeLimit, offset);

    const ideas = rows.map(r => ({
      id: r.id,
      title: r.title,
      pitch: r.pitch,
      description: r.description,
      category: r.category,
      created_at: r.created_at,
      updated_at: r.updated_at,
      author: {
        id: r.author_id,
        name: r.author_name,
        avatar_url: r.author_avatar
      },
      stats: {
        avg_score: Number(r.avg_score),
        total_ratings: Number(r.total_ratings),
        comments_count: Number(r.comments_count)
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
      WHERE i.id = ?
    `;

    const row = await db.prepare(sql).get(ideaId);
    if (!row) {
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
      author: {
        id: row.author_id,
        name: row.author_name,
        avatar_url: row.author_avatar,
        bio: row.author_bio
      },
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
        comments_count: Number(row.comments_count)
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
    const userId = req.user.id;

    const ideaId = await db.transaction(async (tx) => {
      const stmt = tx.prepare(`
        INSERT INTO ideas (user_id, title, pitch, description, category)
        VALUES (?, ?, ?, ?, ?)
      `);
      const result = await stmt.run(userId, title, pitch, description, category);
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

    await db.transaction(async (tx) => {
      const updates = [];
      const params = [];

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
