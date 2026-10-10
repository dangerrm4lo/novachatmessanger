(function () {
  'use strict';

  const TOKEN_KEY = 'novachat_token';
  const THEME_KEY = 'novachat_theme';
  const LANG_KEY = 'novachat_lang';
  const NOTICE_KEY = 'novachat_notice';
  const listeners = { lang: [], theme: [] };
  let themeTimer = null;
  let notice = null;
  let lastNoticeCheck = 0;
  let adminMode = false;
  let timersStarted = false;

  const STRINGS = {
    ru: {
      login: 'Вход',
      register: 'Регистрация',
      loginSubtitle: 'Войдите, чтобы продолжить',
      registerSubtitle: 'Создайте аккаунт',
      usernamePlaceholder: 'Юзернейм',
      namePlaceholder: 'Имя',
      passwordPlaceholder: 'Пароль',
      loginBtn: 'Войти',
      registerBtn: 'Создать аккаунт',
      wait: 'Подождите…',
      hintInvalid: '5–32 символа: латиница, цифры и _',
      hintChecking: 'Проверяем…',
      hintFree: 'Юзернейм свободен',
      hintTaken: 'Юзернейм занят',
      errUsername: 'Юзернейм: 5–32 символа, латиница, цифры и _',
      errName: 'Введите имя',
      errPasswordShort: 'Пароль должен быть не короче 8 символов',
      errPassword: 'Введите пароль',
      errCredentials: 'Неверный юзернейм или пароль',
      errTaken: 'Этот юзернейм уже занят',
      errNetwork: 'Нет связи с сервером',
      errGeneric: 'Что-то пошло не так',
      errNotFound: 'Пользователь не найден',
      errSystemChat: 'Этот аккаунт не принимает сообщения',
      errSend: 'Не удалось отправить',
      errFrozen: 'Аккаунт заморожен',
      errMaintenance: 'Мессенджер на тех. работах',
      errForbidden: 'Нет доступа',
      nameLength: 'Имя: от 1 до 64 символов',
      bioLength: 'О себе: до 200 символов',
      messageMax: 'Сообщение: не больше 4000 символов',
      saved: 'Сохранено',
      chats: 'Чаты',
      search: 'Поиск',
      settings: 'Настройки',
      newChat: 'Новый чат',
      newChatHint: 'Введите юзернейм, чтобы найти собеседника',
      noResults: 'Никого не нашли',
      noChats: 'Пока нет чатов',
      noChatsHint: 'Найдите собеседника по юзернейму',
      selectChat: 'Выберите чат',
      typeMessage: 'Сообщение',
      readonlyChat: 'В этом чате нельзя отправлять сообщения',
      emptyChat: 'Напишите первое сообщение',
      loading: 'Загрузка…',
      profile: 'Профиль',
      displayName: 'Имя',
      bio: 'О себе',
      save: 'Сохранить',
      verified: 'Подтверждённый аккаунт',
      systemAccount: 'Системный аккаунт',
      noBio: 'Пока ничего не написано',
      appearance: 'Внешний вид',
      themeSystem: 'Системная',
      themeLight: 'Светлая',
      themeDark: 'Тёмная',
      language: 'Язык',
      logout: 'Выйти',
      youPrefix: 'Вы: ',
      noMessages: 'Нет сообщений',
      today: 'Сегодня',
      yesterday: 'Вчера',
      version: 'NovaChat · версия 0.1',
      maintTitle: 'Мессенджер на тех. работах',
      maintText: 'Скоро вернёмся. Следите за новостями в @OfficialNC_Channel',
      reload: 'Обновить',
      maintBody: 'Мессенджер закроется через {when} на {reason}. Следите за новостями в @OfficialNC_Channel',
      reasonFix: 'тех. исправления',
      reasonUpdate: 'обновление',
      minutesN: '{n} мин',
      oneHour: '1 ч',
    },
    en: {
      login: 'Log in',
      register: 'Sign up',
      loginSubtitle: 'Log in to continue',
      registerSubtitle: 'Create an account',
      usernamePlaceholder: 'Username',
      namePlaceholder: 'Name',
      passwordPlaceholder: 'Password',
      loginBtn: 'Log in',
      registerBtn: 'Create account',
      wait: 'Please wait…',
      hintInvalid: '5–32 characters: letters, digits and _',
      hintChecking: 'Checking…',
      hintFree: 'Username is available',
      hintTaken: 'Username is taken',
      errUsername: 'Username: 5–32 characters, letters, digits and _',
      errName: 'Enter your name',
      errPasswordShort: 'Password must be at least 8 characters',
      errPassword: 'Enter your password',
      errCredentials: 'Wrong username or password',
      errTaken: 'This username is already taken',
      errNetwork: 'No connection to the server',
      errGeneric: 'Something went wrong',
      errNotFound: 'User not found',
      errSystemChat: 'This account does not accept messages',
      errSend: 'Failed to send',
      errFrozen: 'Account is frozen',
      errMaintenance: 'Maintenance in progress',
      errForbidden: 'No access',
      nameLength: 'Name: 1 to 64 characters',
      bioLength: 'About: up to 200 characters',
      messageMax: 'Message: up to 4000 characters',
      saved: 'Saved',
      chats: 'Chats',
      search: 'Search',
      settings: 'Settings',
      newChat: 'New chat',
      newChatHint: 'Type a username to find someone',
      noResults: 'Nobody found',
      noChats: 'No chats yet',
      noChatsHint: 'Find someone by username',
      selectChat: 'Select a chat',
      typeMessage: 'Message',
      readonlyChat: 'You cannot send messages in this chat',
      emptyChat: 'Send the first message',
      loading: 'Loading…',
      profile: 'Profile',
      displayName: 'Name',
      bio: 'About',
      save: 'Save',
      verified: 'Verified account',
      systemAccount: 'System account',
      noBio: 'Nothing here yet',
      appearance: 'Appearance',
      themeSystem: 'System',
      themeLight: 'Light',
      themeDark: 'Dark',
      language: 'Language',
      logout: 'Log out',
      youPrefix: 'You: ',
      noMessages: 'No messages',
      today: 'Today',
      yesterday: 'Yesterday',
      version: 'NovaChat · version 0.1',
      maintTitle: 'Maintenance in progress',
      maintText: 'We will be back soon. Follow news at @OfficialNC_Channel',
      reload: 'Reload',
      maintBody: 'The messenger will close in {when} for {reason}. Follow news at @OfficialNC_Channel',
      reasonFix: 'maintenance fixes',
      reasonUpdate: 'an update',
      minutesN: '{n} min',
      oneHour: '1 h',
    },
  };

  const ICONS = {
    logo: '<path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 21l1.9-5.6A8.5 8.5 0 1 1 21 11.5z"/>',
    chevron: '<polyline points="15 18 9 12 15 6"/>',
    search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    compose: '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    checks: '<polyline points="18 6 7 17 2 12"/><polyline points="22 6 11 17 10 16"/>',
    send: '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    sun: '<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    paperclip: '<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    forward: '<polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  };

  const AVATAR_COLORS = ['#ff453a', '#ff9f0a', '#30d158', '#64d2ff', '#0a84ff', '#bf5af2', '#ff375f'];

  class ApiError extends Error {
    constructor(message, status, code, extra) {
      super(message);
      this.status = status;
      this.code = code || '';
      this.extra = extra || {};
    }
  }

  function getLang() {
    return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'ru';
  }

  function t(key) {
    const dict = STRINGS[getLang()];
    if (dict[key] !== undefined) return dict[key];
    return STRINGS.ru[key] !== undefined ? STRINGS.ru[key] : key;
  }

  function fill(key, vars) {
    let s = t(key);
    Object.keys(vars || {}).forEach((k) => {
      s = s.split('{' + k + '}').join(String(vars[k]));
    });
    return s;
  }

  function fmtMinutes(n) {
    return n === 60 ? t('oneHour') : fill('minutesN', { n: n });
  }

  function formatCountdown(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function locale() {
    return getLang() === 'en' ? 'en-US' : 'ru-RU';
  }

  function icon(name, size) {
    const s = size || 22;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (ICONS[name] || '') + '</svg>';
  }

  function themeIconName(pref) {
    if (pref === 'light') return 'sun';
    if (pref === 'dark') return 'moon';
    return 'monitor';
  }

  function applyI18n(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n]').forEach((n) => {
      n.textContent = t(n.dataset.i18n);
    });
    scope.querySelectorAll('[data-i18n-placeholder]').forEach((n) => {
      n.placeholder = t(n.dataset.i18nPlaceholder);
    });
    scope.querySelectorAll('[data-icon]').forEach((n) => {
      n.innerHTML = icon(n.dataset.icon, Number(n.dataset.iconSize) || 22);
    });
  }

  function setLang(lang) {
    localStorage.setItem(LANG_KEY, lang === 'en' ? 'en' : 'ru');
    document.documentElement.lang = getLang();
    applyI18n();
    listeners.lang.forEach((fn) => fn(getLang()));
  }

  function getThemePref() {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  }

  function resolveTheme(pref) {
    if (pref === 'light' || pref === 'dark') return pref;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(animate) {
    const root = document.documentElement;
    const next = resolveTheme(getThemePref());
    if (root.dataset.theme === next) return;
    if (animate) {
      root.classList.add('theme-anim');
      clearTimeout(themeTimer);
      themeTimer = setTimeout(() => root.classList.remove('theme-anim'), 450);
    }
    root.dataset.theme = next;
  }

  function setTheme(pref) {
    localStorage.setItem(THEME_KEY, pref);
    applyTheme(true);
    listeners.theme.forEach((fn) => fn(pref));
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  function leaveTo(url) {
    document.body.classList.add('leaving');
    setTimeout(() => location.replace(url), 260);
  }

  function ensureDom() {
    if (document.getElementById('nc-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'nc-banner';
    banner.className = 'notice-banner';
    banner.hidden = true;
    document.body.appendChild(banner);

    const overlay = document.createElement('div');
    overlay.id = 'nc-overlay';
    overlay.className = 'maint-overlay';
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="maint-card">' +
      '<div class="maint-icon">' + icon('logo', 28) + '</div>' +
      '<h2 class="maint-title" data-i18n="maintTitle"></h2>' +
      '<p class="maint-text" data-i18n="maintText"></p>' +
      '<button id="nc-maint-reload" class="btn btn-primary" type="button" data-i18n="reload"></button>' +
      '</div>';
    document.body.appendChild(overlay);
    document.getElementById('nc-maint-reload').addEventListener('click', () => location.reload());
  }

  function showMaintenance() {
    ensureDom();
    document.getElementById('nc-overlay').hidden = false;
  }

  async function api(method, path, body, options) {
    const opts = options || {};
    const token = getToken();
    const headers = {};
    if (token) headers.Authorization = 'Bearer ' + token;
    let payload;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    let res;
    try {
      res = await fetch(path, { method: method, headers: headers, body: payload });
    } catch (netErr) {
      throw new ApiError(t('errNetwork'), 0, 'network');
    }

    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;

    if (data.code === 'maintenance' && !adminMode) {
      showMaintenance();
    }
    if (data.code === 'frozen' && token && !opts.keepSession) {
      sessionStorage.setItem(NOTICE_KEY, JSON.stringify({ code: 'frozen', reason: data.reason || '' }));
      clearToken();
      location.replace('index.html');
    } else if (res.status === 401 && token && !opts.keepSession) {
      clearToken();
      location.replace('index.html');
    }

    const message = data.code === 'maintenance' ? t('errMaintenance')
      : data.code === 'frozen' ? t('errFrozen')
        : (data.error || t('errGeneric'));
    throw new ApiError(message, res.status, data.code, { reason: data.reason, until: data.until });
  }

  // Причина заморозки после перенаправления на страницу входа
  function takeNotice() {
    const raw = sessionStorage.getItem(NOTICE_KEY);
    if (!raw) return '';
    sessionStorage.removeItem(NOTICE_KEY);
    try {
      const data = JSON.parse(raw);
      if (data.code === 'frozen') {
        return t('errFrozen') + (data.reason ? ': ' + data.reason : '');
      }
    } catch (parseErr) {
      // Испорченная запись просто игнорируется
    }
    return '';
  }

  function announcementPreview(a, when) {
    if (a.kind === 'info') return a.text || '';
    const reason = a.reason === 'update' ? t('reasonUpdate') : t('reasonFix');
    return fill('maintBody', { when: when || fmtMinutes(a.minutes), reason: reason });
  }

  function noticeText() {
    if (!notice) return '';
    if (notice.kind === 'info') return notice.text || '';
    const left = new Date(notice.closesAt).getTime() - Date.now();
    return announcementPreview(notice, left > 0 ? formatCountdown(left) : '00:00');
  }

  function renderBanner() {
    ensureDom();
    const banner = document.getElementById('nc-banner');
    if (!notice) {
      banner.hidden = true;
      return;
    }
    banner.hidden = false;
    banner.innerHTML = '<span class="notice-icon">' + icon('logo', 18) + '</span><span class="notice-text"></span>';
    banner.querySelector('.notice-text').textContent = noticeText();
  }

  async function loadNotices() {
    lastNoticeCheck = Date.now();
    try {
      const data = await api('GET', '/api/announcements/active', undefined, { keepSession: true });
      notice = data.announcement || null;
      renderBanner();
      if (data.maintenance && !adminMode) {
        showMaintenance();
      }
    } catch (err) {
      // Без связи баннер остаётся прежним
    }
  }

  function setAdminMode(flag) {
    adminMode = Boolean(flag);
  }

  function startTimers() {
    if (timersStarted) return;
    timersStarted = true;
    setInterval(() => {
      if (!notice) return;
      renderBanner();
      if (notice.kind === 'maintenance' && !adminMode) {
        const left = new Date(notice.closesAt).getTime() - Date.now();
        if (left <= 0 && Date.now() - lastNoticeCheck > 3000) loadNotices();
      }
    }, 1000);
    setInterval(loadNotices, 20000);
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    const first = parts[0][0] || '';
    const second = parts.length > 1 ? parts[1][0] : (parts[0][1] || '');
    return (first + second).toUpperCase();
  }

  function avatarColor(seed) {
    let h = 0;
    for (const ch of String(seed)) {
      h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    }
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }

  function avatarHtml(user, size) {
    const cls = 'avatar ' + (size || 'avatar-md');
    if (user.avatarUrl) {
      return '<span class="' + cls + ' avatar-photo"><img src="' + esc(user.avatarUrl) +
        '" alt="" draggable="false"></span>';
    }
    if (user.isSystem) {
      return '<span class="' + cls + ' avatar-system">' + icon('logo', 24) + '</span>';
    }
    return '<span class="' + cls + '" style="background:' + avatarColor(user.username) + '">' +
      esc(initials(user.displayName)) + '</span>';
  }

  function verifiedHtml() {
    return '<span class="verified" aria-label="' + esc(t('verified')) + '">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="11" fill="currentColor"/>' +
      '<path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#ffffff" stroke-width="2.4" ' +
      'stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg></span>';
  }

  function dayKey(iso) {
    return new Date(iso).toDateString();
  }

  function formatTime(iso) {
    return new Date(iso).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  }

  function formatDay(iso) {
    const d = new Date(iso);
    const now = new Date();
    if (dayKey(iso) === now.toDateString()) return t('today');
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (dayKey(iso) === yesterday.toDateString()) return t('yesterday');
    const options = { day: 'numeric', month: 'long' };
    if (d.getFullYear() !== now.getFullYear()) options.year = 'numeric';
    return d.toLocaleDateString(locale(), options);
  }

  function formatListDate(iso) {
    const d = new Date(iso);
    const now = new Date();
    if (dayKey(iso) === now.toDateString()) return formatTime(iso);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (dayKey(iso) === yesterday.toDateString()) return t('yesterday');
    return d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
  }

  function debounce(fn, ms) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  function setSegValue(container, value) {
    const buttons = Array.from(container.querySelectorAll('.seg'));
    const index = buttons.findIndex((b) => b.dataset.value === value);
    container.style.setProperty('--count', buttons.length);
    container.style.setProperty('--index', Math.max(index, 0));
    buttons.forEach((b) => {
      const on = b.dataset.value === value;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }

  function on(name, fn) {
    listeners[name].push(fn);
  }

  function init() {
    document.documentElement.lang = getLang();
    applyTheme(false);
    ensureDom();
    applyI18n();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = () => {
      if (getThemePref() === 'system') applyTheme(true);
    };
    if (mq.addEventListener) mq.addEventListener('change', onSystemChange);
    else mq.addListener(onSystemChange);
    loadNotices();
    startTimers();
  }

  window.NC = {
    t, fill, fmtMinutes, formatCountdown,
    getLang, setLang, getThemePref, setTheme, applyI18n,
    icon, themeIconName,
    api, ApiError, getToken, setToken, clearToken, leaveTo,
    takeNotice, showMaintenance, loadNotices, announcementPreview, setAdminMode,
    esc, initials, avatarHtml, verifiedHtml,
    formatTime, formatDay, formatListDate, dayKey,
    debounce, setSegValue, on,
  };

  init();
})();