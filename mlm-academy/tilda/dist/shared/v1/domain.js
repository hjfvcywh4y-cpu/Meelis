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
    return track.contentStatus === 'published' ? 'available' : 'published_empty';
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
      login: function (returnPath) {
        return membersLoginUrl(returnPath || '/my');
      },
      signup: function (returnPath) {
        var path = String(returnPath || '/my').replace(/^\//, '');
        return '/members/signup?redirecturl=' + encodeURIComponent(path);
      },
      logout: function () {
        return '/members/logout';
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
    deriveSeoStatus: deriveSeoStatus,
    membersLoginUrl: membersLoginUrl,
    siteHomeUrl: siteHomeUrl,
    b2bFromResearchUrl: b2bFromResearchUrl,
    academyFromResearchUrl: academyFromResearchUrl,
    funnelEvent: funnelEvent,
  };

  function membersLoginUrl(returnPath) {
    var path = String(returnPath || '/my').replace(/^\//, '');
    return '/members/login?redirecturl=' + encodeURIComponent(path);
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

/* __MLMA_UI_SPLIT__ */

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
  var PRODUCTS = [
    { id: 'start', group: 'START', title: 'Стартовый пакет', kind: 'pack', priceLabel: 'Тестовый режим', summary: 'Маршрут первых действий и доступ к стартовым трекам, когда они будут наполнены.' },
    { id: 'full', group: 'FULL', title: 'Полная библиотека', kind: 'pack', priceLabel: 'Тестовый режим', summary: 'Доступ ко всей библиотеке в рамках оплаченного периода.' },
  ];

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
    return '/members/logout';
  }

  function membersSignupUrl(returnPath) {
    var path = String(returnPath || '/my').replace(/^\//, '');
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
    var view = api.getTrackStatusView(track, { entitled: isEntitledToTrack(track, account) });
    return !!view.canStart && isEntitledToTrack(track, account);
  }

  function cardAction(track, account, runtime) {
    var state = resolveUserState(account);
    var entitled = isEntitledToTrack(track, account);
    var view = api.getTrackStatusView(track, { entitled: entitled });
    var access = normalizeAccess(track.access);
    if (state === 'expired' && access === 'paid') {
      return { key: 'renew', label: 'Продлить доступ', href: '/access' };
    }
    if (!account || !account.loggedIn) {
      return {
        key: 'login_save',
        label: view.canStart ? 'Войти, чтобы сохранить' : 'Открыть описание',
        href: view.canStart ? api.membersLoginUrl('/track?id=' + String(track.trackId).toLowerCase()) : api.routes().track(track.trackId),
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
    if (!entitled && access === 'paid') {
      var ready = api.getTrackStatusView(track, { entitled: true }).canStart;
      if (ready) {
        return { key: 'buy', label: 'Купить доступ', href: '/access?product=start&track=' + encodeURIComponent(track.trackId) };
      }
      return { key: 'open', label: view.cta || 'Открыть описание', href: api.routes().track(track.trackId) };
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
      return { kind: 'signup', title: 'Создайте бесплатный кабинет', why: 'Так можно сохранить маршрут и вернуться к нему с другого устройства.', href: membersSignupUrl('/my'), cta: 'Зарегистрироваться' };
    }
    if (!onboardingComplete(profile)) {
      return { kind: 'onboarding', title: 'Короткая настройка — две минуты', why: 'Имя, роль и текущая задача нужны, чтобы показать первый шаг. Необязательные вопросы можно пропустить.', href: '/profile?setup=1', cta: 'Заполнить профиль' };
    }
    if (state === 'expired') {
      return { kind: 'renew', title: 'Доступ закончился', why: 'Профиль, история и результаты на месте. Чтобы снова открыть платные треки, продлите доступ.', href: '/access', cta: 'Продлить доступ' };
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
      return { kind: 'choose', title: 'Выберите ситуацию или откройте доступ', why: 'Бесплатный кабинет уже есть. Можно пройти промотрек или посмотреть пакеты.', href: '/start', cta: 'Выбрать ситуацию', secondary: { href: '/access', label: 'Смотреть доступ' } };
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

/* __MLMA_UI_SPLIT__ */

/**
 * Репозитории кабинета. localStorage — временный fallback и источник миграции.
 * Секреты сюда не класть. MLMA_API_URL — только публичный URL API.
 *
 * Идентификация: Tilda Members (mauser / tilda_members_profile / ma_id, ma_email).
 * Сервер после bind авторизует по cookie mlma_sid, не по переданному userId.
 */
(function (root) {
  'use strict';
  var api = root.MLMA;
  if (!api) return;

  var STORE_KEY = 'mlma.account.v1';
  var OUTBOX_KEY = 'mlma.outbox.v1';
  var MIGRATED_KEY = 'mlma.migrated.v1';
  var PENDING_KEY = 'mlma.pendingTrackId';
  var MODE_LOCAL = 'local_fallback';
  var MODE_SERVER = 'server';
  var MODE_RESTORING = 'restoring';
  var MODE_ERROR = 'error';
  var MODE_OFFLINE = 'offline';

  function nowIso() {
    return new Date().toISOString();
  }

  function emptyAccountRecord(session) {
    session = session || {};
    return {
      user: {
        maId: session.maId || '',
        email: session.email || '',
        name: session.name || '',
        phone: session.phone || '',
        groups: session.groups && session.groups.length ? session.groups.slice() : session.loggedIn ? ['FREE'] : [],
      },
      profile: api.getProfile ? api.getProfile() : api.sanitizeProfile(null),
      entitlements: [],
      orders: [],
      payments: [],
      savedTrackIds: [],
      route: { trackIds: [] },
      runs: {},
      artifacts: [],
      identityLevel: 'tilda_unverified',
      updatedAt: '',
    };
  }

  function readJson(key, fallback) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return fallback;
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      /* private mode */
    }
  }

  function readStore() {
    var all = readJson(STORE_KEY, {});
    return all && typeof all === 'object' ? all : {};
  }

  function writeStore(all) {
    writeJson(STORE_KEY, all);
  }

  function readOutbox() {
    var list = readJson(OUTBOX_KEY, []);
    return Array.isArray(list) ? list : [];
  }

  function writeOutbox(list) {
    writeJson(OUTBOX_KEY, (list || []).slice(-200));
  }

  function apiBase() {
    try {
      if (typeof window !== 'undefined' && window.MLMA_API_URL) return String(window.MLMA_API_URL).replace(/\/$/, '');
    } catch (err) {
      /* ignore */
    }
    return '';
  }

  function storageMode() {
    return apiBase() ? MODE_SERVER : MODE_LOCAL;
  }

  function recordKey(session) {
    return (session && (session.maId || session.email)) || 'local';
  }

  function loadRecord(session) {
    var all = readStore();
    var key = recordKey(session);
    var row = all[key] || emptyAccountRecord(session);
    if (session && session.loggedIn) {
      row.user.email = session.email || row.user.email;
      row.user.name = session.name || row.user.name;
      row.user.maId = session.maId || row.user.maId;
      row.user.phone = session.phone || row.user.phone;
      if (!row.user.groups || !row.user.groups.length) row.user.groups = ['FREE'];
    }
    if ((!row.savedTrackIds || !row.savedTrackIds.length) && row.profile && row.profile.savedTrackIds) {
      row.savedTrackIds = row.profile.savedTrackIds.slice();
    }
    row.route = row.route || { trackIds: row.savedTrackIds ? row.savedTrackIds.slice() : [] };
    return row;
  }

  function saveRecord(session, row) {
    row.updatedAt = nowIso();
    var all = readStore();
    all[recordKey(session)] = row;
    writeStore(all);
    enqueue('upsert_account', { key: recordKey(session) });
    return row;
  }

  function enqueue(type, payload) {
    var box = readOutbox();
    box.push({ id: 'ob_' + Date.now() + '_' + box.length, type: type, payload: payload || {}, createdAt: nowIso() });
    writeOutbox(box);
  }

  function catalogTrackId(trackId) {
    if (!api.normalizeTrackId) return String(trackId || '');
    return api.normalizeTrackId(trackId);
  }

  function uniqueTrackIds(ids) {
    var out = [];
    var seen = {};
    (ids || []).forEach(function (id) {
      var trackId = catalogTrackId(id);
      if (!trackId || seen[trackId]) return;
      seen[trackId] = true;
      out.push(trackId);
    });
    return out;
  }

  function applyAccountToLocal(session, account) {
    if (!account) return loadRecord(session);
    var row = loadRecord(session);
    row.user = Object.assign({}, row.user, account.user || {});
    if (account.profile) row.profile = api.sanitizeProfile(Object.assign({}, row.profile, account.profile));
    if (account.savedTrackIds) row.savedTrackIds = uniqueTrackIds(account.savedTrackIds);
    else if (account.route && account.route.trackIds) row.savedTrackIds = uniqueTrackIds(account.route.trackIds);
    row.route = { trackIds: row.savedTrackIds.slice() };
    row.identityLevel = account.identityLevel === 'verified' ? 'verified' : 'tilda_unverified';
    if (row.identityLevel === 'verified') {
      if (account.entitlements) row.entitlements = account.entitlements;
      if (account.orders) row.orders = account.orders;
      if (account.payments) row.payments = account.payments;
    } else {
      row.entitlements = [];
      row.orders = [];
      row.payments = [];
      if (row.user) row.user.groups = ['FREE'];
    }
    if (account.runs) row.runs = account.runs;
    if (account.artifacts) row.artifacts = account.artifacts;
    saveRecord(session, row);
    if (session && session.loggedIn && api.saveProfile) {
      api.saveProfile(Object.assign({}, row.profile, { savedTrackIds: row.savedTrackIds.slice() }));
    }
    return row;
  }

  function isMigrated(session) {
    var map = readJson(MIGRATED_KEY, {});
    return !!(map && map[recordKey(session)]);
  }

  function markMigrated(session) {
    var map = readJson(MIGRATED_KEY, {}) || {};
    map[recordKey(session)] = nowIso();
    writeJson(MIGRATED_KEY, map);
  }

  function sessionStore() {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) return window.sessionStorage;
      if (typeof globalThis !== 'undefined' && globalThis.sessionStorage) return globalThis.sessionStorage;
    } catch (err) {
      /* ignore */
    }
    return null;
  }

  function readPendingTrackId() {
    var store = sessionStore();
    if (!store) return '';
    try {
      return catalogTrackId(store.getItem(PENDING_KEY) || '') || '';
    } catch (err) {
      return '';
    }
  }

  function writePendingTrackId(trackId) {
    var store = sessionStore();
    if (!store) return;
    try {
      var id = catalogTrackId(trackId);
      if (id) store.setItem(PENDING_KEY, id);
      else store.removeItem(PENDING_KEY);
    } catch (err) {
      /* ignore */
    }
  }

  function clearPendingTrackId() {
    writePendingTrackId('');
  }

  var lastSync = { mode: MODE_LOCAL, error: '', at: '' };

  function setSync(mode, error) {
    lastSync = { mode: mode, error: error || '', at: nowIso() };
    return lastSync;
  }

  var LocalRepo = {
    mode: MODE_LOCAL,
    loadAccount: function (session) {
      return loadRecord(session);
    },
    saveProfile: function (session, profile) {
      var row = loadRecord(session);
      row.profile = profile;
      row.savedTrackIds = uniqueTrackIds((profile && profile.savedTrackIds) || row.savedTrackIds);
      row.route = { trackIds: row.savedTrackIds.slice() };
      saveRecord(session, row);
      return row;
    },
    saveSavedTracks: function (session, ids) {
      var row = loadRecord(session);
      row.savedTrackIds = uniqueTrackIds(ids);
      row.route = { trackIds: row.savedTrackIds.slice() };
      if (row.profile) row.profile.savedTrackIds = row.savedTrackIds.slice();
      saveRecord(session, row);
      return row;
    },
    saveEntitlements: function (session, list) {
      var row = loadRecord(session);
      if (!session || session.identityLevel !== 'verified') {
        row.entitlements = [];
        saveRecord(session, row);
        return row;
      }
      row.entitlements = list.slice();
      saveRecord(session, row);
      return row;
    },
    saveOrder: function (session, order) {
      var row = loadRecord(session);
      var found = false;
      for (var i = 0; i < row.orders.length; i += 1) {
        if (row.orders[i].orderId === order.orderId) {
          row.orders[i] = order;
          found = true;
        }
      }
      if (!found) row.orders.push(order);
      saveRecord(session, row);
      return row;
    },
    savePayment: function (session, payment) {
      if (!session || session.identityLevel !== 'verified') {
        return loadRecord(session);
      }
      var row = loadRecord(session);
      var found = false;
      for (var i = 0; i < row.payments.length; i += 1) {
        if (row.payments[i].paymentId === payment.paymentId || row.payments[i].idempotencyKey === payment.idempotencyKey) {
          row.payments[i] = payment;
          found = true;
        }
      }
      if (!found) row.payments.push(payment);
      saveRecord(session, row);
      return row;
    },
    saveArtifact: function (session, artifact) {
      var row = loadRecord(session);
      row.artifacts = row.artifacts || [];
      row.artifacts.unshift(artifact);
      row.artifacts = row.artifacts.slice(0, 50);
      saveRecord(session, row);
      return row;
    },
    saveRun: function (session, trackId, runtime) {
      var row = loadRecord(session);
      row.runs = row.runs || {};
      row.runs[trackId] = runtime;
      saveRecord(session, row);
      return row;
    },
  };

  function HttpRepo(base) {
    this.mode = MODE_SERVER;
    this.base = base;
    this.lastError = '';
  }
  HttpRepo.prototype.request = function (path, body) {
    if (typeof fetch !== 'function') return Promise.reject(new Error('no_fetch'));
    return fetch(this.base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body || {}),
    }).then((res) => {
      return res.json().catch(function () { return {}; }).then((data) => {
        if (!res.ok) {
          this.lastError = (data && data.reason) || ('api_' + res.status);
          var err = new Error(this.lastError);
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  };
  HttpRepo.prototype.bind = function (session) {
    return this.request('/session/bind', {
      maId: session.maId || '',
      email: session.email || '',
      name: session.name || '',
      phone: session.phone || '',
    });
  };
  HttpRepo.prototype.loadAccount = function (session) {
    return loadRecord(session);
  };
  HttpRepo.prototype.loadAccountRemote = function (session) {
    return this.bind(session)
      .then((bound) => {
        if (bound && bound.account) return bound;
        return this.request('/account/get', {});
      })
      .then(function (data) {
        setSync(MODE_SERVER);
        return data && data.account ? data.account : null;
      });
  };
  HttpRepo.prototype.saveProfile = function (session, profile) {
    LocalRepo.saveProfile(session, profile);
    return this.request('/account/profile', { profile: profile })
      .then(function (data) {
        if (data && data.account) applyAccountToLocal(session, data.account);
        setSync(MODE_SERVER);
        return LocalRepo.loadAccount(session);
      })
      .catch(function (err) {
        setSync(MODE_ERROR, err && err.message);
        enqueue('profile_sync_failed', {});
        return LocalRepo.loadAccount(session);
      });
  };
  HttpRepo.prototype.saveSavedTracks = function (session, ids) {
    LocalRepo.saveSavedTracks(session, ids);
    return LocalRepo.loadAccount(session);
  };
  HttpRepo.prototype.saveTrack = function (session, trackId) {
    var id = catalogTrackId(trackId);
    var local = LocalRepo.loadAccount(session);
    var ids = uniqueTrackIds((local.savedTrackIds || []).concat([id]));
    LocalRepo.saveSavedTracks(session, ids);
    return this.request('/account/route/save', { trackId: id })
      .then(function (data) {
        if (data && data.account) applyAccountToLocal(session, data.account);
        setSync(MODE_SERVER);
        return { ok: true, duplicate: !!data.duplicate, account: LocalRepo.loadAccount(session) };
      })
      .catch(function (err) {
        setSync(MODE_ERROR, err && err.message);
        enqueue('route_sync_failed', { trackId: id });
        if (api.trackEvent) api.trackEvent('sync_error', { itemId: id, source: 'route_save' });
        return { ok: false, fallback: true, account: LocalRepo.loadAccount(session) };
      });
  };
  HttpRepo.prototype.deleteTrack = function (session, trackId) {
    var id = catalogTrackId(trackId);
    var local = LocalRepo.loadAccount(session);
    var ids = (local.savedTrackIds || []).filter(function (item) { return item !== id; });
    LocalRepo.saveSavedTracks(session, ids);
    return this.request('/account/route/delete', { trackId: id })
      .then(function (data) {
        if (data && data.account) applyAccountToLocal(session, data.account);
        setSync(MODE_SERVER);
        return { ok: true, account: LocalRepo.loadAccount(session) };
      })
      .catch(function (err) {
        setSync(MODE_ERROR, err && err.message);
        enqueue('route_sync_failed', { trackId: id, op: 'delete' });
        if (api.trackEvent) api.trackEvent('sync_error', { itemId: id, source: 'route_delete' });
        return { ok: false, fallback: true, account: LocalRepo.loadAccount(session) };
      });
  };
  HttpRepo.prototype.reorderTracks = function (session, ids) {
    LocalRepo.saveSavedTracks(session, ids);
    return this.request('/account/route/reorder', { trackIds: uniqueTrackIds(ids) })
      .then(function (data) {
        if (data && data.account) applyAccountToLocal(session, data.account);
        setSync(MODE_SERVER);
        return { ok: true, account: LocalRepo.loadAccount(session) };
      })
      .catch(function (err) {
        setSync(MODE_ERROR, err && err.message);
        return { ok: false, fallback: true, account: LocalRepo.loadAccount(session) };
      });
  };
  HttpRepo.prototype.migrate = function (session, ids, profile) {
    return this.request('/account/migrate', { trackIds: uniqueTrackIds(ids), profile: profile || null })
      .then(function (data) {
        if (data && data.account) applyAccountToLocal(session, data.account);
        markMigrated(session);
        setSync(MODE_SERVER);
        return { ok: true, added: data.added || 0, account: LocalRepo.loadAccount(session) };
      })
      .catch(function (err) {
        setSync(MODE_ERROR, err && err.message);
        if (api.trackEvent) api.trackEvent('sync_error', { source: 'migrate' });
        return { ok: false, fallback: true };
      });
  };
  HttpRepo.prototype.saveEntitlements = LocalRepo.saveEntitlements;
  HttpRepo.prototype.saveOrder = LocalRepo.saveOrder;
  HttpRepo.prototype.savePayment = LocalRepo.savePayment;
  HttpRepo.prototype.saveArtifact = LocalRepo.saveArtifact;
  HttpRepo.prototype.saveRun = function (session, trackId, runtime) {
    LocalRepo.saveRun(session, trackId, runtime);
    this.request('/account/run', { trackId: trackId, runtime: { status: runtime && runtime.status, step: runtime && runtime.step } }).catch(function () {});
    return LocalRepo.loadAccount(session);
  };

  function getRepo() {
    var base = apiBase();
    return base ? new HttpRepo(base) : LocalRepo;
  }

  function toAccountView(session, row, mode) {
    var verified = row.identityLevel === 'verified';
    var profile = api.sanitizeProfile(Object.assign({}, row.profile || {}, {
      savedTrackIds: row.savedTrackIds && row.savedTrackIds.length ? row.savedTrackIds : (row.profile && row.profile.savedTrackIds) || [],
      displayName: (row.profile && row.profile.displayName) || session.name || '',
    }));
    return {
      loggedIn: !!session.loggedIn,
      identityLevel: verified ? 'verified' : 'tilda_unverified',
      maId: session.maId || row.user.maId || '',
      email: session.email || row.user.email || '',
      name: session.name || row.user.name || profile.displayName || '',
      phone: session.phone || row.user.phone || '',
      groups: verified
        ? ((row.user.groups && row.user.groups.length ? row.user.groups : session.groups) || [])
        : (session.loggedIn ? ['FREE'] : []),
      entitlements: verified ? (row.entitlements || []) : [],
      orders: verified ? (row.orders || []) : [],
      payments: verified ? (row.payments || []) : [],
      artifacts: row.artifacts || [],
      runs: row.runs || {},
      profile: profile,
      savedTrackIds: (row.savedTrackIds || []).slice(),
      storageMode: mode || lastSync.mode || storageMode(),
      syncError: lastSync.error || '',
      source: session.source,
      identityLimit: verified ? 'server_verified' : (apiBase() ? 'tilda_client_bind' : 'local_fallback'),
    };
  }

  function hydrateAccount(session) {
    session = session || (api.readMembersSession ? api.readMembersSession() : { loggedIn: false });
    var row = getRepo().loadAccount(session);
    var mode = MODE_LOCAL;
    if (session && session.loggedIn && apiBase()) {
      mode = lastSync.mode === MODE_SERVER ? MODE_SERVER : lastSync.mode || MODE_RESTORING;
    } else if (!session.loggedIn) {
      mode = MODE_LOCAL;
    }
    var view = toAccountView(session, row, mode);
    if (session.loggedIn) {
      try {
        api.saveProfile(view.profile);
      } catch (err) {
        /* ignore */
      }
    }
    return view;
  }

  function hydrateAccountFromServer(session) {
    session = session || (api.readMembersSession ? api.readMembersSession() : { loggedIn: false });
    var repo = getRepo();
    if (!apiBase()) {
      setSync(MODE_LOCAL);
      return Promise.resolve(hydrateAccount(session));
    }
    if (!session.loggedIn) {
      setSync(MODE_LOCAL);
      return Promise.resolve(hydrateAccount(session));
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setSync(MODE_OFFLINE, 'offline');
      return Promise.resolve(hydrateAccount(session));
    }
    if (!repo.loadAccountRemote) {
      setSync(MODE_LOCAL);
      return Promise.resolve(hydrateAccount(session));
    }
    setSync(MODE_RESTORING);
    var localIds = uniqueTrackIds((loadRecord(session).savedTrackIds || []).concat((api.getProfile() && api.getProfile().savedTrackIds) || []));
    return repo.loadAccountRemote(session)
      .then(function (account) {
        if (account) applyAccountToLocal(session, account);
        if (!isMigrated(session) && localIds.length && repo.migrate) {
          return repo.migrate(session, localIds, api.getProfile()).then(function () {
            return hydrateAccount(session);
          });
        }
        if (!isMigrated(session) && !localIds.length) markMigrated(session);
        return hydrateAccount(session);
      })
      .then(function (view) {
        var pending = readPendingTrackId();
        if (pending && session.loggedIn && repo.saveTrack) {
          return repo.saveTrack(session, pending).then(function () {
            clearPendingTrackId();
            if (api.trackEvent) api.trackEvent('track_saved', { itemId: pending, source: 'pending_after_login' });
            return hydrateAccount(session);
          });
        }
        return view;
      })
      .catch(function (err) {
        var offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        setSync(offline ? MODE_OFFLINE : MODE_ERROR, err && err.message);
        if (api.trackEvent) api.trackEvent('sync_error', { source: 'hydrate' });
        return hydrateAccount(session);
      });
  }

  var prevToggle = api.toggleSavedTrack;
  api.toggleSavedTrack = function (trackId) {
    var id = catalogTrackId(trackId);
    var session = api.readMembersSession ? api.readMembersSession() : { loggedIn: false };
    if (!session.loggedIn) {
      writePendingTrackId(id);
      if (prevToggle) return prevToggle(id);
      return api.getProfile();
    }
    var next = prevToggle ? prevToggle(id) : api.getProfile();
    var repo = getRepo();
    var saved = (next.savedTrackIds || []).indexOf(id) !== -1;
    if (repo.saveTrack && saved) repo.saveTrack(session, id);
    else if (repo.deleteTrack && !saved) repo.deleteTrack(session, id);
    else repo.saveSavedTracks(session, next.savedTrackIds || []);
    return next;
  };

  api.saveTrackToRoute = function (trackId) {
    var id = catalogTrackId(trackId);
    var session = api.readMembersSession ? api.readMembersSession() : { loggedIn: false };
    if (!session.loggedIn) {
      writePendingTrackId(id);
      return Promise.resolve({ ok: false, pending: true, trackId: id });
    }
    var profile = api.getProfile();
    if ((profile.savedTrackIds || []).indexOf(id) === -1 && prevToggle) profile = prevToggle(id);
    var repo = getRepo();
    if (repo.saveTrack) return repo.saveTrack(session, id);
    repo.saveSavedTracks(session, (profile && profile.savedTrackIds) || [id]);
    return Promise.resolve({ ok: false, fallback: true });
  };

  api.removeTrackFromRoute = function (trackId) {
    var id = catalogTrackId(trackId);
    var session = api.readMembersSession ? api.readMembersSession() : { loggedIn: false };
    var profile = api.getProfile();
    if ((profile.savedTrackIds || []).indexOf(id) !== -1 && prevToggle) prevToggle(id);
    var repo = getRepo();
    if (repo.deleteTrack) return repo.deleteTrack(session, id);
    repo.saveSavedTracks(session, api.getProfile().savedTrackIds || []);
    return Promise.resolve({ ok: false, fallback: true });
  };

  api.reorderRoute = function (ids) {
    var session = api.readMembersSession ? api.readMembersSession() : { loggedIn: false };
    var unique = uniqueTrackIds(ids);
    if (api.saveProfile) api.saveProfile({ savedTrackIds: unique });
    var repo = getRepo();
    if (repo.reorderTracks) return repo.reorderTracks(session, unique);
    repo.saveSavedTracks(session, unique);
    return Promise.resolve({ ok: false, fallback: true });
  };

  api.STORE_KEY = STORE_KEY;
  api.OUTBOX_KEY = OUTBOX_KEY;
  api.PENDING_KEY = PENDING_KEY;
  api.storageMode = storageMode;
  api.getRepo = getRepo;
  api.hydrateAccount = hydrateAccount;
  api.hydrateAccountFromServer = hydrateAccountFromServer;
  api.enqueueOutbox = enqueue;
  api.LocalRepo = LocalRepo;
  api.readPendingTrackId = readPendingTrackId;
  api.writePendingTrackId = writePendingTrackId;
  api.clearPendingTrackId = clearPendingTrackId;
  api.lastAccountSync = function () { return lastSync; };
  api.uniqueTrackIds = uniqueTrackIds;

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);

/* __MLMA_UI_SPLIT__ */

/**
 * Абстракция оплаты. Реальные списания выключены.
 * Секрет вебхука живёт только на сервере, не в Tilda и не в этом файле.
 */
(function (root) {
  'use strict';
  var api = root.MLMA;
  if (!api) return;

  var PAYMENT_STATUSES = ['created', 'pending', 'paid', 'failed', 'cancelled', 'refunded', 'expired'];
  var TEST_MODE = true;

  var TILDA_PAYMENT_OPTIONS = [
    { id: 'tilda', name: 'Tilda Payments / ЮKassa через Tilda', members: 'Да, встроенная выдача группы', recurrences: 'Подписка Tilda — отдельно согласовывать', note: 'Проще всего для Members. Вебхук и идемпотентность ограничены кабинетом Tilda.' },
    { id: 'yookassa', name: 'ЮKassa напрямую', members: 'Нужен свой вебхук → группа Members', recurrences: 'Рекуррент не включать без согласования', note: 'Гибкий вебхук, подпись, однократная запись платежа.' },
    { id: 'cloudpayments', name: 'CloudPayments', members: 'Свой вебхук', recurrences: 'Не включать без согласования', note: 'Карты РФ/СНГ, виджет, подпись уведомлений.' },
    { id: 'stripe', name: 'Stripe', members: 'Свой вебхук', recurrences: 'Не включать без согласования', note: 'Удобен для международной карты. Для РФ ограничен.' },
    { id: 'paypal', name: 'PayPal', members: 'Свой вебхук', recurrences: 'Не включать без согласования', note: 'Международные платежи, слабее для РФ.' },
  ];

  function newId(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function productById(id) {
    var list = api.PRODUCTS || [];
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === id) return list[i];
    }
    return list[0] || { id: 'start', group: 'START', title: 'Стартовый пакет', kind: 'pack' };
  }

  function createOrder(input) {
    input = input || {};
    var product = productById(input.productId || 'start');
    return {
      orderId: input.orderId || newId('ord'),
      productId: product.id,
      group: product.group,
      trackId: input.trackId || '',
      email: input.email || '',
      maId: input.maId || '',
      amount: 0,
      currency: 'RUB',
      status: 'created',
      test: true,
      createdAt: new Date().toISOString(),
    };
  }

  function TestGateway() {}
  TestGateway.prototype.createPayment = function (order) {
    return {
      paymentId: newId('pay'),
      orderId: order.orderId,
      status: 'pending',
      checkoutUrl: '/access?checkout=' + encodeURIComponent(order.orderId),
      test: true,
    };
  };
  TestGateway.prototype.parseWebhook = function (payload) {
    payload = payload || {};
    return {
      paymentId: payload.paymentId || payload.id || '',
      orderId: payload.orderId || '',
      status: payload.status || 'failed',
      idempotencyKey: payload.idempotencyKey || payload.paymentId || payload.id || '',
      email: payload.email || '',
      signatureValid: payload.signatureValid !== false,
    };
  };

  function findById(list, key, value) {
    for (var i = 0; i < list.length; i += 1) {
      if (list[i][key] === value) return list[i];
    }
    return null;
  }

  function applyWebhook(account, event, order) {
    account = account || { entitlements: [], payments: [], orders: [], groups: [] };
    event = event || {};
    if (!event.signatureValid) {
      return { ok: false, reason: 'invalid_signature', account: account };
    }
    if (event.status === 'paid' && (!account || account.identityLevel !== 'verified')) {
      return { ok: false, reason: 'verified_required', account: account };
    }
    var payments = (account.payments || []).slice();
    var existing = findById(payments, 'idempotencyKey', event.idempotencyKey) || findById(payments, 'paymentId', event.paymentId);
    if (existing && (existing.status === 'paid' || existing.status === event.status)) {
      return { ok: true, duplicate: true, account: account, payment: existing };
    }
    var payment = {
      paymentId: event.paymentId || newId('pay'),
      orderId: event.orderId || (order && order.orderId) || '',
      status: event.status,
      idempotencyKey: event.idempotencyKey || event.paymentId,
      email: event.email || (order && order.email) || '',
      test: true,
      updatedAt: new Date().toISOString(),
    };
    if (existing) {
      existing.status = payment.status;
      existing.updatedAt = payment.updatedAt;
      payment = existing;
    } else {
      payments.push(payment);
    }
    account.payments = payments;
    var orders = (account.orders || []).slice();
    if (order) {
      order.status = event.status === 'paid' ? 'paid' : event.status;
      var found = false;
      for (var o = 0; o < orders.length; o += 1) {
        if (orders[o].orderId === order.orderId) {
          orders[o] = order;
          found = true;
        }
      }
      if (!found) orders.push(order);
    }
    account.orders = orders;
    if (event.status === 'paid' && order) {
      var entitlements = (account.entitlements || []).slice();
      var same = null;
      for (var e = 0; e < entitlements.length; e += 1) {
        if (entitlements[e].orderId === order.orderId && entitlements[e].status === 'active') same = entitlements[e];
      }
      if (!same) {
        entitlements.push({
          id: newId('ent'),
          productId: order.productId,
          group: order.group,
          trackId: order.trackId || '',
          status: 'active',
          orderId: order.orderId,
          startsAt: new Date().toISOString(),
          expiresAt: '',
        });
        account.entitlements = entitlements;
        account.groups = account.groups || [];
        if (order.group && account.groups.indexOf(order.group) === -1) account.groups.push(order.group);
        if (account.groups.indexOf('FREE') === -1) account.groups.push('FREE');
      }
    }
    if (event.status === 'refunded' || event.status === 'expired') {
      var list = account.entitlements || [];
      for (var r = 0; r < list.length; r += 1) {
        if (order && list[r].orderId === order.orderId) {
          list[r].status = event.status === 'refunded' ? 'revoked' : 'expired';
        }
      }
    }
    return { ok: true, duplicate: false, account: account, payment: payment };
  }

  function checkoutHref(productId, trackId) {
    var q = '/access?checkout=1&product=' + encodeURIComponent(productId || 'start');
    if (trackId) q += '&track=' + encodeURIComponent(trackId);
    return q;
  }

  api.PAYMENT_STATUSES = PAYMENT_STATUSES;
  api.TILDA_PAYMENT_OPTIONS = TILDA_PAYMENT_OPTIONS;
  api.PAYMENT_TEST_MODE = TEST_MODE;
  api.createOrder = createOrder;
  api.TestGateway = TestGateway;
  api.createPaymentGateway = function () {
    return new TestGateway();
  };
  api.applyWebhook = applyWebhook;
  api.checkoutHref = checkoutHref;
  api.productById = productById;

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);

/* __MLMA_UI_SPLIT__ */

(function (root) {
  'use strict';
  var api = root.MLMA;
  if (!api) return;

  var PAGE_SIZE = 15;
  var LIBRARY_STATE_KEY = 'mlma.library.v1';

  var STOP_WORDS = {
    а: 1, и: 1, или: 1, но: 1, да: 1, нет: 1, не: 1, ни: 1, на: 1, в: 1, во: 1, с: 1, со: 1,
    к: 1, ко: 1, от: 1, до: 1, по: 1, из: 1, у: 1, о: 1, об: 1, про: 1, для: 1, при: 1,
    я: 1, ты: 1, он: 1, она: 1, мы: 1, вы: 1, они: 1, мне: 1, меня: 1, мой: 1, моя: 1,
    это: 1, этот: 1, эта: 1, эти: 1, тот: 1, то: 1, как: 1, что: 1, чтобы: 1, чем: 1,
    кто: 1, где: 1, когда: 1, куда: 1, зачем: 1, почему: 1, какой: 1, какая: 1, какие: 1,
    делать: 1, сделать: 1, надо: 1, нужно: 1, можно: 1, есть: 1, быть: 1, вот: 1,
    уже: 1, ещё: 1, еще: 1, же: 1, бы: 1, ли: 1, ведь: 1, там: 1, тут: 1, здесь: 1,
    очень: 1, просто: 1, также: 1, если: 1, только: 1, себе: 1, себя: 1, свой: 1,
    все: 1, всё: 1, всего: 1, ну: 1, под: 1, над: 1, без: 1, тебя: 1, происходит: 1,
    сейчас: 1, хочу: 1, хотел: 1, хотела: 1, новый: 1, новая: 1, новое: 1,
  };

  var TYPOS = {
    чилавек: 'человек', чилавека: 'человека', чалавек: 'человек',
    сабщения: 'сообщения', сабщение: 'сообщение', саобщение: 'сообщение',
    саощение: 'сообщение', сообшения: 'сообщения', смс: 'сообщение',
    канект: 'контакт', кантакт: 'контакт', контактовв: 'контактов',
    некаму: 'некому', некаво: 'некого', партнеры: 'партнёры', партнери: 'партнёры',
    заработываеть: 'зарабатывать', заработывать: 'зарабатывать',
    претензия: 'претензия', претензией: 'претензия', претензию: 'претензия',
    паузаа: 'пауза', дораго: 'дорого', дараго: 'дорого',
    адит: 'аудит', црм: 'crm', срм: 'crm',
    настаяник: 'наставник', каманда: 'команда',
    пазвонить: 'позвонить', пазвони: 'позвонить', незнакомам: 'незнакомому',
    отклабываю: 'откладываю', откладаю: 'откладываю',
  };

  var SYNONYMS = {
    покупатель: ['клиент', 'заказчик'],
    клиент: ['покупатель', 'заказчик'],
    страшно: ['боюсь', 'страх', 'неловко'],
    боюсь: ['страшно', 'страх', 'тревога'],
    страх: ['боюсь', 'страшно'],
    неловко: ['стыдно', 'навязываться'],
    стыдно: ['неловко', 'впаривание', 'навязываться'],
    начало: ['старт', 'новичок', 'начать'],
    старт: ['начало', 'новичок', 'начать'],
    план: ['планирование', 'порядок', 'ритм', 'система'],
    планирование: ['план', 'порядок', 'ритм'],
    новичок: ['новичку', 'новичка', 'старт', 'начало'],
    начать: ['старт', 'начало'],
    продажа: ['продавать', 'сделка'],
    понимаю: ['знаю'],
    знаю: ['понимаю'],
    разговор: ['диалог', 'беседа'],
    диалог: ['разговор', 'беседа'],
    навязываться: ['впаривать', 'давить', 'навязывать'],
    впаривать: ['навязываться', 'впаривание'],
    продукт: ['товар', 'каталог'],
    отказ: ['сомнение', 'пауза'],
    сомнение: ['пауза', 'возражение'],
    пауза: ['сомнение', 'подумает'],
    сообщение: ['текст', 'переписка', 'написать'],
    написать: ['сообщение', 'текст', 'переписка'],
    первый: ['первые', 'начало'],
    рассказать: ['презентация', 'объяснить'],
    наставник: ['спонсор', 'лидер', 'команда'],
    пропал: ['молчит', 'не отвечает', 'followup'],
    подумает: ['пауза', 'сомнение', 'не сейчас'],
    зарабатывать: ['доход', 'деньги', 'цель'],
    доход: ['зарабатывать', 'деньги'],
    голова: ['базе', 'crm', 'учет'],
    голове: ['база', 'crm', 'учет'],
    crm: ['база', 'статусы', 'учет'],
    база: ['crm', 'контакты', 'учет'],
    устал: ['откладываю', 'ритм', 'страх'],
    откладываю: ['устал', 'страх', 'ритм'],
    незнакомому: ['холодный', 'звонок'],
    позвонить: ['звонок', 'телефон', 'канал'],
    звонок: ['позвонить', 'телефон'],
    дорого: ['цена', 'стоимость'],
    цена: ['дорого', 'стоимость'],
    недоволен: ['претензия', 'опыт', 'обслуживание'],
    претензия: ['недоволен', 'опыт'],
    лидер: ['команда', 'наставник'],
    команда: ['партнёры', 'наставник', 'лидер'],
  };

  var SECTION_ALIASES = {
    A1: ['старт', 'система', 'новичок', 'роль', 'план', 'этика'],
    A2: ['база', 'клиент', 'люди', 'контакты', 'круги'],
    A3: ['диалог', 'разговор', 'сообщение', 'контакт', 'первый'],
    A4: ['продукт', 'потребность', 'решение', 'предложить'],
    A5: ['отказ', 'сомнение', 'пауза', 'возражение', 'подумает'],
    A6: ['повтор', 'клиентский', 'ритм', 'followup', 'рост'],
  };

  var TRACK_ALIASES = {
    'A1-001': ['стыдно продавать', 'навязываться', 'впаривание', 'этика'],
    'A1-004': ['роль', 'кем быть', 'лидер', 'собрать команду', 'новичок теряется', 'с чего начать', 'после регистрации'],
    'A1-006': ['зачем', 'личная причина', 'новичок теряется', 'запутался', 'много информации'],
    'A1-007': ['больше зарабатывать', 'не понимаю что делать', 'наблюдаемая цель', 'желание в цель', 'планирование', 'нужен план'],
    'A1-008': ['план жизни', 'личный план', 'планирование', 'без фантазий', 'навести порядок', 'нужна система'],
    'A1-010': ['план действий', '30 дней', 'ритм', 'откладываю', 'планирование', 'план на месяц', 'план на неделю', 'распланировать', 'нет дисциплины', 'всё хаотично', 'не успеваю'],
    'A1-011': ['продуктовый фокус', 'один продукт', 'новичок теряется', 'слишком много информации', 'первый фокус'],
    'A1-012': ['честная карточка', 'карточка продукта'],
    'A1-013': ['вопросы и ограничения', 'что можно обещать'],
    'A1-014': ['не стыдно рекомендовать'],
    'A1-016': ['стандарт рекомендации'],
    'A2-001': ['профиль клиента', 'кому подходит', 'кому предложить', 'целевая аудитория'],
    'A2-006': ['аудит базы', 'контактов много', 'в голове', 'держу в голове', 'crm'],
    'A2-007': ['сегментация базы', 'разделить базу'],
    'A2-008': ['пять контактов', 'пять людей', 'с кем начать', 'некому писать', 'новичок теряется', 'первые люди', 'кому написать'],
    'A2-009': ['план поиска', 'недельный план', 'планирование поиска', 'поиск людей план'],
    'A2-010': ['карта теплых кругов', 'теплые круги'],
    'A2-011': ['реальные контексты', 'где искать'],
    'A3-001': ['канал', 'написать или позвонить', 'как позвонить', 'выбрать канал'],
    'A3-002': ['первое сообщение', 'написать знакомому', 'теплый контакт', 'боюсь написать', 'что написать', 'первый диалог', 'страшно написать'],
    'A3-003': ['позвонить по рекомендации', 'звонок'],
    'A3-004': ['первый звонок', 'структура звонка', 'позвонить незнакомому'],
    'A3-007': ['подготовиться к звонку', 'холодный контакт'],
    'A3-005': ['назначить разговор', 'пригласить на встречу', 'назначить встречу'],
    'A3-008': ['зафиксировать результат', 'следующий контакт'],
    'A3-016': ['открыть разговор', 'настоящий повод'],
    'A4-001': ['от презентации к человеку', 'не рассказывать продукт сразу'],
    'A4-013': ['перейти к цене', 'назвать цену', 'дорого'],
    'A5-001': ['диагностика сомнения', 'подумает'],
    'A5-005': ['дорого', 'ценовое возражение', 'стоит за репликой', 'сказал что дорого'],
    'A5-008': ['посоветоваться'],
    'A5-009': ['не срочно'],
    'A5-010': ['follow-up', 'не отвечает'],
    'A5-011': ['план после паузы'],
    'A5-014': ['завершить отказ', 'мне отказали', 'после отказа'],
    'A6-001': ['клиентский опыт', 'купил и пропал', 'недоволен', 'обслуживание', 'претензия'],
    'A6-002': ['границы ответственности', 'претензия', 'недоволен продуктом'],
    'A6-003': ['встроить продукт', 'клиентский опыт'],
    'A6-006': ['дата повтора', 'вернуть клиента', 'повторные продажи'],
    'A6-010': ['статусы', 'следующие действия', 'crm', 'мини-crm', 'в голове'],
    'A6-011': ['рабочий ритм', 'рабочее время', 'устал', 'откладываю', 'нет системы', 'не успеваю', 'дисциплина', 'хаотично'],
    'A6-012': ['план из действий', 'лидер', 'команда', 'планирование роста'],
    'A6-021': ['личное изменение', 'дисциплина', 'одно изменение', 'нет дисциплины'],
    'A6-013': ['разбор практики', 'наставничество', 'партнёры ничего не делают'],
    'A6-020': ['страх действия', 'откладываю', 'устал'],
    'A2-012': ['холодный поиск', 'незнакомым', 'холодный контакт'],
  };

  var INTENTS = [
    {
      id: 'first-write',
      goal: 'начать разговор с знакомым без давления',
      why: ['первое сообщение', 'тёплый контакт', 'страх навязаться'],
      phrases: ['боюсь написать', 'написать знакомому', 'первое сообщение', 'что написать', 'написать человеку', 'не знаю что написать', 'первым написать', 'страшно написать', 'страшно написать человеку', 'первый диалог'],
      boostIds: ['A3-002', 'A3-016'],
      writeBias: true,
      reason: 'Подходит, потому что вы хотите написать человеку, но боитесь показаться навязчивым.',
    },
    {
      id: 'no-people',
      goal: 'найти, с кем начать работу',
      why: ['нет людей', 'база', 'пять контактов'],
      phrases: ['некому писать', 'некому', 'с кем начать', 'нет людей', 'не знаю с кем', 'нет контактов', 'не понимаю с кем', 'кому написать', 'не знаю кому написать', 'кому писать', 'не понимаю кому писать'],
      boostIds: ['A2-008', 'A2-010', 'A2-006', 'A2-011', 'A2-001'],
      reason: 'Подходит, потому что вам нужно понять, с кем начать, а не сразу писать первое сообщение.',
    },
    {
      id: 'ethics',
      goal: 'предложить продукт без впаривания',
      why: ['этика', 'без впаривания', 'стыд продавать'],
      phrases: ['стыдно продавать', 'навязываться', 'впариван', 'стыдно предлагать', 'боюсь навязываться'],
      boostIds: ['A1-001'],
      reason: 'Подходит, потому что вам важно предложить продукт без давления и впаривания.',
    },
    {
      id: 'first-result',
      goal: 'получить первый рабочий результат',
      why: ['первый результат', 'план действий', 'первые контакты'],
      phrases: ['первый результат', 'получить первый результат', 'хочу первый результат', 'хочу первого клиента', 'первый клиент', 'хочу найти первых клиентов', 'первых клиентов', 'найти первых клиентов'],
      boostIds: ['A1-010', 'A2-008', 'A3-002', 'A3-016'],
      reason: 'Подходит, потому что вы хотите получить первый рабочий результат, а не просто посмотреть урок.',
    },
    {
      id: 'just-started',
      goal: 'понять роль и первые шаги',
      why: ['старт', 'роль', 'план'],
      phrases: ['только начал', 'я новичок', 'только начинаю', 'я только начал', 'как начать', 'что делать новичку', 'новичку'],
      boostIds: ['A1-004', 'A1-006', 'A1-010'],
      reason: 'Подходит, потому что вы только начинаете и сначала нужно понять роль и ближайшие шаги.',
    },
    {
      id: 'planning',
      goal: 'собрать рабочий план и навести порядок',
      why: ['план', 'ритм', 'порядок'],
      phrases: [
        'планирование', 'план', 'распланировать', 'составить план', 'нужен порядок', 'нет системы',
        'не понимаю что делать каждый день', 'не успеваю', 'нет рабочего ритма', 'всё хаотично', 'все хаотично',
        'хочу организовать работу', 'план на месяц', 'план на неделю', 'нужна система', 'нет дисциплины',
        'навести порядок', 'хочу навести порядок',
      ],
      boostIds: ['A1-010', 'A1-008', 'A1-004', 'A1-007', 'A2-009', 'A6-011', 'A6-012', 'A6-021'],
      featuredIds: ['A1-010', 'A1-008', 'A1-004'],
      matchType: 'strong',
      reason: 'Подходит, потому что нужно превратить общую цель в конкретный план действий.',
    },
    {
      id: 'lost-novice',
      goal: 'дать новичку стартовый маршрут',
      why: ['новичок', 'старт', 'первые шаги'],
      phrases: [
        'новичок теряется', 'только пришёл и не понимает', 'не знает с чего начать', 'много информации',
        'всё непонятно', 'все непонятно', 'запутался', 'потерялся', 'новичку сложно', 'нет первых шагов',
        'куда идти сначала', 'что делать после регистрации', 'нужен стартовый маршрут',
        'я только зарегистрировался', 'слишком много информации', 'с чего начать новичку',
      ],
      boostIds: ['A1-004', 'A1-006', 'A1-010', 'A1-011', 'A2-008', 'A3-002'],
      featuredIds: ['A1-004', 'A1-010', 'A1-011'],
      matchType: 'adjacent',
      wide: true,
      clarification: 'Где именно человек теряется: не понимает свою роль, не знает, кому написать или не умеет рассказать о продукте?',
      reason: 'Подходит как стартовый маршрут: сначала роль, затем план первых действий и фокус.',
    },
    {
      id: 'claim',
      goal: 'разобрать претензию клиента',
      why: ['претензия', 'клиентский опыт', 'границы ответственности'],
      phrases: ['претензия', 'претензией', 'работа с претензией', 'жалоба'],
      boostIds: ['A6-001', 'A6-002', 'A6-003'],
      reason: 'Подходит, потому что нужно разобрать претензию клиента и границы своей ответственности.',
    },
    {
      id: 'earn-goal',
      goal: 'перевести желание больше зарабатывать в понятные действия',
      why: ['желание в цель', 'что делать дальше', 'наблюдаемый результат'],
      phrases: ['больше зарабатывать', 'хочу больше зарабатывать', 'не понимаю что делать', 'не знаю что делать', 'хочу зарабатывать', 'не знаю что должно'],
      boostIds: ['A1-007', 'A1-010', 'A1-006', 'A1-015'],
      reason: 'Подходит, потому что желание больше зарабатывать нужно перевести в понятные действия.',
    },
    {
      id: 'crm-head',
      goal: 'навести порядок в контактах, статусах и следующих действиях',
      why: ['аудит базы', 'crm', 'статусы и next action'],
      phrases: ['держу в голове', 'в голове', 'контактов много', 'нет системы в базе', 'crm', 'аудит базы', 'все в голове', 'всё держу в голове', 'таблицу контактов', 'вести таблицу', 'работать с контактами', 'не успеваю работать с контактами'],
      boostIds: ['A2-006', 'A2-007', 'A6-010'],
      reason: 'Подходит, потому что контактов уже много, и их нельзя держать только в голове.',
    },
    {
      id: 'postpone',
      goal: 'вернуть рабочий ритм и перестать откладывать',
      why: ['ритм', 'план на 30 дней', 'страх действия'],
      phrases: ['все откладываю', 'всё откладываю', 'устал', 'нет сил', 'нет ритма', 'прокрастин', 'страшно начать'],
      boostIds: ['A1-010', 'A6-011', 'A6-020', 'A3-014'],
      reason: 'Подходит, потому что вам нужно вернуть ритм и перестать откладывать конкретное действие.',
    },
    {
      id: 'cold-call',
      goal: 'выбрать канал и сделать первый звонок незнакомому',
      why: ['канал контакта', 'первый звонок', 'холодный вход'],
      phrases: ['как позвонить', 'позвонить незнакомому', 'позвонить незнакомым', 'холодный звонок', 'первый звонок', 'звонить незнакомым', 'звонить холодн', 'страшно звонить'],
      boostIds: ['A3-001', 'A3-004', 'A3-007', 'A2-012', 'A3-003'],
      reason: 'Подходит, потому что вам нужно выбрать канал и спокойно сделать первый звонок.',
    },
    {
      id: 'who-offer',
      goal: 'понять, кому предлагать продукт',
      why: ['профиль клиента', 'карта людей', 'продуктовый фокус'],
      phrases: ['кому предложить', 'не понимаю кому', 'целевая аудитория', 'кому подходит продукт', 'кому предлагать'],
      boostIds: ['A2-001', 'A2-010', 'A1-011', 'A2-008'],
      reason: 'Подходит, потому что сначала нужно понять, кому продукт действительно подходит.',
    },
    {
      id: 'unhappy-client',
      goal: 'разобрать недовольство клиента и претензию',
      why: ['клиентский опыт', 'обслуживание', 'границы ответственности'],
      phrases: ['недоволен продуктом', 'недоволен', 'претензия', 'жалоба клиента', 'плохое обслуживание', 'клиент ругается', 'жалуется', 'клиент жалуется'],
      boostIds: ['A6-001', 'A6-002', 'A6-003'],
      reason: 'Подходит, потому что клиент недоволен, и нужно разобрать опыт, а не давить на повторную продажу.',
    },
    {
      id: 'team',
      goal: 'наставить партнёров и собрать рабочую команду',
      why: ['наставничество', 'ритм', 'стандарт'],
      phrases: ['партнеры ничего не делают', 'партнёры ничего не делают', 'команда не работает', 'развивать команду', 'наставлять', 'партнеры не делают', 'стать лидером', 'собрать команду', 'хочу стать лидером', 'как развивать команду', 'хочу выстроить команду', 'выстроить команду', 'партнеры стоят', 'партнёры стоят', 'команда стоит', 'стоят на месте'],
      boostIds: ['A6-013', 'A6-012', 'A6-011', 'A1-016', 'A6-010', 'A1-010', 'A1-004'],
      teamOnly: true,
      reason: 'Подходит, потому что это задача про команду и наставничество, а не личный первый диалог.',
    },
    {
      id: 'price',
      goal: 'разобрать ценовое возражение, а не общее сомнение',
      why: ['ценовое возражение', 'что стоит за «дорого»'],
      phrases: ['сказал что дорого', 'что дорого', 'это дорого', 'слишком дорого', 'дорого для него', 'не по карману', 'цена смущает', 'сказали что дорого', 'мне сказали что дорого'],
      boostIds: ['A5-005', 'A4-013', 'A5-001', 'A5-007'],
      reason: 'Подходит, потому что человек упёрся в цену, и нужно понять, что стоит за этой репликой.',
    },
    {
      id: 'pause',
      goal: 'продолжить диалог после паузы и сомнения',
      why: ['пауза', 'сомнение', 'подумает'],
      phrases: ['подумает', 'не сейчас', 'сомневается', 'надо подумать', 'сказал что подумает', 'взял паузу', 'человек думает'],
      boostIds: ['A5-001', 'A5-008', 'A5-009', 'A5-010', 'A5-011', 'A5-003'],
      reason: 'Подходит, потому что человек взял паузу, и следующий шаг — продолжить без давления.',
    },
    {
      id: 'lost-client',
      goal: 'вернуть клиента после покупки или тишины',
      why: ['follow-up', 'клиентский опыт', 'повторный контакт'],
      phrases: ['купил и пропал', 'больше не отвечает', 'вернуть клиента', 'не отвечает', 'клиент купил', 'пропал', 'молчит после сообщения'],
      boostIds: ['A6-001', 'A6-006', 'A5-010', 'A6-003', 'A6-010'],
      reason: 'Подходит, потому что клиент уже купил и пропал — нужен аккуратный повторный контакт.',
    },
    {
      id: 'product-talk',
      goal: 'честно рассказать о продукте',
      why: ['карточка продукта', 'продуктовый фокус', 'ограничения'],
      phrases: ['рассказать о продукте', 'не знаю продукт', 'как рассказать', 'не знаю как рассказать', 'что можно обещать', 'презентация продукта', 'как рассказать о продукте'],
      boostIds: ['A1-012', 'A1-011', 'A1-013', 'A4-001', 'A1-014'],
      reason: 'Подходит, потому что нужно честно рассказать о продукте на языке человека, а не прочитать презентацию.',
    },
    {
      id: 'silent-message',
      goal: 'продолжить контакт, если человек молчит после сообщения',
      why: ['follow-up после сообщения', 'человек молчит'],
      phrases: ['молчит после', 'не отвечает на сообщение', 'прочитал и молчит', 'тишина после сообщения', 'человек молчит', 'люди молчат', 'он молчит'],
      boostIds: ['A5-010', 'A3-008', 'A5-011'],
      reason: 'Подходит, потому что человек молчит после сообщения, и нужен следующий контакт без преследования.',
    },
    {
      id: 'invite-meeting',
      goal: 'пригласить на разговор или встречу',
      why: ['назначить встречу', 'конкретное время'],
      phrases: ['пригласить на встречу', 'как пригласить', 'назначить встречу', 'назначить разговор'],
      boostIds: ['A3-005', 'A3-013', 'A3-016'],
      reason: 'Подходит, потому что вам нужно назначить конкретное время разговора или встречи.',
    },
    {
      id: 'refused',
      goal: 'сохранить движение после отказа',
      why: ['отказ', 'завершить корректно'],
      phrases: ['мне отказали', 'отказали', 'человек отказал', 'после отказа'],
      boostIds: ['A5-014', 'A5-001', 'A5-011'],
      reason: 'Подходит, потому что после отказа важно корректно завершить и сохранить движение.',
    },
    {
      id: 'repeat-sales',
      goal: 'вернуть повторную покупку без выдуманных цифр',
      why: ['повтор', 'следующий контакт после покупки'],
      phrases: ['повторные продажи', 'повторную продажу', 'хочу повторные продажи', 'повторная продажа'],
      boostIds: ['A6-006', 'A6-003', 'A6-001'],
      reason: 'Подходит, потому что речь о повторном контакте после покупки, а не о первом сообщении.',
    },
  ];

  var CLARIFY_QUESTION = 'Вам нужно найти людей, начать разговор, продолжить после паузы или организовать команду?';
  var CLARIFY_OPTIONS = [
    { id: 'people', label: 'Найти, с кем начать', q: 'мне некому писать' },
    { id: 'write', label: 'Начать разговор', q: 'боюсь написать знакомому' },
    { id: 'team', label: 'Разобрать работу команды', q: 'партнёры ничего не делают' },
  ];
  var OUT_OF_SCOPE = [
    {
      test: /(ремонт\w*\s+(автомобил|машин)|починить\s+(машин|авто)|автомобил\w*\s+ремонт|как отремонтировать)/,
      question: 'Этот запрос не относится к библиотеке MLM Academy. Опишите рабочую ситуацию в партнёрской работе.',
      options: CLARIFY_OPTIONS.slice(),
      trueOut: true,
    },
    {
      test: /(погода на марсе|квантовый единорог|asdfgh|qwerty)/,
      question: 'Этот запрос не относится к библиотеке. Напишите, что происходит в работе с людьми, продуктом или планом.',
      options: CLARIFY_OPTIONS.slice(),
      trueOut: true,
    },
  ];
  var ADJACENT_SCOPE = [
    {
      test: /(нов(ый|ого|ом)\s+город|открыть\s+(новый\s+)?город|новый\s+(филиал|регион|рынок)|географи|запуск\s+города)/,
      question: 'Отдельного трека про запуск нового города пока нет. Можно начать с ближайших шагов в текущем круге.',
      trackIds: ['A2-008', 'A2-011', 'A1-010', 'A2-001'],
      matchType: 'adjacent',
      reason: 'Ближайший полезный шаг — найти людей и собрать план в текущем круге, пока нет трека про запуск региона.',
    },
    {
      test: /(снять\s+видео|монтаж|риелс|reels|тикток)/,
      question: 'Трека про съёмку видео пока нет. Какая рабочая задача ближе?',
      trackIds: ['A3-002', 'A3-016', 'A1-012'],
      matchType: 'adjacent',
      reason: 'Ближайший полезный шаг — начать разговор или честно рассказать о продукте, а не снимать ролик.',
    },
  ];

  var PRESETS = [
    { id: 'just-started', title: 'Я только начал', hint: 'Роль, причина, план и первые пять контактов', trackIds: ['A1-004', 'A1-006', 'A1-010', 'A1-011', 'A2-008'] },
    { id: 'first-result', title: 'Хочу первый результат', hint: 'План, контакты, сообщение, разговор, фиксация', trackIds: ['A1-010', 'A2-008', 'A3-002', 'A3-016', 'A3-008'] },
    { id: 'who-to-work', title: 'Не понимаю, с кем работать', hint: 'Профиль, база, круги и реальные контексты', trackIds: ['A2-001', 'A2-006', 'A2-007', 'A2-008', 'A2-010', 'A2-011'] },
    { id: 'want-write', title: 'Хочу написать человеку', hint: 'Канал, первое сообщение, повод и фиксация', trackIds: ['A3-001', 'A3-002', 'A3-016', 'A3-005', 'A3-008'] },
    { id: 'tell-product', title: 'Хочу нормально рассказать о продукте', hint: 'Фокус, честная карточка и переход к человеку', trackIds: ['A1-011', 'A1-012', 'A1-013', 'A1-014', 'A4-001'] },
    { id: 'person-doubts', title: 'Человек сомневается', hint: 'Пауза, follow-up и корректное завершение', trackIds: ['A5-001', 'A5-009', 'A5-010', 'A5-011', 'A5-014'] },
    { id: 'return-client', title: 'Хочу вернуть клиента', hint: 'Опыт, повтор и следующий контакт', trackIds: ['A6-001', 'A6-003', 'A6-006', 'A5-010', 'A6-010'] },
    { id: 'grow-team', title: 'Хочу развивать команду', hint: 'Стандарт, ритм и разбор практики', trackIds: ['A1-010', 'A1-016', 'A6-010', 'A6-011', 'A6-012', 'A6-013'] },
  ];

  var GOALS = [
    { id: 'first-result', title: 'Первый результат' },
    { id: 'find-client', title: 'Найти клиента' },
    { id: 'first-dialogue', title: 'Первый диалог' },
    { id: 'understand-need', title: 'Понять потребность' },
    { id: 'handle-doubt', title: 'Пройти сомнения' },
    { id: 'grow-repeat', title: 'Повтор и рост' },
  ];

  var SIT_FILTERS = [
    { id: 'start', title: 'Старт', test: function (m) { return m.sectionId === 'A1' || m.sit === 'start'; } },
    { id: 'people', title: 'Поиск людей', test: function (m) { return m.sit === 'people'; } },
    { id: 'contact', title: 'Первый контакт', test: function (m) { return m.sit === 'contact'; } },
    { id: 'talk', title: 'Разговор', test: function (m) { return m.sit === 'talk'; } },
    { id: 'offer', title: 'Предложение', test: function (m) { return m.sit === 'offer'; } },
    { id: 'doubt', title: 'Сомнение', test: function (m) { return m.sit === 'doubt'; } },
    { id: 'refuse', title: 'Отказ', test: function (m) { return m.sit === 'refuse'; } },
    { id: 'followup', title: 'Follow-up', test: function (m) { return m.sit === 'followup'; } },
    { id: 'repeat', title: 'Повтор', test: function (m) { return m.sit === 'repeat'; } },
    { id: 'base', title: 'Управление базой', test: function (m) { return m.sit === 'base'; } },
    { id: 'team', title: 'Команда', test: function (m) { return m.sit === 'team'; } },
  ];

  var FMT_FILTERS = [
    { id: 'message', title: 'Сообщение' },
    { id: 'list', title: 'Список' },
    { id: 'map', title: 'Карта' },
    { id: 'plan', title: 'План' },
    { id: 'checklist', title: 'Чек-лист' },
    { id: 'conversation', title: 'Разговор' },
    { id: 'calculator', title: 'Калькулятор' },
    { id: 'decision', title: 'Решение' },
    { id: 'result', title: 'Фиксация результата' },
  ];

  var CH_FILTERS = [
    { id: 'chat', title: 'Переписка' },
    { id: 'call', title: 'Звонок' },
    { id: 'meeting', title: 'Встреча' },
    { id: 'content', title: 'Контент' },
    { id: 'crm', title: 'CRM' },
    { id: 'any', title: 'Универсальный' },
  ];

  var LVL_FILTERS = [
    { id: 'beginner', title: 'Начинаю' },
    { id: 'working', title: 'Уже работаю' },
    { id: 'system', title: 'Развиваю систему' },
    { id: 'mentor', title: 'Наставляю команду' },
  ];

  var AVAIL_FILTERS = [
    { id: 'description', title: 'Описание готово' },
    { id: 'playable', title: 'Можно пройти' },
  ];

  var EXPERIENCE = [
    { id: 'start', title: 'Я только начинаю', level: 'beginner' },
    { id: 'first-steps', title: 'Уже делал несколько попыток', level: 'working' },
    { id: 'practice', title: 'У меня уже есть клиенты', level: 'system' },
    { id: 'growth', title: 'Я развиваю команду', level: 'mentor' },
  ];

  var MATERIAL_TYPES = [
    { id: 'track', title: 'Трек' },
    { id: 'material', title: 'Материал' },
  ];
  var TIME_FILTERS = [
    { id: '10', title: 'До 10 минут' },
    { id: '20', title: 'До 20 минут' },
    { id: '30', title: '20 минут и дольше' },
  ];
  var GOAL_SECTIONS = {
    'first-result': ['A1', 'A3'],
    'find-client': ['A2'],
    'first-dialogue': ['A3'],
    'understand-need': ['A4'],
    'handle-doubt': ['A5'],
    'grow-repeat': ['A6'],
  };
  var SITUATIONS = SIT_FILTERS.map(function (item) {
    return { id: item.id, title: item.title };
  });

  var FIELD_WEIGHTS = {
    titleExact: 400,
    title: 45,
    situation: 80,
    aliases: 55,
    outcome: 55,
    trigger: 70,
    inputState: 70,
    targetState: 50,
    mainTask: 40,
    mechanic: 18,
    artifact: 22,
    evidence: 16,
    tags: 25,
    section: 16,
    format: 10,
    id: 16,
    phrase: 90,
    multi: 22,
    intent: 240,
    emotion: 24,
  };


  api.STOP_WORDS = STOP_WORDS;
  api.TYPOS = TYPOS;
  api.SYNONYMS = SYNONYMS;
  api.INTENTS = INTENTS;
  api.CLARIFY_QUESTION = CLARIFY_QUESTION;
  api.CLARIFY_OPTIONS = CLARIFY_OPTIONS;
  api.OUT_OF_SCOPE = OUT_OF_SCOPE;
  api.ADJACENT_SCOPE = ADJACENT_SCOPE;
  api.TRACK_ALIASES = TRACK_ALIASES;
  api.SECTION_ALIASES = SECTION_ALIASES;
  api.GOALS = GOALS;
  api.SITUATIONS = SITUATIONS;
  api.SIT_FILTERS = SIT_FILTERS;
  api.FMT_FILTERS = FMT_FILTERS;
  api.CH_FILTERS = CH_FILTERS;
  api.LVL_FILTERS = LVL_FILTERS;
  api.AVAIL_FILTERS = AVAIL_FILTERS;
  api.EXPERIENCE = EXPERIENCE;
  api.MATERIAL_TYPES = MATERIAL_TYPES;
  api.TIME_FILTERS = TIME_FILTERS;
  api.GOAL_SECTIONS = GOAL_SECTIONS;
  api.PRESETS = PRESETS;
  api.FIELD_WEIGHTS = FIELD_WEIGHTS;
  api.PAGE_SIZE = 15;
  api.LIBRARY_STATE_KEY = LIBRARY_STATE_KEY;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);

/* __MLMA_UI_SPLIT__ */
(function (root) {
  'use strict';
  var api = root.MLMA;
  if (!api) return;
  var STOP_WORDS = api.STOP_WORDS;
  var TYPOS = api.TYPOS || {};
  var SYNONYMS = api.SYNONYMS;
  var INTENTS = api.INTENTS;
  var CLARIFY_QUESTION = api.CLARIFY_QUESTION || 'Вам нужно найти людей, начать разговор, продолжить после паузы или организовать команду?';
  var CLARIFY_OPTIONS = api.CLARIFY_OPTIONS || [];
  var OUT_OF_SCOPE = api.OUT_OF_SCOPE || [];
  var ADJACENT_SCOPE = api.ADJACENT_SCOPE || [];
  var TRACK_ALIASES = api.TRACK_ALIASES;
  var SECTION_ALIASES = api.SECTION_ALIASES;
  var GOALS = api.GOALS;
  var SIT_FILTERS = api.SIT_FILTERS;
  var FMT_FILTERS = api.FMT_FILTERS;
  var CH_FILTERS = api.CH_FILTERS;
  var LVL_FILTERS = api.LVL_FILTERS;
  var AVAIL_FILTERS = api.AVAIL_FILTERS;
  var EXPERIENCE = api.EXPERIENCE;
  var PRESETS = api.PRESETS;
  var TIME_FILTERS = api.TIME_FILTERS || [];
  var GOAL_SECTIONS = api.GOAL_SECTIONS || {};
  var FIELD_WEIGHTS = api.FIELD_WEIGHTS;

  var metaCache = {};
  var MIN_HIT = 36;
  var MIN_CLOSE = 70;

  function correctTypos(tokens) {
    var out = [];
    var seen = {};
    function add(token) {
      if (!token || seen[token]) return;
      seen[token] = true;
      out.push(token);
    }
    for (var i = 0; i < tokens.length; i += 1) {
      var token = tokens[i];
      add(token);
      if (TYPOS[token] && TYPOS[token] !== token) add(api.normalizeSearchText(TYPOS[token]));
    }
    return out;
  }

  function stem(word) {
    var value = String(word || '');
    if (value.length < 4) return value;
    var suffixes = [
      'ться', 'тся', 'ешь', 'ишь', 'ать', 'ять', 'ить', 'ость', 'ение', 'ание',
      'ого', 'ему', 'ами', 'ями', 'ому', 'ыми', 'ими', 'ией',
      'ов', 'ев', 'ах', 'ях', 'ой', 'ый', 'ий', 'ая', 'ое', 'ые', 'ия', 'ие',
      'ей', 'ью', 'ью',
      'ть', 'ся', 'сь', 'ам', 'ям', 'ом', 'ем', 'ую', 'ей',
      'а', 'у', 'е', 'и', 'ы', 'я', 'ю', 'о',
    ];
    for (var i = 0; i < suffixes.length; i += 1) {
      var sfx = suffixes[i];
      if (value.length - sfx.length >= 3 && value.slice(-sfx.length) === sfx) {
        return value.slice(0, -sfx.length);
      }
    }
    return value;
  }

  function tokenize(value) {
    var normalized = api.normalizeSearchText(value);
    if (!normalized) return [];
    return correctTypos(normalized.split(' ').filter(Boolean));
  }

  function isStopWord(token) {
    return token.length < 2 || !!STOP_WORDS[token];
  }

  function usefulTokens(tokens) {
    var out = [];
    for (var i = 0; i < tokens.length; i += 1) {
      if (!isStopWord(tokens[i])) out.push(tokens[i]);
    }
    return out;
  }

  function expandToken(token) {
    var out = [token];
    var stemmed = stem(token);
    if (stemmed.length >= 4) out.push(stemmed);
    var extras = SYNONYMS[token];
    if (extras) {
      for (var i = 0; i < extras.length; i += 1) {
        out.push(extras[i]);
        out.push(stem(extras[i]));
      }
    }
    var seen = {};
    var uniq = [];
    for (var j = 0; j < out.length; j += 1) {
      if (out[j] && !seen[out[j]]) {
        seen[out[j]] = true;
        uniq.push(out[j]);
      }
    }
    return uniq;
  }

  function analyzeQuery(raw) {
    var original = String(raw || '').trim();
    var tokens = tokenize(original);
    var useful = usefulTokens(tokens);
    if (original && useful.length === 0) {
      return { kind: 'need_more', original: original, tokens: tokens, useful: [], expanded: [], norm: '', intents: [] };
    }
    var expanded = [];
    var seen = {};
    for (var i = 0; i < useful.length; i += 1) {
      var pack = expandToken(useful[i]);
      for (var j = 0; j < pack.length; j += 1) {
        if (!seen[pack[j]]) {
          seen[pack[j]] = true;
          expanded.push(pack[j]);
        }
      }
    }
    var norm = tokens.join(' ') || api.normalizeSearchText(original);
    var intents = matchIntents(norm);
    var scoped = detectOutOfScope(norm);
    var adjacent = detectAdjacentScope(norm);
    return {
      kind: scoped ? 'out_of_scope' : 'ok',
      original: original,
      tokens: tokens,
      useful: useful,
      expanded: expanded,
      norm: norm,
      intents: intents,
      negated: collectNegated(norm),
      outOfScope: scoped,
      adjacentScope: adjacent,
    };
  }

  var NEGATION_KEEP = [
    'не понимаю', 'не знаю', 'некому', 'некого', 'не отвечает', 'недоволен',
    'неловко', 'не стыдно', 'не по карману', 'не сейчас', 'не хочу впаривать',
    'не хочу продавать', 'незнакомому', 'незнакомым', 'незнакомец',
    'не делают', 'не делает', 'ничего не делают', 'не надо продавать',
    'не знаю как', 'не знаю что', 'не понимаю что', 'не понимаю кому',
    'не понимаю с кем',
  ];

  function collectNegated(norm) {
    var work = ' ' + String(norm || '') + ' ';
    for (var i = 0; i < NEGATION_KEEP.length; i += 1) {
      work = work.split(NEGATION_KEEP[i]).join(' ');
    }
    var topics = [];
    var seen = {};
    var parts = work.split(' ').filter(Boolean);
    for (var p = 0; p < parts.length; p += 1) {
      if (parts[p] !== 'не' && parts[p] !== 'нет') continue;
      for (var k = 1; k <= 2; k += 1) {
        var next = parts[p + k];
        if (!next || next.length < 3 || isStopWord(next)) continue;
        var stemmed = stem(next);
        if (stemmed && !seen[stemmed]) {
          seen[stemmed] = true;
          topics.push(stemmed);
        }
      }
    }
    return topics;
  }

  function intentBlocked(intent, negated) {
    if (!negated || !negated.length) return false;
    var blob = api.normalizeSearchText((intent.phrases || []).concat(intent.why || []).concat([intent.goal || '', intent.id || '']).join(' '));
    for (var i = 0; i < negated.length; i += 1) {
      if (negated[i].length >= 4 && blob.indexOf(negated[i]) !== -1) return true;
    }
    return false;
  }

  function matchIntents(norm) {
    var hits = [];
    if (!norm) return hits;
    var negated = collectNegated(norm);
    for (var i = 0; i < INTENTS.length; i += 1) {
      var intent = INTENTS[i];
      var matched = false;
      for (var p = 0; p < intent.phrases.length; p += 1) {
        var phrase = api.normalizeSearchText(intent.phrases[p]);
        if (phrase && norm.indexOf(phrase) !== -1) {
          matched = true;
          break;
        }
      }
      if (!matched || intentBlocked(intent, negated)) continue;
      hits.push(intent);
    }
    var ids = {};
    for (var h = 0; h < hits.length; h += 1) ids[hits[h].id] = true;
    if (ids['silent-message'] || ids['lost-client'] || ids['price'] || ids['team'] || ids['no-people']) {
      hits = hits.filter(function (item) { return item.id !== 'first-write'; });
    }
    if (ids.team) {
      hits = hits.filter(function (item) { return item.id !== 'first-result' && item.id !== 'just-started'; });
    }
    if (ids['crm-head'] || ids.price || ids['cold-call'] || ids['silent-message'] || ids['lost-client'] || ids['first-write'] || ids['no-people'] || ids.team) {
      hits = hits.filter(function (item) { return item.id !== 'planning'; });
    }
    return hits;
  }

  function detectOutOfScope(norm) {
    for (var i = 0; i < OUT_OF_SCOPE.length; i += 1) {
      if (OUT_OF_SCOPE[i].test && OUT_OF_SCOPE[i].test.test(norm)) return OUT_OF_SCOPE[i];
    }
    return null;
  }

  function detectAdjacentScope(norm) {
    for (var i = 0; i < ADJACENT_SCOPE.length; i += 1) {
      if (ADJACENT_SCOPE[i].test && ADJACENT_SCOPE[i].test.test(norm)) return ADJACENT_SCOPE[i];
    }
    return null;
  }

  function defaultClarify() {
    return { question: CLARIFY_QUESTION, options: CLARIFY_OPTIONS.slice() };
  }

  function humanWhy(track, analysis, why, aiReason) {
    var text = String(aiReason || '').replace(/\s+/g, ' ').trim();
    if (text.length >= 12) {
      if (!/^подходит/i.test(text)) text = 'Подходит, потому что ' + text.charAt(0).toLowerCase() + text.slice(1);
      return text;
    }
    var intents = (analysis && analysis.intents) || [];
    for (var i = 0; i < intents.length; i += 1) {
      if (intents[i].boostIds && intents[i].boostIds.indexOf(track.trackId) !== -1 && intents[i].reason) {
        return intents[i].reason;
      }
    }
    if (why && why.intent && why.intent.length) {
      return 'Подходит, потому что ' + String(why.intent[0]).replace(/\s+/g, ' ').trim() + '.';
    }
    if (track && track.situation) {
      var sit = String(track.situation).replace(/\s+/g, ' ').trim();
      if (sit.length > 110) sit = sit.slice(0, 107) + '…';
      return 'Подходит, потому что это про вашу ситуацию: ' + sit;
    }
    return '';
  }

  function fieldHas(haystack, variants) {
    if (!haystack) return false;
    var words = haystack.split(' ').filter(Boolean);
    for (var i = 0; i < variants.length; i += 1) {
      var needle = variants[i];
      if (!needle || needle.length < 3) continue;
      var needleStem = stem(needle);
      var prefixLen = needle.length >= 5 ? 5 : 4;
      var prefix = needle.length >= 4 ? needle.slice(0, prefixLen) : '';
      for (var w = 0; w < words.length; w += 1) {
        var word = words[w];
        if (word === needle) return true;
        if (needle.length >= 4 && word.indexOf(needle) === 0) return true;
        if (needleStem.length >= 4 && stem(word) === needleStem) return true;
        if (prefix && word.length >= prefix.length && word.slice(0, prefix.length) === prefix) return true;
      }
    }
    return false;
  }

  function formatGroup(format) {
    var s = api.normalizeSearchText(format);
    if (/сообщен|конструктор сообщения|текст переписк/.test(s)) return 'message';
    if (/список/.test(s)) return 'list';
    if (/карт/.test(s)) return 'map';
    if (/план/.test(s)) return 'plan';
    if (/чек/.test(s)) return 'checklist';
    if (/разговор|диалог|встреч/.test(s)) return 'conversation';
    if (/калькул|посчитать/.test(s)) return 'calculator';
    if (/решен|фильтр/.test(s)) return 'decision';
    if (/фиксац|результат/.test(s)) return 'result';
    return 'other';
  }

  function channelOf(track) {
    var s = api.normalizeSearchText(track.title + ' ' + track.format + ' ' + track.situation);
    if (/звонок|телефон|позвон/.test(s)) return 'call';
    if (/встреч/.test(s)) return 'meeting';
    if (/сообщен|переписк|написать|мессендж|чат/.test(s)) return 'chat';
    if (/контент|пост|видео|ролик/.test(s)) return 'content';
    if (/crm|баз|статус/.test(s)) return 'crm';
    return 'any';
  }

  function sitOf(track) {
    var s = api.normalizeSearchText(track.title + ' ' + track.situation + ' ' + track.module);
    if (track.sectionId === 'A1' && /команд|настав|стандарт/.test(s)) return 'team';
    if (track.sectionId === 'A1') return 'start';
    if (/аудит|баз|сегмент|статус/.test(s) && track.sectionId === 'A2') return 'base';
    if (/пять людей|кругов|контекст|поиск|профиль|рекомендац/.test(s) && track.sectionId === 'A2') return 'people';
    if (track.sectionId === 'A2') return 'people';
    if (/сообщен|позвон|канал|перв/.test(s) && track.sectionId === 'A3') return 'contact';
    if (/встреч|разговор|повод/.test(s) && track.sectionId === 'A3') return 'talk';
    if (track.sectionId === 'A3') return 'contact';
    if (track.sectionId === 'A4') return /предлож|цен|выбор|заверш/.test(s) ? 'offer' : 'talk';
    if (/отказ/.test(s) && track.sectionId === 'A5') return 'refuse';
    if (/follow|повтор|пауз|не отвечает/.test(s) && track.sectionId === 'A5') return 'followup';
    if (track.sectionId === 'A5') return 'doubt';
    if (/команд|настав|ритм|разбор|план роста/.test(s) && track.sectionId === 'A6') return 'team';
    if (/повтор|клиентск|встроить|дата/.test(s) && track.sectionId === 'A6') return 'repeat';
    if (track.sectionId === 'A6') return 'followup';
    return 'start';
  }

  function levelOf(track) {
    var s = api.normalizeSearchText(track.title + ' ' + track.situation + ' ' + track.module);
    if (/настав|команд|передач стандарт|самостоятельност/.test(s)) return 'mentor';
    if (track.sectionId === 'A6' || /систем|ритм|план роста/.test(s)) return 'system';
    if (track.sectionId === 'A1' || /перв|старт|начал|пять людей|первое сообщение/.test(s)) return 'beginner';
    return 'working';
  }

  function timeOf(track) {
    var f = api.normalizeSearchText(track.format || '');
    if (/чек|решен|калькулятор|gate|микро/.test(f)) return 10;
    if (/сообщен|практик|реплик|сценари/.test(f)) return 15;
    if (/конструктор|план|карт|диагност|crm/.test(f)) return 25;
    return 20;
  }

  function deriveMeta(track) {
    var cacheKey = track.trackId + '\n' + track.title + '\n' + track.situation + '\n' + track.format;
    if (metaCache[cacheKey]) return metaCache[cacheKey];
    var aliases = (TRACK_ALIASES[track.trackId] || []).concat(SECTION_ALIASES[track.sectionId] || []);
    var fmt = formatGroup(track.format);
    var meta = {
      trackId: track.trackId,
      sectionId: track.sectionId,
      fmt: fmt,
      ch: channelOf(track),
      sit: sitOf(track),
      lvl: levelOf(track),
      aliases: aliases,
      playable: !!(api.derivePassport ? api.derivePassport(track).executable : false),
      kind: api.itemKind ? api.itemKind(track) : 'track',
      time: timeOf(track),
      fields: {
        title: api.normalizeSearchText(track.title),
        situation: api.normalizeSearchText(track.situation),
        outcome: api.normalizeSearchText(track.outcome),
        module: api.normalizeSearchText(track.module),
        format: api.normalizeSearchText(track.format),
        aliases: api.normalizeSearchText(aliases.join(' ')),
        section: api.normalizeSearchText(track.sectionId + ' ' + (SECTION_ALIASES[track.sectionId] || []).join(' ')),
        id: api.normalizeSearchText(track.trackId),
      },
    };
    if (api.searchFields) {
      var extra = api.searchFields(track);
      meta.fields.trigger = extra.trigger;
      meta.fields.inputState = extra.inputState;
      meta.fields.targetState = extra.targetState;
      meta.fields.mainTask = extra.mainTask;
      meta.fields.mechanic = extra.mechanic;
      meta.fields.artifact = extra.artifact;
      meta.fields.evidence = extra.evidence;
    }
    metaCache[cacheKey] = meta;
    return meta;
  }

  function emptyWhy() {
    return { literal: [], situation: [], intent: [] };
  }

  function pushWhy(why, bucket, text) {
    if (!text || !why || !why[bucket]) return;
    if (why[bucket].indexOf(text) !== -1) return;
    if (why[bucket].length >= 3) return;
    why[bucket].push(text);
  }

  function whyList(why) {
    if (!why) return [];
    if (Array.isArray(why)) return why;
    return (why.literal || []).concat(why.situation || []).concat(why.intent || []);
  }

  function queryHasWrite(analysis) {
    var blob = (analysis.norm || '') + ' ' + (analysis.useful || []).join(' ');
    return /написа|сообщен|переписк|текст/.test(blob);
  }

  function queryHasCall(analysis) {
    return /позвон|звонок|телефон/.test(analysis.norm || '');
  }

  function queryMentions(analysis, text) {
    var hay = ' ' + (analysis.norm || '') + ' ' + (analysis.useful || []).join(' ') + ' ';
    var parts = String(text || '').split(' ').filter(Boolean);
    if (!parts.length) return false;
    for (var i = 0; i < parts.length; i += 1) {
      if (hay.indexOf(' ' + parts[i] + ' ') === -1) return false;
    }
    return true;
  }

  function scoreTrack(track, analysis, mode) {
    if (!analysis || analysis.kind !== 'ok' || !analysis.useful.length) return { score: 0, why: emptyWhy() };
    var meta = deriveMeta(track);
    var fields = meta.fields;
    var queryNorm = analysis.norm;
    var score = 0;
    var why = emptyWhy();
    var matchedUseful = 0;
    if (queryNorm && fields.title === queryNorm) score += FIELD_WEIGHTS.titleExact;

    for (var i = 0; i < analysis.useful.length; i += 1) {
      var token = analysis.useful[i];
      var variants = expandToken(token);
      var hits = 0;
      if (fieldHas(fields.title, variants)) {
        score += FIELD_WEIGHTS.title;
        hits += 1;
        if (queryMentions(analysis, token)) pushWhy(why, 'literal', token);
      }
      if (fieldHas(fields.situation, variants)) {
        score += FIELD_WEIGHTS.situation;
        hits += 1;
        if (queryMentions(analysis, token)) pushWhy(why, 'literal', token);
      }
      if (fieldHas(fields.aliases, variants)) {
        score += FIELD_WEIGHTS.aliases;
        hits += 1;
        if (queryMentions(analysis, token)) pushWhy(why, 'literal', token);
      }
      if (fieldHas(fields.outcome, variants)) {
        score += FIELD_WEIGHTS.outcome;
        hits += 1;
      }
      if (fieldHas(fields.module, variants) || fieldHas(fields.format, variants)) {
        score += FIELD_WEIGHTS.format;
        hits += 1;
      }
      if (fieldHas(fields.mechanic, variants) || fieldHas(fields.artifact, variants) || fieldHas(fields.evidence, variants)) {
        score += FIELD_WEIGHTS.mechanic || 18;
        hits += 1;
      }
      if (fieldHas(fields.mainTask, variants) && !fieldHas(fields.title, variants)) {
        score += FIELD_WEIGHTS.mainTask || 40;
        hits += 1;
      }
      if (fieldHas(fields.section, variants)) {
        score += FIELD_WEIGHTS.section;
        hits += 1;
      }
      if (fieldHas(fields.id, variants)) {
        score += FIELD_WEIGHTS.id;
        hits += 1;
        pushWhy(why, 'literal', track.trackId);
      }
      if (hits) matchedUseful += 1;
      if (hits > 1) score += FIELD_WEIGHTS.multi * (hits - 1);
    }

    if (queryNorm.length >= 8) {
      if (fields.title.indexOf(queryNorm) !== -1) {
        score += FIELD_WEIGHTS.phrase * 2;
      } else if (fields.situation.indexOf(queryNorm) !== -1) {
        score += FIELD_WEIGHTS.phrase * 1.6;
      } else if (fields.aliases.indexOf(queryNorm) !== -1) {
        score += FIELD_WEIGHTS.phrase;
      }
    }
    var parts = queryNorm.split(' ');
    if (parts.length >= 2) {
      for (var p = 0; p < parts.length - 1; p += 1) {
        var gram = parts[p] + ' ' + parts[p + 1];
        if (gram.length < 7) continue;
        if (fields.situation.indexOf(gram) !== -1) {
          score += FIELD_WEIGHTS.phrase;
          if (queryMentions(analysis, gram)) pushWhy(why, 'literal', gram);
        } else if (fields.title.indexOf(gram) !== -1 || fields.aliases.indexOf(gram) !== -1) {
          score += Math.floor(FIELD_WEIGHTS.phrase * 0.7);
          if (queryMentions(analysis, gram)) pushWhy(why, 'literal', gram);
        }
      }
    }

    var writeQ = queryHasWrite(analysis);
    var callQ = queryHasCall(analysis);
    var whoWrite = writeQ && /кому/.test(queryNorm);
    if (writeQ && !callQ && !whoWrite) {
      if (meta.ch === 'call' && fields.title.indexOf('написа') === -1 && fields.aliases.indexOf('первое сообщение') === -1) {
        score -= 140;
      }
      if (fields.title.indexOf('написа') !== -1 || fields.aliases.indexOf('первое сообщение') !== -1) {
        score += 70;
      }
    }
    if (callQ && !writeQ) {
      if (meta.ch === 'call' || /звон|телефон|позвон/.test(fields.title + ' ' + fields.aliases)) score += 80;
    }
    if (whoWrite && track.sectionId === 'A2') score += 90;
    if (whoWrite && track.sectionId === 'A3') score -= 40;

    var intents = analysis.intents || [];
    var intentHit = false;
    for (var n = 0; n < intents.length; n += 1) {
      var intent = intents[n];
      if (whoWrite && intent.id === 'first-write') continue;
      if (intent.boostIds.indexOf(track.trackId) !== -1) {
        var boostIndex = intent.boostIds.indexOf(track.trackId);
        score += FIELD_WEIGHTS.intent + Math.max(0, 48 - n * 8) + Math.max(0, 32 - boostIndex * 8);
        intentHit = true;
        for (var w = 0; w < intent.why.length; w += 1) pushWhy(why, 'situation', intent.why[w]);
        pushWhy(why, 'intent', intent.goal || intent.why[0] || intent.id);
      } else if (intent.teamOnly && track.sectionId === 'A6' && intent.boostIds.indexOf(track.trackId) === -1) {
        score -= 80;
      } else if (intent.writeBias && meta.ch === 'call') {
        score -= 90;
      }
    }
    if (/боюсь|страш|стыд|неловк/.test(queryNorm) && /боюсь|страш|стыд|неловк|навяз/.test(fields.situation + ' ' + fields.aliases)) {
      score += FIELD_WEIGHTS.emotion;
    }
    for (var si = 0; si < intents.length; si += 1) {
      if (intents[si].id === 'silent-message' && intents[si].boostIds.indexOf(track.trackId) === -1) {
        score -= 200;
      }
    }

    var negated = analysis.negated || [];
    if (negated.length) {
      var negBlob = fields.title + ' ' + fields.situation + ' ' + fields.aliases;
      for (var ng = 0; ng < negated.length; ng += 1) {
        if (negated[ng].length >= 4 && negBlob.indexOf(negated[ng]) !== -1) {
          score -= 180;
        }
      }
    }

    if (matchedUseful && analysis.useful.length) {
      score = Math.floor(score * (0.55 + 0.45 * (matchedUseful / analysis.useful.length)));
    }
    if (!intentHit && matchedUseful === 0) return { score: 0, why: emptyWhy() };
    if (!intentHit && matchedUseful === 1 && analysis.useful.length >= 2 && score < 140) {
      return { score: 0, why: emptyWhy() };
    }
    if (!intentHit && matchedUseful === 1 && analysis.useful.length >= 4 && score < MIN_HIT * 2) {
      score = Math.floor(score * 0.5);
    }
    if (score < MIN_HIT && !intentHit) return { score: 0, why: emptyWhy() };
    if (mode === 'soft' && score > 0) return { score: score, why: why };
    return { score: score, why: why };
  }

  function getPreset(id) {
    for (var i = 0; i < PRESETS.length; i += 1) {
      if (PRESETS[i].id === id) return PRESETS[i];
    }
    return null;
  }

  function getGoal(id) {
    for (var i = 0; i < GOALS.length; i += 1) {
      if (GOALS[i].id === id) return GOALS[i];
    }
    return null;
  }

  function getSituation(id) {
    for (var i = 0; i < SIT_FILTERS.length; i += 1) {
      if (SIT_FILTERS[i].id === id) return SIT_FILTERS[i];
    }
    return null;
  }

  function getExperience(id) {
    for (var i = 0; i < EXPERIENCE.length; i += 1) {
      if (EXPERIENCE[i].id === id) return EXPERIENCE[i];
    }
    return null;
  }

  function splitCsv(value) {
    if (!value) return [];
    return String(value)
      .split(',')
      .map(function (item) { return item.trim(); })
      .filter(Boolean);
  }

  function emptyLibraryState() {
    return {
      q: '',
      stage: null,
      stages: [],
      goal: null,
      situation: null,
      sit: [],
      type: null,
      format: null,
      fmt: [],
      ch: [],
      lvl: [],
      avail: null,
      skill: null,
      experience: null,
      time: null,
      sort: null,
      preset: null,
    };
  }

  function parseLibraryState(search, extra) {
    extra = extra || {};
    var params;
    try {
      params = typeof search === 'string' ? new URLSearchParams(search.replace(/^\?/, '')) : new URLSearchParams();
    } catch (err) {
      params = new URLSearchParams();
    }
    var state = emptyLibraryState();
    var q = (params.get('q') || extra.q || '').trim();
    if (q) state.q = q;
    var stageRaw = params.get('stage') || params.get('section') || extra.stage || '';
    var stages = splitCsv(stageRaw).map(function (item) { return api.normalizeSectionId(item); }).filter(Boolean);
    if (stages.length === 1) state.stage = stages[0];
    if (stages.length) state.stages = stages;
    var goal = params.get('goal') || extra.goal || '';
    if (goal && getGoal(goal)) state.goal = goal;
    var situation = params.get('situation') || extra.situation || '';
    var sit = splitCsv(params.get('sit') || situation);
    if (sit.length) {
      state.sit = sit.filter(function (id) { return !!getSituation(id); });
      if (state.sit.length === 1) state.situation = state.sit[0];
    }
    var type = params.get('type') || extra.type || '';
    if (type) state.type = type;
    var format = params.get('format') || extra.format || '';
    var fmt = splitCsv(params.get('fmt') || format);
    if (fmt.length) state.fmt = fmt;
    if (format && fmt.length === 0) state.format = format;
    var ch = splitCsv(params.get('ch') || '');
    if (ch.length) state.ch = ch;
    var lvl = splitCsv(params.get('lvl') || '');
    if (lvl.length) state.lvl = lvl;
    var avail = params.get('avail') || extra.avail || '';
    if (avail && (avail === 'description' || avail === 'playable')) state.avail = avail;
    var skill = params.get('skill') || extra.skill || '';
    if (skill) state.skill = skill;
    var experience = params.get('experience') || extra.experience || '';
    if (experience && getExperience(experience)) {
      state.experience = experience;
      var exp = getExperience(experience);
      if (exp.level && state.lvl.indexOf(exp.level) === -1) state.lvl.push(exp.level);
    }
    var time = params.get('time') || extra.time || '';
    if (time && (time === '10' || time === '20' || time === '30')) state.time = time;
    var sort = params.get('sort') || extra.sort || '';
    if (sort && sort !== 'relevance') state.sort = sort;
    var preset = params.get('preset') || extra.preset || '';
    if (preset && getPreset(preset)) state.preset = preset;
    return state;
  }

  function serializeLibraryState(state) {
    state = state || emptyLibraryState();
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    var stages = state.stages && state.stages.length ? state.stages : (state.stage ? [state.stage] : []);
    if (stages.length) params.set('stage', stages.map(function (id) { return String(id).toLowerCase(); }).join(','));
    if (state.goal) params.set('goal', state.goal);
    if (state.sit && state.sit.length) params.set('sit', state.sit.join(','));
    else if (state.situation) params.set('situation', state.situation);
    if (state.type) params.set('type', state.type);
    if (state.fmt && state.fmt.length) params.set('fmt', state.fmt.join(','));
    else if (state.format) params.set('format', state.format);
    if (state.ch && state.ch.length) params.set('ch', state.ch.join(','));
    if (state.lvl && state.lvl.length) params.set('lvl', state.lvl.join(','));
    if (state.avail) params.set('avail', state.avail);
    if (state.skill) params.set('skill', state.skill);
    if (state.experience) params.set('experience', state.experience);
    if (state.time) params.set('time', state.time);
    if (state.sort && state.sort !== 'relevance') params.set('sort', state.sort);
    if (state.preset) params.set('preset', state.preset);
    return params.toString();
  }

  function libraryHref(state) {
    var qs = serializeLibraryState(state);
    return qs ? '/library?' + qs : '/library';
  }

  function hasActiveFilters(state) {
    if (!state) return false;
    return !!(
      state.q ||
      state.stage ||
      (state.stages && state.stages.length) ||
      state.goal ||
      state.situation ||
      (state.sit && state.sit.length) ||
      (state.type && state.type !== 'track') ||
      state.format ||
      (state.fmt && state.fmt.length) ||
      (state.ch && state.ch.length) ||
      (state.lvl && state.lvl.length) ||
      state.avail ||
      state.skill ||
      state.experience ||
      state.time ||
      state.preset
    );
  }

  function inGroup(values, value) {
    if (!values || !values.length) return true;
    return values.indexOf(value) !== -1;
  }

  function applyFacets(tracks, state) {
    state = state || emptyLibraryState();
    var preset = state.preset ? getPreset(state.preset) : null;
    var allowed = null;
    if (preset && preset.trackIds && preset.trackIds.length) {
      allowed = {};
      for (var a = 0; a < preset.trackIds.length; a += 1) allowed[preset.trackIds[a]] = true;
    }
    var stages = state.stages && state.stages.length ? state.stages : (state.stage ? [state.stage] : []);
    var sit = state.sit && state.sit.length ? state.sit : (state.situation ? [state.situation] : []);
    var fmt = state.fmt && state.fmt.length ? state.fmt : [];
    var out = [];
    for (var i = 0; i < tracks.length; i += 1) {
      var track = tracks[i];
      if (allowed && !allowed[track.trackId]) continue;
      var meta = deriveMeta(track);
      if (state.type === 'material' && meta.kind !== 'material') continue;
      if (state.type === 'track' && meta.kind === 'material') continue;
      if (stages.length && stages.indexOf(track.sectionId) === -1) continue;
      if (sit.length && sit.indexOf(meta.sit) === -1) continue;
      if (fmt.length && fmt.indexOf(meta.fmt) === -1) continue;
      if (state.format && track.format !== state.format && fmt.length === 0) continue;
      if (!inGroup(state.ch, meta.ch)) continue;
      if (!inGroup(state.lvl, meta.lvl)) continue;
      if (state.goal && GOAL_SECTIONS[state.goal] && GOAL_SECTIONS[state.goal].indexOf(track.sectionId) === -1) continue;
      if (state.time === '10' && meta.time > 10) continue;
      if (state.time === '20' && meta.time > 20) continue;
      if (state.time === '30' && meta.time < 20) continue;
      if (state.avail === 'playable' && !meta.playable) continue;
      if (state.avail === 'description' && meta.playable) continue;
      if (state.skill) {
        var skillNeedle = api.normalizeSearchText(state.skill);
        if (!skillNeedle || (meta.fields.format + ' ' + meta.fields.situation + ' ' + meta.fields.title).indexOf(skillNeedle) === -1) continue;
      }
      out.push(track);
    }
    return out;
  }

  function rankTracks(tracks, analysis, sort, mode) {
    if (!analysis || analysis.kind !== 'ok' || !analysis.useful.length) {
      var copy = tracks.slice();
      if (sort === 'title') {
        copy.sort(function (a, b) {
          return a.title.localeCompare(b.title, 'ru');
        });
      }
      return copy.map(function (track) {
        return { track: track, score: 0, why: emptyWhy() };
      });
    }
    var scored = [];
    for (var i = 0; i < tracks.length; i += 1) {
      var result = scoreTrack(tracks[i], analysis, mode);
      if (result.score > 0) scored.push({ track: tracks[i], score: result.score, why: result.why });
    }
    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.track.trackId.localeCompare(b.track.trackId);
    });
    return scored;
  }

  function chipLabel(key, value) {
    if (key === 'q') return '«' + value + '»';
    if (key === 'stage' || key === 'stages') return value;
    if (key === 'goal') {
      var goal = getGoal(value);
      return goal ? goal.title : value;
    }
    if (key === 'situation' || key === 'sit') {
      var sit = getSituation(value);
      return sit ? sit.title : value;
    }
    if (key === 'type') return value === 'material' ? 'Материал' : 'Трек';
    if (key === 'format') return value;
    if (key === 'fmt') {
      for (var f = 0; f < FMT_FILTERS.length; f += 1) if (FMT_FILTERS[f].id === value) return FMT_FILTERS[f].title;
      return value;
    }
    if (key === 'ch') {
      for (var c = 0; c < CH_FILTERS.length; c += 1) if (CH_FILTERS[c].id === value) return CH_FILTERS[c].title;
      return value;
    }
    if (key === 'lvl') {
      for (var l = 0; l < LVL_FILTERS.length; l += 1) if (LVL_FILTERS[l].id === value) return LVL_FILTERS[l].title;
      return value;
    }
    if (key === 'avail') {
      for (var a = 0; a < AVAIL_FILTERS.length; a += 1) if (AVAIL_FILTERS[a].id === value) return AVAIL_FILTERS[a].title;
      return value;
    }
    if (key === 'experience') {
      var exp = getExperience(value);
      return exp ? exp.title : value;
    }
    if (key === 'time') {
      for (var tm = 0; tm < TIME_FILTERS.length; tm += 1) if (TIME_FILTERS[tm].id === value) return TIME_FILTERS[tm].title;
      return value;
    }
    if (key === 'preset') {
      var preset = getPreset(value);
      return preset ? preset.title : value;
    }
    return String(value);
  }

  function pushChip(chips, key, value) {
    if (!value) return;
    chips.push({ key: key, value: value, label: chipLabel(key, value) });
  }

  function buildChips(state) {
    var chips = [];
    if (state.q) pushChip(chips, 'q', state.q);
    var stages = state.stages && state.stages.length ? state.stages : (state.stage ? [state.stage] : []);
    for (var s = 0; s < stages.length; s += 1) pushChip(chips, 'stage', stages[s]);
    if (state.goal) pushChip(chips, 'goal', state.goal);
    var sit = state.sit && state.sit.length ? state.sit : (state.situation ? [state.situation] : []);
    for (var i = 0; i < sit.length; i += 1) pushChip(chips, 'sit', sit[i]);
    if (state.type && state.type !== 'all') pushChip(chips, 'type', state.type);
    if (state.fmt && state.fmt.length) {
      for (var f = 0; f < state.fmt.length; f += 1) pushChip(chips, 'fmt', state.fmt[f]);
    } else if (state.format) pushChip(chips, 'format', state.format);
    if (state.ch) for (var c = 0; c < state.ch.length; c += 1) pushChip(chips, 'ch', state.ch[c]);
    if (state.lvl) for (var l = 0; l < state.lvl.length; l += 1) pushChip(chips, 'lvl', state.lvl[l]);
    if (state.avail) pushChip(chips, 'avail', state.avail);
    if (state.experience) pushChip(chips, 'experience', state.experience);
    if (state.time) pushChip(chips, 'time', state.time);
    if (state.preset) pushChip(chips, 'preset', state.preset);
    return chips;
  }

  function foundLabel(count, total, state) {
    var filtered = hasActiveFilters(state);
    if (!filtered && count === total) return 'Показаны все ' + total + ' ' + api.pluralTracks(total);
    if (state.preset && !state.q && (!state.stage && !(state.sit && state.sit.length))) {
      return 'В этой подборке ' + count + ' ' + api.pluralTracks(count);
    }
    var verb = count % 10 === 1 && count % 100 !== 11 ? 'Найден' : 'Найдено';
    return verb + ' ' + count + ' ' + api.pluralTracks(count) + ' из ' + total;
  }

  function relaxOrder() {
    return ['avail', 'fmt', 'ch', 'lvl', 'sit', 'experience', 'stage', 'preset', 'q'];
  }

  function clearKey(state, key) {
    var next = Object.assign({}, state);
    if (key === 'q') next.q = '';
    else if (key === 'stage') {
      next.stage = null;
      next.stages = [];
    } else if (key === 'sit') {
      next.sit = [];
      next.situation = null;
    } else if (key === 'fmt') {
      next.fmt = [];
      next.format = null;
    } else if (key === 'ch') next.ch = [];
    else if (key === 'lvl') next.lvl = [];
    else next[key] = null;
    if (key !== 'q') next.preset = key === 'preset' ? null : next.preset;
    return next;
  }

  function relaxSearch(tracks, state, analysis) {
    var order = relaxOrder();
    for (var i = 0; i < order.length; i += 1) {
      var key = order[i];
      var active = key === 'q' ? state.q : key === 'stage' ? state.stage || (state.stages && state.stages.length) : key === 'sit' ? (state.sit && state.sit.length) || state.situation : key === 'fmt' ? (state.fmt && state.fmt.length) || state.format : Array.isArray(state[key]) ? state[key].length : state[key];
      if (!active) continue;
      var next = clearKey(state, key);
      var faceted = applyFacets(tracks, next);
      var ranked = rankTracks(faceted, next.q ? analysis : { kind: 'ok', useful: [] }, next.sort, 'soft');
      var closeHits = [];
      for (var r = 0; r < ranked.length && closeHits.length < 6; r += 1) {
        if (next.q && ranked[r].score < MIN_CLOSE) continue;
        if (!next.q) break;
        closeHits.push(ranked[r]);
      }
      if (closeHits.length) {
        return { key: key, items: closeHits.map(function (row) { return row.track; }), close: closeHits };
      }
    }
    var fallback = rankTracks(tracks, analysis && analysis.useful && analysis.useful.length ? analysis : { kind: 'ok', useful: [] }, state.sort, 'soft');
    var close = [];
    for (var c = 0; c < fallback.length && close.length < 6; c += 1) {
      if (fallback[c].score >= MIN_CLOSE) close.push(fallback[c]);
    }
    return { key: 'all', items: close.map(function (row) { return row.track; }), close: close };
  }

  api.analyzeQuery = analyzeQuery;
  api.parseLibraryState = parseLibraryState;
  api.serializeLibraryState = serializeLibraryState;
  api.libraryHref = libraryHref;
  api.emptyLibraryState = emptyLibraryState;
  api.getPreset = getPreset;
  api.getGoal = getGoal;
  api.getSituation = getSituation;
  api.getExperience = getExperience;
  api.buildChips = buildChips;
  api.hasActiveFilters = hasActiveFilters;
  api.deriveMeta = deriveMeta;
  api.foundLabel = foundLabel;
  api.clearFilterKey = clearKey;
  api.rankTracks = rankTracks;
  api.whyList = whyList;
  api.humanWhy = humanWhy;
  api.emptyWhy = emptyWhy;
  api.defaultClarify = defaultClarify;
  api.applyFacets = applyFacets;
  api.relaxSearch = relaxSearch;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);

/* __MLMA_UI_SPLIT__ */
(function (root) {
  'use strict';
  var api = root.MLMA;
  if (!api) return;
  var TRACK_ALIASES = api.TRACK_ALIASES;
  var CANDIDATE_LIMIT = 20;
  var deriveMeta = api.deriveMeta;
  var rankTracks = api.rankTracks;
  var analyzeQuery = api.analyzeQuery;
  var applyFacets = api.applyFacets;
  var emptyLibraryState = api.emptyLibraryState;
  var buildChips = api.buildChips;
  var foundLabel = api.foundLabel;
  var hasActiveFilters = api.hasActiveFilters;
  var parseLibraryState = api.parseLibraryState;
  var emptyWhy = api.emptyWhy;
  var humanWhy = api.humanWhy;
  var defaultClarify = api.defaultClarify;

  function tracksById(tracks) {
    var map = {};
    for (var i = 0; i < tracks.length; i += 1) map[tracks[i].trackId] = tracks[i];
    return map;
  }

  function searchDocument(track) {
    var aliases = (TRACK_ALIASES[track.trackId] || []).slice();
    var meta = deriveMeta ? deriveMeta(track) : null;
    if (meta && meta.aliases && meta.aliases.length) aliases = meta.aliases.slice();
    var fields = api.searchFields ? api.searchFields(track) : null;
    return {
      trackId: track.trackId,
      title: track.title || '',
      situations: [track.situation || ''].filter(Boolean),
      goals: [track.outcome || ''].filter(Boolean),
      painSignals: aliases.slice(0, 12),
      audiences: [],
      stage: [track.sectionId || '', track.stage || ''].filter(Boolean),
      actions: [track.title || '', (fields && fields.mainTask) || ''].filter(Boolean),
      outcome: track.outcome || '',
      aliases: aliases,
      negativeSignals: [],
    };
  }

  function compactSearchRow(track) {
    var doc = searchDocument(track);
    return {
      trackId: doc.trackId,
      title: doc.title,
      situation: (doc.situations && doc.situations[0]) || '',
      result: doc.outcome,
      sectionId: track.sectionId,
      aliases: doc.aliases.slice(0, 10),
      tags: doc.aliases.slice(0, 8),
    };
  }

  function ensureIntentRows(ranked, tracks, analysis) {
    var have = {};
    for (var i = 0; i < ranked.length; i += 1) have[ranked[i].track.trackId] = true;
    var index = tracksById(tracks);
    var intents = (analysis && analysis.intents) || [];
    var extra = [];
    for (var n = 0; n < intents.length; n += 1) {
      var ids = (intents[n].featuredIds || []).concat(intents[n].boostIds || []);
      for (var k = 0; k < ids.length; k += 1) {
        if (have[ids[k]] || !index[ids[k]]) continue;
        have[ids[k]] = true;
        extra.push({
          track: index[ids[k]],
          score: 260 - k * 8,
          why: api.emptyWhy ? api.emptyWhy() : { literal: [], situation: [], intent: [intents[n].goal || ''] },
        });
      }
    }
    return extra.concat(ranked);
  }

  function mergeCandidates(ranked, tracks, analysis) {
    var seen = {};
    var out = [];
    function push(row) {
      var track = row.track || row;
      if (!track || !track.trackId || seen[track.trackId]) return;
      seen[track.trackId] = true;
      out.push(row.track ? row : { track: track, score: row.score || 0, why: row.why });
    }
    var intents = (analysis && analysis.intents) || [];
    var index = tracksById(tracks);
    for (var n = 0; n < intents.length; n += 1) {
      var ids = (intents[n].featuredIds || []).concat(intents[n].boostIds || []);
      for (var k = 0; k < ids.length; k += 1) if (index[ids[k]]) push({ track: index[ids[k]], score: 280 - k * 6 });
    }
    for (var r = 0; r < ranked.length; r += 1) push(ranked[r]);
    if (out.length < 12) {
      var sectionHint = '';
      if (intents.length && intents[0].boostIds && intents[0].boostIds[0] && index[intents[0].boostIds[0]]) {
        sectionHint = index[intents[0].boostIds[0]].sectionId;
      }
      for (var t = 0; t < tracks.length && out.length < 12; t += 1) {
        if (sectionHint && tracks[t].sectionId !== sectionHint) continue;
        push({ track: tracks[t], score: 20 });
      }
    }
    return out.slice(0, CANDIDATE_LIMIT);
  }

  function inAcademyTheme(analysis) {
    if (!analysis) return false;
    if (analysis.outOfScope) return false;
    if (analysis.adjacentScope) return true;
    if (analysis.intents && analysis.intents.length) return true;
    var blob = String(analysis.norm || '');
    return /(mlm|продаж|клиент|контакт|партн|команд|продукт|план|новичк|старт|сообщен|написа|звон|встреч|отказ|дорог|рекоменд|баз|ритм|дисципл|настав|лидер|роль|заработ|диалог|разговор|потребност|возраст|пауз|повтор|систем|порядок|хаотич|успева)/.test(blob);
  }
  var rankTracks = api.rankTracks;
  var analyzeQuery = api.analyzeQuery;
  var applyFacets = api.applyFacets;
  var emptyLibraryState = api.emptyLibraryState;
  var buildChips = api.buildChips;
  var foundLabel = api.foundLabel;
  var hasActiveFilters = api.hasActiveFilters;
  var parseLibraryState = api.parseLibraryState;
  var emptyWhy = api.emptyWhy;
  var humanWhy = api.humanWhy;
  var defaultClarify = api.defaultClarify;

  function attachWhyText(why, track, analysis, aiReason) {
    var next = why && !Array.isArray(why) ? why : emptyWhy();
    next.text = humanWhy(track, analysis, next, aiReason);
    return next;
  }

  function splitDisplay(ranked, analysis, state) {
    var featured = [];
    var other = [];
    var whyMap = {};
    var scores = {};
    var items = [];
    if (!state.q) {
      for (var b = 0; b < ranked.length; b += 1) {
        items.push(ranked[b].track);
        scores[ranked[b].track.trackId] = ranked[b].score;
      }
      return { items: items, featured: [], other: items, whyMap: whyMap, scores: scores };
    }
    var intents = (analysis && analysis.intents) || [];
    var boost = {};
    var teamOnly = false;
    var featuredIds = [];
    for (var n = 0; n < intents.length; n += 1) {
      if (intents[n].teamOnly) teamOnly = true;
      var ids = intents[n].boostIds || [];
      for (var k = 0; k < ids.length; k += 1) boost[ids[k]] = true;
      if (!featuredIds.length && intents[n].featuredIds && intents[n].featuredIds.length) {
        featuredIds = intents[n].featuredIds.slice();
      }
    }
    var byId = {};
    for (var b = 0; b < ranked.length; b += 1) byId[ranked[b].track.trackId] = ranked[b];
    if (featuredIds.length) {
      for (var fi = 0; fi < featuredIds.length && featured.length < 3; fi += 1) {
        var forced = byId[featuredIds[fi]];
        if (!forced) continue;
        featured.push(forced.track);
        scores[forced.track.trackId] = forced.score;
        whyMap[forced.track.trackId] = attachWhyText(forced.why, forced.track, analysis);
      }
    }
    var strong = [];
    var relax = !!(state && state._relaxInFilter);
    for (var i = 0; i < ranked.length; i += 1) {
      var row = ranked[i];
      var id = row.track.trackId;
      var meta = deriveMeta(row.track);
      if (teamOnly && !boost[id] && meta.sit !== 'team' && !relax) continue;
      if (intents.length && !boost[id] && row.score < (relax ? 70 : 220)) continue;
      if (!intents.length && row.score < 70) continue;
      strong.push(row);
    }
    for (var f = 0; f < strong.length && featured.length < 3; f += 1) {
      var minFeat = boost[strong[f].track.trackId] ? 80 : 100;
      if (strong[f].score < minFeat) continue;
      if (featured.indexOf(strong[f].track) !== -1) continue;
      featured.push(strong[f].track);
      scores[strong[f].track.trackId] = strong[f].score;
      whyMap[strong[f].track.trackId] = attachWhyText(strong[f].why, strong[f].track, analysis);
    }
    for (var r = 0; r < strong.length && other.length < 5; r += 1) {
      var rel = strong[r];
      if (featured.indexOf(rel.track) !== -1) continue;
      var minRel = boost[rel.track.trackId] ? 60 : 80;
      if (rel.score < minRel) continue;
      other.push(rel.track);
      scores[rel.track.trackId] = rel.score;
      whyMap[rel.track.trackId] = attachWhyText(rel.why, rel.track, analysis);
    }
    items = featured.concat(other);
    return { items: items, featured: featured, other: other, whyMap: whyMap, scores: scores };
  }

  function searchCatalog(tracks, state) {
    state = state || emptyLibraryState();
    var analysis = analyzeQuery(state.q || '');
    var chips = buildChips(state);
    if (state.q && analysis.kind === 'need_more') {
      var more = defaultClarify();
      return { kind: 'need_more', items: [], featured: [], other: [], whyMap: {}, analysis: analysis, chips: chips, relaxedKey: null, close: [], total: tracks.length, label: 'Нужна более конкретная формулировка', clarifyingQuestion: more.question, clarifyingOptions: more.options, source: 'local' };
    }
    if (state.q && analysis.outOfScope) {
      return {
        kind: 'zero',
        items: [],
        featured: [],
        other: [],
        whyMap: {},
        scores: {},
        analysis: analysis,
        chips: chips,
        relaxedKey: null,
        close: [],
        candidates: [],
        clarifyingQuestion: analysis.outOfScope.question,
        clarifyingOptions: analysis.outOfScope.options || defaultClarify().options,
        source: 'local',
        total: tracks.length,
        matchType: 'out_of_scope',
        label: 'Точного трека пока нет',
      };
    }
    var index = tracksById(tracks);
    if (state.q && analysis.adjacentScope && analysis.adjacentScope.trackIds) {
      var adj = analysis.adjacentScope;
      var featuredAdj = [];
      var whyAdj = {};
      for (var a = 0; a < adj.trackIds.length && featuredAdj.length < 3; a += 1) {
        if (!index[adj.trackIds[a]]) continue;
        featuredAdj.push(index[adj.trackIds[a]]);
        whyAdj[adj.trackIds[a]] = attachWhyText(emptyWhy(), index[adj.trackIds[a]], analysis, adj.reason);
      }
      var adjCandidates = mergeCandidates(
        featuredAdj.map(function (track) { return { track: track, score: 200, why: emptyWhy() }; }),
        tracks,
        analysis,
      );
      return {
        kind: 'ok',
        items: featuredAdj,
        featured: featuredAdj,
        other: [],
        whyMap: whyAdj,
        scores: {},
        analysis: analysis,
        chips: chips,
        relaxedKey: null,
        close: [],
        candidates: adjCandidates,
        clarifyingQuestion: adj.question,
        clarifyingOptions: adj.options || [],
        source: 'local',
        total: tracks.length,
        matchType: 'adjacent',
        label: 'Можно начать с этих треков',
        expandCatalog: true,
      };
    }
    var faceted = applyFacets(tracks, state);
    var ranked = ensureIntentRows(rankTracks(faceted, analysis, state.sort), faceted, analysis);
    var candidatePool = faceted.length ? faceted : tracks;
    var candidates = mergeCandidates(ranked, candidatePool, analysis);
    if (inAcademyTheme(analysis) && !candidates.length) {
      candidates = tracks.slice(0, CANDIDATE_LIMIT).map(function (track) {
        return { track: track, score: 1, why: emptyWhy() };
      });
    }
    var split = splitDisplay(ranked, analysis, state);
    if (!state.q) {
      return {
        kind: 'ok',
        items: split.items,
        featured: [],
        other: split.other,
        whyMap: {},
        scores: split.scores,
        analysis: analysis,
        chips: chips,
        relaxedKey: null,
        close: [],
        candidates: [],
        clarifyingQuestion: null,
        clarifyingOptions: [],
        source: 'local',
        total: tracks.length,
        label: foundLabel(split.items.length, tracks.length, state),
      };
    }
    if (!(split.featured.length || split.other.length) && hasActiveFilters(Object.assign({}, state, { q: '' })) && ranked.length) {
      split = splitDisplay(ranked, analysis, Object.assign({}, state, { _relaxInFilter: true }));
    }
    if (!(split.featured.length || split.other.length) && inAcademyTheme(analysis) && ranked.length) {
      split = splitDisplay(ranked, analysis, Object.assign({}, state, { _relaxInFilter: true }));
    }
    var leadIntent = (analysis.intents && analysis.intents[0]) || null;
    var matchType = leadIntent && leadIntent.matchType
      ? leadIntent.matchType
      : (split.featured.length ? 'strong' : (split.other.length ? 'adjacent' : ''));
    var clarifyQ = (leadIntent && leadIntent.clarification) || null;
    if (split.featured.length || split.other.length) {
      return {
        kind: 'ok',
        items: split.items,
        featured: split.featured,
        other: split.other,
        whyMap: split.whyMap,
        scores: split.scores,
        analysis: analysis,
        chips: chips,
        relaxedKey: null,
        close: [],
        candidates: candidates,
        clarifyingQuestion: clarifyQ,
        clarifyingOptions: [],
        source: 'local',
        total: tracks.length,
        matchType: matchType,
        label: matchType === 'adjacent' || (leadIntent && leadIntent.wide)
          ? 'Можно начать с этих треков'
          : (split.featured.length ? 'Подходит лучше всего' : 'Можно начать с этих треков'),
        expandCatalog: split.featured.length < 2,
      };
    }
    if (!hasActiveFilters(state) && !state.q) {
      return { kind: 'ok', items: [], featured: [], other: [], whyMap: {}, scores: {}, analysis: analysis, chips: chips, relaxedKey: null, close: [], candidates: [], clarifyingQuestion: null, clarifyingOptions: [], source: 'local', total: tracks.length, label: foundLabel(0, tracks.length, state) };
    }
    if (inAcademyTheme(analysis) && candidates.length) {
      var fallbackFeat = [];
      var fallbackWhy = {};
      for (var c = 0; c < candidates.length && fallbackFeat.length < 3; c += 1) {
        fallbackFeat.push(candidates[c].track);
        fallbackWhy[candidates[c].track.trackId] = attachWhyText(candidates[c].why, candidates[c].track, analysis);
      }
      return {
        kind: 'ok',
        items: fallbackFeat,
        featured: fallbackFeat,
        other: [],
        whyMap: fallbackWhy,
        scores: {},
        analysis: analysis,
        chips: chips,
        relaxedKey: null,
        close: [],
        candidates: candidates,
        clarifyingQuestion: defaultClarify().question,
        clarifyingOptions: defaultClarify().options,
        source: 'local',
        total: tracks.length,
        matchType: 'adjacent',
        label: 'Можно начать с этих треков',
        expandCatalog: true,
      };
    }
    var clarify = defaultClarify();
    return {
      kind: 'zero',
      items: [],
      featured: [],
      other: [],
      whyMap: {},
      scores: {},
      analysis: analysis,
      chips: chips,
      relaxedKey: null,
      close: [],
      candidates: candidates,
      clarifyingQuestion: clarify.question,
      clarifyingOptions: clarify.options,
      source: 'local',
      total: tracks.length,
      matchType: 'out_of_scope',
      label: 'Точного трека пока нет',
    };
  }

  function matchesQuery(track, query) {
    query = query || {};
    var state = parseLibraryState('', {
      q: query.query || query.q || '',
      stage: query.sectionId || query.stage || null,
      format: query.format || null,
      goal: query.goal || null,
      situation: query.situation || null,
    });
    if (query.availability === 'available' && track.publicationStatus !== 'published') return false;
    if (query.availability === 'preparing' && track.publicationStatus === 'published') return false;
    var result = searchCatalog([track], state);
    return result.kind === 'ok' && result.items.length > 0;
  }

  function filterTracks(tracks, query) {
    query = query || {};
    var state = parseLibraryState('', {
      q: query.query || query.q || '',
      stage: query.sectionId || query.stage || null,
      format: query.format || null,
      goal: query.goal || null,
      situation: query.situation || null,
      type: query.type || null,
      experience: query.experience || null,
    });
    var filtered = [];
    for (var i = 0; i < tracks.length; i += 1) {
      var track = tracks[i];
      if (query.availability === 'available' && track.publicationStatus !== 'published') continue;
      if (query.availability === 'preparing' && track.publicationStatus === 'published') continue;
      filtered.push(track);
    }
    var result = searchCatalog(filtered, state);
    if (result.kind === 'need_more') return [];
    return result.items;
  }

  function rerankPayload(result, query, allTracks) {
    var rows = (result && result.candidates) || [];
    var candidates = [];
    var seen = {};
    function pushTrack(track, score) {
      if (!track || !track.trackId || seen[track.trackId]) return;
      seen[track.trackId] = true;
      var doc = searchDocument(track);
      candidates.push({
        trackId: doc.trackId,
        title: doc.title,
        situation: (doc.situations && doc.situations[0]) || '',
        result: doc.outcome,
        sectionId: track.sectionId,
        aliases: doc.aliases.slice(0, 10),
        tags: doc.aliases.slice(0, 8),
        score: score || 0,
      });
    }
    for (var i = 0; i < rows.length && candidates.length < CANDIDATE_LIMIT; i += 1) {
      pushTrack(rows[i].track || rows[i], rows[i].score || 0);
    }
    var catalog = [];
    var list = allTracks || [];
    for (var t = 0; t < list.length && catalog.length < 112; t += 1) {
      catalog.push(compactSearchRow(list[t]));
    }
    var weakLocal = !candidates.length || candidates.length < 8 || (result && (result.matchType === 'adjacent' || result.expandCatalog));
    if (weakLocal && catalog.length) {
      for (var c = 0; c < catalog.length && candidates.length < CANDIDATE_LIMIT; c += 1) {
        var row = catalog[c];
        if (seen[row.trackId]) continue;
        seen[row.trackId] = true;
        candidates.push(row);
      }
    }
    return {
      query: String(query || ''),
      candidates: candidates,
      catalog: weakLocal ? catalog : undefined,
    };
  }

  function applyRerankResponse(local, data, allTracks) {
    if (!local || !data || typeof data !== 'object') return local;
    var catalog = {};
    var source = (local.candidates && local.candidates.length ? local.candidates : []).concat(
      (local.items || []).map(function (track) { return { track: track }; }),
    );
    var byId = {};
    function remember(track) {
      if (!track || !track.trackId) return;
      catalog[track.trackId] = true;
      byId[track.trackId] = track;
    }
    for (var i = 0; i < source.length; i += 1) remember(source[i].track || source[i]);
    for (var t = 0; t < (local.items || []).length; t += 1) remember(local.items[t]);
    if (allTracks && allTracks.length) {
      for (var a = 0; a < allTracks.length; a += 1) remember(allTracks[a]);
    }
    var topIn = Array.isArray(data.topMatches) ? data.topMatches : [];
    var relIn = Array.isArray(data.relatedMatches) ? data.relatedMatches : [];
    if (!topIn.length && !relIn.length && Array.isArray(data.results)) {
      topIn = data.results.slice(0, 3);
      relIn = data.results.slice(3, 8);
    }
    var confidence = Number(data.confidence);
    if (!isFinite(confidence)) confidence = topIn[0] && typeof topIn[0].confidence === 'number' ? topIn[0].confidence : 0;
    var clarify = data.clarification || data.clarifyingQuestion || null;
    var matchType = data.matchType || (confidence >= 0.7 ? 'exact' : confidence >= 0.45 ? 'strong' : confidence >= 0.2 ? 'adjacent' : 'out_of_scope');
    function take(rows, limit, minConf) {
      var out = [];
      var whyMap = {};
      for (var r = 0; r < rows.length && out.length < limit; r += 1) {
        var row = rows[r] || {};
        var id = String(row.trackId || '');
        if (!catalog[id] || !byId[id]) continue;
        if (typeof row.confidence === 'number' && row.confidence < minConf) continue;
        out.push(byId[id]);
        whyMap[id] = attachWhyText(emptyWhy(), byId[id], local.analysis, row.reason || data.reason);
      }
      return { items: out, whyMap: whyMap };
    }
    if (matchType === 'out_of_scope' && confidence < 0.2 && !topIn.length && !relIn.length) {
      var low = Object.assign({}, local);
      low.kind = 'zero';
      low.items = [];
      low.featured = [];
      low.other = [];
      low.close = [];
      low.whyMap = {};
      low.pendingAi = false;
      low.matchType = 'out_of_scope';
      low.clarifyingQuestion = clarify || (defaultClarify().question);
      low.clarifyingOptions = local.clarifyingOptions && local.clarifyingOptions.length ? local.clarifyingOptions : defaultClarify().options;
      low.source = 'ai';
      low.label = 'Точного трека пока нет';
      return low;
    }
    var wide = false;
    var intents = (local.analysis && local.analysis.intents) || [];
    for (var wi = 0; wi < intents.length; wi += 1) if (intents[wi].wide) wide = true;
    var scopedAdj = !!(local.analysis && local.analysis.adjacentScope);
    if (scopedAdj || wide) {
      matchType = 'adjacent';
      if (local.clarifyingQuestion) clarify = local.clarifyingQuestion;
    }
    function hasTrack(list, id) {
      for (var h = 0; h < list.length; h += 1) if (list[h] && list[h].trackId === id) return true;
      return false;
    }
    var minTop = confidence >= 0.7 ? 0.45 : 0.2;
    var top = take(topIn, 3, minTop);
    var related = take(relIn, 5, 0.2);
    var featured = top.items.slice();
    var other = [];
    for (var ri = 0; ri < related.items.length; ri += 1) {
      if (!hasTrack(featured, related.items[ri].trackId)) other.push(related.items[ri]);
    }
    if (!featured.length && other.length) {
      featured = other.slice(0, 3);
      other = other.slice(3);
    }
    if (scopedAdj && local.featured && local.featured.length) {
      featured = local.featured.slice(0, 3);
      other = [];
    } else if (featured.length < 3 && local.featured && local.featured.length) {
      for (var lf = 0; lf < local.featured.length && featured.length < 3; lf += 1) {
        if (hasTrack(featured, local.featured[lf].trackId)) continue;
        featured.push(local.featured[lf]);
      }
    }
    other = other.filter(function (item) { return !hasTrack(featured, item.trackId); });
    if (!featured.length && !other.length) {
      var keep = Object.assign({}, local, { pendingAi: false, source: local.source || 'local' });
      if (clarify) keep.clarifyingQuestion = clarify;
      return keep;
    }
    var whyMap = Object.assign({}, local.whyMap || {}, top.whyMap, related.whyMap);
    var label = 'Можно начать с этих треков';
    if (matchType === 'exact' || matchType === 'strong') label = 'Подходит лучше всего';
    else if (matchType === 'adjacent') label = 'Можно начать с этих треков';
    return Object.assign({}, local, {
      kind: 'ok',
      items: featured.concat(other),
      featured: featured,
      other: other,
      whyMap: whyMap,
      clarifyingQuestion: clarify || local.clarifyingQuestion || null,
      recognizedSituation: data.recognizedSituation || data.reason || '',
      source: 'ai',
      pendingAi: false,
      matchType: matchType,
      label: label,
    });
  }

  api.searchCatalog = searchCatalog;
  api.rerankPayload = rerankPayload;
  api.applyRerankResponse = applyRerankResponse;
  api.searchDocument = searchDocument;
  api.matchesQuery = matchesQuery;
  api.filterTracks = filterTracks;

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);

/* __MLMA_UI_SPLIT__ */
(function (root) {
  'use strict';
  var api = root.MLMA;
  if (!api) return;
  var SIT_FILTERS = api.SIT_FILTERS;
  var FMT_FILTERS = api.FMT_FILTERS;
  var CH_FILTERS = api.CH_FILTERS;
  var LVL_FILTERS = api.LVL_FILTERS;
  var AVAIL_FILTERS = api.AVAIL_FILTERS;
  var LIBRARY_STATE_KEY = api.LIBRARY_STATE_KEY || 'mlma.library.v1';
  var deriveMeta = api.deriveMeta;
  var analyzeQuery = api.analyzeQuery;
  var rankTracks = api.rankTracks;

  function uniqueFormats(tracks) {
    var seen = {};
    var out = [];
    for (var i = 0; i < tracks.length; i += 1) {
      var format = tracks[i].format;
      if (format && !seen[format]) {
        seen[format] = true;
        out.push(format);
      }
    }
    out.sort(function (a, b) {
      return a.localeCompare(b, 'ru');
    });
    return out;
  }

  function facetOptions(tracks) {
    var counts = { sit: {}, fmt: {}, ch: {}, lvl: {}, avail: { description: 0, playable: 0 } };
    for (var i = 0; i < tracks.length; i += 1) {
      var meta = deriveMeta(tracks[i]);
      counts.sit[meta.sit] = (counts.sit[meta.sit] || 0) + 1;
      counts.fmt[meta.fmt] = (counts.fmt[meta.fmt] || 0) + 1;
      counts.ch[meta.ch] = (counts.ch[meta.ch] || 0) + 1;
      counts.lvl[meta.lvl] = (counts.lvl[meta.lvl] || 0) + 1;
      counts.avail.description += 1;
      if (meta.playable) counts.avail.playable += 1;
    }
    function present(list, bag) {
      var out = [];
      for (var i = 0; i < list.length; i += 1) {
        if (bag[list[i].id]) out.push({ id: list[i].id, title: list[i].title, count: bag[list[i].id] });
      }
      return out;
    }
    return {
      sit: present(SIT_FILTERS, counts.sit),
      fmt: present(FMT_FILTERS, counts.fmt),
      ch: present(CH_FILTERS, counts.ch),
      lvl: present(LVL_FILTERS, counts.lvl),
      avail: AVAIL_FILTERS.filter(function (item) { return counts.avail[item.id] > 0; }).map(function (item) {
        return { id: item.id, title: item.title, count: counts.avail[item.id] };
      }),
    };
  }

  function relatedTracks(track, catalog, limit, context) {
    limit = limit || 3;
    context = context || {};
    if (!track) return [];
    var byId = {};
    for (var i = 0; i < catalog.length; i += 1) byId[catalog[i].trackId] = catalog[i];
    var out = [];
    var seen = {};
    seen[track.trackId] = true;
    var ids = (track.nextTrackIds || []).concat(track.relatedTrackIds || []);
    for (var n = 0; n < ids.length && out.length < limit; n += 1) {
      if (byId[ids[n]] && !seen[ids[n]]) {
        seen[ids[n]] = true;
        out.push(byId[ids[n]]);
      }
    }
    if (context.query) {
      var ranked = rankTracks(catalog, analyzeQuery(context.query), null, 'soft');
      for (var r = 0; r < ranked.length && out.length < limit; r += 1) {
        if (seen[ranked[r].track.trackId]) continue;
        seen[ranked[r].track.trackId] = true;
        out.push(ranked[r].track);
      }
    }
    for (var t = 0; t < catalog.length && out.length < limit; t += 1) {
      var other = catalog[t];
      if (seen[other.trackId]) continue;
      if (other.module === track.module || other.sectionId === track.sectionId) {
        seen[other.trackId] = true;
        out.push(other);
      }
    }
    return out;
  }

  function nextTrackBundle(track, catalog, context) {
    context = context || {};
    var runtime = context.runtime || (api.getRuntime ? api.getRuntime(track.trackId) : null);
    var nba = api.nextBestAction ? api.nextBestAction(track, catalog, runtime, context.profile) : null;
    var primary = nba && nba.track ? nba.track : null;
    if (!primary && track.nextTrackIds && track.nextTrackIds[0]) {
      for (var i = 0; i < catalog.length; i += 1) {
        if (catalog[i].trackId === track.nextTrackIds[0]) {
          primary = catalog[i];
          break;
        }
      }
    }
    var variants = (api.relatedContent ? api.relatedContent(track, catalog, 3) : relatedTracks(track, catalog, 4, context)).filter(function (item) {
      return !primary || item.trackId !== primary.trackId;
    }).slice(0, 3);
    return { primary: primary, variants: variants, nba: nba };
  }

  function startPicks(sectionId, level, catalog) {
    var map = {
      A1: { start: ['A1-001', 'A1-004', 'A1-010'], later: ['A1-011', 'A1-012'], other: ['A2-008'] },
      A2: { start: ['A2-008', 'A2-006', 'A2-010'], later: ['A2-001', 'A2-011'], other: ['A3-002'] },
      A3: { start: ['A3-002', 'A3-001', 'A3-016'], later: ['A3-008', 'A3-005'], other: ['A2-008'] },
      A4: { start: ['A4-001', 'A1-012', 'A1-011'], later: ['A1-013', 'A1-014'], other: ['A5-001'] },
      A5: { start: ['A5-001', 'A5-010', 'A5-009'], later: ['A5-011', 'A5-014'], other: ['A3-008'] },
      A6: { start: ['A6-001', 'A6-010', 'A6-006'], later: ['A6-011', 'A6-013'], other: ['A1-016'] },
    };
    if (level === 'mentor') {
      map.A6 = { start: ['A6-013', 'A6-011', 'A1-016'], later: ['A6-012', 'A6-010'], other: ['A1-010'] };
    }
    if (level === 'beginner' && sectionId === 'A1') {
      map.A1 = { start: ['A1-004', 'A1-006', 'A1-010'], later: ['A1-011', 'A2-008'], other: ['A1-001'] };
    }
    var spec = map[sectionId] || map.A1;
    var byId = {};
    for (var i = 0; i < catalog.length; i += 1) byId[catalog[i].trackId] = catalog[i];
    function pick(ids) {
      for (var k = 0; k < ids.length; k += 1) if (byId[ids[k]]) return byId[ids[k]];
      return null;
    }
    return {
      start: pick(spec.start),
      later: pick(spec.later),
      other: pick(spec.other),
    };
  }

  function sectionEntryTracks(sectionId, catalog) {
    var preferred = {
      A1: ['A1-001', 'A1-004', 'A1-010'],
      A2: ['A2-008', 'A2-006', 'A2-010'],
      A3: ['A3-002', 'A3-001', 'A3-016'],
      A4: ['A4-001', 'A1-012', 'A1-011'],
      A5: ['A5-001', 'A5-010', 'A5-009'],
      A6: ['A6-001', 'A6-010', 'A6-013'],
    };
    var ids = preferred[sectionId] || [];
    var byId = {};
    for (var i = 0; i < catalog.length; i += 1) byId[catalog[i].trackId] = catalog[i];
    var out = [];
    for (var n = 0; n < ids.length; n += 1) {
      if (byId[ids[n]] && (byId[ids[n]].sectionId === sectionId || sectionId === 'A4')) out.push(byId[ids[n]]);
    }
    if (out.length < 3) {
      for (var t = 0; t < catalog.length && out.length < 3; t += 1) {
        if (catalog[t].sectionId === sectionId && ids.indexOf(catalog[t].trackId) === -1) out.push(catalog[t]);
      }
    }
    return out.slice(0, 3);
  }

  function exampleQueries() {
    return [
      'Боюсь первым написать знакомому',
      'Не понимаю, с кем начать',
      'Человек сказал, что подумает',
      'Клиент купил и пропал',
      'Хочу получить первый результат',
    ];
  }

  function saveLibraryRestore(payload) {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) return;
      window.sessionStorage.setItem(LIBRARY_STATE_KEY, JSON.stringify(payload));
    } catch (err) {
      /* ignore */
    }
  }

  function readLibraryRestore() {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) return null;
      var raw = window.sessionStorage.getItem(LIBRARY_STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function trackEvent(name, payload) {
    var data = { event: name };
    if (payload) {
      var keys = Object.keys(payload);
      for (var i = 0; i < keys.length; i += 1) {
        if (payload[keys[i]] != null && payload[keys[i]] !== '') data[keys[i]] = payload[keys[i]];
      }
    }
    try {
      if (typeof window !== 'undefined') {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push(data);
      }
    } catch (err) {
      /* ignore */
    }
    return data;
  }

  function itemType(track) {
    return api.itemKind ? api.itemKind(track) : 'track';
  }

  function stagesForState(state) {
    if (state.stages && state.stages.length) return state.stages.slice();
    if (state.stage) return [state.stage];
    return [];
  }

  api.uniqueFormats = uniqueFormats;
  api.facetOptions = facetOptions;
  api.relatedTracks = relatedTracks;
  api.nextTrackBundle = nextTrackBundle;
  api.startPicks = startPicks;
  api.sectionEntryTracks = sectionEntryTracks;
  api.exampleQueries = exampleQueries;
  api.trackEvent = trackEvent;
  api.itemType = itemType;
  api.stagesForState = stagesForState;
  api.saveLibraryRestore = saveLibraryRestore;
  api.readLibraryRestore = readLibraryRestore;

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);

/* __MLMA_UI_SPLIT__ */

/**
 * Аналитика кабинета. Не отправляет пароли, карты и полные ответы.
 */
(function (root) {
  'use strict';
  var api = root.MLMA;
  if (!api) return;

  var EVENTS = [
    'signup_started',
    'signup_completed',
    'login_completed',
    'profile_completed',
    'search_submitted',
    'search_results_shown',
    'track_card_opened',
    'track_saved',
    'track_unsaved',
    'route_opened',
    'locked_track_opened',
    'checkout_started',
    'payment_succeeded',
    'payment_failed',
    'entitlement_granted',
    'track_started',
    'step_completed',
    'artifact_created',
    'track_paused',
    'track_completed',
    'next_track_opened',
    'access_expired',
    'subscription_renewed',
    'sync_error',
  ];

  var BLOCKED = /password|passwd|secret|token|card|pan|cvv|cvc|iban|artifact|answer|message_body|full_text/i;
  var CHAIN_KEY = 'mlma.search.chain.v1';

  function allowed(name) {
    return EVENTS.indexOf(name) !== -1;
  }

  function sanitize(payload) {
    var out = {};
    if (!payload || typeof payload !== 'object') return out;
    var keys = Object.keys(payload);
    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      if (BLOCKED.test(key)) continue;
      var value = payload[key];
      if (typeof value === 'string' && value.length > 180) value = value.slice(0, 180);
      if (key === 'email' && typeof value === 'string') {
        var at = value.indexOf('@');
        value = at > 1 ? value.slice(0, 1) + '***' + value.slice(at) : '***';
      }
      out[key] = value;
    }
    return out;
  }

  function chainId() {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) return '';
      var current = window.sessionStorage.getItem(CHAIN_KEY);
      if (current) return current;
      var id = 'ch_' + Date.now().toString(36);
      window.sessionStorage.setItem(CHAIN_KEY, id);
      return id;
    } catch (err) {
      return '';
    }
  }

  var previous = api.trackEvent;
  function trackEvent(name, payload) {
    var data = sanitize(payload || {});
    if (name === 'search_submitted' || name === 'search_query' || name === 'library_search') {
      data.chainId = chainId();
    } else if (data && (name === 'search_results_shown' || name === 'track_card_opened' || name === 'track_saved' || name === 'checkout_started' || name === 'track_started' || name === 'track_completed')) {
      data.chainId = data.chainId || chainId();
    }
    if (typeof previous === 'function') previous(name, data);
    else {
      try {
        if (typeof window !== 'undefined') {
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push(Object.assign({ event: name }, data));
        }
      } catch (err) {
        /* ignore */
      }
    }
    if (api.enqueueOutbox && allowed(name)) {
      api.enqueueOutbox('analytics_event', { name: name, data: data });
    }
    return data;
  }

  api.ANALYTICS_EVENTS = EVENTS;
  api.sanitizeAnalytics = sanitize;
  api.trackEvent = trackEvent;
  api.searchChainId = chainId;

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);

/* __MLMA_UI_SPLIT__ */
/**
 * Онтология и runtime трека. Справочники из библиотеки конструкций.
 * Не показывает служебные ID в пользовательском UI.
 */
(function (root) {
  'use strict';
  var api = root.MLMA;
  if (!api) return;

  var RUNTIME_KEY = 'mlma.runtime.v1';
  var INACTIVITY_MS = 36 * 60 * 60 * 1000;
  var PRESSURE_RE = /гарант\w* доход|обязательно куп|впари|развед[её]нн|дави на человека/;

  var GENRE = {
    'GEN-003': { label: 'Расследование', pattern: 'Факт → версия → проверка → заключение', accent: 'investigation' },
    'GEN-001': { label: 'Путешествие', pattern: 'Карта → точка → открытие', accent: 'expedition' },
    'GEN-008': { label: 'Создание', pattern: 'Черновик → сборка → версия', accent: 'workshop' },
    'GEN-004': { label: 'Миссия', pattern: 'Цель → этап → контроль → завершение', accent: 'mission' },
    'GEN-011': { label: 'Практика', pattern: 'Задача → действие → след', accent: 'practice' },
    'GEN-024': { label: 'Тренировка', pattern: 'Попытка → разбор → повтор', accent: 'practice' },
    'GEN-012': { label: 'Переговоры', pattern: 'Контакт → ответ → следующий шаг', accent: 'mission' },
    'GEN-010': { label: 'Эксперимент', pattern: 'Гипотеза → проба → вывод', accent: 'investigation' },
    'GEN-016': { label: 'Самопроверка', pattern: 'Состояние → выбор → фиксация', accent: 'practice' },
    'GEN-022': { label: 'Сборка системы', pattern: 'Элемент → связь → контур', accent: 'workshop' },
  };

  var TOPOLOGY = {
    linear: 'TOP-001',
    'linear-with-checkpoints': 'TOP-002',
    ladder: 'TOP-003',
    cycle: 'TOP-005',
    'retry-loop': 'TOP-006',
    branch: 'TOP-007',
    'branch-and-converge': 'TOP-008',
    'multiple-endings': 'TOP-009',
    adaptive: 'TOP-010',
    'hub-and-spoke': 'TOP-011',
    'stage-gate': 'TOP-015',
    detour: 'TOP-016',
    unlock: 'TOP-017',
    accumulation: 'TOP-018',
    'time-limited': 'TOP-019',
  };

  function fmt(track) {
    return api.normalizeSearchText(track.format || '');
  }

  function blob(track) {
    return api.normalizeSearchText([track.title, track.situation, track.outcome, track.format, track.module].join(' '));
  }

  function itemKind(track) {
    if (track && (track.type === 'material' || track.k === 'm')) return 'material';
    var f = fmt(track || {});
    if (/видео|статья|лонгрид|презентац|pdf|памятк|гайд|инструкц лекц/.test(f) && !/практик|конструктор|чек|карт|план|диагност/.test(f)) {
      return 'material';
    }
    return 'track';
  }

  function mapMechanic(track) {
    var f = fmt(track);
    var t = blob(track);
    if (/диагност|самодиагност|шкал/.test(f + ' ' + t)) return { id: 'MEC-010', name: 'Шкала самооценки' };
    if (/decision tree|развилк/.test(f)) return { id: 'MEC-009', name: 'Ветвящийся диагностический тест' };
    if (/decision gate|матриц|выбор/.test(f)) return { id: 'MEC-001', name: 'Тест с одним выбором' };
    if (/тренаж|практик реплик|микропрактик|аудио/.test(f)) return { id: 'MEC-012', name: 'Демонстрация и повтор' };
    if (/конструктор|редактор|переформулир/.test(f)) return { id: 'MEC-031', name: 'Сборка рабочего объекта' };
    if (/карт/.test(f)) return { id: 'MEC-012', name: 'Карточная сортировка' };
    if (/план|календар|crm|мини-crm/.test(f)) return { id: 'MEC-031', name: 'Сборка рабочего объекта' };
    if (/чек/.test(f)) return { id: 'MEC-003', name: 'Верно / неверно' };
    if (/калькулятор|приоритиз/.test(f)) return { id: 'MEC-025', name: 'Когнитивная работа' };
    return { id: 'MEC-007', name: 'Открытый вопрос' };
  }

  function mapGenre(track) {
    var f = fmt(track);
    var t = blob(track);
    if (/диагност|разбор|аудит/.test(f + ' ' + t)) return 'GEN-003';
    if (/эксперимент|микроэкспозиц/.test(f + ' ' + t)) return 'GEN-010';
    if (/конструктор|сборк|прототип/.test(f)) return 'GEN-008';
    if (/план|календар|маршрут|crm/.test(f + ' ' + t)) return 'GEN-004';
    if (/практик|тренаж|реплик/.test(f)) return 'GEN-024';
    if (/самодиагност|рефлекс/.test(f)) return 'GEN-016';
    if (/сообщен|звон|встреч|диалог/.test(t)) return 'GEN-012';
    return 'GEN-011';
  }

  function mapScenario(track) {
    var f = fmt(track);
    if (/диагност/.test(f)) return { id: 'SCN-015', name: 'Самодиагностика → выбор шага' };
    if (/практик|тренаж|реплик/.test(f)) return { id: 'SCN-002', name: 'Демонстрация → повтор' };
    if (/конструктор|форм/.test(f)) return { id: 'SCN-001', name: 'Объяснение → применение' };
    if (/план-факт|отклонен/.test(f + ' ' + blob(track))) return { id: 'SCN-050', name: 'План-факт → корректировка' };
    if (/план|crm/.test(f)) return { id: 'SCN-032', name: 'Приоритет → фокус' };
    if (/чек|gate/.test(f)) return { id: 'SCN-054', name: 'Чек-лист → исполнение' };
    return { id: 'SCN-051', name: 'Подготовка → действие → фиксация' };
  }

  function mapArtifact(track) {
    var f = fmt(track);
    var o = api.normalizeSearchText(track.outcome || '');
    if (/сообщен|реплик|фраз|текст/.test(f + ' ' + o)) return { id: 'ART-021', name: 'Текст сообщения' };
    if (/план|календар/.test(f + ' ' + o)) return { id: 'ART-006', name: 'План действий' };
    if (/карт/.test(f)) return { id: 'ART-013', name: 'Карта' };
    if (/решен|выбор|роль/.test(f + ' ' + o)) return { id: 'ART-001', name: 'Зафиксированное решение' };
    return { id: 'ART-003', name: 'Заполненная форма' };
  }

  function mapEvidence(track) {
    var f = fmt(track);
    if (/сообщен|реплик|практик|отправ/.test(f + ' ' + api.normalizeSearchText(track.title || ''))) {
      return { id: 'EVD-002', name: 'Короткий ответ', source: 'artifact+note', strength: 'medium' };
    }
    if (/план|карт|конструктор|форм/.test(f)) {
      return { id: 'EVD-003', name: 'Заполненная форма', source: 'artifact', strength: 'medium' };
    }
    return { id: 'EVD-002', name: 'Короткий ответ', source: 'artifact+note', strength: 'medium' };
  }

  function mapFunction(track) {
    var f = fmt(track);
    if (/диагност/.test(f)) return { id: 'FUN-010', name: 'Диагностика' };
    if (/практик|тренаж/.test(f)) return { id: 'FUN-012', name: 'Тренировка' };
    if (/конструктор|форм/.test(f)) return { id: 'FUN-014', name: 'Создание артефакта' };
    if (/план/.test(f)) return { id: 'FUN-006', name: 'Подготовка к действию' };
    if (track.sectionId === 'A3') return { id: 'FUN-007', name: 'Активация' };
    if (track.sectionId === 'A1') return { id: 'FUN-001', name: 'Ориентация' };
    return { id: 'FUN-008', name: 'Исполнение' };
  }

  function mapTopology(track) {
    var f = fmt(track);
    if (/развилк|decision tree/.test(f)) return 'TOP-007';
    if (/повторн|диагност \+/.test(f)) return 'TOP-006';
    if (/gate|чек/.test(f)) return 'TOP-015';
    if (/план-факт|ритм|привыч/.test(f + ' ' + blob(track))) return 'TOP-005';
    return 'TOP-002';
  }

  function isPerformanceTrack(track) {
    var t = blob(track);
    return /план-факт|отклонен|ритм|повторн продаж|клиентск опыт/.test(t) || track.sectionId === 'A6' && /план|crm|ритм/.test(fmt(track));
  }

  function defaultReactions() {
    return [
      { event: 'track_evidence_rejected', reaction: 'retry' },
      { event: 'track_inactive', reaction: 'hint' },
      { event: 'track_complete', reaction: 'next_track' },
      { event: 'track_retry', reaction: 'corrective_track' },
      { event: 'leader_escalation', reaction: 'escalation' },
    ];
  }

  function knownTaxonomy(id) {
    return /^(FUN|MEC|GEN|TOP|SCN|ART|EVD|CMP|FDB|BRN|CNT|SET|TON|EVT|REA)-\d{3}$/.test(id || '');
  }

  function derivePassport(track) {
    if (!track) return null;
    var kind = itemKind(track);
    var mechanic = mapMechanic(track);
    var genreId = mapGenre(track);
    var scenario = mapScenario(track);
    var artifact = mapArtifact(track);
    var evidence = mapEvidence(track);
    var fn = mapFunction(track);
    var genre = GENRE[genreId] || GENRE['GEN-011'];
    return {
      trackId: track.trackId,
      type: kind,
      status: track.publicationStatus || 'planned',
      title: track.title,
      trigger: track.situation,
      inputState: track.situation,
      targetState: track.outcome,
      mainTask: track.title,
      businessFunction: fn,
      leadingMechanic: mechanic,
      dominantGenre: genreId,
      genreLabel: genre.label,
      genrePattern: genre.pattern,
      genreAccent: genre.accent,
      setting: 'SET-001',
      tone: ['TON-005', 'TON-023'],
      topology: mapTopology(track),
      scenarioPattern: scenario,
      artifact: artifact,
      evidence: evidence,
      completionCriteria: {
        technical: 'CMP-002',
        quality: 'CMP-011',
        business: null,
      },
      feedbackRules: ['FDB-001', 'FDB-006', 'FDB-022'],
      branches: {
        success: 'BRN-001',
        error: 'BRN-007',
        inactivity: 'BRN-009',
        highResult: 'BRN-003',
        risk: 'BRN-006',
      },
      container: 'CNT-001',
      nextTrackIds: (track.nextTrackIds || []).slice(),
      relatedMaterialIds: [],
      needsContent: track.contentStatus === 'metadata_only',
      executable: kind === 'track' && !!(track.situation && track.outcome && track.title),
      class: isPerformanceTrack(track) ? 'performance' : kind,
      economicHypothesis: {
        process: isPerformanceTrack(track) ? (track.module || '') : '',
        metric: null,
        proxyMetric: null,
        expectedInfluence: null,
        measurementDesign: null,
      },
      managementReactions: defaultReactions(),
      analyticsEvents: ['track_preview_open', 'track_start', 'track_action_submitted', 'track_evidence_submitted', 'track_complete', 'track_next_recommended'],
    };
  }

  function validateTrack(track, catalog) {
    var issues = [];
    if (!track || !api.TRACK_ID_RE.test(track.trackId || '')) issues.push('broken_id');
    var passport = derivePassport(track);
    if (!passport) return { ok: false, issues: ['missing_track'], passport: null };
    var kind = passport.type;
    if (!passport.trigger) issues.push('missing_trigger');
    if (!passport.inputState) issues.push('missing_input_state');
    if (!passport.targetState) issues.push('missing_target_state');
    if (!passport.mainTask) issues.push('missing_main_task');
    if (!passport.leadingMechanic || !passport.leadingMechanic.id) issues.push('missing_mechanic');
    if (!passport.evidence || !passport.evidence.id) issues.push('missing_evidence');
    if (passport.completionCriteria && passport.completionCriteria.technical === 'view-only') issues.push('completion-by-view-only');
    if (kind === 'track' && !passport.nextTrackIds.length) issues.push('missing_next_step');
    var byId = {};
    if (Array.isArray(catalog)) {
      for (var i = 0; i < catalog.length; i += 1) byId[catalog[i].trackId] = catalog[i];
    }
    for (var n = 0; n < passport.nextTrackIds.length; n += 1) {
      if (catalog && !byId[passport.nextTrackIds[n]]) issues.push('broken_nextTrackId');
    }
    var prereq = track.prerequisiteIds || [];
    for (var p = 0; p < prereq.length; p += 1) {
      if (catalog && !byId[prereq[p]]) issues.push('broken_prerequisite');
    }
    var related = track.relatedMaterialIds || passport.relatedMaterialIds || [];
    for (var r = 0; r < related.length; r += 1) {
      if (catalog && !byId[related[r]]) issues.push('broken_material_relation');
    }
    if (!knownTaxonomy(passport.businessFunction.id)) issues.push('unknown_taxonomy_id');
    if (!knownTaxonomy(passport.leadingMechanic.id)) issues.push('unknown_taxonomy_id');
    if (!knownTaxonomy(passport.dominantGenre)) issues.push('unknown_taxonomy_id');
    if (!knownTaxonomy(passport.topology)) issues.push('unknown_taxonomy_id');
    if (!knownTaxonomy(passport.scenarioPattern.id)) issues.push('unknown_taxonomy_id');
    if (!knownTaxonomy(passport.artifact.id)) issues.push('unknown_taxonomy_id');
    if (!knownTaxonomy(passport.evidence.id)) issues.push('unknown_taxonomy_id');
    var branchValues = [passport.branches.success, passport.branches.error, passport.branches.inactivity, passport.branches.highResult, passport.branches.risk];
    var same = branchValues.every(function (id) { return id === branchValues[0]; });
    if (same) issues.push('same_result_in_all_branches');
    if (!passport.executable && kind === 'track' && track.publicationStatus === 'planned') issues.push('coming-soon-without-preview');
    if (!passport.executable && kind === 'track') issues.push('coming-soon-with-start-cta');
    if (itemKind(track) === 'track' && !track.title) issues.push('track_without_title');
    if (kind === 'track' && !track.trackId) issues.push('track_without_url');
    return { ok: issues.filter(function (code) { return code !== 'missing_next_step'; }).length === 0, issues: issues, passport: passport };
  }

  function validateCatalog(catalog) {
    var rows = [];
    var seen = {};
    var pointed = {};
    for (var i = 0; i < catalog.length; i += 1) {
      var track = catalog[i];
      if (seen[track.trackId]) rows.push({ trackId: track.trackId, issues: ['duplicate_id'] });
      seen[track.trackId] = true;
      var ids = track.nextTrackIds || [];
      for (var n = 0; n < ids.length; n += 1) pointed[ids[n]] = true;
      var result = validateTrack(track, catalog);
      var critical = result.issues.filter(function (code) {
        return code !== 'missing_next_step';
      });
      if (critical.length) rows.push({ trackId: track.trackId, issues: critical });
    }
    for (var j = 0; j < catalog.length; j += 1) {
      if (!pointed[catalog[j].trackId] && catalog[j].sectionId !== 'A1') {
        /* entry tracks may be orphans by design; only flag if also no next */
      }
    }
    return { ok: rows.length === 0, failures: rows, total: catalog.length };
  }

  function emptyRuntime(trackId) {
    return {
      trackId: trackId,
      status: 'preview',
      step: 'preview',
      attempts: 0,
      artifact: '',
      evidenceNote: '',
      evidenceDone: false,
      branch: '',
      feedback: null,
      updatedAt: '',
    };
  }

  function readRuntimeAll() {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return {};
      var raw = window.localStorage.getItem(RUNTIME_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (err) {
      return {};
    }
  }

  function writeRuntimeAll(all) {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      window.localStorage.setItem(RUNTIME_KEY, JSON.stringify(all));
    } catch (err) {
      /* ignore */
    }
  }

  function getRuntime(trackId) {
    var all = readRuntimeAll();
    return all[trackId] || emptyRuntime(trackId);
  }

  function saveRuntime(state) {
    var all = readRuntimeAll();
    state.updatedAt = new Date().toISOString();
    all[state.trackId] = state;
    writeRuntimeAll(all);
    return state;
  }

  function isInactive(state) {
    if (!state || !state.updatedAt || state.status === 'preview' || state.status === 'complete') return false;
    var then = Date.parse(state.updatedAt);
    if (!then) return false;
    return Date.now() - then > INACTIVITY_MS;
  }

  function qualityCheck(track, payload) {
    var artifact = String(payload.artifact || '').trim();
    var note = String(payload.evidenceNote || '').trim();
    var gaps = [];
    if (artifact.length < 40) gaps.push('Результат слишком короткий: опишите конкретный рабочий объект, а не намёк.');
    if (/^(готово|сделал|ок|yes|да)[.!\s]*$/i.test(artifact)) gaps.push('Самоотметка «готово» не считается доказательством.');
    if (!note || note.length < 12) gaps.push('Нет следа действия: кратко напишите, что именно зафиксировано.');
    if (/^я сделал/i.test(note) && note.length < 24) gaps.push('«Я сделал» без факта не принимается. Укажите, что создано или куда отправлено.');
    if (PRESSURE_RE.test(artifact.toLowerCase())) {
      return { branch: 'risk', gaps: ['В тексте есть давление или недопустимое обещание. Такой результат нельзя принимать.'], high: false };
    }
    var outcome = api.normalizeSearchText(track.outcome || '');
    var artNorm = api.normalizeSearchText(artifact);
    var tokens = outcome.split(' ').filter(function (w) { return w.length > 4; }).slice(0, 4);
    var hits = 0;
    for (var i = 0; i < tokens.length; i += 1) {
      if (artNorm.indexOf(tokens[i]) !== -1) hits += 1;
    }
    if (tokens.length && hits === 0) {
      gaps.push('Результат не связан с ожидаемым следом трека. Вернитесь к формулировке результата.');
    }
    if (gaps.length) return { branch: 'error', gaps: gaps, high: false };
    var high = artifact.length > 280 && /(следующ|дата|когда|кому)/.test(artNorm);
    return { branch: high ? 'highResult' : 'success', gaps: [], high: high };
  }

  function buildFeedback(track, check) {
    if (check.branch === 'risk') {
      return {
        title: 'Остановка: риск в формулировке',
        got: 'Система прочитала недопустимое обещание или давление.',
        gap: check.gaps[0],
        change: 'Уберите гарантии дохода, принуждение и чужие обещания. Оставьте только конкретное действие.',
        now: 'Исправьте текст и отправьте попытку снова.',
        retry: true,
      };
    }
    if (check.branch === 'error') {
      return {
        title: 'Пока нельзя принять результат',
        got: 'Черновик получен, но не проходит качественный порог.',
        gap: check.gaps.join(' '),
        change: 'Сделайте объект конкретным: что создано, для какой ситуации, какой следующий факт.',
        now: 'Исправьте артефакт и повторите сдачу.',
        retry: true,
      };
    }
    return {
      title: check.high ? 'Сильный результат. Можно ускорить маршрут' : 'Результат принят как рабочий след',
      got: 'Есть наблюдаемый объект и короткое подтверждение действия.',
      gap: 'Бизнес-событие вне этого трека не требуется.',
      change: 'Если позже появится внешний факт, вернитесь и дополните след.',
      now: check.high ? 'Можно перейти к следующему действию без дополнительного закрепления.' : 'Дальше — следующее лучшее действие, а не похожий материал.',
      retry: false,
    };
  }

  function startRuntime(track) {
    var state = getRuntime(track.trackId);
    state.status = 'active';
    state.step = 'action';
    state.branch = '';
    state.feedback = null;
    return saveRuntime(state);
  }

  function submitRuntime(track, payload) {
    var state = getRuntime(track.trackId);
    state.attempts += 1;
    state.artifact = String(payload.artifact || '');
    state.evidenceNote = String(payload.evidenceNote || '');
    state.evidenceDone = !!payload.evidenceDone;
    var check = qualityCheck(track, payload);
    state.branch = check.branch;
    state.feedback = buildFeedback(track, check);
    state.step = 'feedback';
    state.status = check.branch === 'success' || check.branch === 'highResult' ? 'complete' : 'retry';
    saveRuntime(state);
    return { state: state, check: check };
  }

  function retryRuntime(track) {
    var state = getRuntime(track.trackId);
    state.status = 'active';
    state.step = 'action';
    state.branch = 'error';
    return saveRuntime(state);
  }

  function nextBestAction(track, catalog, runtime, profile) {
    catalog = catalog || [];
    var byId = {};
    for (var i = 0; i < catalog.length; i += 1) byId[catalog[i].trackId] = catalog[i];
    var branch = runtime && runtime.branch;
    if (branch === 'error' || branch === 'risk') {
      if (runtime && runtime.attempts >= 2) {
        return {
          kind: 'corrective',
          reason: 'quality_gap',
          track: track,
          title: 'Повторить этот трек меньшим шагом',
          why: 'Критерий снова не пройден. Сначала закрыть разрыв, затем идти дальше.',
        };
      }
      return {
        kind: 'retry',
        reason: 'quality_gap',
        track: track,
        title: 'Повторить этот трек',
        why: 'Критерий не пройден. Сначала закрыть разрыв, затем идти дальше.',
      };
    }
    var ids = track.nextTrackIds || [];
    var goal = profile && profile.selectedSectionId;
    var picked = null;
    var reason = 'explicit_next_edge';
    for (var n = 0; n < ids.length; n += 1) {
      var cand = byId[ids[n]];
      if (!cand) continue;
      if (goal && cand.sectionId === goal) {
        picked = cand;
        reason = 'matches_profile_goal';
        break;
      }
      if (!picked) picked = cand;
    }
    if (!picked) {
      return { kind: 'section', reason: 'same_section', track: null, sectionId: track.sectionId, title: 'Вернуться в раздел', why: 'Прямого следующего трека нет.' };
    }
    if (branch === 'highResult' && ids[1] && byId[ids[1]]) {
      picked = byId[ids[1]];
      reason = 'high_result_skip';
    }
    return {
      kind: 'open_track',
      reason: reason,
      track: picked,
      title: picked.title,
      why: 'Следующее состояние после «' + track.title + '».',
    };
  }

  function relatedContent(track, catalog, limit) {
    limit = limit || 3;
    if (typeof api.relatedTracks === 'function') {
      var related = api.relatedTracks(track, catalog, limit + 3, {});
      var next = {};
      var ids = track.nextTrackIds || [];
      for (var i = 0; i < ids.length; i += 1) next[ids[i]] = true;
      var out = [];
      for (var r = 0; r < related.length && out.length < limit; r += 1) {
        if (next[related[r].trackId]) continue;
        out.push(related[r]);
      }
      return out;
    }
    return [];
  }

  function searchFields(track) {
    var p = derivePassport(track);
    return {
      trigger: api.normalizeSearchText(p.trigger),
      inputState: api.normalizeSearchText(p.inputState),
      targetState: api.normalizeSearchText(p.targetState),
      mainTask: api.normalizeSearchText(p.mainTask),
      mechanic: api.normalizeSearchText(p.leadingMechanic.name),
      artifact: api.normalizeSearchText(p.artifact.name),
      evidence: api.normalizeSearchText(p.evidence.name),
      functionName: api.normalizeSearchText(p.businessFunction.name),
    };
  }

  api.RUNTIME_KEY = RUNTIME_KEY;
  api.TOPOLOGY = TOPOLOGY;
  api.GENRE = GENRE;
  api.itemKind = itemKind;
  api.derivePassport = derivePassport;
  api.validateTrack = validateTrack;
  api.validateCatalog = validateCatalog;
  api.getRuntime = getRuntime;
  api.startRuntime = startRuntime;
  api.submitRuntime = submitRuntime;
  api.retryRuntime = retryRuntime;
  api.isInactive = isInactive;
  api.nextBestAction = nextBestAction;
  api.relatedContent = relatedContent;
  api.searchFields = searchFields;
  api.qualityCheck = qualityCheck;
  api.isPerformanceTrack = isPerformanceTrack;
  api.defaultReactions = defaultReactions;

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);