/**
 * DOM-привязка установленного track package (A3-002 и далее).
 * Зависит от MLMA.packageClient, MLMA.submitTrackOutcome, MLMA._instanceId.
 * Вызывается из ui.js после монтирования #mlma-package-runtime.
 */
(function (root) {
  'use strict';

  var D = root.MLMA;
  if (!D) return;

  function bindInstalledPackage(rootEl, remount) {
    if (!rootEl || typeof remount !== 'function') return;
    var pack = rootEl.querySelector('#mlma-package-runtime');
    if (!pack || !D.packageClient) return;
    var trackId = pack.getAttribute('data-mlma-package');
    if (!trackId) return;

    function persistLocal() {
      var data = D.packageClient.load(trackId);
      pack.querySelectorAll('[data-mlma-local]').forEach(function (field) {
        data[field.getAttribute('data-mlma-local')] = field.value;
      });
      data.blocks = data.blocks || {};
      pack.querySelectorAll('[data-mlma-block]').forEach(function (field) {
        data.blocks[field.getAttribute('data-mlma-block')] = field.value;
      });
      data.manualChecks = data.manualChecks || {};
      pack.querySelectorAll('[data-mlma-manual]').forEach(function (field) {
        data.manualChecks[field.getAttribute('data-mlma-manual')] = field.checked;
      });
      pack.querySelectorAll('[data-mlma-local-check]').forEach(function (field) {
        data[field.getAttribute('data-mlma-local-check')] = field.checked;
      });
      D.packageClient.save(trackId, data);
      return data;
    }

    function afterDecision(res, clientData, outcome) {
      var decision = res && res.decision;
      if (decision && decision.destinationType === 'SYSTEM_ACTION' && D.systemActionRuntime) {
        if (
          D.systemActionRuntime.openFromDecision(rootEl, decision, {
            sourceTrackId: trackId,
            sourceInstanceId: D._instanceId,
            sourceOutcomeCode: outcome,
          }, remount)
        ) {
          return;
        }
      }
      var nextCard = decision && decision.next;
      if (outcome === 'REASON_FOUND' && D.packageClient.handoffReasonCardToA3002) {
        D.packageClient.handoffReasonCardToA3002(clientData || D.packageClient.load(trackId));
      }
      if (
        (outcome === 'ACTION_READY' || (decision && decision.destinationType === 'RETURN_TO_ROUTE')) &&
        D.packageClient.handoffReturnToOrigin
      ) {
        D.packageClient.handoffReturnToOrigin(clientData || D.packageClient.load(trackId));
      }
      if (nextCard && nextCard.status === 'done') window.location.href = '/my';
      else if (nextCard && nextCard.status === 'expert') window.location.href = '/my';
      else if (nextCard && nextCard.preparing) window.location.href = '/my';
      else if (nextCard && nextCard.href) {
        window.location.href = nextCard.href + (String(nextCard.href).indexOf('?') >= 0 ? '&' : '?') + 'run=1';
      } else if (outcome === 'REASON_FOUND') {
        window.location.href = '/track?id=a3-002&run=1';
      } else if (outcome === 'ACTION_READY' || (decision && decision.destinationType === 'RETURN_TO_ROUTE')) {
        var origin = (clientData && clientData.originTrackId) || 'A3-002';
        window.location.href = '/track?id=' + String(origin).toLowerCase() + '&run=1';
      } else {
        window.location.href = '/my';
      }
    }

    pack.querySelectorAll('[data-mlma-pkg-next]').forEach(function (el) {
      el.addEventListener('click', function () {
        persistLocal();
        D._packageStepId = el.getAttribute('data-mlma-pkg-next');
        remount(rootEl);
      });
    });

    pack.querySelectorAll('[data-mlma-pkg-choice]').forEach(function (el) {
      el.addEventListener('click', function () {
        var data = persistLocal();
        data.goal = el.getAttribute('data-mlma-pkg-choice');
        D.packageClient.save(trackId, data);
        D._packageStepId = 'reason_gate';
        remount(rootEl);
      });
    });

    pack.querySelectorAll('[data-mlma-pkg-tone]').forEach(function (el) {
      el.addEventListener('click', function () {
        var data = persistLocal();
        data.tone = el.getAttribute('data-mlma-pkg-tone');
        D.packageClient.save(trackId, data);
      });
    });

    pack.querySelectorAll('[data-mlma-pkg-branch]').forEach(function (el) {
      el.addEventListener('click', function () {
        persistLocal();
        var outcome = el.getAttribute('data-outcome');
        var next = el.getAttribute('data-next');
        if (outcome && D.submitTrackOutcome && D._instanceId) {
          D.submitTrackOutcome(D._instanceId, outcome, D.packageClient.serverPayload(trackId, outcome, D.packageClient.load(trackId))).then(function (res) {
            var decision = res && res.decision;
            if (decision && decision.destinationType === 'SYSTEM_ACTION' && D.systemActionRuntime) {
              if (
                D.systemActionRuntime.openFromDecision(rootEl, decision, {
                  sourceTrackId: trackId,
                  sourceInstanceId: D._instanceId,
                  sourceOutcomeCode: outcome,
                }, remount)
              ) {
                return;
              }
            }
            var nextCard = decision && decision.next;
            if (nextCard && nextCard.href) {
              window.location.href = nextCard.preparing
                ? '/my'
                : nextCard.href + (String(nextCard.href).indexOf('?') >= 0 ? '&' : '?') + 'run=1';
            } else if (nextCard && nextCard.status === 'done') {
              window.location.href = '/my';
            }
          });
          return;
        }
        if (next) {
          D._packageStepId = next;
          remount(rootEl);
        }
      });
    });

    pack.querySelectorAll('[data-mlma-pkg-action]').forEach(function (el) {
      el.addEventListener('click', function () {
        persistLocal();
        var outcome = el.getAttribute('data-outcome');
        if (!outcome) return;
        var facts = D.packageClient.serverPayload(trackId, outcome, D.packageClient.load(trackId));
        if (D._instanceId && D.submitTrackOutcome) {
          D.submitTrackOutcome(D._instanceId, outcome, facts).then(function (res) {
            afterDecision(res, D.packageClient.load(trackId), outcome);
          });
        }
      });
    });

    pack.querySelectorAll('[data-mlma-readiness-gate]').forEach(function (el) {
      el.addEventListener('click', function () {
        var data = persistLocal();
        var gate = el.getAttribute('data-mlma-readiness-gate');
        data.readinessGateCode = gate;
        D.packageClient.save(trackId, data);
        var outcome = el.getAttribute('data-outcome');
        if (outcome && D._instanceId && D.submitTrackOutcome) {
          var facts = D.packageClient.serverPayload(trackId, outcome, data);
          D.submitTrackOutcome(D._instanceId, outcome, facts).then(function (res) {
            afterDecision(res, data, outcome);
          });
          return;
        }
        var next = el.getAttribute('data-mlma-pkg-next');
        if (next) {
          D._packageStepId = next;
          remount(rootEl);
        }
      });
    });

    pack.querySelectorAll('[data-mlma-remediation-decision]').forEach(function (el) {
      el.addEventListener('click', function () {
        var data = persistLocal();
        var outcome = el.getAttribute('data-mlma-remediation-decision');
        var nextNeed = el.getAttribute('data-next-need');
        if (nextNeed) data.nextNeedCode = nextNeed;
        if (!outcome || !D._instanceId || !D.submitTrackOutcome) return;
        if (outcome === 'WAIT_FOR_RESOURCE' && !data.reviewTriggerCode) {
          data.reviewTriggerCode = data.reviewTriggerCode || 'AGREED_DATE';
          data.dueCode = data.dueCode || 'DATE_SET';
          D.packageClient.save(trackId, data);
        }
        if (outcome === 'OUT_OF_SCOPE_SUPPORT' && !data.supportHandoffCode) {
          data.supportHandoffCode = 'HUMAN_SUPPORT';
          D.packageClient.save(trackId, data);
        }
        if (outcome === 'NO_REASON' && !data.noReasonCode) {
          var code = window.prompt('Код причины отсутствия повода (ONLY_MY_SALES_PLAN / PURPOSE_HIDDEN / TIMING_INAPPROPRIATE / NO_SHARED_CONTEXT)');
          if (!code) return;
          data.noReasonCode = code;
          data.reviewTriggerCode = data.reviewTriggerCode || 'NEW_SHARED_CONTEXT';
          D.packageClient.save(trackId, data);
        }
        if (outcome === 'CONTACT_STOPPED' && !data.stopCode) {
          var stop = window.prompt('Код остановки (EXPLICIT_REFUSAL / DO_NOT_CONTACT / VULNERABILITY_EXPLOITATION / BOUNDARY_BYPASS)');
          if (!stop) return;
          data.stopCode = stop;
          D.packageClient.save(trackId, data);
        }
        var facts = D.packageClient.serverPayload(trackId, outcome, data);
        D.submitTrackOutcome(D._instanceId, outcome, facts).then(function (res) {
          afterDecision(res, data, outcome);
        });
      });
    });

    function canSubmitScheduling(outcome, data) {
      if (outcome === 'MEETING_SCHEDULED') {
        return (
          data.appointmentStatus === 'CONFIRMED' &&
          data.explicitConfirmation === true &&
          data.startsAt &&
          data.timezone &&
          data.durationMinutes &&
          data.formatCode &&
          data.topicCode
        );
      }
      if (outcome === 'LATER') {
        return data.appointmentStatus === 'LATER' && (data.followupAllowed === 'true' || data.followupAllowed === true) && data.reviewAnchorCode;
      }
      if (outcome === 'DECLINED') {
        return data.appointmentStatus === 'DECLINED';
      }
      if (outcome === 'NO_FOLLOW_UP') {
        return (
          data.appointmentStatus === 'UNCONFIRMED' ||
          data.appointmentStatus === 'CLOSED_NO_FOLLOWUP' ||
          (data.appointmentStatus === 'LATER' && data.followupAllowed !== 'true' && data.followupAllowed !== true)
        );
      }
      return false;
    }

    pack.querySelectorAll('[data-mlma-scheduling-consent]').forEach(function (el) {
      el.addEventListener('click', function () {
        var data = persistLocal();
        var code = el.getAttribute('data-mlma-scheduling-consent');
        var preset = el.getAttribute('data-preset-status');
        data.scheduleIntentCode = code;
        if (preset) data.appointmentStatus = preset;
        if (preset === 'LATER') {
          data.followupAllowed = data.followupAllowed || 'false';
        }
        D.packageClient.save(trackId, data);
        var next = el.getAttribute('data-next');
        if (next) {
          D._packageStepId = next;
          remount(rootEl);
        }
      });
    });

    pack.querySelectorAll('[data-mlma-scheduling-decision]').forEach(function (el) {
      el.addEventListener('click', function () {
        var data = persistLocal();
        var outcome = el.getAttribute('data-mlma-scheduling-decision');
        if (!outcome || !D._instanceId || !D.submitTrackOutcome) return;
        if (!canSubmitScheduling(outcome, data)) {
          window.alert('Условия исхода не выполнены. Проверьте явное подтверждение, дату, часовой пояс и разрешение на follow-up.');
          return;
        }
        var facts = D.packageClient.serverPayload(trackId, outcome, data);
        D.submitTrackOutcome(D._instanceId, outcome, facts).then(function (res) {
          afterDecision(res, data, outcome);
        });
      });
    });
  }

  D.bindInstalledPackage = bindInstalledPackage;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
