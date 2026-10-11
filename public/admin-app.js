(function () {
  'use strict';

  const NC = window.NC;
  const $ = (id) => document.getElementById(id);
  const esc = NC.esc;

  NC.setAdminMode(true);

  const state = {
    minutes: 5,
    reason: 'fix',
    announcement: null,
    meId: null,
  };

  function toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function renderAnnounceState() {
    const a = state.announcement;
    $('announceState').textContent = a
      ? 'Сейчас показывается: ' + (a.kind === 'info' ? 'информация' : 'тех. работы')
      : 'Сейчас объявлений нет';
    $('endAnnounce').disabled = !a;
  }

  function renderPreview() {
    $('previewText').textContent = NC.announcementPreview({
      kind: 'maintenance',
      minutes: state.minutes,
      reason: state.reason,
    });
  }

  async function loadAnnouncement() {
    try {
      const data = await NC.api('GET', '/api/announcements/active', undefined, { keepSession: true });
      state.announcement = data.announcement;
      renderAnnounceState();
    } catch (err) {
      toast(err.message);
    }
  }

  // ----- Объявления -----

  $('minutesSeg').addEventListener('click', (e) => {
    const btn = e.target.closest('.seg');
    if (!btn) return;
    state.minutes = Number(btn.dataset.value);
    NC.setSegValue($('minutesSeg'), btn.dataset.value);
    renderPreview();
  });

  $('reasonSeg').addEventListener('click', (e) => {
    const btn = e.target.closest('.seg');
    if (!btn) return;
    state.reason = btn.dataset.value;
    NC.setSegValue($('reasonSeg'), btn.dataset.value);
    renderPreview();
  });

  $('sendMaint').addEventListener('click', async () => {
    if (!window.confirm('Отправить объявление всем пользователям?')) return;
    try {
      const data = await NC.api('POST', '/api/admin/announcements', {
        kind: 'maintenance',
        minutes: state.minutes,
        reason: state.reason,
      });
      state.announcement = data.announcement;
      renderAnnounceState();
      toast('Объявление отправлено');
      NC.loadNotices();
    } catch (err) {
      toast(err.message);
    }
  });

  $('sendInfo').addEventListener('click', async () => {
    const text = $('infoText').value.trim();
    if (!text) return toast('Введите текст');
    try {
      const data = await NC.api('POST', '/api/admin/announcements', { kind: 'info', text: text });
      state.announcement = data.announcement;
      renderAnnounceState();
      $('infoText').value = '';
      toast('Опубликовано');
      NC.loadNotices();
    } catch (err) {
      toast(err.message);
    }
  });

  $('endAnnounce').addEventListener('click', async () => {
    try {
      await NC.api('POST', '/api/admin/announcements/end');
      state.announcement = null;
      renderAnnounceState();
      toast('Объявление убрано');
      NC.loadNotices();
    } catch (err) {
      toast(err.message);
    }
  });

  // ----- Жалобы -----

  function reportHtml(r) {
    const frozenTag = r.target.frozen ? '<span class="tag warn">заморожен</span>' : '';
    return '<li class="report-item" data-id="' + r.id + '">' +
      '<div class="user-row-head">@' + esc(r.target.username) + frozenTag + '</div>' +
      '<p class="report-reason">' + esc(r.reason) + '</p>' +
      '<p class="report-meta">от @' + esc(r.reporter || 'удалённый аккаунт') + '</p>' +
      '<div class="row-actions">' +
      '<button class="mini-btn" type="button" data-act="close">Закрыть</button>' +
      '<button class="mini-btn warn" type="button" data-act="freeze">Заморозить</button>' +
      '<button class="mini-btn danger" type="button" data-act="delete" data-target="' + r.target.id + '">Удалить аккаунт</button>' +
      '</div>' +
      '</li>';
  }

  async function loadReports() {
    try {
      const data = await NC.api('GET', '/api/admin/reports');
      $('reportList').innerHTML = data.reports.map(reportHtml).join('');
      $('reportsEmpty').hidden = data.reports.length > 0;
    } catch (err) {
      toast(err.message);
    }
  }

  $('reportList').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const item = btn.closest('.report-item');
    const id = Number(item.dataset.id);
    const act = btn.dataset.act;
    try {
      if (act === 'close') {
        await NC.api('POST', '/api/admin/reports/' + id + '/resolve', { freeze: false });
      } else if (act === 'freeze') {
        const reason = window.prompt('Причина заморозки (увидит пользователь):', 'Нарушение правил NovaChat');
        if (reason === null) return;
        await NC.api('POST', '/api/admin/reports/' + id + '/resolve', { freeze: true, reason: reason });
      } else if (act === 'delete') {
        if (!window.confirm('Удалить аккаунт безвозвратно?')) return;
        // Жалоба удалится вместе с аккаунтом, поэтому resolve не нужен
        await NC.api('DELETE', '/api/admin/users/' + btn.dataset.target);
      }
      toast('Готово');
      loadReports();
      loadUsers($('userQuery').value);
    } catch (err) {
      toast(err.message);
    }
  });

  // ----- Пользователи -----

  function userHtml(u) {
    const self = u.id === state.meId;
    const tags = [];
    if (u.role === 'admin') tags.push('<span class="tag">админ</span>');
    if (u.frozen) tags.push('<span class="tag warn">заморожен</span>');
    if (u.novaPlus) tags.push('<span class="tag">Nova+</span>');

    const verifyBtn = '<button class="mini-btn" type="button" data-act="verify" data-value="' +
      (u.isVerified ? 'on' : 'off') + '">' + (u.isVerified ? 'Снять галочку' : 'Выдать галочку') + '</button>';
    const novaBtn = '<button class="mini-btn" type="button" data-act="nova" data-value="' +
      (u.novaPlus ? 'on' : 'off') + '">' + (u.novaPlus ? 'Снять Nova+' : 'Выдать Nova+') + '</button>';
    let freezeBtn = '';
    if (!self) {
      freezeBtn = u.frozen
        ? '<button class="mini-btn" type="button" data-act="unfreeze">Разморозить</button>'
        : '<button class="mini-btn warn" type="button" data-act="freeze">Заморозить</button>';
    }
    const deleteBtn = (self || u.role === 'admin')
      ? ''
      : '<button class="mini-btn danger" type="button" data-act="delete">Удалить</button>';
    const reasonLine = u.frozen && u.freezeReason
      ? '<div class="user-row-sub">Причина: ' + esc(u.freezeReason) + '</div>'
      : '';

    return '<li class="user-row" data-id="' + u.id + '">' +
      '<div class="user-row-head">' + esc(u.displayName) + (u.isVerified ? NC.verifiedHtml() : '') + tags.join('') + '</div>' +
      '<div class="user-row-sub">@' + esc(u.username) + '</div>' +
      reasonLine +
      '<div class="row-actions">' + verifyBtn + novaBtn + freezeBtn + deleteBtn + '</div>' +
      '</li>';
  }

  async function loadUsers(q) {
    try {
      const data = await NC.api('GET', '/api/admin/users?q=' + encodeURIComponent(q || ''));
      $('userList').innerHTML = data.users.map(userHtml).join('');
    } catch (err) {
      toast(err.message);
    }
  }

  $('userList').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = Number(btn.closest('.user-row').dataset.id);
    const act = btn.dataset.act;
    try {
      if (act === 'verify') {
        await NC.api('PATCH', '/api/admin/users/' + id, { isVerified: btn.dataset.value === 'off' });
      } else if (act === 'nova') {
        await NC.api('PATCH', '/api/admin/users/' + id, { novaPlus: btn.dataset.value === 'off' });
      } else if (act === 'freeze') {
        const reason = window.prompt('Причина заморозки (увидит пользователь):', 'Нарушение правил NovaChat');
        if (reason === null) return;
        await NC.api('PATCH', '/api/admin/users/' + id, { frozen: true, reason: reason });
      } else if (act === 'unfreeze') {
        await NC.api('PATCH', '/api/admin/users/' + id, { frozen: false });
      } else if (act === 'delete') {
        if (!window.confirm('Удалить аккаунт безвозвратно? Сообщения останутся, но без автора.')) return;
        await NC.api('DELETE', '/api/admin/users/' + id);
      }
      toast('Готово');
      loadUsers($('userQuery').value);
      loadReports();
    } catch (err) {
      toast(err.message);
    }
  });

  // ----- Запуск -----

  async function checkAccess() {
    if (!NC.getToken()) {
      NC.leaveTo('index.html');
      return;
    }
    try {
      const data = await NC.api('GET', '/api/auth/me');
      if (data.user.role !== 'admin') {
        $('adminDenied').hidden = false;
        return;
      }
      state.meId = data.user.id;
    } catch (err) {
      if (err.status !== 401) $('adminDenied').hidden = false;
      return;
    }
    $('adminMain').hidden = false;
    loadAnnouncement();
    loadReports();
    loadUsers('');
  }

  function init() {
    NC.setSegValue($('minutesSeg'), '5');
    NC.setSegValue($('reasonSeg'), 'fix');
    renderPreview();
    renderAnnounceState();
    $('backToChats').addEventListener('click', () => NC.leaveTo('chats.html'));
    $('userQuery').addEventListener('input', NC.debounce(() => loadUsers($('userQuery').value), 300));
    checkAccess();
  }

  init();
})();