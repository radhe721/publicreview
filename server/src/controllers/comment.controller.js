import db from '../config/db.js';

export async function getIdeaComments(req, res, next) {
  try {
    const ideaId = Number(req.params.id);

    const commentsSql = `
      SELECT
        c.id,
        c.parent_id,
        c.content,
        c.created_at,
        u.id AS user_id,
        u.name AS user_name,
        u.avatar_url AS user_avatar,
        u.role AS user_role
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.idea_id = ?
      ORDER BY c.created_at ASC
    `;

    const rows = await db.prepare(commentsSql).all(ideaId);
    const comments = rows.map(c => ({
      id: c.id,
      parent_id: c.parent_id || null,
      content: c.content,
      created_at: c.created_at,
      user: {
        id: c.user_id,
        name: c.user_name,
        avatar_url: c.user_avatar,
        role: c.user_role
      }
    }));

    res.json({
      success: true,
      data: { comments }
    });
  } catch (err) {
    next(err);
  }
}

export async function createComment(req, res, next) {
  try {
    const ideaId = Number(req.params.id);
    const userId = req.user.id;
    const { content, parent_id } = req.body;

    const idea = await db.prepare('SELECT id FROM ideas WHERE id = ?').get(ideaId);
    if (!idea) {
      return res.status(404).json({ success: false, error: { message: 'Idea not found.' } });
    }

    if (parent_id) {
      const parentComment = await db.prepare('SELECT id, idea_id FROM comments WHERE id = ?').get(parent_id);
      if (!parentComment || parentComment.idea_id !== ideaId) {
        return res.status(400).json({
          success: false,
          error: { message: 'Parent comment not found for this idea.' }
        });
      }
    }

    const stmt = db.prepare(`
      INSERT INTO comments (user_id, idea_id, content, parent_id)
      VALUES (?, ?, ?, ?)
    `);

    const result = await stmt.run(userId, ideaId, content, parent_id || null);
    const comment = {
      id: result.lastInsertRowid,
      parent_id: parent_id || null,
      content,
      created_at: new Date().toISOString(),
      user: {
        id: req.user.id,
        name: req.user.name,
        avatar_url: req.user.avatar_url,
        role: req.user.role
      }
    };

    res.status(201).json({
      success: true,
      message: 'Comment posted successfully.',
      data: { comment }
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteComment(req, res, next) {
  try {
    const commentId = Number(req.params.commentId);
    const comment = await db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);

    if (!comment) {
      return res.status(404).json({ success: false, error: { message: 'Comment not found.' } });
    }

    if (comment.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: { message: 'You are not authorized to delete this comment.' } });
    }

    await db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);

    res.json({
      success: true,
      message: 'Comment deleted successfully.'
    });
  } catch (err) {
    next(err);
  }
}
