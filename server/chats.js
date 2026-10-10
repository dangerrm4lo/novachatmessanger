const express = require('express');
const { pool } = require('./db');
const { requireAuth } = require('./auth');
const { emitToUsers } = require('./realtime');

const router = express.Router();
router.use(requireAuth);

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const MAX_TEXT = 4000;
const PAGE = 50;
const GROUP_USERNAME_RE = /^[a-z0-9_]{5,32}$/;
const REACTIONS = ['\u{1F44D}', '\u{1F525}', '\u{1F602}', '\u{1F62E}', '\u{1F622}', '\u{1F389}'];

const WELCOME = {
  ru: (name) => 'Добро пожаловать в NovaChat, ' + name + '! Здесь можно писать друзьям. Тему и язык меняются в настройках, а профиль редактируется в разделе «Профиль». Нашёл ошибку или есть идея? Напиши @dangerrm4lo.',
  en: (name) => 'Welcome to NovaChat, ' + name + '! You can message your friends here. Change the theme and language in Settings, and edit your profile in Profile. Found a bug or have an idea? Write to @dangerrm4lo.',
};

const MESSAGE_SELECT = [
  'SELECT m.id, m.chat_id, m.sender_id, m.text, m.created_at, m.deleted_for_all,',
  '  m.forwarded_from_id, fu.display_name AS forwarded_name,',
  '  m.file_id, f.name AS file_name, f.mime AS file_mime, f.size AS file_size,',
  '  su.display_name AS sender_name, su.username AS sender_username,',
  '  EXISTS (SELECT 1 FROM chat_members cm WHERE cm.chat_id = m.chat_id',
  '    AND cm.user_id <> m.sender_id AND cm.last_read_id >= m.id) AS is_read',
  'FROM messages m',
  'LEFT JOIN files f ON f.id = m.file_id',
  'LEFT JOIN users fu ON fu.id = m.forwarded_from_id',
  'LEFT JOIN users su ON su.id = m.sender_id',
].join(' ');

const CHAT_LIST_SQL = [
  'SELECT c.id AS chat_id, c.kind, c.title, c.username AS group_username,',
  '  p.id AS peer_id, p.username AS peer_username, p.display_name AS peer_name,',
  '  p.is_verified AS peer_verified, p.is_system AS peer_system, p.avatar_file_id AS peer_avatar,',
  '  me.role AS my_role,',
  '  (SELECT COUNT(*)::int FROM chat_members x WHERE x.chat_id = c.id) AS member_count,',
  '  lm.id AS last_id, lm.text AS last_text, lm.created_at AS last_at, lm.sender_id AS last_sender_id,',
  '  lm.sender_name AS last_sender_name, lm.deleted_for_all AS last_deleted,',
  '  lm.file_id AS last_file_id, lm.is_read AS last_read,',
  '  (SELECT COUNT(*)::int FROM messages m',
  '    WHERE m.chat_id = c.id AND m.id > me.last_read_id AND m.sender_id IS DISTINCT FROM $1',
  '    AND NOT EXISTS (SELECT 1 FROM message_hidden h WHERE h.message_id = m.id AND h.user_id = $1)) AS unread',
  'FROM chat_members me',
  'JOIN chats c ON c.id = me.chat_id',
  "LEFT JOIN chat_members other ON other.chat_id = c.id AND other.user_id <> $1 AND c.kind = 'direct'",
  'LEFT JOIN users p ON p.id = other.user_id',
  'LEFT JOIN LATERAL (',
  '  SELECT m.id, m.text, m.created_at, m.sender_id, m.deleted_for_all, m.file_id,',
  '    su.display_name AS sender_name,',
  '    EXISTS (SELECT 1 FROM chat_members cm WHERE cm.chat_id = m.chat_id',
  '      AND cm.user_id <> m.sender_id AND cm.last_read_id >= m.id) AS is_read',
  '  FROM messages m',
  '  LEFT JOIN users su ON su.id = m.sender_id',
  '  WHERE m.chat_id = c.id',
  '    AND NOT EXISTS (SELECT 1 FROM message_hidden h WHERE h.message_id = m.id AND h.user_id = $1)',
  '  ORDER BY m.id DESC LIMIT 1',
  ') lm ON TRUE',
  'WHERE me.user_id = $1',
  'ORDER BY COALESCE(lm.created_at, c.created_at) DESC',
].join(' ');

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function avatarUrl(id) {
  return id ? '/api/files/avatar/' + id : null;
}

