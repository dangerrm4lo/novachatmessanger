const http = require('http');
const path = require('path');
const express = require('express');
const { router: authRouter } = require('./auth');
const usersRouter = require('./users');
const chatsRouter = require('./chats');
const filesRouter = require('./files');
const announcementsRouter = require('./announcements');
const reportsRouter = require('./reports');
const adminRouter = require('./admin');
const { initRealtime } = require('./realtime');

const app = express();
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/chats', chatsRouter);
app.use('/api/files', filesRouter);
app.use('/api/announcements', announcementsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/admin', adminRouter);

app.use((err, req, res, next) => {
  if (err.status === 413) {
    return res.status(413).json({ error: 'Файл слишком большой' });
  }
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: 'Некорректный запрос' });
  }
  console.error(err);
  res.status(500).json({ error: 'Что-то пошло не так, попробуйте позже' });
});

const server = http.createServer(app);
initRealtime(server);

const port = process.env.PORT || 3000;
server.listen(port, () => console.log('NovaChat запущен на порту ' + port));