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
    var self = this;
    if (typeof fetch !== 'function') return Promise.reject(new Error('no_fetch'));
    return fetch(this.base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body || {}),
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          self.lastError = (data && data.reason) || ('api_' + res.status);
          var err = new Error(self.lastError);
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
    var self = this;
    return this.bind(session)
      .then(function (bound) {
        if (bound && bound.account) return bound;
        return self.request('/account/get', {});
      })
      .then(function (data) {
        setSync(MODE_SERVER);
        return data && data.account ? data.account : null;
      });
  };
  HttpRepo.prototype.saveProfile = function (session, profile) {
    LocalRepo.saveProfile(session, profile);
    var self = this;
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
