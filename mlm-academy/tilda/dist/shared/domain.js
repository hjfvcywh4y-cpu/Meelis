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

  var PROFILE_KEY = 'mlma.profile.v1';
  var PROGRESS_KEY = 'mlma.progress.v1';
  var MAX_ALTERNATIVES = 3;
  var GOAL_MAX = 240;

  var EMPTY_PROFILE = {
    selectedSectionId: null,
    currentGoal: '',
    savedTrackIds: [],
    role: 'member',
    updatedAt: '',
  };

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
      access: typeof src.access === 'string' ? src.access : 'undecided',
    };
    if (!TRACK_ID_RE.test(track.trackId)) return null;
    if (SECTION_IDS.indexOf(track.sectionId) === -1) return null;
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
    if (availability === 'available') {
      return {
        availability: availability,
        contentStatus: 'available',
        label: 'Доступен',
        cta: 'Пройти трек',
        tone: 'positive',
        canStart: true,
        showProgress: true,
        explanation: 'Трек открыт: внутри есть шаги, действие и фиксация результата.',
      };
    }
    if (availability === 'published_empty') {
      return {
        availability: availability,
        contentStatus: 'in-progress',
        label: 'Готовим',
        cta: 'Открыть описание',
        tone: 'waiting',
        canStart: false,
        showProgress: false,
        explanation: 'Описание уже можно открыть. Шаги и практика появятся здесь, как только материал будет готов.',
      };
    }
    if (availability === 'archived') {
      return {
        availability: availability,
        contentStatus: 'archived',
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
        label: 'Нужен доступ',
        cta: 'Как получить доступ',
        tone: 'muted',
        canStart: false,
        showProgress: false,
        explanation: 'Трек существует, но для него нужен доступ.',
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
      profile: function () {
        return '/profile';
      },
      access: function () {
        return '/access';
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
    membersLoginUrl: membersLoginUrl,
    siteHomeUrl: siteHomeUrl,
    b2bFromResearchUrl: b2bFromResearchUrl,
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
    сейчас: 1,
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
    новичок: ['новичку', 'новичка'],
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
    'A1-004': ['роль', 'кем быть', 'лидер', 'собрать команду'],
    'A1-006': ['зачем', 'личная причина'],
    'A1-007': ['больше зарабатывать', 'не понимаю что делать', 'наблюдаемая цель', 'желание в цель'],
    'A1-010': ['план действий', '30 дней', 'ритм', 'откладываю'],
    'A1-011': ['продуктовый фокус', 'один продукт'],
    'A1-012': ['честная карточка', 'карточка продукта'],
    'A1-013': ['вопросы и ограничения', 'что можно обещать'],
    'A1-014': ['не стыдно рекомендовать'],
    'A1-016': ['стандарт рекомендации'],
    'A2-001': ['профиль клиента', 'кому подходит', 'кому предложить', 'целевая аудитория'],
    'A2-006': ['аудит базы', 'контактов много', 'в голове', 'держу в голове', 'crm'],
    'A2-007': ['сегментация базы', 'разделить базу'],
    'A2-008': ['пять контактов', 'пять людей', 'с кем начать', 'некому писать'],
    'A2-010': ['карта теплых кругов', 'теплые круги'],
    'A2-011': ['реальные контексты', 'где искать'],
    'A3-001': ['канал', 'написать или позвонить', 'как позвонить', 'выбрать канал'],
    'A3-002': ['первое сообщение', 'написать знакомому', 'теплый контакт', 'боюсь написать', 'что написать'],
    'A3-003': ['позвонить по рекомендации', 'звонок'],
    'A3-004': ['первый звонок', 'структура звонка', 'позвонить незнакомому'],
    'A3-007': ['подготовиться к звонку', 'холодный контакт'],
    'A3-005': ['назначить разговор'],
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
    'A5-014': ['завершить отказ'],
    'A6-001': ['клиентский опыт', 'купил и пропал', 'недоволен', 'обслуживание', 'претензия'],
    'A6-002': ['границы ответственности', 'претензия', 'недоволен продуктом'],
    'A6-003': ['встроить продукт', 'клиентский опыт'],
    'A6-006': ['дата повтора', 'вернуть клиента'],
    'A6-010': ['статусы', 'следующие действия', 'crm', 'мини-crm', 'в голове'],
    'A6-011': ['рабочий ритм', 'рабочее время', 'устал', 'откладываю'],
    'A6-012': ['план из действий', 'лидер', 'команда'],
    'A6-013': ['разбор практики', 'наставничество', 'партнёры ничего не делают'],
    'A6-020': ['страх действия', 'откладываю', 'устал'],
    'A2-012': ['холодный поиск', 'незнакомым', 'холодный контакт'],
  };

  var INTENTS = [
    {
      id: 'first-write',
      goal: 'начать разговор с знакомым без давления',
      why: ['первое сообщение', 'тёплый контакт', 'страх навязаться'],
      phrases: ['боюсь написать', 'написать знакомому', 'первое сообщение', 'что написать', 'написать человеку', 'не знаю что написать', 'первым написать'],
      boostIds: ['A3-002'],
      writeBias: true,
    },
    {
      id: 'no-people',
      goal: 'найти, с кем начать работу',
      why: ['нет людей', 'база', 'пять контактов'],
      phrases: ['некому писать', 'некому', 'с кем начать', 'нет людей', 'не знаю с кем', 'нет контактов', 'не понимаю с кем'],
      boostIds: ['A2-008', 'A2-010', 'A2-006', 'A2-011', 'A2-001'],
    },
    {
      id: 'ethics',
      goal: 'предложить продукт без впаривания',
      why: ['этика', 'без впаривания', 'стыд продавать'],
      phrases: ['стыдно продавать', 'навязываться', 'впариван', 'стыдно предлагать', 'боюсь навязываться'],
      boostIds: ['A1-001'],
    },
    {
      id: 'first-result',
      goal: 'получить первый рабочий результат',
      why: ['первый результат', 'план действий', 'первые контакты'],
      phrases: ['первый результат', 'получить первый результат', 'хочу первый результат'],
      boostIds: ['A1-010', 'A2-008', 'A3-002', 'A3-016'],
    },
    {
      id: 'just-started',
      goal: 'понять роль и первые шаги',
      why: ['старт', 'роль', 'план'],
      phrases: ['только начал', 'я новичок', 'только начинаю', 'я только начал'],
      boostIds: ['A1-004', 'A1-006', 'A1-010'],
    },
    {
      id: 'claim',
      goal: 'разобрать претензию клиента',
      why: ['претензия', 'клиентский опыт', 'границы ответственности'],
      phrases: ['претензия', 'претензией', 'работа с претензией', 'жалоба'],
      boostIds: ['A6-001', 'A6-002', 'A6-003'],
    },
    {
      id: 'earn-goal',
      goal: 'перевести желание больше зарабатывать в понятные действия',
      why: ['желание в цель', 'что делать дальше', 'наблюдаемый результат'],
      phrases: ['больше зарабатывать', 'хочу больше зарабатывать', 'не понимаю что делать', 'не знаю что делать', 'хочу зарабатывать', 'не знаю что должно'],
      boostIds: ['A1-007', 'A1-010', 'A1-006', 'A1-015'],
    },
    {
      id: 'crm-head',
      goal: 'навести порядок в контактах, статусах и следующих действиях',
      why: ['аудит базы', 'crm', 'статусы и next action'],
      phrases: ['держу в голове', 'в голове', 'контактов много', 'нет системы в базе', 'crm', 'аудит базы', 'все в голове', 'всё держу в голове', 'таблицу контактов', 'вести таблицу'],
      boostIds: ['A2-006', 'A2-007', 'A6-010'],
    },
    {
      id: 'postpone',
      goal: 'вернуть рабочий ритм и перестать откладывать',
      why: ['ритм', 'план на 30 дней', 'страх действия'],
      phrases: ['все откладываю', 'всё откладываю', 'устал', 'нет сил', 'нет ритма', 'прокрастин', 'страшно начать'],
      boostIds: ['A1-010', 'A6-011', 'A6-020', 'A3-014'],
    },
    {
      id: 'cold-call',
      goal: 'выбрать канал и сделать первый звонок незнакомому',
      why: ['канал контакта', 'первый звонок', 'холодный вход'],
      phrases: ['как позвонить', 'позвонить незнакомому', 'позвонить незнакомым', 'холодный звонок', 'первый звонок', 'звонить незнакомым', 'звонить холодн', 'страшно звонить'],
      boostIds: ['A3-001', 'A3-004', 'A3-007', 'A2-012', 'A3-003'],
    },
    {
      id: 'who-offer',
      goal: 'понять, кому предлагать продукт',
      why: ['профиль клиента', 'карта людей', 'продуктовый фокус'],
      phrases: ['кому предложить', 'не понимаю кому', 'целевая аудитория', 'кому подходит продукт', 'кому предлагать'],
      boostIds: ['A2-001', 'A2-010', 'A1-011', 'A2-008'],
    },
    {
      id: 'unhappy-client',
      goal: 'разобрать недовольство клиента и претензию',
      why: ['клиентский опыт', 'обслуживание', 'границы ответственности'],
      phrases: ['недоволен продуктом', 'недоволен', 'претензия', 'жалоба клиента', 'плохое обслуживание', 'клиент ругается', 'жалуется', 'клиент жалуется'],
      boostIds: ['A6-001', 'A6-002', 'A6-003'],
    },
    {
      id: 'team',
      goal: 'наставить партнёров и собрать рабочую команду',
      why: ['наставничество', 'ритм', 'стандарт'],
      phrases: ['партнеры ничего не делают', 'партнёры ничего не делают', 'команда не работает', 'развивать команду', 'наставлять', 'партнеры не делают', 'стать лидером', 'собрать команду', 'хочу стать лидером'],
      boostIds: ['A1-016', 'A6-011', 'A6-012', 'A6-013', 'A6-010', 'A1-010', 'A1-004'],
      teamOnly: true,
    },
    {
      id: 'price',
      goal: 'разобрать ценовое возражение, а не общее сомнение',
      why: ['ценовое возражение', 'что стоит за «дорого»'],
      phrases: ['сказал что дорого', 'что дорого', 'это дорого', 'слишком дорого', 'дорого для него', 'не по карману', 'цена смущает'],
      boostIds: ['A5-005', 'A4-013', 'A5-001', 'A5-007'],
    },
    {
      id: 'pause',
      goal: 'продолжить диалог после паузы и сомнения',
      why: ['пауза', 'сомнение', 'подумает'],
      phrases: ['подумает', 'не сейчас', 'сомневается', 'надо подумать', 'сказал что подумает', 'взял паузу'],
      boostIds: ['A5-001', 'A5-008', 'A5-009', 'A5-010', 'A5-011', 'A5-003'],
    },
    {
      id: 'lost-client',
      goal: 'вернуть клиента после покупки или тишины',
      why: ['follow-up', 'клиентский опыт', 'повторный контакт'],
      phrases: ['купил и пропал', 'больше не отвечает', 'вернуть клиента', 'не отвечает', 'клиент купил', 'пропал', 'молчит после сообщения'],
      boostIds: ['A6-001', 'A6-006', 'A5-010', 'A6-003', 'A6-010'],
    },
    {
      id: 'product-talk',
      goal: 'честно рассказать о продукте',
      why: ['карточка продукта', 'продуктовый фокус', 'ограничения'],
      phrases: ['рассказать о продукте', 'не знаю продукт', 'как рассказать', 'не знаю как рассказать', 'что можно обещать', 'презентация продукта'],
      boostIds: ['A1-012', 'A1-011', 'A1-013', 'A4-001', 'A1-014'],
    },
    {
      id: 'silent-message',
      goal: 'продолжить контакт, если человек молчит после сообщения',
      why: ['follow-up после сообщения', 'человек молчит'],
      phrases: ['молчит после', 'не отвечает на сообщение', 'прочитал и молчит', 'тишина после сообщения'],
      boostIds: ['A5-010', 'A3-008', 'A5-011'],
    },
  ];

  var CLARIFY_QUESTION = 'Вам нужно найти людей, начать разговор, продолжить после паузы или организовать команду?';

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

  var MATERIAL_TYPES = [{ id: 'track', title: 'Трек' }];
  var SITUATIONS = SIT_FILTERS.map(function (item) {
    return { id: item.id, title: item.title };
  });

  var FIELD_WEIGHTS = {
    titleExact: 400,
    title: 45,
    situation: 80,
    aliases: 55,
    outcome: 55,
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
  var TRACK_ALIASES = api.TRACK_ALIASES;
  var SECTION_ALIASES = api.SECTION_ALIASES;
  var GOALS = api.GOALS;
  var SITUATIONS = api.SITUATIONS;
  var SIT_FILTERS = api.SIT_FILTERS;
  var FMT_FILTERS = api.FMT_FILTERS;
  var CH_FILTERS = api.CH_FILTERS;
  var LVL_FILTERS = api.LVL_FILTERS;
  var AVAIL_FILTERS = api.AVAIL_FILTERS;
  var EXPERIENCE = api.EXPERIENCE;
  var PRESETS = api.PRESETS;
  var FIELD_WEIGHTS = api.FIELD_WEIGHTS;
  var PAGE_SIZE = api.PAGE_SIZE || 15;
  var LIBRARY_STATE_KEY = api.LIBRARY_STATE_KEY || 'mlma.library.v1';

  var metaCache = {};
  var MIN_HIT = 36;
  var MIN_CLOSE = 70;
  var CANDIDATE_LIMIT = 15;

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
    return {
      kind: 'ok',
      original: original,
      tokens: tokens,
      useful: useful,
      expanded: expanded,
      norm: norm,
      intents: intents,
      negated: collectNegated(norm),
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
    return hits;
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
      playable: track.publicationStatus === 'published' && track.contentStatus === 'published',
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
    if (writeQ && !callQ) {
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

    var intents = analysis.intents || [];
    var intentHit = false;
    for (var n = 0; n < intents.length; n += 1) {
      var intent = intents[n];
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
      if (state.type && state.type !== 'track') continue;
      var meta = deriveMeta(track);
      if (stages.length && stages.indexOf(track.sectionId) === -1) continue;
      if (sit.length && sit.indexOf(meta.sit) === -1) continue;
      if (fmt.length && fmt.indexOf(meta.fmt) === -1) continue;
      if (state.format && track.format !== state.format && fmt.length === 0) continue;
      if (!inGroup(state.ch, meta.ch)) continue;
      if (!inGroup(state.lvl, meta.lvl)) continue;
      if (state.avail === 'playable' && !meta.playable) continue;
      if (state.avail === 'description' && meta.playable) continue;
      if (state.skill) continue;
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
    if (key === 'type') return value === 'track' ? 'Трек' : value;
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
    if (state.type && state.type !== 'track') pushChip(chips, 'type', state.type);
    if (state.fmt && state.fmt.length) {
      for (var f = 0; f < state.fmt.length; f += 1) pushChip(chips, 'fmt', state.fmt[f]);
    } else if (state.format) pushChip(chips, 'format', state.format);
    if (state.ch) for (var c = 0; c < state.ch.length; c += 1) pushChip(chips, 'ch', state.ch[c]);
    if (state.lvl) for (var l = 0; l < state.lvl.length; l += 1) pushChip(chips, 'lvl', state.lvl[l]);
    if (state.avail) pushChip(chips, 'avail', state.avail);
    if (state.experience) pushChip(chips, 'experience', state.experience);
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

  function searchCatalog(tracks, state) {
    state = state || emptyLibraryState();
    var analysis = analyzeQuery(state.q || '');
    var chips = buildChips(state);
    if (state.q && analysis.kind === 'need_more') {
      return { kind: 'need_more', items: [], featured: [], other: [], whyMap: {}, analysis: analysis, chips: chips, relaxedKey: null, close: [], total: tracks.length, label: 'Нужна более конкретная формулировка' };
    }
    var faceted = applyFacets(tracks, state);
    var ranked = rankTracks(faceted, analysis, state.sort);
    var items = [];
    var whyMap = {};
    var scores = {};
    for (var i = 0; i < ranked.length; i += 1) {
      items.push(ranked[i].track);
      scores[ranked[i].track.trackId] = ranked[i].score;
      if (ranked[i].why && whyList(ranked[i].why).length) whyMap[ranked[i].track.trackId] = ranked[i].why;
    }
    if (items.length) {
      var featured = state.q && items.length ? items.slice(0, Math.min(3, items.length)) : [];
      var other = featured.length ? items.slice(featured.length) : items;
      return {
        kind: 'ok',
        items: items,
        featured: featured,
        other: other,
        whyMap: whyMap,
        scores: scores,
        analysis: analysis,
        chips: chips,
        relaxedKey: null,
        close: [],
        candidates: ranked.slice(0, CANDIDATE_LIMIT),
        clarifyingQuestion: null,
        source: 'local',
        total: tracks.length,
        label: foundLabel(items.length, tracks.length, state),
      };
    }
    if (!hasActiveFilters(state) && !state.q) {
      return { kind: 'ok', items: [], featured: [], other: [], whyMap: {}, scores: {}, analysis: analysis, chips: chips, relaxedKey: null, close: [], candidates: [], clarifyingQuestion: null, source: 'local', total: tracks.length, label: foundLabel(0, tracks.length, state) };
    }
    var relaxed = relaxSearch(tracks, state, analysis);
    return {
      kind: 'zero',
      items: [],
      featured: [],
      other: [],
      whyMap: {},
      scores: {},
      analysis: analysis,
      chips: chips,
      relaxedKey: relaxed.key,
      close: relaxed.close || [],
      candidates: ranked.slice(0, CANDIDATE_LIMIT),
      clarifyingQuestion: state.q ? CLARIFY_QUESTION : null,
      source: 'local',
      total: tracks.length,
      label: 'Точного совпадения пока нет',
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

  function rerankPayload(result, query) {
    var rows = (result && result.candidates) || [];
    var candidates = [];
    for (var i = 0; i < rows.length && candidates.length < CANDIDATE_LIMIT; i += 1) {
      var track = rows[i].track || rows[i];
      candidates.push({
        trackId: track.trackId,
        title: track.title,
        situation: track.situation,
        result: track.outcome,
        sectionId: track.sectionId,
        score: rows[i].score || 0,
      });
    }
    return {
      query: String(query || ''),
      candidates: candidates,
    };
  }

  function applyRerankResponse(local, data) {
    if (!local || !data || typeof data !== 'object') return local;
    var allowed = {};
    var source = (local.candidates && local.candidates.length ? local.candidates : []).concat(
      (local.items || []).map(function (track) { return { track: track }; }),
    );
    var byId = {};
    for (var i = 0; i < source.length; i += 1) {
      var track = source[i].track || source[i];
      if (track && track.trackId) {
        allowed[track.trackId] = true;
        byId[track.trackId] = track;
      }
    }
    for (var t = 0; t < (local.items || []).length; t += 1) byId[local.items[t].trackId] = local.items[t];
    var incoming = Array.isArray(data.results) ? data.results : [];
    var ordered = [];
    var whyMap = Object.assign({}, local.whyMap || {});
    for (var r = 0; r < incoming.length; r += 1) {
      var row = incoming[r] || {};
      var id = String(row.trackId || '');
      if (!allowed[id] || !byId[id]) continue;
      if (typeof row.confidence === 'number' && row.confidence < 0.35) continue;
      ordered.push(byId[id]);
      var why = whyMap[id] && !Array.isArray(whyMap[id]) ? whyMap[id] : emptyWhy();
      if (data.recognizedSituation) pushWhy(why, 'situation', data.recognizedSituation);
      if (row.reason) pushWhy(why, 'intent', row.reason);
      whyMap[id] = why;
    }
    if (!ordered.length) {
      var nextZero = Object.assign({}, local);
      nextZero.clarifyingQuestion = data.clarifyingQuestion || local.clarifyingQuestion || CLARIFY_QUESTION;
      nextZero.source = 'ai-low';
      return nextZero;
    }
    var featured = ordered.slice(0, Math.min(3, ordered.length));
    var other = ordered.slice(featured.length);
    return Object.assign({}, local, {
      kind: 'ok',
      items: ordered,
      featured: featured,
      other: other,
      whyMap: whyMap,
      clarifyingQuestion: data.clarifyingQuestion || null,
      recognizedSituation: data.recognizedSituation || '',
      source: 'ai',
      label: foundLabel(ordered.length, local.total, { q: '1' }),
    });
  }

  api.analyzeQuery = analyzeQuery;
  api.searchCatalog = searchCatalog;
  api.rerankPayload = rerankPayload;
  api.applyRerankResponse = applyRerankResponse;
  api.whyList = whyList;
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
  api.matchesQuery = matchesQuery;
  api.filterTracks = filterTracks;
  api.clearFilterKey = clearKey;
  api.rankTracks = rankTracks;

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
    var byId = {};
    for (var i = 0; i < catalog.length; i += 1) byId[catalog[i].trackId] = catalog[i];
    var primary = null;
    if (track.nextTrackIds && track.nextTrackIds[0] && byId[track.nextTrackIds[0]]) {
      primary = byId[track.nextTrackIds[0]];
    }
    var variants = relatedTracks(track, catalog, 4, context).filter(function (item) {
      return !primary || item.trackId !== primary.trackId;
    }).slice(0, 3);
    return { primary: primary, variants: variants };
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

  function itemType() {
    return 'track';
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
