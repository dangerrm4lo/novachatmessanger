const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET не задан');
}

const router = express.Router();
const USERNAME_RE = /^[a-z0-9_]{5,32}$/;

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    bio: u.bio,
    isVerified: u.is_verified,
    role: u.role,
    avatarUrl: u.avatar_file_id ? '/api/files/avatar/' + u.avatar_file_id : null,
  };
}

function makeToken(user) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '30d' });
}

// Время закрытия, если тех. работы уже начались, иначе null
async function maintenanceUntil() {
  const { rows } = await pool.query(
    "SELECT closes_at FROM announcements WHERE kind = 'maintenance' AND active = TRUE " +
    'AND closes_at <= NOW() ORDER BY id DESC LIMIT 1'
  );
  return rows[0] ? rows[0].closes_at : null;
}

function frozenBody(user) {
  return { code: 'frozen', error: 'Аккаунт заморожен', reason: user.freeze_reason || '' };
}

router.get('/check-username', wrap(async (req, res) => {
  const username = String(req.query.username || '').trim().toLowerCase();
  if (!USERNAME_RE.test(username)) {
    return res.json({ available: false, reason: 'invalid' });
  }
  const { rowCount } = await pool.query('SELECT 1 FROM users WHERE username = $1', [username]);
  res.json({ available: rowCount === 0 });
}));

router.post('/register', wrap(async (req, res) => {
  const until = await maintenanceUntil();
  if (until) {
    return res.status(503).json({ code: 'maintenance', until: until });
  }

  const body = req.body || {};
  const username = String(body.username || '').trim().toLowerCase();
  const displayName = String(body.displayName || '').trim();
  const password = String(body.password || '');

  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Юзернейм: 5–32 символа, только латиница, цифры и _' });
  }
  if (displayName.length < 1 || displayName.length > 64) {
    return res.status(400).json({ error: 'Введите имя (до 64 символов)' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Пароль должен быть не короче 8 символов' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const { rows } = await pool.query(
      'INSERT INTO users (username, display_name, password_hash) VALUES ($1, $2, $3) RETURNING *',
      [username, displayName, passwordHash]
    );
    res.status(201).json({ token: makeToken(rows[0]), user: publicUser(rows[0]) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Этот юзернейм уже занят' });
    }
    throw err;
  }
}));

router.post('/login', wrap(async (req, res) => {
  const body = req.body || {};
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');

  const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  const user = rows[0];
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  if (!ok) {
    return res.status(401).json({ error: 'Неверный юзернейм или пароль' });
  }
  if (user.frozen_at) {
    return res.status(403).json(frozenBody(user));
  }
  if (user.role !== 'admin') {
    const until = await maintenanceUntil();
    if (until) {
      return res.status(503).json({ code: 'maintenance', until: until });
    }
  }
  res.json({ token: makeToken(user), user: publicUser(user) });
}));

// Проверка токена на каждом защищённом запросе: заморозка и тех. работы действуют сразу
const requireAuth = wrap(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Не авторизован' });
  }
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Сессия истекла, войдите снова' });
  }

  const { rows } = await pool.query(
    'SELECT id, username, role, frozen_at, freeze_reason FROM users WHERE id = $1',
    [payload.sub]
  );
  const user = rows[0];
  if (!user) {
    return res.status(401).json({ error: 'Сессия истекла, войдите снова' });
  }
  if (user.frozen_at) {
    return res.status(403).json(frozenBody(user));
  }
  if (user.role !== 'admin') {
    const until = await maintenanceUntil();
    if (until) {
      return res.status(503).json({ code: 'maintenance', until: until });
    }
  }
  req.userId = user.id;
  req.user = user;
  next();
});

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ code: 'forbidden', error: 'Нет доступа' });
  }
  next();
}

router.get('/me', requireAuth, wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
  res.json({ user: publicUser(rows[0]) });
}));

module.exports = { router, requireAuth, requireAdmin };