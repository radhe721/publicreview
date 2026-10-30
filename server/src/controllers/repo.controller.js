import db from '../config/db.js';
import { parseGithubRepo, fetchGithubRepo, GithubLookupError } from '../services/github.js';

const REPO_SELECT = `
  SELECT
    r.id, r.full_name, r.owner_avatar, r.description, r.language, r.stars, r.forks,
    r.topics, r.note, r.created_at,
    u.id AS sharer_id, u.name AS sharer_name, u.avatar_url AS sharer_avatar,
    (SELECT COUNT(*) FROM repo_upvotes v WHERE v.repo_id = r.id) AS upvotes,
    EXISTS(SELECT 1 FROM repo_upvotes v WHERE v.repo_id = r.id AND v.user_id = ?) AS has_upvoted
  FROM shared_repos r
  JOIN users u ON r.user_id = u.id
`;

function formatRepo(r) {
  return {
    id: r.id,
    full_name: r.full_name,
    html_url: `https://github.com/${r.full_name}`,
    owner_avatar: r.owner_avatar,
    description: r.description,
    language: r.language,
    stars: Number(r.stars),
    forks: Number(r.forks),
    topics: JSON.parse(r.topics || '[]'),
    note: r.note,
    created_at: r.created_at,
    shared_by: {
      id: r.sharer_id,
      name: r.sharer_name,
      avatar_url: r.sharer_avatar
    },
    upvotes: Number(r.upvotes),
    has_upvoted: Boolean(Number(r.has_upvoted))
  };
}

async function loadRepo(id, viewerId) {
  const row = await db.prepare(`${REPO_SELECT} WHERE r.id = ?`).get(viewerId, id);
  return row ? formatRepo(row) : null;
}

export async function getRepos(req, res, next) {
  try {
    const { page, limit, search, sort } = req.query;
    const offset = (page - 1) * limit;
    const viewerId = req.user?.id || null;

    const conditions = [];
    const params = [];
    if (search) {
      conditions.push('(r.full_name LIKE ? OR r.description LIKE ? OR r.note LIKE ? OR r.topics LIKE ? OR r.language LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const orderBy = sort === 'newest'
      ? 'r.created_at DESC, r.id DESC'
      : 'upvotes DESC, r.created_at DESC, r.id DESC';

    const countRow = await db.prepare(`SELECT COUNT(*) AS total FROM shared_repos r ${whereClause}`).get(...params);
    const total = Number(countRow?.total || 0);

    const rows = await db.prepare(`
      ${REPO_SELECT}
      ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `).all(viewerId, ...params, limit, offset);

    res.json({
      success: true,
      data: {
        repos: rows.map(formatRepo),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1
        }
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function shareRepo(req, res, next) {
  try {
    const { owner, name } = parseGithubRepo(req.body.url);

    let details;
    try {
      details = await fetchGithubRepo({ owner, name });
    } catch (err) {
      if (err instanceof GithubLookupError) {
        return res.status(err.statusCode).json({ success: false, error: { message: err.message } });
      }
      throw err;
    }

    const existing = await db.prepare('SELECT id FROM shared_repos WHERE github_id = ?').get(details.github_id);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { message: `${details.full_name} has already been shared. Give it an upvote instead!` },
        data: { id: existing.id }
      });
    }

    const result = await db.prepare(`
      INSERT INTO shared_repos
        (user_id, github_id, full_name, owner_avatar, description, language, stars, forks, topics, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id,
      details.github_id,
      details.full_name,
      details.owner_avatar,
      details.description,
      details.language,
      details.stars,
      details.forks,
      JSON.stringify(details.topics),
      req.body.note || null
    );

    res.status(201).json({
      success: true,
      data: { repo: await loadRepo(result.lastInsertRowid, req.user.id) }
    });
  } catch (err) {
    // Two people sharing the same repo at the same moment: the second insert hits the UNIQUE index.
    if (String(err?.message || '').includes('UNIQUE constraint failed: shared_repos.github_id')) {
      return res.status(409).json({
        success: false,
        error: { message: 'This repository has already been shared.' }
      });
    }
    next(err);
  }
}

export async function upvoteRepo(req, res, next) {
  try {
    const repo = await db.prepare('SELECT id FROM shared_repos WHERE id = ?').get(req.params.id);
    if (!repo) {
      return res.status(404).json({ success: false, error: { message: 'Repository not found.' } });
    }

    await db.prepare(`
      INSERT INTO repo_upvotes (repo_id, user_id) VALUES (?, ?)
      ON CONFLICT(repo_id, user_id) DO NOTHING
    `).run(repo.id, req.user.id);

    res.json({ success: true, data: { repo: await loadRepo(repo.id, req.user.id) } });
  } catch (err) {
    next(err);
  }
}

export async function removeRepoUpvote(req, res, next) {
  try {
    const repo = await db.prepare('SELECT id FROM shared_repos WHERE id = ?').get(req.params.id);
    if (!repo) {
      return res.status(404).json({ success: false, error: { message: 'Repository not found.' } });
    }

    await db.prepare('DELETE FROM repo_upvotes WHERE repo_id = ? AND user_id = ?').run(repo.id, req.user.id);

    res.json({ success: true, data: { repo: await loadRepo(repo.id, req.user.id) } });
  } catch (err) {
    next(err);
  }
}

export async function deleteRepo(req, res, next) {
  try {
    const repo = await db.prepare('SELECT id, user_id FROM shared_repos WHERE id = ?').get(req.params.id);
    if (!repo) {
      return res.status(404).json({ success: false, error: { message: 'Repository not found.' } });
    }
    if (Number(repo.user_id) !== Number(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: { message: 'You can only remove repos you shared.' } });
    }

    await db.prepare('DELETE FROM repo_upvotes WHERE repo_id = ?').run(repo.id);
    await db.prepare('DELETE FROM shared_repos WHERE id = ?').run(repo.id);

    res.json({ success: true, message: 'Repository removed.' });
  } catch (err) {
    next(err);
  }
}
