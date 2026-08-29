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
