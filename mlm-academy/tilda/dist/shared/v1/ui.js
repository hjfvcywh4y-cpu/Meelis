/**
 * Оболочка MLM Academy: рендер страниц Tilda из очищенного каталога.
 * Зависит от MLMA (domain.js). Не содержит внутренних полей реестра.
 */
(function (root) {
  'use strict';

  var D = root.MLMA;
  if (!D) return;

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseJsonScripts(prefix) {
    var nodes = [].slice.call(document.querySelectorAll('script[type="application/json"][id^="' + prefix + '"]'));
    nodes.sort(function (a, b) {
      return String(a.id).localeCompare(String(b.id));
    });
    var chunks = [];
    for (var i = 0; i < nodes.length; i += 1) chunks.push(nodes[i].textContent || '');
    if (!chunks.length) return null;
    try {
      return JSON.parse(chunks.join(''));
    } catch (err) {
      return null;
    }
  }

  function readCatalog() {
    if (root.MLMA_PAYLOAD && typeof root.MLMA_PAYLOAD === 'object') {
      return normalizePayload(root.MLMA_PAYLOAD);
    }
    var payload = parseJsonScripts('mlma-data');
    if (!payload) payload = parseJsonScripts('mlma-tracks');
    return normalizePayload(payload);
  }

  function normalizePayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return { tracks: [], sections: [], rules: null, pilot: null, config: {} };
    }
    return {
      tracks: D.toPublicList(payload.tracks || payload),
      sections: Array.isArray(payload.sections) ? payload.sections : [],
      rules: payload.rules || null,
      pilot: payload.pilot || null,
      config: payload.config || {},
      products: payload.products || null,
    };
  }

  function currentPage(rootEl) {
    return (rootEl.getAttribute('data-mlma-page') || '').trim();
  }

  function queryParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name) || '';
    } catch (err) {
      return '';
    }
  }

  function pathName() {
    return (window.location.pathname || '/').replace(/\/+$/, '') || '/';
  }

  function isActivePath(pathname, href) {
    var parts = href.split('?');
    var clean = parts[0];
    var hrefTab = '';
    try {
      hrefTab = new URLSearchParams(parts[1] || '').get('tab') || '';
    } catch (err) {
      hrefTab = '';
    }
    if (clean === '/academy') return pathname === '/academy' || pathname === '/';
    if (clean === '/library') return pathname === '/library' || pathname.indexOf('/library/') === 0;
    if (clean === '/my' && !hrefTab) return pathname === '/my';
    if (clean === '/my/route') {
      var currentTab = '';
      try {
        currentTab = new URLSearchParams(window.location.search).get('tab') || '';
      } catch (err2) {
        currentTab = '';
      }
      if (hrefTab) return pathname === '/my/route' && currentTab === hrefTab;
      return pathname === '/my/route' && !currentTab;
    }
    return pathname === clean || pathname.indexOf(clean + '/') === 0;
  }

  function badge(label, tone) {
    return (
      '<span class="mlma-badge"><span class="mlma-dot mlma-dot-' +
      esc(tone || 'neutral') +
      '" aria-hidden="true"></span>' +
      esc(label) +
      '</span>'
    );
  }

  function crumbs(items, R) {
    var html = '<nav class="mlma-crumbs" aria-label="Навигация по разделам">';
    for (var i = 0; i < items.length; i += 1) {
      if (i) html += '<span aria-hidden="true">/</span>';
      if (items[i].href) html += '<a href="' + esc(items[i].href) + '">' + esc(items[i].label) + '</a>';
      else html += '<span>' + esc(items[i].label) + '</span>';
    }
    return html + '</nav>';
  }

  function pageHead(opts, R) {
    return (
      '<div class="mlma-pagehead"><div class="mlma-wrap" style="padding-top:32px;padding-bottom:40px">' +
      (opts.crumbs ? '<div style="margin-bottom:24px">' + crumbs(opts.crumbs, R) + '</div>' : '') +
      '<span class="mlma-eyebrow mlma-eyebrow-dark">' +
      esc(opts.eyebrow) +
      '</span><div class="mlma-split" style="margin-top:20px;align-items:end">' +
      '<div style="max-width:900px"><h1 class="mlma-h1">' +
      esc(opts.title) +
      '</h1>' +
      (opts.lead ? '<p class="mlma-lead mlma-muted" style="margin-top:20px;max-width:760px">' + esc(opts.lead) + '</p>' : '') +
      '</div>' +
      (opts.aside || '') +
      '</div></div></div>'
    );
  }

  function emptyState(opts) {
    return (
      '<div class="' +
      (opts.blueprint ? 'mlma-blueprint' : 'mlma-card') +
      '" style="padding:40px 24px;text-align:left"><div style="max-width:680px">' +
      (opts.eyebrow ? '<span class="mlma-eyebrow mlma-eyebrow-dark">' + esc(opts.eyebrow) + '</span>' : '') +
      '<h2 class="mlma-h2" style="margin-top:20px">' +
      esc(opts.title) +
      '</h2><p class="mlma-lead mlma-muted" style="margin-top:16px">' +
      esc(opts.description) +
      '</p>' +
      (opts.actions ? '<div class="mlma-actions" style="margin-top:28px">' + opts.actions + '</div>' : '') +
      '</div></div>'
    );
  }

  function isCabinetPage(page) {
    return page === 'my' || page === 'route' || page === 'results' || page === 'profile' || page === 'purchases';
  }

  function accountOf(state) {
    return state.account || { loggedIn: false };
  }

  function profileMenu(state) {
    var account = accountOf(state);
    var initial = ((account.name || account.email || 'M').trim().charAt(0) || 'M').toUpperCase();
    var name = account.name || account.email || 'Кабинет';
    if (account.loggedIn) {
      return (
        '<div class="mlma-account">' +
        '<a class="mlma-avatar" href="' +
        esc(state.R.my()) +
        '" id="mlma-login-btn" aria-label="Личный кабинет">' +
        esc(initial) +
        '</a>' +
        '<details class="mlma-account-menu">' +
        '<summary class="mlma-account-name">' +
        esc(name) +
        '</summary>' +
        '<div class="mlma-account-drop">' +
        '<a href="' + esc(state.R.my()) + '">Кабинет</a>' +
        '<a href="' + esc(state.R.profile()) + '">Профиль</a>' +
        '<a href="' + esc((state.R.purchases && state.R.purchases()) || '/my/purchases') + '">Покупки и доступ</a>' +
        '<a href="' +
        esc((state.R.logout && state.R.logout()) || '/members/login?exit=y') +
        '" data-mlma-logout="1">Выйти</a>' +
        '</div></details></div>'
      );
    }
    return (
      '<a class="mlma-avatar mlma-avatar-guest" href="' +
      esc(state.R.my()) +
      '" id="mlma-login-btn" aria-label="Войти в кабинет">Вход</a>'
    );
  }

  function btn(href, label, variant, extraClass) {
    var cls = 'mlma-btn' + (variant ? ' mlma-btn-' + variant : '') + (extraClass ? ' ' + extraClass : '');
    return '<a class="' + cls + '" href="' + esc(href) + '">' + esc(label) + '</a>';
  }

  function navItems(state) {
    var R = state.R;
    var items = [
      { href: R.home(), label: 'Academy' },
      { href: R.library(), label: 'Библиотека' },
      { href: R.pricing ? R.pricing() : '/pricing', label: 'Тарифы' },
      { href: R.start(), label: 'С чего начать' },
      { href: R.about(), label: 'Как создаётся' },
      { href: R.research ? R.research() : '/research/marketing-plan', label: 'Исследование' },
      { href: D.siteHomeUrl(), label: 'Решения для компаний' },
    ];
    if (isCabinetPage(state.page) || (state.page === 'access' && accountOf(state).loggedIn)) {
      items = [
        { href: R.home(), label: 'Academy' },
        { href: R.library(), label: 'Библиотека' },
        { href: R.my(), label: 'Кабинет' },
        { href: (R.purchases && R.purchases()) || '/my/purchases', label: 'Покупки' },
      ];
    }
    return items;
  }

  function header(state) {
    var R = state.R;
    var path = pathName();
    var items = navItems(state);
    var nav = '';
    for (var i = 0; i < items.length; i += 1) {
      nav +=
        '<a class="mlma-nav-link" href="' +
        esc(items[i].href) +
        '"' +
        (isActivePath(path, items[i].href) ? ' aria-current="page"' : '') +
        '>' +
        esc(items[i].label) +
        '</a>';
    }
    return (
      '<a class="mlma-skip" href="#mlma-main">К содержанию</a>' +
      (state.preview
        ? '<div class="mlma-banner"><span class="mlma-meta">Предпросмотр</span> <span class="mlma-meta" style="text-transform:none;font-weight:500"> видны все карточки каталога</span></div>'
        : '') +
      '<header class="mlma-header"><div class="mlma-header-inner">' +
      '<a class="mlma-logo" href="' +
      esc(R.home()) +
      '" aria-label="MLM Academy — на главную"><span class="mlma-mark" aria-hidden="true"></span><span>MLM Academy</span></a>' +
      '<nav class="mlma-nav" aria-label="Основная навигация">' +
      nav +
      '</nav>' +
      '<div class="mlma-header-actions">' +
      '<button type="button" class="mlma-btn mlma-btn-small mlma-btn-ghost mlma-burger" id="mlma-open-menu" aria-expanded="false" aria-controls="mlma-menu">Меню</button>' +
      '<a class="mlma-btn mlma-btn-small mlma-btn-ghost" href="' +
      esc(R.library()) +
      '" id="mlma-search-btn">Поиск</a>' +
      profileMenu(state) +
      '<a class="mlma-btn mlma-btn-small mlma-btn-primary" href="' +
      esc(R.start()) +
      '">Найти свой шаг</a></div></div>' +
      '<div class="mlma-menu" id="mlma-menu" hidden><nav aria-label="Мобильное меню">' +
      nav +
      (accountOf(state).loggedIn
        ? '<a href="' +
          esc((R.logout && R.logout()) || '/members/login?exit=y') +
          '" data-mlma-logout="1">Выйти</a>'
        : '') +
      '</nav></div></header>'
    );
  }

  function footer(state) {
    var R = state.R;
    var groups = [
      {
        title: 'Платформа',
        links: [
          { href: R.home(), label: 'Academy' },
          { href: R.library(), label: 'Библиотека' },
          { href: R.start(), label: 'С чего начать' },
        ],
      },
      {
        title: 'О проекте',
        links: [
          { href: R.research ? R.research() : '/research/marketing-plan', label: 'Исследование' },
          { href: R.about(), label: 'Как создаётся библиотека' },
          { href: D.siteHomeUrl(), label: 'Решения для компаний' },
        ],
      },
      {
        title: 'Доступ',
        links: [
          { href: R.pricing ? R.pricing() : '/pricing', label: 'Тарифы' },
          { href: (R.paymentAndAccess && R.paymentAndAccess()) || '/payment-and-access', label: 'Оплата и доступ' },
          { href: R.my(), label: 'Кабинет' },
        ],
      },
      {
        title: 'Документы',
        links: [
          { href: (R.documents && R.documents()) || '/documents', label: 'Все документы' },
          { href: (R.requisites && R.requisites()) || '/requisites', label: 'Реквизиты' },
          { href: (R.offer && R.offer()) || '/offer', label: 'Оферта' },
        ],
      },
    ];
    var cols = '';
    for (var i = 0; i < groups.length; i += 1) {
      var items = '';
      for (var j = 0; j < groups[i].links.length; j += 1) {
        items += '<li><a href="' + esc(groups[i].links[j].href) + '">' + esc(groups[i].links[j].label) + '</a></li>';
      }
      cols +=
        '<details class="mlma-footer-col">' +
        '<summary>' +
        esc(groups[i].title) +
        '</summary><ul>' +
        items +
        '</ul></details>';
    }
    return (
      '<footer class="mlma-footer"><div class="mlma-wrap mlma-footer-inner">' +
      '<div class="mlma-footer-brand"><p class="mlma-footer-name">MLM Academy</p>' +
      '<p class="mlma-footer-muted">Рабочий навигатор партнёра: ситуация → действие → результат → следующий шаг.</p></div>' +
      '<nav class="mlma-footer-cols" aria-label="Навигация в подвале">' +
      cols +
      '</nav></div></footer>' +
      cookieBannerHtml(state)
    );
  }

  function cookieBannerHtml(state) {
    var href = (state.R.cookies && state.R.cookies()) || '/cookies';
    return (
      '<div class="mlma-cookie" id="mlma-cookie" hidden role="dialog" aria-label="Cookies">' +
      '<p>Мы используем необходимые cookies для входа, безопасности и сохранения маршрута. Необязательная аналитика включается только с вашего разрешения.</p>' +
      '<div class="mlma-cookie-actions">' +
      '<button type="button" class="mlma-btn mlma-btn-small mlma-btn-primary" data-mlma-cookie="necessary">Только необходимые</button>' +
      '<button type="button" class="mlma-btn mlma-btn-small" data-mlma-cookie="analytics">Разрешить аналитику</button>' +
      '<a class="mlma-btn mlma-btn-small" href="' +
      esc(href) +
      '">Настроить</a>' +
      '</div></div>'
    );
  }

  function mobileNav(state) {
    var R = state.R;
    var path = pathName();
    var items;
    if (isCabinetPage(state.page) || (state.page === 'access' && accountOf(state).loggedIn)) {
      items = [
        { href: R.my(), label: 'Главная' },
        { href: R.myRoute(), label: 'Маршрут' },
        { href: R.myTracks(), label: 'Треки' },
        { href: R.profile(), label: 'Ещё' },
      ];
    } else {
      items = [
        { href: R.home(), label: 'Academy' },
        { href: R.library(), label: 'Библиотека' },
        { href: R.start(), label: 'Старт' },
        { href: R.my(), label: accountOf(state).loggedIn ? 'Кабинет' : 'Войти' },
      ];
    }
    var html = '<nav class="mlma-mobile" aria-label="Мобильная навигация">';
    for (var i = 0; i < items.length; i += 1) {
      html +=
        '<a href="' +
        esc(items[i].href) +
        '"' +
        (isActivePath(path, items[i].href) ? ' aria-current="page"' : '') +
        '>' +
        esc(items[i].label) +
        '</a>';
    }
    return html + '</nav>';
  }

  function sectionCard(section, stats, R) {
    var total = stats ? stats.total : 0;
    return (
      '<a class="mlma-card mlma-card-hover mlma-section-card" href="' +
      esc(R.section(section.sectionId)) +
      '" style="' +
      D.styleAttr(section.sectionId) +
      '"><span class="mlma-section-bar" aria-hidden="true"></span>' +
      '<span class="mlma-meta">' +
      esc(section.sectionId) +
      '</span><h3 class="mlma-h3" style="margin-top:16px">' +
      esc(section.shortTitle) +
      '</h3><p class="mlma-muted" style="margin-top:12px;max-width:36ch;font-size:16px;line-height:1.35">' +
      esc(section.entryQuestion) +
      '</p><p style="margin-top:12px;font-size:15px;line-height:1.4">' +
      esc(section.promise) +
      '</p><div style="margin-top:auto;padding-top:20px;display:flex;justify-content:space-between;align-items:end;gap:12px">' +
      '<span class="mlma-meta mlma-muted">' +
      total +
      ' ' +
      D.pluralTracks(total) +
      '</span><span class="mlma-card-cta">Посмотреть направление <span aria-hidden="true">→</span></span></div></a>'
    );
  }

  function whyHtml(why) {
    var text = '';
    if (why && why.text) text = why.text;
    else if (typeof why === 'string') text = why;
    if (!text) return '';
    return '<div class="mlma-why"><p>' + esc(text) + '</p></div>';
  }

  function trackCover(track) {
    var url = (track && track.imageUrl) || (D.sectionCoverUrl ? D.sectionCoverUrl(track && track.sectionId) : '');
    return (
      '<div class="mlma-track-cover-wrap mlma-cover-' +
      esc((track && track.sectionId) || 'A1') +
      '"><img class="mlma-track-cover" src="' +
      esc(url) +
      '" alt="" width="640" height="360" loading="lazy" decoding="async"></div>'
    );
  }

  function trackCard(track, section, R, opts) {
    opts = opts || {};
    var status = D.getTrackStatusView(track);
    var kind = status.itemKind || 'track';
    var minutes = D.deriveMeta ? D.deriveMeta(track).time : 20;
    var href = esc(R.track(track.trackId));
    var action = D.cardAction && opts.account ? D.cardAction(track, opts.account) : null;
    var ctaLabel = (action && action.label) || status.cta || (status.canStart ? 'Начать трек' : 'Открыть описание');
    var ctaHref = action && action.href ? esc(action.href) : href;
    var badgeHtml = status.showCatalogBadge && status.label ? badge(status.label, status.tone) : (status.pageStatus ? badge(status.pageStatus, status.tone) : '');
    var best = !!opts.best;
    var adjacent = !!opts.adjacent;
    var flag = best ? 'Лучшее совпадение' : (adjacent ? 'Ближайший полезный шаг' : '');
    return (
      '<article class="mlma-card mlma-card-hover mlma-track-card' +
      (opts.featured ? ' mlma-track-featured' : '') +
      (best || adjacent ? ' mlma-track-best' : '') +
      (opts.compact ? ' mlma-track-compact' : '') +
      '" style="' + D.styleAttr(track.sectionId) +
      '">' +
      trackCover(track) +
      (flag ? '<span class="mlma-best-flag">' + esc(flag) + '</span>' : '') +
      '<div class="mlma-strip" aria-hidden="true"></div><div style="display:flex;flex-direction:column;flex:1;padding:18px">' +
      '<div class="mlma-chip-row" style="flex-wrap:wrap"><span class="mlma-meta">' +
      esc(track.trackId) + ' · ' + esc(section ? section.shortTitle : track.sectionId) +
      '</span><span class="mlma-meta mlma-muted">' + esc(kind === 'material' ? 'Материал' : 'Трек') + '</span>' +
      badgeHtml + '</div><h3 class="mlma-h3" style="margin-top:14px;font-size:20px"><a class="mlma-track-link" href="' +
      href + '" style="color:inherit" data-mlma-result-open="' + esc(track.trackId) + '">' +
      esc(track.title) + '</a></h3><p style="margin-top:12px;font-size:15px;line-height:1.4">' +
      esc(track.situation) + '</p>' +
      (opts.compact ? '' : '<p class="mlma-muted" style="margin-top:8px;font-size:14px;line-height:1.4">' +
        (kind === 'material' ? 'Что получит: ' : 'Результат: ') + esc(track.outcome) + '</p>') +
      (opts.why ? whyHtml(opts.why) : '') +
      '<div style="margin-top:auto;padding-top:16px;border-top:1px solid var(--mlma-line-soft);display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;align-items:center">' +
      '<span class="mlma-meta mlma-muted">' + esc(track.format) + ' · ≈ ' + minutes + ' мин</span>' +
      '<a class="mlma-btn mlma-btn-small' + (status.canStart ? ' mlma-btn-primary' : '') +
      ' mlma-track-link" href="' + ctaHref + '" data-mlma-result-open="' + esc(track.trackId) + '">' +
      esc(ctaLabel) +
      '</a></div></div></article>'
    );
  }

  function trackGrid(tracks, sectionById, R, opts) {
    opts = opts || {};
    if (!tracks.length) return '';
    var html = '<ul class="mlma-grid-3">';
    for (var i = 0; i < tracks.length; i += 1) {
      html +=
        '<li style="display:flex">' +
        trackCard(tracks[i], sectionById[tracks[i].sectionId], R, {
          why: opts.whyMap ? opts.whyMap[tracks[i].trackId] : null,
          featured: !!opts.featured,
          compact: !!opts.compact,
          best: !!(opts.bestFirst && i === 0 && opts.featured),
          adjacent: !!(opts.adjacentFirst && i === 0 && opts.featured),
          account: opts.account,
        }) +
        '</li>';
    }
    return html + '</ul>';
  }

  function renderHome(state) {
    var R = state.R;
    var sections = state.sections;
    var cards = '';
    for (var i = 0; i < sections.length; i += 1) {
      cards += '<li style="display:flex">' + sectionCard(sections[i], D.sectionStats(state.allTracks, sections[i].sectionId), R) + '</li>';
    }
    var presets = '';
    var list = D.PRESETS || [];
    for (var s = 0; s < list.length; s += 1) {
      presets +=
        '<a class="mlma-chip" href="' +
        esc(D.libraryHref({ preset: list[s].id })) +
        '" data-mlma-preset="' +
        esc(list[s].id) +
        '">' +
        esc(list[s].title) +
        '</a>';
    }
    var examples = D.exampleQueries ? D.exampleQueries() : [];
    var exHtml = '';
    for (var e = 0; e < examples.length; e += 1) {
      exHtml +=
        '<a class="mlma-example" href="' +
        esc(D.libraryHref({ q: examples[e] })) +
        '">' +
        esc(examples[e]) +
        '</a>';
    }
    var diffs = [
      ['Знаю цель', 'не знаю ближайшего действия'],
      ['Посмотрел обучение', 'ничего не сделал'],
      ['Сделал попытку', 'потерял следующий шаг'],
    ];
    var answers = [
      ['Ситуационная навигация', 'Сначала описываете, что происходит сейчас.'],
      ['Действие в реальной работе', 'Трек заканчивается не просмотром, а сделанным шагом.'],
      ['Продолжение маршрута', 'После результата видно, куда идти дальше.'],
    ];
    var diffHtml = '';
    for (var d = 0; d < diffs.length; d += 1) {
      diffHtml +=
        '<li class="mlma-gap-card"><span class="mlma-meta">Разрыв 0' +
        (d + 1) +
        '</span><p style="margin-top:10px;font-weight:800">' +
        esc(diffs[d][0]) +
        '</p><p class="mlma-muted" style="margin-top:6px">' +
        esc(diffs[d][1]) +
        '</p></li>';
    }
    var ansHtml = '';
    for (var a = 0; a < answers.length; a += 1) {
      ansHtml +=
        '<li class="mlma-answer-card"><span class="mlma-meta">Ответ Academy</span><p style="margin-top:10px;font-weight:800">' +
        esc(answers[a][0]) +
        '</p><p class="mlma-muted" style="margin-top:6px">' +
        esc(answers[a][1]) +
        '</p></li>';
    }
    var vs = [
      ['Вход из реальной ситуации', 'Не «изучить продажи», а «не знаю, что написать этому человеку».'],
      ['Наблюдаемый результат', 'После трека остаётся сообщение, список, карта разговора, договорённость или другое выполненное действие.'],
      ['Работа не заканчивается просмотром', 'Трек ведёт к действию вне экрана и возвращает человека для фиксации результата.'],
      ['После результата есть продолжение', 'Система рекомендует следующий трек на основании выполненного действия и ситуации.'],
    ];
    var vsHtml = '';
    for (var v = 0; v < vs.length; v += 1) {
      vsHtml +=
        '<li class="mlma-card mlma-pad"><span class="mlma-meta">0' +
        (v + 1) +
        '</span><h3 class="mlma-h3" style="margin-top:12px">' +
        esc(vs[v][0]) +
        '</h3><p class="mlma-muted" style="margin-top:10px;font-size:15px;line-height:1.45">' +
        esc(vs[v][1]) +
        '</p></li>';
    }
    return (
      '<section class="mlma-hero"><div class="mlma-wrap mlma-hero-grid">' +
      '<div><span class="mlma-eyebrow">Рабочий навигатор MLM-партнёра</span>' +
      '<h1 class="mlma-display" style="margin-top:20px;max-width:16ch">Сначала ситуация. Потом действие.</h1>' +
      '<p class="mlma-lead mlma-muted" style="margin-top:20px;max-width:54ch">MLM Academy помогает понять, где вы сейчас, что сделать сегодня и куда идти после результата. Это не полка курсов и не обязательная лестница уроков — это библиотека рабочих маршрутов.</p>' +
      '<form class="mlma-search" style="margin-top:28px" action="/library" method="get" role="search">' +
      '<label class="mlma-sr" for="mlma-home-q">Что у тебя сейчас происходит?</label>' +
      '<input id="mlma-home-q" class="mlma-field" type="search" name="q" placeholder="Что у тебя сейчас происходит?" autocomplete="off">' +
      '<button class="mlma-btn mlma-btn-primary" type="submit">Найти решение</button></form>' +
      '<p class="mlma-muted" style="margin-top:10px;font-size:13px;max-width:54ch">Не указывайте имена, телефоны и другие персональные данные третьих лиц.</p>' +
      '<p class="mlma-meta" style="margin-top:18px">Живые примеры</p>' +
      '<div class="mlma-examples">' +
      exHtml +
      '</div></div>' +
      '<aside class="mlma-scheme" aria-label="Как устроен маршрут">' +
      '<p class="mlma-meta">Схема маршрута</p>' +
      '<ol class="mlma-scheme-list"><li>Ситуация</li><li>Подходящий трек</li><li>Действие</li><li>Следующий шаг</li></ol>' +
      '<p class="mlma-muted" style="margin-top:16px;font-size:14px;line-height:1.45">Сначала узнаёте себя в описании. Потом берёте одно действие. После результата видите продолжение.</p></aside></div></section>' +
      '<section class="mlma-band" id="mlma-research-entry"><div class="mlma-wrap">' +
      '<div class="mlma-research-cta">' +
      '<span class="mlma-eyebrow">Исследование</span>' +
      '<h2 class="mlma-h2" style="margin-top:16px;max-width:22ch;color:inherit">Почему маркетинг-плана недостаточно</h2>' +
      '<p class="mlma-lead" style="margin-top:16px;max-width:70ch">Маркетинг-план показывает партнёру цель, условия и вознаграждение. Но между целью и результатом остаётся разрыв: что конкретно человек должен сделать сегодня.</p>' +
      '<p style="margin-top:14px;max-width:70ch;font-size:16px;line-height:1.5;color:var(--mlma-on-ink-muted)">Мы изучили, как крупные MLM-компании соединяют маркетинг-план, ежедневные действия партнёра, follow-up, прогресс и работу наставника.</p>' +
      '<div class="mlma-actions" style="margin-top:24px">' +
      '<a class="mlma-btn mlma-btn-accent" href="' +
      esc(R.research ? R.research() : '/research/marketing-plan') +
      '" data-mlma-funnel="research_open_from_b2c" data-source-page="/academy" data-cta-position="academy_home_after_hero" data-article-slug="marketing-plan">Читать исследование</a>' +
      '</div></div></div></section>' +
      '<section class="mlma-band"><div class="mlma-wrap">' +
      '<span class="mlma-eyebrow mlma-eyebrow-dark">Почему появилась Academy</span>' +
      '<h2 class="mlma-h2" style="margin-top:16px;max-width:24ch">Маркетинг-план показывает, куда прийти. Но не всегда говорит, что сделать сегодня.</h2>' +
      '<p class="mlma-lead mlma-muted" style="margin-top:16px;max-width:70ch">В сетевом обычно хорошо объясняют, к какому результату нужно прийти: найти клиентов, сделать оборот, собрать команду. Но гораздо реже показывают, что конкретно сделать, если страшно написать человеку, непонятно, с кого начать или разговор остановился после первого сообщения.</p>' +
      '<p style="margin-top:16px;max-width:70ch;font-size:17px;line-height:1.5">Поэтому мы собрали не очередной курс, а библиотеку рабочих ситуаций. Вы описываете, что происходит, получаете подходящее действие, фиксируете результат и видите следующий шаг.</p>' +
      '<div class="mlma-split" style="margin-top:28px"><ul class="mlma-grid">' +
      diffHtml +
      '</ul><ul class="mlma-grid">' +
      ansHtml +
      '</ul></div></div></section>' +
      '<section class="mlma-band"><div class="mlma-wrap"><span class="mlma-eyebrow">Чем трек отличается от урока</span>' +
      '<h2 class="mlma-h2" style="margin-top:16px;max-width:20ch">Не глава учебника, а рабочий ход</h2>' +
      '<ul class="mlma-grid-2" style="margin-top:24px">' +
      vsHtml +
      '</ul></div></section>' +
      '<section class="mlma-band"><div class="mlma-wrap"><span class="mlma-eyebrow mlma-eyebrow-dark">Быстрые входы</span>' +
      '<h2 class="mlma-h2" style="margin-top:16px">Начните с подборки, а не с целого раздела</h2>' +
      '<p class="mlma-muted" style="margin-top:12px;max-width:54ch">Каждая кнопка открывает несколько точных треков под задачу, а не все карточки направления сразу.</p>' +
      '<div class="mlma-presets" style="margin-top:20px">' +
      presets +
      '</div></div></section>' +
      '<section class="mlma-band"><div class="mlma-wrap"><span class="mlma-eyebrow">Шесть направлений</span>' +
      '<h2 class="mlma-h2" style="margin-top:16px">Где вы сейчас застряли?</h2>' +
      '<ul class="mlma-grid-3" style="margin-top:28px">' +
      cards +
      '</ul></div></section>' +
      '<section class="mlma-band"><div class="mlma-wrap"><span class="mlma-eyebrow">Как работает маршрут</span>' +
      '<h2 class="mlma-h2" style="margin-top:16px;max-width:22ch">Ситуация → подборка → действие → результат → следующий шаг</h2>' +
      '<ol class="mlma-route-demo">' +
      '<li><span class="mlma-meta">Ситуация</span><p>Боюсь написать знакомому</p></li>' +
      '<li><span class="mlma-meta">Действие</span><p><a href="' +
      esc(R.track('A3-002')) +
      '">Написать первое сообщение тёплому контакту</a></p></li>' +
      '<li><span class="mlma-meta">Результат</span><p>Сообщение отправлено</p></li>' +
      '<li><span class="mlma-meta">Дальше</span><p><a href="' +
      esc(R.track('A3-016')) +
      '">Открыть разговор через настоящий повод</a></p></li>' +
      '</ol></div></section>' +
      '<section class="mlma-band"><div class="mlma-wrap"><div class="mlma-card mlma-pad-lg" style="padding:32px">' +
      '<span class="mlma-eyebrow mlma-eyebrow-accent">Как создаётся библиотека</span>' +
      '<h2 class="mlma-h2" style="margin-top:16px;max-width:22ch">Не пересказ учебников, а переработанная рабочая система</h2>' +
      '<p class="mlma-lead mlma-muted" style="margin-top:16px;max-width:70ch">Библиотека создаётся на основе анализа практик прямых продаж, интервью с партнёрами, профессиональных методик и реальных рабочих ситуаций. Каждый материал проходит практическую и этическую пересборку: без давления, манипуляций и обещаний, которые нельзя подтвердить.</p>' +
      '<div class="mlma-actions" style="margin-top:24px">' +
      btn(R.about(), 'Как создаётся библиотека', 'primary') +
      '</div></div></div></section>' +
      '<section class="mlma-band"><div class="mlma-wrap"><div class="mlma-card mlma-ink-card mlma-pad-lg" style="padding:32px">' +
      '<span class="mlma-eyebrow">Финальный вход</span>' +
      '<h2 class="mlma-h2" style="margin-top:16px;max-width:20ch;color:inherit">Не обязательно знать название нужного трека</h2>' +
      '<p class="mlma-lead" style="margin-top:16px;max-width:62ch;color:var(--mlma-on-ink-muted)">Опишите, что происходит сейчас. Навигатор соберёт несколько подходящих действий и объяснит, с чего лучше начать.</p>' +
      '<div class="mlma-actions" style="margin-top:28px">' +
      btn(R.start(), 'Описать ситуацию', 'accent') +
      '<a class="mlma-btn mlma-btn-ghost mlma-btn-on-ink" href="' +
      esc(R.library()) +
      '">Открыть всю библиотеку</a>' +
      '</div></div></div></section>'
    );
  }

  function renderStart(state) {
    var R = state.R;
    var sections = state.sections;
    var level = state.profile.currentGoal || '';
    var levels = D.EXPERIENCE || [];
    var html =
      pageHead(
        {
          eyebrow: 'Короткий навигатор',
          title: 'С чего начать',
          lead: 'Три шага: ситуация, необязательное уточнение и точная подборка — не весь раздел целиком.',
          crumbs: [
            { label: 'Academy', href: R.home() },
            { label: 'С чего начать' },
          ],
        },
        R,
      ) +
      '<div class="mlma-wrap" style="padding-top:40px;padding-bottom:56px"><fieldset><legend class="mlma-h2" style="max-width:22ch">Что сейчас больше всего мешает двигаться?</legend>' +
      '<p class="mlma-lead mlma-muted" style="margin-top:16px;max-width:60ch">Выберите одно направление. Это не тест и не анкета.</p>' +
      '<ul class="mlma-grid-3" style="margin-top:28px">';
    var selected = state.profile.selectedSectionId;
    for (var i = 0; i < sections.length; i += 1) {
      var section = sections[i];
      var stats = D.sectionStats(state.allTracks, section.sectionId);
      html +=
        '<li style="display:flex"><button type="button" class="mlma-card mlma-card-hover mlma-choice" data-mlma-choose="' +
        esc(section.sectionId) +
        '" aria-pressed="' +
        (selected === section.sectionId ? 'true' : 'false') +
        '" style="' +
        D.styleAttr(section.sectionId) +
        '"><span class="mlma-section-bar" aria-hidden="true"></span><span class="mlma-meta">' +
        esc(section.sectionId) +
        '</span><span class="mlma-h3" style="margin-top:16px;display:block">' +
        esc(section.entryQuestion) +
        '</span><span class="mlma-muted" style="margin-top:12px;display:block;font-size:15px">' +
        esc(section.shortTitle) +
        ' · ' +
        stats.total +
        ' ' +
        D.pluralTracks(stats.total) +
        '</span></button></li>';
    }
    html += '</ul></fieldset><fieldset style="margin-top:40px"><legend class="mlma-h3">Уточнение, если хотите</legend><p class="mlma-muted" style="margin-top:8px;font-size:15px">Можно пропустить.</p><div class="mlma-chip-row" style="margin-top:16px">';
    for (var l = 0; l < levels.length; l += 1) {
      html +=
        '<button type="button" class="mlma-chip' +
        (level === levels[l].id ? ' mlma-chip-on' : '') +
        '" data-mlma-level="' +
        esc(levels[l].id) +
        '" aria-pressed="' +
        (level === levels[l].id ? 'true' : 'false') +
        '">' +
        esc(levels[l].title) +
        '</button>';
    }
    html += '</div></fieldset><p class="mlma-muted" style="margin-top:20px;font-size:14px">Выбор сохранится в этом браузере.</p><div id="mlma-start-result" style="margin-top:40px">';
    html += startResult(state, selected, level);
    html += '</div></div>';
    return html;
  }

  function startResult(state, selected, level) {
    var R = state.R;
    if (!selected) {
      return '<p class="mlma-muted" style="font-size:16px">Сначала выберите ситуацию. Подборка из трёх треков появится здесь.</p>';
    }
    var section = state.sectionById[selected];
    if (!section) return '';
    var exp = D.getExperience ? D.getExperience(level) : null;
    var picks = D.startPicks(selected, exp ? exp.level : '', state.tracks);
    var blocks = [
      { key: 'start', title: 'Начните с этого', why: 'Это ближайшее действие для выбранной ситуации.', track: picks.start },
      { key: 'later', title: 'Может пригодиться дальше', why: 'Имеет смысл после первого действия, а не вместо него.', track: picks.later },
      { key: 'other', title: 'Если проблема немного другая', why: 'Соседний вход, если исходная формулировка чуть не попала.', track: picks.other },
    ];
    var html =
      '<div class="mlma-card mlma-pad-lg" style="padding:28px;' +
      D.styleAttr(section.sectionId) +
      '"><span class="mlma-eyebrow mlma-eyebrow-accent">' +
      esc(section.sectionId) +
      ' · ' +
      esc(section.shortTitle) +
      '</span><h2 class="mlma-h2" style="margin-top:16px">Не весь раздел, а три точных входа</h2><p class="mlma-muted" style="margin-top:12px;max-width:62ch">' +
      esc(section.promise) +
      '</p><ol class="mlma-start-picks">';
    for (var i = 0; i < blocks.length; i += 1) {
      var item = blocks[i];
      html += '<li><p class="mlma-meta">' + esc(item.title) + '</p>';
      if (item.track) {
        html +=
          '<div style="margin-top:12px">' +
          trackCard(item.track, state.sectionById[item.track.sectionId], R, { why: [item.why] }) +
          '</div><p class="mlma-muted" style="margin-top:8px;font-size:14px">' +
          esc(item.why) +
          '</p>';
      }
      html += '</li>';
    }
    html +=
      '</ol><div class="mlma-actions" style="margin-top:28px">' +
      btn(R.section(section.sectionId), 'Открыть направление') +
      btn(D.libraryHref({ q: section.entryQuestion }), 'Похожие треки в библиотеке', 'primary') +
      '</div></div>';
    return html;
  }

  D._ui = {
    esc: esc,
    btn: btn,
    pageHead: pageHead,
    crumbs: crumbs,
    badge: badge,
    emptyState: emptyState,
    header: header,
    footer: footer,
    mobileNav: mobileNav,
    isCabinetPage: isCabinetPage,
    readCatalog: readCatalog,
    currentPage: currentPage,
    queryParam: queryParam,
    pathName: pathName,
    renderHome: renderHome,
    renderStart: renderStart,
    startResult: startResult,
    trackCard: trackCard,
    trackGrid: trackGrid,
    sectionCard: sectionCard,
    whyHtml: whyHtml,
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* __MLMA_UI_SPLIT__ */
(function (root) {
  'use strict';
  var D = root.MLMA;
  if (!D || !D._ui) return;
  var esc = D._ui.esc;
  var btn = D._ui.btn;
  var pageHead = D._ui.pageHead;
  var emptyState = D._ui.emptyState;
  var trackCard = D._ui.trackCard;
  var trackGrid = D._ui.trackGrid;

  function renderLibrary(state) {
    var R = state.R;
    var head = pageHead(
      {
        eyebrow: 'Единый каталог',
        title: 'Библиотека',
        lead: 'Один реестр треков. Ищите обычным языком, фильтруйте по этапу и цели, отправляйте готовую подборку ссылкой.',
        crumbs: [
          { label: 'Academy', href: R.home() },
          { label: 'Библиотека' },
        ],
      },
      R,
    );
    return head + '<div id="mlma-catalog"></div>';
  }

  function catalogBrowserHtml(state, filters, options) {
    options = options || {};
    var R = state.R;
    var result = options.result || D.searchCatalog(state.tracks, filters);
    var facets = D.facetOptions ? D.facetOptions(state.tracks) : { sit: [], fmt: [], ch: [], lvl: [], avail: [] };
    var pageSize = D.PAGE_SIZE || 15;
    var shown = options.shown || pageSize;
    var chipsHtml = '';
    for (var c = 0; c < result.chips.length; c += 1) {
      chipsHtml +=
        '<button type="button" class="mlma-chip mlma-chip-on mlma-chip-remove" data-mlma-clear="' +
        esc(result.chips[c].key) +
        '" data-mlma-clear-value="' +
        esc(result.chips[c].value) +
        '">' +
        esc(result.chips[c].label) +
        ' ×</button>';
    }
    if (result.chips.length) {
      chipsHtml += '<button type="button" class="mlma-chip" data-mlma-reset="1">Очистить всё</button>';
    }
    function chipGroup(attr, items, selected) {
      var html = '';
      var sel = selected || [];
      for (var i = 0; i < items.length; i += 1) {
        var on = sel.indexOf(items[i].id) !== -1 || sel.indexOf(items[i].id.toUpperCase()) !== -1;
        html +=
          '<button type="button" class="mlma-chip' +
          (on ? ' mlma-chip-on' : '') +
          '" ' +
          attr +
          '="' +
          esc(items[i].id) +
          '">' +
          esc(items[i].title) +
          '</button>';
      }
      return html;
    }
    var stageItems = [];
    for (var s = 0; s < D.SECTION_IDS.length; s += 1) {
      var sid = D.SECTION_IDS[s];
      var section = state.sectionById[sid];
      stageItems.push({ id: sid, title: sid + ' · ' + (section ? section.shortTitle : sid) });
    }
    var stages = filters.stages && filters.stages.length ? filters.stages : (filters.stage ? [filters.stage] : []);
    var stageChips = chipGroup('data-mlma-stage', stageItems, stages);
    var sitChips = chipGroup('data-mlma-sit', facets.sit, filters.sit || []);
    var fmtChips = chipGroup('data-mlma-fmt', facets.fmt, filters.fmt || []);
    var pending = !!result.pendingAi;
    var matchType = result.matchType || '';
    var exactish = matchType === 'exact' || matchType === 'strong';
    var adjacentish = matchType === 'adjacent';
    var body;
    var pendingBanner = '';
    if ((result.kind === 'need_more' || result.kind === 'zero') && !pending && !(result.featured && result.featured.length) && !(result.items && result.items.length)) {
      var options = result.clarifyingOptions && result.clarifyingOptions.length
        ? result.clarifyingOptions
        : (D.CLARIFY_OPTIONS || []);
      var optionHtml = '';
      for (var o = 0; o < options.length && o < 3; o += 1) {
        optionHtml +=
          '<a class="mlma-chip mlma-chip-on" href="' +
          esc(D.libraryHref({ q: options[o].q })) +
          '">' +
          esc(options[o].label) +
          '</a>';
      }
      body = emptyState({
        eyebrow: result.kind === 'need_more' ? 'Уточните запрос' : 'Точного трека пока нет',
        title: result.clarifyingQuestion || (result.kind === 'need_more' ? 'Опишите ситуацию чуть конкретнее' : 'Точного трека пока нет'),
        description: result.kind === 'need_more'
          ? 'Слишком общий запрос. Напишите, что происходит, или выберите один из вариантов.'
          : 'Уточните ситуацию — так проще найти рабочий трек, а не случайное совпадение по словам.',
        actions: optionHtml,
      });
    } else {
      var featured = result.featured || [];
      var rest = (filters.q ? result.other : (featured.length ? result.other : result.items)) || [];
      var searching = !!filters.q;
      var visible = searching ? rest.slice(0, 5) : rest.slice(0, shown);
      var more = !searching && rest.length > shown;
      body = '';
      if (pending) body += pendingBanner;
      if (featured.length) {
        var featTitle = adjacentish ? 'Можно начать с этих треков' : 'Подходит лучше всего';
        body +=
          '<section class="mlma-featured"><div class="mlma-section-head"><h2 class="mlma-h3">' +
          esc(featTitle) +
          '</h2></div>' +
          trackGrid(featured, state.sectionById, R, {
            whyMap: result.whyMap,
            featured: true,
            bestFirst: exactish,
            adjacentFirst: adjacentish,
            account: state.account,
          }) +
          '</section>';
      }
      if (result.clarifyingQuestion && featured.length) {
        body +=
          '<p class="mlma-muted" style="margin-top:20px;max-width:54ch;font-size:15px;line-height:1.45">' +
          esc(result.clarifyingQuestion) +
          '</p>';
      }
      if (visible.length) {
        body +=
          (searching
            ? '<section style="margin-top:36px"><div class="mlma-section-head"><h2 class="mlma-h3">Можно начать с этого</h2></div>'
            : '') +
          trackGrid(visible, state.sectionById, R, { whyMap: searching ? result.whyMap : null, account: state.account }) +
          (searching ? '</section>' : '');
      }
      if (more) {
        body +=
          '<div style="margin-top:28px;text-align:center"><button type="button" class="mlma-btn mlma-btn-primary" data-mlma-more="1">Показать ещё</button></div>';
      }
      if (!featured.length && !visible.length) {
        body = pending
          ? pendingBanner
          : emptyState({
              title: 'Каталог ещё наполняется',
              description: 'Структура направлений уже есть. Откройте раздел или выберите ситуацию.',
              actions: btn(R.start(), 'С чего начать', 'primary'),
            });
      }
    }
    var share = D.libraryHref(filters);
    var drawerFacets = '';
    function facetBlock(title, inner) {
      if (!inner) return '';
      return '<div class="mlma-facet"><p class="mlma-meta mlma-facet-title">' + esc(title) + '</p><div class="mlma-chip-row">' + inner + '</div></div>';
    }
    drawerFacets += facetBlock('Этап', stageChips);
    drawerFacets += facetBlock('Моя ситуация', sitChips);
    var goalItems = D.GOALS || [];
    var goalChips = chipGroup('data-mlma-goal', goalItems, filters.goal ? [filters.goal] : []);
    drawerFacets += facetBlock('Что хочу получить', goalChips);
    var expItems = D.EXPERIENCE || [];
    var expChips = chipGroup('data-mlma-experience', expItems, filters.experience ? [filters.experience] : []);
    drawerFacets += facetBlock('Опыт', expChips);
    var typeItems = D.MATERIAL_TYPES || [];
    var typeChips = chipGroup('data-mlma-type', typeItems, filters.type ? [filters.type] : []);
    drawerFacets += facetBlock('Тип', typeChips);
    var timeItems = D.TIME_FILTERS || [];
    var timeChips = chipGroup('data-mlma-time', timeItems, filters.time ? [filters.time] : []);
    drawerFacets += facetBlock('Время', timeChips);
    drawerFacets += facetBlock('Формат', fmtChips);
    var drawer =
      '<div class="mlma-drawer-host">' +
      '<div class="mlma-drawer-backdrop" id="mlma-drawer-backdrop" hidden></div>' +
      '<div class="mlma-drawer mlma-drawer-bottom" id="mlma-drawer" role="dialog" aria-modal="true" aria-labelledby="mlma-drawer-title" hidden>' +
      '<div class="mlma-drawer-head"><h2 class="mlma-h3" id="mlma-drawer-title">Фильтры</h2>' +
      '<button type="button" class="mlma-btn mlma-btn-small" data-mlma-drawer-close="1">Закрыть</button></div>' +
      drawerFacets +
      '<div class="mlma-actions"><button type="button" class="mlma-btn" data-mlma-reset="1">Очистить всё</button>' +
      '<button type="button" class="mlma-btn mlma-btn-primary" data-mlma-drawer-close="1">Показать результаты</button></div></div></div>';
    return (
      '<div class="mlma-wrap"><div style="display:grid;gap:16px;padding:24px 0 8px">' +
      '<form id="mlma-lib-form" action="/library" method="get" role="search"><label class="mlma-meta" style="display:block;margin-bottom:8px" for="mlma-search">Что у тебя сейчас происходит?</label>' +
      '<div class="mlma-search"><input id="mlma-search" class="mlma-field" type="search" name="q" placeholder="Например: боюсь написать знакомому" value="' +
      esc(filters.q || '') +
      '" autocomplete="off"><button class="mlma-btn mlma-btn-primary" type="submit">Найти решение</button></div>' +
      '<p class="mlma-muted" style="margin-top:8px;font-size:13px">Не указывайте имена, телефоны и другие персональные данные третьих лиц.</p></form>' +
      (chipsHtml ? '<div class="mlma-chip-row" id="mlma-active-chips">' + chipsHtml + '</div>' : '') +
      '<div class="mlma-filterbar"><button type="button" class="mlma-btn mlma-btn-small" id="mlma-open-filters" aria-haspopup="dialog" aria-expanded="false">Фильтры</button>' +
      '<button type="button" class="mlma-btn mlma-btn-small mlma-btn-ghost" id="mlma-share" data-mlma-share="' +
      esc(share) +
      '">Ссылка на подборку</button><span id="mlma-share-msg" class="mlma-muted" style="font-size:13px" aria-live="polite"></span></div></div>' +
      '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;padding:12px 0 20px"><p style="font-size:16px;font-weight:700" id="mlma-count">' +
      esc(pending ? 'Подбираем наиболее подходящий маршрут…' : (filters.q ? '' : (result.label || ''))) +
      '</p></div><div id="mlma-results" style="padding-bottom:64px">' +
      body +
      '</div>' +
      drawer +
      '</div>'
    );
  }

  function renderSection(state) {
    var R = state.R;
    var sectionId = D.normalizeSectionId(state.root.getAttribute('data-mlma-section') || '');
    var section = sectionId ? state.sectionById[sectionId] : null;
    if (!section) {
      return emptyState({
        title: 'Раздел не найден',
        description: 'Вернитесь в библиотеку и выберите направление заново.',
        actions: btn('/library', 'Библиотека', 'primary'),
      });
    }
    var stats = D.sectionStats(state.allTracks, sectionId);
    var tracks = [];
    for (var i = 0; i < state.tracks.length; i += 1) {
      if (state.tracks[i].sectionId === sectionId) tracks.push(state.tracks[i]);
    }
    var entries = D.sectionEntryTracks(sectionId, state.tracks);
    var logic = '';
    for (var r = 0; r < section.routeLogic.length; r += 1) {
      if (r) logic += '<span class="mlma-muted" aria-hidden="true">→</span>';
      logic += '<span class="mlma-card" style="padding:12px 16px;font-size:16px;font-weight:700">' + esc(section.routeLogic[r]) + '</span>';
    }
    var modules = {};
    var moduleList = [];
    for (var t = 0; t < tracks.length; t += 1) {
      if (!modules[tracks[t].module]) {
        modules[tracks[t].module] = [];
        moduleList.push(tracks[t].module);
      }
      modules[tracks[t].module].push(tracks[t]);
    }
    var moduleHtml = '';
    for (var m = 0; m < moduleList.length; m += 1) {
      moduleHtml +=
        '<details class="mlma-module" open><summary><span>' +
        esc(moduleList[m]) +
        '</span><span class="mlma-meta mlma-muted">' +
        modules[moduleList[m]].length +
        ' ' +
        D.pluralTracks(modules[moduleList[m]].length) +
        '</span></summary><div style="margin-top:16px">' +
        trackGrid(modules[moduleList[m]], state.sectionById, R) +
        '</div></details>';
    }
    return (
      '<div style="' +
      D.styleAttr(sectionId) +
      '">' +
      pageHead(
        {
          eyebrow: section.sectionId + ' · ' + stats.total + ' ' + D.pluralTracks(stats.total),
          title: section.title,
          lead: section.promise,
          crumbs: [
            { label: 'Academy', href: R.home() },
            { label: 'Библиотека', href: R.library() },
            { label: section.shortTitle },
          ],
          aside:
            '<div class="mlma-card mlma-pad" style="' +
            D.styleAttr(sectionId) +
            '"><span class="mlma-strip" style="display:block;height:8px;width:64px;margin-bottom:16px"></span><span class="mlma-meta">Входная ситуация</span><p style="margin-top:12px;max-width:34ch;font-size:16px;line-height:1.35">' +
            esc(section.entryQuestion) +
            '</p></div>',
        },
        R,
      ) +
      '<div class="mlma-wrap" style="padding-top:40px;padding-bottom:56px">' +
      '<section><span class="mlma-eyebrow">С чего начать в этом разделе</span><h2 class="mlma-h3" style="margin-top:16px">Три входных трека</h2><p class="mlma-muted" style="margin-top:8px;max-width:62ch">Не обязательно просматривать весь список. Начните с одного из этих действий.</p><div style="margin-top:20px">' +
      trackGrid(entries, state.sectionById, R, { featured: true }) +
      '</div></section>' +
      '<section style="margin-top:48px"><span class="mlma-eyebrow">Логика раздела</span><h2 class="mlma-h3" style="margin-top:16px">Как обычно идёт работа здесь</h2>' +
      '<ol style="margin-top:20px;display:flex;flex-wrap:wrap;gap:12px;align-items:center">' +
      logic +
      '</ol></section>' +
      '<form class="mlma-search" style="margin-top:40px;max-width:720px" action="/library" method="get" role="search">' +
      '<input type="hidden" name="stage" value="' +
      esc(String(sectionId).toLowerCase()) +
      '">' +
      '<label class="mlma-sr" for="mlma-section-q">Поиск внутри раздела</label>' +
      '<input id="mlma-section-q" class="mlma-field" type="search" name="q" placeholder="Поиск внутри раздела">' +
      '<button class="mlma-btn mlma-btn-primary" type="submit">Найти</button></form>' +
      '<section style="margin-top:40px"><div class="mlma-section-head"><h2 class="mlma-h3">Треки по модулям</h2><span class="mlma-meta">' +
      tracks.length +
      ' ' +
      D.pluralTracks(tracks.length) +
      '</span></div>' +
      moduleHtml +
      '</section>' +
      '<div class="mlma-actions" style="margin-top:48px">' +
      btn(R.start(), 'Вернуться к своей ситуации', 'primary') +
      btn(R.library(), 'Вся библиотека') +
      '</div></div></div>'
    );
  }

  D._ui.catalogBrowserHtml = catalogBrowserHtml;
  D._ui.renderLibrary = renderLibrary;
  D._ui.renderSection = renderSection;
})(typeof window !== 'undefined' ? window : globalThis);

/* __MLMA_UI_SPLIT__ */
(function (root) {
  'use strict';
  var D = root.MLMA;
  if (!D || !D._ui) return;
  var esc = D._ui.esc;
  var btn = D._ui.btn;
  var pageHead = D._ui.pageHead;
  var crumbs = D._ui.crumbs;
  var badge = D._ui.badge;
  var emptyState = D._ui.emptyState;
  var header = D._ui.header;
  var footer = D._ui.footer;
  var mobileNav = D._ui.mobileNav;
  var catalogBrowserHtml = D._ui.catalogBrowserHtml;
  var readCatalog = D._ui.readCatalog;
  var currentPage = D._ui.currentPage;
  var queryParam = D._ui.queryParam;
  var pathName = D._ui.pathName;
  var renderHome = D._ui.renderHome;
  var renderStart = D._ui.renderStart;
  var renderLibrary = D._ui.renderLibrary;
  var renderSection = D._ui.renderSection;
  var trackGrid = D._ui.trackGrid;

  function cabinetNav(state) {
    var R = state.R;
    var items = [
      { href: R.my(), label: 'Главная', id: 'my' },
      { href: R.myRoute(), label: 'Мой маршрут', id: 'route' },
      { href: R.myTracks ? R.myTracks() : '/my/route?tab=tracks', label: 'Мои треки', id: 'tracks' },
      { href: R.myResults(), label: 'Результаты', id: 'results' },
      { href: R.mySaved ? R.mySaved() : '/my/route?tab=saved', label: 'Сохранённое', id: 'saved' },
      { href: (R.purchases && R.purchases()) || '/my/purchases', label: 'Покупки и доступ', id: 'purchases' },
      { href: R.profile(), label: 'Профиль', id: 'profile' },
      { href: (R.logout && R.logout()) || '/members/login?exit=y', label: 'Выйти', id: 'logout', logout: true },
    ];
    var tab = '';
    try {
      tab = new URLSearchParams(window.location.search).get('tab') || '';
    } catch (err) {
      tab = '';
    }
    var html = '<nav class="mlma-cabinet-nav" aria-label="Кабинет"><ul>';
    for (var i = 0; i < items.length; i += 1) {
      var current = false;
      if (items[i].id === 'tracks') current = state.page === 'route' && tab === 'tracks';
      else if (items[i].id === 'saved') current = state.page === 'route' && tab === 'saved';
      else if (items[i].id === 'route') current = state.page === 'route' && !tab;
      else if (items[i].id === 'access') current = state.page === 'access';
      else if (items[i].id === 'purchases') current = state.page === 'purchases';
      else if (items[i].id === 'logout') current = false;
      else current = state.page === items[i].id;
      html +=
        '<li><a href="' +
        esc(items[i].href) +
        '"' +
        (items[i].logout ? ' data-mlma-logout="1"' : '') +
        (current ? ' aria-current="page"' : '') +
        '>' +
        esc(items[i].label) +
        '</a></li>';
    }
    return html + '</ul></nav>';
  }

  function renderTrack(state) {
    var R = state.R;
    var path = pathName();
    var raw = queryParam('id') || state.root.getAttribute('data-mlma-track') || '';
    if (!raw && path.indexOf('/track/') === 0) raw = path.slice('/track/'.length);
    var trackId = D.normalizeTrackId(raw);
    var track = trackId ? D.getById(state.allTracks, trackId, true) : null;
    if (!track) return (D._ui.renderNotFound || function () { return ''; })(state, 'Такого трека нет');
    var section = state.sectionById[track.sectionId];
    var entitled = D.isEntitledToTrack ? D.isEntitledToTrack(track, state.account) : true;
    var status = D.getTrackStatusView(track, { entitled: entitled });
    var canBody = D.canOpenTrackBody ? D.canOpenTrackBody(track, state.account) : status.canStart;
    var passport = D.derivePassport ? D.derivePassport(track) : null;
    var runtime = D.getRuntime ? D.getRuntime(track.trackId) : null;
    var running = canBody && (queryParam('run') === '1' || (runtime && runtime.status && runtime.status !== 'preview'));
    var saved = state.profile.savedTrackIds.indexOf(track.trackId) !== -1;
    var restore = D.readLibraryRestore ? D.readLibraryRestore() : null;
    var backHref = restore && restore.href ? restore.href : R.library();
    var context = { query: restore && restore.q ? restore.q : queryParam('from'), profile: state.profile, runtime: runtime };
    var bundle = D.nextTrackBundle(track, state.tracks, context);
    var nba = bundle.nba || (D.nextBestAction ? D.nextBestAction(track, state.tracks, runtime, state.profile) : null);
    var related = D.relatedContent ? D.relatedContent(track, state.tracks, 3) : bundle.variants || [];
    var startHref = R.track(track.trackId) + (R.track(track.trackId).indexOf('?') === -1 ? '?' : '&') + 'run=1';
    var genre = passport ? '<span class="mlma-genre mlma-genre-' + esc(passport.genreAccent || 'practice') + '">' + esc(passport.genreLabel) + '</span>' : '';
    var inactive = D.isInactive && D.isInactive(runtime);
    var runtimeHtml = '';
    if (status.itemKind === 'material') {
      runtimeHtml =
        '<section class="mlma-card mlma-pad"><span class="mlma-meta">Материал</span><p style="margin-top:10px">Это материал библиотеки: его можно открыть и использовать. Он не заменяет исполняемый трек с рабочим следом.</p></section>';
    } else if (running && status.canStart) {
      runtimeHtml = renderTrackRuntime(track, passport, runtime, nba, R, inactive);
    } else {
      runtimeHtml =
        '<section class="mlma-blueprint mlma-pad mlma-genre-' +
        esc((passport && passport.genreAccent) || 'practice') +
        '" aria-label="Контур трека"><span class="mlma-eyebrow mlma-eyebrow-dark">Контур прохождения</span><h2 class="mlma-h3" style="margin-top:12px">' +
        esc((passport && passport.genrePattern) || 'Состояние → действие → след → следующее действие') +
        '</h2>' +
        '<ol class="mlma-runtime-steps" style="margin-top:16px">' +
        '<li><span class="mlma-meta">Исходное состояние</span><p>' + esc(track.situation) + '</p></li>' +
        '<li><span class="mlma-meta">Действие</span><p>' + esc(track.title) + '</p></li>' +
        '<li><span class="mlma-meta">Рабочий след</span><p>' + esc(track.outcome) + '</p></li>' +
        '<li><span class="mlma-meta">Дальше</span><p>Следующее лучшее действие, не похожий материал.</p></li></ol>' +
        (inactive ? '<p class="mlma-lead" style="margin-top:16px">Есть незавершённая попытка. Можно продолжить с того же шага.</p>' : '') +
        '<div class="mlma-actions" style="margin-top:20px">' +
        (status.canStart && canBody
          ? '<a class="mlma-btn mlma-btn-primary" href="' + esc(startHref) + '" data-mlma-run-start="' + esc(track.trackId) + '">Начать трек</a>'
          : '') +
        '</div></section>';
    }
    var wouldStart = D.getTrackStatusView(track, { entitled: true }).canStart;
    if (!entitled && D.normalizeAccess && D.normalizeAccess(track.access) === 'paid' && wouldStart) {
      runtimeHtml =
        '<section class="mlma-card mlma-pad-lg" style="padding:28px"><span class="mlma-eyebrow">Доступ к треку</span><h2 class="mlma-h3" style="margin-top:12px">Платный полный маршрут ещё готовится</h2>' +
        '<p class="mlma-lead" style="margin-top:12px">' + esc(track.situation) + '</p>' +
        '<p style="margin-top:8px">Результат: ' + esc(track.outcome) + '</p>' +
        '<p class="mlma-muted" style="margin-top:12px">Карточка трека — не готовый продукт. Metadata-only и planned нельзя купить. Внутренние шаги сюда не выводятся.</p>' +
        '<div class="mlma-actions" style="margin-top:20px">' +
        (state.account && state.account.loggedIn
          ? btn((R.pricing && R.pricing()) || '/pricing', 'Готовится к запуску', 'primary')
          : btn(D.membersLoginUrl(pathName()), 'Войти, чтобы сохранить', 'primary') + btn((R.pricing && R.pricing()) || '/pricing', 'Смотреть тарифы')) +
        '</div></section>';
    }
    var nbaHtml = '';
    if (nba && nba.kind === 'open_track' && nba.track) {
      nbaHtml =
        recBlock({ track: nba.track, reason: nba.reason || 'explicit_next_edge', available: true }, state, true) +
        '<p class="mlma-muted" style="margin-top:12px;font-size:14px">' +
        esc(nba.why || 'Это следующее лучшее действие.') +
        '</p>';
    } else if (nba && (nba.kind === 'retry' || nba.kind === 'corrective')) {
      nbaHtml = '<p class="mlma-lead">Сначала закройте разрыв в этом треке, затем переходите дальше.</p>';
    } else {
      nbaHtml = '<p class="mlma-lead mlma-muted">Продолжение появится после рабочего следа.</p>';
    }
    var relatedHtml = '';
    if (related.length) {
      relatedHtml = '<div style="margin-top:24px"><span class="mlma-meta">Связанные материалы</span><p class="mlma-muted" style="margin-top:6px;font-size:13px">Это соседняя тема, а не следующее обязательное действие.</p><ul style="margin-top:16px;display:grid;gap:12px">';
      for (var a = 0; a < related.length; a += 1) {
        relatedHtml += '<li>' + recBlock({ track: related[a], reason: 'same_section', available: false }, state, false) + '</li>';
      }
      relatedHtml += '</ul></div>';
    }
    return (
      '<div style="' +
      D.styleAttr(track.sectionId) +
      '"><div class="mlma-wrap" style="padding-top:28px;padding-bottom:24px">' +
      crumbs(
        [
          { label: 'Academy', href: R.home() },
          { label: 'Библиотека', href: R.library() },
          { label: section ? section.shortTitle : track.sectionId, href: R.section(track.sectionId) },
          { label: track.title },
        ],
        R,
      ) +
      '<div style="margin-top:20px;display:flex;flex-wrap:wrap;gap:8px;align-items:center">' +
      '<span class="mlma-eyebrow">' +
      esc(track.trackId) +
      '</span>' +
      genre +
      (status.pageStatus ? badge(status.pageStatus, status.tone) : '') +
      '<span class="mlma-meta mlma-muted">' +
      esc(status.itemKind === 'material' ? 'Материал' : 'Трек') +
      ' · ' +
      esc(track.format) +
      '</span></div>' +
      '<h1 class="mlma-h1" style="margin-top:16px;max-width:22ch;text-transform:none">' +
      esc(track.title) +
      '</h1></div>' +
      '<div class="mlma-wrap mlma-split mlma-split-84" style="padding-bottom:48px">' +
      '<div style="display:grid;gap:20px">' +
      '<section class="mlma-card mlma-pad"><span class="mlma-meta">Почему этот трек сейчас</span><p style="margin-top:10px;font-size:17px;line-height:1.45">' +
      esc(track.situation) +
      '</p></section>' +
      '<section class="mlma-card mlma-pad"><span class="mlma-meta">Куда нужно перейти</span><p style="margin-top:10px;font-size:17px;line-height:1.45">' +
      esc(track.outcome) +
      '</p></section>' +
      runtimeHtml +
      '<section class="mlma-card mlma-pad-lg" style="padding:24px"><span class="mlma-eyebrow mlma-eyebrow-accent">Следующее лучшее действие</span><h2 class="mlma-h3" style="margin-top:12px">' +
      (nba && nba.track ? nba.track.title : nba && nba.title ? nba.title : 'После рабочего следа') +
      '</h2><div style="margin-top:16px">' +
      nbaHtml +
      relatedHtml +
      '</div><div class="mlma-actions" style="margin-top:20px">' +
      btn(R.section(track.sectionId), 'В раздел') +
      btn(backHref, 'Вернуться к подборке') +
      '</div></section></div>' +
      '<aside style="display:grid;gap:16px;align-content:start">' +
      '<div class="mlma-card mlma-pad">' +
      (status.canStart && !running && canBody
        ? '<a class="mlma-btn mlma-btn-primary mlma-btn-block" href="' + esc(startHref) + '" data-mlma-run-start="' + esc(track.trackId) + '">Начать трек</a>'
        : '') +
      (state.account && state.account.loggedIn
        ? '<button type="button" class="mlma-btn' +
          (saved ? ' mlma-btn-accent' : ' mlma-btn-primary') +
          ' mlma-btn-block" style="margin-top:12px" data-mlma-save="' +
          esc(track.trackId) +
          '" aria-pressed="' +
          (saved ? 'true' : 'false') +
          '">' +
          (saved ? 'Убрать из маршрута' : 'Сохранить в маршрут') +
          '</button>'
        : '<button type="button" class="mlma-btn mlma-btn-primary mlma-btn-block" style="margin-top:12px" data-mlma-save-guest="' +
          esc(track.trackId) +
          '">Сохранить в маршрут</button>') +
      '<p class="mlma-muted" id="mlma-save-hint" style="margin-top:12px;font-size:13px;line-height:1.45">' +
      (state.account && state.account.loggedIn
        ? (state.account.storageMode === 'server'
          ? 'Трек сохраняется в кабинете и доступен с другого устройства.'
          : state.account.storageMode === 'restoring'
            ? 'Данные восстанавливаются…'
            : state.account.storageMode === 'offline'
              ? 'Нет соединения. Пока сохраняем в этом браузере.'
              : state.account.storageMode === 'error'
                ? 'Сервер недоступен. Локальная копия сохранена в этом браузере.'
                : 'Пока сохраняется в этом браузере.')
        : 'Описание можно читать без входа. После регистрации трек сразу окажется в маршруте.') +
      '</p></div>' +
      '<section class="mlma-card mlma-pad"><span class="mlma-meta">Паспорт</span><dl style="margin-top:12px">' +
      '<div class="mlma-row"><dt class="mlma-meta mlma-muted">Раздел</dt><dd style="margin-top:4px;font-weight:700">' +
      esc(section ? section.sectionId + ' · ' + section.shortTitle : track.sectionId) +
      '</dd></div><div class="mlma-row"><dt class="mlma-meta mlma-muted">Модуль</dt><dd style="margin-top:4px;font-weight:700">' +
      esc(track.module) +
      '</dd></div><div class="mlma-row"><dt class="mlma-meta mlma-muted">Формат</dt><dd style="margin-top:4px;font-weight:700">' +
      esc(track.format) +
      '</dd></div></dl></section></aside></div></div>'
    );
  }

  function renderTrackRuntime(track, passport, runtime, nba, R, inactive) {
    var trackModules = root.MLMA_TRACK_MODULES || {};
    var trackModule = (D.getTrackModule && D.getTrackModule(track.trackId)) || trackModules[track.trackId];
    if (trackModule && typeof trackModule.render === 'function') {
      return trackModule.render({
        track: track,
        passport: trackModule.passport || passport,
        runtime: runtime,
        nba: nba,
        R: R,
        inactive: inactive,
        esc: esc,
      });
    }
    runtime = runtime || { status: 'active', step: 'action', artifact: '', evidenceNote: '', attempts: 0 };
    var html = '<section class="mlma-runtime mlma-card mlma-pad-lg" id="mlma-runtime" data-mlma-track-runtime="' + esc(track.trackId) + '">';
    html += '<span class="mlma-eyebrow">Текущий шаг</span>';
    if (inactive) {
      html += '<p class="mlma-lead" style="margin-top:12px">Вы остановились. Можно продолжить с черновика.</p>';
    }
    if (runtime.step !== 'feedback') {
      html +=
        '<h2 class="mlma-h3" style="margin-top:12px">Сделать действие и оставить след</h2>' +
        '<p style="margin-top:10px;font-size:16px;line-height:1.45">Задание: ' +
        esc(track.title) +
        '. Результат, который система может проверить: ' +
        esc(track.outcome) +
        '.</p>' +
        '<form id="mlma-runtime-form" style="margin-top:16px;display:grid;gap:12px">' +
        '<label class="mlma-meta" for="mlma-artifact">Рабочий артефакт</label>' +
        '<textarea id="mlma-artifact" class="mlma-field" name="artifact" rows="7" required placeholder="Опишите конкретный результат работы, а не «готово»">' +
        esc(runtime.artifact || '') +
        '</textarea>' +
        '<label class="mlma-meta" for="mlma-evidence">Доказательство действия</label>' +
        '<textarea id="mlma-evidence" class="mlma-field" name="evidenceNote" rows="3" required placeholder="Какой след остался: текст сохранён, сообщение отправлено, план записан">' +
        esc(runtime.evidenceNote || '') +
        '</textarea>' +
        '<p class="mlma-muted" style="font-size:13px">Не добавляйте в результат персональные данные других людей без их согласия.</p>' +
        '<p class="mlma-muted" style="font-size:13px">Просмотр страницы не завершает трек. Нужен объект работы и проверяемый след. Оценка здесь — самопроверка по критериям, а не доказательство выполнения.</p>' +
        '<button class="mlma-btn mlma-btn-primary" type="submit" data-mlma-run-submit="' +
        esc(track.trackId) +
        '">Сдать результат</button></form>';
    } else if (runtime.feedback) {
      var fb = runtime.feedback;
      html +=
        '<h2 class="mlma-h3" style="margin-top:12px">' +
        esc(fb.title) +
        '</h2>' +
        '<dl class="mlma-feedback" style="margin-top:16px;display:grid;gap:10px">' +
        '<div><dt class="mlma-meta">Что получилось</dt><dd>' +
        esc(fb.got) +
        '</dd></div><div><dt class="mlma-meta">Что не соответствует</dt><dd>' +
        esc(fb.gap) +
        '</dd></div><div><dt class="mlma-meta">Что изменить</dt><dd>' +
        esc(fb.change) +
        '</dd></div><div><dt class="mlma-meta">Что делать сейчас</dt><dd>' +
        esc(fb.now) +
        '</dd></div></dl>';
      if (fb.retry) {
        html +=
          '<div class="mlma-actions" style="margin-top:20px"><button type="button" class="mlma-btn mlma-btn-primary" data-mlma-run-retry="' +
          esc(track.trackId) +
          '">Повторить попытку</button></div>';
      } else if (nba && nba.track) {
        html +=
          '<div class="mlma-actions" style="margin-top:20px"><a class="mlma-btn mlma-btn-primary" href="' +
          esc(R.track(nba.track.trackId)) +
          '" data-mlma-nba="' +
          esc(nba.track.trackId) +
          '">Следующее действие</a></div>';
      }
    }
    html += '</section>';
    return html;
  }

  function recBlock(item, state, emphasis) {
    var track = item.track;
    var section = state.sectionById[track.sectionId];
    var reason = D.RECOMMENDATION_REASON_LABELS[item.reason] || '';
    return (
      '<a class="' +
      (emphasis ? 'mlma-card' : 'mlma-card-soft') +
      ' mlma-card-hover" href="' +
      esc(state.R.track(track.trackId)) +
      '" style="display:block;padding:' +
      (emphasis ? '28px' : '16px') +
      ';' +
      D.styleAttr(track.sectionId) +
      '">' +
      (emphasis ? '<span class="mlma-strip" style="display:block;height:12px;margin-bottom:20px"></span>' : '') +
      '<span class="mlma-meta">' +
      esc(track.trackId) +
      ' · ' +
      esc(section ? section.shortTitle : track.sectionId) +
      '</span><p class="' +
      (emphasis ? 'mlma-h3' : '') +
      '" style="margin-top:12px;font-weight:700;font-size:' +
      (emphasis ? 'inherit' : '16px') +
      '">' +
      esc(track.title) +
      '</p>' +
      (emphasis ? '<p class="mlma-muted" style="margin-top:16px;max-width:56ch;font-size:16px">' + esc(track.outcome) + '</p>' : '') +
      '<p class="mlma-muted" style="margin-top:12px;font-size:13px">' +
      esc(reason) +
      (item.available ? '' : ' · продолжение готовится') +
      '</p></a>'
    );
  }

  function nextActionCard(decision, state) {
    var R = state.R;
    var action;
    if (decision.kind === 'open_track') {
      action = {
        eyebrow: 'Следующее действие · ' + decision.track.trackId,
        title: decision.track.title,
        why: decision.track.situation,
        outcome: decision.track.outcome,
        href: R.track(decision.track.trackId),
        cta: 'Открыть трек',
        sectionId: decision.track.sectionId,
        secondary: { href: R.library(), label: 'Другие треки' },
      };
    } else if (decision.kind === 'section_preparing') {
      var section = state.sectionById[decision.sectionId];
      action = {
        eyebrow: 'Следующее действие · раздел ' + decision.sectionId,
        title: section ? section.title : 'Ваш раздел готовится',
        why: 'Раздел выбран и сохранён. Открытых треков в нём пока нет — первый появится здесь автоматически.',
        outcome: section ? section.promise : null,
        href: R.section(decision.sectionId),
        cta: 'Открыть раздел',
        sectionId: decision.sectionId,
        secondary: { href: R.start(), label: 'Поменять ситуацию' },
      };
    } else if (decision.kind === 'saved_preparing') {
      action = {
        eyebrow: 'Следующее действие · ' + decision.track.trackId,
        title: decision.track.title,
        why: 'Вы сохранили этот трек. Содержание ещё готовится, но карточка и связи уже доступны.',
        outcome: decision.track.outcome,
        href: R.track(decision.track.trackId),
        cta: 'Открыть карточку',
        sectionId: decision.track.sectionId,
        secondary: { href: R.library(), label: 'Библиотека' },
      };
    } else {
      action = {
        eyebrow: 'Следующее действие',
        title: 'Выберите ситуацию, в которой сейчас застряли',
        why: 'Один ответ определит раздел и первый шаг. Это занимает меньше минуты и ничего не требует заполнять.',
        outcome: null,
        href: R.start(),
        cta: 'Выбрать ситуацию',
        sectionId: null,
        secondary: { href: R.library(), label: 'Сначала посмотреть библиотеку' },
      };
    }
    return (
      '<article class="mlma-card mlma-lime mlma-pad-lg" style="padding:32px;' +
      (action.sectionId ? D.styleAttr(action.sectionId) : '') +
      '"><span class="mlma-meta">' +
      esc(action.eyebrow) +
      '</span><h2 class="mlma-h2" style="margin-top:20px;max-width:22ch"><a href="' +
      esc(action.href) +
      '">' +
      esc(action.title) +
      '</a></h2><p class="mlma-lead" style="margin-top:20px;max-width:62ch">' +
      esc(action.why) +
      '</p>' +
      (action.outcome
        ? '<p style="margin-top:16px;max-width:62ch;font-size:16px"><span class="mlma-meta" style="margin-right:8px">На выходе</span>' +
          esc(action.outcome) +
          '</p>'
        : '') +
      '<div class="mlma-actions" style="margin-top:32px">' +
      btn(action.href, action.cta, 'primary') +
      (action.secondary ? btn(action.secondary.href, action.secondary.label) : '') +
      '</div></article>'
    );
  }

  D._ui.cabinetNav = cabinetNav;
  D._ui.nextActionCard = nextActionCard;
  D._ui.renderTrack = renderTrack;
})(typeof window !== 'undefined' ? window : globalThis);

/* __MLMA_UI_SPLIT__ */
(function (root) {
  'use strict';
  var D = root.MLMA;
  if (!D || !D._ui) return;
  var esc = D._ui.esc;
  var btn = D._ui.btn;
  var pageHead = D._ui.pageHead;
  var crumbs = D._ui.crumbs;
  var badge = D._ui.badge;
  var emptyState = D._ui.emptyState;
  var cabinetNav = D._ui.cabinetNav;
  var queryParam = D._ui.queryParam;

  function cabinetStatusBanner(state) {
    var mode = state.account && state.account.storageMode;
    if (mode === 'restoring') return '<div class="mlma-state mlma-state-load" role="status">Данные восстанавливаются…</div>';
    if (mode === 'offline') return '<div class="mlma-state mlma-state-warn" role="status">Нет соединения. Показана локальная копия. Серверные данные не удалялись.</div>';
    if (mode === 'error') return '<div class="mlma-state mlma-state-warn" role="status">Ошибка сервера. Маршрут сохранён в этом браузере и будет синхронизирован позже.</div>';
    return '';
  }

  function uniqueSavedIds(state) {
    var ids = (state.profile && state.profile.savedTrackIds) || [];
    if (state.account && state.account.savedTrackIds && state.account.savedTrackIds.length) ids = state.account.savedTrackIds;
    return D.uniqueTrackIds ? D.uniqueTrackIds(ids) : ids;
  }

  function trackById(state, id) {
    if (state.index && state.index[id]) return state.index[id];
    return D.getById ? D.getById(state.tracks, id, true) : null;
  }

  function userStatusLabel(account) {
    var state = D.resolveUserState ? D.resolveUserState(account) : 'registered';
    return { guest: 'Гость', registered: 'Бесплатный кабинет · FREE', paid: 'Есть доступ', expired: 'Доступ закончился' }[state] || 'Кабинет';
  }

  function routeTrackStatus(track, state, index) {
    if (!track) return { key: 'missing', label: 'нет в каталоге', tone: 'neutral', action: null };
    var entitled = D.isEntitledToTrack ? D.isEntitledToTrack(track, state.account) : false;
    var access = D.normalizeAccess ? D.normalizeAccess(track.access) : track.access;
    var run = state.account && state.account.runs ? state.account.runs[track.trackId] : null;
    var view = D.getTrackStatusView(track, { entitled: entitled });
    var href = state.R.track(track.trackId);
    if (run && (run.status === 'completed' || run.status === 'done')) {
      return { key: 'done', label: 'завершён', tone: 'good', action: { href: href, label: 'Открыть' } };
    }
    if (run && run.status && run.status !== 'preview') {
      return { key: 'started', label: 'начат', tone: 'accent', action: { href: href, label: 'Продолжить прохождение' } };
    }
    if (access === 'paid' && !entitled) {
      return { key: 'preparing', label: 'готовится', tone: 'warn', action: { href: (state.R.pricing && state.R.pricing()) || '/pricing', label: 'Готовится к запуску' } };
    }
    if (index === 0) return { key: 'next', label: 'рекомендован следующим', tone: 'accent', action: { href: href, label: view.canStart ? 'Открыть трек' : 'Открыть описание' } };
    if (entitled || access === 'public' || access === 'promo') {
      return { key: 'available', label: 'доступен', tone: 'good', action: { href: href, label: 'Открыть трек' } };
    }
    return { key: 'saved', label: 'сохранён', tone: 'neutral', action: { href: href, label: 'Открыть описание' } };
  }

  function renderMy(state) {
    var R = state.R;
    var account = state.account || { loggedIn: false };
    var savedIds = uniqueSavedIds(state);
    var savedTracks = [];
    for (var i = 0; i < savedIds.length; i += 1) {
      var found = trackById(state, savedIds[i]);
      if (found) savedTracks.push(found);
    }
    var greetingName = (state.profile.displayName || account.name || '').trim() || 'в Академии';
    var lastStarted = null;
    var runs = account.runs || {};
    var runKeys = Object.keys(runs);
    for (var r = 0; r < runKeys.length; r += 1) {
      var run = runs[runKeys[r]];
      if (!run || run.status === 'completed' || run.status === 'done' || run.status === 'preview') continue;
      var startedTrack = trackById(state, runKeys[r]);
      if (startedTrack && (!lastStarted || String(run.updatedAt || '') > String(lastStarted.run.updatedAt || ''))) {
        lastStarted = { track: startedTrack, run: run };
      }
    }
    var nearestResult = account.artifacts && account.artifacts[0] ? account.artifacts[0] : null;
    var rec = D.recommendedAction
      ? D.recommendedAction({ account: account, profile: state.profile, tracks: state.tracks })
      : { title: 'Подобрать трек', why: '', href: R.start(), cta: 'Подобрать трек', secondary: { href: R.library(), label: 'Открыть библиотеку' } };
    var routeCard = savedTracks.length
      ? '<section class="mlma-card mlma-pad"><span class="mlma-eyebrow">Активный маршрут</span><h2 class="mlma-h3" style="margin-top:12px">' +
        esc(savedTracks[0].title) +
        '</h2><p class="mlma-muted" style="margin-top:8px">' +
        esc(savedTracks[0].situation) +
        '</p><p class="mlma-meta" style="margin-top:12px">' +
        savedTracks.length +
        ' ' +
        esc(D.pluralTracks(savedTracks.length)) +
        '</p><div class="mlma-actions" style="margin-top:16px">' +
        btn(R.myRoute(), 'Открыть маршрут', 'primary') +
        '</div></section>'
      : '<section class="mlma-card mlma-pad"><span class="mlma-eyebrow">Маршрут</span><h2 class="mlma-h3" style="margin-top:12px">Ваш маршрут пока пуст. Опишите ситуацию — мы подберём первый полезный трек.</h2><div class="mlma-actions" style="margin-top:20px">' +
        btn(R.start(), 'Подобрать трек', 'primary') +
        btn(R.library(), 'Открыть библиотеку') +
        '</div></section>';
    var startedCard = lastStarted
      ? '<section class="mlma-card mlma-pad"><span class="mlma-eyebrow">Последний начатый трек</span><h2 class="mlma-h3" style="margin-top:12px">' +
        esc(lastStarted.track.title) +
        '</h2><div class="mlma-actions" style="margin-top:16px">' +
        btn(R.track(lastStarted.track.trackId), 'Продолжить', 'primary') +
        '</div></section>'
      : '<section class="mlma-card mlma-pad"><span class="mlma-eyebrow">Последний начатый трек</span><p class="mlma-muted" style="margin-top:12px">Когда начнёте трек, продолжение появится здесь.</p></section>';
    var resultCard = nearestResult
      ? '<section class="mlma-card mlma-pad"><span class="mlma-eyebrow">Ближайший результат</span><p style="margin-top:12px;font-weight:700">' +
        esc(nearestResult.preview || nearestResult.kind || 'Результат') +
        '</p><div class="mlma-actions" style="margin-top:16px">' +
        btn(R.myResults(), 'Открыть результаты') +
        '</div></section>'
      : '<section class="mlma-card mlma-pad"><span class="mlma-eyebrow">Ближайший результат</span><p class="mlma-muted" style="margin-top:12px">Результат отсутствует. Он появится после рабочего следа, а не после просмотра.</p></section>';
    var savedList = '<p class="mlma-muted" style="margin-top:12px">Сохранённых треков пока нет.</p>';
    if (savedTracks.length) {
      savedList = '<ul class="mlma-cabinet-list">';
      for (var s = 0; s < Math.min(4, savedTracks.length); s += 1) {
        var st = routeTrackStatus(savedTracks[s], state, s);
        savedList +=
          '<li><a href="' +
          esc(R.track(savedTracks[s].trackId)) +
          '"><span class="mlma-meta">' +
          esc(savedTracks[s].trackId) +
          ' · ' +
          esc(st.label) +
          '</span><span class="mlma-cabinet-title">' +
          esc(savedTracks[s].title) +
          '</span></a></li>';
      }
      savedList += '</ul>';
    }
    return (
      pageHead(
        {
          eyebrow: 'Кабинет',
          title: 'Здравствуйте, ' + greetingName,
          lead: 'Одно следующее действие. Остальное — маршрут, треки и доступ.',
          crumbs: [
            { label: 'Academy', href: R.home() },
            { label: 'Кабинет' },
          ],
        },
        R,
      ) +
      (cabinetNav ? cabinetNav(state) : '') +
      cabinetStatusBanner(state) +
      '<div class="mlma-wrap mlma-split mlma-split-84" style="padding-top:24px;padding-bottom:56px"><div style="display:grid;gap:24px;align-content:start">' +
      '<section class="mlma-card mlma-pad"><span class="mlma-meta">Статус</span><p style="margin-top:8px;font-weight:800">' +
      esc(userStatusLabel(account)) +
      '</p></section>' +
      '<article class="mlma-card mlma-lime mlma-pad-lg" style="padding:32px"><span class="mlma-meta">Следующее действие</span><h2 class="mlma-h2" style="margin-top:16px">' +
      esc(rec.title) +
      '</h2><p class="mlma-lead" style="margin-top:16px">' +
      esc(rec.why || '') +
      '</p><div class="mlma-actions" style="margin-top:24px">' +
      btn(rec.href, rec.cta, 'primary') +
      (rec.secondary ? btn(rec.secondary.href, rec.secondary.label) : '') +
      '</div></article>' +
      routeCard +
      startedCard +
      resultCard +
      '</div><aside style="display:grid;gap:16px;align-content:start">' +
      '<section class="mlma-card mlma-pad"><span class="mlma-eyebrow">Сохранённые треки</span>' +
      savedList +
      '<div style="margin-top:16px">' +
      btn(R.mySaved(), 'Все сохранённые', '', 'mlma-btn-small') +
      '</div></section>' +
      '<section class="mlma-card mlma-pad"><span class="mlma-eyebrow">Доступ</span><h2 class="mlma-h3" style="margin-top:12px">' +
      esc(userStatusLabel(account)) +
      '</h2><p class="mlma-muted" style="margin-top:8px">Платные материалы группе FREE не открываются. Платные треки готовятся к запуску.</p><div class="mlma-actions" style="margin-top:16px">' +
      btn((R.purchases && R.purchases()) || '/my/purchases', 'Покупки и доступ', '', 'mlma-btn-small') +
      btn(R.profile(), 'Профиль', '', 'mlma-btn-small') +
      '</div></section></aside></div>'
    );
  }

  function stepper(nodes) {
    var html = '<ol class="mlma-stepper">';
    for (var i = 0; i < nodes.length; i += 1) {
      var node = nodes[i];
      var cls = node.state === 'done' ? 'mlma-step-done' : node.state === 'current' ? 'mlma-step-now' : '';
      var label = node.state === 'done' ? 'Сделано' : node.state === 'current' ? 'Сейчас' : 'Дальше';
      var title = node.linkable
        ? '<a href="' + esc(node.href) + '">' + esc(node.label) + '</a>'
        : esc(node.label);
      html +=
        '<li class="mlma-step ' +
        cls +
        '" style="' +
        D.styleAttr(node.sectionId) +
        '"><span class="mlma-step-dot" aria-hidden="true"></span><span class="mlma-meta" style="display:block">' +
        esc(node.trackId) +
        '</span><span style="display:block;margin-top:8px;font-size:15px;font-weight:700">' +
        title +
        '</span><span class="mlma-meta mlma-muted" style="display:block;margin-top:8px">' +
        label +
        '</span></li>';
    }
    return html + '</ol>';
  }

  function renderRoute(state) {
    var R = state.R;
    var tab = queryParam('tab');
    var savedIds = uniqueSavedIds(state);
    function classify(track) {
      var st = routeTrackStatus(track, state, -1);
      var entitled = D.isEntitledToTrack ? D.isEntitledToTrack(track, state.account) : false;
      var access = D.normalizeAccess ? D.normalizeAccess(track.access) : track.access;
      var purchased = entitled && access === 'paid';
      return { st: st, entitled: entitled, access: access, purchased: purchased };
    }
    function tracksTabBlock() {
      var sub = queryParam('set') || 'available';
      var ids = savedIds.concat(state.account && state.account.runs ? Object.keys(state.account.runs) : []);
      ids = D.uniqueTrackIds ? D.uniqueTrackIds(ids) : ids;
      var buckets = { available: [], started: [], done: [] };
      for (var i = 0; i < ids.length; i += 1) {
        var track = trackById(state, ids[i]);
        if (!track) continue;
        var info = classify(track);
        if (info.st.key === 'done') buckets.done.push(track);
        else if (info.st.key === 'started') buckets.started.push(track);
        else if (info.purchased || info.access === 'public' || info.access === 'promo') buckets.available.push(track);
      }
      var current = buckets[sub] || buckets.available;
      var nav =
        '<div class="mlma-chip-row" style="margin-bottom:20px">' +
        [['available', 'Доступные'], ['started', 'Начатые'], ['done', 'Завершённые']].map(function (pair) {
          return '<a class="mlma-chip' + (sub === pair[0] ? ' mlma-chip-on' : '') + '" href="' + esc(R.myTracks() + '&set=' + pair[0]) + '">' + pair[1] + '</a>';
        }).join('') +
        '</div>';
      if (!current.length) {
        return nav + emptyState({
          title: sub === 'done' ? 'Завершённых треков пока нет' : sub === 'started' ? 'Начатых треков пока нет' : 'Пока нет доступных треков',
          description: 'Закрытый трек может лежать в маршруте, но не считается приобретённым, пока нет оплаты.',
          actions: btn(R.library(), 'Открыть библиотеку', 'primary'),
        });
      }
      var html = nav + '<ul class="mlma-route-list">';
      for (var t = 0; t < current.length; t += 1) {
        var item = current[t];
        var st = routeTrackStatus(item, state, t);
        html += routeRow(item, st, t, state, false);
      }
      return html + '</ul>';
    }
    function routeRow(track, st, index, state, controls) {
      var cover = D.sectionCoverUrl ? D.sectionCoverUrl(track.sectionId) : '';
      return (
        '<li class="mlma-route-item mlma-card" style="' +
        D.styleAttr(track.sectionId) +
        '"><span class="mlma-route-num">' +
        (index + 1) +
        '</span>' +
        (cover ? '<img class="mlma-route-cover" src="' + esc(cover) + '" alt="">' : '<span class="mlma-route-cover mlma-route-cover-empty"></span>') +
        '<div class="mlma-route-body"><span class="mlma-meta">' +
        esc(track.trackId) +
        ' · ' +
        esc(st.label) +
        '</span><a class="mlma-cabinet-title" href="' +
        esc(state.R.track(track.trackId)) +
        '">' +
        esc(track.title) +
        '</a><p class="mlma-muted">' +
        esc(track.situation) +
        '</p><p>Ожидаемый результат: ' +
        esc(track.outcome) +
        '</p><div class="mlma-actions" style="margin-top:12px">' +
        (st.action ? btn(st.action.href, st.action.label, 'primary', 'mlma-btn-small') : '') +
        (controls
          ? '<button type="button" class="mlma-btn mlma-btn-small" data-mlma-route-del="' +
            esc(track.trackId) +
            '">Удалить из маршрута</button>' +
            (index > 0 ? '<button type="button" class="mlma-btn mlma-btn-small" data-mlma-route-up="' + esc(track.trackId) + '">Выше</button>' : '') +
            '<button type="button" class="mlma-btn mlma-btn-small" data-mlma-route-down="' + esc(track.trackId) + '">Ниже</button>'
          : '') +
        '</div></div></li>'
      );
    }
    if (tab === 'tracks') {
      return (
        pageHead({ eyebrow: 'Кабинет', title: 'Мои треки', lead: 'Доступные, начатые и завершённые. Закрытый трек в маршруте не считается купленным.', crumbs: [{ label: 'Academy', href: R.home() }, { label: 'Кабинет', href: R.my() }, { label: 'Мои треки' }] }, R) +
        (cabinetNav ? cabinetNav(state) : '') +
        cabinetStatusBanner(state) +
        '<div class="mlma-wrap" style="padding-top:24px;padding-bottom:56px">' +
        tracksTabBlock() +
        '</div>'
      );
    }
    if (tab === 'saved') {
      var savedHtml = savedIds.length
        ? '<ul class="mlma-route-list">' + savedIds.map(function (id, idx) {
            var track = trackById(state, id);
            if (!track) return '';
            return routeRow(track, routeTrackStatus(track, state, idx), idx, state, true);
          }).join('') + '</ul>'
        : emptyState({ title: 'Пока ничего не сохранено', description: 'Отметьте карточку в библиотеке — она появится здесь и в маршруте.', actions: btn(R.library(), 'Открыть библиотеку', 'primary') });
      return (
        pageHead({ eyebrow: 'Кабинет', title: 'Сохранённое', lead: 'Треки, которые вы отметили. Это ещё не покупка.', crumbs: [{ label: 'Academy', href: R.home() }, { label: 'Кабинет', href: R.my() }, { label: 'Сохранённое' }] }, R) +
        (cabinetNav ? cabinetNav(state) : '') +
        cabinetStatusBanner(state) +
        '<div class="mlma-wrap" style="padding-top:24px;padding-bottom:56px">' + savedHtml + '</div>'
      );
    }
    var rows = '';
    for (var n = 0; n < savedIds.length; n += 1) {
      var track = trackById(state, savedIds[n]);
      if (!track) continue;
      rows += routeRow(track, routeTrackStatus(track, state, n), n, state, true);
    }
    var body = savedIds.length
      ? '<ol class="mlma-route-list">' + rows + '</ol>'
      : emptyState({
          title: 'Ваш маршрут пока пуст. Опишите ситуацию — мы подберём первый полезный трек.',
          description: 'Маршрут собирается из сохранённых треков. Закрытый трек можно держать в очереди, не открывая содержание.',
          actions: btn(R.start(), 'Подобрать трек', 'primary') + btn(R.library(), 'Открыть библиотеку'),
        });
    return (
      pageHead(
        {
          eyebrow: 'Кабинет',
          title: 'Мой маршрут',
          lead: 'Последовательность выбранных треков: статус доступа, прохождение и следующее действие.',
          crumbs: [
            { label: 'Academy', href: R.home() },
            { label: 'Кабинет', href: R.my() },
            { label: 'Мой маршрут' },
          ],
        },
        R,
      ) +
      (cabinetNav ? cabinetNav(state) : '') +
      cabinetStatusBanner(state) +
      '<div class="mlma-wrap" style="padding-top:24px;padding-bottom:56px">' +
      body +
      '</div>'
    );
  }

  function renderResults(state) {
    var R = state.R;
    var runs = D.listRuntimes ? D.listRuntimes() : {};
    var items = [];
    Object.keys(runs).forEach(function (id) {
      var row = runs[id];
      if (!row || row.status === 'preview') return;
      var track = D.getById(state.allTracks, id, true);
      items.push({
        trackId: id,
        title: track ? track.title : id,
        status: row.status,
        updatedAt: row.updatedAt || '',
        verificationLabel: row.verificationLabel || 'Самопроверка по критериям',
        storage: 'device',
      });
    });
    items.sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
    var listHtml = '';
    if (!items.length) {
      listHtml = emptyState({
        eyebrow: 'Пока пусто',
        title: 'Здесь пока нет результатов',
        description: 'Они появятся не после просмотра урока, а когда вы сделаете действие и сохраните то, что получилось. Пока содержание треков в контуре, результат остаётся на этом устройстве.',
        actions: btn(R.library(), 'Открыть библиотеку', 'primary') + btn(R.my(), 'Личная главная'),
      });
    } else {
      listHtml = '<ul style="display:grid;gap:16px">';
      for (var i = 0; i < items.length; i += 1) {
        var item = items[i];
        listHtml +=
          '<li class="mlma-card mlma-pad"><span class="mlma-meta">' +
          esc(item.trackId) +
          ' · ' +
          esc(item.status === 'complete' ? 'завершён' : item.status) +
          '</span><h2 class="mlma-h3" style="margin-top:10px">' +
          esc(item.title) +
          '</h2><p class="mlma-muted" style="margin-top:8px;font-size:14px">' +
          esc(item.verificationLabel) +
          '</p><p class="mlma-muted" style="margin-top:8px;font-size:14px">Сохранено на этом устройстве. Синхронизация между устройствами пока недоступна.</p><div class="mlma-actions" style="margin-top:16px">' +
          btn(R.track(item.trackId), 'Открыть трек', 'primary') +
          '</div></li>';
      }
      listHtml += '</ul>';
    }
    return (
      pageHead(
        {
          eyebrow: 'Личный контур',
          title: 'Мои результаты',
          lead: 'Единица прогресса здесь — не просмотр, а произведённый результат.',
          crumbs: [
            { label: 'Academy', href: R.home() },
            { label: 'Кабинет', href: R.my() },
            { label: 'Результаты' },
          ],
        },
        R,
      ) +
      (cabinetNav ? cabinetNav(state) : '') +
      '<div class="mlma-wrap" style="padding-top:24px;padding-bottom:56px;display:grid;gap:24px">' +
      listHtml +
      '</div>'
    );
  }

  function renderProfile(state) {
    var R = state.R;
    var savedTracks = [];
    for (var i = 0; i < state.profile.savedTrackIds.length; i += 1) {
      for (var t = 0; t < state.tracks.length; t += 1) {
        if (state.tracks[t].trackId === state.profile.savedTrackIds[i]) savedTracks.push(state.tracks[t]);
      }
    }
    var options = '<option value="">Не выбран</option>';
    for (var s = 0; s < D.SECTION_IDS.length; s += 1) {
      var id = D.SECTION_IDS[s];
      var section = state.sectionById[id];
      options +=
        '<option value="' +
        id +
        '"' +
        (state.profile.selectedSectionId === id ? ' selected' : '') +
        '>' +
        id +
        ' · ' +
        esc(section ? section.shortTitle : id) +
        '</option>';
    }
    var savedHtml = '';
    if (!savedTracks.length) {
      savedHtml = '<p class="mlma-muted" style="margin-top:16px;font-size:15px">Сохранить трек можно с его страницы кнопкой «Сохранить в мой маршрут».</p>';
    } else {
      savedHtml = '<ul style="margin-top:16px;display:grid;gap:12px">';
      for (var x = 0; x < savedTracks.length; x += 1) {
        savedHtml +=
          '<li style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px" class="mlma-row"><a href="' +
          esc(R.track(savedTracks[x].trackId)) +
          '" style="max-width:60%"><span class="mlma-meta" style="display:block">' +
          esc(savedTracks[x].trackId) +
          '</span><span style="display:block;margin-top:4px;font-size:15px;font-weight:700">' +
          esc(savedTracks[x].title) +
          '</span></a><button type="button" class="mlma-btn mlma-btn-small" data-mlma-save="' +
          esc(savedTracks[x].trackId) +
          '">Убрать</button></li>';
      }
      savedHtml += '</ul>';
    }
    return (
      pageHead(
        {
          eyebrow: 'Кабинет',
          title: 'Профиль и настройки',
          lead: 'Имя, роль и задача. Необязательные вопросы можно пропустить и заполнить позже.',
          crumbs: [
            { label: 'Academy', href: R.home() },
            { label: 'Кабинет', href: R.my() },
            { label: 'Профиль' },
          ],
        },
        R,
      ) +
      (cabinetNav ? cabinetNav(state) : '') +
      '<div class="mlma-wrap mlma-split mlma-split-75" style="padding-top:24px;padding-bottom:56px">' +
      '<form class="mlma-card mlma-pad-lg" style="padding:28px" id="mlma-profile-form"><span class="mlma-eyebrow mlma-eyebrow-dark">Короткая настройка</span>' +
      '<h2 class="mlma-h3" style="margin-top:16px">Заполняется за одну-две минуты</h2>' +
      '<div style="margin-top:28px;display:grid;gap:20px">' +
      '<div><span class="mlma-meta" style="display:block;margin-bottom:8px">Email</span><p style="font-weight:700">' +
      esc((state.account && state.account.email) || 'Появится после входа') +
      '</p></div>' +
      '<div><label class="mlma-meta" style="display:block;margin-bottom:8px" for="mlma-name">Имя</label>' +
      '<input id="mlma-name" class="mlma-field" name="displayName" maxlength="80" value="' +
      esc(state.profile.displayName || (state.account && state.account.name) || '') +
      '"></div>' +
      '<div><span class="mlma-meta" style="display:block;margin-bottom:8px">Роль</span>' +
      '<div class="mlma-chip-row">' +
      [['novice', 'Новичок'], ['partner', 'Партнёр'], ['leader', 'Лидер']].map(function (pair) {
        return (
          '<label class="mlma-chip"><input type="radio" name="partnerRole" value="' +
          pair[0] +
          '"' +
          (state.profile.partnerRole === pair[0] ? ' checked' : '') +
          '> ' +
          pair[1] +
          '</label>'
        );
      }).join('') +
      '</div></div>' +
      '<div><label class="mlma-meta" style="display:block;margin-bottom:8px" for="mlma-experience">Опыт в MLM <span class="mlma-muted">необязательно</span></label>' +
      '<select id="mlma-experience" class="mlma-field" name="experience"><option value="">Пропустить</option>' +
      [['none', 'Только начинаю'], ['under_year', 'Меньше года'], ['one_three', '1–3 года'], ['three_plus', 'Больше трёх лет']].map(function (pair) {
        return '<option value="' + pair[0] + '"' + (state.profile.experience === pair[0] ? ' selected' : '') + '>' + pair[1] + '</option>';
      }).join('') +
      '</select></div>' +
      '<div><label class="mlma-meta" style="display:block;margin-bottom:8px" for="mlma-task">Текущая задача <span class="mlma-muted">необязательно</span></label>' +
      '<input id="mlma-task" class="mlma-field" name="currentTask" maxlength="240" value="' +
      esc(state.profile.currentTask || state.profile.currentGoal) +
      '" placeholder="Например: написать первому знакомому"></div>' +
      '<div><label class="mlma-meta" style="display:block;margin-bottom:8px" for="mlma-difficulty">Основная трудность <span class="mlma-muted">необязательно</span></label>' +
      '<input id="mlma-difficulty" class="mlma-field" name="difficulty" maxlength="240" value="' +
      esc(state.profile.difficulty) +
      '"></div>' +
      '<div><label class="mlma-meta" style="display:block;margin-bottom:8px" for="mlma-result">Желаемый результат <span class="mlma-muted">необязательно</span></label>' +
      '<input id="mlma-result" class="mlma-field" name="desiredResult" maxlength="240" value="' +
      esc(state.profile.desiredResult) +
      '"></div>' +
      '<div><label class="mlma-meta" style="display:block;margin-bottom:8px" for="mlma-time">Доступное время <span class="mlma-muted">необязательно</span></label>' +
      '<select id="mlma-time" class="mlma-field" name="availableTime"><option value="">Пропустить</option>' +
      [['15', '15 минут'], ['30', '30 минут'], ['60', 'Час'], ['more', 'Больше часа']].map(function (pair) {
        return '<option value="' + pair[0] + '"' + (state.profile.availableTime === pair[0] ? ' selected' : '') + '>' + pair[1] + '</option>';
      }).join('') +
      '</select></div>' +
      '<div><label class="mlma-meta" style="display:block;margin-bottom:8px" for="mlma-section">Текущий раздел</label>' +
      '<select id="mlma-section" class="mlma-field" name="section">' +
      options +
      '</select></div>' +
      '<label style="display:flex;gap:10px;align-items:flex-start;font-size:14px"><input type="checkbox" id="mlma-consent" name="consent"' +
      (state.profile.consentAt ? ' checked' : '') +
      '> Согласен на обработку персональных данных для работы кабинета. <a href="' +
      esc((R.consent && R.consent()) || '/consent') +
      '" target="_blank" rel="noopener">Согласие</a> и <a href="' +
      esc((R.privacy && R.privacy()) || '/privacy') +
      '" target="_blank" rel="noopener">политика</a></label>' +
      '<label style="display:flex;gap:10px;align-items:flex-start;font-size:14px"><input type="checkbox" id="mlma-notify" name="notifyEmail"' +
      (state.profile.notifyEmail === true ? ' checked' : '') +
      '> Присылать письма о маршруте на email кабинета. <a href="' +
      esc((R.marketingConsent && R.marketingConsent()) || '/marketing-consent') +
      '" target="_blank" rel="noopener">Согласие на рекламные сообщения</a></label>' +
      '</div>' +
      '<div class="mlma-actions" style="margin-top:32px"><button type="submit" class="mlma-btn mlma-btn-primary">Сохранить</button>' +
      '<button type="button" class="mlma-btn" data-mlma-skip-onboarding="1">Пропустить необязательное</button></div>' +
      '<p id="mlma-profile-msg" style="margin-top:20px;font-size:15px;font-weight:700" aria-live="polite"></p>' +
      '<p class="mlma-muted" style="margin-top:20px;font-size:14px">' +
      (state.account && state.account.storageMode === 'server'
        ? 'Профиль сохраняется в кабинете и доступен с другого устройства.'
        : 'Серверное хранение ещё не подключено. Сейчас профиль остаётся в этом браузере; вход Tilda при этом сохраняется.') +
      '</p></form>' +
      '<aside style="display:grid;gap:16px"><section class="mlma-card mlma-pad"><span class="mlma-eyebrow">Безопасность</span><h2 class="mlma-h3" style="margin-top:16px">Сессия Tilda</h2><p class="mlma-muted" style="margin-top:12px;font-size:15px">' +
      esc((state.account && state.account.email) || 'Email кабинета появится после входа') +
      '</p><div class="mlma-actions" style="margin-top:16px;flex-direction:column">' +
      btn((D.membersRecoverUrl && D.membersRecoverUrl()) || '/members/login?mlma=recover', 'Сменить пароль', '', 'mlma-btn-small') +
      '<a class="mlma-btn mlma-btn-small" href="' +
      esc((R.logout && R.logout()) || '/members/login?exit=y') +
      '" data-mlma-logout="1">Выйти</a>' +
      '</div></section><section class="mlma-card mlma-pad"><span class="mlma-eyebrow">Сохранённое</span><h2 class="mlma-h3" style="margin-top:16px">' +
      (savedTracks.length === 0 ? 'Пока ничего не сохранено' : savedTracks.length + ' в маршруте') +
      '</h2>' +
      savedHtml +
      '</section><section class="mlma-card mlma-pad"><span class="mlma-eyebrow">Доступ</span><h2 class="mlma-h3" style="margin-top:16px">Покупки</h2><p class="mlma-muted" style="margin-top:16px;font-size:15px">Настоящих заказов пока нет. Сохранённый трек не считается купленным.</p><div style="margin-top:20px">' +
      btn((R.purchases && R.purchases()) || '/my/purchases', 'Покупки и доступ', '', 'mlma-btn-small') +
      '</div></section></aside></div>'
    );
  }

  D._ui.uniqueSavedIds = uniqueSavedIds;
  D._ui.trackById = trackById;
  D._ui.userStatusLabel = userStatusLabel;
  D._ui.renderMy = renderMy;
  D._ui.renderRoute = renderRoute;
  D._ui.renderResults = renderResults;
  D._ui.renderProfile = renderProfile;
})(typeof window !== 'undefined' ? window : globalThis);

/* __MLMA_UI_SPLIT__ */
(function (root) {
  'use strict';
  var D = root.MLMA;
  if (!D || !D._ui) return;
  var esc = D._ui.esc;
  var btn = D._ui.btn;
  var pageHead = D._ui.pageHead;
  var cabinetNav = D._ui.cabinetNav;
  var uniqueSavedIds = D._ui.uniqueSavedIds;
  var trackById = D._ui.trackById;
  var userStatusLabel = D._ui.userStatusLabel;

  function priceLine(product) {
    if (product.launch_price == null && product.regular_price == null) return 'Цена появится после запуска';
    if (Number(product.launch_price) === 0 && Number(product.regular_price) === 0) return '0 ₽';
    var launch = D.formatPrice ? D.formatPrice(product.launch_price) : product.launch_price + ' ₽';
    var regular = D.formatPrice ? D.formatPrice(product.regular_price) : product.regular_price + ' ₽';
    var current = product.launch_price != null ? launch : regular;
    return '<span class="mlma-h3 mlma-price">' + esc(current) + '</span>';
  }

  function renderAccess(state) {
    var R = state.R;
    var logged = !!(state.account && state.account.loggedIn);
    return (
      pageHead(
        {
          eyebrow: 'Доступ',
          title: 'Какие форматы доступа будут',
          lead: 'Сейчас работает бесплатный кабинет FREE. Платные продукты готовятся: купить их нельзя, пока не опубликован первый complete-трек и не подключена оплата.',
          crumbs: [{ label: 'Academy', href: R.home() }, { label: 'Доступ' }],
        },
        R,
      ) +
      '<div class="mlma-wrap" style="padding-top:24px;padding-bottom:56px;display:grid;gap:20px">' +
      '<section class="mlma-card mlma-pad"><span class="mlma-eyebrow">FREE</span><h2 class="mlma-h3" style="margin-top:12px">Бесплатный кабинет</h2><p class="mlma-muted" style="margin-top:12px;max-width:70ch">Вход, сохранение маршрута, локальные результаты. Это не полный промотрек и не FULL. Карточка трека в каталоге — описание, а не купленный продукт.</p></section>' +
      '<section class="mlma-card mlma-pad"><span class="mlma-eyebrow">Разовые покупки</span><h2 class="mlma-h3" style="margin-top:12px">Один трек, мини-маршрут, маршрут из шести</h2><p class="mlma-muted" style="margin-top:12px;max-width:70ch">Будущие разовые покупки на 365 дней. Сейчас статус gated. Metadata-only и planned нельзя продавать. 112 карточек каталога не означают 112 готовых треков.</p></section>' +
      '<section class="mlma-card mlma-pad"><span class="mlma-eyebrow">Команда</span><h2 class="mlma-h3" style="margin-top:12px">Маршруты для новичков и партнёров</h2><p class="mlma-muted" style="margin-top:12px;max-width:70ch">Лидер запускает маршруты и снижает ручное сопровождение. Командный формат готовится. Автоматической оплаты нет.</p></section>' +
      '<section class="mlma-card mlma-pad"><span class="mlma-eyebrow">Компания</span><h2 class="mlma-h3" style="margin-top:12px">Корпоративный пилот</h2><p class="mlma-muted" style="margin-top:12px;max-width:70ch">Активация, удержание, аналитика и связь прохождения с коммерческим результатом. Только переговоры, без карточного checkout.</p></section>' +
      '<section class="mlma-card mlma-pad"><span class="mlma-eyebrow">Состояния</span><ul class="mlma-muted" style="margin-top:12px;display:grid;gap:8px;font-size:15px"><li>сохранено — трек в маршруте, это не покупка;</li><li>доступно бесплатно — публичный или промо контур;</li><li>куплено — появится после серверного права;</li><li>закрыто — платное содержание без права;</li><li>готовится — metadata-only, planned или gated.</li></ul></section>' +
      '<div class="mlma-actions">' +
      btn((R.pricing && R.pricing()) || '/pricing', 'Смотреть тарифы', 'primary') +
      (logged ? btn((R.purchases && R.purchases()) || '/my/purchases', 'Покупки в кабинете') : btn(D.membersSignupUrl('/my'), 'Создать бесплатный кабинет')) +
      btn((R.paymentAndAccess && R.paymentAndAccess()) || '/payment-and-access', 'Как будет устроена оплата') +
      '</div></div>'
    );
  }

  function renderPricing(state) {
    var R = state.R;
    var b2c = D.publicB2CProducts ? D.publicB2CProducts() : [];
    var cards = '';
    for (var i = 0; i < b2c.length; i += 1) {
      var p = b2c[i];
      var from = p.product_code === 'B2C-FREE-001' ? '0 ₽' : 'от ' + (D.formatPrice ? D.formatPrice(p.launch_price) : p.launch_price + ' ₽');
      cards +=
        '<article class="mlma-card mlma-pad" style="padding:24px"><span class="mlma-eyebrow">' +
        esc(D.storefrontStatusLabel ? D.storefrontStatusLabel(p) : 'Готовится к запуску') +
        '</span><h2 class="mlma-h3" style="margin-top:12px">' +
        esc(p.display_name) +
        '</h2><p class="mlma-muted" style="margin-top:12px">' +
        esc(p.short_description) +
        '</p><p style="margin-top:16px">' +
        priceLine(p) +
        '</p><p class="mlma-meta" style="margin-top:8px">' +
        esc(from) +
        (p.access_days ? ' · ' + p.access_days + ' дней доступа' : '') +
        '</p><div class="mlma-actions" style="margin-top:20px">' +
        '<span class="mlma-btn mlma-btn-primary" aria-disabled="true">Готовится к запуску</span>' +
        '</div></article>';
    }
    return (
      pageHead(
        {
          eyebrow: 'Тарифы',
          title: 'Что можно будет получить и для кого',
          lead: 'Ориентиры цены уже есть. Оплатить пока нельзя: продукты gated, эквайринг не подключён. Это не 112 готовых треков. Правила оплаты, доступа и возврата — отдельным документом.',
          crumbs: [{ label: 'Academy', href: R.home() }, { label: 'Тарифы' }],
        },
        R,
      ) +
      '<div class="mlma-wrap" style="padding-top:24px;padding-bottom:56px;display:grid;gap:28px">' +
      '<section><span class="mlma-eyebrow">Для себя</span><h2 class="mlma-h2" style="margin-top:12px">Новичок и партнёр</h2><p class="mlma-muted" style="margin-top:8px;max-width:70ch">Конкретная задача, один следующий шаг, отдельный трек или короткий маршрут. Понятный результат. Оплатить пока нельзя.</p><div class="mlma-grid-2" style="margin-top:16px;display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">' +
      cards +
      '</div></section>' +
      '<section class="mlma-card mlma-pad"><span class="mlma-eyebrow">Для команды</span><h2 class="mlma-h3" style="margin-top:12px">Лидер запускает маршруты</h2><p class="mlma-muted" style="margin-top:12px;max-width:70ch">Лидер — ранний покупатель командного решения: запуск новичков, меньше ручного сопровождения, контроль прохождения. Наставник видит точки остановки, но не считается автоматически плательщиком. Командный формат готовится. Подписка не продаётся.</p><div class="mlma-actions" style="margin-top:20px">' +
      btn(D.siteHomeUrl(), 'Обсудить командный запуск', 'primary') +
      '</div></section>' +
      '<section class="mlma-card mlma-pad"><span class="mlma-eyebrow">Для компании</span><h2 class="mlma-h3" style="margin-top:12px">Корпоративный пилот</h2><p class="mlma-muted" style="margin-top:12px;max-width:70ch">Маршруты для сегментов сети, контроль активации, управленческая аналитика, связь действий с коммерческими результатами. До 30 участников, 8 недель. Ориентир 99 000–149 000 ₽. Только переговоры, без карточного checkout.</p><div class="mlma-actions" style="margin-top:20px">' +
      btn(D.siteHomeUrl(), 'Обсудить корпоративный пилот', 'primary') +
      '</div></section>' +
      '<p class="mlma-muted" style="font-size:14px">Оплата разовая. Автоматических повторных списаний нет. Подписка на всю библиотеку и PRO в интерфейс не выводятся. B2C и B2B не смешиваются в одну кнопку покупки. PAYMENTS_ENABLED=false. Правила: <a href="' +
      esc((R.paymentAndAccess && R.paymentAndAccess()) || '/payment-and-access') +
      '">оплата, доступ и возврат</a>.</p>' +
      '<div class="mlma-actions">' +
      btn(R.library(), 'Открыть библиотеку') +
      btn(R.access(), 'Состояния доступа') +
      btn((R.paymentAndAccess && R.paymentAndAccess()) || '/payment-and-access', 'Оплата и доступ') +
      '</div></div>'
    );
  }

  function linkifyEscaped(text) {
    var s = String(text || '');
    s = s.replace(/\bhttps:\/\/[a-zA-Z0-9._~:/?#@!$&'()*+,;=%-]+/g, function (url) {
      return '<a href="' + url + '">' + url + '</a>';
    });
    s = s.replace(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, function (email) {
      return '<a href="mailto:' + email + '">' + email + '</a>';
    });
    s = s.replace(/\+7[\d\s()-]{10,}/g, function (phone) {
      var tel = phone.replace(/[^\d+]/g, '');
      return '<a href="tel:' + tel + '">' + phone.trim() + '</a>';
    });
    return s;
  }

  function legalBody(section) {
    var html = '';
    var title = Array.isArray(section) ? section[0] : section.title;
    var text = Array.isArray(section) ? section[1] : section.text;
    var i;
    var j;
    if (text) {
      html += '<p class="mlma-muted" style="margin-top:12px;max-width:72ch">' + linkifyEscaped(esc(text)) + '</p>';
    }
    if (section && section.paragraphs) {
      for (i = 0; i < section.paragraphs.length; i += 1) {
        html += '<p class="mlma-muted" style="margin-top:12px;max-width:72ch">' + linkifyEscaped(esc(section.paragraphs[i])) + '</p>';
      }
    }
    if (section && section.items) {
      html += '<ul class="mlma-legal-list">';
      for (i = 0; i < section.items.length; i += 1) {
        html += '<li>' + linkifyEscaped(esc(section.items[i])) + '</li>';
      }
      html += '</ul>';
    }
    if (section && section.ordered) {
      html += '<ol class="mlma-legal-list">';
      for (i = 0; i < section.ordered.length; i += 1) {
        html += '<li>' + linkifyEscaped(esc(section.ordered[i])) + '</li>';
      }
      html += '</ol>';
    }
    if (section && section.rows) {
      html += '<dl class="mlma-legal-dl">';
      for (i = 0; i < section.rows.length; i += 1) {
        html += '<dt>' + esc(section.rows[i][0]) + '</dt><dd>' + linkifyEscaped(esc(section.rows[i][1])) + '</dd>';
      }
      html += '</dl>';
    }
    if (section && section.table && section.table.headers && section.table.rows) {
      html += '<div class="mlma-table-wrap"><table class="mlma-legal-table"><thead><tr>';
      for (i = 0; i < section.table.headers.length; i += 1) {
        html += '<th>' + esc(section.table.headers[i]) + '</th>';
      }
      html += '</tr></thead><tbody>';
      for (i = 0; i < section.table.rows.length; i += 1) {
        html += '<tr>';
        for (j = 0; j < section.table.rows[i].length; j += 1) {
          html += '<td>' + linkifyEscaped(esc(section.table.rows[i][j])) + '</td>';
        }
        html += '</tr>';
      }
      html += '</tbody></table></div>';
    }
    return (
      '<section class="mlma-card mlma-pad mlma-legal"><h2 class="mlma-h3">' +
      esc(title) +
      '</h2>' +
      html +
      '</section>'
    );
  }

  function renderLegalPage(state, kind) {
    var R = state.R;
    var doc = D.legalDocument ? D.legalDocument(kind) : null;
    if (!doc) {
      return pageHead({ eyebrow: 'Документ', title: 'Документ', lead: '' }, R);
    }
    var html = '';
    for (var i = 0; i < doc.sections.length; i += 1) {
      html += legalBody(doc.sections[i]);
    }
    var extra = '';
    if (kind === 'privacy') {
      extra =
        '<div class="mlma-actions"><button type="button" class="mlma-btn mlma-btn-primary" data-mlma-export-local="1">Выгрузить данные этого устройства</button>' +
        btn((R.consent && R.consent()) || '/consent', 'Согласие на обработку') +
        btn((R.cookies && R.cookies()) || '/cookies', 'Cookies') +
        btn((R.offer && R.offer()) || '/offer', 'Оферта') +
        '</div><p id="mlma-export-msg" class="mlma-muted" style="font-size:14px" aria-live="polite"></p>';
    } else if (kind === 'consent') {
      extra =
        '<div class="mlma-actions">' +
        btn((R.privacy && R.privacy()) || '/privacy', 'Политика конфиденциальности') +
        btn((R.signup && R.signup()) || '/members/signup', 'К регистрации', 'primary') +
        '</div>';
    } else if (kind === 'offer') {
      extra =
        '<div class="mlma-actions">' +
        btn((R.requisites && R.requisites()) || '/requisites', 'Реквизиты') +
        btn((R.paymentAndAccess && R.paymentAndAccess()) || '/payment-and-access', 'Оплата и доступ') +
        btn((R.pricing && R.pricing()) || '/pricing', 'Тарифы') +
        '</div>';
    } else if (kind === 'requisites') {
      extra =
        '<div class="mlma-actions">' +
        btn((R.offer && R.offer()) || '/offer', 'Оферта') +
        btn((R.privacy && R.privacy()) || '/privacy', 'Политика') +
        btn((R.documents && R.documents()) || '/documents', 'Все документы') +
        '</div>';
    } else if (kind === 'cookies') {
      extra =
        '<div class="mlma-actions">' +
        btn((R.privacy && R.privacy()) || '/privacy', 'Политика конфиденциальности') +
        '</div>';
    } else if (kind === 'marketing-consent') {
      extra =
        '<div class="mlma-actions">' +
        btn((R.privacy && R.privacy()) || '/privacy', 'Политика конфиденциальности') +
        btn((R.profile && R.profile()) || '/profile', 'Профиль') +
        '</div>';
    } else if (kind === 'payment-and-access') {
      extra =
        '<div class="mlma-actions">' +
        btn((R.offer && R.offer()) || '/offer', 'Оферта') +
        btn((R.requisites && R.requisites()) || '/requisites', 'Реквизиты') +
        btn((R.pricing && R.pricing()) || '/pricing', 'Тарифы', 'primary') +
        '</div>';
    }
    return (
      pageHead(
        {
          eyebrow: doc.eyebrow,
          title: doc.title,
          lead: doc.lead,
          crumbs: [
            { label: 'Academy', href: R.home() },
            { label: 'Документы', href: (R.documents && R.documents()) || '/documents' },
            { label: doc.crumb },
          ],
        },
        R,
      ) +
      '<div class="mlma-wrap" style="padding-top:24px;padding-bottom:56px;display:grid;gap:16px">' +
      html +
      extra +
      '</div>'
    );
  }

  function renderPrivacy(state) {
    return renderLegalPage(state, 'privacy');
  }

  function renderConsent(state) {
    return renderLegalPage(state, 'consent');
  }

  function renderOffer(state) {
    return renderLegalPage(state, 'offer');
  }

  function renderRequisites(state) {
    return renderLegalPage(state, 'requisites');
  }

  function renderCookies(state) {
    return renderLegalPage(state, 'cookies');
  }

  function renderMarketingConsent(state) {
    return renderLegalPage(state, 'marketing-consent');
  }

  function renderDocuments(state) {
    var R = state.R;
    var docs = D.publicDocuments ? D.publicDocuments() : [];
    var cards = '';
    for (var i = 0; i < docs.length; i += 1) {
      cards +=
        '<a class="mlma-card mlma-card-hover mlma-pad mlma-doc-card" href="' +
        esc(docs[i].path) +
        '"><span class="mlma-eyebrow">' +
        esc(docs[i].path) +
        '</span><h2 class="mlma-h3" style="margin-top:12px">' +
        esc(docs[i].title) +
        '</h2><p class="mlma-muted" style="margin-top:8px">' +
        esc(docs[i].lead) +
        '</p></a>';
    }
    return (
      pageHead(
        {
          eyebrow: 'Документы',
          title: 'Центр документов MLM Academy',
          lead: 'Отдельные публичные страницы. Тексты не объединены: каждый документ открывается по своему адресу без регистрации.',
          crumbs: [
            { label: 'Academy', href: R.home() },
            { label: 'Документы' },
          ],
        },
        R,
      ) +
      '<div class="mlma-wrap mlma-docs" style="padding-top:24px;padding-bottom:56px">' +
      '<div class="mlma-docs-grid">' +
      cards +
      '</div></div>'
    );
  }

  function renderPurchases(state) {
    var R = state.R;
    var savedIds = uniqueSavedIds(state);
    var rows = '';
    for (var i = 0; i < savedIds.length; i += 1) {
      var tr = trackById(state, savedIds[i]);
      if (!tr) continue;
      var cls = D.classifyAccessRow ? D.classifyAccessRow(tr, state.account, savedIds) : { key: 'saved', label: 'сохранено' };
      rows +=
        '<li class="mlma-row"><span>' +
        esc(tr.title) +
        '</span><span class="mlma-meta">' +
        esc(cls.label) +
        '</span></li>';
    }
    return (
      pageHead(
        {
          eyebrow: 'Кабинет',
          title: 'Покупки и доступ',
          lead: 'У вас пока нет покупок. Платные треки готовятся к запуску. Уже сейчас вы можете сохранять интересные треки в маршрут.',
          crumbs: [{ label: 'Кабинет', href: R.my() }, { label: 'Покупки' }],
        },
        R,
      ) +
      cabinetNav(state) +
      '<div class="mlma-wrap" style="padding-top:24px;padding-bottom:56px;display:grid;gap:20px">' +
      '<section class="mlma-card mlma-pad"><span class="mlma-eyebrow">FREE</span><h2 class="mlma-h3" style="margin-top:12px">' +
      esc(userStatusLabel(state.account)) +
      '</h2><p class="mlma-muted" style="margin-top:12px">Бесплатный кабинет не выдаёт FULL. Tilda Members не является источником платного права. Срок будущего разового доступа — 365 дней.</p></section>' +
      '<section class="mlma-card mlma-pad"><span class="mlma-eyebrow">Сохранённые маршруты</span>' +
      (rows ? '<ul style="margin-top:12px;display:grid;gap:8px">' + rows + '</ul>' : '<p class="mlma-muted" style="margin-top:12px">Пока ничего не сохранено. Сохранённый трек не считается купленным.</p>') +
      '</section>' +
      '<section class="mlma-card mlma-pad"><span class="mlma-eyebrow">Будущие доступы</span><p class="mlma-muted" style="margin-top:12px">Куплено / закрыто / готовится появятся после серверного подтверждения оплаты. В пилоте исполняется бесплатный трек A2-008; остальные 111 карточек — planned / metadata_only.</p></section>' +
      '<div class="mlma-actions">' +
      btn(R.library(), 'В библиотеку', 'primary') +
      btn((R.pricing && R.pricing()) || '/pricing', 'Смотреть тарифы') +
      '</div></div>'
    );
  }

  function renderPaymentAndAccess(state) {
    return renderLegalPage(state, 'payment-and-access');
  }

  function renderPreviewCommerce(state) {
    if (!D.commercePreviewAllowed || !D.commercePreviewAllowed()) {
      return pageHead({ eyebrow: 'Служебная страница', title: 'Предпросмотр состояний покупки недоступен', lead: 'Публичный симулятор оплаты не публикуется. COMMERCE_PREVIEW_ENABLED=false.' }, state.R);
    }
    var states = D.purchaseUiStates ? D.purchaseUiStates() : [];
    var product = D.getProductByCode ? D.getProductByCode('B2C-TRACK-001') : null;
    var view = D.productCardView ? D.productCardView(product) : {};
    var html = '';
    for (var i = 0; i < states.length; i += 1) {
      html += '<article class="mlma-card mlma-pad"><span class="mlma-eyebrow">' + esc(states[i].key) + '</span><h2 class="mlma-h3" style="margin-top:12px">' + esc(states[i].title) + '</h2><p class="mlma-muted" style="margin-top:8px">' + esc(states[i].note) + '</p></article>';
    }
    return pageHead({ eyebrow: 'Только локальный preview', title: 'Состояния будущей покупки', lead: 'Фикстуры интерфейса. Тестовая покупка не записывается в маршрут пользователя и не выдаёт право.', crumbs: [{ label: 'Academy', href: state.R.home() }, { label: 'Preview commerce' }] }, state.R) +
      '<div class="mlma-wrap" style="padding-top:24px;padding-bottom:56px;display:grid;gap:16px"><section class="mlma-card mlma-pad"><span class="mlma-eyebrow">' + esc(view.status_label || 'Готовится к запуску') + '</span><h2 class="mlma-h3" style="margin-top:12px">' + esc(view.display_name || 'Один трек') + '</h2><p style="margin-top:12px">' + esc(view.launch_price_label || '') + ' / ' + esc(view.regular_price_label || '') + '</p><p class="mlma-muted" style="margin-top:8px">Кнопка «Купить» скрыта. buy_enabled=' + (view.buy_enabled ? 'true' : 'false') + '</p></section>' + html + '</div>';
  }

  D._ui.renderAccess = renderAccess;
  D._ui.renderPricing = renderPricing;
  D._ui.renderPrivacy = renderPrivacy;
  D._ui.renderConsent = renderConsent;
  D._ui.renderPurchases = renderPurchases;
  D._ui.renderOffer = renderOffer;
  D._ui.renderRequisites = renderRequisites;
  D._ui.renderCookies = renderCookies;
  D._ui.renderMarketingConsent = renderMarketingConsent;
  D._ui.renderDocuments = renderDocuments;
  D._ui.renderPaymentAndAccess = renderPaymentAndAccess;
  D._ui.renderPreviewCommerce = renderPreviewCommerce;
})(typeof window !== 'undefined' ? window : globalThis);

/* __MLMA_UI_SPLIT__ */
(function (root) {
  'use strict';
  var D = root.MLMA;
  if (!D || !D._ui) return;
  var esc = D._ui.esc;
  var btn = D._ui.btn;
  var pageHead = D._ui.pageHead;
  var crumbs = D._ui.crumbs;
  var emptyState = D._ui.emptyState;
  var renderHome = D._ui.renderHome;
  var renderStart = D._ui.renderStart;
  var renderLibrary = D._ui.renderLibrary;
  var renderSection = D._ui.renderSection;
  var renderTrack = D._ui.renderTrack;
  var renderMy = D._ui.renderMy;
  var renderRoute = D._ui.renderRoute;
  var renderResults = D._ui.renderResults;
  var renderProfile = D._ui.renderProfile;
  var renderAccess = D._ui.renderAccess;
  var renderPricing = D._ui.renderPricing;
  var renderPrivacy = D._ui.renderPrivacy;
  var renderConsent = D._ui.renderConsent;
  var renderPurchases = D._ui.renderPurchases;
  var renderOffer = D._ui.renderOffer;
  var renderRequisites = D._ui.renderRequisites;
  var renderCookies = D._ui.renderCookies;
  var renderMarketingConsent = D._ui.renderMarketingConsent;
  var renderDocuments = D._ui.renderDocuments;
  var renderPaymentAndAccess = D._ui.renderPaymentAndAccess;
  var renderPreviewCommerce = D._ui.renderPreviewCommerce;

  function renderAbout(state) {
    var R = state.R;
    var blocks = [
      ['Почему мы сделали MLM Academy', 'Маркетинг-план показывает, куда прийти. Реальная работа начинается с ближайшего действия: кому написать, что сказать, как не потерять следующий шаг. Academy собирает эти рабочие ситуации в одну библиотеку.'],
      ['Проблема разрыва', 'Человек может пройти обучение и всё равно не сделать шаг. Между знанием «нужно найти клиентов» и действием «написать этому человеку сегодня» остаётся пустота. Мы проектируем треки так, чтобы закрывать именно этот разрыв.'],
    ];
    var sources = [
      'рабочие ситуации партнёров',
      'интервью и наблюдения',
      'практики прямых продаж',
      'современные международные подходы',
      'профессиональные методики',
      'этические и юридические ограничения',
    ];
    var produce = [
      ['Исходная проблема', 'Конкретная рабочая ситуация, а не общая тема курса.'],
      ['Ожидаемый результат', 'Что должно остаться после действия: сообщение, список, карта, договорённость.'],
      ['Действие', 'Один шаг вне экрана, который можно выполнить сегодня.'],
      ['Артефакт', 'Наблюдаемый след работы, а не «я посмотрел урок».'],
      ['Проверка завершения', 'Понятный критерий: действие сделано, результат зафиксирован.'],
      ['Следующий шаг', 'Куда идти дальше в той же рабочей цепочке.'],
    ];
    var never = [
      'давления',
      'обхода отказа',
      'манипулятивного закрытия',
      'медицинских обещаний',
      'оценки человека по кошельку',
      'выдуманных историй успеха',
    ];
    var ready = [
      'архитектура из 112 треков',
      'шесть направлений',
      'навигация по ситуации',
      'описания ожидаемых результатов',
    ];
    var later = [
      'задания',
      'инструменты',
      'примеры',
      'фиксация результатов',
      'маршруты',
      'кабинет',
    ];
    function list(items) {
      var html = '<ul class="mlma-plain">';
      for (var i = 0; i < items.length; i += 1) html += '<li>' + esc(items[i]) + '</li>';
      return html + '</ul>';
    }
    var produceHtml = '';
    for (var p = 0; p < produce.length; p += 1) {
      produceHtml +=
        '<li class="mlma-card mlma-pad"><span class="mlma-meta">0' +
        (p + 1) +
        '</span><h3 class="mlma-h3" style="margin-top:10px">' +
        esc(produce[p][0]) +
        '</h3><p class="mlma-muted" style="margin-top:8px">' +
        esc(produce[p][1]) +
        '</p></li>';
    }
    return (
      pageHead(
        {
          eyebrow: 'Как создаётся библиотека',
          title: 'Не пересказ учебников, а рабочая система',
          lead: 'Страница для партнёра, который хочет понять происхождение Academy — без корпоративного отчёта и без чужих цитат.',
          crumbs: [
            { label: 'Academy', href: R.home() },
            { label: 'Как создаётся' },
          ],
        },
        R,
      ) +
      '<div class="mlma-wrap" style="padding-top:32px;padding-bottom:56px;display:grid;gap:32px">' +
      '<section class="mlma-card mlma-pad-lg" style="padding:28px"><h2 class="mlma-h3">' +
      esc(blocks[0][0]) +
      '</h2><p class="mlma-lead mlma-muted" style="margin-top:12px">' +
      esc(blocks[0][1]) +
      '</p></section>' +
      '<section class="mlma-card mlma-pad-lg" style="padding:28px"><h2 class="mlma-h3">' +
      esc(blocks[1][0]) +
      '</h2><p class="mlma-lead mlma-muted" style="margin-top:12px">' +
      esc(blocks[1][1]) +
      '</p></section>' +
      '<section><h2 class="mlma-h3">На чём строится библиотека</h2>' +
      list(sources) +
      '</section>' +
      '<section><h2 class="mlma-h3">Как производится один трек</h2><ul class="mlma-grid-2" style="margin-top:16px">' +
      produceHtml +
      '</ul></section>' +
      '<section><h2 class="mlma-h3">Чего здесь не будет</h2>' +
      list(never) +
      '</section>' +
      '<section class="mlma-split"><div><h2 class="mlma-h3">Что уже готово</h2>' +
      list(ready) +
      '</div><div><h2 class="mlma-h3">Что будет добавляться постепенно</h2>' +
      list(later) +
      '</div></section>' +
      '<div class="mlma-actions">' +
      btn(R.library(), 'Открыть библиотеку', 'primary') +
      btn(D.siteHomeUrl(), 'Решения для MLM-компаний') +
      '</div></div>'
    );
  }

  function renderPreview(state) {
    var R = state.R;
    var counts = [];
    for (var i = 0; i < state.sections.length; i += 1) {
      var stats = D.sectionStats(state.allTracks, state.sections[i].sectionId);
      counts.push(
        '<div class="mlma-card mlma-pad"><dt class="mlma-meta mlma-muted">' +
          esc(state.sections[i].sectionId) +
          '</dt><dd style="margin-top:8px;font-size:32px;font-weight:800">' +
          stats.total +
          '</dd></div>',
      );
    }
    return (
      pageHead(
        {
          eyebrow: 'Служебный экран · редактор',
          title: 'Предпросмотр каталога',
          lead: 'Все 112 публичных карточек. Внутренние редакционные поля сюда не попадают. На опубликованном сайте этот экран скрыт.',
          crumbs: [
            { label: 'Главная', href: R.home() },
            { label: 'Предпросмотр каталога' },
          ],
        },
        R,
      ) +
      '<div class="mlma-wrap" style="padding-top:40px;padding-bottom:24px"><p class="mlma-meta" style="margin-bottom:16px">' +
      state.allTracks.length +
      ' треков · публичные поля, без внутреннего приоритета</p><dl class="mlma-grid-3">' +
      counts.join('') +
      '</dl></div><div id="mlma-catalog"></div>'
    );
  }

  function renderNotFound(state, title) {
    var R = state.R;
    return (
      pageHead(
        {
          eyebrow: '404',
          title: title || 'Такой страницы нет',
          lead: 'Возможно, адрес трека набран с ошибкой или этот трек ещё не открыт.',
        },
        R,
      ) +
      '<div class="mlma-wrap" style="padding-top:40px;padding-bottom:56px">' +
      emptyState({
        title: 'Продолжим оттуда, где есть работа',
        description: 'Библиотека собрана по ситуациям: выберите ту, что ближе к вашей задаче сейчас. Если вы искали конкретный трек, проверьте его номер — он выглядит так: A3-002.',
        actions: btn(R.start(), 'Выбрать ситуацию', 'primary') + btn(R.library(), 'Открыть библиотеку') + btn(R.home(), 'На главную'),
      }) +
      '</div>'
    );
  }

  function pageBody(state) {
    switch (state.page) {
      case 'home':
        return renderHome(state);
      case 'start':
        return renderStart(state);
      case 'library':
        return renderLibrary(state);
      case 'section':
        return renderSection(state);
      case 'track':
        return renderTrack(state);
      case 'my':
        return renderMy(state);
      case 'route':
        return renderRoute(state);
      case 'results':
        return renderResults(state);
      case 'profile':
        return renderProfile(state);
      case 'access':
        return renderAccess(state);
      case 'pricing':
        return renderPricing(state);
      case 'privacy':
        return renderPrivacy(state);
      case 'consent':
        return renderConsent ? renderConsent(state) : renderPrivacy(state);
      case 'purchases':
        return renderPurchases ? renderPurchases(state) : renderAccess(state);
      case 'offer':
        return renderOffer ? renderOffer(state) : renderPrivacy(state);
      case 'requisites':
        return renderRequisites ? renderRequisites(state) : renderPrivacy(state);
      case 'cookies':
        return renderCookies ? renderCookies(state) : renderPrivacy(state);
      case 'marketing-consent':
        return renderMarketingConsent ? renderMarketingConsent(state) : renderPrivacy(state);
      case 'documents':
        return renderDocuments ? renderDocuments(state) : renderPrivacy(state);
      case 'payment-and-access':
        return renderPaymentAndAccess ? renderPaymentAndAccess(state) : renderAccess(state);
      case 'preview-commerce':
        return renderPreviewCommerce ? renderPreviewCommerce(state) : renderNotFound(state);
      case 'about':
        return renderAbout(state);
      case 'preview':
        return renderPreview(state);
      default:
        return renderNotFound(state);
    }
  }

  D._ui.renderAbout = renderAbout;
  D._ui.renderPreview = renderPreview;
  D._ui.renderNotFound = renderNotFound;
  D._ui.pageBody = pageBody;
})(typeof window !== 'undefined' ? window : globalThis);

/* __MLMA_UI_SPLIT__ */
(function (root) {
  'use strict';
  var D = root.MLMA;
  if (!D || !D._ui || !D._ui.pageBody) return;
  var header = D._ui.header;
  var footer = D._ui.footer;
  var mobileNav = D._ui.mobileNav;
  var catalogBrowserHtml = D._ui.catalogBrowserHtml;
  var readCatalog = D._ui.readCatalog;
  var currentPage = D._ui.currentPage;
  var queryParam = D._ui.queryParam;
  var pageBody = D._ui.pageBody;

  function bindLibrary(state, rootEl) {
    var target = rootEl.querySelector('#mlma-catalog');
    if (!target) return;
    var extra = {};
    if (state.page === 'section') extra.stage = state.root.getAttribute('data-mlma-section') || '';
    var filters = D.parseLibraryState(window.location.search, extra);
    var drawerOpen = false;
    var shown = D.PAGE_SIZE || 15;
    var host = null;
    var rerankSeq = 0;
    var lastResult = null;

    function syncUrl(mode) {
      var qs = D.serializeLibraryState(filters);
      var url = window.location.pathname + (qs ? '?' + qs : '');
      if (mode === 'push') history.pushState({ mlmaLib: 1 }, '', url);
      else history.replaceState({ mlmaLib: 1 }, '', url);
    }

    function persist() {
      if (D.saveLibraryRestore) {
        D.saveLibraryRestore({
          href: window.location.pathname + window.location.search,
          q: filters.q || '',
          filters: D.serializeLibraryState(filters),
          scroll: window.scrollY || 0,
        });
      }
    }

    function setDrawer(open) {
      drawerOpen = open;
      var drawer = document.getElementById('mlma-drawer');
      var back = document.getElementById('mlma-drawer-backdrop');
      var btn = target.querySelector('#mlma-open-filters');
      if (drawer) drawer.hidden = !open;
      if (back) back.hidden = !open;
      if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.documentElement.classList.toggle('mlma-lock', !!open);
    }

    function toggleList(list, value) {
      var next = (list || []).slice();
      var idx = next.indexOf(value);
      if (idx === -1) next.push(value);
      else next.splice(idx, 1);
      return next;
    }

    function emitSearch() {
      if (!filters.q) return;
      var result = D.searchCatalog(state.tracks, filters);
      D.trackEvent('search_submitted', { query: filters.q, source: 'library', kind: result.kind || '' });
    }

    function placeDrawer() {
      host = document.getElementById('mlma-drawer-host-live');
      var source = target.querySelector('.mlma-drawer-host');
      if (!source) return;
      if (!host) {
        host = document.createElement('div');
        host.id = 'mlma-drawer-host-live';
        host.className = 'mlma';
        document.body.appendChild(host);
      }
      host.innerHTML = source.innerHTML;
      source.parentNode.removeChild(source);
    }

    function bindChrome() {
      var form = target.querySelector('#mlma-lib-form');
      if (form) {
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          var field = target.querySelector('#mlma-search');
          filters.q = field ? field.value : '';
          filters.preset = null;
          shown = D.PAGE_SIZE || 15;
          paint({ url: 'push' });
        });
      }
      function onToggle(attr, key, single) {
        var nodes = document.querySelectorAll('[' + attr + ']');
        for (var i = 0; i < nodes.length; i += 1) {
          nodes[i].addEventListener('click', function (event) {
            var el = event.currentTarget;
            var value = el.getAttribute(attr) || '';
            if (key === 'stage') {
              value = D.normalizeSectionId(value);
              filters.stages = toggleList(filters.stages || (filters.stage ? [filters.stage] : []), value);
              filters.stage = filters.stages.length === 1 ? filters.stages[0] : null;
            } else if (key === 'avail') {
              filters.avail = filters.avail === value ? null : value;
            } else if (key === 'experience') {
              filters.experience = filters.experience === value ? null : value;
              var exp = D.getExperience ? D.getExperience(filters.experience) : null;
              filters.lvl = exp && exp.level ? [exp.level] : [];
            } else if (single) {
              filters[key] = filters[key] === value ? null : value;
            } else {
              filters[key] = toggleList(filters[key] || [], value);
            }
            filters.preset = null;
            shown = D.PAGE_SIZE || 15;
            paint({ url: 'push' });
          });
        }
      }
      onToggle('data-mlma-stage', 'stage');
      onToggle('data-mlma-sit', 'sit');
      onToggle('data-mlma-fmt', 'fmt');
      onToggle('data-mlma-goal', 'goal', true);
      onToggle('data-mlma-experience', 'experience', true);
      onToggle('data-mlma-time', 'time', true);
      onToggle('data-mlma-type', 'type', true);
      var clearNodes = document.querySelectorAll('[data-mlma-clear]');
      for (var c = 0; c < clearNodes.length; c += 1) {
        clearNodes[c].addEventListener('click', function (event) {
          var el = event.currentTarget;
          var key = el.getAttribute('data-mlma-clear');
          var value = el.getAttribute('data-mlma-clear-value');
          if (key === 'q') filters.q = '';
          else if (key === 'stage') {
            filters.stages = (filters.stages || []).filter(function (item) { return item !== value; });
            filters.stage = filters.stages.length === 1 ? filters.stages[0] : null;
          } else if (key === 'sit') {
            filters.sit = (filters.sit || []).filter(function (item) { return item !== value; });
            filters.situation = null;
          } else if (Array.isArray(filters[key])) {
            filters[key] = filters[key].filter(function (item) { return item !== value; });
          } else filters[key] = null;
          filters.preset = key === 'preset' ? null : filters.preset;
          shown = D.PAGE_SIZE || 15;
          paint({ url: 'push' });
        });
      }
      var resetNodes = document.querySelectorAll('[data-mlma-reset]');
      for (var r = 0; r < resetNodes.length; r += 1) {
        resetNodes[r].addEventListener('click', function () {
          filters = D.emptyLibraryState();
          shown = D.PAGE_SIZE || 15;
          paint({ url: 'push' });
        });
      }
      var openBtn = target.querySelector('#mlma-open-filters');
      if (openBtn) openBtn.addEventListener('click', function () { setDrawer(true); });
      var closeNodes = document.querySelectorAll('[data-mlma-drawer-close]');
      for (var x = 0; x < closeNodes.length; x += 1) {
        closeNodes[x].addEventListener('click', function () { setDrawer(false); });
      }
      var back = document.getElementById('mlma-drawer-backdrop');
      if (back) back.addEventListener('click', function () { setDrawer(false); });
      var more = target.querySelector('[data-mlma-more]');
      if (more) {
        more.addEventListener('click', function () {
          shown += D.PAGE_SIZE || 15;
          paint({ url: 'replace' });
        });
      }
      var share = target.querySelector('#mlma-share');
      if (share) {
        share.addEventListener('click', function () {
          var href = window.location.origin + (share.getAttribute('data-mlma-share') || '/library');
          var msg = target.querySelector('#mlma-share-msg');
          function done() {
            if (msg) msg.textContent = 'Ссылка на подборку скопирована';
          }
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(href).then(done).catch(function () {
              window.prompt('Скопируйте ссылку', href);
              done();
            });
          } else {
            window.prompt('Скопируйте ссылку', href);
            done();
          }
        });
      }
      var links = target.querySelectorAll('.mlma-track-link');
      for (var l = 0; l < links.length; l += 1) {
        links[l].addEventListener('click', persist);
      }
    }

    function paint(opts) {
      opts = opts || {};
      var keep = opts.keepFocus;
      var selection = null;
      var typed = null;
      var searchBefore = target.querySelector('#mlma-search');
      if (searchBefore) {
        typed = searchBefore.value;
        if (keep) selection = searchBefore.selectionStart;
      }
      var wasOpen = drawerOpen;
      var scrollY = opts.preserveScroll ? (window.scrollY || 0) : null;
      lastResult = opts.result || D.searchCatalog(state.tracks, filters);
      if (!opts.skipRerank && filters.q && window.MLMA_RERANK_URL) {
        lastResult = Object.assign({}, lastResult, { pendingAi: true });
      }
      target.innerHTML = catalogBrowserHtml(state, filters, { shown: shown, result: lastResult });
      placeDrawer();
      bindChrome();
      if (wasOpen) setDrawer(true);
      var search = target.querySelector('#mlma-search');
      if (search && opts.skipRerank && typed != null && typed !== search.value) {
        search.value = typed;
      }
      if (keep && search) {
        search.focus();
        try {
          var pos = selection == null ? search.value.length : selection;
          search.setSelectionRange(pos, pos);
        } catch (err) {
          /* ignore */
        }
      }
      if (scrollY != null) {
        try { window.scrollTo(0, scrollY); } catch (err2) { /* ignore */ }
      }
      if (opts.url === 'push') syncUrl('push');
      else if (opts.url === 'replace') syncUrl('replace');
      persist();
      if (!opts.skipRerank) emitSearch();
      if (!opts.skipRerank) requestRerank();
    }

    function requestRerank() {
      var url = typeof window !== 'undefined' ? window.MLMA_RERANK_URL : '';
      if (!url || !filters.q || !D.rerankPayload || !D.applyRerankResponse) return;
      var local = lastResult || D.searchCatalog(state.tracks, filters);
      if (local.kind === 'need_more') return;
      var payload = D.rerankPayload(local, filters.q, state.tracks);
      if (!payload.candidates.length) return;
      var seq = (rerankSeq += 1);
      var qNow = filters.q;
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timerId = setTimeout(function () {
        if (ctrl) ctrl.abort();
      }, 14000);
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl ? ctrl.signal : undefined,
      })
        .then(function (res) {
          if (!res.ok) throw new Error('local_fallback');
          return res.json();
        })
        .then(function (data) {
          if (seq !== rerankSeq || filters.q !== qNow) return;
          var next = D.applyRerankResponse(local, data, state.tracks);
          if (next) {
            next.pendingAi = false;
            paint({ keepFocus: true, skipRerank: true, preserveScroll: true, result: next });
          }
        })
        .catch(function () {
          if (seq !== rerankSeq || filters.q !== qNow) return;
          var fallback = Object.assign({}, local, { pendingAi: false });
          paint({ keepFocus: true, skipRerank: true, preserveScroll: true, result: fallback });
        })
        .then(function () {
          clearTimeout(timerId);
        });
    }

    window.addEventListener('popstate', function () {
      filters = D.parseLibraryState(window.location.search, extra);
      shown = D.PAGE_SIZE || 15;
      paint();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && drawerOpen) setDrawer(false);
    });
    paint();
    var restore = D.readLibraryRestore ? D.readLibraryRestore() : null;
    if (restore && restore.scroll && window.location.search) {
      window.setTimeout(function () {
        window.scrollTo(0, restore.scroll);
      }, 0);
    }
  }

  function bind(state, rootEl) {
    rootEl.querySelectorAll('[data-mlma-choose]').forEach(function (el) {
      el.addEventListener('click', function () {
        var id = D.normalizeSectionId(el.getAttribute('data-mlma-choose') || '');
        if (!id) return;
        state.profile = D.saveProfile({ selectedSectionId: id });
        mount(rootEl);
      });
    });
    rootEl.querySelectorAll('[data-mlma-level]').forEach(function (el) {
      el.addEventListener('click', function () {
        var id = el.getAttribute('data-mlma-level') || '';
        var current = state.profile.currentGoal === id ? '' : id;
        state.profile = D.saveProfile({ currentGoal: current });
        mount(rootEl);
      });
    });
    var menuBtn = rootEl.querySelector('#mlma-open-menu');
    var menu = rootEl.querySelector('#mlma-menu');
    if (menuBtn && menu) {
      menuBtn.addEventListener('click', function () {
        var open = menu.hidden;
        menu.hidden = !open;
        menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
    rootEl.querySelectorAll('[data-mlma-logout]').forEach(function (el) {
      el.addEventListener('click', function (event) {
        if (D.performMembersLogout) D.performMembersLogout(event);
      });
    });
    var cookieBox = rootEl.querySelector('#mlma-cookie');
    var cookieChoice = '';
    try {
      cookieChoice = window.localStorage.getItem('mlma.cookieChoice.v1') || '';
    } catch (err) {
      cookieChoice = '';
    }
    if (cookieBox && !cookieChoice) cookieBox.hidden = false;
    rootEl.querySelectorAll('[data-mlma-cookie]').forEach(function (el) {
      el.addEventListener('click', function () {
        try {
          window.localStorage.setItem('mlma.cookieChoice.v1', el.getAttribute('data-mlma-cookie') || 'necessary');
        } catch (err) {
          /* ignore */
        }
        if (cookieBox) cookieBox.hidden = true;
      });
    });
    rootEl.querySelectorAll('[data-mlma-run-start]').forEach(function (el) {
      el.addEventListener('click', function () {
        var id = D.normalizeTrackId(el.getAttribute('data-mlma-run-start'));
        var track = id ? D.getById(state.allTracks, id, true) : null;
        if (track && D.startRuntime) D.startRuntime(track);
        D.trackEvent('track_started', { itemId: id || '', source_page: '/track', article_slug: id || '' });
      });
    });
    var runForm = rootEl.querySelector('#mlma-runtime-form');
    if (runForm) {
      runForm.addEventListener('submit', function (event) {
        event.preventDefault();
        var id = D.normalizeTrackId(queryParam('id'));
        var track = id ? D.getById(state.allTracks, id, true) : null;
        if (!track || !D.submitRuntime) return;
        var artifact = (runForm.querySelector('#mlma-artifact') || {}).value || '';
        var evidenceNote = (runForm.querySelector('#mlma-evidence') || {}).value || '';
        D.trackEvent('artifact_created', { itemId: id, source_page: '/track' });
        var result = D.submitRuntime(track, { artifact: artifact, evidenceNote: evidenceNote });
        var branch = result && result.check ? result.check.branch : '';
        if (branch === 'success' || branch === 'highResult') D.trackEvent('track_completed', { itemId: id });
        mount(rootEl);
      });
    }
    rootEl.querySelectorAll('[data-mlma-run-retry]').forEach(function (el) {
      el.addEventListener('click', function () {
        var id = D.normalizeTrackId(el.getAttribute('data-mlma-run-retry'));
        var track = id ? D.getById(state.allTracks, id, true) : null;
        if (track && D.retryRuntime) D.retryRuntime(track);
        D.trackEvent('track_retry', { itemId: id || '' });
        mount(rootEl);
      });
    });
    rootEl.querySelectorAll('[data-mlma-nba]').forEach(function (el) {
      el.addEventListener('click', function () {
        D.trackEvent('next_track_opened', { itemId: el.getAttribute('data-mlma-nba') || '', source_page: '/track' });
      });
    });
    rootEl.querySelectorAll('[data-mlma-save]').forEach(function (el) {
      el.addEventListener('click', function () {
        var id = el.getAttribute('data-mlma-save');
        if (!id) return;
        var wasSaved = (state.profile.savedTrackIds || []).indexOf(D.normalizeTrackId(id)) !== -1;
        if (wasSaved && D.removeTrackFromRoute) {
          D.removeTrackFromRoute(id).then(function () {
            D.trackEvent('track_unsaved', { itemId: id, source: state.page });
            mount(rootEl);
          });
          return;
        }
        if (D.saveTrackToRoute) {
          D.saveTrackToRoute(id).then(function (result) {
            D.trackEvent('track_saved', { itemId: id, source: state.page });
            state.saveNotice = result && result.ok ? 'saved' : result && result.fallback ? 'fallback' : 'saved';
            mount(rootEl);
            var hint = rootEl.querySelector('#mlma-save-hint');
            if (hint && result && result.ok) hint.textContent = 'Трек сохранён в вашем маршруте.';
          });
          return;
        }
        state.profile = D.toggleSavedTrack(id);
        D.trackEvent('track_saved', { itemId: id, source: state.page });
        mount(rootEl);
      });
    });
    rootEl.querySelectorAll('[data-mlma-save-guest]').forEach(function (el) {
      el.addEventListener('click', function () {
        var id = D.normalizeTrackId(el.getAttribute('data-mlma-save-guest'));
        if (D.writePendingTrackId) D.writePendingTrackId(id);
        D.trackEvent('signup_started', { itemId: id, source: 'save_guest' });
        var returnPath = D.routes().track(id);
        window.location.href = D.membersSignupUrl(returnPath);
      });
    });
    rootEl.querySelectorAll('[data-mlma-route-del]').forEach(function (el) {
      el.addEventListener('click', function () {
        var id = el.getAttribute('data-mlma-route-del');
        if (D.removeTrackFromRoute) {
          D.removeTrackFromRoute(id).then(function () {
            D.trackEvent('track_unsaved', { itemId: id, source: 'route' });
            mount(rootEl);
          });
        }
      });
    });
    function moveRoute(id, dir) {
      var ids = (state.profile.savedTrackIds || []).slice();
      var idx = ids.indexOf(D.normalizeTrackId(id));
      if (idx < 0) return;
      var next = idx + dir;
      if (next < 0 || next >= ids.length) return;
      var tmp = ids[idx];
      ids[idx] = ids[next];
      ids[next] = tmp;
      if (D.reorderRoute) {
        D.reorderRoute(ids).then(function () { mount(rootEl); });
      }
    }
    rootEl.querySelectorAll('[data-mlma-route-up]').forEach(function (el) {
      el.addEventListener('click', function () { moveRoute(el.getAttribute('data-mlma-route-up'), -1); });
    });
    rootEl.querySelectorAll('[data-mlma-route-down]').forEach(function (el) {
      el.addEventListener('click', function () { moveRoute(el.getAttribute('data-mlma-route-down'), 1); });
    });
    var form = rootEl.querySelector('#mlma-profile-form');
    if (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var name = ((form.querySelector('#mlma-name') || {}).value || '').trim();
        var roleEl = form.querySelector('input[name="partnerRole"]:checked');
        var consent = form.querySelector('#mlma-consent');
        var msg = form.querySelector('#mlma-profile-msg');
        if (!name) {
          if (msg) msg.textContent = 'Укажите имя — это займёт несколько секунд.';
          return;
        }
        if (!roleEl) {
          if (msg) msg.textContent = 'Выберите роль: новичок, партнёр или лидер.';
          return;
        }
        if (!consent || !consent.checked) {
          if (msg) msg.textContent = 'Нужно согласие на обработку персональных данных.';
          return;
        }
        var task = ((form.querySelector('#mlma-task') || {}).value || '').trim();
        var patch = {
          displayName: name,
          partnerRole: roleEl.value,
          experience: (form.querySelector('#mlma-experience') || {}).value || '',
          currentTask: task,
          currentGoal: task,
          difficulty: ((form.querySelector('#mlma-difficulty') || {}).value || '').trim(),
          desiredResult: ((form.querySelector('#mlma-result') || {}).value || '').trim(),
          availableTime: (form.querySelector('#mlma-time') || {}).value || '',
          selectedSectionId: (form.querySelector('#mlma-section') || {}).value || null,
          consentAt: state.profile.consentAt || new Date().toISOString(),
          notifyEmail: !!(form.querySelector('#mlma-notify') && form.querySelector('#mlma-notify').checked),
          onboardingComplete: true,
        };
        state.profile = D.saveProfile(patch);
        if (state.account && D.getRepo) D.getRepo().saveProfile(state.account, state.profile);
        D.trackEvent('profile_completed', { source_page: '/profile' });
        if (msg) msg.textContent = 'Профиль сохранён. Дальше — одно следующее действие.';
      });
    }
    rootEl.querySelectorAll('[data-mlma-skip-onboarding]').forEach(function (el) {
      el.addEventListener('click', function () {
        state.profile = D.saveProfile({ onboardingSkipped: true, onboardingComplete: !!(state.profile.displayName && state.profile.partnerRole && state.profile.consentAt) });
        if (state.account && D.getRepo) D.getRepo().saveProfile(state.account, state.profile);
        mount(rootEl);
      });
    });
    rootEl.querySelectorAll('[data-mlma-checkout]').forEach(function (el) {
      el.addEventListener('click', function (event) {
        event.preventDefault();
        D.trackEvent('checkout_blocked', { itemId: el.getAttribute('data-mlma-checkout') || '', reason: 'payments_disabled' });
        window.location.href = (D.routes().pricing && D.routes().pricing()) || '/pricing';
      });
    });
    rootEl.querySelectorAll('[data-mlma-reset-profile]').forEach(function (el) {
      el.addEventListener('click', function () {
        state.profile = D.resetProfile();
        mount(rootEl);
      });
    });
    rootEl.querySelectorAll('[data-mlma-funnel]').forEach(function (el) {
      el.addEventListener('click', function () {
        var send = D.funnelEvent || D.trackEvent;
        send(el.getAttribute('data-mlma-funnel'), {
          source_page: el.getAttribute('data-source-page') || (window.location.pathname || ''),
          target_page: el.getAttribute('href') || '',
          cta_position: el.getAttribute('data-cta-position') || '',
          article_slug: el.getAttribute('data-article-slug') || 'marketing-plan',
          timestamp: new Date().toISOString(),
        });
      });
    });
    rootEl.querySelectorAll('[data-mlma-preset]').forEach(function (el) {
      el.addEventListener('click', function () {
        D.trackEvent('preset_open', { itemId: el.getAttribute('data-mlma-preset') || '', source: 'home' });
        D.trackEvent('academy_preset_click', { itemId: el.getAttribute('data-mlma-preset') || '', source: 'home' });
      });
    });
    var homeForm = rootEl.querySelector('form[action="/library"]');
    if (homeForm && state.page === 'home') {
      homeForm.addEventListener('submit', function () {
        var field = homeForm.querySelector('#mlma-home-q');
        D.trackEvent('search_submitted', { query: field ? field.value : '', source: 'home' });
      });
    }
    rootEl.querySelectorAll('[data-mlma-export-local]').forEach(function (el) {
      el.addEventListener('click', function () {
        var payload = D.exportLocalUserData ? D.exportLocalUserData() : { error: 'export_unavailable' };
        var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'mlma-local-export.json';
        a.click();
        URL.revokeObjectURL(url);
        var msg = rootEl.querySelector('#mlma-export-msg');
        if (msg) msg.textContent = 'Файл скачан. Это данные этого устройства, не серверная копия.';
      });
    });
    rootEl.querySelectorAll('[data-mlma-result-open]').forEach(function (el) {
      el.addEventListener('click', function () {
        D.trackEvent('search_result_open', { itemId: el.getAttribute('data-mlma-result-open') || '', source: state.page });
      });
    });
    bindLibrary(state, rootEl);
    applySeo(state);
  }

  function publicAbsUrl(pathAndQuery) {
    var path = String(pathAndQuery || '/');
    if (path.charAt(0) !== '/') path = '/' + path;
    var host = '';
    var protocol = 'https:';
    try {
      host = String(window.location.host || 'mlmacademy.ru');
      protocol = window.location.protocol || 'https:';
    } catch (err) {
      host = 'mlmacademy.ru';
    }
    if (host === 'localhost' || host.indexOf('127.0.0.1') === 0) {
      return protocol + '//' + host + path;
    }
    host = host.replace(/:\d+$/, '');
    return 'https://' + host + path;
  }

  function ensureMeta(attr, key, value) {
    var sel = 'meta[' + attr + '="' + key + '"]';
    var el = document.querySelector(sel);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute('content', value);
  }

  function ensureLink(rel, href, extra) {
    var el = document.querySelector('link[rel="' + rel + '"]');
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', rel);
      document.head.appendChild(el);
    }
    el.setAttribute('href', href);
    if (extra) {
      var keys = Object.keys(extra);
      for (var i = 0; i < keys.length; i += 1) el.setAttribute(keys[i], extra[keys[i]]);
    }
  }

  var MLMA_FAVICON =
    'data:image/svg+xml;charset=utf-8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#C45F42"/><rect x="7" y="7" width="18" height="18" rx="3" fill="none" stroke="#1c1914" stroke-width="2"/></svg>',
    );

  function robotsContent(state, path) {
    if (state.page === 'my' || state.page === 'route' || state.page === 'results' || state.page === 'profile' || state.page === 'preview') {
      return 'noindex, nofollow';
    }
    if (state.page === 'track') {
      var opened = D.normalizeTrackId(queryParam('id') || (path.indexOf('/track/') === 0 ? path.slice(7) : ''));
      var openedTrack = opened ? D.getById(state.allTracks, opened, true) : null;
      var pretty = path.indexOf('/track/') === 0;
      if (pretty && openedTrack && D.deriveSeoStatus(openedTrack) === 'index' && D.hasIndexablePromo && D.hasIndexablePromo(openedTrack)) {
        return 'index, follow';
      }
      return 'noindex, nofollow';
    }
    return 'index, follow';
  }

  function applySeo(state) {
    try {
      document.documentElement.setAttribute('lang', 'ru');
      var path = (window.location.pathname || '').replace(/\/+$/, '') || '/';
      var robots = document.querySelector('meta[name="robots"]');
      if (!robots) {
        robots = document.createElement('meta');
        robots.setAttribute('name', 'robots');
        document.head.appendChild(robots);
      }
      robots.setAttribute('content', robotsContent(state, path));
      if (path.indexOf('/track/') === 0) {
        var slug = path.slice('/track/'.length);
        var prettyId = D.normalizeTrackId(slug);
        if (prettyId && !queryParam('id')) {
          /* pretty URL stays; no client redirect to ?id= */
        }
      }
      var seo = {
        home: {
          title: 'MLM Academy — библиотека действий',
          desc: 'Рабочий навигатор партнёра: ситуация, действие, результат и следующий шаг. Шесть направлений от старта до роста команды.',
        },
        start: {
          title: 'С чего начать · MLM Academy',
          desc: 'Выберите ситуацию, в которой сейчас застряли. Академия подберёт первый трек без кабинета и без оплаты.',
        },
        library: {
          title: 'Библиотека · MLM Academy',
          desc: 'Каталог треков и материалов: этап, ситуация, цель, опыт, тип и время. Поиск понимает живой запрос, а не только название.',
        },
        about: {
          title: 'Как создаётся библиотека · MLM Academy',
          desc: 'Как устроена MLM Academy: трек как маршрут изменения состояния, а не страница с видео. Честные статусы и рабочие следы.',
        },
        access: {
          title: 'Доступ · MLM Academy',
          desc: 'Сначала бесплатный кабинет, затем пакет. Реальные списания пока выключены.',
        },
        my: { title: 'Кабинет · MLM Academy', desc: 'Личная главная. Страница не индексируется.' },
        route: { title: 'Мой маршрут · MLM Academy', desc: 'Маршрут кабинета. Страница не индексируется.' },
        results: { title: 'Результаты · MLM Academy', desc: 'Результаты кабинета. Страница не индексируется.' },
        profile: { title: 'Профиль · MLM Academy', desc: 'Профиль кабинета. Страница не индексируется.' },
        privacy: {
          title: 'Политика обработки персональных данных — MLM Academy',
          desc: 'Как MLM Academy собирает, использует, хранит и защищает персональные данные.',
        },
        consent: {
          title: 'Согласие на обработку персональных данных — MLM Academy',
          desc: 'Отдельное согласие на обработку персональных данных при регистрации кабинета MLM Academy.',
        },
        offer: {
          title: 'Публичная оферта — MLM Academy',
          desc: 'Условия оказания дистанционных информационно-консультационных услуг MLM Academy.',
        },
        requisites: {
          title: 'Реквизиты исполнителя — MLM Academy',
          desc: 'Сведения об исполнителе и контакты MLM Academy.',
        },
        documents: {
          title: 'Документы — MLM Academy',
          desc: 'Центр публичных документов MLM Academy: реквизиты, оферта, политика, согласия, cookies, оплата и возврат.',
        },
        cookies: {
          title: 'Cookies и локальное хранилище — MLM Academy',
          desc: 'Какие cookies и ключи браузера использует MLM Academy для входа, сессии и маршрута.',
        },
        'marketing-consent': {
          title: 'Согласие на получение информационных и рекламных сообщений — MLM Academy',
          desc: 'Необязательное согласие на новости и специальные предложения MLM Academy.',
        },
        'payment-and-access': {
          title: 'Оплата, доступ и возврат — MLM Academy',
          desc: 'Как оплачиваются продукты MLM Academy, когда открывается доступ и как обратиться за возвратом.',
        },
      };
      var sectionSeo = {
        A1: { title: 'A1 · Старт и система · MLM Academy', desc: 'Понять роль, причину, продукт и рабочий план. Треки старта без выдуманных уроков.' },
        A2: { title: 'A2 · Люди и база · MLM Academy', desc: 'Найти, с кем начать, собрать базу и сегменты. Треки про людей, а не про «набор контактов ради списка».' },
        A3: { title: 'A3 · Первый контакт · MLM Academy', desc: 'Выбрать канал, написать, позвонить и договориться о разговоре без давления.' },
        A4: { title: 'A4 · Потребность и решение · MLM Academy', desc: 'Услышать человека и собрать рекомендацию на его языке, а не прочитать презентацию.' },
        A5: { title: 'A5 · Сомнения и отказ · MLM Academy', desc: 'Разобрать паузу, возражение или отказ и зафиксировать следующий шаг.' },
        A6: { title: 'A6 · Повтор и рост · MLM Academy', desc: 'Вернуть клиента, выстроить ритм и работу с командой без ложных обещаний роста продаж.' },
      };
      var title = 'MLM Academy';
      var desc = 'MLM Academy — рабочий навигатор партнёра: ситуация, действие, результат и следующий шаг.';
      var canonPath = path;
      if (state.page === 'section') {
        var sid = D.normalizeSectionId(state.root.getAttribute('data-mlma-section') || '');
        if (sid && sectionSeo[sid]) {
          title = sectionSeo[sid].title;
          desc = sectionSeo[sid].desc;
        }
      } else if (state.page === 'track') {
        var opened = D.normalizeTrackId(queryParam('id'));
        var openedTrack = opened ? D.getById(state.allTracks, opened, true) : null;
        if (openedTrack) {
          title = openedTrack.title + ' · MLM Academy';
          desc = openedTrack.situation + ' Результат: ' + openedTrack.outcome;
        } else {
          title = 'Трек · MLM Academy';
          desc = 'Карточка трека MLM Academy. Откройте трек по идентификатору, чтобы увидеть ситуацию, действие и рабочий след.';
        }
        if (opened) {
          if (path.indexOf('/track/') === 0 && openedTrack && D.deriveSeoStatus(openedTrack) === 'index') {
            canonPath = '/track/' + String(opened).toLowerCase();
          } else {
            canonPath = '/track?id=' + encodeURIComponent(String(opened).toLowerCase());
          }
        }
      } else if (seo[state.page]) {
        title = seo[state.page].title;
        desc = seo[state.page].desc;
      }
      document.title = title;
      var meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', desc);
      var abs = publicAbsUrl(canonPath);
      ensureLink('canonical', abs);
      ensureMeta('property', 'og:title', title);
      ensureMeta('property', 'og:description', desc);
      ensureMeta('property', 'og:url', abs);
      ensureMeta('property', 'og:locale', 'ru_RU');
      ensureMeta('property', 'og:type', 'website');
      ensureLink('icon', MLMA_FAVICON, { type: 'image/svg+xml' });
    } catch (err) {
      /* ignore */
    }
  }

  function mount(existingRoot) {
    if (typeof document === 'undefined') return;
    var rootEl = existingRoot || document.querySelector('.mlma[data-mlma-page]');
    if (!rootEl) return;
    if (!existingRoot && rootEl.dataset.initialized === 'true') return;
    rootEl.dataset.initialized = 'true';
    var catalog = readCatalog();
    var preview = currentPage(rootEl) === 'preview' || D.isPreviewHost(window.location.hostname);
    var R = D.routes(catalog.config);
    var sectionById = {};
    for (var i = 0; i < catalog.sections.length; i += 1) {
      sectionById[catalog.sections[i].sectionId] = catalog.sections[i];
    }
    var state = {
      root: rootEl,
      page: currentPage(rootEl),
      preview: preview,
      allTracks: catalog.tracks,
      tracks: D.listVisible(catalog.tracks, preview),
      sections: catalog.sections,
      sectionById: sectionById,
      index: D.indexById(catalog.tracks, true),
      rules: catalog.rules,
      pilot: catalog.pilot,
      config: catalog.config,
      profile: D.getProfile(),
      account: D.hydrateAccount ? D.hydrateAccount(D.readMembersSession ? D.readMembersSession() : { loggedIn: false }) : { loggedIn: false },
      R: R,
    };
    if (state.account && state.account.profile) state.profile = state.account.profile;
    rootEl.innerHTML =
      header(state) +
      '<main id="mlma-main">' +
      pageBody(state) +
      '</main>' +
      footer(state) +
      mobileNav(state);
    bind(state, rootEl);
    if (!existingRoot && D.hydrateAccountFromServer && state.account && state.account.loggedIn) {
      D.hydrateAccountFromServer(D.readMembersSession ? D.readMembersSession() : state.account).then(function (account) {
        if (!account) return;
        var prevMode = state.account && state.account.storageMode;
        state.account = account;
        if (account.profile) state.profile = account.profile;
        if (prevMode === 'server' && account.storageMode === 'server') {
          var same = JSON.stringify((state.profile && state.profile.savedTrackIds) || []) === JSON.stringify(account.savedTrackIds || (account.profile && account.profile.savedTrackIds) || []);
          if (same) return;
        }
        mount(rootEl);
      });
    }
    if (state.page === 'home') {
      D.trackEvent('academy_open', { source: 'home' });
      D.trackEvent('academy_home_open', { source: 'home' });
    }
    if (state.page === 'route') D.trackEvent('route_opened', { source: queryParam('tab') || 'route' });
    if (state.page === 'my' && state.account && state.account.loggedIn) {
      try {
        if (window.sessionStorage && !window.sessionStorage.getItem('mlma.login.tracked')) {
          window.sessionStorage.setItem('mlma.login.tracked', '1');
          D.trackEvent('login_completed', { source: 'cabinet' });
        }
      } catch (err) {
        /* ignore */
      }
    }
    if (state.page === 'library' || state.page === 'preview') D.trackEvent('library_open', { source: state.page });
    if (state.page === 'track') {
      var opened = D.normalizeTrackId(queryParam('id'));
      var openedTrack = opened ? D.getById(state.allTracks, opened, true) : null;
      var canStart = openedTrack ? D.getTrackStatusView(openedTrack).canStart : false;
      var openedRuntime = opened && D.getRuntime ? D.getRuntime(opened) : null;
      if (
        openedTrack &&
        canStart &&
        D.loadTrackModule &&
        !D.getTrackModule(openedTrack.trackId)
      ) {
        D.loadTrackModule(openedTrack.trackId, function (mod) {
          if (mod) mount(rootEl);
        });
      }
      D.trackEvent('track_card_opened', { itemId: opened || '', source: 'track' });
      if (openedTrack && D.normalizeAccess && D.normalizeAccess(openedTrack.access) === 'paid' && D.isEntitledToTrack && !D.isEntitledToTrack(openedTrack, state.account)) {
        D.trackEvent('locked_track_opened', { itemId: opened || '' });
      }
      if (queryParam('run') === '1') D.trackEvent('track_step_open', { itemId: opened || '', cta_position: openedRuntime ? openedRuntime.step : 'action' });
      if (D.isInactive && D.isInactive(openedRuntime)) D.trackEvent('track_inactive', { itemId: opened || '' });
    }
  }

  D.mount = mount;
  D.readCatalog = readCatalog;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { mount(); });
    else mount();
  }
})(typeof window !== 'undefined' ? window : globalThis);