function notFound(res, text) {
  return res.status(404).json({ error: text || 'Чат не найден' });
}

async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Участие пользователя в чате и его роль; null, если его нет в чате
async function getMembership(chatId, userId) {
  if (!chatId) return null;
  const { rows } = await pool.query(
    'SELECT c.kind, cm.role, cm.last_read_id FROM chat_members cm ' +
    'JOIN chats c ON c.id = cm.chat_id WHERE cm.chat_id = $1 AND cm.user_id = $2',
    [chatId, userId]
  );
  return rows[0] || null;
}

async function hasSystemPeer(chatId, userId) {
  const { rowCount } = await pool.query(
    'SELECT 1 FROM chat_members cm JOIN users u ON u.id = cm.user_id ' +
    'WHERE cm.chat_id = $1 AND cm.user_id <> $2 AND u.is_system = TRUE',
    [chatId, userId]
  );
  return rowCount > 0;
}

// В группе пишут только владелец и админы, в личном чате всегда, кроме системного NovaChat
async function canPost(me, chatId, userId) {
  if (me.kind === 'group') return me.role === 'owner' || me.role === 'admin';
  return !(await hasSystemPeer(chatId, userId));
}

async function memberIds(chatId) {
  const { rows } = await pool.query('SELECT user_id FROM chat_members WHERE chat_id = $1', [chatId]);
  return rows.map((r) => r.user_id);
}

async function notifyMembers(chatId) {
  emitToUsers(await memberIds(chatId), 'chats:changed', {});
}

function mapMessage(r) {
  return {
    id: Number(r.id),
    chatId: r.chat_id,
    senderId: r.sender_id,
    senderName: r.sender_name || '',
    senderUsername: r.sender_username || '',
    text: r.text,
    createdAt: r.created_at,
    deleted: r.deleted_for_all,
    read: Boolean(r.is_read),
    reactions: [],
    file: r.file_id ? { id: r.file_id, name: r.file_name, mime: r.file_mime, size: r.file_size } : null,
    forwardedFrom: r.forwarded_from_id ? { id: r.forwarded_from_id, displayName: r.forwarded_name } : null,
  };
}

function mapChat(r) {
  const isGroup = r.kind === 'group';
  const peer = isGroup
    ? {
      id: null, username: r.group_username || '', displayName: r.title || '', isVerified: false,
      isSystem: false, isGroup: true, avatarUrl: null
    }
    : {
      id: r.peer_id, username: r.peer_username, displayName: r.peer_name, isVerified: r.peer_verified,
      isSystem: r.peer_system, isGroup: false, avatarUrl: avatarUrl(r.peer_avatar)
    };
  return {
    id: r.chat_id,
    kind: r.kind,
    peer: peer,
    memberCount: r.member_count,
    myRole: r.my_role,
    canPost: isGroup ? (r.my_role === 'owner' || r.my_role === 'admin') : true,
    lastMessage: r.last_id ? {
      id: Number(r.last_id),
      text: r.last_deleted ? '' : r.last_text,
      senderId: r.last_sender_id,
      senderName: r.last_sender_name || '',
      createdAt: r.last_at,
      deleted: r.last_deleted,
      hasFile: Boolean(r.last_file_id) && !r.last_deleted,
      read: Boolean(r.last_read),
    } : null,
    unread: r.unread,
  };
}

function mapGroupCard(r) {
  return {
    id: r.id,
    title: r.title,
    username: r.username,
    description: r.description || '',
    memberCount: r.member_count,
    isMember: Boolean(r.is_member),
  };
}

