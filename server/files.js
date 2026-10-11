const express = require('express');
const { pool } = require('./db');
const { requireAuth } = require('./auth');
const { emitToUsers } = require('./realtime');

const router = express.Router();
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const rawBody = express.raw({ type: () => true, limit: '10mb' });

const IMAGE_RE = /^image\/(png|jpeg|gif|webp)$/;
const VIDEO_RE = /^video\/(mp4|webm|quicktime)$/;
const AUDIO_RE = /^audio\/(mpeg|mp3|wav|x-wav|wave)$/;
const MAX_AVATAR = 2 * 1024 * 1024;
const MAX_BANNER = 5 * 1024 * 1024;
const MAX_MUSIC = 10 * 1024 * 1024;

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
  const inline = IMAGE_RE.test(file.mime) || VIDEO_RE.test(file.mime) || AUDIO_RE.test(file.mime);
  res.set('Content-Type', inline ? file.mime : 'application/octet-stream');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Disposition', (inline ? 'inline' : 'attachment') + "; filename*=UTF-8''" + encodeURIComponent(file.name));
  res.set('Cache-Control', cacheable ? 'public, max-age=86400' : 'private, max-age=3600');
  res.send(file.data);
}

function publicUrl(id) {
  return '/api/files/public/' + id;
}

function avatarUrl(id) {
  return '/api/files/avatar/' + id;
}

async function deleteFile(id) {
  if (id) await pool.query('DELETE FROM files WHERE id = $1', [id]);
}

async function notifyChat(chatId) {
  const { rows } = await pool.query('SELECT user_id FROM chat_members WHERE chat_id = $1', [chatId]);
  emitToUsers(rows.map((r) => r.user_id), 'chats:changed', {});
}

async function groupRole(chatId, userId) {
  const { rows } = await pool.query(
    "SELECT cm.role FROM chat_members cm JOIN chats c ON c.id = cm.chat_id " +
    "WHERE cm.chat_id = $1 AND cm.user_id = $2 AND c.kind = 'group'",
    [chatId, userId]
  );
  return rows[0] ? rows[0].role : null;
}

// Читает картинку из тела запроса и проверяет тип и размер
async function readImage(req, res, limit) {
  const mime = cleanMime(req.headers['x-file-type']);
  if (!IMAGE_RE.test(mime)) {
    res.status(400).json({ error: 'Нужна картинка: PNG, JPEG, GIF или WebP' });
    return null;
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    res.status(400).json({ error: 'Пустой файл' });
    return null;
  }
  if (req.body.length > limit) {
    res.status(413).json({ error: 'Файл слишком большой' });
    return null;
  }
  return { mime: mime, size: req.body.length, data: req.body };
}

// Вложение в чат
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

// Фото пользователей и групп
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

// Публичные файлы профиля: баннеры и музыка видны всем
router.get('/public/:id', wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const { rows } = await pool.query(
    "SELECT name, mime, data FROM files WHERE id = $1 AND kind IN ('avatar', 'banner', 'music')",
    [id]
  );
  if (!rows[0]) {
    return res.status(404).end();
  }
  sendFile(res, rows[0], true);
}));

// Своё фото
router.post('/avatar', requireAuth, rawBody, wrap(async (req, res) => {
  const img = await readImage(req, res, MAX_AVATAR);
  if (!img) return;
  const old = await pool.query('SELECT avatar_file_id FROM users WHERE id = $1', [req.userId]);
  const ins = await pool.query(
    "INSERT INTO files (kind, owner_id, name, mime, size, data) VALUES ('avatar', $1, 'avatar', $2, $3, $4) RETURNING id",
    [req.userId, img.mime, img.size, img.data]
  );
  await pool.query('UPDATE users SET avatar_file_id = $1 WHERE id = $2', [ins.rows[0].id, req.userId]);
  await deleteFile(old.rows[0] && old.rows[0].avatar_file_id);
  res.json({ avatarUrl: avatarUrl(ins.rows[0].id) });
}));

// Баннер профиля: только с Nova+
router.post('/banner', requireAuth, rawBody, wrap(async (req, res) => {
  const plus = await pool.query('SELECT nova_plus FROM users WHERE id = $1', [req.userId]);
  if (!plus.rows[0] || !plus.rows[0].nova_plus) {
    return res.status(403).json({ error: 'Баннер доступен с Nova+' });
  }
  const img = await readImage(req, res, MAX_BANNER);
  if (!img) return;
  const old = await pool.query('SELECT banner_file_id FROM users WHERE id = $1', [req.userId]);
  const ins = await pool.query(
    "INSERT INTO files (kind, owner_id, name, mime, size, data) VALUES ('banner', $1, 'banner', $2, $3, $4) RETURNING id",
    [req.userId, img.mime, img.size, img.data]
  );
  await pool.query('UPDATE users SET banner_file_id = $1 WHERE id = $2', [ins.rows[0].id, req.userId]);
  await deleteFile(old.rows[0] && old.rows[0].banner_file_id);
  res.json({ bannerUrl: publicUrl(ins.rows[0].id) });
}));

