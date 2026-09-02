/**
 * Состояния пользователя, права и CTA. Не содержит секретов и полного текста треков.
 */
(function (root) {
  'use strict';
  var api = root.MLMA;
  if (!api) return;

  var GROUPS = ['FREE', 'START', 'FULL', 'PILOT', 'ADMIN'];
  var MEMBER_ALIAS = { Member: 'FREE', Guest: 'guest', Editor: 'ADMIN' };
  var PARTNER_ROLES = ['novice', 'partner', 'leader'];
  var PARTNER_ROLE_LABELS = { novice: 'Новичок', partner: 'Партнёр', leader: 'Лидер' };
  var EXPERIENCE = ['none', 'under_year', 'one_three', 'three_plus'];
  var TIME_BUDGET = ['15', '30', '60', 'more'];
  var PRODUCTS = [];

  function readCookie(name) {
    try {
      var parts = String(document.cookie || '').split(';');
      for (var i = 0; i < parts.length; i += 1) {
        var row = parts[i].replace(/^\s+/, '');
        if (row.indexOf(name + '=') === 0) return decodeURIComponent(row.slice(name.length + 1));
      }
    } catch (err) {
      /* ignore */
    }
    return '';
  }

  function membersProfileKey() {
    var pid = '23906986';
    try {
      var rec = typeof document !== 'undefined' ? document.getElementById('allrecords') : null;
      if (rec && rec.getAttribute('data-tilda-project-id')) pid = rec.getAttribute('data-tilda-project-id');
    } catch (err) {
      /* ignore */
    }
    return 'tilda_members_profile' + pid;
  }

  function readMembersSession() {
    var out = {
      loggedIn: false,
      maId: '',
      email: '',
      name: '',
      phone: '',
      groups: [],
      source: 'none',
    };
    try {
      if (typeof window !== 'undefined' && window.mauser && (window.mauser.email || window.mauser.name)) {
        out.email = String(window.mauser.email || window.mauser.login || '').trim();
        out.name = String(window.mauser.name || '').trim();
        out.phone = String(window.mauser.phone || '').trim();
        out.maId = String(window.mauser.uid || window.mauser.id || window.mauser.userid || '').trim();
        out.source = 'mauser';
      }
    } catch (err) {
      /* ignore */
    }
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        var raw = window.localStorage.getItem(membersProfileKey());
        if (raw) {
          var parsed = JSON.parse(raw);
          out.email = out.email || String(parsed.login || parsed.email || '').trim();
          out.name = out.name || String(parsed.name || '').trim();
          out.phone = out.phone || String(parsed.phone || '').trim();
          out.maId = out.maId || String(parsed.id || parsed.uid || parsed.userid || '').trim();
          out.source = out.source === 'none' ? 'tilda_profile' : out.source;
        }
      }
    } catch (err) {
      /* ignore */
    }
    out.email = out.email || readCookie('ma_email') || '';
    out.name = out.name || readCookie('ma_name') || '';
    out.maId = out.maId || readCookie('ma_id') || '';
    out.loggedIn = !!(out.email || out.maId);
    out.identityLevel = 'tilda_unverified';
    if (out.loggedIn) out.groups = ['FREE'];
    return out;
  }

  function membersLogoutUrl() {
    return '/members/login?exit=y';
  }

  function performMembersLogout(event) {
    if (event && event.preventDefault) event.preventDefault();
    try {
      if (typeof root.tma__userbar__sendLogout === 'function') {
        root.tma__userbar__sendLogout();
        return;
      }
      if (typeof root.tma__sign__sendLogoutWihtRedirect === 'function') {
        root.tma__sign__sendLogoutWihtRedirect();
        return;
      }
    } catch (err) {
      /* fall through to native Tilda URL */
    }
    try {
      var project = '';
      if (root.tildaMembers && root.tildaMembers.settingStyles && root.tildaMembers.settingStyles.projectid) {
        project = String(root.tildaMembers.settingStyles.projectid);
      } else {
        var rec = root.document && root.document.querySelector('[data-tilda-project-id]');
        project = rec ? rec.getAttribute('data-tilda-project-id') || '' : '';
      }
      if (project) {
        root.localStorage.removeItem('tilda_members_profile' + project);
        root.localStorage.removeItem('tilda_members_profile' + project + '_timestamp');
      }
      root.mauser = {};
    } catch (err2) {
      /* ignore */
    }
    root.location.replace('/members/login?exit=y');
  }

  function membersSignupUrl(returnPath) {
    var path = String(returnPath || '/my').replace(/^\//, '');
    if (api.isSignupEnabled && api.isSignupEnabled() !== true) {
      return api.membersLoginUrl(returnPath);
    }
    return '/members/signup?redirecturl=' + encodeURIComponent(path);
  }

  function normalizeAccess(value) {
    if (value === 'public' || value === 'free') return 'public';
    if (value === 'promo') return 'promo';
    if (value === 'paid' || value === 'organization' || value === 'undecided' || !value) return 'paid';
    return 'paid';
  }

  function hasIndexablePromo(track) {
    if (!track) return false;
    var forWhom = track.forWhom || track.audience || '';
    var composition = track.composition || track.outline || '';
    var seoTitle = track.seoTitle || '';
    return !!(
      track.title &&
      track.situation &&
      track.outcome &&
      forWhom &&
      composition &&
      seoTitle
    );
  }

  function deriveSeoStatus(track) {
    if (!track) return 'noindex';
    if (track.seoStatus === 'index' || track.seoStatus === 'noindex') return track.seoStatus;
    var pub = track.publicationStatus;
    if (pub === 'planned' || pub === 'draft' || pub === 'review' || !pub) return 'noindex';
    if ((pub === 'promo' || pub === 'published') && hasIndexablePromo(track)) return 'index';
    return 'noindex';
  }

  function accountId(account) {
    if (!account) return '';
    return account.maId || account.email || '';
  }

  function isVerifiedAccount(account) {
    return !!(account && account.identityLevel === 'verified');
  }

  function activeEntitlements(account, now) {
    if (!isVerifiedAccount(account)) return [];
    now = now || Date.now();
    var list = (account && account.entitlements) || [];
    var out = [];
    for (var i = 0; i < list.length; i += 1) {
      var item = list[i];
      if (!item || item.status === 'revoked' || item.status === 'expired') continue;
      if (item.expiresAt && Date.parse(item.expiresAt) <= now) continue;
      out.push(item);
    }
    return out;
  }

  function resolveUserState(account, now) {
    if (!account || !account.loggedIn) return 'guest';
    if (!isVerifiedAccount(account)) return 'registered';
    var active = activeEntitlements(account, now);
    if (active.length) return 'paid';
    var all = (account.entitlements || []).slice();
    for (var i = 0; i < all.length; i += 1) {
      if (all[i] && (all[i].status === 'expired' || all[i].status === 'revoked' || (all[i].expiresAt && Date.parse(all[i].expiresAt) <= (now || Date.now())))) {
        return 'expired';
      }
    }
    return 'registered';
  }

  function hasGroup(account, group) {
    if (group === 'START' || group === 'FULL' || group === 'PILOT' || group === 'ADMIN') {
      if (!isVerifiedAccount(account)) return false;
    }
    var groups = (account && account.groups) || [];
    var alias = MEMBER_ALIAS[group] || group;
    for (var i = 0; i < groups.length; i += 1) {
      var name = groups[i];
      if (name === group || name === alias || MEMBER_ALIAS[name] === group) return true;
    }
    if (group === 'FREE' && account && account.loggedIn) return true;
    return false;
  }

  function isEntitledToTrack(track, account, now) {
    if (!track) return false;
    var access = normalizeAccess(track.access);
    if (access === 'public' || access === 'promo') return true;
    if (track.publicationStatus !== 'published' && track.publicationStatus !== 'promo') {
      return hasGroup(account, 'ADMIN') || hasGroup(account, 'PILOT');
    }
    if (!account || !account.loggedIn) return false;
    if (!isVerifiedAccount(account)) return false;
    if (hasGroup(account, 'ADMIN') || hasGroup(account, 'FULL') || hasGroup(account, 'PILOT')) return true;
    var active = activeEntitlements(account, now);
    for (var i = 0; i < active.length; i += 1) {
      var item = active[i];
      if (item.productId === 'full' || item.group === 'FULL') return true;
      if (item.productId === 'start' || item.group === 'START') {
        if (track.sectionId === 'A1' || track.sectionId === 'A2' || track.sectionId === 'A3') return true;
      }
      if (item.trackId && item.trackId === track.trackId) return true;
    }
    return false;
  }

  function canOpenTrackBody(track, account) {
    if (!track) return false;
    if (api.SIGNUP_ENABLED === undefined) {
      /* keep */
    }
    if (account && account.loggedIn && !(api.PAYMENTS_ENABLED === true)) return true;
    var view = api.getTrackStatusView(track, { entitled: isEntitledToTrack(track, account) });
    return !!view.canStart && isEntitledToTrack(track, account);
  }

  function cardAction(track, account, runtime) {
    var state = resolveUserState(account);
    var entitled = isEntitledToTrack(track, account);
    var view = api.getTrackStatusView(track, { entitled: entitled });
    var access = normalizeAccess(track.access);
    if (state === 'expired' && access === 'paid') {
      return { key: 'renew', label: 'Как будет устроен доступ', href: '/pricing' };
    }
    if (!account || !account.loggedIn) {
      if (access === 'public' || access === 'promo' || track.publicationStatus === 'promo') {
        return {
          key: 'login_save',
          label: view.canStart ? 'Войти, чтобы сохранить' : 'Открыть описание',
          href: view.canStart ? api.membersLoginUrl('/track?id=' + String(track.trackId).toLowerCase()) : api.routes().track(track.trackId),
        };
      }
      return {
        key: 'login_start',
        label: 'Войти и пройти трек',
        href: api.membersLoginUrl('/track?id=' + String(track.trackId).toLowerCase()),
      };
    }
    if (runtime && runtime.status && runtime.status !== 'preview' && entitled) {
      return { key: 'continue', label: 'Продолжить', href: api.routes().track(track.trackId) };
    }
    if (entitled && (access === 'paid' || hasGroup(account, 'START') || hasGroup(account, 'FULL'))) {
      return { key: 'in_pack', label: view.canStart ? 'Входит в ваш пакет' : 'Открыть описание', href: api.routes().track(track.trackId) };
    }
    if (access === 'public' || access === 'promo' || track.publicationStatus === 'promo') {
      return { key: 'open_free', label: 'Открыть бесплатно', href: api.routes().track(track.trackId) };
    }
    if (!entitled && access === 'paid' && account && account.loggedIn && api.PAYMENTS_ENABLED !== true) {
      if (track.publicationStatus === 'published' || track.contentStatus === 'published' || track.contentStatus === 'complete') {
        return {
          key: 'beta_start',
          label: 'Начать трек',
          href: api.routes().track(track.trackId),
        };
      }
    }
    if (!entitled && access === 'paid') {
      return {
        key: 'preparing',
        label: view.cta || 'Открыть описание',
        href: api.routes().track(track.trackId),
      };
    }
    return { key: 'open', label: view.cta || 'Открыть описание', href: api.routes().track(track.trackId) };
  }

  function onboardingComplete(profile) {
    if (!profile) return false;
    if (profile.onboardingComplete) return true;
    return !!(profile.displayName && profile.partnerRole && profile.consentAt);
  }

  function recommendedAction(input) {
    var account = input.account;
    var profile = input.profile || api.getProfile();
    var tracks = input.tracks || [];
    var state = resolveUserState(account);
    if (state === 'guest') {
      if (api.isSignupEnabled && api.isSignupEnabled() === true) {
        return { kind: 'signup', title: 'Создайте бесплатный кабинет', why: 'Так можно сохранить маршрут и вернуться к нему с другого устройства.', href: membersSignupUrl('/my'), cta: 'Зарегистрироваться' };
      }
      return {
        kind: 'signup_paused',
        title: 'Регистрация временно закрыта',
        why: 'Новые кабинеты не создаём, пока не будет можно собирать персональные данные. Каталог, документы и вход в уже существующий кабинет работают как раньше.',
        href: api.membersLoginUrl('/my'),
        cta: 'Войти',
        secondary: { href: '/academy', label: 'Смотреть каталог' },
      };
    }
    if (!onboardingComplete(profile)) {
      return { kind: 'onboarding', title: 'Короткая настройка — две минуты', why: 'Имя, роль и текущая задача нужны, чтобы показать первый шаг. Необязательные вопросы можно пропустить.', href: '/profile?setup=1', cta: 'Заполнить профиль' };
    }
    if (state === 'expired') {
      return { kind: 'renew', title: 'Доступ закончился', why: 'Профиль, история и результаты на месте. Платные треки готовятся к запуску.', href: '/pricing', cta: 'Смотреть условия' };
    }
    if (account && account.loggedIn && account.cabinet && account.cabinet.nextStep) {
      var next = account.cabinet.nextStep;
      return {
        kind: next.kind || 'open_track',
        title: next.title,
        why: next.why || 'Почему это сейчас',
        href: next.href,
        cta: next.cta || 'Продолжить',
        trackId: next.trackId,
      };
    }
    if (!(profile.savedTrackIds && profile.savedTrackIds.length)) {
      return {
        kind: 'empty_route',
        title: 'Ваш маршрут пока пуст. Опишите ситуацию — мы подберём первый полезный трек.',
        why: 'Одно действие сейчас важнее длинного списка курсов.',
        href: '/start',
        cta: 'Подобрать трек',
        secondary: { href: '/library', label: 'Открыть библиотеку' },
      };
    }
    var next = api.resolveNextAction({ profile: profile, tracks: tracks });
    if (next.kind === 'open_track' && next.track) {
      var action = cardAction(next.track, account);
      return {
        kind: 'open_track',
        track: next.track,
        title: next.track.title,
        why: 'Это следующее действие по вашей задаче.',
        href: action.href,
        cta: action.label,
      };
    }
    if (state === 'registered') {
      return { kind: 'choose', title: 'Выберите ситуацию или откройте доступ', why: 'Бесплатный кабинет уже есть. Можно сохранить маршрут. Платные треки готовятся к запуску.', href: '/start', cta: 'Выбрать ситуацию', secondary: { href: '/pricing', label: 'Смотреть условия' } };
    }
    return { kind: 'choose', title: 'Выберите ситуацию, в которой сейчас застряли', why: 'Один ответ определит раздел и первый шаг.', href: '/start', cta: 'Выбрать ситуацию' };
  }

  api.GROUPS = GROUPS;
  api.isVerifiedAccount = isVerifiedAccount;
  api.PRODUCTS = PRODUCTS;
  api.PARTNER_ROLES = PARTNER_ROLES;
  api.PARTNER_ROLE_LABELS = PARTNER_ROLE_LABELS;
  api.EXPERIENCE = EXPERIENCE;
  api.TIME_BUDGET = TIME_BUDGET;
  api.readMembersSession = readMembersSession;
  api.membersLogoutUrl = membersLogoutUrl;
  api.performMembersLogout = performMembersLogout;
  api.membersSignupUrl = membersSignupUrl;
  api.normalizeAccess = normalizeAccess;
  api.deriveSeoStatus = deriveSeoStatus;
  api.hasIndexablePromo = hasIndexablePromo;
  api.accountId = accountId;
  api.activeEntitlements = activeEntitlements;
  api.resolveUserState = resolveUserState;
  api.hasGroup = hasGroup;
  api.isEntitledToTrack = isEntitledToTrack;
  api.canOpenTrackBody = canOpenTrackBody;
  api.cardAction = cardAction;
  api.onboardingComplete = onboardingComplete;
  api.recommendedAction = recommendedAction;

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