async function attachReactions(list, userId) {
  if (!list.length) return;
  const ids = list.map((m) => m.id);
  const { rows } = await pool.query(
    'SELECT message_id, emoji, COUNT(*)::int AS count, BOOL_OR(user_id = $2) AS mine ' +
    'FROM message_reactions WHERE message_id = ANY($1::bigint[]) GROUP BY message_id, emoji ORDER BY emoji',
    [ids, userId]
  );
  const byId = new Map(list.map((m) => [m.id, m]));
  rows.forEach((r) => {
    const m = byId.get(Number(r.message_id));
    if (m) m.reactions.push({ emoji: r.emoji, count: r.count, mine: r.mine });
  });
}

// Выборка сообщений: where и args дополняют запрос, placeholder $3 идёт первым аргументом
async function queryMessages(userId, chatId, where, args, order, limit) {
  const params = [chatId, userId].concat(args);
  params.push(limit);
  const sql = MESSAGE_SELECT +
    ' WHERE m.chat_id = $1' + where +
    ' AND NOT EXISTS (SELECT 1 FROM message_hidden h WHERE h.message_id = m.id AND h.user_id = $2)' +
    ' ORDER BY m.id ' + order + ' LIMIT $' + params.length;
  const { rows } = await pool.query(sql, params);
  const list = rows.map(mapMessage);
  if (order === 'DESC') list.reverse();
  return list;
}

async function fetchMessageForUser(messageId, userId) {
  const { rows } = await pool.query(
    MESSAGE_SELECT +
    ' WHERE m.id = $1 AND NOT EXISTS (SELECT 1 FROM message_hidden h WHERE h.message_id = m.id AND h.user_id = $2)',
    [messageId, userId]
  );
  if (!rows[0]) return null;
  const list = [mapMessage(rows[0])];
  await attachReactions(list, userId);
  return list[0];
}

// Событие уходит каждому участнику со своими данными (реакции и скрытие зависят от пользователя)
async function broadcast(chatId, messageId, event) {
  const ids = await memberIds(chatId);
  for (const id of ids) {
    const payload = await fetchMessageForUser(messageId, id);
    if (payload) emitToUsers([id], event, payload);
  }
}

async function groupInfo(chatId, myRole) {
  const info = await pool.query('SELECT id, title, username, description FROM chats WHERE id = $1', [chatId]);
  const members = await pool.query(
    'SELECT u.id, u.username, u.display_name, u.is_verified, u.avatar_file_id, cm.role ' +
    'FROM chat_members cm JOIN users u ON u.id = cm.user_id WHERE cm.chat_id = $1 ' +
    "ORDER BY CASE cm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.display_name",
    [chatId]
  );
  const c = info.rows[0];
  return {
    id: c.id,
    title: c.title,
    username: c.username,
    description: c.description,
    myRole: myRole,
    memberCount: members.rows.length,
    members: members.rows.map((m) => ({
      id: m.id,
      username: m.username,
      displayName: m.display_name,
      isVerified: m.is_verified,
      avatarUrl: avatarUrl(m.avatar_file_id),
      role: m.role,
    })),
  };
}

async function ensureWelcomeChat(userId) {
  await withTx(async (client) => {
    const flag = await client.query(
      'UPDATE users SET welcome_sent = TRUE WHERE id = $1 AND welcome_sent = FALSE RETURNING display_name, language',
      [userId]
    );
    if (flag.rowCount === 0) return;

    const name = flag.rows[0].display_name;
    const language = flag.rows[0].language;
    const sys = await client.query("SELECT id FROM users WHERE username = 'novachat' AND is_system = TRUE");
    const systemId = sys.rows[0].id;

    const chat = await client.query('INSERT INTO chats DEFAULT VALUES RETURNING id');
    const chatId = chat.rows[0].id;
    await client.query(
      'INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2), ($1, $3)',
      [chatId, systemId, userId]
    );
    const text = (WELCOME[language] || WELCOME.ru)(name);
    await client.query(
      'INSERT INTO messages (chat_id, sender_id, text) VALUES ($1, $2, $3)',
      [chatId, systemId, text]
    );
  });
}

