const express = require('express');
const { pool } = require('./db');
const { requireAuth, requireAdmin } = require('./auth');
const { emitToUsers } = require('./realtime');

const router = express.Router();
router.use(requireAuth, requireAdmin);
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const MAINTENANCE_MINUTES = [5, 10, 30, 60];
const USER_COLUMNS = 'id, username, display_name, role, is_verified, is_system, frozen_at, freeze_reason, created_at';

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function mapUser(u) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    role: u.role,
    isVerified: u.is_verified,
    frozen: Boolean(u.frozen_at),
    freezeReason: u.freeze_reason || '',
    createdAt: u.created_at,
  };
}

function mapAnnouncement(row) {
  return {
    id: row.id,
    kind: row.kind,
    reason: row.reason,
    text: row.text,
    minutes: row.minutes,
    closesAt: row.closes_at,
  };
}

// Заморозка: пользователю сразу уходит событие, а следующий запрос будет отклонён
async function setFrozen(userId, frozen, reason) {
  if (frozen) {
    const text = String(reason || 'Нарушение правил NovaChat').trim().slice(0, 300);
    await pool.query('UPDATE users SET frozen_at = NOW(), freeze_reason = $1 WHERE id = $2', [text, userId]);
    emitToUsers([userId], 'account:frozen', { reason: text });
  } else {
    await pool.query('UPDATE users SET frozen_at = NULL, freeze_reason = NULL WHERE id = $1', [userId]);
  }
}

// Список пользователей, поиск по юзернейму
router.get('/users', wrap(async (req, res) => {
  const q = String(req.query.q || '').toLowerCase().replace(/[^a-z0-9_]/g, '').replace(/_/g, '\\_');
  const { rows } = await pool.query(
    'SELECT ' + USER_COLUMNS + ' FROM users WHERE is_system = FALSE AND username LIKE $1 ' +
    'ORDER BY created_at DESC LIMIT 50',
    ['%' + q + '%']
  );
  res.json({ users: rows.map(mapUser) });
}));

// Галочка, заморозка и разморозка
router.patch('/users/:id', wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'Некорректный id' });
  }
  const body = req.body || {};
  const target = await pool.query('SELECT id, role, is_system FROM users WHERE id = $1', [id]);
  const row = target.rows[0];
  if (!row || row.is_system) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }

  if (typeof body.isVerified === 'boolean') {
    await pool.query('UPDATE users SET is_verified = $1 WHERE id = $2', [body.isVerified, id]);
  }
  if (typeof body.frozen === 'boolean') {
    if (id === req.userId) {
      return res.status(400).json({ error: 'Нельзя заморозить себя' });
    }
    if (row.role === 'admin' && body.frozen) {
      return res.status(400).json({ error: 'Нельзя заморозить администратора' });
    }
    await setFrozen(id, body.frozen, body.reason);
  }

  const { rows } = await pool.query('SELECT ' + USER_COLUMNS + ' FROM users WHERE id = $1', [id]);
  res.json({ user: mapUser(rows[0]) });
}));

// Удаление аккаунта: сообщения остаются без автора
router.delete('/users/:id', wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id || id === req.userId) {
    return res.status(400).json({ error: 'Нельзя удалить этот аккаунт' });
  }
  const target = await pool.query('SELECT id, role, is_system FROM users WHERE id = $1', [id]);
  const row = target.rows[0];
  if (!row || row.is_system) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  if (row.role === 'admin') {
    return res.status(400).json({ error: 'Нельзя удалить администратора' });
  }
  emitToUsers([id], 'account:deleted', {});
  await pool.query('DELETE FROM users WHERE id = $1', [id]);
  res.json({ ok: true });
}));

// Открытые жалобы
router.get('/reports', wrap(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT r.id, r.reason, r.created_at, t.id AS target_id, t.username AS target_username, ' +
    't.display_name AS target_name, t.frozen_at AS target_frozen, rep.username AS reporter_username ' +
    'FROM reports r JOIN users t ON t.id = r.target_id ' +
    'LEFT JOIN users rep ON rep.id = r.reporter_id ' +
    "WHERE r.status = 'open' ORDER BY r.created_at ASC LIMIT 100"
  );
  res.json({
    reports: rows.map((r) => ({
      id: r.id,
      reason: r.reason,
      createdAt: r.created_at,
      target: {
        id: r.target_id,
        username: r.target_username,
        displayName: r.target_name,
        frozen: Boolean(r.target_frozen),
      },
      reporter: r.reporter_username,
    })),
  });
}));

// Закрыть жалобу; если freeze=true, аккаунт заморожен
router.post('/reports/:id/resolve', wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const body = req.body || {};
  const found = await pool.query(
    "SELECT r.target_id, u.role FROM reports r JOIN users u ON u.id = r.target_id " +
    "WHERE r.id = $1 AND r.status = 'open'",
    [id]
  );
  const row = found.rows[0];
  if (!row) {
    return res.status(404).json({ error: 'Жалоба не найдена' });
  }
  if (body.freeze === true) {
    if (row.target_id === req.userId || row.role === 'admin') {
      return res.status(400).json({ error: 'Этот аккаунт нельзя заморозить' });
    }
    await setFrozen(row.target_id, true, body.reason);
  }
  await pool.query("UPDATE reports SET status = 'closed' WHERE id = $1", [id]);
  res.json({ ok: true });
}));

// Объявление: тех. работы с таймером или информационное
router.post('/announcements', wrap(async (req, res) => {
  const body = req.body || {};
  let row;

  if (body.kind === 'maintenance') {
    const minutes = Number(body.minutes);
    if (MAINTENANCE_MINUTES.indexOf(minutes) === -1) {
      return res.status(400).json({ error: 'Выберите 5, 10, 30 минут или 1 час' });
    }
    const reason = body.reason === 'update' ? 'update' : 'fix';
    const closesAt = new Date(Date.now() + minutes * 60 * 1000);
    await pool.query('UPDATE announcements SET active = FALSE WHERE active = TRUE');
    const ins = await pool.query(
      'INSERT INTO announcements (kind, reason, minutes, closes_at, created_by) ' +
      'VALUES ($1, $2, $3, $4, $5) RETURNING *',
      ['maintenance', reason, minutes, closesAt, req.userId]
    );
    row = ins.rows[0];
  } else if (body.kind === 'info') {
    const text = String(body.text || '').trim();
    if (!text || text.length > 300) {
      return res.status(400).json({ error: 'Текст: от 1 до 300 символов' });
    }
    await pool.query('UPDATE announcements SET active = FALSE WHERE active = TRUE');
    const ins = await pool.query(
      "INSERT INTO announcements (kind, text, created_by) VALUES ('info', $1, $2) RETURNING *",
      [text, req.userId]
    );
    row = ins.rows[0];
  } else {
    return res.status(400).json({ error: 'Неизвестный тип объявления' });
  }

  res.status(201).json({ announcement: mapAnnouncement(row) });
}));

// Убрать текущее объявление (и завершить тех. работы)
router.post('/announcements/end', wrap(async (req, res) => {
  await pool.query('UPDATE announcements SET active = FALSE WHERE active = TRUE');
  res.json({ ok: true });
}));

module.exports = router;