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
    var clean = href.split('?')[0];
    if (clean === '/academy') return pathname === '/academy' || pathname === '/';
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
    return page === 'my' || page === 'route' || page === 'results' || page === 'profile';
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
      { href: R.start(), label: 'С чего начать' },
      { href: R.about(), label: 'Как создаётся' },
      { href: D.siteHomeUrl(), label: 'Решения для компаний' },
    ];
    if (isCabinetPage(state.page)) {
      items = [
        { href: R.home(), label: 'Academy' },
        { href: R.library(), label: 'Библиотека' },
        { href: R.my(), label: 'Кабинет' },
        { href: R.myRoute(), label: 'Мой маршрут' },
        { href: R.profile(), label: 'Профиль' },
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
      '<a class="mlma-btn mlma-btn-small mlma-btn-primary" href="' +
      esc(R.start()) +
      '">Найти свой шаг</a></div></div>' +
      '<div class="mlma-menu" id="mlma-menu" hidden><nav aria-label="Мобильное меню">' +
      nav +
      '</nav></div></header>'
    );
  }

  function footer(state) {
    var R = state.R;
    var links = [
      { href: R.start(), label: 'С чего начать' },
      { href: R.library(), label: 'Библиотека' },
      { href: R.about(), label: 'Как создаётся библиотека' },
      { href: D.siteHomeUrl(), label: 'Решения для компаний' },
    ];
    var nav = '';
    for (var i = 0; i < links.length; i += 1) {
      nav += '<li><a href="' + esc(links[i].href) + '">' + esc(links[i].label) + '</a></li>';
    }
    return (
      '<footer class="mlma-footer"><div class="mlma-wrap" style="display:flex;flex-direction:column;gap:24px;padding-top:32px;padding-bottom:32px">' +
      '<div><p style="font-size:17px;font-weight:800;letter-spacing:-0.03em">MLM Academy</p>' +
      '<p class="mlma-footer-muted" style="margin-top:8px;max-width:460px;font-size:14px;line-height:1.5">Рабочий навигатор партнёра: ситуация → действие → результат → следующий шаг.</p></div>' +
      '<nav aria-label="Навигация в подвале"><ul style="display:flex;flex-wrap:wrap;gap:8px 24px;font-size:14px;font-weight:700">' +
      nav +
      '</ul></nav></div></footer>'
    );
  }

  function mobileNav(state) {
    var R = state.R;
    var path = pathName();
    var items = [
      { href: R.home(), label: 'Academy' },
      { href: R.library(), label: 'Библиотека' },
      { href: R.start(), label: 'Старт' },
      { href: R.about(), label: 'О библиотеке' },
    ];
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
    if (!why) return '';
    if (Array.isArray(why) && why.length) {
      return '<div class="mlma-why"><p class="mlma-meta">Почему предложено</p><span><b>Буквальное совпадение.</b> ' + esc(why.slice(0, 4).join(', ')) + '</span></div>';
    }
    var parts = '';
    if (why.literal && why.literal.length) {
      parts += '<span><b>Буквальное совпадение.</b> ' + esc(why.literal.slice(0, 3).join(', ')) + '</span>';
    }
    if (why.situation && why.situation.length) {
      parts += '<span><b>Распознанная ситуация.</b> ' + esc(why.situation.slice(0, 3).join(', ')) + '</span>';
    }
    if (why.intent && why.intent.length) {
      parts += '<span><b>Предполагаемое намерение.</b> ' + esc(why.intent.slice(0, 2).join('. ')) + '</span>';
    }
    if (!parts) return '';
    return '<div class="mlma-why"><p class="mlma-meta">Почему предложено</p>' + parts + '</div>';
  }

  function trackCard(track, section, R, opts) {
    opts = opts || {};
    var status = D.getTrackStatusView(track);
    var shortTitle = section ? section.shortTitle : track.sectionId;
    var cta = status.canStart ? 'Пройти трек' : 'Открыть описание';
    var why = opts.why
      ? whyHtml(opts.why)
      : '';
    var cls = 'mlma-card mlma-card-hover mlma-track-card' + (opts.featured ? ' mlma-track-featured' : '') + (opts.compact ? ' mlma-track-compact' : '');
    var badgeHtml = status.showCatalogBadge && status.label ? badge(status.label, status.tone) : '';
    return (
      '<article class="' +
      cls +
      '" style="' +
      D.styleAttr(track.sectionId) +
      '"><div class="mlma-strip" aria-hidden="true"></div><div style="display:flex;flex-direction:column;flex:1;padding:18px">' +
      '<div class="mlma-chip-row" style="flex-wrap:wrap">' +
      '<span class="mlma-meta">' +
      esc(track.trackId) +
      ' · ' +
      esc(shortTitle) +
      '</span>' +
      badgeHtml +
      '</div><h3 class="mlma-h3" style="margin-top:14px;font-size:20px"><a class="mlma-track-link" href="' +
      esc(R.track(track.trackId)) +
      '" style="color:inherit">' +
      esc(track.title) +
      '</a></h3><p style="margin-top:12px;font-size:15px;line-height:1.4">' +
      esc(track.situation) +
      '</p>' +
      (opts.compact ? '' : '<p class="mlma-muted" style="margin-top:8px;font-size:14px;line-height:1.4">Результат: ' + esc(track.outcome) + '</p>') +
      why +
      '<div style="margin-top:auto;padding-top:16px;border-top:1px solid var(--mlma-line-soft);display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;align-items:center">' +
      '<span class="mlma-meta mlma-muted">' +
      esc(track.format) +
      '</span>' +
      '<a class="mlma-btn mlma-btn-small' +
      (status.canStart ? ' mlma-btn-primary' : '') +
      ' mlma-track-link" href="' +
      esc(R.track(track.trackId)) +
      '">' +
      esc(cta) +
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
      '<p class="mlma-meta" style="margin-top:18px">Живые примеры</p>' +
      '<div class="mlma-examples">' +
      exHtml +
      '</div></div>' +
      '<aside class="mlma-scheme" aria-label="Как устроен маршрут">' +
      '<p class="mlma-meta">Схема маршрута</p>' +
      '<ol class="mlma-scheme-list"><li>Ситуация</li><li>Подходящий трек</li><li>Действие</li><li>Следующий шаг</li></ol>' +
      '<p class="mlma-muted" style="margin-top:16px;font-size:14px;line-height:1.45">Сначала узнаёте себя в описании. Потом берёте одно действие. После результата видите продолжение.</p></aside></div></section>' +
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
    var chChips = chipGroup('data-mlma-ch', facets.ch, filters.ch || []);
    var lvlChips = chipGroup('data-mlma-lvl', facets.lvl, filters.lvl || []);
    var availChips = chipGroup('data-mlma-avail', facets.avail, filters.avail ? [filters.avail] : []);
    var body;
    if (result.kind === 'need_more') {
      var sitPresets = '';
      var sits = D.SITUATIONS || [];
      for (var sp = 0; sp < sits.length; sp += 1) {
        sitPresets +=
          '<a class="mlma-chip" href="' +
          esc(D.libraryHref({ sit: [sits[sp].id] })) +
          '">' +
          esc(sits[sp].title) +
          '</a>';
      }
      body = emptyState({
        eyebrow: 'Уточните запрос',
        title: 'Опишите ситуацию чуть конкретнее',
        description: 'Слишком общий запрос. Напишите, что происходит, или выберите направление.',
        actions: sitPresets,
      });
    } else if (result.kind === 'zero') {
      var closeItems = [];
      if (result.close && result.close.length) {
        for (var z = 0; z < result.close.length; z += 1) closeItems.push(result.close[z].track || result.close[z]);
      }
      var hint = '';
      var examples = D.exampleQueries ? D.exampleQueries() : [];
      for (var h = 0; h < examples.length; h += 1) {
        hint += '<a class="mlma-example" href="' + esc(D.libraryHref({ q: examples[h] })) + '">' + esc(examples[h]) + '</a>';
      }
      var dir = '';
      for (var ds = 0; ds < state.sections.length; ds += 1) {
        dir += '<li style="display:flex">' + sectionCard(state.sections[ds], D.sectionStats(state.allTracks, state.sections[ds].sectionId), R) + '</li>';
      }
      body =
        emptyState({
          eyebrow: 'Точного совпадения нет',
          title: result.clarifyingQuestion || 'Точного совпадения пока нет. Попробуйте описать ситуацию проще или выберите ближайшее направление.',
          description: result.clarifyingQuestion
            ? 'Точного совпадения пока нет. Можно выбрать направление ниже или уточнить запрос.'
            : 'Ниже — уточняющие формулировки и шесть направлений.',
          actions:
            '<button type="button" class="mlma-btn mlma-btn-primary" data-mlma-reset="1">Сбросить запрос</button>' +
            btn(R.start(), 'Описать ситуацию'),
        }) +
        (hint ? '<div class="mlma-examples" style="margin-top:20px">' + hint + '</div>' : '') +
        '<section style="margin-top:32px"><h2 class="mlma-h3">Шесть направлений</h2><ul class="mlma-grid-3" style="margin-top:16px">' +
        dir +
        '</ul></section>' +
        (closeItems.length
          ? '<section style="margin-top:32px"><h2 class="mlma-h3">Ближайшие результаты</h2><div style="margin-top:16px">' +
            trackGrid(closeItems, state.sectionById, R, { whyMap: result.whyMap }) +
            '</div></section>'
          : '');
    } else {
      var featured = result.featured || [];
      var rest = (featured.length ? result.other : result.items) || [];
      var visible = rest.slice(0, shown);
      var more = rest.length > shown;
      body = '';
      if (featured.length) {
        body +=
          '<section class="mlma-featured"><div class="mlma-section-head"><h2 class="mlma-h3">Лучше всего подходят</h2><span class="mlma-meta">' +
          featured.length +
          '</span></div>' +
          trackGrid(featured, state.sectionById, R, { whyMap: result.whyMap, featured: true }) +
          '</section>';
      }
      if (visible.length) {
        body +=
          (featured.length ? '<section style="margin-top:36px"><div class="mlma-section-head"><h2 class="mlma-h3">Другие подходящие треки</h2></div>' : '') +
          trackGrid(visible, state.sectionById, R, { whyMap: result.whyMap }) +
          (featured.length ? '</section>' : '');
      }
      if (more) {
        body +=
          '<div style="margin-top:28px;text-align:center"><button type="button" class="mlma-btn mlma-btn-primary" data-mlma-more="1">Показать ещё</button></div>';
      }
      if (!featured.length && !visible.length) {
        body = emptyState({
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
    drawerFacets += facetBlock('Направление', stageChips);
    drawerFacets += facetBlock('Ситуация или задача', sitChips);
    drawerFacets += facetBlock('Формат результата', fmtChips);
    drawerFacets += facetBlock('Канал', chChips);
    drawerFacets += facetBlock('Уровень', lvlChips);
    drawerFacets += facetBlock('Доступность', availChips);
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
      '" autocomplete="off"><button class="mlma-btn mlma-btn-primary" type="submit">Найти решение</button></div></form>' +
      (chipsHtml ? '<div class="mlma-chip-row" id="mlma-active-chips">' + chipsHtml + '</div>' : '') +
      '<div class="mlma-filterbar"><button type="button" class="mlma-btn mlma-btn-small" id="mlma-open-filters" aria-haspopup="dialog" aria-expanded="false">Фильтры</button>' +
      '<button type="button" class="mlma-btn mlma-btn-small mlma-btn-ghost" id="mlma-share" data-mlma-share="' +
      esc(share) +
      '">Ссылка на подборку</button><span id="mlma-share-msg" class="mlma-muted" style="font-size:13px" aria-live="polite"></span></div></div>' +
      '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;padding:12px 0 20px"><p style="font-size:16px;font-weight:700" id="mlma-count">' +
      esc(result.label || '') +
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
    catalogBrowserHtml: catalogBrowserHtml,
    readCatalog: readCatalog,
    currentPage: currentPage,
    queryParam: queryParam,
    pathName: pathName,
    renderHome: renderHome,
    renderStart: renderStart,
    renderLibrary: renderLibrary,
    renderSection: renderSection,
    trackCard: trackCard,
    trackGrid: trackGrid,
    sectionCard: sectionCard,
    startResult: startResult,
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

  function renderTrack(state) {
    var R = state.R;
    var raw = queryParam('id') || state.root.getAttribute('data-mlma-track') || '';
    var trackId = D.normalizeTrackId(raw);
    var track = trackId ? D.getById(state.allTracks, trackId, true) : null;
    if (!track) return renderNotFound(state, 'Такого трека нет');
    var section = state.sectionById[track.sectionId];
    var status = D.getTrackStatusView(track);
    var saved = state.profile.savedTrackIds.indexOf(track.trackId) !== -1;
    var restore = D.readLibraryRestore ? D.readLibraryRestore() : null;
    var backHref = restore && restore.href ? restore.href : R.library();
    var context = { query: restore && restore.q ? restore.q : queryParam('from') };
    var bundle = D.nextTrackBundle(track, state.tracks, context);
    var recs = D.recommendNextTracks({
      current: track,
      visibleTracks: state.index,
      profile: state.profile,
    });
    var primaryTrack = bundle.primary || (recs.primary ? recs.primary.track : null);
    var variantNotes = [
      'Если ещё не выбрали канал',
      'Если разговор уже состоялся',
      'Если человек взял паузу',
    ];
    var cta = status.canStart
      ? btn(R.track(track.trackId), 'Пройти трек', 'primary', 'mlma-btn-block')
      : '';
    var primaryHtml = primaryTrack
      ? recBlock({ track: primaryTrack, reason: 'explicit_next_edge', available: false }, state, true) +
        '<p class="mlma-muted" style="margin-top:12px;font-size:14px">Продолжите сюда, если первое действие уже выполнено.</p>'
      : '<p class="mlma-lead mlma-muted" style="margin-top:16px;max-width:62ch">Продолжение появится вместе с маршрутом.</p>';
    var alts = '';
    if (bundle.variants && bundle.variants.length) {
      alts = '<div style="margin-top:24px"><span class="mlma-meta">Другие варианты</span><ul style="margin-top:16px;display:grid;gap:12px">';
      for (var a = 0; a < bundle.variants.length; a += 1) {
        alts +=
          '<li>' +
          recBlock({ track: bundle.variants[a], reason: 'same_section', available: false }, state, false) +
          '<p class="mlma-muted" style="margin-top:6px;font-size:13px">' +
          esc(variantNotes[a] || 'Связанный материал') +
          '</p></li>';
      }
      alts += '</ul></div>';
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
      (status.pageStatus ? badge(status.pageStatus, status.tone) : '') +
      '<span class="mlma-meta mlma-muted">' +
      esc(track.format) +
      '</span></div>' +
      '<h1 class="mlma-h1" style="margin-top:16px;max-width:22ch;text-transform:none">' +
      esc(track.title) +
      '</h1></div>' +
      '<div class="mlma-wrap mlma-split mlma-split-84" style="padding-bottom:48px">' +
      '<div style="display:grid;gap:20px">' +
      '<section class="mlma-card mlma-pad"><span class="mlma-meta">С какой ситуацией сюда</span><p style="margin-top:10px;font-size:17px;line-height:1.45">' +
      esc(track.situation) +
      '</p></section>' +
      '<section class="mlma-card mlma-pad"><span class="mlma-meta">Ожидаемый результат</span><p style="margin-top:10px;font-size:17px;line-height:1.45">' +
      esc(track.outcome) +
      '</p></section>' +
      '<section class="mlma-blueprint mlma-pad" aria-label="Содержание трека"><span class="mlma-eyebrow mlma-eyebrow-dark">Состояние</span><h2 class="mlma-h3" style="margin-top:12px">' +
      esc(status.pageStatus || 'Материал готовится') +
      '</h2>' +
      '<p class="mlma-muted" style="margin-top:12px;font-size:16px;line-height:1.5">' +
      esc(status.explanation) +
      '</p><p class="mlma-muted" style="margin-top:8px;font-size:15px">Пока нет уроков, длительности и заданий — только описание маршрута.</p></section>' +
      '<section class="mlma-card mlma-pad"><span class="mlma-meta">Будущий стандарт завершения</span><p class="mlma-muted" style="margin-top:8px;font-size:14px">Это объяснение того, как трек будет работать позже, а не уже включённая практика.</p><ol style="margin-top:12px;display:grid;gap:10px;font-size:15px"><li class="mlma-row">Действие выполнено в реальной работе.</li><li class="mlma-row">Результат зафиксирован.</li><li class="mlma-row">Выбран следующий шаг.</li></ol></section>' +
      '<section class="mlma-card mlma-pad-lg" style="padding:24px"><span class="mlma-eyebrow mlma-eyebrow-accent">Что дальше</span><h2 class="mlma-h3" style="margin-top:12px">' +
      (primaryTrack ? primaryTrack.title : 'Вернуться к подборке') +
      '</h2><div style="margin-top:16px">' +
      primaryHtml +
      alts +
      '</div><div class="mlma-actions" style="margin-top:20px">' +
      btn(R.section(track.sectionId), 'В раздел') +
      btn(backHref, 'Вернуться к подборке') +
      '</div></section></div>' +
      '<aside style="display:grid;gap:16px;align-content:start">' +
      '<div class="mlma-card mlma-pad">' +
      cta +
      '<button type="button" class="mlma-btn' +
      (saved ? ' mlma-btn-accent' : ' mlma-btn-primary') +
      ' mlma-btn-block" style="margin-top:12px" data-mlma-save="' +
      esc(track.trackId) +
      '" aria-pressed="' +
      (saved ? 'true' : 'false') +
      '">' +
      (saved ? 'Убрать описание' : 'Сохранить описание') +
      '</button>' +
      '<p class="mlma-muted" style="margin-top:12px;font-size:13px;line-height:1.45">Сохранение работает в этом браузере. Каталог открыт без входа.</p></div>' +
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

  function renderMy(state) {
    var R = state.R;
    var decision = D.resolveNextAction({ profile: state.profile, tracks: state.tracks });
    var alternatives = D.resolveAlternatives(decision, { profile: state.profile, tracks: state.tracks });
    var selected = state.profile.selectedSectionId ? state.sectionById[state.profile.selectedSectionId] : null;
    var savedTracks = [];
    for (var i = 0; i < state.profile.savedTrackIds.length; i += 1) {
      var found = null;
      for (var t = 0; t < state.tracks.length; t += 1) {
        if (state.tracks[t].trackId === state.profile.savedTrackIds[i]) found = state.tracks[t];
      }
      if (found) savedTracks.push(found);
    }
    var altHtml = '';
    if (alternatives.length) {
      altHtml = '<section class="mlma-card mlma-pad-lg" style="padding:28px"><span class="mlma-eyebrow">Альтернативы</span><h2 class="mlma-h3" style="margin-top:16px">Если сейчас не подходит</h2><ul style="margin-top:20px;display:grid;gap:12px">';
      for (var a = 0; a < alternatives.length; a += 1) {
        var track = alternatives[a];
        var status = D.getTrackStatusView(track);
        altHtml +=
          '<li><a class="mlma-card-soft mlma-card-hover" href="' +
          esc(R.track(track.trackId)) +
          '" style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;padding:16px;' +
          D.styleAttr(track.sectionId) +
          '"><span><span class="mlma-meta" style="display:block">' +
          esc(track.trackId) +
          ' · ' +
          esc((state.sectionById[track.sectionId] || {}).shortTitle || track.sectionId) +
          '</span><span style="display:block;margin-top:8px;font-size:16px;font-weight:700">' +
          esc(track.title) +
          '</span></span>' +
          badge(status.label, status.tone) +
          '</a></li>';
      }
      altHtml += '</ul></section>';
    }
    var savedList = '';
    if (!savedTracks.length) {
      savedList = '<p class="mlma-muted" style="margin-top:16px;font-size:15px">Здесь появятся треки, которые вы отложили. Сохранить трек можно с его страницы.</p>';
    } else {
      savedList = '<ul style="margin-top:16px;display:grid;gap:8px">';
      for (var s = 0; s < Math.min(5, savedTracks.length); s += 1) {
        savedList +=
          '<li class="mlma-row"><a href="' +
          esc(R.track(savedTracks[s].trackId)) +
          '"><span class="mlma-meta" style="display:block">' +
          esc(savedTracks[s].trackId) +
          '</span><span style="display:block;margin-top:4px;font-size:15px;font-weight:700">' +
          esc(savedTracks[s].title) +
          '</span></a></li>';
      }
      savedList += '</ul>';
    }
    return (
      pageHead(
        {
          eyebrow: 'Личный контур',
          title: 'Один следующий ход, а не сто двенадцать уроков',
          lead: 'Здесь всегда ровно одно главное действие. Всё остальное — контекст и альтернативы.',
          crumbs: [
            { label: 'Главная', href: R.home() },
            { label: 'Личная главная' },
          ],
        },
        R,
      ) +
      '<div class="mlma-wrap mlma-split mlma-split-84" style="padding-top:40px;padding-bottom:56px"><div style="display:grid;gap:24px;align-content:start">' +
      nextActionCard(decision, state) +
      altHtml +
      '<section class="mlma-card mlma-pad-lg" style="padding:28px"><span class="mlma-eyebrow">Последние результаты</span><h2 class="mlma-h3" style="margin-top:16px">Пока пусто</h2><p class="mlma-muted" style="margin-top:16px;max-width:62ch;font-size:16px">Результаты появятся не после просмотра урока, а когда вы сделаете действие и сохраните то, что получилось.</p><div style="margin-top:24px">' +
      btn(R.myResults(), 'Открыть мои результаты', '', 'mlma-btn-small') +
      '</div></section></div><aside style="display:grid;gap:16px;align-content:start">' +
      '<section class="mlma-card mlma-pad"><span class="mlma-eyebrow mlma-eyebrow-dark">Рабочий контекст</span><h2 class="mlma-h3" style="margin-top:16px">Что знает система</h2><dl style="margin-top:16px">' +
      '<div class="mlma-row"><dt class="mlma-meta mlma-muted">Раздел</dt><dd style="margin-top:4px;font-weight:700">' +
      esc(selected ? selected.sectionId + ' · ' + selected.shortTitle : 'Не выбран') +
      '</dd></div><div class="mlma-row"><dt class="mlma-meta mlma-muted">Текущая задача</dt><dd style="margin-top:4px;font-weight:700">' +
      esc(state.profile.currentGoal || 'Не сформулирована') +
      '</dd></div><div class="mlma-row"><dt class="mlma-meta mlma-muted">Сохранено треков</dt><dd style="margin-top:4px;font-weight:700">' +
      savedTracks.length +
      '</dd></div><div class="mlma-row"><dt class="mlma-meta mlma-muted">Режим</dt><dd style="margin-top:4px;font-weight:700">' +
      (state.preview ? 'Предпросмотр оболочки' : 'Рабочий режим') +
      '</dd></div></dl><div class="mlma-actions" style="margin-top:20px;flex-direction:column">' +
      btn(R.profile(), 'Настроить профиль', '', 'mlma-btn-small') +
      btn(R.start(), 'Поменять ситуацию', '', 'mlma-btn-small') +
      '</div></section>' +
      '<section class="mlma-card mlma-pad"><span class="mlma-eyebrow">Сохранённые треки</span><h2 class="mlma-h3" style="margin-top:16px">Мой маршрут</h2>' +
      savedList +
      '<div style="margin-top:20px">' +
      btn(R.myRoute(), 'Посмотреть маршрут', '', 'mlma-btn-small') +
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
    var savedNodes = [];
    for (var i = 0; i < state.profile.savedTrackIds.length; i += 1) {
      var track = null;
      for (var t = 0; t < state.tracks.length; t += 1) {
        if (state.tracks[t].trackId === state.profile.savedTrackIds[i]) track = state.tracks[t];
      }
      if (!track) continue;
      savedNodes.push({
        trackId: track.trackId,
        sectionId: track.sectionId,
        label: track.title,
        state: savedNodes.length === 0 ? 'current' : 'future',
        linkable: true,
        href: R.track(track.trackId),
      });
    }
    var demo = '';
    if (state.preview && state.pilot && state.pilot.nodes && state.pilot.nodes.length) {
      var nodes = state.pilot.nodes.slice(0, 5);
      var currentIndex = Math.min(3, nodes.length - 1);
      var demoNodes = [];
      for (var n = 0; n < nodes.length; n += 1) {
        var node = nodes[n];
        demoNodes.push({
          trackId: node.trackId,
          sectionId: node.sectionId,
          label: node.title,
          state: n < currentIndex ? 'done' : n === currentIndex ? 'current' : 'future',
          linkable: !!state.index[node.trackId],
          href: R.track(node.trackId),
        });
      }
      var branches = '';
      var current = nodes[currentIndex];
      if (current && current.nextTrackIds) {
        var branchItems = [];
        for (var b = 0; b < current.nextTrackIds.length && branchItems.length < 3; b += 1) {
          var next = state.index[current.nextTrackIds[b]];
          if (next) branchItems.push(next);
        }
        if (branchItems.length) {
          branches = '<div style="margin-top:32px"><span class="mlma-meta">Развилки после текущего шага · не больше трёх</span><ul class="mlma-grid-3" style="margin-top:16px">';
          for (var x = 0; x < branchItems.length; x += 1) {
            branches +=
              '<li><a class="mlma-card-soft mlma-card-hover" href="' +
              esc(R.track(branchItems[x].trackId)) +
              '" style="display:block;padding:16px;' +
              D.styleAttr(branchItems[x].sectionId) +
              '"><span class="mlma-meta">' +
              esc(branchItems[x].trackId) +
              '</span><span style="display:block;margin-top:8px;font-size:15px;font-weight:700">' +
              esc(branchItems[x].title) +
              '</span></a></li>';
          }
          branches += '</ul></div>';
        }
      }
      demo =
        '<section class="mlma-card mlma-pad-lg" style="padding:28px"><span class="mlma-eyebrow mlma-eyebrow-accent">Демонстрация · только предпросмотр</span><h2 class="mlma-h3" style="margin-top:16px">Как будет выглядеть ветка целиком</h2>' +
        '<p class="mlma-muted" style="margin-top:16px;max-width:70ch;font-size:16px">Ниже — пилотная ветка каталога, а не ваш прогресс. Она показывает форму маршрута: несколько сделанных шагов, один текущий и развилки после него.</p><div style="margin-top:32px">' +
        stepper(demoNodes) +
        branches +
        '</div></section>';
    }
    var myBranch = savedNodes.length
      ? '<div style="margin-top:28px">' +
        stepper(savedNodes) +
        '<p class="mlma-muted" style="margin-top:24px;max-width:70ch;font-size:15px">Порядок задаёте вы. Когда у треков появится содержание, сюда добавятся отметки о выполненных действиях и зафиксированных результатах.</p></div>'
      : '<div style="margin-top:28px">' +
        emptyState({
          title: 'Здесь пока нет вашего маршрута',
          description: 'Маршрут собирается из треков, которые вы сохранили, и из того, что вы реально сделали. Начните с выбора ситуации — раздел и первый шаг появятся здесь.',
          actions: btn(R.start(), 'Выбрать ситуацию', 'primary') + btn(R.library(), 'Открыть библиотеку'),
        }) +
        '</div>';
    return (
      pageHead(
        {
          eyebrow: 'Личный контур',
          title: 'Мой маршрут',
          lead: 'Не лестница из 112 уроков, а текущая ветка: что сделано, где вы сейчас и куда можно свернуть.',
          crumbs: [
            { label: 'Главная', href: R.home() },
            { label: 'Личная главная', href: R.my() },
            { label: 'Мой маршрут' },
          ],
        },
        R,
      ) +
      '<div class="mlma-wrap" style="padding-top:40px;padding-bottom:56px;display:grid;gap:40px"><section><span class="mlma-eyebrow mlma-eyebrow-dark">Моя ветка</span><h2 class="mlma-h3" style="margin-top:16px">' +
      (savedNodes.length ? 'Треки, которые вы отложили' : 'Маршрут ещё не начат') +
      '</h2>' +
      myBranch +
      '</section>' +
      demo +
      '</div>'
    );
  }

  function renderResults(state) {
    var R = state.R;
    var types = [
      ['text', 'Формулировка', 'Своя позиция, ответ, короткий текст'],
      ['list', 'Список', 'База контактов, план действий, сегмент'],
      ['message', 'Сообщение', 'Подготовленное или отправленное сообщение'],
      ['audio', 'Запись', 'Аудио разговора или тренировки'],
      ['image', 'Изображение', 'Скриншот переписки, фото документа'],
      ['link', 'Ссылка', 'Опубликованный материал'],
      ['fact', 'Отметка факта', 'Действие совершено'],
      ['appointment', 'Договорённость', 'Следующий контакт и дата'],
      ['reflection', 'Разбор', 'Факты разговора без самобичевания'],
    ];
    var typeHtml = '';
    for (var i = 0; i < types.length; i += 1) {
      typeHtml +=
        '<li class="mlma-card-soft" style="padding:16px"><span class="mlma-meta">' +
        esc(types[i][0]) +
        '</span><p style="margin-top:8px;font-size:16px;font-weight:700">' +
        esc(types[i][1]) +
        '</p><p class="mlma-muted" style="margin-top:4px;font-size:15px">' +
        esc(types[i][2]) +
        '</p></li>';
    }
    return (
      pageHead(
        {
          eyebrow: 'Личный контур',
          title: 'Мои результаты',
          lead: 'Единица прогресса здесь — не просмотр, а произведённый результат.',
          crumbs: [
            { label: 'Главная', href: R.home() },
            { label: 'Личная главная', href: R.my() },
            { label: 'Мои результаты' },
          ],
        },
        R,
      ) +
      '<div class="mlma-wrap" style="padding-top:40px;padding-bottom:56px;display:grid;gap:40px">' +
      emptyState({
        eyebrow: 'Пока пусто',
        title: 'Здесь пока нет результатов',
        description: 'Они появятся не после просмотра урока, а когда вы сделаете действие и сохраните то, что получилось: список, сообщение, запись разговора или договорённость с датой.',
        actions: btn(R.library(), 'Открыть библиотеку', 'primary') + btn(R.my(), 'Личная главная'),
      }) +
      '<section><span class="mlma-eyebrow">Типы результата</span><h2 class="mlma-h3" style="margin-top:16px">Что вообще может остаться после трека</h2><ul class="mlma-grid-3" style="margin-top:24px">' +
      typeHtml +
      '</ul><p class="mlma-muted" style="margin-top:24px;max-width:70ch;font-size:15px">Загрузка и хранение появятся вместе с содержанием треков. Сейчас интерфейс ничего не просит прикрепить и ничего не имитирует.</p></section></div>'
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
          eyebrow: 'Личный контур',
          title: 'Рабочий профиль',
          lead: 'Минимум полей: только то, что действительно влияет на выбор следующего шага.',
          crumbs: [
            { label: 'Главная', href: R.home() },
            { label: 'Профиль' },
          ],
        },
        R,
      ) +
      '<div class="mlma-wrap mlma-split mlma-split-75" style="padding-top:40px;padding-bottom:56px">' +
      '<form class="mlma-card mlma-pad-lg" style="padding:28px" id="mlma-profile-form"><span class="mlma-eyebrow mlma-eyebrow-dark">Рабочий профиль</span>' +
      '<h2 class="mlma-h3" style="margin-top:16px">Контекст, из которого система выбирает следующий шаг</h2>' +
      '<div style="margin-top:28px;display:grid;gap:24px"><div><label class="mlma-meta" style="display:block;margin-bottom:8px" for="mlma-section">Текущий раздел</label>' +
      '<select id="mlma-section" class="mlma-field" name="section">' +
      options +
      '</select></div><div><label class="mlma-meta" style="display:block;margin-bottom:8px" for="mlma-goal">Что нужно сделать в ближайшее время</label>' +
      '<input id="mlma-goal" class="mlma-field" name="goal" maxlength="260" placeholder="Например: начать первый разговор" value="' +
      esc(state.profile.currentGoal) +
      '"><p class="mlma-muted" style="margin-top:8px;font-size:14px">Одна фраза своими словами. Не больше ' +
      D.GOAL_MAX +
      ' символов.</p></div></div>' +
      '<div class="mlma-actions" style="margin-top:32px"><button type="submit" class="mlma-btn mlma-btn-primary">Сохранить</button>' +
      '<button type="button" class="mlma-btn" data-mlma-reset-profile="1">Очистить профиль</button></div>' +
      '<p id="mlma-profile-msg" style="margin-top:20px;font-size:15px;font-weight:700" aria-live="polite"></p>' +
      '<p class="mlma-muted" style="margin-top:20px;font-size:14px">Профиль хранится только в этом браузере. Настоящей авторизации и синхронизации между устройствами в текущей версии нет.</p></form>' +
      '<aside style="display:grid;gap:16px"><section class="mlma-card mlma-pad"><span class="mlma-eyebrow">Сохранённые треки</span><h2 class="mlma-h3" style="margin-top:16px">' +
      (savedTracks.length === 0 ? 'Пока ничего не сохранено' : savedTracks.length + ' в маршруте') +
      '</h2>' +
      savedHtml +
      '</section><section class="mlma-card mlma-pad"><span class="mlma-eyebrow">Доступ</span><h2 class="mlma-h3" style="margin-top:16px">Роль и тариф</h2><p class="mlma-muted" style="margin-top:16px;font-size:15px">Сейчас все опубликованные треки открыты без оплаты. Модель доступа описана отдельно.</p><div style="margin-top:20px">' +
      btn(R.access(), 'Посмотреть доступ', '', 'mlma-btn-small') +
      '</div></section></aside></div>'
    );
  }

  function renderAccess(state) {
    var R = state.R;
    return (
      pageHead(
        {
          eyebrow: 'Доступ к библиотеке',
          title: 'Сейчас можно смотреть структуру и описания',
          lead: 'Полные треки, сохранение маршрута и личный кабинет будут подключаться постепенно.',
          crumbs: [
            { label: 'Academy', href: R.home() },
            { label: 'Доступ' },
          ],
        },
        R,
      ) +
      '<div class="mlma-wrap" style="padding-top:40px;padding-bottom:56px"><div class="mlma-card mlma-pad-lg" style="padding:28px;max-width:760px">' +
      '<p class="mlma-lead" style="max-width:62ch">Сейчас можно посмотреть всю структуру библиотеки и описания будущих треков. Полные треки, сохранение маршрута и личный кабинет будут подключаться постепенно.</p>' +
      '<div class="mlma-actions" style="margin-top:28px">' +
      btn(R.library(), 'Открыть библиотеку', 'primary') +
      btn(R.start(), 'Выбрать ситуацию') +
      '</div></div></div>'
    );
  }

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
      case 'about':
        return renderAbout(state);
      case 'preview':
        return renderPreview(state);
      default:
        return renderNotFound(state);
    }
  }

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
    var timer = null;
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
      var result = D.searchCatalog(state.tracks, filters);
      if (result.kind === 'zero' || result.kind === 'need_more') {
        D.trackEvent('library_zero_results', { query: filters.q || '', filters: D.serializeLibraryState(filters), source: 'library' });
      } else if (filters.q) {
        D.trackEvent('library_search', { query: filters.q, filters: D.serializeLibraryState(filters), source: 'library' });
      } else {
        D.trackEvent('library_filter_change', { filters: D.serializeLibraryState(filters), source: 'library' });
      }
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
      var search = target.querySelector('#mlma-search');
      if (search) {
        search.addEventListener('input', function () {
          var value = search.value;
          window.clearTimeout(timer);
          timer = window.setTimeout(function () {
            filters.q = value;
            filters.preset = null;
            shown = D.PAGE_SIZE || 15;
            paint({ keepFocus: true, url: 'replace' });
          }, 200);
        });
      }
      var form = target.querySelector('#mlma-lib-form');
      if (form) {
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          var field = target.querySelector('#mlma-search');
          filters.q = field ? field.value : '';
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
      onToggle('data-mlma-ch', 'ch');
      onToggle('data-mlma-lvl', 'lvl');
      onToggle('data-mlma-avail', 'avail', true);
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
      var searchBefore = target.querySelector('#mlma-search');
      if (keep && searchBefore) selection = searchBefore.selectionStart;
      var wasOpen = drawerOpen;
      lastResult = opts.result || D.searchCatalog(state.tracks, filters);
      target.innerHTML = catalogBrowserHtml(state, filters, { shown: shown, result: lastResult });
      placeDrawer();
      bindChrome();
      if (wasOpen) setDrawer(true);
      var search = target.querySelector('#mlma-search');
      if (keep && search) {
        search.focus();
        try {
          var pos = selection == null ? search.value.length : selection;
          search.setSelectionRange(pos, pos);
        } catch (err) {
          /* ignore */
        }
      }
      if (opts.url === 'push') syncUrl('push');
      else if (opts.url === 'replace') syncUrl('replace');
      persist();
      emitSearch();
      if (!opts.skipRerank) requestRerank();
    }

    function requestRerank() {
      var url = typeof window !== 'undefined' ? window.MLMA_RERANK_URL : '';
      if (!url || !filters.q || !D.rerankPayload || !D.applyRerankResponse) return;
      var local = lastResult || D.searchCatalog(state.tracks, filters);
      var payload = D.rerankPayload(local, filters.q);
      if (!payload.candidates.length) return;
      var seq = (rerankSeq += 1);
      var qNow = filters.q;
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timerId = setTimeout(function () {
        if (ctrl) ctrl.abort();
      }, 2500);
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl ? ctrl.signal : undefined,
      })
        .then(function (res) {
          if (!res.ok) throw new Error('rerank ' + res.status);
          return res.json();
        })
        .then(function (data) {
          if (seq !== rerankSeq || filters.q !== qNow) return;
          var next = D.applyRerankResponse(local, data);
          if (next && next.source === 'ai') paint({ keepFocus: true, skipRerank: true, result: next });
        })
        .catch(function () {})
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
    rootEl.querySelectorAll('[data-mlma-save]').forEach(function (el) {
      el.addEventListener('click', function () {
        var id = el.getAttribute('data-mlma-save');
        if (!id) return;
        state.profile = D.toggleSavedTrack(id);
        mount(rootEl);
      });
    });
    var form = rootEl.querySelector('#mlma-profile-form');
    if (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var goal = (form.querySelector('#mlma-goal') || {}).value || '';
        var section = (form.querySelector('#mlma-section') || {}).value || '';
        var msg = form.querySelector('#mlma-profile-msg');
        if (goal.length > D.GOAL_MAX) {
          if (msg) msg.textContent = 'Задача длиннее ' + D.GOAL_MAX + ' символов. Сократите её.';
          return;
        }
        var patch = { currentGoal: goal.trim() };
        if (section) patch.selectedSectionId = section;
        else patch.selectedSectionId = null;
        state.profile = D.saveProfile(patch);
        if (msg) msg.textContent = 'Профиль сохранён в этом браузере.';
      });
    }
    rootEl.querySelectorAll('[data-mlma-reset-profile]').forEach(function (el) {
      el.addEventListener('click', function () {
        state.profile = D.resetProfile();
        mount(rootEl);
      });
    });
    rootEl.querySelectorAll('[data-mlma-preset]').forEach(function (el) {
      el.addEventListener('click', function () {
        D.trackEvent('academy_preset_click', { itemId: el.getAttribute('data-mlma-preset') || '', source: 'home' });
      });
    });
    var homeForm = rootEl.querySelector('form[action="/library"]');
    if (homeForm && state.page === 'home') {
      homeForm.addEventListener('submit', function () {
        var field = homeForm.querySelector('#mlma-home-q');
        D.trackEvent('academy_search', { query: field ? field.value : '', source: 'home' });
      });
    }
    bindLibrary(state, rootEl);
    applySeo(state);
  }

  function applySeo(state) {
    try {
      var robots = document.querySelector('meta[name="robots"]');
      if (!robots) {
        robots = document.createElement('meta');
        robots.setAttribute('name', 'robots');
        document.head.appendChild(robots);
      }
      robots.setAttribute('content', 'noindex, nofollow');
      var path = (window.location.pathname || '').replace(/\/+$/, '') || '/';
      if (path.indexOf('/track/') === 0) {
        var slug = path.slice('/track/'.length);
        var id = D.normalizeTrackId(slug);
        if (id && !queryParam('id')) {
          window.location.replace('/track?id=' + encodeURIComponent(String(id).toLowerCase()));
          return;
        }
      }
      if (state.page === 'track') {
        var opened = D.normalizeTrackId(queryParam('id'));
        if (opened) {
          var canon = document.querySelector('link[rel="canonical"]');
          if (!canon) {
            canon = document.createElement('link');
            canon.setAttribute('rel', 'canonical');
            document.head.appendChild(canon);
          }
          canon.setAttribute('href', window.location.origin + '/track?id=' + encodeURIComponent(String(opened).toLowerCase()));
        }
      }
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
      R: R,
    };
    rootEl.innerHTML =
      header(state) +
      '<main id="mlma-main">' +
      pageBody(state) +
      '</main>' +
      footer(state) +
      mobileNav(state);
    bind(state, rootEl);
    if (state.page === 'home') D.trackEvent('academy_home_open', { source: 'home' });
    if (state.page === 'library' || state.page === 'preview') D.trackEvent('library_open', { source: state.page });
    if (state.page === 'track') {
      var opened = D.normalizeTrackId(queryParam('id'));
      var openedTrack = opened ? D.getById(state.allTracks, opened, true) : null;
      var canStart = openedTrack ? D.getTrackStatusView(openedTrack).canStart : false;
      D.trackEvent(canStart ? 'track_open' : 'track_preview_open', {
        itemId: opened || '',
        status: openedTrack ? D.getTrackStatusView(openedTrack).contentStatus : 'missing',
        source: 'track',
      });
    }
  }

  D.mount = mount;
  D.readCatalog = readCatalog;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { mount(); });
    else mount();
  }
})(typeof window !== 'undefined' ? window : globalThis);