// ----- Список и личные чаты -----

router.get('/', wrap(async (req, res) => {
  await ensureWelcomeChat(req.userId);
  const { rows } = await pool.query(CHAT_LIST_SQL, [req.userId]);
  // Личный чат без собеседника (аккаунт удалён) не показываем
  res.json({ chats: rows.filter((r) => r.kind === 'group' || r.peer_id).map(mapChat) });
}));

router.post('/', wrap(async (req, res) => {
  const username = String((req.body || {}).username || '').trim().toLowerCase();
  const { rows } = await pool.query('SELECT id, is_system FROM users WHERE username = $1', [username]);
  const peer = rows[0];
  if (!peer) return notFound(res, 'Пользователь не найден');
  if (peer.id === req.userId) return res.status(400).json({ error: 'Нельзя написать самому себе' });
  if (peer.is_system) return res.status(403).json({ error: 'Этот аккаунт не принимает сообщения' });
  const existing = await pool.query(
    "SELECT c.id FROM chats c JOIN chat_members a ON a.chat_id = c.id AND a.user_id = $1 " +
    "JOIN chat_members b ON b.chat_id = c.id AND b.user_id = $2 WHERE c.kind = 'direct' LIMIT 1",
    [req.userId, peer.id]
  );
  if (existing.rows[0]) return res.json({ chatId: existing.rows[0].id });

  const chatId = await withTx(async (client) => {
    const chat = await client.query('INSERT INTO chats DEFAULT VALUES RETURNING id');
    const id = chat.rows[0].id;
    await client.query(
      'INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2), ($1, $3)',
      [id, req.userId, peer.id]
    );
    return id;
  });
  emitToUsers([req.userId, peer.id], 'chats:changed', {});
  res.status(201).json({ chatId: chatId });
}));

// ----- Группы -----

router.get('/groups/search', wrap(async (req, res) => {
  const q = String(req.query.q || '').toLowerCase().replace(/[^a-z0-9_]/g, '').replace(/_/g, '\\_');
  if (!q) return res.json({ groups: [] });
  const { rows } = await pool.query(
    "SELECT c.id, c.title, c.username, c.description, " +
    "(SELECT COUNT(*) FROM chat_members x WHERE x.chat_id = c.id)::int AS member_count, " +
    "EXISTS (SELECT 1 FROM chat_members m WHERE m.chat_id = c.id AND m.user_id = $2) AS is_member " +
    "FROM chats c WHERE c.kind = 'group' AND c.username LIKE $1 ORDER BY member_count DESC LIMIT 20",
    [q + '%', req.userId]
  );
  res.json({ groups: rows.map(mapGroupCard) });
}));

router.get('/groups/check', wrap(async (req, res) => {
  const username = String(req.query.username || '').trim().toLowerCase();
  if (!GROUP_USERNAME_RE.test(username)) {
    return res.json({ available: false, reason: 'invalid' });
  }
  const taken = await pool.query(
    'SELECT 1 FROM users WHERE username = $1 UNION ALL SELECT 1 FROM chats WHERE username = $1',
    [username]
  );
  res.json({ available: taken.rowCount === 0 });
}));

router.post('/groups', wrap(async (req, res) => {
  const body = req.body || {};
  const title = String(body.title || '').trim();
  const username = String(body.username || '').trim().toLowerCase();
  const description = String(body.description || '').trim().slice(0, 300);
  if (title.length < 1 || title.length > 64) {
    return res.status(400).json({ error: 'Название: от 1 до 64 символов' });
  }
  if (!GROUP_USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Юзернейм группы: 5–32 символа, латиница, цифры и _' });
  }
  const taken = await pool.query(
    'SELECT 1 FROM users WHERE username = $1 UNION ALL SELECT 1 FROM chats WHERE username = $1',
    [username]
  );
  if (taken.rowCount) return res.status(409).json({ error: 'Этот юзернейм уже занят' });

  try {
    const chatId = await withTx(async (client) => {
      const ins = await client.query(
        "INSERT INTO chats (kind, title, username, description, owner_id) VALUES ('group', $1, $2, $3, $4) RETURNING id",
        [title, username, description, req.userId]
      );
      const id = ins.rows[0].id;
      await client.query(
        "INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, 'owner')",
        [id, req.userId]
      );
      return id;
    });
    emitToUsers([req.userId], 'chats:changed', {});
    res.status(201).json({ chatId: chatId });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Этот юзернейм уже занят' });
    throw err;
  }
}));

