(function (root) {
  'use strict';

  var TRACK_ID = 'A3-002';
  var VERSION = '0.1.0';
  var STORAGE_KEY = 'mlma.a3-002.client.v1';

  function storage() {
    try {
      return root.localStorage;
    } catch (err) {
      return null;
    }
  }

  function loadClientOnly() {
    var raw = storage() && storage().getItem(STORAGE_KEY);
    if (!raw) {
      return { contact_name: '', real_reason_text: '', message_draft: '', contact_card: null };
    }
    try {
      return JSON.parse(raw);
    } catch (err) {
      return { contact_name: '', real_reason_text: '', message_draft: '', contact_card: null };
    }
  }

  function saveClientOnly(data) {
    var store = storage();
    if (!store) return;
    store.setItem(
      STORAGE_KEY,
      JSON.stringify({
        contact_name: data.contact_name || '',
        phone: data.phone || '',
        email: data.email || '',
        messenger_handle: data.messenger_handle || '',
        real_reason_text: data.real_reason_text || '',
        message_draft: data.message_draft || '',
        contact_card: data.contact_card || null,
      }),
    );
  }

  function serverPayload(outcomeCode, extras) {
    extras = extras || {};
    return {
      track_id: TRACK_ID,
      content_version: VERSION,
      outcome_code: outcomeCode,
      'message.status': extras.status || null,
      channel_code: extras.channel_code || null,
      occurred_at: extras.occurred_at || null,
      blocked_reason_code: extras.blocked_reason_code || null,
      barrier_code: extras.barrier_code || null,
      stop_code: extras.stop_code || null,
    };
  }

  root.MLMA_TRACK_MODULES = root.MLMA_TRACK_MODULES || {};
  root.MLMA_TRACK_MODULES[TRACK_ID] = {
    trackId: TRACK_ID,
    version: VERSION,
    status: 'review',
    executable: false,
    privacy: {
      artifactStorage: 'local_only',
      serverPayload: 'metadata_only',
      forbiddenInput: [
        'contact_name',
        'phone',
        'email',
        'real_reason_text',
        'message_draft',
        'message_text',
      ],
    },
    loadClientOnly: loadClientOnly,
    saveClientOnly: saveClientOnly,
    serverPayload: serverPayload,
    autoSend: false,
  };
})(typeof window !== 'undefined' ? window : globalThis);
