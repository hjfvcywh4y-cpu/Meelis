/**
 * Доменная логика MLM Academy для Tilda.
 * Белый список публичных полей — единственный переход из реестра в UI.
 */
(function (root) {
  'use strict';

  var PUBLIC_FIELDS = [
    'trackId',
    'sectionId',
    'module',
    'title',
    'situation',
    'outcome',
    'format',
    'nextTrackIds',
    'publicationStatus',
    'contentStatus',
    'visibility',
    'access',
    'seoStatus',
    'imageUrl',
  ];

  var COMPACT_TO_PUBLIC = {
    id: 'trackId',
    s: 'sectionId',
    m: 'module',
    t: 'title',
    sit: 'situation',
    out: 'outcome',
    f: 'format',
    n: 'nextTrackIds',
    ps: 'publicationStatus',
    cs: 'contentStatus',
    v: 'visibility',
    a: 'access',
    seo: 'seoStatus',
  };

  var SECTION_IDS = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'];
  var TRACK_ID_RE = /^A[1-6]-\d{3}$/;
  var ACCENT_INK = { A1: '#fffdf8', A2: '#fffdf8', A3: '#fffdf8', A4: '#1c1914', A5: '#fffdf8', A6: '#fffdf8' };
  var SECTION_COLORS = {
    A1: '#C45F42',
    A2: '#3D6B4F',
    A3: '#2F4F8A',
    A4: '#C4922A',
    A5: '#6B4C8A',
    A6: '#2A7A72',
  };

  function svgCover(bg, ink, motif) {
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" role="img" aria-hidden="true">' +
      '<rect width="640" height="360" fill="' + bg + '"/>' +
      '<rect x="28" y="28" width="584" height="304" fill="none" stroke="' + ink + '" stroke-width="3"/>' +
      motif +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  var SECTION_COVERS = {
    A1: svgCover(
      '#E8D5C8',
      '#C45F42',
      '<path d="M150 250 L320 110 L490 250" fill="none" stroke="#C45F42" stroke-width="14" stroke-linejoin="round"/>' +
        '<circle cx="320" cy="110" r="16" fill="#1c1914"/>',
    ),
    A2: svgCover(
      '#D7E4DA',
      '#3D6B4F',
      '<circle cx="230" cy="180" r="54" fill="none" stroke="#3D6B4F" stroke-width="10"/>' +
        '<circle cx="320" cy="150" r="54" fill="none" stroke="#1c1914" stroke-width="10"/>' +
        '<circle cx="410" cy="180" r="54" fill="none" stroke="#3D6B4F" stroke-width="10"/>',
    ),
    A3: svgCover(
      '#D5DDEA',
      '#2F4F8A',
      '<rect x="170" y="110" width="300" height="160" rx="28" fill="#fffdf8" stroke="#2F4F8A" stroke-width="8"/>' +
        '<path d="M220 170 H420 M220 210 H360" stroke="#2F4F8A" stroke-width="10" stroke-linecap="round"/>',
    ),
    A4: svgCover(
      '#F0E4C4',
      '#C4922A',
      '<rect x="180" y="100" width="180" height="200" rx="8" fill="#fffdf8" stroke="#C4922A" stroke-width="8"/>' +
        '<rect x="280" y="80" width="180" height="200" rx="8" fill="#fffdf8" stroke="#1c1914" stroke-width="8"/>',
    ),
    A5: svgCover(
      '#E3D8EC',
      '#6B4C8A',
      '<rect x="250" y="90" width="44" height="180" rx="6" fill="#6B4C8A"/>' +
        '<rect x="346" y="90" width="44" height="180" rx="6" fill="#1c1914"/>',
    ),
    A6: svgCover(
      '#D4E8E5',
      '#2A7A72',
      '<path d="M210 180 a110 110 0 1 0 110 -110" fill="none" stroke="#2A7A72" stroke-width="14" stroke-linecap="round"/>' +
        '<path d="M300 54 l36 46 -54 6" fill="#1c1914"/>',
    ),
  };

  function sectionCoverUrl(sectionId) {
    return SECTION_COVERS[sectionId] || SECTION_COVERS.A1;
  }

  var PROFILE_KEY = 'mlma.profile.v1';
  var PROGRESS_KEY = 'mlma.progress.v1';
  var MAX_ALTERNATIVES = 3;
  var GOAL_MAX = 240;

  var EMPTY_PROFILE = {
    selectedSectionId: null,
    currentGoal: '',
    savedTrackIds: [],
    role: 'member',
    displayName: '',
    partnerRole: '',
    experience: '',
    currentTask: '',
    difficulty: '',
    desiredResult: '',
    availableTime: '',
    consentAt: '',
    onboardingComplete: false,
    onboardingSkipped: false,
    notifyEmail: true,
    updatedAt: '',
  };

  function normalizeAccess(value) {
    if (value === 'public' || value === 'free') return 'public';
    if (value === 'promo') return 'promo';
    return 'paid';
  }

  function hasExecutableContent(track) {
    if (!track) return false;
    var cs = String(track.contentStatus || '');
    return cs === 'published' || cs === 'complete';
  }

  function getTrackModule(trackId) {
    var id = String(trackId || '').toUpperCase();
    var modules = root.MLMA_TRACK_MODULES || {};
    return modules[id] || null;
  }

  function assetsVersionDir() {
    try {
      if (typeof document === 'undefined') return '';
      var scripts = document.getElementsByTagName('script');
      for (var i = 0; i < scripts.length; i += 1) {
        var src = String(scripts[i].src || '');
        var match = src.match(/^(.*\/v1)\/(?:domain|ui|catalog-data)\.js(?:\?|$)/i);
        if (match) return match[1];
      }
    } catch (err) {
      /* ignore */
    }
    return '';
  }

  function trackModuleUrl(trackId) {
    var dir = assetsVersionDir();
    if (!dir) return '';
    var bust = '';
    try {
      bust = (root.MLMA_PAYLOAD && root.MLMA_PAYLOAD.version) || '';
    } catch (err) {
      bust = '';
    }
    var file = String(trackId || '').toLowerCase() + '.module.js';
    return dir + '/tracks/' + file + (bust ? '?v=' + encodeURIComponent(bust) : '');
  }

  var moduleLoadWaiters = {};

  function loadTrackModule(trackId, onDone) {
    var id = String(trackId || '').toUpperCase();
    var existing = getTrackModule(id);
    if (existing) {
      if (typeof onDone === 'function') onDone(existing);
      return existing;
    }
    if (!id || typeof document === 'undefined') {
      if (typeof onDone === 'function') onDone(null);
      return null;
    }
    var url = trackModuleUrl(id);
    if (!url) {
      if (typeof onDone === 'function') onDone(null);
      return null;
    }
    if (moduleLoadWaiters[id]) {
      if (typeof onDone === 'function') moduleLoadWaiters[id].push(onDone);
      return null;
    }
    moduleLoadWaiters[id] = typeof onDone === 'function' ? [onDone] : [];
    var script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = function () {
      var mod = getTrackModule(id);
      var waiters = moduleLoadWaiters[id] || [];
      delete moduleLoadWaiters[id];
      for (var i = 0; i < waiters.length; i += 1) waiters[i](mod);
    };
    script.onerror = function () {
      var waiters = moduleLoadWaiters[id] || [];
      delete moduleLoadWaiters[id];
      for (var i = 0; i < waiters.length; i += 1) waiters[i](null);
    };
    (document.head || document.documentElement).appendChild(script);
    return null;
  }

  function deriveSeoStatus(track) {
    if (!track) return 'noindex';
    if (track.seoStatus === 'index' || track.seoStatus === 'noindex') return track.seoStatus;
    var pub = track.publicationStatus;
    if (pub === 'promo' || pub === 'published') {
      if (track.forWhom && track.composition && (track.seoTitle || track.title) && track.situation && track.outcome) {
        return 'index';
      }
    }
    return 'noindex';
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function toPublicTrack(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var src = raw;
    if (raw.id && !raw.trackId) {
      src = expandCompact(raw);
    }
    var next = [];
    var ids = Array.isArray(src.nextTrackIds) ? src.nextTrackIds : [];
    for (var i = 0; i < ids.length; i += 1) {
      if (typeof ids[i] === 'string') next.push(ids[i]);
    }
    var track = {
      trackId: typeof src.trackId === 'string' ? src.trackId : '',
      sectionId: typeof src.sectionId === 'string' ? src.sectionId : '',
      module: typeof src.module === 'string' ? src.module : '',
      title: typeof src.title === 'string' ? src.title : '',
      situation: typeof src.situation === 'string' ? src.situation : '',
      outcome: typeof src.outcome === 'string' ? src.outcome : '',
      format: typeof src.format === 'string' ? src.format : '',
      nextTrackIds: next,
      publicationStatus: typeof src.publicationStatus === 'string' ? src.publicationStatus : 'unknown',
      contentStatus: typeof src.contentStatus === 'string' ? src.contentStatus : 'metadata_only',
      visibility: typeof src.visibility === 'string' ? src.visibility : 'catalog',
      access: normalizeAccess(src.access),
      seoStatus: deriveSeoStatus(src),
      imageUrl: sectionCoverUrl(typeof src.sectionId === 'string' ? src.sectionId : ''),
    };
    if (!TRACK_ID_RE.test(track.trackId)) return null;
    if (SECTION_IDS.indexOf(track.sectionId) === -1) return null;
    track.imageUrl = sectionCoverUrl(track.sectionId);
    return track;
  }

  function expandCompact(row) {
    var out = {};
    var keys = Object.keys(COMPACT_TO_PUBLIC);
    for (var i = 0; i < keys.length; i += 1) {
      var compact = keys[i];
      if (Object.prototype.hasOwnProperty.call(row, compact)) {
        out[COMPACT_TO_PUBLIC[compact]] = row[compact];
      }
    }
    return out;
  }

  function compactTrack(track) {
    var publicTrack = toPublicTrack(track);
    if (!publicTrack) return null;
    return {
      id: publicTrack.trackId,
      s: publicTrack.sectionId,
      m: publicTrack.module,
      t: publicTrack.title,
      sit: publicTrack.situation,
      out: publicTrack.outcome,
      f: publicTrack.format,
      n: publicTrack.nextTrackIds.slice(),
      ps: publicTrack.publicationStatus,
      cs: publicTrack.contentStatus,
      v: publicTrack.visibility,
      a: publicTrack.access,
      seo: publicTrack.seoStatus,
    };
  }

  function toPublicList(tracks) {
    var out = [];
    if (!Array.isArray(tracks)) return out;
    for (var i = 0; i < tracks.length; i += 1) {
      var item = toPublicTrack(tracks[i]);
      if (item) out.push(item);
    }
    return out;
  }

  function normalizeSearchText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }

  function buildSearchIndexEntry(track) {
    return normalizeSearchText(
      [track.trackId, track.title, track.situation, track.outcome, track.module, track.format].join(' '),
    );
  }

  function matchesQuery(track, query) {
    query = query || {};
    if (query.sectionId && track.sectionId !== query.sectionId) return false;
    if (query.format && track.format !== query.format) return false;
    if (query.availability === 'available' && track.publicationStatus !== 'published') return false;
    if (query.availability === 'preparing' && track.publicationStatus === 'published') return false;
    var needle = normalizeSearchText(query.query || '');
    if (!needle) return true;
    var haystack = buildSearchIndexEntry(track);
    var words = needle.split(' ');
    for (var i = 0; i < words.length; i += 1) {
      if (haystack.indexOf(words[i]) === -1) return false;
    }
    return true;
  }

  function filterTracks(tracks, query) {
    var out = [];
    for (var i = 0; i < tracks.length; i += 1) {
      if (matchesQuery(tracks[i], query)) out.push(tracks[i]);
    }
    return out;
  }

  function getTrackAvailability(track, options) {
    options = options || {};
    var entitled = options.entitled !== false;
    if (track.publicationStatus === 'archived' || track.contentStatus === 'archived') return 'archived';
    if (track.publicationStatus !== 'published') return 'preparing';
    if (!entitled) return 'locked';
    return hasExecutableContent(track) ? 'available' : 'published_empty';
  }

  function getTrackStatusView(track, options) {
    var availability = getTrackAvailability(track, options);
    var kind = api.itemKind ? api.itemKind(track) : 'track';
    if (availability === 'archived') {
      return {
        availability: availability,
        contentStatus: 'archived',
        itemKind: kind,
        label: 'Снят с публикации',
        cta: 'Открыть описание',
        tone: 'muted',
        canStart: false,
        showProgress: false,
        explanation: 'Трек снят с публикации. История прохождений сохраняется.',
      };
    }
    if (availability === 'locked') {
      return {
        availability: availability,
        contentStatus: 'locked',
        itemKind: kind,
        label: 'Нужен доступ',
        cta: 'Как получить доступ',
        tone: 'muted',
        canStart: false,
        showProgress: false,
        explanation: 'Трек существует, но для него нужен доступ.',
      };
    }
    if (kind === 'material') {
      return {
        availability: availability,
        contentStatus: 'material',
        itemKind: 'material',
        label: 'Материал',
        cta: 'Открыть материал',
        tone: 'waiting',
        canStart: false,
        showProgress: false,
        explanation: 'Это материал: информация без обязательного рабочего следа.',
      };
    }
    if (kind === 'track' && track.situation && track.outcome && track.title) {
      var ready = availability === 'available';
      return {
        availability: ready ? 'available' : 'shell',
        contentStatus: ready ? 'available' : 'shell',
        itemKind: 'track',
        label: ready ? 'Доступен' : '',
        pageStatus: ready ? '' : 'Контур прохождения',
        cta: ready ? 'Начать трек' : 'Открыть описание',
        tone: ready ? 'positive' : 'waiting',
        canStart: ready,
        showProgress: ready,
        showCatalogBadge: ready,
        explanation: ready
          ? 'Трек — исполняемый маршрут: исходное состояние, действие, рабочий след и следующее лучшее действие.'
          : 'Описание уже можно открыть. Кнопки «Начать» нет, пока содержание трека не наполнено. Просмотр страницы не завершает трек.',
      };
    }
    if (availability === 'published_empty') {
      return {
        availability: availability,
        contentStatus: 'in-progress',
        itemKind: kind,
        label: 'Готовим',
        cta: kind === 'material' ? 'Открыть материал' : 'Открыть описание',
        tone: 'waiting',
        canStart: false,
        showProgress: false,
        explanation: 'Описание уже можно открыть. Шаги и практика появятся здесь, как только материал будет готов.',
      };
    }
    return {
      availability: 'preparing',
      contentStatus: 'coming-soon',
      label: '',
      pageStatus: 'Материал готовится',
      cta: 'Открыть описание',
      tone: 'waiting',
      canStart: false,
      showProgress: false,
      showCatalogBadge: false,
      explanation: 'Описание уже можно открыть. Шаги, действие и фиксация результата появятся здесь, как только материал будет готов.',
    };
  }

  function resolveNextAction(input) {
    var profile = input.profile;
    var tracks = input.tracks;
    var byId = {};
    for (var i = 0; i < tracks.length; i += 1) byId[tracks[i].trackId] = tracks[i];
    var saved = [];
    for (var s = 0; s < profile.savedTrackIds.length; s += 1) {
      if (byId[profile.savedTrackIds[s]]) saved.push(byId[profile.savedTrackIds[s]]);
    }
    var sectionTracks = [];
    if (profile.selectedSectionId) {
      for (var t = 0; t < tracks.length; t += 1) {
        if (tracks[t].sectionId === profile.selectedSectionId) sectionTracks.push(tracks[t]);
      }
    }
    for (var a = 0; a < sectionTracks.length; a += 1) {
      if (sectionTracks[a].publicationStatus === 'published') {
        return { kind: 'open_track', track: sectionTracks[a], reason: 'section' };
      }
    }
    for (var b = 0; b < saved.length; b += 1) {
      if (saved[b].publicationStatus === 'published') {
        return { kind: 'open_track', track: saved[b], reason: 'saved' };
      }
    }
    if (profile.selectedSectionId) {
      return { kind: 'section_preparing', sectionId: profile.selectedSectionId };
    }
    if (saved[0]) return { kind: 'saved_preparing', track: saved[0] };
    return { kind: 'choose_situation' };
  }

  function resolveAlternatives(decision, input) {
    var profile = input.profile;
    var tracks = input.tracks;
    var primaryId =
      decision.kind === 'open_track' || decision.kind === 'saved_preparing'
        ? decision.track.trackId
        : null;
    var byId = {};
    for (var i = 0; i < tracks.length; i += 1) byId[tracks[i].trackId] = tracks[i];
    var saved = [];
    for (var s = 0; s < profile.savedTrackIds.length; s += 1) {
      var item = byId[profile.savedTrackIds[s]];
      if (item && item.trackId !== primaryId) saved.push(item);
    }
    if (saved.length >= MAX_ALTERNATIVES) return saved.slice(0, MAX_ALTERNATIVES);
    var rest = [];
    if (profile.selectedSectionId) {
      for (var t = 0; t < tracks.length; t += 1) {
        var track = tracks[t];
        if (track.sectionId !== profile.selectedSectionId) continue;
        if (track.trackId === primaryId) continue;
        var already = false;
        for (var k = 0; k < saved.length; k += 1) {
          if (saved[k].trackId === track.trackId) already = true;
        }
        if (!already) rest.push(track);
      }
    }
    return saved.concat(rest).slice(0, MAX_ALTERNATIVES);
  }

  var OUTCOME_SECTION_PREFERENCE = {
    done: [],
    question: ['A4', 'A5'],
    pause: ['A5', 'A6'],
    refusal: ['A5', 'A2'],
    not_done: [],
  };

  var RECOMMENDATION_REASON_LABELS = {
    explicit_next_edge: 'Следующий шаг по маршруту трека',
    matches_completion_outcome: 'Подходит к тому, чем закончилось действие',
    matches_profile_goal: 'Совпадает с выбранным разделом',
    same_section: 'Продолжение внутри раздела',
    smaller_step_of_current: 'Тот же трек меньшим шагом',
  };

  function compareSortKeys(a, b) {
    for (var i = 0; i < a.length; i += 1) {
      var diff = (a[i] || 0) - (b[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }

  function isTrackAvailable(track, isEntitled) {
    var entitled = isEntitled ? isEntitled(track) : true;
    return getTrackAvailability(track, { entitled: entitled }) === 'available';
  }

  function recommendNextTracks(input) {
    var current = input.current;
    var visibleTracks = input.visibleTracks;
    var outcome = input.outcome || 'done';
    var profile = input.profile || null;
    var isEntitled = input.isEntitled;
    if (outcome === 'not_done') {
      return {
        primary: {
          track: current,
          reason: 'smaller_step_of_current',
          available: isTrackAvailable(current, isEntitled),
        },
        alternatives: [],
        needsFallback: false,
      };
    }
    var preferred = OUTCOME_SECTION_PREFERENCE[outcome] || [];
    var candidates = [];
    for (var e = 0; e < current.nextTrackIds.length; e += 1) {
      var id = current.nextTrackIds[e];
      var track = typeof visibleTracks.get === 'function' ? visibleTracks.get(id) : visibleTracks[id];
      if (!track) continue;
      var available = isTrackAvailable(track, isEntitled);
      var outcomeRank = preferred.indexOf(track.sectionId);
      var matchesGoal = !!(profile && profile.selectedSectionId && profile.selectedSectionId === track.sectionId);
      var reason = 'explicit_next_edge';
      if (outcomeRank >= 0) reason = 'matches_completion_outcome';
      else if (matchesGoal) reason = 'matches_profile_goal';
      else if (track.sectionId === current.sectionId) reason = 'same_section';
      candidates.push({
        recommendation: { track: track, reason: reason, available: available },
        sort: [
          available ? 0 : 1,
          outcomeRank >= 0 ? outcomeRank : preferred.length,
          matchesGoal ? 0 : 1,
          track.sectionId === current.sectionId ? 0 : 1,
          e,
        ],
      });
    }
    candidates.sort(function (a, b) {
      return compareSortKeys(a.sort, b.sort);
    });
    var recs = [];
    for (var c = 0; c < candidates.length; c += 1) recs.push(candidates[c].recommendation);
    var primary = recs[0] || null;
    return {
      primary: primary,
      alternatives: recs.slice(1, 4),
      needsFallback: !primary || !primary.available,
    };
  }

  function normalizeTrackId(raw) {
    var candidate = String(raw || '').trim().toUpperCase();
    try {
      candidate = decodeURIComponent(candidate).trim().toUpperCase();
    } catch (err) {
      /* ignore */
    }
    return TRACK_ID_RE.test(candidate) ? candidate : null;
  }

  function normalizeSectionId(raw) {
    var candidate = String(raw || '').trim().toUpperCase();
    return SECTION_IDS.indexOf(candidate) === -1 ? null : candidate;
  }

  function parseTrackLocation(pathname, search) {
    var query = String(search || '');
    if (query.charAt(0) === '?') query = query.slice(1);
    var parts = query.split('&');
    for (var i = 0; i < parts.length; i += 1) {
      var pair = parts[i].split('=');
      if (decodeURIComponent(pair[0] || '') === 'id') {
        return normalizeTrackId(decodeURIComponent(pair[1] || ''));
      }
    }
    var path = String(pathname || '');
    var marker = '/track/';
    var idx = path.indexOf(marker);
    if (idx >= 0) {
      var slug = path.slice(idx + marker.length).split('/')[0].split('?')[0];
      return normalizeTrackId(slug);
    }
    return null;
  }

  function routes(config) {
    config = config || {};
    var dedicated = config.dedicatedTrackPages || [];
    var dedicatedSet = {};
    for (var i = 0; i < dedicated.length; i += 1) dedicatedSet[String(dedicated[i]).toLowerCase()] = true;
    return {
      home: function () {
        return '/academy';
      },
      start: function () {
        return '/start';
      },
      library: function () {
        return '/library';
      },
      about: function () {
        return '/about';
      },
      research: function () {
        return '/research/marketing-plan';
      },
      section: function (sectionId) {
        return '/library/' + String(sectionId).toLowerCase();
      },
      track: function (trackId) {
        var slug = String(trackId).toLowerCase();
        if (dedicatedSet[slug]) return '/track/' + slug;
        return '/track?id=' + encodeURIComponent(slug);
      },
      my: function () {
        return '/my';
      },
      myRoute: function () {
        return '/my/route';
      },
      myResults: function () {
        return '/my/results';
      },
      myTracks: function () {
        return '/my/route?tab=tracks';
      },
      mySaved: function () {
        return '/my/route?tab=saved';
      },
      profile: function () {
        return '/profile';
      },
      access: function () {
        return '/access';
      },
      purchases: function () {
        return '/my/purchases';
      },
      pricing: function () {
        return '/pricing';
      },
      privacy: function () {
        return '/privacy';
      },
      consent: function () {
        return '/consent';
      },
      offer: function () {
        return '/offer';
      },
      requisites: function () {
        return '/requisites';
      },
      paymentAndAccess: function () {
        return '/payment-and-access';
      },
      documents: function () {
        return '/documents';
      },
      cookies: function () {
        return '/cookies';
      },
      marketingConsent: function () {
        return '/marketing-consent';
      },
      previewCommerce: function () {
        return '/preview/commerce';
      },
      login: function (returnPath) {
        return membersLoginUrl(returnPath || '/my');
      },
      signup: function (returnPath) {
        if (api.isSignupEnabled && api.isSignupEnabled() !== true) {
          return membersLoginUrl(returnPath || '/my');
        }
        var path = String(returnPath || '/my').replace(/^\//, '');
        return '/members/signup?redirecturl=' + encodeURIComponent(path);
      },
      logout: function () {
        return '/members/login?exit=y';
      },
      previewCatalog: function () {
        return '/preview/catalog';
      },
    };
  }

  function isListed(track, preview) {
    if (!track) return false;
    if (track.visibility === 'hidden') return false;
    if (track.publicationStatus === 'archived') return !!preview;
    if (track.publicationStatus === 'unpublished') return !!preview;
    return track.visibility === 'catalog' || !!preview;
  }

  function isReachable(track, preview) {
    if (!track) return false;
    if (track.visibility === 'hidden') return false;
    if (track.publicationStatus === 'archived') return !!preview;
    return true;
  }

  function listVisible(tracks, preview) {
    var out = [];
    for (var i = 0; i < tracks.length; i += 1) {
      if (isListed(tracks[i], preview)) out.push(tracks[i]);
    }
    return out;
  }

  function getById(tracks, trackId, preview) {
    for (var i = 0; i < tracks.length; i += 1) {
      if (tracks[i].trackId === trackId) {
        return isReachable(tracks[i], preview) ? tracks[i] : null;
      }
    }
    return null;
  }

  function indexById(tracks, preview) {
    var map = {};
    for (var i = 0; i < tracks.length; i += 1) {
      if (!isReachable(tracks[i], preview)) continue;
      map[tracks[i].trackId] = tracks[i];
    }
    return map;
  }

  function sectionStats(tracks, sectionId) {
    var total = 0;
    var published = 0;
    var modules = [];
    var seen = {};
    for (var i = 0; i < tracks.length; i += 1) {
      if (tracks[i].sectionId !== sectionId) continue;
      total += 1;
      if (tracks[i].publicationStatus === 'published') published += 1;
      if (!seen[tracks[i].module]) {
        seen[tracks[i].module] = true;
        modules.push(tracks[i].module);
      }
    }
    return { sectionId: sectionId, total: total, published: published, preparing: total - published, modules: modules };
  }

  function pluralTracks(count) {
    var mod10 = count % 10;
    var mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'трек';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'трека';
    return 'треков';
  }

  function accentStyle(sectionId) {
    return {
      '--mlma-accent': SECTION_COLORS[sectionId] || '#8b5342',
      '--mlma-accent-ink': ACCENT_INK[sectionId] || '#f4f0e8',
    };
  }

  function styleAttr(sectionId) {
    var s = accentStyle(sectionId);
    return '--mlma-accent:' + s['--mlma-accent'] + ';--mlma-accent-ink:' + s['--mlma-accent-ink'];
  }

  function hasStorage() {
    try {
      return typeof window !== 'undefined' && window.localStorage != null;
    } catch (err) {
      return false;
    }
  }

  function readJson(key, fallback) {
    if (!hasStorage()) return fallback;
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    if (!hasStorage()) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      /* private mode */
    }
  }

  function sanitizeProfile(raw) {
    if (!raw) return clone(EMPTY_PROFILE);
    var selected = raw.selectedSectionId;
    var saved = [];
    if (Array.isArray(raw.savedTrackIds)) {
      var seen = {};
      for (var i = 0; i < raw.savedTrackIds.length; i += 1) {
        var id = raw.savedTrackIds[i];
        if (typeof id === 'string' && !seen[id]) {
          seen[id] = true;
          saved.push(id);
        }
      }
    }
    return {
      selectedSectionId: selected && SECTION_IDS.indexOf(selected) !== -1 ? selected : null,
      currentGoal: typeof raw.currentGoal === 'string' ? raw.currentGoal.slice(0, GOAL_MAX) : '',
      savedTrackIds: saved,
      role: raw.role || 'member',
      displayName: typeof raw.displayName === 'string' ? raw.displayName.slice(0, 80) : '',
      partnerRole: raw.partnerRole === 'novice' || raw.partnerRole === 'partner' || raw.partnerRole === 'leader' ? raw.partnerRole : '',
      experience: typeof raw.experience === 'string' ? raw.experience.slice(0, 40) : '',
      currentTask: typeof raw.currentTask === 'string' ? raw.currentTask.slice(0, GOAL_MAX) : '',
      difficulty: typeof raw.difficulty === 'string' ? raw.difficulty.slice(0, GOAL_MAX) : '',
      desiredResult: typeof raw.desiredResult === 'string' ? raw.desiredResult.slice(0, GOAL_MAX) : '',
      availableTime: typeof raw.availableTime === 'string' ? raw.availableTime.slice(0, 20) : '',
      consentAt: typeof raw.consentAt === 'string' ? raw.consentAt : '',
      onboardingComplete: !!raw.onboardingComplete,
      onboardingSkipped: !!raw.onboardingSkipped,
      notifyEmail: raw.notifyEmail !== false,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
    };
  }

  function getProfile() {
    return sanitizeProfile(readJson(PROFILE_KEY, null));
  }

  function saveProfile(patch) {
    var next = sanitizeProfile(Object.assign({}, getProfile(), patch, { updatedAt: new Date().toISOString() }));
    writeJson(PROFILE_KEY, next);
    return next;
  }

  function toggleSavedTrack(trackId) {
    var current = getProfile();
    var saved = current.savedTrackIds.slice();
    var idx = saved.indexOf(trackId);
    if (idx === -1) saved.push(trackId);
    else saved.splice(idx, 1);
    return saveProfile({ savedTrackIds: saved });
  }

  function resetProfile() {
    if (hasStorage()) {
      window.localStorage.removeItem(PROFILE_KEY);
      window.localStorage.removeItem(PROGRESS_KEY);
    }
    return clone(EMPTY_PROFILE);
  }

  function isPreviewHost(hostname) {
    hostname = hostname || '';
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    if (/\.tilda\.ws$/i.test(hostname)) return true;
    if (/(^|\.)tilda\.cc$/i.test(hostname)) return true;
    return false;
  }

  var api = {
    PUBLIC_FIELDS: PUBLIC_FIELDS,
    SECTION_IDS: SECTION_IDS,
    TRACK_ID_RE: TRACK_ID_RE,
    MAX_ALTERNATIVES: MAX_ALTERNATIVES,
    GOAL_MAX: GOAL_MAX,
    EMPTY_PROFILE: EMPTY_PROFILE,
    PROFILE_KEY: PROFILE_KEY,
    RECOMMENDATION_REASON_LABELS: RECOMMENDATION_REASON_LABELS,
    SECTION_COLORS: SECTION_COLORS,
    SECTION_COVERS: SECTION_COVERS,
    sectionCoverUrl: sectionCoverUrl,
    toPublicTrack: toPublicTrack,
    toPublicList: toPublicList,
    compactTrack: compactTrack,
    expandCompact: expandCompact,
    normalizeSearchText: normalizeSearchText,
    filterTracks: filterTracks,
    matchesQuery: matchesQuery,
    getTrackAvailability: getTrackAvailability,
    getTrackStatusView: getTrackStatusView,
    resolveNextAction: resolveNextAction,
    resolveAlternatives: resolveAlternatives,
    recommendNextTracks: recommendNextTracks,
    normalizeTrackId: normalizeTrackId,
    normalizeSectionId: normalizeSectionId,
    routes: routes,
    trackUrl: function (trackId) {
      return routes().track(trackId);
    },
    parseTrackLocation: parseTrackLocation,
    isListed: isListed,
    isReachable: isReachable,
    listVisible: listVisible,
    getById: getById,
    indexById: indexById,
    sectionStats: sectionStats,
    pluralTracks: pluralTracks,
    accentStyle: accentStyle,
    styleAttr: styleAttr,
    getProfile: getProfile,
    saveProfile: saveProfile,
    toggleSavedTrack: toggleSavedTrack,
    resetProfile: resetProfile,
    sanitizeProfile: sanitizeProfile,
    isPreviewHost: isPreviewHost,
    clone: clone,
    normalizeAccess: normalizeAccess,
    hasExecutableContent: hasExecutableContent,
    getTrackModule: getTrackModule,
    trackModuleUrl: trackModuleUrl,
    loadTrackModule: loadTrackModule,
    deriveSeoStatus: deriveSeoStatus,
    membersLoginUrl: membersLoginUrl,
    membersRecoverUrl: membersRecoverUrl,
    siteHomeUrl: siteHomeUrl,
    b2bFromResearchUrl: b2bFromResearchUrl,
    academyFromResearchUrl: academyFromResearchUrl,
    funnelEvent: funnelEvent,
  };

  function membersLoginUrl(returnPath) {
    var path = String(returnPath || '/my').replace(/^\//, '');
    return '/members/login?redirecturl=' + encodeURIComponent(path);
  }

  function membersRecoverUrl(returnPath) {
    var path = String(returnPath || '/profile').replace(/^\//, '');
    return '/members/login?mlma=recover&redirecturl=' + encodeURIComponent(path);
  }

  function siteHomeUrl() {
    return '/';
  }

  function b2bFromResearchUrl() {
    return '/?utm_source=mlm_academy&utm_medium=research&utm_campaign=marketing_plan';
  }

  function academyFromResearchUrl() {
    return '/academy?utm_source=research&utm_medium=article&utm_campaign=marketing_plan';
  }

  function funnelEvent(name, extra) {
    extra = extra || {};
    var payload = {
      source_page: extra.source_page || '',
      target_page: extra.target_page || '',
      cta_position: extra.cta_position || '',
      article_slug: extra.article_slug || 'marketing-plan',
      timestamp: extra.timestamp || new Date().toISOString(),
    };
    if (typeof api.trackEvent === 'function') return api.trackEvent(name, payload);
    try {
      if (typeof window !== 'undefined') {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push(Object.assign({ event: name }, payload));
      }
    } catch (err) {
      /* ignore */
    }
    return payload;
  }

  root.MLMA = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