router.get('/:id', wrap(async (req, res) => {
  const chatId = parseId(req.params.id);
  const me = await getMembership(chatId, req.userId);
  if (!me || me.kind !== 'group') return notFound(res, 'Группа не найдена');
  res.json({ group: await groupInfo(chatId, me.role) });
}));

router.patch('/:id', wrap(async (req, res) => {
  const chatId = parseId(req.params.id);
  const me = await getMembership(chatId, req.userId);
  if (!me || me.kind !== 'group') return notFound(res, 'Группа не найдена');
  if (me.role !== 'owner' && me.role !== 'admin') return res.status(403).json({ error: 'Нет прав' });
  const body = req.body || {};
  const sets = [];
  const params = [];
  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (title.length < 1 || title.length > 64) {
      return res.status(400).json({ error: 'Название: от 1 до 64 символов' });
    }
    params.push(title);
    sets.push('title = $' + params.length);
  }
  if (body.description !== undefined) {
    params.push(String(body.description).trim().slice(0, 300));
    sets.push('description = $' + params.length);
  }
  if (!sets.length) return res.status(400).json({ error: 'Нечего сохранять' });

  params.push(chatId);
  await pool.query('UPDATE chats SET ' + sets.join(', ') + ' WHERE id = $' + params.length, params);
  await notifyMembers(chatId);
  res.json({ ok: true });
}));

router.delete('/:id', wrap(async (req, res) => {
  const chatId = parseId(req.params.id);
  const me = await getMembership(chatId, req.userId);
  if (!me || me.kind !== 'group') return notFound(res, 'Группа не найдена');
  if (me.role !== 'owner') return res.status(403).json({ error: 'Удалить группу может только владелец' });

  const ids = await memberIds(chatId);
  await pool.query('DELETE FROM chats WHERE id = $1', [chatId]);
  emitToUsers(ids, 'chats:changed', {});
  res.json({ ok: true });
}));

router.post('/:id/join', wrap(async (req, res) => {
  const chatId = parseId(req.params.id);
  const group = await pool.query("SELECT id FROM chats WHERE id = $1 AND kind = 'group'", [chatId]);
  if (!group.rowCount) return notFound(res, 'Группа не найдена');
  await pool.query(
    "INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING",
    [chatId, req.userId]
  );
  emitToUsers([req.userId], 'chats:changed', {});
  res.json({ chatId: chatId });
}));

router.post('/:id/leave', wrap(async (req, res) => {
  const chatId = parseId(req.params.id);
  const me = await getMembership(chatId, req.userId);
  if (!me || me.kind !== 'group') return notFound(res, 'Группа не найдена');
  if (me.role === 'owner') {
    return res.status(400).json({ error: 'Владелец не может выйти. Чтобы закрыть группу, удалите её' });
  }
  await pool.query('DELETE FROM chat_members WHERE chat_id = $1 AND user_id = $2', [chatId, req.userId]);
  emitToUsers([req.userId], 'chats:changed', {});
  res.json({ ok: true });
}));

router.post('/:id/members', wrap(async (req, res) => {
  const chatId = parseId(req.params.id);
  const me = await getMembership(chatId, req.userId);
  if (!me || me.kind !== 'group') return notFound(res, 'Группа не найдена');
  if (me.role !== 'owner' && me.role !== 'admin') return res.status(403).json({ error: 'Нет прав' });

  const username = String((req.body || {}).username || '').trim().toLowerCase();
  const u = await pool.query('SELECT id, is_system FROM users WHERE username = $1', [username]);
  if (!u.rows[0] || u.rows[0].is_system) return notFound(res, 'Пользователь не найден');

  await pool.query(
    "INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING",
    [chatId, u.rows[0].id]
  );
  emitToUsers([u.rows[0].id], 'chats:changed', {});
  res.status(201).json({ ok: true });
}));

