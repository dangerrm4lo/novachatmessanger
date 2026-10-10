const express = require('express');
const { pool } = require('./db');
const { requireAuth } = require('./auth');

const router = express.Router();
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const rawBody = express.raw({ type: () => true, limit: '10mb' });
const IMAGE_RE = /^image\/(png|jpeg|gif|webp)$/;
const MAX_AVATAR = 2 * 1024 * 1024;

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function cleanName(value) {
  let name;
  try {
    name = decodeURIComponent(String(value || ''));
  } catch {
    name = String(value || '');
  }
  name = name.replace(/[\r\n\\/]/g, '_').trim().slice(0, 200);
  return name || 'file';
}

function cleanMime(value) {
  const mime = String(value || '').split(';')[0].trim().toLowerCase();
  return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(mime) ? mime.slice(0, 100) : 'application/octet-stream';
}

function sendFile(res, file, cacheable) {
  const isImage = IMAGE_RE.test(file.mime);
  res.set('Content-Type', isImage ? file.mime : 'application/octet-stream');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Disposition', (isImage ? 'inline' : 'attachment') + "; filename*=UTF-8''" + encodeURIComponent(file.name));
  res.set('Cache-Control', cacheable ? 'public, max-age=86400' : 'private, max-age=3600');
  res.send(file.data);
}

// Загрузка вложения в чат: тело запроса - сам файл
router.post('/chat/:chatId', requireAuth, rawBody, wrap(async (req, res) => {
  const chatId = parseId(req.params.chatId);
  const member = await pool.query(
    'SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2',
    [chatId, req.userId]
  );
  if (!member.rowCount) {
    return res.status(404).json({ error: 'Чат не найден' });
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: 'Пустой файл' });
  }
  const { rows } = await pool.query(
    "INSERT INTO files (kind, owner_id, chat_id, name, mime, size, data) " +
    "VALUES ('attachment', $1, $2, $3, $4, $5, $6) RETURNING id, name, mime, size",
    [req.userId, chatId, cleanName(req.headers['x-file-name']), cleanMime(req.headers['x-file-type']), req.body.length, req.body]
  );
  res.status(201).json({ file: { id: rows[0].id, name: rows[0].name, mime: rows[0].mime, size: rows[0].size } });
}));

// Скачивание вложения: только для участников чата
router.get('/:id', requireAuth, wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const { rows } = await pool.query(
    "SELECT f.name, f.mime, f.data FROM files f WHERE f.id = $1 AND f.kind = 'attachment' " +
    'AND EXISTS (SELECT 1 FROM chat_members cm WHERE cm.chat_id = f.chat_id AND cm.user_id = $2)',
    [id, req.userId]
  );
  if (!rows[0]) {
    return res.status(404).json({ error: 'Файл не найден' });
  }
  sendFile(res, rows[0], false);
}));

// Фото профиля: открыто для всех, его видно в списках и профилях
router.get('/avatar/:id', wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const { rows } = await pool.query(
    "SELECT name, mime, data FROM files WHERE id = $1 AND kind = 'avatar'",
    [id]
  );
  if (!rows[0]) {
    return res.status(404).end();
  }
  sendFile(res, rows[0], true);
}));

// Загрузка своего фото: тело запроса - картинка
router.post('/avatar', requireAuth, rawBody, wrap(async (req, res) => {
  const mime = cleanMime(req.headers['x-file-type']);
  if (!IMAGE_RE.test(mime)) {
    return res.status(400).json({ error: 'Нужна картинка: PNG, JPEG, GIF или WebP' });
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: 'Пустой файл' });
  }
  if (req.body.length > MAX_AVATAR) {
    return res.status(413).json({ error: 'Фото больше 2 МБ' });
  }
  const ins = await pool.query(
    "INSERT INTO files (kind, owner_id, name, mime, size, data) VALUES ('avatar', $1, 'avatar', $2, $3, $4) RETURNING id",
    [req.userId, mime, req.body.length, req.body]
  );
  const fileId = ins.rows[0].id;
  await pool.query('UPDATE users SET avatar_file_id = $1 WHERE id = $2', [fileId, req.userId]);
  res.json({ avatarUrl: '/api/files/avatar/' + fileId });
}));

module.exports = router;