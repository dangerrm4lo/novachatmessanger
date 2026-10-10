const express = require('express');
const { pool } = require('./db');

const router = express.Router();
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

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

// Публичный эндпоинт: объявление видно и на странице входа
router.get('/active', wrap(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM announcements WHERE active = TRUE ORDER BY id DESC LIMIT 1'
  );
  const row = rows[0];
  if (!row) {
    return res.json({ announcement: null, maintenance: false });
  }
  const maintenance = row.kind === 'maintenance' && new Date(row.closes_at) <= new Date();
  res.json({ announcement: mapAnnouncement(row), maintenance: maintenance });
}));

module.exports = router;