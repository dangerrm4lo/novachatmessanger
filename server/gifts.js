const express = require('express');
const { pool } = require('./db');
const { requireAuth } = require('./auth');

const router = express.Router();
router.use(requireAuth);
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const MAX_COLLECTIONS = 20;

function mapCollection(r) {
  return { id: Number(r.id), title: r.title, createdAt: r.created_at };
}

// Коллекции пользователя. Пока видны всем, позже подарки можно будет скрывать
router.get('/collections/:username', wrap(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT c.id, c.title, c.created_at FROM gift_collections c JOIN users u ON u.id = c.owner_id ' +
    'WHERE u.username = $1 ORDER BY c.created_at ASC',
    [String(req.params.username).toLowerCase()]
  );
  res.json({ collections: rows.map(mapCollection) });
}));

router.post('/collections', wrap(async (req, res) => {
  const title = String((req.body || {}).title || '').trim();
  if (title.length < 1 || title.length > 32) {
    return res.status(400).json({ error: 'Название: от 1 до 32 символов' });
  }
  const count = await pool.query('SELECT COUNT(*)::int AS n FROM gift_collections WHERE owner_id = $1', [req.userId]);
  if (count.rows[0].n >= MAX_COLLECTIONS) {
    return res.status(400).json({ error: 'Можно создать не больше 20 коллекций' });
  }
  const { rows } = await pool.query(
    'INSERT INTO gift_collections (owner_id, title) VALUES ($1, $2) RETURNING id, title, created_at',
    [req.userId, title]
  );
  res.status(201).json({ collection: mapCollection(rows[0]) });
}));

module.exports = router;