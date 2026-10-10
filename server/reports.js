const express = require('express');
const { pool } = require('./db');
const { requireAuth } = require('./auth');

const router = express.Router();
router.use(requireAuth);
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

router.post('/', wrap(async (req, res) => {
  const body = req.body || {};
  const username = String(body.username || '').trim().toLowerCase();
  const reason = String(body.reason || '').trim();
  if (!reason || reason.length > 500) {
    return res.status(400).json({ error: 'Опишите причину (до 500 символов)' });
  }

  const target = await pool.query('SELECT id, is_system FROM users WHERE username = $1', [username]);
  const row = target.rows[0];
  if (!row) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  if (row.id === req.userId || row.is_system) {
    return res.status(400).json({ error: 'Этот аккаунт нельзя пожаловаться' });
  }

  const dup = await pool.query(
    "SELECT 1 FROM reports WHERE reporter_id = $1 AND target_id = $2 AND status = 'open'",
    [req.userId, row.id]
  );
  if (dup.rowCount) {
    return res.status(409).json({ error: 'Жалоба уже отправлена' });
  }

  await pool.query(
    'INSERT INTO reports (reporter_id, target_id, reason) VALUES ($1, $2, $3)',
    [req.userId, row.id, reason]
  );
  res.status(201).json({ ok: true });
}));

module.exports = router;