router.delete('/:id/members/:userId', wrap(async (req, res) => {
  const chatId = parseId(req.params.id);
  const targetId = parseId(req.params.userId);
  const me = await getMembership(chatId, req.userId);
  if (!me || me.kind !== 'group' || !targetId) return notFound(res, 'Группа не найдена');
  if (me.role !== 'owner' && me.role !== 'admin') return res.status(403).json({ error: 'Нет прав' });

  const target = await pool.query(
    'SELECT role FROM chat_members WHERE chat_id = $1 AND user_id = $2',
    [chatId, targetId]
  );
  if (!target.rowCount) return notFound(res, 'Участник не найден');
  const role = target.rows[0].role;
  if (role === 'owner') return res.status(400).json({ error: 'Нельзя исключить владельца' });
  if (role === 'admin' && me.role !== 'owner') {
    return res.status(403).json({ error: 'Только владелец может исключить администратора' });
  }

  await pool.query('DELETE FROM chat_members WHERE chat_id = $1 AND user_id = $2', [chatId, targetId]);
  emitToUsers([targetId], 'chats:changed', {});
  res.json({ ok: true });
}));

router.post('/:id/members/:userId/role', wrap(async (req, res) => {
  const chatId = parseId(req.params.id);
  const targetId = parseId(req.params.userId);
  const me = await getMembership(chatId, req.userId);
  if (!me || me.kind !== 'group' || !targetId) return notFound(res, 'Группа не найдена');
  if (me.role !== 'owner') return res.status(403).json({ error: 'Назначать администраторов может только владелец' });

  const role = (req.body || {}).role;
  if (role !== 'admin' && role !== 'member') return res.status(400).json({ error: 'Неизвестная роль' });

  const target = await pool.query(
    'SELECT role FROM chat_members WHERE chat_id = $1 AND user_id = $2',
    [chatId, targetId]
  );
  if (!target.rowCount) return notFound(res, 'Участник не найден');
  if (target.rows[0].role === 'owner') return res.status(400).json({ error: 'Роль владельца нельзя изменить' });

  await pool.query('UPDATE chat_members SET role = $1 WHERE chat_id = $2 AND user_id = $3', [role, chatId, targetId]);
  emitToUsers([targetId], 'chats:changed', {});
  res.json({ ok: true });
}));

// ----- Сообщения -----

// Окно сообщений: latest (по умолчанию), before (старее), after (новее), around (вокруг сообщения)
router.get('/:id/messages', wrap(async (req, res) => {
  const chatId = parseId(req.params.id);
  const me = await getMembership(chatId, req.userId);
  if (!me) return notFound(res);

  const limit = Math.min(parseId(req.query.limit) || PAGE, 100);
  const before = parseId(req.query.before);
  const after = parseId(req.query.after);
  const around = parseId(req.query.around);

  if (around) {
    const half = Math.floor(limit / 2);
    const older = await queryMessages(req.userId, chatId, ' AND m.id < $3', [around], 'DESC', half + 1);
    const anchor = await queryMessages(req.userId, chatId, ' AND m.id = $3', [around], 'DESC', 1);
    const newer = await queryMessages(req.userId, chatId, ' AND m.id > $3', [around], 'ASC', half + 1);
    const messages = older.slice(-half).concat(anchor, newer.slice(0, half));
    await attachReactions(messages, req.userId);
    return res.json({
      messages: messages,
      hasOlder: older.length > half,
      hasNewer: newer.length > half,
    });
  }

  if (after) {
    const newer = await queryMessages(req.userId, chatId, ' AND m.id > $3', [after], 'ASC', limit + 1);
    const messages = newer.slice(0, limit);
    await attachReactions(messages, req.userId);
    return res.json({ messages: messages, hasNewer: newer.length > limit });
  }

  const where = before ? ' AND m.id < $3' : '';
  const args = before ? [before] : [];
  const list = await queryMessages(req.userId, chatId, where, args, 'DESC', limit + 1);
  const messages = list.slice(-limit);
  await attachReactions(messages, req.userId);
  res.json({ messages: messages, hasMore: list.length > limit });
}));

