(function () {
  'use strict';

  const NC = window.NC;
  const USERNAME_RE = /^[a-z0-9_]{5,32}$/;
  const $ = (id) => document.getElementById(id);

  const form = $('form');
  const usernameInput = $('username');
  const displayNameInput = $('displayName');
  const passwordInput = $('password');
  const hint = $('hint');
  const errorBox = $('error');
  const submitBtn = $('submit');
  const subtitle = $('subtitle');
  const nameReveal = $('nameReveal');
  const authSeg = $('authSeg');
  const langLabel = $('langLabel');
  const themeBtn = $('themeBtn');

  let mode = 'login';
  let busy = false;
  let checkSeq = 0;

  function setHint(text, state) {
    hint.textContent = text;
    hint.className = 'hint' + (state ? ' ' + state : '');
  }

  function showError(text) {
    errorBox.textContent = text;
    errorBox.classList.toggle('visible', Boolean(text));
  }

  function errorText(err) {
    if (err.status === 0) return NC.t('errNetwork');
    if (err.code === 'frozen') {
      return NC.t('errFrozen') + (err.extra && err.extra.reason ? ': ' + err.extra.reason : '');
    }
    if (err.code === 'maintenance') return NC.t('errMaintenance');
    if (err.status === 401) return NC.t('errCredentials');
    if (err.status === 409) return NC.t('errTaken');
    return err.message;
  }

  function setBusy(flag) {
    busy = flag;
    submitBtn.disabled = flag;
    submitBtn.classList.toggle('loading', flag);
    submitBtn.textContent = flag ? NC.t('wait') : NC.t(mode === 'register' ? 'registerBtn' : 'loginBtn');
  }

  function checkUsername() {
    const value = usernameInput.value.trim().toLowerCase();
    const seq = ++checkSeq;
    if (mode !== 'register' || !value) {
      setHint('');
      return;
    }
    if (!USERNAME_RE.test(value)) {
      setHint(NC.t('hintInvalid'), 'bad');
      return;
    }
    setHint(NC.t('hintChecking'));
    NC.api('GET', '/api/auth/check-username?username=' + encodeURIComponent(value), undefined, { keepSession: true })
      .then((data) => {
        if (seq !== checkSeq) return;
        setHint(data.available ? NC.t('hintFree') : NC.t('hintTaken'), data.available ? 'ok' : 'bad');
      })
      .catch(() => {
        if (seq === checkSeq) setHint(NC.t('errNetwork'), 'bad');
      });
  }

  const debouncedCheck = NC.debounce(checkUsername, 350);

  function setMode(next) {
    mode = next;
    const isRegister = next === 'register';
    NC.setSegValue(authSeg, next);
    nameReveal.classList.toggle('open', isRegister);
    nameReveal.inert = !isRegister;
    passwordInput.autocomplete = isRegister ? 'new-password' : 'current-password';
    subtitle.textContent = NC.t(isRegister ? 'registerSubtitle' : 'loginSubtitle');
    if (!busy) submitBtn.textContent = NC.t(isRegister ? 'registerBtn' : 'loginBtn');
    showError('');
    setHint('');
    if (isRegister) checkUsername();
  }

  function renderLangLabel() {
    langLabel.textContent = NC.getLang() === 'ru' ? 'RU' : 'EN';
  }

  function renderThemeIcon() {
    themeBtn.innerHTML = NC.icon(NC.themeIconName(NC.getThemePref()), 20);
  }

  async function autoLogin() {
    if (!NC.getToken()) return;
    try {
      await NC.api('GET', '/api/auth/me', undefined, { keepSession: true });
      NC.leaveTo('chats.html');
    } catch (err) {
      if (err.status === 401) NC.clearToken();
    }
  }

  authSeg.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg');
    if (!btn || btn.dataset.value === mode) return;
    setMode(btn.dataset.value);
  });

  usernameInput.addEventListener('input', () => {
    showError('');
    debouncedCheck();
  });

  $('langBtn').addEventListener('click', () => {
    NC.setLang(NC.getLang() === 'ru' ? 'en' : 'ru');
  });

  themeBtn.addEventListener('click', () => {
    const order = ['system', 'light', 'dark'];
    const next = order[(order.indexOf(NC.getThemePref()) + 1) % order.length];
    NC.setTheme(next);
  });

  NC.on('lang', () => {
    renderLangLabel();
    setMode(mode);
  });
  NC.on('theme', renderThemeIcon);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    showError('');

    const isRegister = mode === 'register';
    const username = usernameInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    const displayName = displayNameInput.value.trim();

    if (!USERNAME_RE.test(username)) return showError(NC.t('errUsername'));
    if (isRegister && !displayName) return showError(NC.t('errName'));
    if (isRegister && password.length < 8) return showError(NC.t('errPasswordShort'));
    if (!isRegister && !password) return showError(NC.t('errPassword'));

    setBusy(true);
    try {
      const data = isRegister
        ? await NC.api('POST', '/api/auth/register', { username: username, displayName: displayName, password: password }, { keepSession: true })
        : await NC.api('POST', '/api/auth/login', { username: username, password: password }, { keepSession: true });
      NC.setToken(data.token);
      if (isRegister) {
        // Тема и язык, выбранные до регистрации, сохраняются в профиль до первого приветствия
        await NC.api('PATCH', '/api/users/me', { theme: NC.getThemePref(), language: NC.getLang() }).catch(() => { });
      }
      NC.leaveTo('chats.html');
    } catch (err) {
      showError(errorText(err));
      setBusy(false);
    }
  });

  renderLangLabel();
  renderThemeIcon();
  setMode('login');
  const notice = NC.takeNotice();
  if (notice) showError(notice);
  autoLogin();
})();