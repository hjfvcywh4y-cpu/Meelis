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
  var ACCENT_INK = { A1: '#f4f0e8', A2: '#f4f0e8', A3: '#f4f0e8', A4: '#1c1914', A5: '#f4f0e8', A6: '#f4f0e8' };
  var SECTION_COLORS = {
    A1: '#8b5342',
    A2: '#4d5c4a',
    A3: '#2c2a26',
    A4: '#c4a574',
    A5: '#6d4248',
    A6: '#3e4a56',
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
        cta: 'Начать трек',
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
      label: 'Скоро',
      cta: 'Открыть описание',
      tone: 'waiting',
      canStart: false,
      showProgress: false,
      explanation: 'Материал в разработке. Описание, для кого он и какой результат даёт — уже можно посмотреть.',
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
  };

  function membersLoginUrl(returnPath) {
    var path = String(returnPath || '/my').replace(/^\//, '');
    return '/members/login?redirecturl=' + encodeURIComponent(path);
  }

  function siteHomeUrl() {
    return '/';
  }

  root.MLMA = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);

/* __MLMA_UI_SPLIT__ */
(function (root) {
  'use strict';
  var api = root.MLMA;
  if (!api) return;

  var STOP_WORDS = {
    а: 1, и: 1, или: 1, но: 1, да: 1, нет: 1, не: 1, ни: 1, на: 1, в: 1, во: 1, с: 1, со: 1,
    к: 1, ко: 1, от: 1, до: 1, по: 1, из: 1, у: 1, о: 1, об: 1, про: 1, для: 1, при: 1,
    я: 1, ты: 1, он: 1, она: 1, мы: 1, вы: 1, они: 1, мне: 1, меня: 1, мой: 1, моя: 1,
    это: 1, этот: 1, эта: 1, эти: 1, тот: 1, то: 1, как: 1, что: 1, чтобы: 1, чем: 1,
    кто: 1, где: 1, когда: 1, куда: 1, зачем: 1, почему: 1, какой: 1, какая: 1, какие: 1,
    делать: 1, сделать: 1, надо: 1, нужно: 1, можно: 1, есть: 1, быть: 1, вот: 1,
    уже: 1, ещё: 1, еще: 1, же: 1, бы: 1, ли: 1, ведь: 1, там: 1, тут: 1, здесь: 1,
    очень: 1, просто: 1, также: 1, если: 1, только: 1, себе: 1, себя: 1, свой: 1,
    все: 1, всё: 1, всего: 1, ну: 1, под: 1, над: 1, без: 1, мне: 1, тебя: 1,
  };

  var SYNONYMS = {
    позвать: ['пригласить', 'написать', 'связаться'],
    пригласить: ['позвать', 'написать'],
    написать: ['позвать', 'пригласить', 'сообщение', 'текст', 'переписка'],
    покупатель: ['клиент', 'человек', 'контакт'],
    клиент: ['покупатель', 'человек', 'заказчик'],
    страшно: ['боюсь', 'страх', 'стыдно', 'неловко'],
    боюсь: ['страшно', 'страх', 'стыдно', 'неловко', 'тревога'],
    страх: ['боюсь', 'страшно', 'неловко'],
    неловко: ['стыдно', 'боюсь', 'навязываться'],
    стыдно: ['неловко', 'боюсь', 'впаривание'],
    начало: ['старт', 'новичок', 'начать', 'первые'],
    старт: ['начало', 'новичок', 'начать'],
    новичок: ['новичку', 'новичка', 'новички'],
    новичку: ['новичок', 'новичка'],
    новичка: ['новичок', 'новичку'],
    начать: ['старт', 'начало', 'первые'],
    продажа: ['заказ', 'купить', 'продавать', 'сделка'],
    заказ: ['продажа', 'купить', 'клиент'],
    купить: ['заказ', 'продажа'],
    разговор: ['диалог', 'общение', 'контакт', 'беседа'],
    диалог: ['разговор', 'общение', 'контакт'],
    общение: ['разговор', 'диалог', 'контакт'],
    навязываться: ['впаривать', 'давить', 'навязывать'],
    впаривать: ['навязываться', 'давить'],
    продукт: ['товар', 'каталог', 'ассортимент'],
    команда: ['структура', 'партнеры', 'рост'],
    отказ: ['сомнение', 'пауза', 'нет'],
    сомнение: ['отказ', 'пауза', 'возражение'],
    пауза: ['сомнение', 'отказ', 'молчит'],
    кому: ['база', 'контакт', 'люди'],
    сообщение: ['написать', 'текст', 'переписка'],
    первый: ['первые', 'начало', 'старт'],
    видео: ['снять', 'ролик', 'контент'],
    снять: ['видео', 'ролик'],
    рассказать: ['презентация', 'продукт', 'объяснить'],
    наставник: ['спонсор', 'лидер'],
  };

  var SECTION_ALIASES = {
    A1: ['старт', 'система', 'новичок', 'начало', 'роль', 'план'],
    A2: ['база', 'клиент', 'люди', 'контакты', 'кому', 'найти'],
    A3: ['диалог', 'разговор', 'сообщение', 'контакт', 'написать', 'первый'],
    A4: ['продукт', 'потребность', 'решение', 'рассказать', 'предложить'],
    A5: ['отказ', 'сомнение', 'пауза', 'возражение'],
    A6: ['команда', 'рост', 'повтор', 'лидерство', 'клиентская'],
  };

  var GOALS = [
    { id: 'first-result', title: 'Первый результат', stages: ['A1'] },
    { id: 'find-client', title: 'Найти клиента', stages: ['A2'] },
    { id: 'first-dialogue', title: 'Первый диалог', stages: ['A3'] },
    { id: 'understand-need', title: 'Понять потребность', stages: ['A4'] },
    { id: 'handle-doubt', title: 'Пройти сомнения', stages: ['A5'] },
    { id: 'grow-repeat', title: 'Повтор и рост', stages: ['A6'] },
  ];

  var SITUATIONS = [
    { id: 'need-system', title: 'Не понимаю, что делать дальше', stage: 'A1' },
    { id: 'no-people', title: 'Не знаю, с кем начать', stage: 'A2' },
    { id: 'how-to-write', title: 'Не знаю, как начать разговор', stage: 'A3' },
    { id: 'afraid-impose', title: 'Боюсь навязываться', stage: 'A1' },
    { id: 'tell-product', title: 'Хочу научиться рассказывать о продукте', stage: 'A4' },
    { id: 'got-pause', title: 'Человек сомневается или взял паузу', stage: 'A5' },
    { id: 'need-team', title: 'Хочу развивать команду', stage: 'A6' },
  ];

  var EXPERIENCE = [
    { id: 'start', title: 'Только начинаю', stages: ['A1'] },
    { id: 'first-steps', title: 'Первые контакты', stages: ['A2', 'A3'] },
    { id: 'practice', title: 'Уже веду разговоры', stages: ['A4', 'A5'] },
    { id: 'growth', title: 'Расту и повторяю', stages: ['A6'] },
  ];

  var MATERIAL_TYPES = [{ id: 'track', title: 'Трек' }];

  var PRESETS = [
    { id: 'new-partner', title: 'Я только начал', hint: 'Старт и система', filters: { stage: 'A1' } },
    { id: 'first-result', title: 'Хочу первый результат', hint: 'Первые рабочие шаги', filters: { goal: 'first-result' } },
    { id: 'find-client', title: 'Хочу найти клиента', hint: 'Люди и база', filters: { stage: 'A2' } },
    { id: 'learn-talk', title: 'Хочу научиться разговаривать', hint: 'Первый контакт', filters: { stage: 'A3' } },
    { id: 'product', title: 'Хочу разобраться в продукте', hint: 'Потребность и решение', filters: { stage: 'A4' } },
    { id: 'team', title: 'Хочу развивать команду', hint: 'Повтор и рост', filters: { stage: 'A6' } },
  ];

  var FIELD_WEIGHTS = {
    titleExact: 1000,
    title: 80,
    aliases: 70,
    situation: 60,
    outcome: 50,
    module: 30,
    format: 20,
    section: 16,
    id: 8,
  };

  function stem(word) {
    var value = String(word || '');
    if (value.length < 4) return value;
    var suffixes = [
      'ться', 'тся', 'ешь', 'ишь', 'ать', 'ять', 'ить', 'ость', 'ение', 'ание',
      'ого', 'ему', 'ами', 'ями', 'ов', 'ев', 'ах', 'ях', 'ой', 'ый', 'ий',
      'ая', 'ое', 'ые', 'ть', 'ся', 'сь', 'ам', 'ям', 'ом', 'ем',
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
    return normalized.split(' ').filter(Boolean);
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
      return { kind: 'need_more', original: original, tokens: tokens, useful: [], expanded: [] };
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
    return { kind: 'ok', original: original, tokens: tokens, useful: useful, expanded: expanded };
  }

  function fieldHas(haystack, variants) {
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

  function trackFields(track) {
    var aliases = (SECTION_ALIASES[track.sectionId] || []).join(' ');
    return {
      title: api.normalizeSearchText(track.title),
      situation: api.normalizeSearchText(track.situation),
      outcome: api.normalizeSearchText(track.outcome),
      module: api.normalizeSearchText(track.module),
      format: api.normalizeSearchText(track.format),
      aliases: api.normalizeSearchText(aliases),
      section: api.normalizeSearchText(track.sectionId + ' ' + aliases),
      id: api.normalizeSearchText(track.trackId),
      all: api.normalizeSearchText(
        [track.trackId, track.title, track.situation, track.outcome, track.module, track.format, aliases].join(' '),
      ),
    };
  }

  function scoreTrack(track, analysis, mode) {
    if (!analysis || analysis.kind !== 'ok' || !analysis.useful.length) return 0;
    var fields = trackFields(track);
    var titleNorm = fields.title;
    var queryNorm = api.normalizeSearchText(analysis.original);
    var score = 0;
    if (queryNorm && titleNorm === queryNorm) score += FIELD_WEIGHTS.titleExact;
    var matchedUseful = 0;
    for (var i = 0; i < analysis.useful.length; i += 1) {
      var variants = expandToken(analysis.useful[i]);
      var hit = false;
      if (fieldHas(fields.title, variants)) {
        score += FIELD_WEIGHTS.title;
        hit = true;
      }
      if (fieldHas(fields.situation, variants)) {
        score += FIELD_WEIGHTS.situation;
        hit = true;
      }
      if (fieldHas(fields.outcome, variants)) {
        score += FIELD_WEIGHTS.outcome;
        hit = true;
      }
      if (fieldHas(fields.module, variants)) {
        score += FIELD_WEIGHTS.module;
        hit = true;
      }
      if (fieldHas(fields.format, variants)) {
        score += FIELD_WEIGHTS.format;
        hit = true;
      }
      if (fieldHas(fields.aliases, variants)) {
        score += FIELD_WEIGHTS.aliases;
        hit = true;
      }
      if (fieldHas(fields.section, variants)) {
        score += FIELD_WEIGHTS.section;
        hit = true;
      }
      if (fieldHas(fields.id, variants)) {
        score += FIELD_WEIGHTS.id;
        hit = true;
      }
      if (hit) matchedUseful += 1;
    }
    if (matchedUseful < analysis.useful.length) {
      if (mode === 'soft' && matchedUseful > 0) {
        return Math.floor(score * (matchedUseful / analysis.useful.length));
      }
      return 0;
    }
    return score;
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
    for (var i = 0; i < SITUATIONS.length; i += 1) {
      if (SITUATIONS[i].id === id) return SITUATIONS[i];
    }
    return null;
  }

  function getExperience(id) {
    for (var i = 0; i < EXPERIENCE.length; i += 1) {
      if (EXPERIENCE[i].id === id) return EXPERIENCE[i];
    }
    return null;
  }

  function emptyLibraryState() {
    return {
      q: '',
      stage: null,
      goal: null,
      situation: null,
      type: null,
      format: null,
      skill: null,
      experience: null,
      sort: null,
      preset: null,
    };
  }

  function applyPresetToState(state, preset) {
    if (!preset || !preset.filters) return state;
    var keys = Object.keys(preset.filters);
    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      if (state[key] == null || state[key] === '') state[key] = preset.filters[key];
    }
    return state;
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
    var stage = api.normalizeSectionId(params.get('stage') || params.get('section') || extra.stage || '');
    if (stage) state.stage = stage;
    var goal = params.get('goal') || extra.goal || '';
    if (goal && getGoal(goal)) state.goal = goal;
    var situation = params.get('situation') || extra.situation || '';
    if (situation && getSituation(situation)) state.situation = situation;
    var type = params.get('type') || extra.type || '';
    if (type && type !== 'track') state.type = type;
    else if (type === 'track') state.type = 'track';
    var format = params.get('format') || extra.format || '';
    if (format) state.format = format;
    var skill = params.get('skill') || extra.skill || '';
    if (skill) state.skill = skill;
    var experience = params.get('experience') || extra.experience || '';
    if (experience && getExperience(experience)) state.experience = experience;
    var sort = params.get('sort') || extra.sort || '';
    if (sort && sort !== 'relevance') state.sort = sort;
    var preset = params.get('preset') || extra.preset || '';
    if (preset && getPreset(preset)) {
      state.preset = preset;
      applyPresetToState(state, getPreset(preset));
    }
    return state;
  }

  function serializeLibraryState(state) {
    state = state || emptyLibraryState();
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.stage) params.set('stage', String(state.stage).toLowerCase());
    if (state.goal) params.set('goal', state.goal);
    if (state.situation) params.set('situation', state.situation);
    if (state.type) params.set('type', state.type);
    if (state.format) params.set('format', state.format);
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
    return !!(state.q || state.stage || state.goal || state.situation || (state.type && state.type !== 'track') || state.format || state.skill || state.experience);
  }

  function stagesForState(state) {
    var set = {};
    if (state.stage) set[state.stage] = true;
    var goal = state.goal ? getGoal(state.goal) : null;
    if (goal) {
      for (var i = 0; i < goal.stages.length; i += 1) set[goal.stages[i]] = true;
    }
    var sit = state.situation ? getSituation(state.situation) : null;
    if (sit) set[sit.stage] = true;
    var exp = state.experience ? getExperience(state.experience) : null;
    if (exp) {
      for (var j = 0; j < exp.stages.length; j += 1) set[exp.stages[j]] = true;
    }
    var keys = Object.keys(set);
    return keys;
  }

  function itemType() {
    return 'track';
  }

  function applyFacets(tracks, state) {
    state = state || emptyLibraryState();
    var out = [];
    var requiredStages = [];
    if (state.stage) requiredStages.push(state.stage);
    var goal = state.goal ? getGoal(state.goal) : null;
    if (goal) requiredStages = requiredStages.concat(goal.stages);
    var sit = state.situation ? getSituation(state.situation) : null;
    if (sit) requiredStages.push(sit.stage);
    var exp = state.experience ? getExperience(state.experience) : null;
    if (exp) requiredStages = requiredStages.concat(exp.stages);
    var uniqueStages = [];
    var seenStage = {};
    for (var s = 0; s < requiredStages.length; s += 1) {
      if (!seenStage[requiredStages[s]]) {
        seenStage[requiredStages[s]] = true;
        uniqueStages.push(requiredStages[s]);
      }
    }
    var stageGroups = [];
    if (state.stage) stageGroups.push([state.stage]);
    if (goal) stageGroups.push(goal.stages);
    if (sit) stageGroups.push([sit.stage]);
    if (exp) stageGroups.push(exp.stages);
    for (var i = 0; i < tracks.length; i += 1) {
      var track = tracks[i];
      if (state.type && state.type !== itemType(track)) continue;
      if (state.format && track.format !== state.format) continue;
      if (state.skill) continue;
      var ok = true;
      for (var g = 0; g < stageGroups.length; g += 1) {
        if (stageGroups[g].indexOf(track.sectionId) === -1) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
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
      return copy;
    }
    var scored = [];
    for (var i = 0; i < tracks.length; i += 1) {
      var score = scoreTrack(tracks[i], analysis, mode);
      if (score > 0) scored.push({ track: tracks[i], score: score });
    }
    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.track.trackId.localeCompare(b.track.trackId);
    });
    var out = [];
    for (var j = 0; j < scored.length; j += 1) out.push(scored[j].track);
    return out;
  }

  function chipLabel(key, value) {
    if (key === 'q') return '«' + value + '»';
    if (key === 'stage') return value;
    if (key === 'goal') {
      var goal = getGoal(value);
      return goal ? goal.title : value;
    }
    if (key === 'situation') {
      var sit = getSituation(value);
      return sit ? sit.title : value;
    }
    if (key === 'type') return value === 'track' ? 'Трек' : value;
    if (key === 'format') return value;
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

  function buildChips(state) {
    var chips = [];
    var keys = ['q', 'stage', 'goal', 'situation', 'type', 'format', 'experience'];
    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      var value = state[key];
      if (!value) continue;
      if (key === 'type' && value === 'track') continue;
      chips.push({ key: key, value: value, label: chipLabel(key, value) });
    }
    return chips;
  }

  function relaxOrder() {
    return ['format', 'experience', 'situation', 'goal', 'stage', 'q'];
  }

  function relaxSearch(tracks, state, analysis) {
    var order = relaxOrder();
    for (var i = 0; i < order.length; i += 1) {
      var key = order[i];
      if (!state[key]) continue;
      var next = Object.assign({}, state);
      next[key] = key === 'q' ? '' : null;
      next.preset = null;
      var faceted = applyFacets(tracks, next);
      var ranked = rankTracks(faceted, next.q ? analysis : { kind: 'ok', useful: [] }, next.sort, 'soft');
      if (ranked.length) {
        return { key: key, items: ranked.slice(0, 6), close: ranked.slice(0, 6) };
      }
    }
    var fallback = rankTracks(tracks, analysis && analysis.useful && analysis.useful.length ? analysis : { kind: 'ok', useful: [] }, state.sort, 'soft');
    return { key: 'all', items: fallback.slice(0, 6), close: fallback.slice(0, 6) };
  }

  function searchCatalog(tracks, state) {
    state = state || emptyLibraryState();
    var analysis = analyzeQuery(state.q || '');
    var chips = buildChips(state);
    if (state.q && analysis.kind === 'need_more') {
      return { kind: 'need_more', items: [], analysis: analysis, chips: chips, relaxedKey: null, close: [] };
    }
    var faceted = applyFacets(tracks, state);
    var ranked = rankTracks(faceted, analysis, state.sort);
    if (ranked.length) {
      return { kind: 'ok', items: ranked, analysis: analysis, chips: chips, relaxedKey: null, close: [] };
    }
    if (!hasActiveFilters(state) && !state.q) {
      return { kind: 'ok', items: [], analysis: analysis, chips: chips, relaxedKey: null, close: [] };
    }
    var relaxed = relaxSearch(tracks, state, analysis);
    return {
      kind: 'zero',
      items: [],
      analysis: analysis,
      chips: chips,
      relaxedKey: relaxed.key,
      close: relaxed.close,
    };
  }

  function matchesQuery(track, query) {
    query = query || {};
    var state = {
      q: query.query || query.q || '',
      stage: query.sectionId || query.stage || null,
      format: query.format || null,
      goal: query.goal || null,
      situation: query.situation || null,
      type: query.type || null,
      experience: query.experience || null,
    };
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

  function relatedTracks(track, catalog, limit) {
    limit = limit || 3;
    if (!track) return [];
    var byId = {};
    for (var i = 0; i < catalog.length; i += 1) byId[catalog[i].trackId] = catalog[i];
    var out = [];
    var seen = {};
    seen[track.trackId] = true;
    var ids = track.nextTrackIds || [];
    for (var n = 0; n < ids.length && out.length < limit; n += 1) {
      if (byId[ids[n]] && !seen[ids[n]]) {
        seen[ids[n]] = true;
        out.push(byId[ids[n]]);
      }
    }
    for (var t = 0; t < catalog.length && out.length < limit; t += 1) {
      var other = catalog[t];
      if (seen[other.trackId]) continue;
      if (other.sectionId === track.sectionId) {
        seen[other.trackId] = true;
        out.push(other);
      }
    }
    return out;
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

  api.STOP_WORDS = STOP_WORDS;
  api.SYNONYMS = SYNONYMS;
  api.GOALS = GOALS;
  api.SITUATIONS = SITUATIONS;
  api.EXPERIENCE = EXPERIENCE;
  api.MATERIAL_TYPES = MATERIAL_TYPES;
  api.PRESETS = PRESETS;
  api.analyzeQuery = analyzeQuery;
  api.searchCatalog = searchCatalog;
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
  api.uniqueFormats = uniqueFormats;
  api.relatedTracks = relatedTracks;
  api.trackEvent = trackEvent;
  api.itemType = itemType;
  api.stagesForState = stagesForState;
  api.matchesQuery = matchesQuery;
  api.filterTracks = filterTracks;

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