router.delete('/banner', requireAuth, wrap(async (req, res) => {
  const old = await pool.query('SELECT banner_file_id FROM users WHERE id = $1', [req.userId]);
  await pool.query('UPDATE users SET banner_file_id = NULL WHERE id = $1', [req.userId]);
  await deleteFile(old.rows[0] && old.rows[0].banner_file_id);
  res.json({ ok: true });
}));

// Музыка профиля: mp3 или wav
router.post('/music', requireAuth, rawBody, wrap(async (req, res) => {
  const mime = cleanMime(req.headers['x-file-type']);
  if (!AUDIO_RE.test(mime)) {
    return res.status(400).json({ error: 'Нужна музыка: mp3 или wav' });
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: 'Пустой файл' });
  }
  if (req.body.length > MAX_MUSIC) {
    return res.status(413).json({ error: 'Музыка больше 10 МБ' });
  }
  const title = cleanName(req.headers['x-file-name']).replace(/\.[a-z0-9]+$/i, '').slice(0, 100) || 'Музыка';
  const old = await pool.query('SELECT music_file_id FROM users WHERE id = $1', [req.userId]);
  const ins = await pool.query(
    "INSERT INTO files (kind, owner_id, name, mime, size, data) VALUES ('music', $1, $2, $3, $4, $5) RETURNING id",
    [req.userId, title, mime, req.body.length, req.body]
  );
  await pool.query('UPDATE users SET music_file_id = $1, music_title = $2 WHERE id = $3', [ins.rows[0].id, title, req.userId]);
  await deleteFile(old.rows[0] && old.rows[0].music_file_id);
  res.status(201).json({ musicUrl: publicUrl(ins.rows[0].id), musicTitle: title });
}));

router.delete('/music', requireAuth, wrap(async (req, res) => {
  const old = await pool.query('SELECT music_file_id FROM users WHERE id = $1', [req.userId]);
  await pool.query('UPDATE users SET music_file_id = NULL, music_title = NULL WHERE id = $1', [req.userId]);
  await deleteFile(old.rows[0] && old.rows[0].music_file_id);
  res.json({ ok: true });
}));

// Фото группы: владелец и админы
router.post('/group/:chatId/avatar', requireAuth, rawBody, wrap(async (req, res) => {
  const chatId = parseId(req.params.chatId);
  const role = await groupRole(chatId, req.userId);
  if (role !== 'owner' && role !== 'admin') {
    return res.status(403).json({ error: 'Менять фото группы могут владелец и админы' });
  }
  const img = await readImage(req, res, MAX_AVATAR);
  if (!img) return;
  const old = await pool.query('SELECT avatar_file_id FROM chats WHERE id = $1', [chatId]);
  const ins = await pool.query(
    "INSERT INTO files (kind, owner_id, name, mime, size, data) VALUES ('avatar', $1, 'group-avatar', $2, $3, $4) RETURNING id",
    [req.userId, img.mime, img.size, img.data]
  );
  await pool.query('UPDATE chats SET avatar_file_id = $1 WHERE id = $2', [ins.rows[0].id, chatId]);
  await deleteFile(old.rows[0] && old.rows[0].avatar_file_id);
  await notifyChat(chatId);
  res.json({ avatarUrl: avatarUrl(ins.rows[0].id) });
}));

// Баннер группы: только владелец, и у владельца должен быть Nova+
router.post('/group/:chatId/banner', requireAuth, rawBody, wrap(async (req, res) => {
  const chatId = parseId(req.params.chatId);
  const role = await groupRole(chatId, req.userId);
  if (role !== 'owner') {
    return res.status(403).json({ error: 'Баннер группы может поставить только владелец' });
  }
  const owner = await pool.query(
    'SELECT u.nova_plus FROM chats c JOIN users u ON u.id = c.owner_id WHERE c.id = $1',
    [chatId]
  );
  if (!owner.rows[0] || !owner.rows[0].nova_plus) {
    return res.status(403).json({ error: 'Баннер группы доступен владельцу с Nova+' });
  }
  const img = await readImage(req, res, MAX_BANNER);
  if (!img) return;
  const old = await pool.query('SELECT banner_file_id FROM chats WHERE id = $1', [chatId]);
  const ins = await pool.query(
    "INSERT INTO files (kind, owner_id, name, mime, size, data) VALUES ('banner', $1, 'group-banner', $2, $3, $4) RETURNING id",
    [req.userId, img.mime, img.size, img.data]
  );
  await pool.query('UPDATE chats SET banner_file_id = $1 WHERE id = $2', [ins.rows[0].id, chatId]);
  await deleteFile(old.rows[0] && old.rows[0].banner_file_id);
  await notifyChat(chatId);
  res.json({ bannerUrl: publicUrl(ins.rows[0].id) });
}));

module.exports = router;