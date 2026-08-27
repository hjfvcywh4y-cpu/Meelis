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

  function btn(href, label, variant, extraClass) {
    var cls = 'mlma-btn' + (variant ? ' mlma-btn-' + variant : '') + (extraClass ? ' ' + extraClass : '');
    return '<a class="' + cls + '" href="' + esc(href) + '">' + esc(label) + '</a>';
  }

  function header(state) {
    var R = state.R;
    var path = pathName();
    var profile = state.profile;
    var isMember = !!(profile.selectedSectionId || (profile.savedTrackIds && profile.savedTrackIds.length));
    var items = [
      { href: R.home(), label: 'Главная' },
      { href: R.library(), label: 'Библиотека' },
      { href: R.myRoute(), label: 'Мой маршрут' },
      { href: R.myResults(), label: 'Мои результаты' },
    ];
    var nav = '';
    for (var i = 0; i < items.length; i += 1) {
      nav +=
        '<a href="' +
        esc(items[i].href) +
        '"' +
        (isActivePath(path, items[i].href) ? ' aria-current="page"' : '') +
        '>' +
        esc(items[i].label) +
        '</a>';
    }
    var ctaHref = isMember ? R.my() : R.start();
    var ctaLabel = isMember ? 'Мой следующий шаг' : 'С чего начать';
    return (
      '<a class="mlma-skip" href="#mlma-main">К содержанию</a>' +
      (state.preview
        ? '<div class="mlma-banner"><span class="mlma-meta">Режим предпросмотра</span> <span class="mlma-meta" style="text-transform:none;font-weight:500"> видны все 112 карточек, включая неопубликованные</span></div>'
        : '') +
      '<header class="mlma-header"><div class="mlma-header-inner">' +
      '<a class="mlma-logo" href="' +
      esc(R.home()) +
      '" aria-label="MLM Academy — на главную"><span class="mlma-mark" aria-hidden="true"></span><span>MLM ACADEMY</span></a>' +
      '<nav class="mlma-nav" aria-label="Основная навигация">' +
      nav +
      '</nav>' +
      '<div class="mlma-header-actions">' +
      '<a class="mlma-btn mlma-btn-small" href="' +
      esc(R.library()) +
      '" style="display:none" id="mlma-search-btn">Поиск</a>' +
      '<a class="mlma-btn mlma-btn-small mlma-btn-primary" href="' +
      esc(ctaHref) +
      '">' +
      esc(ctaLabel) +
      '</a></div></div></header>'
    );
  }

  function footer(state) {
    var R = state.R;
    var links = [
      { href: R.start(), label: 'С чего начать' },
      { href: R.library(), label: 'Библиотека' },
      { href: R.my(), label: 'Личная главная' },
      { href: R.access(), label: 'Доступ' },
      { href: R.profile(), label: 'Профиль' },
    ];
    var nav = '';
    for (var i = 0; i < links.length; i += 1) {
      nav += '<li><a href="' + esc(links[i].href) + '">' + esc(links[i].label) + '</a></li>';
    }
    return (
      '<footer class="mlma-footer"><div class="mlma-wrap" style="display:flex;flex-direction:column;gap:24px;padding-top:32px;padding-bottom:32px">' +
      '<div><p style="font-size:17px;font-weight:800;letter-spacing:-0.03em">MLM ACADEMY</p>' +
      '<p class="mlma-footer-muted" style="margin-top:8px;max-width:420px;font-size:14px;line-height:1.5">Библиотека рабочих треков: ситуация, действие, зафиксированный результат и следующий шаг.</p></div>' +
      '<nav aria-label="Навигация в подвале"><ul style="display:flex;flex-wrap:wrap;gap:8px 24px;font-size:14px;font-weight:700">' +
      nav +
      '</ul></nav></div></footer>'
    );
  }

  function mobileNav(state) {
    var R = state.R;
    var path = pathName();
    var items = [
      { href: R.home(), label: 'Главная' },
      { href: R.library(), label: 'Библиотека' },
      { href: R.myRoute(), label: 'Маршрут' },
      { href: R.myResults(), label: 'Результаты' },
      { href: R.profile(), label: 'Профиль' },
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
    var published = stats ? stats.published : 0;
    var total = stats ? stats.total : 0;
    return (
      '<a class="mlma-card mlma-card-hover mlma-section-card" href="' +
      esc(R.section(section.sectionId)) +
      '" style="' +
      D.styleAttr(section.sectionId) +
      '"><span class="mlma-section-bar" aria-hidden="true"></span>' +
      '<span class="mlma-meta">' +
      esc(section.sectionId) +
      ' / ' +
      total +
      ' ' +
      D.pluralTracks(total) +
      '</span><h3 class="mlma-h3" style="margin-top:28px">' +
      esc(section.shortTitle) +
      '</h3><p class="mlma-muted" style="margin-top:16px;max-width:36ch;font-size:16px;line-height:1.35">' +
      esc(section.entryQuestion) +
      '</p><div style="margin-top:auto;padding-top:24px;display:flex;justify-content:space-between;align-items:end;gap:12px">' +
      badge(published > 0 ? 'Доступно ' + published : 'Готовится', published > 0 ? 'positive' : 'waiting') +
      '<span aria-hidden="true" style="font-size:30px;line-height:1">→</span></div></a>'
    );
  }

  function trackCard(track, section, R) {
    var status = D.getTrackStatusView(track);
    var shortTitle = section ? section.shortTitle : track.sectionId;
    return (
      '<article class="mlma-card mlma-card-hover mlma-track-card" style="' +
      D.styleAttr(track.sectionId) +
      '"><div class="mlma-strip" aria-hidden="true"></div><div style="display:flex;flex-direction:column;flex:1;padding:20px">' +
      '<span class="mlma-meta">' +
      esc(track.trackId) +
      ' / ' +
      esc(shortTitle) +
      '</span><h3 class="mlma-h3" style="margin-top:20px;font-size:22px"><a href="' +
      esc(R.track(track.trackId)) +
      '">' +
      esc(track.title) +
      '</a></h3><dl style="margin-top:20px;display:grid;gap:16px">' +
      '<div><dt class="mlma-meta mlma-muted">Подходит, если</dt><dd style="margin-top:4px;font-size:15px;line-height:1.35">' +
      esc(track.situation) +
      '</dd></div><div><dt class="mlma-meta mlma-muted">На выходе</dt><dd style="margin-top:4px;font-size:15px;line-height:1.35">' +
      esc(track.outcome) +
      '</dd></div><div><dt class="mlma-meta mlma-muted">Формат</dt><dd style="margin-top:4px;font-size:15px;line-height:1.35">' +
      esc(track.format) +
      '</dd></div></dl>' +
      '<div style="margin-top:auto;padding-top:20px;border-top:1px solid var(--mlma-line-soft);display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;align-items:center">' +
      badge(status.label, status.tone) +
      '<a class="mlma-btn mlma-btn-small" href="' +
      esc(R.track(track.trackId)) +
      '">' +
      esc(status.canStart ? 'Открыть трек' : 'Смотреть карточку') +
      '</a></div></div></article>'
    );
  }

  function trackGrid(tracks, sectionById, R) {
    if (!tracks.length) return '';
    var html = '<ul class="mlma-grid-3">';
    for (var i = 0; i < tracks.length; i += 1) {
      html += '<li style="display:flex">' + trackCard(tracks[i], sectionById[tracks[i].sectionId], R) + '</li>';
    }
    return html + '</ul>';
  }

  function renderHome(state) {
    var R = state.R;
    var sections = state.sections;
    var process = [
      ['01', 'Ситуация', 'Вы приходите с рабочим стопором: не знаю, кому написать; человек взял паузу; разговор рассыпался.'],
      ['02', 'Действие', 'Трек ведёт к одному наблюдаемому действию. Просмотр материала сам по себе ничего не закрывает.'],
      ['03', 'Следующий шаг', 'Результат остаётся у вас, а система показывает один главный ход и не больше трёх альтернатив.'],
    ];
    var shells = [
      ['Паспорт трека', 'Раздел, ID, формат и статус — без внутренних редакционных данных.'],
      ['Подходит, если', 'Ситуация, в которой этот трек уместен именно сейчас.'],
      ['На выходе', 'Измеримый результат, который останется у вас после действия.'],
      ['Шаги', 'Область содержания. Пока она честно пустая — трек ещё в производстве.'],
      ['Результат', 'Место, куда позже ляжет артефакт: текст, список, сообщение, запись.'],
      ['Куда дальше', 'Продолжения строятся по связям каталога, а не по «следующему уроку».'],
    ];
    var cards = '';
    for (var i = 0; i < sections.length; i += 1) {
      cards += '<li style="display:flex">' + sectionCard(sections[i], D.sectionStats(state.allTracks, sections[i].sectionId), R) + '</li>';
    }
    var steps = '';
    for (var p = 0; p < process.length; p += 1) {
      steps +=
        '<li><p style="font-size:64px;line-height:0.85;font-weight:800;letter-spacing:-0.08em">' +
        process[p][0] +
        '</p><h3 class="mlma-h3" style="margin-top:40px">' +
        esc(process[p][1]) +
        '</h3><p class="mlma-muted" style="margin-top:16px;font-size:16px;line-height:1.5">' +
        esc(process[p][2]) +
        '</p></li>';
    }
    var shell = '';
    for (var s = 0; s < shells.length; s += 1) {
      shell +=
        '<li class="mlma-card-soft" style="padding:20px;background:var(--mlma-surface)"><span class="mlma-meta">' +
        esc(shells[s][0]) +
        '</span><p class="mlma-muted" style="margin-top:12px;font-size:16px;line-height:1.35">' +
        esc(shells[s][1]) +
        '</p></li>';
    }
    var publishedTotal = 0;
    for (var t = 0; t < state.allTracks.length; t += 1) {
      if (state.allTracks[t].publicationStatus === 'published') publishedTotal += 1;
    }
    return (
      '<section style="border-bottom:2px solid var(--mlma-ink)"><div class="mlma-wrap mlma-split mlma-split-93" style="padding-top:48px;padding-bottom:64px">' +
      '<div><span class="mlma-eyebrow">Библиотека действий для MLM</span>' +
      '<h1 class="mlma-display" style="margin-top:24px;max-width:16ch">Не просто узнать. Сделать следующий результат.</h1>' +
      '<p class="mlma-lead mlma-muted" style="margin-top:28px;max-width:62ch">Выберите рабочую ситуацию. Платформа покажет конкретный трек, поможет зафиксировать то, что получилось, и даст следующий шаг.</p>' +
      '<div class="mlma-actions" style="margin-top:36px">' +
      btn(R.start(), 'Найти следующий шаг →', 'accent') +
      btn(R.library(), 'Открыть библиотеку') +
      '</div></div>' +
      '<aside class="mlma-card mlma-a1-panel" style="padding:24px;align-self:end"><span class="mlma-meta">Архитектура v0.2</span><p style="margin-top:12px;font-size:72px;line-height:1;font-weight:800;letter-spacing:-0.08em">6</p>' +
      '<p style="margin-top:16px;font-size:16px;line-height:1.35">входов по живым задачам партнёра. Не главы книги и не длинная учебная лестница.</p>' +
      '<p class="mlma-meta" style="margin-top:24px;padding-top:16px;border-top:1px solid var(--mlma-on-ink-line)">' +
      state.allTracks.length +
      ' треков в каталоге · доступно сейчас ' +
      publishedTotal +
      '</p></aside></div></section>' +
      '<section style="border-bottom:2px solid var(--mlma-ink)"><div class="mlma-wrap" style="padding-top:48px;padding-bottom:64px">' +
      '<span class="mlma-eyebrow mlma-eyebrow-dark">Выберите ситуацию</span><h2 class="mlma-h2" style="margin-top:20px">Где вы сейчас застряли?</h2>' +
      '<p class="mlma-muted" style="margin-top:16px;max-width:46ch;font-size:17px">Не нужно начинать с первого урока. Входите туда, где сегодня требуется действие.</p>' +
      '<ul class="mlma-grid-3" style="margin-top:32px">' +
      cards +
      '</ul></div></section>' +
      '<section style="border-bottom:2px solid var(--mlma-ink)"><div class="mlma-wrap" style="padding-top:48px;padding-bottom:64px">' +
      '<span class="mlma-eyebrow">Производственная логика</span><h2 class="mlma-h2" style="margin-top:20px;max-width:20ch">Три звена. Никакой имитации обучения.</h2>' +
      '<ul class="mlma-process" style="margin-top:32px">' +
      steps +
      '</ul></div></section>' +
      '<section style="border-bottom:2px solid var(--mlma-ink)"><div class="mlma-wrap" style="padding-top:48px;padding-bottom:64px">' +
      '<span class="mlma-eyebrow mlma-eyebrow-dark">Оболочка трека</span><h2 class="mlma-h2" style="margin-top:20px;max-width:22ch">Как устроена страница трека</h2>' +
      '<ul class="mlma-blueprint mlma-grid-3" style="margin-top:32px;padding:16px">' +
      shell +
      '</ul>' +
      '<p class="mlma-muted" style="margin-top:20px;max-width:70ch;font-size:15px;line-height:1.5">Это схема, а не пример урока. Оболочка не подставляет вместо содержания сгенерированный текст.</p></div></section>' +
      '<section style="border-bottom:2px solid var(--mlma-ink)"><div class="mlma-wrap mlma-split mlma-split-75" style="padding-top:48px;padding-bottom:64px">' +
      '<div><span class="mlma-eyebrow">Личный маршрут</span><h2 class="mlma-h2" style="margin-top:20px;max-width:18ch">Один следующий ход, а не сто двенадцать уроков</h2>' +
      '<p class="mlma-lead mlma-muted" style="margin-top:24px;max-width:58ch">Маршрут — это текущая ветка: что уже сделано, где вы сейчас и какие развилки открыты дальше. Никаких процентов прохождения курса, баллов и рейтингов.</p>' +
      '<div class="mlma-actions" style="margin-top:32px">' +
      btn(R.my(), 'Личная главная', 'primary') +
      btn(R.myRoute(), 'Посмотреть маршрут') +
      '</div></div>' +
      '<div class="mlma-card mlma-pad"><span class="mlma-meta">Что считается завершением</span><ul style="margin-top:20px;display:grid;gap:16px">' +
      '<li class="mlma-row" style="font-size:16px">Действие выполнено в реальности, а не в интерфейсе.</li>' +
      '<li class="mlma-row" style="font-size:16px">Результат зафиксирован: текст, список, сообщение, запись или договорённость.</li>' +
      '<li class="mlma-row" style="font-size:16px">Выбран следующий шаг.</li></ul></div></div></section>' +
      '<section><div class="mlma-wrap" style="padding-top:48px;padding-bottom:64px"><div class="mlma-card mlma-cut mlma-pad-lg" style="padding:40px">' +
      '<span class="mlma-eyebrow mlma-eyebrow-accent">Следующий шаг</span><h2 class="mlma-h2" style="margin-top:20px;max-width:20ch">Начните с ситуации, а не с оглавления</h2>' +
      '<p class="mlma-lead mlma-muted" style="margin-top:20px;max-width:60ch">' +
      (state.preview
        ? 'Сейчас включён режим предпросмотра: видна вся архитектура каталога, включая треки, которые ещё готовятся.'
        : 'Треки открываются по мере готовности. Оболочка честно показывает, что уже доступно, а что находится в производстве.') +
      '</p><div class="mlma-actions" style="margin-top:32px">' +
      btn(R.start(), 'Выбрать свою ситуацию', 'primary') +
      btn(R.library(), 'Открыть библиотеку') +
      '</div></div></div></section>'
    );
  }

  function renderStart(state) {
    var R = state.R;
    var sections = state.sections;
    var html =
      pageHead(
        {
          eyebrow: 'Быстрый вход',
          title: 'Выберите свою ситуацию',
          lead: 'Это не тест и не анкета. Один ответ — и вы попадаете в тот раздел, где сегодня нужно действие.',
          crumbs: [
            { label: 'Главная', href: R.home() },
            { label: 'С чего начать' },
          ],
        },
        R,
      ) +
      '<div class="mlma-wrap" style="padding-top:40px;padding-bottom:56px"><fieldset><legend class="mlma-h2" style="max-width:20ch">Что сейчас больше всего мешает вам двигаться?</legend>' +
      '<p class="mlma-lead mlma-muted" style="margin-top:20px;max-width:60ch">Выберите один ответ. Он определит раздел и сохранится в вашем профиле — потом его можно поменять.</p>' +
      '<ul class="mlma-grid-3" style="margin-top:32px">';
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
        ' / ' +
        stats.total +
        ' ' +
        D.pluralTracks(stats.total) +
        '</span><span class="mlma-h3" style="margin-top:20px;display:block">' +
        esc(section.entryQuestion) +
        '</span><span class="mlma-muted" style="margin-top:16px;display:block;font-size:15px;line-height:1.35">' +
        esc(section.shortTitle) +
        ' · ' +
        esc(section.promise) +
        '</span></button></li>';
    }
    html += '</ul></fieldset><div id="mlma-start-result" style="margin-top:48px">';
    html += startResult(state, selected);
    html += '</div></div>';
    return html;
  }

  function startResult(state, selected) {
    var R = state.R;
    if (!selected) {
      return '<p class="mlma-muted" style="font-size:16px">Ответ пока не выбран. Выберите ситуацию выше — раздел появится здесь.</p>';
    }
    var section = null;
    for (var i = 0; i < state.sections.length; i += 1) {
      if (state.sections[i].sectionId === selected) section = state.sections[i];
    }
    if (!section) return '';
    var sectionTracks = D.filterTracks(state.tracks, { sectionId: selected });
    var recommended = null;
    for (var t = 0; t < sectionTracks.length; t += 1) {
      if (sectionTracks[t].publicationStatus === 'published') {
        recommended = sectionTracks[t];
        break;
      }
    }
    if (!recommended && state.preview) recommended = sectionTracks[0] || null;
    var logic = '';
    for (var r = 0; r < section.routeLogic.length; r += 1) {
      if (r) logic += '<span class="mlma-muted" aria-hidden="true">→</span>';
      logic += '<span class="mlma-card-soft" style="padding:8px 12px;font-size:15px;font-weight:700">' + esc(section.routeLogic[r]) + '</span>';
    }
    var recHtml = recommended
      ? trackCard(recommended, section, R)
      : '<div class="mlma-card mlma-pad"><p style="font-size:16px;line-height:1.5">В этом разделе пока нет открытых треков. Раздел сохранён в профиле — как только появится первый трек, он окажется на вашей личной главной.</p><div style="margin-top:20px">' +
        btn(R.library(), 'Посмотреть библиотеку', '', 'mlma-btn-small') +
        '</div></div>';
    var recLabel = recommended
      ? recommended.publicationStatus === 'published'
        ? 'Рекомендуемый трек'
        : 'Первый трек раздела'
      : 'Рекомендация';
    return (
      '<div class="mlma-card mlma-pad-lg" style="' +
      D.styleAttr(section.sectionId) +
      ';padding:32px"><span class="mlma-eyebrow mlma-eyebrow-accent">Ваш раздел: ' +
      esc(section.sectionId) +
      ' · ' +
      esc(section.shortTitle) +
      '</span><h2 class="mlma-h2" style="margin-top:20px;max-width:24ch">' +
      esc(section.title) +
      '</h2><p class="mlma-lead mlma-muted" style="margin-top:16px;max-width:62ch">' +
      esc(section.promise) +
      '</p><div class="mlma-split mlma-split-75" style="margin-top:32px"><div><span class="mlma-meta">Логика раздела</span>' +
      '<ol style="margin-top:16px;display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center">' +
      logic +
      '</ol><div class="mlma-actions" style="margin-top:32px">' +
      btn(R.section(section.sectionId), 'Показать мой раздел', 'primary') +
      btn(R.my(), 'Личная главная') +
      '</div></div><div><span class="mlma-meta">' +
      esc(recLabel) +
      '</span><div style="margin-top:16px">' +
      recHtml +
      '</div></div></div></div>'
    );
  }

  function renderLibrary(state) {
    var R = state.R;
    var head = pageHead(
      {
        eyebrow: state.preview ? 'Каталог / предпросмотр' : 'Каталог',
        title: 'Библиотека рабочих ситуаций',
        lead: 'Ищите не по темам, а по тому, что нужно сделать. Карточка обещает конкретный результат, а не «освоение материала».',
        crumbs: [
          { label: 'Главная', href: R.home() },
          { label: 'Библиотека' },
        ],
      },
      R,
    );
    if (!state.preview && state.tracks.length === 0) {
      var cards = '';
      for (var i = 0; i < state.sections.length; i += 1) {
        cards += '<li style="display:flex">' + sectionCard(state.sections[i], D.sectionStats(state.allTracks, state.sections[i].sectionId), R) + '</li>';
      }
      return (
        head +
        '<div class="mlma-wrap" style="padding-top:40px;padding-bottom:56px">' +
        emptyState({
          eyebrow: 'Каталог готовится',
          title: 'Открытых треков пока нет',
          description:
            'Все 112 треков описаны и связаны между собой, но ни один пока не опубликован. Выберите ситуацию — раздел сохранится, и первый доступный трек появится на вашей личной главной.',
          actions: btn(R.start(), 'Выбрать ситуацию', 'primary') + btn(R.my(), 'Личная главная'),
        }) +
        '<section style="margin-top:48px"><h2 class="mlma-h3">Шесть входов библиотеки</h2><ul class="mlma-grid-3" style="margin-top:24px">' +
        cards +
        '</ul></section></div>'
      );
    }
    return head + '<div id="mlma-catalog"></div>';
  }

  function catalogBrowserHtml(state, filters) {
    var R = state.R;
    var results = D.filterTracks(state.tracks, filters);
    var formats = [];
    var seen = {};
    for (var i = 0; i < state.tracks.length; i += 1) {
      if (!seen[state.tracks[i].format]) {
        seen[state.tracks[i].format] = true;
        formats.push(state.tracks[i].format);
      }
    }
    formats.sort(function (a, b) {
      return a.localeCompare(b, 'ru');
    });
    var chips = '<button type="button" class="mlma-chip' + (!filters.sectionId ? ' mlma-chip-on' : '') + '" data-mlma-section="">Все разделы</button>';
    for (var s = 0; s < D.SECTION_IDS.length; s += 1) {
      var id = D.SECTION_IDS[s];
      chips +=
        '<button type="button" class="mlma-chip' +
        (filters.sectionId === id ? ' mlma-chip-on' : '') +
        '" data-mlma-section="' +
        id +
        '">' +
        id +
        '</button>';
    }
    var formatOpts = '<option value="">Любой формат</option>';
    for (var f = 0; f < formats.length; f += 1) {
      formatOpts +=
        '<option value="' +
        esc(formats[f]) +
        '"' +
        (filters.format === formats[f] ? ' selected' : '') +
        '>' +
        esc(formats[f]) +
        '</option>';
    }
    var avail = '';
    if (state.preview) {
      var pairs = [
        ['all', 'Все'],
        ['available', 'Доступные'],
        ['preparing', 'Готовятся'],
      ];
      avail = '<fieldset style="min-width:0"><legend class="mlma-meta" style="margin-bottom:8px">Доступность</legend><div style="display:flex;flex-wrap:wrap;gap:8px">';
      for (var a = 0; a < pairs.length; a += 1) {
        avail +=
          '<button type="button" class="mlma-chip' +
          ((filters.availability || 'all') === pairs[a][0] ? ' mlma-chip-on' : '') +
          '" data-mlma-avail="' +
          pairs[a][0] +
          '">' +
          pairs[a][1] +
          '</button>';
      }
      avail += '</div></fieldset>';
    }
    var countLabel = results.length === 0 ? 'Ничего не найдено' : results.length + ' ' + D.pluralTracks(results.length);
    var body;
    if (results.length === 0) {
      body = emptyState({
        eyebrow: 'Пустой результат',
        title: 'По этому запросу треков нет',
        description: 'Попробуйте описать ситуацию своими словами — например «человек взял паузу» или «не знаю, кому написать». Или откройте раздел целиком.',
        actions:
          '<button type="button" class="mlma-btn" data-mlma-reset="1">Сбросить фильтры</button>' +
          btn(state.R.start(), 'Выбрать ситуацию', 'primary'),
      });
    } else if (filters.view === 'grouped') {
      body = '';
      for (var g = 0; g < state.sections.length; g += 1) {
        var section = state.sections[g];
        var group = [];
        for (var r = 0; r < results.length; r += 1) {
          if (results[r].sectionId === section.sectionId) group.push(results[r]);
        }
        if (!group.length) continue;
        body +=
          '<section style="margin-bottom:40px"><div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;border-bottom:2px solid var(--mlma-ink);padding-bottom:12px">' +
          '<h2 class="mlma-h3">' +
          esc(section.sectionId) +
          ' · ' +
          esc(section.shortTitle) +
          '</h2><span class="mlma-meta">' +
          group.length +
          ' ' +
          D.pluralTracks(group.length) +
          '</span></div><div style="margin-top:16px">' +
          trackGrid(group, state.sectionById, R) +
          '</div></section>';
      }
    } else {
      body = trackGrid(results, state.sectionById, R);
    }
    return (
      '<div class="mlma-wrap"><div style="display:grid;gap:16px;border-bottom:2px solid var(--mlma-ink);padding:24px 0">' +
      '<div><label class="mlma-meta" style="display:block;margin-bottom:8px" for="mlma-search">Поиск по ситуации и результату</label>' +
      '<input id="mlma-search" class="mlma-field" type="search" placeholder="Например: написать первое сообщение" value="' +
      esc(filters.query || '') +
      '"></div><div style="display:flex;flex-wrap:wrap;gap:8px">' +
      chips +
      '</div></div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:16px;justify-content:space-between;padding:20px 0;border-bottom:1px solid var(--mlma-line-soft)">' +
      '<div style="display:flex;flex-wrap:wrap;gap:16px;align-items:end"><div><label class="mlma-meta" style="display:block;margin-bottom:8px" for="mlma-format">Формат</label>' +
      '<select id="mlma-format" class="mlma-field" style="min-height:44px;max-width:280px;font-size:15px">' +
      formatOpts +
      '</select></div>' +
      avail +
      '</div><div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center"><span class="mlma-meta">Вид</span>' +
      '<button type="button" class="mlma-chip' +
      (filters.view !== 'grouped' ? ' mlma-chip-on' : '') +
      '" data-mlma-view="list">Списком</button>' +
      '<button type="button" class="mlma-chip' +
      (filters.view === 'grouped' ? ' mlma-chip-on' : '') +
      '" data-mlma-view="grouped">По разделам</button></div></div>' +
      '<div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;padding:20px 0"><p style="font-size:16px;font-weight:700">' +
      esc(countLabel) +
      '</p><span class="mlma-muted" style="font-size:14px">' +
      (state.preview ? 'В production неопубликованные треки скрыты' : 'Показаны только опубликованные треки') +
      '</span></div><div style="padding-bottom:64px">' +
      body +
      '</div></div>'
    );
  }

  function renderSection(state) {
    var R = state.R;
    var sectionId = D.normalizeSectionId(state.root.getAttribute('data-mlma-section') || '');
    var section = sectionId ? state.sectionById[sectionId] : null;
    if (!section) {
      return renderNotFound(state, 'Раздел не найден');
    }
    var stats = D.sectionStats(state.allTracks, sectionId);
    var tracks = D.filterTracks(state.tracks, { sectionId: sectionId });
    var available = [];
    var preparing = [];
    for (var i = 0; i < tracks.length; i += 1) {
      if (tracks[i].publicationStatus === 'published') available.push(tracks[i]);
      else preparing.push(tracks[i]);
    }
    var modules = {};
    var moduleList = [];
    for (var t = 0; t < tracks.length; t += 1) {
      if (!modules[tracks[t].module]) {
        modules[tracks[t].module] = 0;
        moduleList.push(tracks[t].module);
      }
      modules[tracks[t].module] += 1;
    }
    var logic = '';
    for (var r = 0; r < section.routeLogic.length; r += 1) {
      if (r) logic += '<span class="mlma-muted" aria-hidden="true">→</span>';
      logic += '<span class="mlma-card" style="padding:12px 16px;font-size:16px;font-weight:700">' + esc(section.routeLogic[r]) + '</span>';
    }
    var moduleHtml = '';
    for (var m = 0; m < moduleList.length; m += 1) {
      moduleHtml +=
        '<li class="mlma-card-soft" style="padding:12px 16px;font-size:15px"><span style="font-weight:700">' +
        esc(moduleList[m]) +
        '</span> <span class="mlma-muted">' +
        modules[moduleList[m]] +
        ' ' +
        D.pluralTracks(modules[moduleList[m]]) +
        '</span></li>';
    }
    var availableBlock =
      available.length > 0
        ? trackGrid(available, state.sectionById, R)
        : emptyState({
            eyebrow: 'Раздел готовится',
            title: 'Открытых треков в этом разделе пока нет',
            description:
              'Структура раздела готова: ' +
              stats.total +
              ' ' +
              D.pluralTracks(stats.total) +
              ' описаны и связаны между собой. Как только первый из них будет опубликован, он появится здесь и на вашей личной главной.',
            actions: btn(R.library(), 'Вернуться в библиотеку', 'primary') + btn(R.start(), 'Выбрать другую ситуацию'),
          });
    var preparingBlock = '';
    if (state.preview && preparing.length) {
      preparingBlock =
        '<section style="margin-top:48px"><div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;border-bottom:2px solid var(--mlma-ink);padding-bottom:12px">' +
        '<h2 class="mlma-h3">Готовятся</h2><span class="mlma-meta">только в предпросмотре · ' +
        preparing.length +
        ' ' +
        D.pluralTracks(preparing.length) +
        '</span></div><div style="margin-top:24px">' +
        trackGrid(preparing, state.sectionById, R) +
        '</div></section>';
    }
    return (
      '<div style="' +
      D.styleAttr(sectionId) +
      '">' +
      pageHead(
        {
          eyebrow: section.sectionId + ' · ' + stats.total + ' ' + D.pluralTracks(stats.total) + ' · доступно ' + stats.published,
          title: section.title,
          lead: section.promise,
          crumbs: [
            { label: 'Главная', href: R.home() },
            { label: 'Библиотека', href: R.library() },
            { label: section.sectionId + ' ' + section.shortTitle },
          ],
          aside:
            '<div class="mlma-card mlma-pad" style="' +
            D.styleAttr(sectionId) +
            '"><span class="mlma-strip" style="display:block;height:12px;width:64px;margin-bottom:16px"></span><span class="mlma-meta">Входная ситуация</span><p style="margin-top:12px;max-width:34ch;font-size:16px;line-height:1.35">' +
            esc(section.entryQuestion) +
            '</p></div>',
        },
        R,
      ) +
      '<div class="mlma-wrap" style="padding-top:40px;padding-bottom:56px">' +
      '<span class="mlma-eyebrow">Логика раздела</span><h2 class="mlma-h3" style="margin-top:16px">Как обычно идёт работа здесь</h2>' +
      '<ol style="margin-top:20px;display:flex;flex-wrap:wrap;gap:12px;align-items:center">' +
      logic +
      '</ol><p class="mlma-muted" style="margin-top:16px;max-width:70ch;font-size:15px">Это не обязательная лестница из уроков. Можно войти в любой момент цепочки.</p>' +
      (moduleList.length
        ? '<section style="margin-top:48px"><span class="mlma-eyebrow mlma-eyebrow-dark">Модули раздела</span><h2 class="mlma-h3" style="margin-top:16px">Из чего собран раздел</h2><ul style="margin-top:20px;display:flex;flex-wrap:wrap;gap:8px">' +
          moduleHtml +
          '</ul></section>'
        : '') +
      '<section style="margin-top:48px"><div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;border-bottom:2px solid var(--mlma-ink);padding-bottom:12px"><h2 class="mlma-h3">Доступные треки</h2><span class="mlma-meta">' +
      available.length +
      ' ' +
      D.pluralTracks(available.length) +
      '</span></div><div style="margin-top:24px">' +
      availableBlock +
      '</div></section>' +
      preparingBlock +
      '<div class="mlma-actions" style="margin-top:48px">' +
      btn(R.start(), 'Вернуться к выбору ситуации') +
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

  function renderTrack(state) {
    var R = state.R;
    var raw = queryParam('id') || state.root.getAttribute('data-mlma-track') || '';
    var trackId = D.normalizeTrackId(raw);
    var track = trackId ? D.getById(state.allTracks, trackId, state.preview) : null;
    if (!track) return renderNotFound(state, 'Трек не найден');
    var section = state.sectionById[track.sectionId];
    var status = D.getTrackStatusView(track);
    var saved = state.profile.savedTrackIds.indexOf(track.trackId) !== -1;
    var recs = D.recommendNextTracks({
      current: track,
      visibleTracks: state.index,
      profile: state.profile,
    });
    var passportRows = [
      ['Раздел', section ? section.sectionId + ' · ' + section.shortTitle : track.sectionId],
      ['Модуль', track.module],
      ['Формат', track.format],
      ['Статус', status.label],
      ['Прогресс', status.showProgress ? 'Считается по шагам' : 'Не считается до появления шагов'],
      ['Продолжения', track.nextTrackIds.length + ' ' + D.pluralTracks(track.nextTrackIds.length)],
    ];
    var passport = '';
    for (var i = 0; i < passportRows.length; i += 1) {
      passport +=
        '<div class="mlma-row"><dt class="mlma-meta mlma-muted">' +
        esc(passportRows[i][0]) +
        '</dt><dd style="margin-top:4px;font-size:16px;font-weight:700">' +
        esc(passportRows[i][1]) +
        '</dd></div>';
    }
    var startBlock = status.canStart
      ? btn(R.track(track.trackId), 'Начать трек', 'primary', 'mlma-btn-block')
      : '<p class="mlma-muted" style="font-size:15px;line-height:1.5">' + esc(status.explanation) + '</p>';
    var primary = recs.primary
      ? recBlock(recs.primary, state, true)
      : '<p class="mlma-lead mlma-muted" style="margin-top:20px;max-width:62ch">У этого трека пока нет доступных продолжений. Это не тупик: вернитесь в раздел или откройте библиотеку.</p>';
    var alts = '';
    if (recs.primary && recs.alternatives.length) {
      alts = '<div><span class="mlma-meta">Альтернативы · не больше трёх</span><ul style="margin-top:16px;display:grid;gap:12px">';
      for (var a = 0; a < recs.alternatives.length; a += 1) {
        alts += '<li>' + recBlock(recs.alternatives[a], state, false) + '</li>';
      }
      alts += '</ul></div>';
    }
    return (
      '<div style="' +
      D.styleAttr(track.sectionId) +
      '"><div style="display:grid;border-bottom:2px solid var(--mlma-ink)" class="mlma-split mlma-split-84">' +
      '<div style="padding:32px 16px;border-bottom:2px solid var(--mlma-ink)">' +
      crumbs(
        [
          { label: 'Библиотека', href: R.library() },
          { label: (section ? section.sectionId + ' ' + section.shortTitle : track.sectionId), href: R.section(track.sectionId) },
          { label: track.trackId },
        ],
        R,
      ) +
      '<div style="margin-top:24px;display:flex;flex-wrap:wrap;gap:12px;align-items:center">' +
      '<span class="mlma-eyebrow mlma-eyebrow-accent">' +
      esc(track.trackId) +
      ' · ' +
      esc(section ? section.shortTitle : track.sectionId) +
      '</span>' +
      badge(status.label, status.tone) +
      '</div><h1 class="mlma-h1" style="margin-top:24px;max-width:18ch;text-transform:none">' +
      esc(track.title) +
      '</h1><dl class="mlma-grid-2" style="margin-top:32px"><div class="mlma-card mlma-pad"><dt class="mlma-meta">Подходит, если</dt><dd class="mlma-lead" style="margin-top:12px">' +
      esc(track.situation) +
      '</dd></div><div class="mlma-card mlma-pad"><dt class="mlma-meta">На выходе</dt><dd class="mlma-lead" style="margin-top:12px">' +
      esc(track.outcome) +
      '</dd></div></dl>' +
      '<section class="mlma-blueprint" style="margin-top:32px;min-height:320px;display:grid;place-items:center;padding:48px 16px;text-align:center" aria-label="Содержание трека">' +
      '<div style="max-width:540px"><span class="mlma-eyebrow mlma-eyebrow-dark">Структура готова</span><h2 class="mlma-h2" style="margin-top:20px">Содержание трека ещё не добавлено</h2>' +
      '<p class="mlma-muted" style="margin-top:16px;font-size:17px;line-height:1.5">' +
      esc(status.explanation) +
      '</p><p class="mlma-muted" style="margin-top:12px;font-size:16px">Здесь появятся шаги, само действие и фиксация результата. Оболочка не подменяет их сгенерированным текстом.</p>' +
      '<div class="mlma-actions" style="margin-top:28px;justify-content:center">' +
      btn(R.section(track.sectionId), 'Вернуться в раздел', 'primary') +
      btn(R.library(), 'Открыть библиотеку') +
      '</div></div></section></div>' +
      '<aside style="padding:32px 16px;display:grid;gap:16px;align-content:start">' +
      '<section class="mlma-card mlma-pad"><span class="mlma-meta">Паспорт трека</span><dl style="margin-top:16px">' +
      passport +
      '</dl></section>' +
      '<div class="mlma-card mlma-pad">' +
      startBlock +
      '<button type="button" class="mlma-btn' +
      (saved ? ' mlma-btn-accent' : '') +
      ' mlma-btn-block" style="margin-top:16px" data-mlma-save="' +
      esc(track.trackId) +
      '" aria-pressed="' +
      (saved ? 'true' : 'false') +
      '">' +
      (saved ? 'Убрать из моего маршрута' : 'Сохранить в мой маршрут') +
      '</button>' +
      (saved ? '<p style="margin-top:16px">' + badge('Сохранён в маршруте', 'positive') + '</p>' : '') +
      '<p class="mlma-muted" style="margin-top:16px;font-size:13px;line-height:1.4">Сохранение хранится только в этом браузере. Аккаунтов и синхронизации в текущей версии нет.</p></div>' +
      '<section class="mlma-card mlma-pad"><span class="mlma-meta">Результат действия</span><h3 class="mlma-h3" style="margin-top:12px">Что здесь появится</h3>' +
      '<p class="mlma-muted" style="margin-top:12px;font-size:16px">' +
      esc(track.outcome) +
      '</p><p class="mlma-muted" style="margin-top:20px;font-size:14px">Загрузка появится вместе с содержанием трека. Сейчас сохранять нечего.</p></section>' +
      '<section class="mlma-card mlma-pad"><span class="mlma-meta">Когда трек считается сделанным</span><h3 class="mlma-h3" style="margin-top:12px">Действие + результат + следующий шаг</h3>' +
      '<ol style="margin-top:16px;display:grid;gap:12px;font-size:15px"><li class="mlma-row">Действие выполнено в реальной работе.</li><li class="mlma-row">Результат зафиксирован.</li><li class="mlma-row">Выбран следующий шаг.</li></ol></section>' +
      '</aside></div>' +
      '<section style="border-top:2px solid var(--mlma-ink)"><div class="mlma-wrap" style="padding-top:40px;padding-bottom:56px">' +
      '<span class="mlma-eyebrow mlma-eyebrow-dark">Куда дальше</span><h2 class="mlma-h2" style="margin-top:20px">' +
      (recs.primary ? 'Возможное продолжение' : 'Продолжение готовится') +
      '</h2>' +
      (recs.primary
        ? '<div class="mlma-split mlma-split-75" style="margin-top:28px">' + primary + alts + '</div>'
        : primary) +
      (recs.needsFallback
        ? '<div class="mlma-actions" style="margin-top:32px">' +
          btn(R.section(track.sectionId), 'Вернуться в раздел', 'primary') +
          btn(R.library(), 'Открыть библиотеку') +
          '</div>'
        : '') +
      '</div></section></div>'
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
    var levels = [
      ['free', 'Свободный', 'Трек открыт всем. Так сейчас работают все опубликованные треки.'],
      ['paid', 'Платный', 'Потребует активной подписки. Оплата в этой версии не подключена.'],
      ['organization', 'От организации', 'Доступ выдаёт команда или структура, к которой вы принадлежите.'],
      ['invite', 'По приглашению', 'Доступ выдаётся точечно: пилот, наставничество, закрытая группа.'],
    ];
    var levelHtml = '';
    for (var i = 0; i < levels.length; i += 1) {
      levelHtml +=
        '<li class="mlma-card-soft" style="padding:16px"><span class="mlma-meta">' +
        esc(levels[i][0]) +
        '</span><p style="margin-top:8px;font-size:17px;font-weight:700">' +
        esc(levels[i][1]) +
        '</p><p class="mlma-muted" style="margin-top:8px;font-size:15px">' +
        esc(levels[i][2]) +
        '</p></li>';
    }
    var roles = [
      ['Гость', 'Смотрит витрину и опубликованный каталог'],
      ['Участник', 'Имеет маршрут, сохранения и результаты'],
      ['Наставник', 'Позже увидит согласованный прогресс подопечных'],
      ['Редактор', 'Проверяет метаданные и статусы'],
    ];
    var roleHtml = '';
    for (var r = 0; r < roles.length; r += 1) {
      roleHtml +=
        '<div class="mlma-row"><dt style="font-size:16px;font-weight:700">' +
        esc(roles[r][0]) +
        '</dt><dd class="mlma-muted" style="margin-top:4px;font-size:15px">' +
        esc(roles[r][1]) +
        '</dd></div>';
    }
    var isGuest = !state.profile.selectedSectionId && state.profile.savedTrackIds.length === 0;
    return (
      pageHead(
        {
          eyebrow: 'Доступ',
          title: 'Как устроен доступ',
          lead: 'Пока в системе нет оплаты. Эта страница честно объясняет, что уже работает, а что появится позже.',
          crumbs: [
            { label: 'Главная', href: R.home() },
            { label: 'Доступ' },
          ],
        },
        R,
      ) +
      '<div class="mlma-wrap mlma-split mlma-split-75" style="padding-top:40px;padding-bottom:56px"><div style="display:grid;gap:24px">' +
      '<section class="mlma-card mlma-pad-lg" style="padding:28px"><span class="mlma-eyebrow mlma-eyebrow-dark">Уровни доступа</span><h2 class="mlma-h3" style="margin-top:16px">Четыре режима, заложенные в модель данных</h2><ul class="mlma-grid-2" style="margin-top:24px">' +
      levelHtml +
      '</ul><p class="mlma-muted" style="margin-top:24px;max-width:70ch;font-size:15px">Сложный адрес трека не является защитой. Когда доступ включится, он будет проверяться по entitlement, а не по знанию ссылки.</p></section>' +
      '<section class="mlma-card mlma-pad-lg" style="padding:28px"><span class="mlma-eyebrow">Что сейчас</span><h2 class="mlma-h3" style="margin-top:16px">Оплата пока не подключена</h2><p class="mlma-muted" style="margin-top:16px;max-width:70ch;font-size:16px">Кнопки «Оплатить» здесь нет намеренно: она бы обещала то, чего ещё не существует. Профиль и маршрут работают локально в браузере. Вход в кабинет на сайте — через Tilda Members.</p><div class="mlma-actions" style="margin-top:28px">' +
      btn(R.library(), 'Открыть библиотеку', 'primary') +
      '</div></section></div><aside style="display:grid;gap:16px;align-content:start">' +
      '<div class="mlma-card mlma-pad"><span class="mlma-meta">Текущее состояние</span><div style="margin-top:16px;display:grid;gap:12px">' +
      badge(isGuest ? 'Гость' : 'Участник (локальный профиль)', isGuest ? 'neutral' : 'positive') +
      badge('Тариф не выбран', 'waiting') +
      '</div><p class="mlma-muted" style="margin-top:20px;font-size:15px">Опубликованные треки сейчас открыты всем. Ограничение по тарифу включится позже.</p></div>' +
      '<section class="mlma-card mlma-pad"><span class="mlma-eyebrow">Роли</span><h2 class="mlma-h3" style="margin-top:16px">Кто есть в системе</h2><dl style="margin-top:16px">' +
      roleHtml +
      '</dl></section></aside></div>'
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
      case 'preview':
        return renderPreview(state);
      default:
        return renderNotFound(state);
    }
  }

  function bindLibrary(state, rootEl) {
    if (!rootEl.querySelector('#mlma-catalog')) return;
    var filters = {
      query: queryParam('q'),
      sectionId: D.normalizeSectionId(queryParam('section')),
      format: queryParam('format') || null,
      availability: 'all',
      view: 'list',
    };
    function paint() {
      var target = rootEl.querySelector('#mlma-catalog');
      if (!target) return;
      target.innerHTML = catalogBrowserHtml(state, filters);
      var search = target.querySelector('#mlma-search');
      if (search) {
        search.addEventListener('input', function () {
          filters.query = search.value;
          paint();
          var next = target.querySelector('#mlma-search');
          if (next) {
            next.focus();
            try {
              next.setSelectionRange(next.value.length, next.value.length);
            } catch (err) {
              /* ignore */
            }
          }
        });
      }
      var format = target.querySelector('#mlma-format');
      if (format) {
        format.addEventListener('change', function () {
          filters.format = format.value || null;
          paint();
        });
      }
      target.querySelectorAll('[data-mlma-section]').forEach(function (el) {
        el.addEventListener('click', function () {
          filters.sectionId = D.normalizeSectionId(el.getAttribute('data-mlma-section') || '');
          paint();
        });
      });
      target.querySelectorAll('[data-mlma-avail]').forEach(function (el) {
        el.addEventListener('click', function () {
          filters.availability = el.getAttribute('data-mlma-avail') || 'all';
          paint();
        });
      });
      target.querySelectorAll('[data-mlma-view]').forEach(function (el) {
        el.addEventListener('click', function () {
          filters.view = el.getAttribute('data-mlma-view') || 'list';
          paint();
        });
      });
      target.querySelectorAll('[data-mlma-reset]').forEach(function (el) {
        el.addEventListener('click', function () {
          filters = { query: '', sectionId: null, format: null, availability: 'all', view: 'list' };
          paint();
        });
      });
    }
    paint();
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
    var searchBtn = rootEl.querySelector('#mlma-search-btn');
    if (searchBtn && window.matchMedia && window.matchMedia('(min-width: 640px)').matches) {
      searchBtn.style.display = 'inline-flex';
    }
    bindLibrary(state, rootEl);
  }

  function mount(existingRoot) {
    if (typeof document === 'undefined') return;
    var rootEl = existingRoot || document.querySelector('.mlma[data-mlma-page]');
    if (!rootEl) return;
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
      index: D.indexById(catalog.tracks, preview),
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
  }

  D.mount = mount;
  D.readCatalog = readCatalog;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { mount(); });
    else mount();
  }
})(typeof window !== 'undefined' ? window : globalThis);