router.get('/:id/search', wrap(async (req, res) => {
  const chatId = parseId(req.params.id);
  const me = await getMembership(chatId, req.userId);
  if (!me) return notFound(res);

  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ messages: [] });
  const pattern = '%' + q.replace(/[\\%_]/g, '\\$&') + '%';

  const { rows } = await pool.query(
    MESSAGE_SELECT +
    ' WHERE m.chat_id = $1 AND m.deleted_for_all = FALSE AND m.text ILIKE $2' +
    ' AND NOT EXISTS (SELECT 1 FROM message_hidden h WHERE h.message_id = m.id AND h.user_id = $3)' +
    ' ORDER BY m.id DESC LIMIT 50',
    [chatId, pattern, req.userId]
  );
  res.json({ messages: rows.map(mapMessage) });
}));

router.post('/:id/messages', wrap(async (req, res) => {
  const chatId = parseId(req.params.id);
  const me = await getMembership(chatId, req.userId);
  if (!me) return notFound(res);
  if (!(await canPost(me, chatId, req.userId))) {
    return res.status(403).json({
      error: me.kind === 'group'
        ? 'Писать в группе могут только администраторы'
        : 'Сообщения в NovaChat не принимаются',
    });
  }

  const body = req.body || {};
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const fileId = parseId(body.fileId);
  if (!text && !fileId) return res.status(400).json({ error: 'Пустое сообщение' });
  if (text.length > MAX_TEXT) return res.status(400).json({ error: 'Сообщение: не больше 4000 символов' });

  if (fileId) {
    const ok = await pool.query(
      "SELECT 1 FROM files WHERE id = $1 AND kind = 'attachment' AND chat_id = $2 AND owner_id = $3",
      [fileId, chatId, req.userId]
    );
    if (!ok.rowCount) return res.status(400).json({ error: 'Файл не найден' });
  }

  const ins = await pool.query(
    'INSERT INTO messages (chat_id, sender_id, text, file_id) VALUES ($1, $2, $3, $4) RETURNING id',
    [chatId, req.userId, text, fileId]
  );
  await broadcast(chatId, ins.rows[0].id, 'message:new');
  const message = await fetchMessageForUser(ins.rows[0].id, req.userId);
  res.status(201).json({ message: message });
}));

router.post('/:id/forward', wrap(async (req, res) => {
  const chatId = parseId(req.params.id);
  const messageId = parseId((req.body || {}).messageId);
  const me = await getMembership(chatId, req.userId);
  if (!me || !messageId) return notFound(res);
  if (!(await canPost(me, chatId, req.userId))) {
    return res.status(403).json({ error: 'Писать в этом чате нельзя' });
  }

  const { rows } = await pool.query(
    'SELECT m.text, m.file_id, m.sender_id, m.forwarded_from_id FROM messages m ' +
    'JOIN chat_members cm ON cm.chat_id = m.chat_id AND cm.user_id = $2 ' +
    'WHERE m.id = $1 AND m.deleted_for_all = FALSE ' +
    'AND NOT EXISTS (SELECT 1 FROM message_hidden h WHERE h.message_id = m.id AND h.user_id = $2)',
    [messageId, req.userId]
  );
  const src = rows[0];
  if (!src) return notFound(res, 'Сообщение не найдено');

  let fileId = null;
  if (src.file_id) {
    const copy = await pool.query(
      'INSERT INTO files (kind, owner_id, chat_id, name, mime, size, data) ' +
      'SELECT kind, $1::integer, $2::integer, name, mime, size, data FROM files WHERE id = $3 RETURNING id',
      [req.userId, chatId, src.file_id]
    );
    fileId = copy.rows[0].id;
  }

  const origin = src.forwarded_from_id || src.sender_id;
  const ins = await pool.query(
    'INSERT INTO messages (chat_id, sender_id, text, file_id, forwarded_from_id) ' +
    'VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [chatId, req.userId, src.text, fileId, origin]
  );
  await broadcast(chatId, ins.rows[0].id, 'message:new');
  const message = await fetchMessageForUser(ins.rows[0].id, req.userId);
  res.status(201).json({ message: message });
}));

