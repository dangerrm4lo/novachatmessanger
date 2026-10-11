const express = require('express');
const { pool } = require('./db');
const { requireAuth } = require('./auth');

const router = express.Router();
router.use(requireAuth);

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const THEMES = ['system', 'light', 'dark'];
const LANGUAGES = ['ru', 'en'];

const PUBLIC_COLUMNS = [
  'id', 'username', 'display_name', 'bio', 'is_verified', 'is_system', 'avatar_file_id',
  'banner_file_id', 'music_file_id', 'music_title', 'nova_plus', 'featured_chat_id',
  'show_birth_date', "TO_CHAR(birth_date, 'YYYY-MM-DD') AS birth_date",
].join(', ');
const SELF_COLUMNS = PUBLIC_COLUMNS + ', theme, language, show_last_seen';

function avatarUrl(id) {
  return id ? '/api/files/avatar/' + id : null;
}

function publicUrl(id) {
  return id ? '/api/files/public/' + id : null;
}

function baseUser(u) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    bio: u.bio,
    isVerified: u.is_verified,
    isSystem: u.is_system,
    avatarUrl: avatarUrl(u.avatar_file_id),
    bannerUrl: publicUrl(u.banner_file_id),
    musicUrl: publicUrl(u.music_file_id),
    musicTitle: u.music_title || '',
    novaPlus: Boolean(u.nova_plus),
  };
}

async function featuredOf(id) {
  if (!id) return null;
  const { rows } = await pool.query(
    "SELECT c.id, c.title, c.username, c.avatar_file_id, " +
    "(SELECT COUNT(*) FROM chat_members x WHERE x.chat_id = c.id)::int AS member_count " +
    "FROM chats c WHERE c.id = $1 AND c.kind = 'group'",
    [id]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id,
    title: r.title,
    username: r.username,
    memberCount: r.member_count,
    avatarUrl: avatarUrl(r.avatar_file_id),
  };
}

// Профиль: дата рождения видна всем, кроме случаев, когда её скрыли
async function profileOf(u, viewerId) {
  const self = u.id === viewerId;
  const out = baseUser(u);
  out.featuredGroup = await featuredOf(u.featured_chat_id);
  out.birthDate = (self || u.show_birth_date !== false) ? (u.birth_date || null) : null;
  if (self) {
    out.showBirthDate = u.show_birth_date !== false;
    out.theme = u.theme;
    out.language = u.language;
    out.showLastSeen = u.show_last_seen !== false;
    out.featuredChatId = u.featured_chat_id || null;
  }
  return out;
}

router.get('/me', wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT ' + SELF_COLUMNS + ' FROM users WHERE id = $1', [req.userId]);
  if (!rows[0]) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  res.json({ user: await profileOf(rows[0], req.userId) });
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
  if (body.showBirthDate !== undefined) {
    if (typeof body.showBirthDate !== 'boolean') {
      return res.status(400).json({ error: 'Некорректное значение' });
    }
    fields.show_birth_date = body.showBirthDate;
  }
  if (body.birthDate !== undefined) {
    if (body.birthDate === null || body.birthDate === '') {
      fields.birth_date = null;
    } else {
      const v = String(body.birthDate);
      const year = Number(v.slice(0, 4));
      const valid = /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v + 'T00:00:00').getTime());
      if (!valid || year < 1900 || year > new Date().getFullYear()) {
        return res.status(400).json({ error: 'Некорректная дата рождения' });
      }
      fields.birth_date = v;
    }
  }
  if (body.featuredChatId !== undefined) {
    if (body.featuredChatId === null || body.featuredChatId === '') {
      fields.featured_chat_id = null;
    } else {
      const chatId = Number(body.featuredChatId);
      if (!Number.isInteger(chatId) || chatId < 1) {
        return res.status(400).json({ error: 'Некорректный канал' });
      }
      const { rows: m } = await pool.query(
        "SELECT cm.role FROM chat_members cm JOIN chats c ON c.id = cm.chat_id " +
        "WHERE cm.chat_id = $1 AND cm.user_id = $2 AND c.kind = 'group'",
        [chatId, req.userId]
      );
      if (!m[0] || (m[0].role !== 'owner' && m[0].role !== 'admin')) {
        return res.status(400).json({ error: 'Канал можно выбрать только из своих групп' });
      }
      fields.featured_chat_id = chatId;
    }
  }

  const columns = Object.keys(fields);
  if (columns.length === 0) {
    return res.status(400).json({ error: 'Нечего сохранять' });
  }

  const params = columns.map((c) => fields[c]);
  params.push(req.userId);
  const setSql = columns.map((c, i) => c + ' = $' + (i + 1)).join(', ');
  await pool.query('UPDATE users SET ' + setSql + ' WHERE id = $' + params.length, params);

  const { rows } = await pool.query('SELECT ' + SELF_COLUMNS + ' FROM users WHERE id = $1', [req.userId]);
  res.json({ user: await profileOf(rows[0], req.userId) });
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
  res.json({ users: rows.map(baseUser) });
}));

router.get('/:username', wrap(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT ' + PUBLIC_COLUMNS + ' FROM users WHERE username = $1',
    [String(req.params.username).toLowerCase()]
  );
  if (!rows[0]) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  res.json({ user: await profileOf(rows[0], req.userId) });
}));

module.exports = router;