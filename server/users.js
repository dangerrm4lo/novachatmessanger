const express = require('express');
const { pool } = require('./db');
const { requireAuth } = require('./auth');

const router = express.Router();
router.use(requireAuth);

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const THEMES = ['system', 'light', 'dark'];
const LANGUAGES = ['ru', 'en'];
const PUBLIC_COLUMNS = 'id, username, display_name, bio, is_verified, is_system, avatar_file_id';

function avatarUrl(id) {
  return id ? '/api/files/avatar/' + id : null;
}

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    bio: u.bio,
    isVerified: u.is_verified,
    isSystem: u.is_system,
    avatarUrl: avatarUrl(u.avatar_file_id),
  };
}

function fullUser(u) {
  const base = publicUser(u);
  base.theme = u.theme;
  base.language = u.language;
  base.showLastSeen = u.show_last_seen !== false;
  return base;
}

router.get('/me', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
  if (!rows[0]) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  res.json({ user: fullUser(rows[0]) });
}));

router.patch('/me', wrap(async (req, res) => {
  const body = req.body || {};
  const fields = {};

  if (body.displayName !== undefined) {
    const name = typeof body.displayName === 'string' ? body.displayName.trim() : '';
    if (name.length < 1 || name.length > 64) {
      return res.status(400).json({ error: 'Имя: от 1 до 64 символов' });
    }
    fields.display_name = name;
  }
  if (body.bio !== undefined) {
    const bio = typeof body.bio === 'string' ? body.bio.trim() : null;
    if (bio === null || bio.length > 200) {
      return res.status(400).json({ error: 'О себе: до 200 символов' });
    }
    fields.bio = bio;
  }
  if (body.theme !== undefined) {
    if (!THEMES.includes(body.theme)) {
      return res.status(400).json({ error: 'Неизвестная тема' });
    }
    fields.theme = body.theme;
  }
  if (body.language !== undefined) {
    if (!LANGUAGES.includes(body.language)) {
      return res.status(400).json({ error: 'Неизвестный язык' });
    }
    fields.language = body.language;
  }
  if (body.showLastSeen !== undefined) {
    if (typeof body.showLastSeen !== 'boolean') {
      return res.status(400).json({ error: 'Некорректное значение' });
    }
    fields.show_last_seen = body.showLastSeen;
  }

  const columns = Object.keys(fields);
  if (columns.length === 0) {
    return res.status(400).json({ error: 'Нечего сохранять' });
  }

  const params = columns.map((c) => fields[c]);
  params.push(req.userId);
  const setSql = columns.map((c, i) => c + ' = $' + (i + 1)).join(', ');
  const whereParam = '$' + params.length;

  const { rows } = await pool.query(
    'UPDATE users SET ' + setSql + ' WHERE id = ' + whereParam + ' RETURNING *',
    params
  );
  if (!rows[0]) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  res.json({ user: fullUser(rows[0]) });
}));

router.get('/search', wrap(async (req, res) => {
  const q = String(req.query.q || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!q) {
    return res.json({ users: [] });
  }
  const pattern = q.replace(/_/g, '\\_') + '%';
  const { rows } = await pool.query(
    'SELECT ' + PUBLIC_COLUMNS + ' FROM users WHERE username LIKE $1 AND id <> $2 AND is_system = FALSE ORDER BY username LIMIT 20',
    [pattern, req.userId]
  );
  res.json({ users: rows.map(publicUser) });
}));

router.get('/:username', wrap(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT ' + PUBLIC_COLUMNS + ' FROM users WHERE username = $1',
    [String(req.params.username).toLowerCase()]
  );
  if (!rows[0]) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  res.json({ user: publicUser(rows[0]) });
}));

module.exports = router;