router.post('/:id/messages/:messageId/reactions', wrap(async (req, res) => {
  const chatId = parseId(req.params.id);
  const messageId = parseId(req.params.messageId);
  const emoji = String((req.body || {}).emoji || '');
  const me = await getMembership(chatId, req.userId);
  if (!me || !messageId) return notFound(res);
  if (REACTIONS.indexOf(emoji) === -1) return res.status(400).json({ error: 'Неизвестная реакция' });

  const exists = await pool.query(
    'SELECT 1 FROM messages WHERE id = $1 AND chat_id = $2 AND deleted_for_all = FALSE',
    [messageId, chatId]
  );
  if (!exists.rowCount) return notFound(res, 'Сообщение не найдено');

  const removed = await pool.query(
    'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
    [messageId, req.userId, emoji]
  );
  if (!removed.rowCount) {
    await pool.query(
      'INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)',
      [messageId, req.userId, emoji]
    );
  }
  await broadcast(chatId, messageId, 'message:updated');
  const message = await fetchMessageForUser(messageId, req.userId);
  res.json({ message: message });
}));

// scope=me скрывает у себя. scope=all удаляет у всех: автор, а в группе ещё и владелец с админами
router.delete('/:id/messages/:messageId', wrap(async (req, res) => {
  const chatId = parseId(req.params.id);
  const messageId = parseId(req.params.messageId);
  const scope = req.query.scope === 'all' ? 'all' : 'me';
  const me = await getMembership(chatId, req.userId);
  if (!me || !messageId) return notFound(res);

  const msg = await pool.query('SELECT id, sender_id FROM messages WHERE id = $1 AND chat_id = $2', [messageId, chatId]);
  if (!msg.rowCount) return notFound(res, 'Сообщение не найдено');

  if (scope === 'all') {
    const isMod = me.kind === 'group' && (me.role === 'owner' || me.role === 'admin');
    if (msg.rows[0].sender_id !== req.userId && !isMod) {
      return res.status(403).json({ error: 'Нельзя удалить чужое сообщение' });
    }
    await pool.query("UPDATE messages SET deleted_for_all = TRUE, text = '', file_id = NULL WHERE id = $1", [messageId]);
    await pool.query('DELETE FROM message_reactions WHERE message_id = $1', [messageId]);
    await broadcast(chatId, messageId, 'message:updated');
  } else {
    await pool.query(
      'INSERT INTO message_hidden (message_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [messageId, req.userId]
    );
    emitToUsers([req.userId], 'message:removed', { id: messageId, chatId: chatId });
  }
  res.json({ ok: true });
}));

router.post('/:id/read', wrap(async (req, res) => {
  const chatId = parseId(req.params.id);
  const me = await getMembership(chatId, req.userId);
  if (!me) return notFound(res);

  await pool.query(
    'UPDATE chat_members SET last_read_id = GREATEST(last_read_id, ' +
    'COALESCE((SELECT MAX(id) FROM messages WHERE chat_id = $1), 0)) ' +
    'WHERE chat_id = $1 AND user_id = $2',
    [chatId, req.userId]
  );
  const lastRead = await pool.query(
    'SELECT last_read_id FROM chat_members WHERE chat_id = $1 AND user_id = $2',
    [chatId, req.userId]
  );
  const others = await pool.query(
    'SELECT user_id FROM chat_members WHERE chat_id = $1 AND user_id <> $2',
    [chatId, req.userId]
  );
  emitToUsers(others.rows.map((r) => r.user_id), 'chat:read', {
    chatId: chatId,
    readerId: req.userId,
    lastReadId: Number(lastRead.rows[0].last_read_id),
  });
  res.json({ ok: true });
}));

module.exports = router;