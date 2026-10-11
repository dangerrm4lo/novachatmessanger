(function () {
  'use strict';

  const NC = window.NC;
  const $ = (id) => document.getElementById(id);
  const REACTIONS = [
    '\u{1F44D}', '\u{1F525}', '\u{1F496}', '\u{1F602}', '\u{1F62E}', '\u{1F622}', '\u{1F389}',
    '\u{1F970}', '\u{1F44F}', '\u{1F914}', '\u{1F92F}', '\u{1F631}', '\u{1F92C}', '\u{1F64F}',
    '\u{1F44C}', '\u{1F601}', '\u{1F929}', '\u{1F97A}', '\u{1F62D}', '\u{1F4A9}', '\u{1F921}',
    '\u{1F634}', '\u{1F44E}', '\u{1F971}', '\u{1F92E}', '\u{1F608}', '\u{1FAE1}', '\u{1F353}',
    '\u{1F37E}', '\u{1F48B}', '\u{1F3C6}', '\u{1F494}', '\u{1F928}', '\u{1F610}', '\u{1F440}',
    '\u{1F383}', '\u{1F47B}', '\u{1F913}', '\u{1F4AF}', '\u{1F91D}',
  ];
  const QUICK_COUNT = 7;
  const MAX_FILE = 10 * 1024 * 1024;
  const MAX_PHOTO = 2 * 1024 * 1024;
  const IMAGE_RE = /^image\/(png|jpeg|gif|webp)$/;
  const VIDEO_RE = /^video\/(mp4|webm|quicktime)$/;
  const USERNAME_RE = /^[a-z0-9_]{5,32}$/;
  const NOTICE_KEY = 'novachat_notice';
  const PAGE = 50;
  const AROUND = 60;

  // Куда ведёт стрелка «назад» в профиле, в зависимости от того, откуда открыли профиль
  const BACK_TARGETS = { settings: 'settings', groupInfo: 'groupInfo', newChat: 'newChat' };

  const XICONS = {
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    pie: '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
    ban: '<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    reply: '<polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>',
    pin: '<path d="M12 17v5"/><path d="M9 3h6l-1 6 3 3H7l3-3z"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    leave: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 5 12 8c0-3 2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  };

  function xIcon(name, size) {
    const s = size || 22;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (XICONS[name] || '') + '</svg>';
  }

  const XT = {
    ru: {
      forward: 'Переслать',
      forwardTitle: 'Переслать в…',
      copy: 'Копировать',
      deleteMe: 'Удалить у меня',
      deleteAll: 'Удалить у всех',
      confirmAll: 'Удалить сообщение у всех участников чата?',
      deleted: 'Сообщение удалено',
      forwardedFrom: 'Переслано от',
      forwarded: 'Переслано',
      noForwardChats: 'Нет чатов для пересылки',
      file: 'Файл',
      uploading: 'Загрузка…',
      uploadFailed: 'Не удалось загрузить файл',
      tooBig: 'Файл больше 10 МБ',
      notFound: 'Файл не найден',
      copied: 'Скопировано',
      changePhoto: 'Сменить фото',
      photoTooBig: 'Фото больше 2 МБ',
      photoWrong: 'Выберите картинку: PNG, JPEG, GIF или WebP',
      photoSaved: 'Фото обновлено',
      report: 'Пожаловаться',
      reportPlaceholder: 'Что нарушил этот пользователь?',
      reportSend: 'Отправить жалобу',
      reportSent: 'Жалоба отправлена, спасибо',
      reportDup: 'Жалоба уже отправлена',
      reportEmpty: 'Опишите причину',
      loadAll: 'Загрузить всю историю',
      readonlyGroup: 'В этой группе писать могут только администраторы',
      groupTag: 'Группа',
      groupNeedTitle: 'Введите название группы',
      groupBadUsername: 'Юзернейм группы: 5–32 символа, латиница, цифры и _',
      joined: 'Вы вступили в группу',
      left: 'Вы покинули группу',
      added: 'Участник добавлен',
      done: 'Готово',
      remove: 'Исключить',
      makeAdmin: 'Сделать админом',
      unAdmin: 'Убрать из админов',
      roleOwner: 'Владелец',
      roleAdmin: 'Админ',
      you: 'Вы',
      confirmRemove: 'Исключить участника из группы?',
      confirmLeave: 'Покинуть группу?',
      confirmDeleteGroup: 'Удалить группу для всех участников?',
      searchInChat: 'Поиск в чате',
      searchHint: 'Введите хотя бы две буквы',
      searchNone: 'Ничего не найдено',
      newGroup: 'Новая группа',
      groupTitle: 'Название',
      groupUsername: 'Юзернейм группы',
      groupDesc: 'Описание',
      create: 'Создать',
      groupInfo: 'Группа',
      join: 'Вступить',
      addMember: 'Добавить участника',
      add: 'Добавить',
      members: 'Участники',
      leave: 'Покинуть группу',
      deleteGroup: 'Удалить группу',
      reply: 'Ответить',
      pin: 'Закрепить',
      unpin: 'Открепить',
      pinned: 'Закреплённое сообщение',
      deleteChat: 'Удалить чат',
      block: 'Заблокировать',
      unblock: 'Разблокировать',
      leaveGroup: 'Покинуть группу',
      confirmHideChat: 'Удалить чат из списка? Он вернётся, если собеседник напишет снова.',
      confirmBlock: 'Заблокировать пользователя? Вы не сможете писать друг другу.',
      chatHidden: 'Чат удалён из списка',
      blockedDone: 'Пользователь заблокирован',
      unblockedDone: 'Пользователь разблокирован',
      blockedByMe: 'Вы заблокировали этого пользователя',
      blockedByPeer: 'Этот пользователь ограничил сообщения',
      account: 'Аккаунт',
      notifications: 'Уведомления',
      privacy: 'Конфиденциальность',
      dataMemory: 'Данные и память',
      nova: 'Nova+',
      novaSoon: 'Скоро',
      novaText: 'Nova+ — подписка с дополнительными возможностями. Пока это заглушка: оформить её нельзя.',
      comingSoon: 'Этот раздел появится в следующем обновлении.',
      statusOnline: 'в сети',
      statusRecent: 'был(а) недавно',
      statusLong: 'был(а) давно',
      statusAt: 'был(а) в {v}',
      statusDate: 'был(а) {v}',
      showLastSeen: 'Время захода',
      lastSeenHint: 'Если выключить, собеседники увидят «был(а) недавно» вместо точного времени.',
      tabGifts: 'Подарки',
      tabPosts: 'Публикации',
      write: 'Написать',
      addCollection: 'Добавить коллекцию',
      postsArchive: 'Архив публикаций',
      giftsEmpty: 'Подарков пока нет',
      postsEmpty: 'Публикаций пока нет',
      newCollection: 'Новая коллекция',
      collectionName: 'Название',
      collectionHint: 'Пока коллекция пустая. Подарки появятся в следующем обновлении.',
      collectionNeedTitle: 'Введите название коллекции',
      collectionCreated: 'Коллекция создана',
      collectionEmpty: 'Пусто',
      archive: 'Архив публикаций',
      archiveText: 'Здесь будут публикации, которые вы скроете. Пока публикаций нет.',
    },
    en: {
      forward: 'Forward',
      forwardTitle: 'Forward to…',
      copy: 'Copy',
      deleteMe: 'Delete for me',
      deleteAll: 'Delete for everyone',
      confirmAll: 'Delete this message for everyone in the chat?',
      deleted: 'Message deleted',
      forwardedFrom: 'Forwarded from',
      forwarded: 'Forwarded',
      noForwardChats: 'No chats to forward to',
      file: 'File',
      uploading: 'Uploading…',
      uploadFailed: 'Upload failed',
      tooBig: 'File is larger than 10 MB',
      notFound: 'File not found',
      copied: 'Copied',
      changePhoto: 'Change photo',
      photoTooBig: 'Photo is larger than 2 MB',
      photoWrong: 'Choose an image: PNG, JPEG, GIF or WebP',
      photoSaved: 'Photo updated',
      report: 'Report',
      reportPlaceholder: 'What did this user do wrong?',
      reportSend: 'Send report',
      reportSent: 'Report sent, thank you',
      reportDup: 'You have already reported this user',
      reportEmpty: 'Describe the reason',
      loadAll: 'Load full history',
      readonlyGroup: 'Only admins can post in this group',
      groupTag: 'Group',
      groupNeedTitle: 'Enter a group name',
      groupBadUsername: 'Group username: 5–32 characters, letters, digits and _',
      joined: 'You joined the group',
      left: 'You left the group',
      added: 'Member added',
      done: 'Done',
      remove: 'Remove',
      makeAdmin: 'Make admin',
      unAdmin: 'Remove admin',
      roleOwner: 'Owner',
      roleAdmin: 'Admin',
      you: 'You',
      confirmRemove: 'Remove this member from the group?',
      confirmLeave: 'Leave the group?',
      confirmDeleteGroup: 'Delete the group for all members?',
      searchInChat: 'Search in chat',
      searchHint: 'Type at least two characters',
      searchNone: 'Nothing found',
      newGroup: 'New group',
      groupTitle: 'Title',
      groupUsername: 'Group username',
      groupDesc: 'Description',
      create: 'Create',
      groupInfo: 'Group',
      join: 'Join',
      addMember: 'Add member',
      add: 'Add',
      members: 'Members',
      leave: 'Leave group',
      deleteGroup: 'Delete group',
      reply: 'Reply',
      pin: 'Pin',
      unpin: 'Unpin',
      pinned: 'Pinned message',
      deleteChat: 'Delete chat',
      block: 'Block',
      unblock: 'Unblock',
      leaveGroup: 'Leave group',
      confirmHideChat: 'Delete the chat from the list? It will come back if the other person writes again.',
      confirmBlock: 'Block this user? You will not be able to message each other.',
      chatHidden: 'Chat removed from the list',
      blockedDone: 'User blocked',
      unblockedDone: 'User unblocked',
      blockedByMe: 'You blocked this user',
      blockedByPeer: 'This user restricted messages',
      account: 'Account',
      notifications: 'Notifications',
      privacy: 'Privacy',
      dataMemory: 'Data and storage',
      nova: 'Nova+',
      novaSoon: 'Soon',
      novaText: 'Nova+ is a subscription with extra features. For now it is a placeholder: you cannot subscribe yet.',
      comingSoon: 'This section will appear in a future update.',
      statusOnline: 'online',
      statusRecent: 'last seen recently',
      statusLong: 'last seen a long time ago',
      statusAt: 'last seen at {v}',
      statusDate: 'last seen {v}',
      showLastSeen: 'Last seen',
      lastSeenHint: 'If turned off, others will see "last seen recently" instead of the exact time.',
      tabGifts: 'Gifts',
      tabPosts: 'Posts',
      write: 'Message',
      addCollection: 'Add collection',
      postsArchive: 'Posts archive',
      giftsEmpty: 'No gifts yet',
      postsEmpty: 'No posts yet',
      newCollection: 'New collection',
      collectionName: 'Name',
      collectionHint: 'The collection is empty for now. Gifts will appear in a future update.',
      collectionNeedTitle: 'Enter a collection name',
      collectionCreated: 'Collection created',
      collectionEmpty: 'Empty',
      archive: 'Posts archive',
      archiveText: 'Here will be the posts you hide. There are no posts yet.',
    },
  };

  function X(key) {
    const dict = XT[NC.getLang()] || XT.ru;
    return dict[key] !== undefined ? dict[key] : key;
  }

  function fillX(key, value) {
    return X(key).split('{v}').join(String(value));
  }

  // Строка статуса собеседника: в сети, был(а) в 10:59, был(а) недавно или давно
  function statusLine(status) {
    if (!status) return '';
    if (status.mode === 'online') return X('statusOnline');
    if (status.mode === 'recent') return X('statusRecent');
    if (status.mode === 'long') return X('statusLong');
    if (NC.dayKey(status.at) === new Date().toDateString()) {
      return fillX('statusAt', NC.formatTime(status.at));
    }
    return fillX('statusDate', NC.formatListDate(status.at));
  }

  const els = {
    app: $('app'),
    listView: $('listView'),
    chatList: $('chatList'),
    listEmpty: $('listEmpty'),
    listStatus: $('listStatus'),
    listSearch: $('listSearch'),
    settingsBtn: $('settingsBtn'),
    newChatBtn: $('newChatBtn'),
    backBtn: $('backBtn'),
    peerBtn: $('peerBtn'),
    chatSearchBtn: $('chatSearchBtn'),
    pinnedBar: $('pinnedBar'),
    pinnedOpen: $('pinnedOpen'),
    pinnedText: $('pinnedText'),
    pinnedUnpin: $('pinnedUnpin'),
    messages: $('messages'),
    toBottom: $('toBottom'),
    replyBar: $('replyBar'),
    replyName: $('replyName'),
    replyText: $('replyText'),
    replyClose: $('replyClose'),
    composer: $('composer'),
    messageInput: $('messageInput'),
    attachBtn: $('attachBtn'),
    fileInput: $('fileInput'),
    readonlyNote: $('readonlyNote'),
    ctxMenu: $('ctxMenu'),
    ctxReactions: $('ctxReactions'),
    ctxMore: $('ctxMore'),
    ctxReply: $('ctxReply'),
    ctxCopy: $('ctxCopy'),
    ctxForward: $('ctxForward'),
    ctxPin: $('ctxPin'),
    ctxPinLabel: $('ctxPinLabel'),
    ctxDeleteMe: $('ctxDeleteMe'),
    ctxDeleteAll: $('ctxDeleteAll'),
    chatCtxMenu: $('chatCtxMenu'),
    chatCtxHide: $('chatCtxHide'),
    chatCtxBlock: $('chatCtxBlock'),
    chatCtxBlockLabel: $('chatCtxBlockLabel'),
    chatCtxLeave: $('chatCtxLeave'),
    backdrop: $('backdrop'),
    toast: $('toast'),
    settingsSheet: $('settingsSheet'),
    appearanceSheet: $('appearanceSheet'),
    languageSheet: $('languageSheet'),
    novaSheet: $('novaSheet'),
    stubSheet: $('stubSheet'),
    stubTitle: $('stubTitle'),
    stubText: $('stubText'),
    privacySheet: $('privacySheet'),
    lastSeenToggle: $('lastSeenToggle'),
    profileSheet: $('profileSheet'),
    collectionSheet: $('collectionSheet'),
    archiveSheet: $('archiveSheet'),
    newChatSheet: $('newChatSheet'),
    forwardSheet: $('forwardSheet'),
    groupSheet: $('groupSheet'),
    groupInfoSheet: $('groupInfoSheet'),
    searchSheet: $('searchSheet'),
    profileCard: $('profileCard'),
    themeSeg: $('themeSeg'),
    langSeg: $('langSeg'),
    logoutBtn: $('logoutBtn'),
    profileBack: $('profileBack'),
    profileAvatar: $('profileAvatar'),
    avatarEdit: $('avatarEdit'),
    avatarInput: $('avatarInput'),
    profileName: $('profileName'),
    profileUsername: $('profileUsername'),
    profileBadge: $('profileBadge'),
    profileActions: $('profileActions'),
    profileWrite: $('profileWrite'),
    profileBio: $('profileBio'),
    profileForm: $('profileForm'),
    editName: $('editName'),
    editBio: $('editBio'),
    tabGifts: $('tabGifts'),
    tabPosts: $('tabPosts'),
    tabAction: $('tabAction'),
    panelGifts: $('panelGifts'),
    panelPosts: $('panelPosts'),
    collectionList: $('collectionList'),
    giftsEmpty: $('giftsEmpty'),
    collectionTitle: $('collectionTitle'),
    collectionCreate: $('collectionCreate'),
    createGroupBtn: $('createGroupBtn'),
    userSearch: $('userSearch'),
    userResults: $('userResults'),
    userHint: $('userHint'),
    forwardList: $('forwardList'),
    forwardHint: $('forwardHint'),
    groupTitle: $('groupTitle'),
    groupUsername: $('groupUsername'),
    groupUsernameHint: $('groupUsernameHint'),
    groupDesc: $('groupDesc'),
    groupCreate: $('groupCreate'),
    groupInfoAvatar: $('groupInfoAvatar'),
    groupInfoTitle: $('groupInfoTitle'),
    groupInfoSub: $('groupInfoSub'),
    groupInfoDesc: $('groupInfoDesc'),
    groupJoinBtn: $('groupJoinBtn'),
    groupAddWrap: $('groupAddWrap'),
    groupAddInput: $('groupAddInput'),
    groupAddBtn: $('groupAddBtn'),
    groupMembers: $('groupMembers'),
    groupLeaveBtn: $('groupLeaveBtn'),
    groupDeleteBtn: $('groupDeleteBtn'),
    chatSearchInput: $('chatSearchInput'),
    chatSearchResults: $('chatSearchResults'),
    chatSearchHint: $('chatSearchHint'),
  };

  const SHEETS = {
    settings: els.settingsSheet,
    appearance: els.appearanceSheet,
    language: els.languageSheet,
    nova: els.novaSheet,
    stub: els.stubSheet,
    privacy: els.privacySheet,
    profile: els.profileSheet,
    collection: els.collectionSheet,
    archive: els.archiveSheet,
    newChat: els.newChatSheet,
    forward: els.forwardSheet,
    group: els.groupSheet,
    groupInfo: els.groupInfoSheet,
    search: els.searchSheet,
  };

  const fineInput = window.matchMedia('(pointer: fine)').matches;

  const state = {
    me: null,
    loaded: false,
    chats: [],
    syncCount: 0,
    currentChatId: null,
    currentGroup: false,
    currentRole: null,
    meta: null,
    replyTo: null,
    messages: [],
    oldestId: null,
    hasMore: false,
    hasNewer: false,
    loadingOlder: false,
    loadingNewer: false,
    loadingAll: false,
    sending: false,
    knownChats: new Set(),
    openSheet: null,
    profileUser: null,
    profileEditable: false,
    profileOrigin: null,
    profileTab: 'gifts',
    groupCardId: null,
    groupFull: null,
    groupResults: new Map(),
    userResultMap: new Map(),
    socket: null,
    refreshTimer: null,
    toastTimer: null,
    ctxMessage: null,
    ctxChatId: null,
    forwardMessageId: null,
    fileCache: new Map(),
    usernameSeq: 0,
  };

  let pressTimer = null;
  let chatPressTimer = null;
  let suppressChatClick = false;

  const searchUsers = NC.debounce(() => runUserSearch(), 300);
  const runChatSearch = NC.debounce(() => doChatSearch(), 300);
  const checkGroupUsername = NC.debounce(() => checkGroupUsernameNow(), 350);

  // ----- Общие помощники -----

  function errorText(err) {
    if (!(err instanceof NC.ApiError)) return NC.t('errNetwork');
    if (err.status === 0) return NC.t('errNetwork');
    if (err.status === 404) return NC.t('errNotFound');
    return err.message || NC.t('errGeneric');
  }

  function toast(text) {
    els.toast.textContent = text;
    els.toast.classList.add('show');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2200);
  }

  function showListStatus(text) {
    els.listStatus.textContent = text;
    els.listStatus.hidden = false;
  }

  function scrollToBottom(smooth) {
    const box = els.messages;
    box.scrollTo({ top: box.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }

  function autoGrow() {
    const input = els.messageInput;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 140) + 'px';
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function spinnerHtml() {
    let html = '<span class="spinner" aria-hidden="true">';
    for (let k = 0; k < 12; k++) {
      html += '<i style="transform:rotate(' + (k * 30) + 'deg);animation-delay:' + (-k / 12).toFixed(3) + 's"></i>';
    }
    return html + '</span>';
  }

  function setSyncing(flag) {
    state.syncCount = Math.max(0, state.syncCount + (flag ? 1 : -1));
    els.listView.classList.toggle('syncing', state.syncCount > 0);
  }

  function membersText(n) {
    if (NC.getLang() === 'en') return n + (n === 1 ? ' member' : ' members');
    const mod10 = n % 10;
    const mod100 = n % 100;
    let word = 'участников';
    if (mod10 === 1 && mod100 !== 11) word = 'участник';
    else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) word = 'участника';
    return n + ' ' + word;
  }

  // Текст с кликабельными упоминаниями @username (сначала экранирование, потом разметка)
  function richText(text) {
    return NC.esc(text).replace(/@([A-Za-z0-9_]{5,32})/g, function (m, name) {
      return '<a class="mention" href="#" data-mention="' + name.toLowerCase() + '">@' + name + '</a>';
    });
  }

  function currentChat() {
    return state.chats.find((c) => c.id === state.currentChatId) || null;
  }

  function newestId() {
    return state.messages.length ? state.messages[state.messages.length - 1].id : null;
  }

  function canDeleteAll(msg) {
    if (msg.senderId === state.me.id) return true;
    return state.currentGroup && (state.currentRole === 'owner' || state.currentRole === 'admin');
  }

  function canPinHere() {
    return Boolean(state.meta && state.meta.canPin);
  }

  function previewOf(m) {
    if (!m) return '';
    if (m.deleted) return X('deleted');
    if (m.file && !m.text) return X('file');
    return m.text || '';
  }

  function openSheet(name) {
    if (state.openSheet && state.openSheet !== name) {
      SHEETS[state.openSheet].classList.remove('open');
    }
    state.openSheet = name;
    SHEETS[name].classList.add('open');
    els.backdrop.classList.add('open');
  }

  function closeSheet() {
    if (!state.openSheet) return;
    SHEETS[state.openSheet].classList.remove('open');
    state.openSheet = null;
    els.backdrop.classList.remove('open');
  }

  function closeMenus() {
    els.ctxMenu.classList.remove('open');
    els.chatCtxMenu.classList.remove('open');
    state.ctxMessage = null;
    state.ctxChatId = null;
  }

  function placeMenu(menu, x, y) {
    menu.classList.add('open');
    const w = menu.offsetWidth;
    const h = menu.offsetHeight;
    menu.style.left = Math.max(8, Math.min(x, window.innerWidth - w - 8)) + 'px';
    menu.style.top = Math.max(8, Math.min(y, window.innerHeight - h - 8)) + 'px';
  }

  function scheduleListRefresh() {
    clearTimeout(state.refreshTimer);
    state.refreshTimer = setTimeout(() => loadChats(true), 250);
  }

  function forceLogout(notice) {
    if (notice) sessionStorage.setItem(NOTICE_KEY, JSON.stringify(notice));
    NC.clearToken();
    if (state.socket) state.socket.disconnect();
    NC.leaveTo('index.html');
  }

  function logout() {
    forceLogout(null);
  }

  // ----- Список чатов -----

  function chatItemHtml(c, index) {
    const p = c.peer;
    const last = c.lastMessage;
    const isGroup = c.kind === 'group';
    const known = state.knownChats.has(c.id);
    const classes = ['chat-item'];
    if (c.id === state.currentChatId) classes.push('active');
    if (!known) classes.push('enter');

    let preview = NC.t('noMessages');
    let prefix = '';
    let tick = '';
    if (last) {
      if (last.deleted) {
        preview = X('deleted');
      } else {
        preview = last.hasFile && !last.text ? X('file') : (last.text || '');
        if (last.senderId === state.me.id) {
          prefix = NC.t('youPrefix');
          if (!isGroup) {
            tick = '<span class="ticks ' + (last.read ? 'read' : 'sent') + '">' +
              NC.icon(last.read ? 'checks' : 'check', 14) + '</span>';
          }
        } else if (isGroup && last.senderName) {
          prefix = last.senderName + ': ';
        }
      }
    }

    const badge = c.unread > 0 ? '<span class="badge">' + (c.unread > 99 ? '99+' : c.unread) + '</span>' : '';
    const time = last ? NC.formatListDate(last.createdAt) : '';
    const delay = known ? 0 : index * 45;
    const nameHtml = '<span class="truncate">' + NC.esc(p.displayName) + '</span>' +
      (p.isVerified ? NC.verifiedHtml() : '');

    return '<li class="' + classes.join(' ') + '" data-chat-id="' + c.id + '" tabindex="0" ' +
      'style="animation-delay:' + delay + 'ms">' +
      NC.avatarHtml(p, 'avatar-md') +
      '<div class="chat-meta">' +
      '<div class="chat-row"><span class="chat-name">' + nameHtml + '</span>' +
      '<span class="chat-time">' + NC.esc(time) + '</span></div>' +
      '<div class="chat-row">' + tick +
      '<span class="chat-preview">' + NC.esc(prefix + preview) + '</span>' + badge + '</div>' +
      '</div>' +
      '</li>';
  }

  function renderChatList() {
    if (!state.loaded) return;
    const q = els.listSearch.value.trim().toLowerCase();
    const items = q
      ? state.chats.filter((c) => c.peer.displayName.toLowerCase().includes(q) || c.peer.username.includes(q))
      : state.chats;
    els.chatList.innerHTML = items.map((c, i) => chatItemHtml(c, i)).join('');
    els.chatList.hidden = state.chats.length === 0;
    els.listEmpty.hidden = state.chats.length > 0;
    state.chats.forEach((c) => state.knownChats.add(c.id));
  }

  function renderChatListAnimated() {
    const before = new Map();
    els.chatList.querySelectorAll('.chat-item').forEach((el) => {
      before.set(el.dataset.chatId, el.getBoundingClientRect().top);
    });
    renderChatList();
    els.chatList.querySelectorAll('.chat-item').forEach((el) => {
      const prev = before.get(el.dataset.chatId);
      if (prev === undefined || !el.animate) return;
      const delta = prev - el.getBoundingClientRect().top;
      if (Math.abs(delta) < 1) return;
      el.animate(
        [{ transform: 'translateY(' + delta + 'px)' }, { transform: 'translateY(0px)' }],
        { duration: 380, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' }
      );
    });
  }

  function showSkeleton() {
    let html = '';
    for (let i = 0; i < 6; i++) {
      html += '<li class="skel-row" style="animation-delay:' + (i * 60) + 'ms">' +
        '<span class="skel skel-avatar"></span>' +
        '<span class="skel-lines"><span class="skel skel-line"></span>' +
        '<span class="skel skel-line short"></span></span></li>';
    }
    els.chatList.innerHTML = html;
    els.chatList.hidden = false;
    els.listEmpty.hidden = true;
  }

  async function loadChats(silent) {
    setSyncing(true);
    try {
      const { chats } = await NC.api('GET', '/api/chats');
      state.chats = chats;
      state.loaded = true;
      els.listStatus.hidden = true;
      renderChatListAnimated();
      const chat = currentChat();
      if (state.currentChatId && !chat) {
        closeChat();
      } else if (chat) {
        state.currentGroup = chat.kind === 'group';
        state.currentRole = chat.myRole;
        renderChatHeader(chat);
      }
    } catch (err) {
      if (!state.loaded) {
        els.chatList.innerHTML = '';
        els.chatList.hidden = true;
      }
      if (!silent) showListStatus(errorText(err));
    } finally {
      setSyncing(false);
    }
  }

  // ----- Шапка, состояние поля ввода, закрепление, ответ -----

  function renderChatHeader(chat) {
    const p = chat.peer;
    const isGroup = chat.kind === 'group';
    const status = state.meta && state.meta.peerStatus ? state.meta.peerStatus : p.status;
    let sub = '';
    if (isGroup) sub = membersText(chat.memberCount);
    else if (p.isSystem) sub = NC.t('systemAccount');
    else sub = statusLine(status);
    els.peerBtn.innerHTML = NC.avatarHtml(p, 'avatar-sm') +
      '<span class="peer-info"><span class="peer-name">' + NC.esc(p.displayName) +
      (p.isVerified ? NC.verifiedHtml() : '') + '</span>' +
      '<span class="peer-sub">' + NC.esc(sub) + '</span></span>';
    updateComposerState();
  }

  function updateComposerState() {
    const chat = currentChat();
    if (!chat) return;
    const blocked = state.meta ? state.meta.blocked : (chat.blocked || { byMe: false, byPeer: false });
    let canPost = chat.canPost;
    let note = '';
    if (chat.kind === 'direct') {
      if (chat.peer.isSystem) {
        canPost = false;
        note = NC.t('readonlyChat');
      } else if (blocked.byMe) {
        canPost = false;
        note = X('blockedByMe');
      } else if (blocked.byPeer) {
        canPost = false;
        note = X('blockedByPeer');
      }
    } else if (!canPost) {
      note = X('readonlyGroup');
    }
    els.composer.hidden = !canPost;
    els.readonlyNote.hidden = canPost;
    els.readonlyNote.textContent = note;
  }

  function renderPinned() {
    const p = state.meta && state.meta.pinned;
    if (!p) {
      els.pinnedBar.hidden = true;
      return;
    }
    els.pinnedBar.hidden = false;
    els.pinnedText.textContent = p.text || (p.hasFile ? X('file') : '');
    els.pinnedUnpin.hidden = !canPinHere();
  }

  function renderReplyBar() {
    const m = state.replyTo;
    if (!m) {
      els.replyBar.hidden = true;
      return;
    }
    els.replyBar.hidden = false;
    els.replyName.textContent = m.senderId === state.me.id ? X('you') : (m.senderName || m.senderUsername);
    els.replyText.textContent = previewOf(m);
  }

  function applyMeta(meta) {
    if (!meta) return;
    state.meta = meta;
    renderPinned();
    const chat = currentChat();
    if (chat) renderChatHeader(chat);
  }

  async function refreshMeta() {
    const chatId = state.currentChatId;
    if (!chatId) return;
    try {
      const { meta } = await NC.api('GET', '/api/chats/' + chatId + '/messages?limit=1');
      if (state.currentChatId === chatId) applyMeta(meta);
    } catch (err) {
      // Не критично: состояние обновится при следующем событии
    }
  }

  function prepareChat(chat) {
    state.currentChatId = chat.id;
    state.currentGroup = chat.kind === 'group';
    state.currentRole = chat.myRole;
    state.meta = null;
    state.replyTo = null;
    state.messages = [];
    state.oldestId = null;
    state.hasMore = false;
    state.hasNewer = false;
    state.loadingOlder = false;
    state.loadingNewer = false;
    state.loadingAll = false;
    els.messageInput.value = '';
    autoGrow();
    renderReplyBar();
    renderPinned();
    renderChatHeader(chat);
    els.messages.innerHTML = '<div class="chat-hint">' + spinnerHtml() + '</div>';
    els.app.classList.add('chat-open');
    renderChatList();
    updateToBottom();
  }

  async function openChat(chatId) {
    if (state.currentChatId === chatId) {
      els.app.classList.add('chat-open');
      return;
    }
    const chat = state.chats.find((c) => c.id === chatId);
    if (!chat) return;
    prepareChat(chat);
    await fetchLatest(chatId);
  }

  async function fetchLatest(chatId) {
    try {
      const data = await NC.api('GET', '/api/chats/' + chatId + '/messages?limit=' + PAGE);
      if (state.currentChatId !== chatId) return;
      applyMeta(data.meta);
      state.messages = data.messages;
      state.hasMore = Boolean(data.hasMore);
      state.hasNewer = false;
      state.oldestId = data.messages.length ? data.messages[0].id : null;
      renderMessages();
      scrollToBottom(false);
      markRead(chatId);
    } catch (err) {
      if (state.currentChatId === chatId) {
        els.messages.innerHTML = '<div class="chat-hint">' + NC.esc(errorText(err)) + '</div>';
      }
    }
  }

  function jumpToLatest() {
    const chatId = state.currentChatId;
    if (!chatId) return;
    if (state.hasNewer) {
      const chat = currentChat();
      if (chat) prepareChat(chat);
      fetchLatest(chatId);
    } else {
      scrollToBottom(true);
    }
  }

  async function openAround(messageId) {
    const chatId = state.currentChatId;
    const chat = currentChat();
    if (!chatId || !chat) return;
    prepareChat(chat);
    try {
      const data = await NC.api('GET', '/api/chats/' + chatId + '/messages?limit=' + AROUND + '&around=' + messageId);
      if (state.currentChatId !== chatId) return;
      applyMeta(data.meta);
      state.messages = data.messages;
      state.hasMore = Boolean(data.hasOlder);
      state.hasNewer = Boolean(data.hasNewer);
      state.oldestId = data.messages.length ? data.messages[0].id : null;
      renderMessages();
      highlightMessage(messageId, true);
      updateToBottom();
    } catch (err) {
      if (state.currentChatId === chatId) {
        els.messages.innerHTML = '<div class="chat-hint">' + NC.esc(errorText(err)) + '</div>';
      }
    }
  }

  function highlightMessage(id, instant) {
    const el = els.messages.querySelector('[data-id="' + id + '"]');
    if (!el) return;
    if (instant) {
      const box = els.messages;
      box.scrollTop = el.offsetTop - (box.clientHeight - el.offsetHeight) / 2;
    } else {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 1500);
  }

  function scrollToMessage(id) {
    if (els.messages.querySelector('[data-id="' + id + '"]')) {
      highlightMessage(id, false);
    } else {
      openAround(id);
    }
  }

  function closeChat() {
    closeMenus();
    state.currentChatId = null;
    state.currentGroup = false;
    state.currentRole = null;
    state.meta = null;
    state.replyTo = null;
    state.messages = [];
    els.app.classList.remove('chat-open');
    renderChatList();
  }

  // ----- Сообщения -----

  function fileHtml(f) {
    if (IMAGE_RE.test(f.mime)) {
      return '<img class="msg-img" alt="" data-file-id="' + f.id + '">';
    }
    if (VIDEO_RE.test(f.mime)) {
      return '<video class="msg-video" controls playsinline preload="metadata" data-file-id="' + f.id + '"></video>';
    }
    return '<button class="file-card" type="button" data-file-id="' + f.id + '" data-name="' + NC.esc(f.name) + '">' +
      '<span class="file-card-icon">' + NC.icon('file', 20) + '</span>' +
      '<span class="file-card-meta"><span class="file-card-name">' + NC.esc(f.name) + '</span>' +
      '<span class="file-card-size">' + formatSize(f.size) + '</span></span></button>';
  }

  function quoteHtml(rt) {
    if (!rt) return '';
    const text = rt.deleted ? X('deleted') : (rt.text || (rt.hasFile ? X('file') : ''));
    return '<span class="quote" data-scroll="' + rt.id + '">' +
      '<span class="quote-name">' + NC.esc(rt.senderName || '') + '</span>' +
      '<span class="quote-text">' + NC.esc(text) + '</span></span>';
  }

  function reactionsHtml(m) {
    if (!m.reactions || !m.reactions.length) return '';
    return '<div class="reactions">' + m.reactions.map((r) =>
      '<button class="reaction-chip' + (r.mine ? ' mine' : '') + '" type="button" data-react="' + NC.esc(r.emoji) +
      '" data-message-id="' + m.id + '">' + NC.esc(r.emoji) + ' <span>' + r.count + '</span></button>'
    ).join('') + '</div>';
  }

  function tickHtml(m) {
    if (m.senderId !== state.me.id || state.currentGroup) return '';
    return '<span class="ticks ' + (m.read ? 'read' : 'sent') + '">' +
      NC.icon(m.read ? 'checks' : 'check', 14) + '</span>';
  }

  function dayHtml(iso) {
    return '<div class="day-sep"><span>' + NC.esc(NC.formatDay(iso)) + '</span></div>';
  }

  function messageHtml(m, animate) {
    const mine = m.senderId === state.me.id;
    const classes = ['msg', mine ? 'mine' : 'theirs'];
    if (animate) classes.push('enter');

    let body = '';
    if (state.currentGroup && !mine) {
      body += '<span class="msg-sender">' + NC.esc(m.senderName || m.senderUsername) + '</span>';
    }
    if (m.forwardedFrom) {
      body += '<span class="forwarded">' + NC.esc(X('forwardedFrom')) + ' ' +
        NC.esc(m.forwardedFrom.displayName) + '</span>';
    }
    body += quoteHtml(m.replyTo);
    if (m.file) body += fileHtml(m.file);
    if (m.text) body += '<span class="msg-text">' + richText(m.text) + '</span>';

    return '<div class="' + classes.join(' ') + '" data-id="' + m.id + '"><div class="msg-col">' +
      '<div class="bubble">' + body +
      '<span class="msg-meta"><span class="msg-time">' + NC.formatTime(m.createdAt) + '</span>' +
      tickHtml(m) + '</span>' +
      '</div>' +
      reactionsHtml(m) +
      '</div></div>';
  }

  function renderMessages() {
    const box = els.messages;
    if (!state.messages.length) {
      box.innerHTML = '<div class="chat-hint">' + NC.esc(NC.t('emptyChat')) + '</div>';
    } else {
      let html = '';
      if (state.hasMore) {
        html += '<button class="load-all" type="button">' + NC.esc(X('loadAll')) + '</button>';
      }
      let lastDay = '';
      for (const m of state.messages) {
        const day = NC.dayKey(m.createdAt);
        if (day !== lastDay) {
          html += dayHtml(m.createdAt);
          lastDay = day;
        }
        html += messageHtml(m, false);
      }
      box.innerHTML = html;
    }
    hydrateMedia(box);
    updateToBottom();
  }

  function rerenderMessages() {
    const box = els.messages;
    const stick = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    const top = box.scrollTop;
    renderMessages();
    box.scrollTop = stick ? box.scrollHeight : top;
  }

  function appendMessage(m) {
    if (!m || m.chatId !== state.currentChatId || state.hasNewer) return false;
    if (state.messages.some((x) => x.id === m.id)) return false;

    const box = els.messages;
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    const prev = state.messages[state.messages.length - 1];
    state.messages.push(m);

    const hint = box.querySelector('.chat-hint');
    if (hint) hint.remove();
    if (!prev || NC.dayKey(prev.createdAt) !== NC.dayKey(m.createdAt)) {
      box.insertAdjacentHTML('beforeend', dayHtml(m.createdAt));
    }
    box.insertAdjacentHTML('beforeend', messageHtml(m, true));
    hydrateMedia(box);

    const mine = m.senderId === state.me.id;
    if (nearBottom || mine) scrollToBottom(true);
    if (!mine && !document.hidden) markRead(m.chatId);
    updateToBottom();
    return true;
  }

  function replaceMessage(m) {
    if (!m || m.chatId !== state.currentChatId) return;
    const i = state.messages.findIndex((x) => x.id === m.id);
    if (i === -1) return;
    state.messages[i] = m;
    rerenderMessages();
  }

  function removeMessageLocal(id) {
    const before = state.messages.length;
    state.messages = state.messages.filter((m) => m.id !== id);
    if (state.messages.length !== before) rerenderMessages();
  }

  function prependMessages(list, hasMore) {
    const have = new Set(state.messages.map((m) => m.id));
    state.messages = list.filter((m) => !have.has(m.id)).concat(state.messages);
    state.hasMore = Boolean(hasMore);
    state.oldestId = state.messages.length ? state.messages[0].id : null;
  }

  function updateToBottom() {
    const box = els.messages;
    const far = box.scrollHeight - box.scrollTop - box.clientHeight > 300;
    els.toBottom.hidden = !state.currentChatId || !(state.hasNewer || far);
  }

  function onMessagesScroll() {
    closeMenus();
    const box = els.messages;
    if (box.scrollTop < 80 && state.hasMore) loadOlder();
    const dist = box.scrollHeight - box.scrollTop - box.clientHeight;
    if (dist < 120 && state.hasNewer) loadNewer();
    updateToBottom();
  }

  async function loadOlder() {
    if (state.loadingOlder || state.loadingAll || !state.hasMore || state.oldestId == null || !state.currentChatId) return;
    const chatId = state.currentChatId;
    const box = els.messages;
    state.loadingOlder = true;
    box.classList.add('loading-older');
    const prevHeight = box.scrollHeight;
    try {
      const data = await NC.api('GET', '/api/chats/' + chatId + '/messages?limit=' + PAGE + '&before=' + state.oldestId);
      if (state.currentChatId !== chatId) return;
      prependMessages(data.messages, data.hasMore);
      renderMessages();
      box.scrollTop = box.scrollHeight - prevHeight;
    } catch (err) {
      toast(errorText(err));
    } finally {
      state.loadingOlder = false;
      box.classList.remove('loading-older');
    }
  }

  async function loadAll() {
    if (state.loadingAll || state.loadingOlder || !state.hasMore || state.oldestId == null || !state.currentChatId) return;
    const chatId = state.currentChatId;
    const box = els.messages;
    state.loadingAll = true;
    const btn = box.querySelector('.load-all');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = spinnerHtml();
    }
    const prevHeight = box.scrollHeight;
    try {
      while (state.hasMore && state.oldestId != null && state.currentChatId === chatId) {
        const data = await NC.api('GET', '/api/chats/' + chatId + '/messages?limit=' + PAGE + '&before=' + state.oldestId);
        if (state.currentChatId !== chatId) return;
        if (!data.messages.length) {
          state.hasMore = false;
          break;
        }
        prependMessages(data.messages, data.hasMore);
      }
      renderMessages();
      box.scrollTop = box.scrollHeight - prevHeight;
    } catch (err) {
      toast(errorText(err));
      renderMessages();
    } finally {
      state.loadingAll = false;
    }
  }

  async function loadNewer() {
    const chatId = state.currentChatId;
    const after = newestId();
    if (state.loadingNewer || !state.hasNewer || !chatId || after == null) return;
    state.loadingNewer = true;
    const box = els.messages;
    const stick = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    try {
      const data = await NC.api('GET', '/api/chats/' + chatId + '/messages?limit=' + PAGE + '&after=' + after);
      if (state.currentChatId !== chatId) return;
      const have = new Set(state.messages.map((m) => m.id));
      state.messages = state.messages.concat(data.messages.filter((m) => !have.has(m.id)));
      state.hasNewer = Boolean(data.hasNewer);
      renderMessages();
      if (stick) scrollToBottom(false);
      if (!state.hasNewer) markRead(chatId);
    } catch (err) {
      toast(errorText(err));
    } finally {
      state.loadingNewer = false;
    }
  }

  async function syncCurrentChat() {
    const chatId = state.currentChatId;
    if (!chatId || state.hasNewer) return;
    try {
      const data = await NC.api('GET', '/api/chats/' + chatId + '/messages?limit=' + PAGE);
      if (state.currentChatId !== chatId) return;
      applyMeta(data.meta);
      data.messages.forEach((m) => appendMessage(m));
    } catch (err) {
      // При следующем сообщении всё догрузится
    }
  }

  // ----- Файлы -----

  async function fetchBlob(id) {
    const res = await fetch('/api/files/' + id, {
      headers: { Authorization: 'Bearer ' + NC.getToken() },
    });
    if (!res.ok) throw new Error('file');
    return res.blob();
  }

  function fileUrl(id) {
    if (!state.fileCache.has(id)) {
      const p = fetchBlob(id)
        .then((blob) => URL.createObjectURL(blob))
        .catch((err) => {
          state.fileCache.delete(id);
          throw err;
        });
      state.fileCache.set(id, p);
    }
    return state.fileCache.get(id);
  }

  function hydrateMedia(root) {
    root.querySelectorAll('img.msg-img[data-file-id]:not([src]), video.msg-video[data-file-id]:not([src])').forEach((el) => {
      fileUrl(Number(el.dataset.fileId))
        .then((url) => { el.src = url; })
        .catch(() => { });
    });
  }

  async function downloadFile(id, name) {
    try {
      const url = await fileUrl(id);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      toast(X('notFound'));
    }
  }

  async function openImage(id) {
    try {
      window.open(await fileUrl(id), '_blank');
    } catch (err) {
      toast(X('notFound'));
    }
  }

  async function uploadAttachment(file, chatId) {
    const res = await fetch('/api/files/chat/' + chatId, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + NC.getToken(),
        'Content-Type': 'application/octet-stream',
        'X-File-Name': encodeURIComponent(file.name),
        'X-File-Type': file.type || 'application/octet-stream',
      },
      body: file,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new NC.ApiError(data.error || X('uploadFailed'), res.status);
    return data.file;
  }

  async function onFilePicked() {
    const file = els.fileInput.files[0];
    els.fileInput.value = '';
    const chatId = state.currentChatId;
    if (!file || !chatId) return;
    if (file.size > MAX_FILE) return toast(X('tooBig'));

    const caption = els.messageInput.value.trim();
    const replyId = state.replyTo ? state.replyTo.id : undefined;
    els.attachBtn.disabled = true;
    toast(X('uploading'));
    try {
      if (state.hasNewer) await fetchLatest(chatId);
      const uploaded = await uploadAttachment(file, chatId);
      const { message } = await NC.api('POST', '/api/chats/' + chatId + '/messages', {
        text: caption,
        fileId: uploaded.id,
        replyToId: replyId,
      });
      if (state.currentChatId === chatId) {
        els.messageInput.value = '';
        state.replyTo = null;
        renderReplyBar();
        autoGrow();
      }
      appendMessage(message);
      scheduleListRefresh();
    } catch (err) {
      toast(errorText(err));
    } finally {
      els.attachBtn.disabled = false;
    }
  }

  // ----- Прочтение, отправка, реакции -----

  async function markRead(chatId) {
    const chat = state.chats.find((c) => c.id === chatId);
    if (chat && chat.unread) {
      chat.unread = 0;
      renderChatList();
    }
    try {
      await NC.api('POST', '/api/chats/' + chatId + '/read');
    } catch (err) {
      // Счётчик обновится при следующей загрузке списка
    }
  }

  async function sendMessage(e) {
    e.preventDefault();
    const chatId = state.currentChatId;
    const text = els.messageInput.value.trim();
    if (!chatId || !text || state.sending) return;
    if (text.length > 4000) return toast(NC.t('messageMax'));

    const replyId = state.replyTo ? state.replyTo.id : undefined;
    state.sending = true;
    els.messageInput.value = '';
    autoGrow();
    try {
      if (state.hasNewer) await fetchLatest(chatId);
      const { message } = await NC.api('POST', '/api/chats/' + chatId + '/messages', {
        text: text,
        replyToId: replyId,
      });
      if (state.currentChatId === chatId) {
        state.replyTo = null;
        renderReplyBar();
      }
      appendMessage(message);
      scheduleListRefresh();
    } catch (err) {
      if (state.currentChatId === chatId && !els.messageInput.value) {
        els.messageInput.value = text;
        autoGrow();
      }
      toast(errorText(err));
    } finally {
      state.sending = false;
    }
  }

  async function toggleReaction(messageId, emoji) {
    const chatId = state.currentChatId;
    if (!chatId || !emoji) return;
    try {
      const { message } = await NC.api(
        'POST',
        '/api/chats/' + chatId + '/messages/' + messageId + '/reactions',
        { emoji: emoji }
      );
      replaceMessage(message);
    } catch (err) {
      toast(errorText(err));
    }
  }

  function applyRead(data) {
    if (!data || data.chatId !== state.currentChatId) {
      scheduleListRefresh();
      return;
    }
    if (data.readerId === state.me.id) return;
    let changed = false;
    state.messages.forEach((m) => {
      if (m.senderId === state.me.id && !m.read && m.id <= data.lastReadId) {
        m.read = true;
        changed = true;
      }
    });
    if (changed) rerenderMessages();
    scheduleListRefresh();
  }

  // ----- Меню сообщения -----

  function buildReactionBar() {
    const quick = REACTIONS.slice(0, QUICK_COUNT).map((e) =>
      '<button class="ctx-react" type="button" data-emoji="' + e + '">' + e + '</button>'
    ).join('');
    els.ctxReactions.innerHTML = quick +
      '<button class="ctx-react ctx-more-btn" type="button" data-more="1" aria-label="More">' + xIcon('plus', 16) + '</button>';
    els.ctxMore.innerHTML = REACTIONS.slice(QUICK_COUNT).map((e) =>
      '<button class="ctx-react" type="button" data-emoji="' + e + '">' + e + '</button>'
    ).join('');
    els.ctxMore.hidden = true;
  }

  function openContextMenu(messageId, x, y) {
    const msg = state.messages.find((m) => m.id === messageId);
    if (!msg) return;
    closeMenus();
    state.ctxMessage = msg;
    buildReactionBar();
    els.ctxCopy.hidden = !msg.text;
    els.ctxDeleteAll.hidden = !canDeleteAll(msg);
    const pinned = state.meta && state.meta.pinned && state.meta.pinned.id === msg.id;
    els.ctxPin.hidden = !canPinHere();
    els.ctxPinLabel.textContent = pinned ? X('unpin') : X('pin');
    placeMenu(els.ctxMenu, x, y);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast(X('copied'));
  }

  async function deleteFromMenu(scope) {
    const msg = state.ctxMessage;
    closeMenus();
    if (!msg) return;
    if (scope === 'all' && !window.confirm(X('confirmAll'))) return;
    try {
      await NC.api('DELETE', '/api/chats/' + msg.chatId + '/messages/' + msg.id + '?scope=' + scope);
      removeMessageLocal(msg.id);
      scheduleListRefresh();
      if (scope === 'all') refreshMeta();
    } catch (err) {
      toast(errorText(err));
    }
  }

  function startReply() {
    const msg = state.ctxMessage;
    closeMenus();
    if (!msg) return;
    state.replyTo = msg;
    renderReplyBar();
    if (fineInput) els.messageInput.focus();
  }

  async function togglePinFromMenu() {
    const msg = state.ctxMessage;
    const chatId = state.currentChatId;
    closeMenus();
    if (!msg || !chatId) return;
    const pinned = state.meta && state.meta.pinned && state.meta.pinned.id === msg.id;
    try {
      if (pinned) {
        await NC.api('DELETE', '/api/chats/' + chatId + '/pin');
      } else {
        await NC.api('POST', '/api/chats/' + chatId + '/pin/' + msg.id);
      }
      refreshMeta();
    } catch (err) {
      toast(errorText(err));
    }
  }

  function openForward(messageId) {
    state.forwardMessageId = messageId;
    const chats = state.chats.filter((c) => c.canPost && !c.peer.isSystem);
    els.forwardList.innerHTML = chats.map((c) =>
      '<li><button class="user-item" type="button" data-chat-id="' + c.id + '">' +
      NC.avatarHtml(c.peer, 'avatar-md') +
      '<span class="chat-meta"><span class="chat-name"><span class="truncate">' +
      NC.esc(c.peer.displayName) + '</span></span>' +
      '<span class="chat-preview">' + NC.esc(c.kind === 'group' ? X('groupTag') : '@' + c.peer.username) +
      '</span></span></button></li>'
    ).join('');
    els.forwardHint.hidden = chats.length > 0;
    els.forwardHint.textContent = X('noForwardChats');
    openSheet('forward');
  }

  // ----- Меню чата в списке -----

  function openChatContext(chatId, x, y) {
    const chat = state.chats.find((c) => c.id === chatId);
    if (!chat) return;
    closeMenus();
    state.ctxChatId = chatId;
    const direct = chat.kind === 'direct';
    const blockedByMe = Boolean(chat.blocked && chat.blocked.byMe);
    els.chatCtxHide.hidden = !direct;
    els.chatCtxBlock.hidden = !direct || Boolean(chat.peer.isSystem);
    els.chatCtxBlockLabel.textContent = blockedByMe ? X('unblock') : X('block');
    els.chatCtxLeave.hidden = direct;
    placeMenu(els.chatCtxMenu, x, y);
  }

  async function chatCtxAction(kind) {
    const chatId = state.ctxChatId;
    closeMenus();
    if (!chatId) return;
    try {
      if (kind === 'hide') {
        if (!window.confirm(X('confirmHideChat'))) return;
        await NC.api('POST', '/api/chats/' + chatId + '/hide');
        if (state.currentChatId === chatId) closeChat();
        toast(X('chatHidden'));
      } else if (kind === 'block') {
        if (!window.confirm(X('confirmBlock'))) return;
        await NC.api('POST', '/api/chats/' + chatId + '/block');
        toast(X('blockedDone'));
      } else if (kind === 'unblock') {
        await NC.api('DELETE', '/api/chats/' + chatId + '/block');
        toast(X('unblockedDone'));
      } else if (kind === 'leave') {
        if (!window.confirm(X('confirmLeave'))) return;
        await NC.api('POST', '/api/chats/' + chatId + '/leave');
        if (state.currentChatId === chatId) closeChat();
        toast(X('left'));
      }
      await loadChats(true);
      if (state.currentChatId === chatId) refreshMeta();
    } catch (err) {
      toast(errorText(err));
    }
  }

  // ----- Поиск в чате -----

  function searchHitHtml(m) {
    const name = m.senderName || m.senderUsername || '';
    return '<li><button class="user-item" type="button" data-message-id="' + m.id + '">' +
      NC.avatarHtml({ displayName: name, username: m.senderUsername || name || 'user' }, 'avatar-md') +
      '<span class="chat-meta"><span class="chat-name"><span class="truncate">' + NC.esc(name) + '</span></span>' +
      '<span class="chat-preview">' + NC.esc(m.text) + '</span>' +
      '<span class="chat-time">' + NC.esc(NC.formatListDate(m.createdAt)) + '</span></span></button></li>';
  }

  async function doChatSearch() {
    const chatId = state.currentChatId;
    const q = els.chatSearchInput.value.trim();
    if (!chatId) return;
    if (q.length < 2) {
      els.chatSearchResults.innerHTML = '';
      els.chatSearchHint.hidden = false;
      els.chatSearchHint.textContent = X('searchHint');
      return;
    }
    try {
      const { messages } = await NC.api('GET', '/api/chats/' + chatId + '/search?q=' + encodeURIComponent(q));
      if (state.currentChatId !== chatId) return;
      els.chatSearchResults.innerHTML = messages.map(searchHitHtml).join('');
      els.chatSearchHint.hidden = messages.length > 0;
      els.chatSearchHint.textContent = X('searchNone');
    } catch (err) {
      toast(errorText(err));
    }
  }

  // ----- Настройки -----

  function renderSettings() {
    const me = state.me;
    if (!me) return;
    els.profileCard.innerHTML =
      '<span class="avatar-wrap">' + NC.avatarHtml(me, 'avatar-lg') +
      '<button class="avatar-edit" type="button" data-photo="1" aria-label="' + NC.esc(X('changePhoto')) + '">' +
      NC.icon('camera', 15) + '</button></span>' +
      '<button class="profile-card-main" type="button">' +
      '<span class="profile-card-text"><span class="profile-card-name">' + NC.esc(me.displayName) +
      (me.isVerified ? NC.verifiedHtml() : '') + '</span>' +
      '<span class="profile-card-sub">@' + NC.esc(me.username) + '</span></span>' +
      '<span class="chev">' + NC.icon('chevron', 18) + '</span>' +
      '</button>';
    NC.setSegValue(els.themeSeg, NC.getThemePref());
    NC.setSegValue(els.langSeg, NC.getLang());
  }

  function showStub(titleKey) {
    els.stubTitle.textContent = X(titleKey);
    els.stubText.textContent = X('comingSoon');
    openSheet('stub');
  }

  function openPrivacy() {
    els.lastSeenToggle.checked = !state.me || state.me.showLastSeen !== false;
    openSheet('privacy');
  }

  async function onLastSeenToggle() {
    const value = els.lastSeenToggle.checked;
    const previous = !value;
    state.me.showLastSeen = value;
    try {
      await NC.api('PATCH', '/api/users/me', { showLastSeen: value });
      toast(NC.t('saved'));
      if (state.currentChatId) refreshMeta();
    } catch (err) {
      els.lastSeenToggle.checked = previous;
      state.me.showLastSeen = previous;
      toast(errorText(err));
    }
  }

  function onSettingsRowClick(e) {
    const row = e.target.closest('[data-go]');
    if (!row) return;
    const go = row.dataset.go;
    if (go === 'account') openProfile(state.me, true, 'settings');
    else if (go === 'appearance') {
      NC.setSegValue(els.themeSeg, NC.getThemePref());
      openSheet('appearance');
    } else if (go === 'language') {
      NC.setSegValue(els.langSeg, NC.getLang());
      openSheet('language');
    } else if (go === 'nova') openSheet('nova');
    else if (go === 'notifications') showStub('notifications');
    else if (go === 'privacy') openPrivacy();
    else if (go === 'data') showStub('dataMemory');
  }

  // ----- Профиль -----

  function renderProfile(user, editable) {
    state.profileUser = user;
    state.profileEditable = editable;
    els.profileAvatar.innerHTML = NC.avatarHtml(user, 'avatar-xl');
    els.avatarEdit.hidden = !editable;
    els.profileName.innerHTML = NC.esc(user.displayName) + (user.isVerified ? NC.verifiedHtml() : '');
    els.profileUsername.textContent = '@' + user.username;

    const badge = user.isSystem ? NC.t('systemAccount') : (user.isVerified ? NC.t('verified') : '');
    els.profileBadge.textContent = badge;
    els.profileBadge.hidden = !badge;

    // «Написать» не нужна в своём профиле, у NovaChat и в открытом из самого чата
    els.profileActions.hidden = editable || Boolean(user.isSystem) || state.profileOrigin === 'chat';

    els.profileForm.hidden = !editable;
    els.profileBio.hidden = editable;
    const reportWrap = $('reportWrap');
    if (reportWrap) reportWrap.hidden = editable || Boolean(user.isSystem);

    if (editable) {
      els.editName.value = user.displayName;
      els.editBio.value = user.bio || '';
    } else if (user.bio === undefined) {
      els.profileBio.textContent = '…';
    } else if (user.bio) {
      els.profileBio.innerHTML = richText(user.bio);
    } else {
      els.profileBio.textContent = NC.t('noBio');
    }
  }

  // Вкладки профиля: «Подарки» и «Публикации», у своего профиля справа кнопка действия
  function setProfileTab(tab) {
    state.profileTab = tab;
    els.tabGifts.classList.toggle('active', tab === 'gifts');
    els.tabPosts.classList.toggle('active', tab === 'posts');
    els.panelGifts.hidden = tab !== 'gifts';
    els.panelPosts.hidden = tab !== 'posts';
    renderTabAction();
  }

  function renderTabAction() {
    const own = state.profileEditable;
    els.tabAction.hidden = !own;
    if (!own) return;
    els.tabAction.textContent = state.profileTab === 'gifts' ? X('addCollection') : X('postsArchive');
  }

  function renderCollections(list) {
    els.collectionList.innerHTML = list.map((c) =>
      '<li class="collection-item">' +
      '<span class="collection-icon">' + xIcon('gift', 20) + '</span>' +
      '<span class="collection-meta">' +
      '<span class="collection-name">' + NC.esc(c.title) + '</span>' +
      '<span class="collection-sub">' + NC.esc(X('collectionEmpty')) + '</span>' +
      '</span>' +
      '</li>'
    ).join('');
    els.giftsEmpty.hidden = list.length > 0;
  }

  async function loadCollections(username) {
    try {
      const data = await NC.api('GET', '/api/gifts/collections/' + encodeURIComponent(username));
      if (state.profileUser && state.profileUser.username === username) {
        renderCollections(data.collections);
      }
    } catch (err) {
      if (state.profileUser && state.profileUser.username === username) renderCollections([]);
      toast(errorText(err));
    }
  }

  async function createCollection() {
    const title = els.collectionTitle.value.trim();
    if (!title || title.length > 32) return toast(X('collectionNeedTitle'));
    try {
      await NC.api('POST', '/api/gifts/collections', { title: title });
      els.collectionTitle.value = '';
      openSheet('profile');
      toast(X('collectionCreated'));
      if (state.profileUser) loadCollections(state.profileUser.username);
    } catch (err) {
      toast(errorText(err));
    }
  }

  async function openProfile(user, editable, origin) {
    state.profileOrigin = origin || null;
    els.profileBack.classList.toggle('invisible', !BACK_TARGETS[state.profileOrigin]);
    renderProfile(user, editable);
    setProfileTab('gifts');
    renderCollections([]);
    openSheet('profile');
    if (!user.username) return;
    loadCollections(user.username);
    if (editable) return;
    try {
      const { user: full } = await NC.api('GET', '/api/users/' + encodeURIComponent(user.username));
      const stillOpen = state.openSheet === 'profile' &&
        state.profileUser && state.profileUser.username === full.username && !state.profileEditable;
      if (stillOpen) renderProfile(full, false);
    } catch (err) {
      if (state.openSheet === 'profile') toast(errorText(err));
    }
  }

  // Ссылка @name: сначала ищем пользователя, если его нет, ищем группу с этим юзернеймом
  function openProfileByUsername(username) {
    NC.api('GET', '/api/users/' + encodeURIComponent(username))
      .then((data) => openProfile(data.user, false, null))
      .catch((err) => {
        if (!(err instanceof NC.ApiError) || err.status !== 404) {
          toast(errorText(err));
          return;
        }
        NC.api('GET', '/api/chats/groups/by-username/' + encodeURIComponent(username))
          .then((data) => openGroupPreview(data.group))
          .catch(() => {
            toast(NC.getLang() === 'en' ? 'User or group not found' : 'Пользователь или группа не найдены');
          });
      });
  }

  function ensureReportUi() {
    const body = els.profileSheet.querySelector('.sheet-body');
    const wrap = document.createElement('div');
    wrap.id = 'reportWrap';
    wrap.className = 'report-wrap';
    wrap.hidden = true;
    wrap.innerHTML =
      '<button id="reportToggle" class="report-toggle" type="button" data-x="report"></button>' +
      '<div id="reportBox" class="reveal">' +
      '<div class="reveal-inner report-inner">' +
      '<textarea id="reportText" class="field textarea" rows="3" maxlength="500" data-x-placeholder="reportPlaceholder"></textarea>' +
      '<button id="reportSend" class="btn btn-danger" type="button" data-x="reportSend"></button>' +
      '</div>' +
      '</div>';
    body.appendChild(wrap);

    $('reportToggle').addEventListener('click', () => {
      const box = $('reportBox');
      box.classList.toggle('open');
      if (box.classList.contains('open') && fineInput) $('reportText').focus();
    });
    $('reportSend').addEventListener('click', sendReport);
  }

  async function sendReport() {
    const user = state.profileUser;
    const reason = $('reportText').value.trim();
    if (!user) return;
    if (!reason) return toast(X('reportEmpty'));
    try {
      await NC.api('POST', '/api/reports', { username: user.username, reason: reason });
      $('reportText').value = '';
      $('reportBox').classList.remove('open');
      toast(X('reportSent'));
    } catch (err) {
      toast(err.status === 409 ? X('reportDup') : errorText(err));
    }
  }

  async function saveSettings(patch) {
    Object.assign(state.me, patch);
    try {
      await NC.api('PATCH', '/api/users/me', patch);
    } catch (err) {
      toast(errorText(err));
    }
  }

  async function saveProfile(e) {
    e.preventDefault();
    const displayName = els.editName.value.trim();
    const bio = els.editBio.value.trim();
    if (!displayName || displayName.length > 64) return toast(NC.t('nameLength'));
    if (bio.length > 200) return toast(NC.t('bioLength'));
    try {
      const { user } = await NC.api('PATCH', '/api/users/me', { displayName: displayName, bio: bio });
      state.me = Object.assign({}, state.me, user);
      renderSettings();
      renderProfile(state.me, true);
      toast(NC.t('saved'));
      scheduleListRefresh();
    } catch (err) {
      toast(errorText(err));
    }
  }

  async function uploadAvatar(file) {
    if (file.size > MAX_PHOTO) return toast(X('photoTooBig'));
    if (!IMAGE_RE.test(file.type)) return toast(X('photoWrong'));
    try {
      const res = await fetch('/api/files/avatar', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + NC.getToken(),
          'Content-Type': 'application/octet-stream',
          'X-File-Type': file.type,
        },
        body: file,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new NC.ApiError(data.error || X('uploadFailed'), res.status);
      state.me = Object.assign({}, state.me, { avatarUrl: data.avatarUrl });
      renderSettings();
      if (state.openSheet === 'profile' && state.profileEditable) renderProfile(state.me, true);
      toast(X('photoSaved'));
      scheduleListRefresh();
    } catch (err) {
      toast(err instanceof NC.ApiError ? err.message : NC.t('errNetwork'));
    }
  }

  function onThemeClick(e) {
    const btn = e.target.closest('.seg');
    if (!btn) return;
    const pref = btn.dataset.value;
    NC.setTheme(pref);
    NC.setSegValue(els.themeSeg, pref);
    saveSettings({ theme: pref });
  }

  function onLangClick(e) {
    const btn = e.target.closest('.seg');
    if (!btn || btn.dataset.value === NC.getLang()) return;
    NC.setLang(btn.dataset.value);
    saveSettings({ language: btn.dataset.value });
  }

  // ----- Новый чат, поиск людей и групп -----

  function renderUserResults(users, groups) {
    state.groupResults = new Map(groups.map((g) => [g.id, g]));
    state.userResultMap = new Map(users.map((u) => [u.username, u]));
    const groupHtml = groups.map((g) =>
      '<li><button class="user-item" type="button" data-group-id="' + g.id + '">' +
      NC.avatarHtml({ displayName: g.title, username: g.username }, 'avatar-md') +
      '<span class="chat-meta"><span class="chat-name"><span class="truncate">' + NC.esc(g.title) + '</span></span>' +
      '<span class="chat-preview">' + NC.esc(X('groupTag') + ' · ' + membersText(g.memberCount)) + '</span></span>' +
      '</button></li>'
    ).join('');
    const userHtml = users.map((u) =>
      '<li><button class="user-item" type="button" data-username="' + NC.esc(u.username) + '">' +
      NC.avatarHtml(u, 'avatar-md') +
      '<span class="chat-meta"><span class="chat-name"><span class="truncate">' + NC.esc(u.displayName) +
      '</span>' + (u.isVerified ? NC.verifiedHtml() : '') + '</span>' +
      '<span class="chat-preview">@' + NC.esc(u.username) + '</span></span></button></li>'
    ).join('');
    els.userResults.innerHTML = groupHtml + userHtml;
    const hasAny = users.length > 0 || groups.length > 0;
    els.userHint.hidden = hasAny;
    els.userHint.textContent = els.userSearch.value.trim() ? NC.t('noResults') : NC.t('newChatHint');
  }

  async function runUserSearch() {
    const q = els.userSearch.value.trim();
    if (!q) return renderUserResults([], []);
    try {
      const [usersRes, groupsRes] = await Promise.all([
        NC.api('GET', '/api/users/search?q=' + encodeURIComponent(q)),
        NC.api('GET', '/api/chats/groups/search?q=' + encodeURIComponent(q)),
      ]);
      renderUserResults(usersRes.users, groupsRes.groups);
    } catch (err) {
      toast(errorText(err));
    }
  }

  async function startChatWith(username) {
    try {
      const { chatId } = await NC.api('POST', '/api/chats', { username: username });
      closeSheet();
      await loadChats(true);
      openChat(chatId);
    } catch (err) {
      toast(errorText(err));
    }
  }

  function resetGroupForm() {
    els.groupTitle.value = '';
    els.groupUsername.value = '';
    els.groupDesc.value = '';
    els.groupUsernameHint.textContent = '';
    els.groupUsernameHint.className = 'hint';
  }

  async function checkGroupUsernameNow() {
    const value = els.groupUsername.value.trim().toLowerCase();
    const seq = ++state.usernameSeq;
    const hint = els.groupUsernameHint;
    if (!value) {
      hint.textContent = '';
      hint.className = 'hint';
      return;
    }
    if (!USERNAME_RE.test(value)) {
      hint.textContent = NC.t('hintInvalid');
      hint.className = 'hint bad';
      return;
    }
    hint.textContent = NC.t('hintChecking');
    hint.className = 'hint';
    try {
      const data = await NC.api('GET', '/api/chats/groups/check?username=' + encodeURIComponent(value));
      if (seq !== state.usernameSeq) return;
      hint.textContent = data.available ? NC.t('hintFree') : NC.t('hintTaken');
      hint.className = 'hint ' + (data.available ? 'ok' : 'bad');
    } catch (err) {
      if (seq === state.usernameSeq) {
        hint.textContent = NC.t('errNetwork');
        hint.className = 'hint bad';
      }
    }
  }

  async function createGroup() {
    const title = els.groupTitle.value.trim();
    const username = els.groupUsername.value.trim().toLowerCase();
    const description = els.groupDesc.value.trim();
    if (!title || title.length > 64) return toast(X('groupNeedTitle'));
    if (!USERNAME_RE.test(username)) return toast(X('groupBadUsername'));
    try {
      const { chatId } = await NC.api('POST', '/api/chats/groups', {
        title: title,
        username: username,
        description: description,
      });
      resetGroupForm();
      closeSheet();
      await loadChats(true);
      openChat(chatId);
    } catch (err) {
      toast(errorText(err));
    }
  }

  // ----- Информация о группе -----

  function clearGroupInfo() {
    els.groupInfoAvatar.innerHTML = '';
    els.groupInfoTitle.textContent = '';
    els.groupInfoSub.textContent = '';
    els.groupInfoDesc.hidden = true;
    els.groupJoinBtn.hidden = true;
    els.groupAddWrap.hidden = true;
    els.groupLeaveBtn.hidden = true;
    els.groupDeleteBtn.hidden = true;
    els.groupMembers.innerHTML = '';
  }

  function memberHtml(m, g) {
    const self = m.id === state.me.id;
    const isMod = g.myRole === 'owner' || g.myRole === 'admin';
    let roleTag = '';
    if (m.role === 'owner') roleTag = '<span class="tag">' + NC.esc(X('roleOwner')) + '</span>';
    else if (m.role === 'admin') roleTag = '<span class="tag">' + NC.esc(X('roleAdmin')) + '</span>';
    const selfTag = self ? '<span class="tag">' + NC.esc(X('you')) + '</span>' : '';

    let actions = '';
    if (!self && m.role !== 'owner') {
      if (isMod) {
        actions += '<button class="mini-btn danger" type="button" data-act="remove" data-id="' + m.id + '">' +
          NC.esc(X('remove')) + '</button>';
      }
      if (g.myRole === 'owner') {
        actions += m.role === 'admin'
          ? '<button class="mini-btn" type="button" data-act="unadmin" data-id="' + m.id + '">' + NC.esc(X('unAdmin')) + '</button>'
          : '<button class="mini-btn" type="button" data-act="admin" data-id="' + m.id + '">' + NC.esc(X('makeAdmin')) + '</button>';
      }
    }

    return '<li class="member-row" data-id="' + m.id + '">' +
      NC.avatarHtml(m, 'avatar-md') +
      '<div class="chat-meta">' +
      '<div class="chat-name"><span class="truncate">' + NC.esc(m.displayName) + '</span>' +
      (m.isVerified ? NC.verifiedHtml() : '') + roleTag + selfTag + '</div>' +
      '<div class="chat-preview">@' + NC.esc(m.username) + '</div>' +
      (actions ? '<div class="row-actions">' + actions + '</div>' : '') +
      '</div>' +
      '</li>';
  }

  function renderGroupInfo(g) {
    state.groupFull = g;
    els.groupInfoAvatar.innerHTML = NC.avatarHtml({ displayName: g.title, username: g.username }, 'avatar-xl');
    els.groupInfoTitle.textContent = g.title;
    els.groupInfoSub.textContent = membersText(g.memberCount) + ' · @' + g.username;
    els.groupInfoDesc.hidden = !g.description;
    els.groupInfoDesc.textContent = g.description || '';
    const isMod = g.myRole === 'owner' || g.myRole === 'admin';
    els.groupJoinBtn.hidden = true;
    els.groupAddWrap.hidden = !isMod;
    els.groupLeaveBtn.hidden = g.myRole === 'owner';
    els.groupDeleteBtn.hidden = g.myRole !== 'owner';
    els.groupMembers.innerHTML = g.members.map((m) => memberHtml(m, g)).join('');
  }

  async function refreshGroupInfo(chatId) {
    try {
      const { group } = await NC.api('GET', '/api/chats/' + chatId);
      if (state.groupCardId === chatId) renderGroupInfo(group);
    } catch (err) {
      toast(errorText(err));
    }
  }

  async function openGroupInfo(chatId) {
    state.groupCardId = chatId;
    state.groupFull = null;
    clearGroupInfo();
    openSheet('groupInfo');
    try {
      const { group } = await NC.api('GET', '/api/chats/' + chatId);
      if (state.groupCardId === chatId) renderGroupInfo(group);
    } catch (err) {
      toast(errorText(err));
    }
  }

  function openGroupPreview(card) {
    if (!card) return;
    if (card.isMember) return openGroupInfo(card.id);
    state.groupCardId = card.id;
    state.groupFull = null;
    clearGroupInfo();
    els.groupInfoAvatar.innerHTML = NC.avatarHtml({ displayName: card.title, username: card.username }, 'avatar-xl');
    els.groupInfoTitle.textContent = card.title;
    els.groupInfoSub.textContent = membersText(card.memberCount) + ' · @' + card.username;
    els.groupInfoDesc.hidden = !card.description;
    els.groupInfoDesc.textContent = card.description || '';
    els.groupJoinBtn.hidden = false;
    openSheet('groupInfo');
  }

  // ----- Сокет -----

  function connectSocket() {
    if (typeof window.io !== 'function') return;
    const socket = window.io({ auth: { token: NC.getToken() } });
    state.socket = socket;

    let connectedBefore = false;
    socket.on('connect', () => {
      if (connectedBefore) {
        scheduleListRefresh();
        syncCurrentChat();
      }
      connectedBefore = true;
    });
    socket.on('connect_error', (err) => {
      if (err && err.message === 'unauthorized') forceLogout(null);
    });
    socket.on('account:frozen', (data) => {
      forceLogout({ code: 'frozen', reason: (data && data.reason) || '' });
    });
    socket.on('account:deleted', () => forceLogout(null));
    socket.on('message:new', (m) => {
      appendMessage(m);
      scheduleListRefresh();
    });
    socket.on('message:updated', (m) => {
      replaceMessage(m);
      scheduleListRefresh();
    });
    socket.on('message:removed', (data) => {
      if (data.chatId === state.currentChatId) removeMessageLocal(data.id);
      scheduleListRefresh();
    });
    socket.on('chat:read', applyRead);
    socket.on('chat:meta', (data) => {
      if (data && data.chatId === state.currentChatId) refreshMeta();
    });
    socket.on('chats:changed', () => {
      scheduleListRefresh();
      if (state.currentChatId) refreshMeta();
    });
  }

  // ----- Подписи и язык -----

  function applyLabels() {
    document.querySelectorAll('[data-x]').forEach((n) => {
      n.textContent = X(n.dataset.x);
    });
    document.querySelectorAll('[data-x-placeholder]').forEach((n) => {
      n.placeholder = X(n.dataset.xPlaceholder);
    });
    document.querySelectorAll('[data-xicon]').forEach((n) => {
      n.innerHTML = xIcon(n.dataset.xicon, Number(n.dataset.iconSize) || 22);
    });
  }

  function onLangChange() {
    applyLabels();
    if (!state.me) return;
    renderSettings();
    renderChatList();
    const chat = currentChat();
    if (chat) renderChatHeader(chat);
    renderPinned();
    renderTabAction();
    if (state.messages.length) rerenderMessages();
    if (state.openSheet === 'profile' && state.profileUser && !state.profileEditable) {
      renderProfile(state.profileUser, false);
    }
    if (state.openSheet === 'groupInfo' && state.groupFull) {
      renderGroupInfo(state.groupFull);
    }
  }

  // ----- События -----

  function bindEvents() {
    els.settingsBtn.addEventListener('click', () => {
      renderSettings();
      openSheet('settings');
    });
    els.newChatBtn.addEventListener('click', () => {
      els.userSearch.value = '';
      renderUserResults([], []);
      openSheet('newChat');
    });
    els.createGroupBtn.addEventListener('click', () => {
      resetGroupForm();
      openSheet('group');
    });
    els.backdrop.addEventListener('click', closeSheet);
    document.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', closeSheet));
    document.querySelectorAll('[data-back]').forEach((btn) => {
      btn.addEventListener('click', () => openSheet(btn.dataset.back));
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeSheet();
        closeMenus();
      }
    });
    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('.ctx-menu')) closeMenus();
    });

    els.settingsSheet.querySelector('.sheet-body').addEventListener('click', onSettingsRowClick);
    els.lastSeenToggle.addEventListener('change', onLastSeenToggle);
    els.profileCard.addEventListener('click', (e) => {
      if (e.target.closest('[data-photo]')) els.avatarInput.click();
      else if (e.target.closest('.profile-card-main')) openProfile(state.me, true, 'settings');
    });
    els.avatarEdit.addEventListener('click', () => els.avatarInput.click());
    els.avatarInput.addEventListener('change', () => {
      const file = els.avatarInput.files[0];
      els.avatarInput.value = '';
      if (file) uploadAvatar(file);
    });
    els.profileBack.addEventListener('click', () => openSheet(BACK_TARGETS[state.profileOrigin] || 'settings'));
    els.profileWrite.addEventListener('click', () => {
      const u = state.profileUser;
      if (u && u.username) startChatWith(u.username);
    });
    els.tabGifts.addEventListener('click', () => setProfileTab('gifts'));
    els.tabPosts.addEventListener('click', () => setProfileTab('posts'));
    els.tabAction.addEventListener('click', () => {
      if (state.profileTab === 'gifts') openSheet('collection');
      else openSheet('archive');
    });
    els.collectionCreate.addEventListener('click', createCollection);
    els.themeSeg.addEventListener('click', onThemeClick);
    els.langSeg.addEventListener('click', onLangClick);
    els.logoutBtn.addEventListener('click', logout);
    els.profileForm.addEventListener('submit', saveProfile);
    els.profileBio.addEventListener('click', (e) => {
      const mention = e.target.closest('.mention');
      if (!mention) return;
      e.preventDefault();
      openProfileByUsername(mention.dataset.mention);
    });

    els.listSearch.addEventListener('input', renderChatList);
    els.chatList.addEventListener('click', (e) => {
      if (suppressChatClick) {
        suppressChatClick = false;
        return;
      }
      const item = e.target.closest('.chat-item');
      if (item) openChat(Number(item.dataset.chatId));
    });
    els.chatList.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const item = e.target.closest('.chat-item');
      if (item) openChat(Number(item.dataset.chatId));
    });
    els.chatList.addEventListener('contextmenu', (e) => {
      const item = e.target.closest('.chat-item');
      if (!item) return;
      e.preventDefault();
      openChatContext(Number(item.dataset.chatId), e.clientX, e.clientY);
    });
    els.chatList.addEventListener('touchstart', (e) => {
      const item = e.target.closest('.chat-item');
      if (!item) return;
      const touch = e.touches[0];
      clearTimeout(chatPressTimer);
      chatPressTimer = setTimeout(() => {
        suppressChatClick = true;
        setTimeout(() => { suppressChatClick = false; }, 600);
        openChatContext(Number(item.dataset.chatId), touch.clientX, touch.clientY);
      }, 450);
    }, { passive: true });
    ['touchend', 'touchmove', 'touchcancel'].forEach((name) => {
      els.chatList.addEventListener(name, () => clearTimeout(chatPressTimer), { passive: true });
    });
    els.chatCtxHide.addEventListener('click', () => chatCtxAction('hide'));
    els.chatCtxBlock.addEventListener('click', () => {
      const chat = state.chats.find((c) => c.id === state.ctxChatId);
      const blockedByMe = Boolean(chat && chat.blocked && chat.blocked.byMe);
      chatCtxAction(blockedByMe ? 'unblock' : 'block');
    });
    els.chatCtxLeave.addEventListener('click', () => chatCtxAction('leave'));
    els.listStatus.addEventListener('click', () => location.reload());

    els.backBtn.addEventListener('click', closeChat);
    els.peerBtn.addEventListener('click', () => {
      const chat = currentChat();
      if (!chat) return;
      if (chat.kind === 'group') openGroupInfo(chat.id);
      else openProfile(chat.peer, false, 'chat');
    });
    els.chatSearchBtn.addEventListener('click', () => {
      els.chatSearchInput.value = '';
      els.chatSearchResults.innerHTML = '';
      els.chatSearchHint.hidden = false;
      els.chatSearchHint.textContent = X('searchHint');
      openSheet('search');
    });
    els.chatSearchInput.addEventListener('input', runChatSearch);
    els.chatSearchResults.addEventListener('click', (e) => {
      const hit = e.target.closest('[data-message-id]');
      if (!hit) return;
      closeSheet();
      scrollToMessage(Number(hit.dataset.messageId));
    });
    els.pinnedOpen.addEventListener('click', () => {
      if (state.meta && state.meta.pinned) scrollToMessage(state.meta.pinned.id);
    });
    els.pinnedUnpin.addEventListener('click', async () => {
      if (!state.currentChatId) return;
      try {
        await NC.api('DELETE', '/api/chats/' + state.currentChatId + '/pin');
        refreshMeta();
      } catch (err) {
        toast(errorText(err));
      }
    });
    els.replyClose.addEventListener('click', () => {
      state.replyTo = null;
      renderReplyBar();
    });
    els.toBottom.addEventListener('click', jumpToLatest);

    els.messages.addEventListener('scroll', onMessagesScroll, { passive: true });
    els.messages.addEventListener('click', (e) => {
      const mention = e.target.closest('.mention');
      if (mention) {
        e.preventDefault();
        return openProfileByUsername(mention.dataset.mention);
      }
      const quote = e.target.closest('.quote');
      if (quote) return scrollToMessage(Number(quote.dataset.scroll));
      if (e.target.closest('.load-all')) return loadAll();
      const chip = e.target.closest('.reaction-chip');
      if (chip) return toggleReaction(Number(chip.dataset.messageId), chip.dataset.react);
      const card = e.target.closest('.file-card');
      if (card) return downloadFile(Number(card.dataset.fileId), card.dataset.name);
      const img = e.target.closest('.msg-img');
      if (img && img.dataset.fileId) openImage(Number(img.dataset.fileId));
    });
    els.messages.addEventListener('contextmenu', (e) => {
      const row = e.target.closest('.msg');
      if (!row) return;
      e.preventDefault();
      openContextMenu(Number(row.dataset.id), e.clientX, e.clientY);
    });
    els.messages.addEventListener('touchstart', (e) => {
      const row = e.target.closest('.msg');
      if (!row) return;
      const touch = e.touches[0];
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => openContextMenu(Number(row.dataset.id), touch.clientX, touch.clientY), 450);
    }, { passive: true });
    ['touchend', 'touchmove', 'touchcancel'].forEach((name) => {
      els.messages.addEventListener(name, () => clearTimeout(pressTimer), { passive: true });
    });

    els.ctxReactions.addEventListener('click', (e) => {
      const more = e.target.closest('[data-more]');
      if (more) {
        els.ctxMore.hidden = !els.ctxMore.hidden;
        return;
      }
      const btn = e.target.closest('[data-emoji]');
      const msg = state.ctxMessage;
      if (!btn || !msg) return;
      closeMenus();
      toggleReaction(msg.id, btn.dataset.emoji);
    });
    els.ctxMore.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-emoji]');
      const msg = state.ctxMessage;
      if (!btn || !msg) return;
      closeMenus();
      toggleReaction(msg.id, btn.dataset.emoji);
    });
    els.ctxReply.addEventListener('click', startReply);
    els.ctxCopy.addEventListener('click', () => {
      const msg = state.ctxMessage;
      closeMenus();
      if (msg && msg.text) copyText(msg.text);
    });
    els.ctxForward.addEventListener('click', () => {
      const msg = state.ctxMessage;
      closeMenus();
      if (msg) openForward(msg.id);
    });
    els.ctxPin.addEventListener('click', togglePinFromMenu);
    els.ctxDeleteMe.addEventListener('click', () => deleteFromMenu('me'));
    els.ctxDeleteAll.addEventListener('click', () => deleteFromMenu('all'));

    els.forwardList.addEventListener('click', async (e) => {
      const btn = e.target.closest('.user-item');
      if (!btn || !state.forwardMessageId) return;
      try {
        await NC.api('POST', '/api/chats/' + Number(btn.dataset.chatId) + '/forward', {
          messageId: state.forwardMessageId,
        });
        closeSheet();
        toast(X('forwarded'));
        scheduleListRefresh();
      } catch (err) {
        toast(errorText(err));
      }
    });

    els.composer.addEventListener('submit', sendMessage);
    els.messageInput.addEventListener('input', autoGrow);
    els.messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && fineInput) {
        e.preventDefault();
        els.composer.requestSubmit();
      }
    });
    els.attachBtn.addEventListener('click', () => els.fileInput.click());
    els.fileInput.addEventListener('change', onFilePicked);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && state.currentChatId) markRead(state.currentChatId);
    });

    els.userSearch.addEventListener('input', searchUsers);
    // Нажатие на найденного человека открывает его профиль с кнопкой «Написать»
    els.userResults.addEventListener('click', (e) => {
      const groupBtn = e.target.closest('[data-group-id]');
      if (groupBtn) return openGroupPreview(state.groupResults.get(Number(groupBtn.dataset.groupId)));
      const userBtn = e.target.closest('[data-username]');
      if (!userBtn) return;
      const user = state.userResultMap.get(userBtn.dataset.username);
      if (user) openProfile(user, false, 'newChat');
    });

    els.groupUsername.addEventListener('input', checkGroupUsername);
    els.groupCreate.addEventListener('click', createGroup);

    els.groupMembers.addEventListener('click', async (e) => {
      const row = e.target.closest('.member-row');
      const chatId = state.groupCardId;
      if (!row || !chatId) return;
      const userId = Number(row.dataset.id);
      const actBtn = e.target.closest('[data-act]');
      if (!actBtn) {
        const member = state.groupFull && state.groupFull.members.find((x) => x.id === userId);
        if (member) openProfile(member, false, 'groupInfo');
        return;
      }
      const act = actBtn.dataset.act;
      try {
        if (act === 'remove') {
          if (!window.confirm(X('confirmRemove'))) return;
          await NC.api('DELETE', '/api/chats/' + chatId + '/members/' + userId);
        } else if (act === 'admin' || act === 'unadmin') {
          await NC.api('POST', '/api/chats/' + chatId + '/members/' + userId + '/role', {
            role: act === 'admin' ? 'admin' : 'member',
          });
        }
        toast(X('done'));
        await refreshGroupInfo(chatId);
        scheduleListRefresh();
      } catch (err) {
        toast(errorText(err));
      }
    });

    els.groupAddBtn.addEventListener('click', async () => {
      const username = els.groupAddInput.value.trim().toLowerCase();
      const chatId = state.groupCardId;
      if (!username || !chatId) return;
      try {
        await NC.api('POST', '/api/chats/' + chatId + '/members', { username: username });
        els.groupAddInput.value = '';
        toast(X('added'));
        await refreshGroupInfo(chatId);
        scheduleListRefresh();
      } catch (err) {
        toast(errorText(err));
      }
    });

    els.groupJoinBtn.addEventListener('click', async () => {
      const chatId = state.groupCardId;
      if (!chatId) return;
      try {
        const { chatId: joined } = await NC.api('POST', '/api/chats/' + chatId + '/join');
        closeSheet();
        await loadChats(true);
        toast(X('joined'));
        openChat(joined);
      } catch (err) {
        toast(errorText(err));
      }
    });

    els.groupLeaveBtn.addEventListener('click', async () => {
      const chatId = state.groupCardId;
      if (!chatId || !window.confirm(X('confirmLeave'))) return;
      try {
        await NC.api('POST', '/api/chats/' + chatId + '/leave');
        closeSheet();
        if (state.currentChatId === chatId) closeChat();
        await loadChats(true);
        toast(X('left'));
      } catch (err) {
        toast(errorText(err));
      }
    });

    els.groupDeleteBtn.addEventListener('click', async () => {
      const chatId = state.groupCardId;
      if (!chatId || !window.confirm(X('confirmDeleteGroup'))) return;
      try {
        await NC.api('DELETE', '/api/chats/' + chatId);
        closeSheet();
        if (state.currentChatId === chatId) closeChat();
        await loadChats(true);
        toast(NC.t('saved'));
      } catch (err) {
        toast(errorText(err));
      }
    });
  }

  // ----- Запуск -----

  async function boot() {
    if (!NC.getToken()) {
      NC.leaveTo('index.html');
      return;
    }
    try {
      const { user } = await NC.api('GET', '/api/users/me');
      state.me = user;
    } catch (err) {
      if (!state.loaded) {
        els.chatList.innerHTML = '';
        els.chatList.hidden = true;
      }
      showListStatus(errorText(err));
      return;
    }
    NC.setTheme(state.me.theme);
    NC.setLang(state.me.language);
    renderSettings();
    connectSocket();
    await loadChats(false);
  }

  function init() {
    ensureReportUi();
    applyLabels();
    NC.on('lang', onLangChange);
    bindEvents();
    showSkeleton();
    autoGrow();
    setInterval(() => {
      if (state.currentChatId) refreshMeta();
    }, 30000);
    boot();
  }

  init();
})();