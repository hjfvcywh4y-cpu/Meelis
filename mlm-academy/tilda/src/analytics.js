/**
 * Аналитика кабинета. Не отправляет пароли, карты, полный поисковый текст и артефакты.
 * Правило: одно пользовательское действие → одно каноническое событие.
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
    'checkout_blocked',
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

  var ALIAS = {
    search_query: 'search_submitted',
    library_search: 'search_submitted',
    academy_search: 'search_submitted',
    track_start: 'track_started',
    track_complete: 'track_completed',
    track_next_open: 'next_track_opened',
    track_action_submitted: 'artifact_created',
    track_evidence_submitted: 'artifact_created',
  };

  var BLOCKED = /password|passwd|secret|token|card|pan|cvv|cvc|iban|artifact|answer|message_body|full_text|candidateDescriptor|descriptor|reasonText|planText|personalData|completedArtifact/i;
  var CHAIN_KEY = 'mlma.search.chain.v1';
  var lastCanonical = { name: '', key: '', at: 0 };

  function allowed(name) {
    return EVENTS.indexOf(name) !== -1;
  }

  function canonicalName(name) {
    return ALIAS[name] || name;
  }

  function hashQuery(value) {
    var text = String(value || '').trim().toLowerCase();
    var hash = 5381;
    for (var i = 0; i < text.length; i += 1) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
    return 'q' + (hash >>> 0).toString(16);
  }

  function sanitize(payload) {
    var out = {};
    if (!payload || typeof payload !== 'object') return out;
    var keys = Object.keys(payload);
    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      if (BLOCKED.test(key)) continue;
      var value = payload[key];
      if (key === 'query' || key === 'q' || key === 'search_query') {
        out.queryLength = String(value || '').length;
        out.queryHash = hashQuery(value);
        continue;
      }
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

  function shouldDedupe(name, data) {
    var key = name + ':' + (data.itemId || data.queryHash || data.source || '');
    var now = Date.now();
    if (lastCanonical.name === name && lastCanonical.key === key && now - lastCanonical.at < 800) return true;
    lastCanonical = { name: name, key: key, at: now };
    return false;
  }

  var previous = api.trackEvent;
  function trackEvent(name, payload) {
    var canonical = canonicalName(name);
    var data = sanitize(payload || {});
    if (canonical === 'search_submitted' || canonical === 'search_results_shown') {
      data.chainId = chainId();
    } else if (data && (canonical === 'track_card_opened' || canonical === 'track_saved' || canonical === 'checkout_started' || canonical === 'track_started' || canonical === 'track_completed')) {
      data.chainId = data.chainId || chainId();
    }
    if (shouldDedupe(canonical, data)) return data;
    if (typeof previous === 'function' && previous !== trackEvent) previous(canonical, data);
    else {
      try {
        if (typeof window !== 'undefined') {
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push(Object.assign({ event: canonical }, data));
        }
      } catch (err) {
        /* ignore */
      }
    }
    if (api.enqueueOutbox && allowed(canonical)) {
      api.enqueueOutbox('analytics_event', { name: canonical, data: data });
    }
    return data;
  }

  api.ANALYTICS_EVENTS = EVENTS;
  api.ANALYTICS_ALIASES = ALIAS;
  api.sanitizeAnalytics = sanitize;
  api.hashSearchQuery = hashQuery;
  api.canonicalEventName = canonicalName;
  api.trackEvent = trackEvent;
  api.searchChainId = chainId;

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
