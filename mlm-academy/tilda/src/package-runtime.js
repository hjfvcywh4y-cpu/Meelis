/**
 * Универсальный renderer установленного track package.
 * Свободные тексты и контакты остаются в localStorage. На сервер — только коды.
 */
(function (root) {
  'use strict';

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function clientKey(trackId) {
    return 'mlma.' + String(trackId || '').toLowerCase() + '.client.v1';
  }

  function loadClient(trackId) {
    try {
      return JSON.parse(localStorage.getItem(clientKey(trackId)) || '{}');
    } catch (err) {
      return {};
    }
  }

  function saveClient(trackId, data) {
    try {
      localStorage.setItem(clientKey(trackId), JSON.stringify(data || {}));
    } catch (err) {
      /* ignore */
    }
  }

  function apiBase() {
    try {
      if (root.MLMA_API_URL) return String(root.MLMA_API_URL).replace(/\/$/, '');
    } catch (err) {
      /* ignore */
    }
    return '';
  }

  function renderStep(step, client) {
    var html = '<section class="mlma-card mlma-pad" data-mlma-step="' + esc(step.id) + '"><h2 class="mlma-h3">' + esc(step.title) + '</h2>';
    var i;
    if (step.kind === 'single_choice') {
      html += '<div class="mlma-actions" style="margin-top:16px;display:grid;gap:8px">';
      for (i = 0; i < (step.options || []).length; i += 1) {
        html +=
          '<button type="button" class="mlma-btn" data-mlma-pkg-choice="' +
          esc(step.options[i].code) +
          '">' +
          esc(step.options[i].label) +
          '</button>';
      }
      html += '</div>';
    } else if (step.kind === 'gate') {
      html += '<ul style="margin-top:12px">';
      for (i = 0; i < (step.prompts || []).length; i += 1) html += '<li>' + esc(step.prompts[i]) + '</li>';
      html +=
        '</ul><label class="mlma-meta" style="margin-top:12px;display:block">Настоящий повод (остаётся на этом устройстве)</label>' +
        '<textarea class="mlma-field" data-mlma-local="real_reason_text" rows="3">' +
        esc(client.real_reason_text || '') +
        '</textarea>' +
        '<div class="mlma-actions" style="margin-top:16px;display:grid;gap:8px">';
      for (i = 0; i < (step.branches || []).length; i += 1) {
        var br = step.branches[i];
        html +=
          '<button type="button" class="mlma-btn' +
          (i === 0 ? ' mlma-btn-primary' : '') +
          '" data-mlma-pkg-branch="' +
          esc(br.answer) +
          '" data-outcome="' +
          esc(br.outcomeCode || '') +
          '" data-next="' +
          esc(br.nextStepId || '') +
          '">' +
          esc(br.answer === 'REASON_CONFIRMED' ? 'Повод настоящий, продолжить' : br.answer === 'NO_TRUE_REASON' ? 'Нет настоящего повода' : br.answer === 'ACTION_BARRIER' ? 'Мешает конкретный барьер' : 'Остановить контакт') +
          '</button>';
      }
      html += '</div>';
    } else if (step.kind === 'artifact_builder') {
      html += '<p class="mlma-muted" style="margin-top:8px">Четыре блока. Текст не уходит на сервер.</p>';
      for (i = 0; i < (step.blocks || []).length; i += 1) {
        var block = step.blocks[i];
        html +=
          '<label class="mlma-meta" style="margin-top:12px;display:block">' +
          esc(block.label) +
          '</label><textarea class="mlma-field" data-mlma-block="' +
          esc(block.id) +
          '" rows="2">' +
          esc((client.blocks && client.blocks[block.id]) || '') +
          '</textarea>';
      }
      html +=
        '<label class="mlma-meta" style="margin-top:12px;display:block">Черновик сообщения</label>' +
        '<textarea class="mlma-field" data-mlma-local="message_draft" rows="5">' +
        esc(client.message_draft || '') +
        '</textarea>' +
        '<button type="button" class="mlma-btn mlma-btn-primary" style="margin-top:12px" data-mlma-pkg-next="tone_variants">Дальше</button>';
    } else if (step.kind === 'local_transform') {
      html += '<p class="mlma-muted" style="margin-top:8px">Не добавляйте новые факты и не придумывайте повод.</p><div class="mlma-actions" style="margin-top:12px">';
      for (i = 0; i < (step.variants || []).length; i += 1) {
        html += '<button type="button" class="mlma-btn" data-mlma-pkg-tone="' + esc(step.variants[i]) + '">' + esc(step.variants[i]) + '</button>';
      }
      html += '</div><button type="button" class="mlma-btn mlma-btn-primary" style="margin-top:12px" data-mlma-pkg-next="quality_gate">К проверке</button>';
    } else if (step.kind === 'checklist_gate') {
      html += '<div style="margin-top:12px;display:grid;gap:8px">';
      for (i = 0; i < (step.items || []).length; i += 1) {
        var item = step.items[i];
        html +=
          '<label><input type="checkbox" data-mlma-check="' +
          esc(item.code) +
          '"' +
          (item.critical ? ' data-critical="1"' : '') +
          '> ' +
          esc(item.label) +
          (item.critical ? ' *' : '') +
          '</label>';
      }
      html +=
        '</div><button type="button" class="mlma-btn mlma-btn-primary" style="margin-top:16px" data-mlma-pkg-next="field_action">К действию</button>';
    } else if (step.kind === 'field_action') {
      html += '<p class="mlma-muted" style="margin-top:8px">Автоотправки нет. Зафиксируйте факт.</p><div class="mlma-actions" style="margin-top:12px;display:grid;gap:8px">';
      for (i = 0; i < (step.actions || []).length; i += 1) {
        var act = step.actions[i];
        html +=
          '<button type="button" class="mlma-btn' +
          (act.outcomeCode === 'MESSAGE_SENT' ? ' mlma-btn-primary' : '') +
          '" data-mlma-pkg-action="' +
          esc(act.code) +
          '" data-outcome="' +
          esc(act.outcomeCode || '') +
          '">' +
          esc(act.label) +
          '</button>';
      }
      html += '</div>';
    }
    return html + '</section>';
  }

  function renderPackage(input) {
    var body = input.body || {};
    var steps = body.steps || [];
    var client = loadClient(input.trackId);
    var stepId = input.stepId || client.stepId || (steps[0] && steps[0].id);
    var step = null;
    for (var i = 0; i < steps.length; i += 1) if (steps[i].id === stepId) step = steps[i];
    if (!step) step = steps[0];
    var html =
      '<div id="mlma-package-runtime" data-mlma-package="' +
      esc(input.trackId) +
      '"><p class="mlma-lead">' +
      esc(body.lead || '') +
      '</p>' +
      (step ? renderStep(step, client) : '') +
      '<p class="mlma-muted" style="margin-top:12px;font-size:13px">Имя, телефон, email, текст сообщения и повод хранятся только здесь. На сервер уходит факт результата.</p></div>';
    return html;
  }

  function outcomeStatus(code) {
    if (code === 'MESSAGE_SENT') return 'SENT';
    if (code === 'MESSAGE_NOT_SENT_NO_REASON') return 'BLOCKED_REASON';
    if (code === 'MESSAGE_NOT_SENT_ANXIETY') return 'BLOCKED_ANXIETY';
    if (code === 'MESSAGE_STOPPED') return 'STOPPED';
    return '';
  }

  function serverPayload(trackId, outcomeCode) {
    return {
      track_id: trackId,
      outcome_code: outcomeCode,
      'message.status': outcomeStatus(outcomeCode),
      mentor_event: 'result_recorded',
      step_id: 'field_action',
    };
  }

  var api = root.MLMA || {};
  api.renderInstalledPackage = renderPackage;
  api.packageClient = { load: loadClient, save: saveClient, apiBase: apiBase, serverPayload: serverPayload };
  root.MLMA = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
