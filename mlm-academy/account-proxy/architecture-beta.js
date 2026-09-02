/**
 * Beta runtime for registered Members sessions on the Account Worker.
 * No SQL. No entitlements. No owner review. Draft rules only for installed packages.
 */
import contentA3002 from '../server/content/tracks/a3-002/0.1.0/content.json' with { type: 'json' };
import packageA3002 from '../packages/a3-002/package.json' with { type: 'json' };
import publicMetaA3002 from '../server/content/tracks/a3-002/public-meta.json' with { type: 'json' };
import contentA3008 from '../server/system-actions/a3-008/0.1.0/content.json' with { type: 'json' };
import uiA3008 from '../server/system-actions/a3-008/0.1.0/ui-definition.json' with { type: 'json' };
import packageA3008 from '../packages/a3-008/package.json' with { type: 'json' };
import contentA3016 from '../server/content/tracks/a3-016/0.1.0/content.json' with { type: 'json' };
import packageA3016 from '../packages/a3-016/package.json' with { type: 'json' };
import publicMetaA3016 from '../server/content/tracks/a3-016/public-meta.json' with { type: 'json' };
import { normalizeTrackId as catalogNormalize } from './account-core.js';

const BETA_STATUSES = { REVIEW: true, READY: true, PUBLISHED: true };
const BLOCKED = { EMPTY: true, DRAFT: true, ARCHIVED: true };

function flag(env, name, fallback) {
  const raw = env && env[name];
  if (raw == null || raw === '') return fallback;
  return String(raw).toLowerCase() === 'true';
}

function betaFlags(env) {
  return {
    REGISTERED_BETA_ACCESS_ENABLED: flag(env, 'REGISTERED_BETA_ACCESS_ENABLED', true),
    PAYMENTS_ENABLED: flag(env, 'PAYMENTS_ENABLED', false),
    PAID_TRACK_NAVIGATION_ENABLED: flag(env, 'PAID_TRACK_NAVIGATION_ENABLED', false),
    ALLOW_DRAFT_RULES: flag(env, 'ALLOW_DRAFT_RULES', false),
    ENTITLEMENT_BYPASS: flag(env, 'ENTITLEMENT_BYPASS', false),
    SIGNUP_ENABLED: flag(env, 'SIGNUP_ENABLED', false),
  };
}

const PACKAGES = {
  'A3-002': {
    entityType: 'TRACK',
    content: contentA3002,
    pkg: packageA3002,
    publicMeta: publicMetaA3002,
  },
  'A3-008': {
    entityType: 'SYSTEM_ACTION',
    content: Object.assign({}, contentA3008, { uiDefinition: uiA3008 }),
    pkg: packageA3008,
    publicMeta: { title: packageA3008.track.title, situation: packageA3008.track.situation },
  },
  'A3-016': {
    entityType: 'REMEDIATION',
    content: contentA3016,
    pkg: packageA3016,
    publicMeta: publicMetaA3016,
  },
};

function trackPackageIds() {
  return Object.keys(PACKAGES).filter((id) => {
    const type = PACKAGES[id].entityType;
    return type === 'TRACK' || type === 'REMEDIATION';
  });
}

function installedIds() {
  return Object.keys(PACKAGES).filter((id) => {
    const status = String(PACKAGES[id].content.contentStatus || '');
    return BETA_STATUSES[status] && !BLOCKED[status];
  });
}

function systemActionInstalled(id) {
  const pack = PACKAGES[id];
  if (!pack || pack.entityType !== 'SYSTEM_ACTION') return false;
  const status = String(pack.content.contentStatus || '');
  return BETA_STATUSES[status] && !BLOCKED[status];
}

function isBetaOn(env) {
  const flags = betaFlags(env);
  return flags.REGISTERED_BETA_ACCESS_ENABLED && !flags.PAYMENTS_ENABLED && !flags.ENTITLEMENT_BYPASS && !flags.ALLOW_DRAFT_RULES;
}

function cohortCutoff(env) {
  return env && env.BETA_COHORT_CUTOFF_ISO ? String(env.BETA_COHORT_CUTOFF_ISO) : '';
}

function inBetaCohort(row, env) {
  const cutoff = cohortCutoff(env);
  if (!cutoff) return true;
  const created = row && row.createdAt ? String(row.createdAt) : '';
  if (!created) return false;
  return created < cutoff;
}

function denyCohort(origin, json) {
  return json({ ok: false, code: 'denied', lockReason: 'BETA_COHORT_CLOSED' }, 403, origin);
}

function trackUrl(id) {
  return '/track?id=' + String(id).toLowerCase();
}

function kvBetaKey(userKey) {
  return 'beta:' + userKey;
}

async function loadBeta(env, userKey) {
  const raw = await env.MLMA_ACCOUNT.get(kvBetaKey(userKey));
  if (!raw) return { instances: [], outcomes: [], decisions: [] };
  try {
    return JSON.parse(raw);
  } catch (err) {
    return { instances: [], outcomes: [], decisions: [] };
  }
}

async function saveBeta(env, userKey, state) {
  await env.MLMA_ACCOUNT.put(kvBetaKey(userKey), JSON.stringify(state));
}

function matchRule(trackId, outcomeCode, facts) {
  const pack = PACKAGES[trackId];
  if (!pack) return null;
  const rules = (pack.pkg.routeRules || [])
    .filter((rule) => rule.fromId === trackId && rule.outcomeCode === outcomeCode && rule.status === 'PILOT_DRAFT_TO_TEST')
    .sort((a, b) => a.priority - b.priority);
  for (let i = 0; i < rules.length; i += 1) {
    const rule = rules[i];
    const actual = String((facts && facts[rule.field]) || '');
    if (String(rule.value) === actual) return rule;
    if (rule.field === 'message.status') {
      const status = String((facts && facts['message.status']) || '');
      if (String(rule.value) === status) return rule;
    }
  }
  return null;
}

function destinationView(rule, sourceTrackId) {
  if (!rule) return { destinationType: 'DONE', destinationId: null, preparing: false, href: '/my' };
  const destinationId = rule.destinationId || null;
  const destinationType = rule.destinationType;
  if (destinationType === 'DONE') {
    return { destinationType, destinationId: null, preparing: false, href: '/my', status: 'done', title: 'Маршрут корректно завершён' };
  }
  if (destinationType === 'WAIT_UNTIL') {
    return { destinationType, destinationId: null, preparing: false, href: '/my', status: 'ready', title: 'Ожидание до даты' };
  }
  if (destinationType === 'SYSTEM_ACTION') {
    const installed = systemActionInstalled(destinationId);
    return {
      destinationType,
      destinationId,
      preparing: !installed,
      href: null,
      status: installed ? 'system_action' : 'preparing',
      title: installed ? 'Зафиксировать результат' : 'Готовится',
      systemActionId: destinationId,
      sourceTrackId: sourceTrackId || null,
    };
  }
  const installed = destinationId && installedIds().indexOf(destinationId) >= 0;
  return {
    destinationType,
    destinationId,
    preparing: !installed,
    href: installed && destinationId ? trackUrl(destinationId) : '/my',
    status: installed ? 'ready' : 'preparing',
    title: installed ? destinationId : (destinationId || 'Готовится') + ' · Готовится',
  };
}

function continuations(trackId) {
  const pack = PACKAGES[trackId];
  if (!pack) return [];
  const seen = {};
  const out = [];
  (pack.pkg.routeRules || []).forEach((rule) => {
    if (!rule.destinationId || seen[rule.destinationId]) return;
    seen[rule.destinationId] = true;
    out.push({ id: rule.destinationId, title: rule.destinationId });
  });
  return out;
}

function newId(prefix) {
  return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function cabinetOf(state) {
  const installed = trackPackageIds()
    .filter((id) => installedIds().indexOf(id) >= 0)
    .map((id) => ({
      trackId: id,
      title: PACKAGES[id].publicMeta.title || id,
      situation: PACKAGES[id].publicMeta.situation || '',
    }));
  const active = (state.instances || []).filter((row) => row.instanceStatus === 'active' || row.instanceStatus === 'waiting');
  const inProgress = active.sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))[0] || null;
  const defaultTrack = installed.find((row) => row.trackId === 'A3-002') || installed[0] || null;
  let next;
  if (inProgress && inProgress.pendingSystemActionId) {
    next = {
      question: 'Что мне делать сейчас?',
      title: 'Зафиксировать результат',
      trackId: inProgress.trackId,
      why: 'Почему это сейчас: после контакта нужно зафиксировать факт.',
      cta: 'Зафиксировать результат',
      href: trackUrl(inProgress.trackId) + '?systemAction=a3-008',
      kind: 'system_action',
      systemActionId: inProgress.pendingSystemActionId,
    };
  } else if (inProgress) {
    next = {
      question: 'Что мне делать сейчас?',
      title: (PACKAGES[inProgress.trackId] && PACKAGES[inProgress.trackId].publicMeta.title) || inProgress.trackId,
      trackId: inProgress.trackId,
      why: 'Почему это сейчас: есть незавершённое прохождение.',
      cta: 'Продолжить',
      href: trackUrl(inProgress.trackId),
      kind: 'continue',
    };
  } else if (defaultTrack) {
    next = {
      question: 'Что мне делать сейчас?',
      title: defaultTrack.title,
      trackId: defaultTrack.trackId,
      why: 'Почему это сейчас: это установленный рабочий трек. После фиксации результата появится один следующий шаг.',
      cta: 'Начать',
      href: trackUrl(defaultTrack.trackId),
      kind: 'start',
    };
  } else {
    next = {
      question: 'Что мне делать сейчас?',
      title: 'Пока нет установленного трека',
      trackId: null,
      why: 'Почему это сейчас: рабочие пакеты ещё не установлены.',
      cta: 'Открыть библиотеку',
      href: '/library',
      kind: 'library',
    };
  }
  const availableTracks = installed.map((row) => {
    const instance = (state.instances || []).filter((item) => item.trackId === row.trackId).slice(-1)[0];
    let status = 'Не начат';
    if (instance && instance.instanceStatus === 'completed') status = 'Завершён';
    else if (instance && instance.instanceStatus === 'waiting') status = 'Ожидание до даты/события';
    else if (instance) status = 'В процессе';
    return { trackId: row.trackId, title: row.title, status, lastStep: instance && instance.lastStepLabel, href: trackUrl(row.trackId) };
  });
  return {
    nextStep: next,
    inProgress: inProgress
      ? {
          trackId: inProgress.trackId,
          title: next.title,
          lastStep: inProgress.lastStepLabel || inProgress.lastStepId || null,
          stopPoint: inProgress.instanceStatus === 'waiting' ? 'wait_until' : 'in_track',
          href: trackUrl(inProgress.trackId),
          cta: 'Продолжить',
        }
      : null,
    availableTracks,
  };
}

export async function handleArchitectureBeta(request, env, ctx) {
  const { json, origin, requireUser, method, path } = ctx;
  const flags = betaFlags(env);
  if (path === '/api/v1/flags' && method === 'GET') {
    return json(
      {
        ok: true,
        REGISTERED_BETA_ACCESS_ENABLED: flags.REGISTERED_BETA_ACCESS_ENABLED,
        PAYMENTS_ENABLED: flags.PAYMENTS_ENABLED,
        PAID_TRACK_NAVIGATION_ENABLED: flags.PAID_TRACK_NAVIGATION_ENABLED,
        SIGNUP_ENABLED: flags.SIGNUP_ENABLED,
        ALLOW_DRAFT_RULES: flags.ALLOW_DRAFT_RULES,
        ENTITLEMENT_BYPASS: flags.ENTITLEMENT_BYPASS,
        ownerReview: false,
      },
      200,
      origin,
    );
  }

  const trackMatch = path.match(/^\/api\/v1\/tracks\/([^/]+)\/(meta|content)$/);
  if (trackMatch && method === 'GET') {
    const id = catalogNormalize(decodeURIComponent(trackMatch[1])) || String(trackMatch[1] || '').toUpperCase();
    const pack = PACKAGES[id];
    if (trackMatch[2] === 'meta') {
      const meta = pack
        ? Object.assign({}, pack.publicMeta, {
            possibleContinuations: continuations(id),
            continuationNote: 'Продолжение зависит от результата прохождения',
            loginPrompt: 'Чтобы пройти этот трек, войдите в личный кабинет.',
            loginCta: 'Войти и пройти трек',
            returnTo: trackUrl(id),
            contentAvailable: false,
          })
        : { id, loginPrompt: 'Чтобы пройти этот трек, войдите в личный кабинет.', loginCta: 'Войти и пройти трек', possibleContinuations: [], continuationNote: 'Продолжение зависит от результата прохождения' };
      return json({ ok: true, meta }, 200, origin);
    }
    if (!pack) return json({ ok: false, code: 'unknown_track' }, 404, origin);
    const auth = await requireUser(request, env, origin);
    if (auth.error) return json({ ok: false, code: 'denied', lockReason: 'AUTH_REQUIRED' }, 401, origin);
    if (!isBetaOn(env)) return json({ ok: false, code: 'denied', lockReason: 'FEATURE_DISABLED' }, 403, origin);
    if (!inBetaCohort(auth.row, env)) return denyCohort(origin, json);
    if (BLOCKED[pack.content.contentStatus] || !BETA_STATUSES[pack.content.contentStatus]) {
      return json({ ok: false, code: 'denied', lockReason: 'CONTENT_UNAVAILABLE' }, 403, origin);
    }
    return json({ ok: true, trackId: id, contentVersion: pack.content.version, body: pack.content, kind: 'PAID', sandbox: false, liveInstance: true, beta: true }, 200, origin);
  }

  if (path === '/api/v1/me/cabinet' && method === 'GET') {
    const auth = await requireUser(request, env, origin);
    if (auth.error) return auth.error;
    if (!isBetaOn(env)) return json({ ok: false, code: 'FEATURE_DISABLED' }, 403, origin);
    if (!inBetaCohort(auth.row, env)) return denyCohort(origin, json);
    const state = await loadBeta(env, auth.session.userKey);
    return json({ ok: true, cabinet: cabinetOf(state), ownerReview: false, reviewUrl: null }, 200, origin);
  }

  if (path === '/api/v1/track-instances' && method === 'POST') {
    const auth = await requireUser(request, env, origin);
    if (auth.error) return auth.error;
    if (!isBetaOn(env)) return json({ ok: false, code: 'FEATURE_DISABLED' }, 403, origin);
    if (!inBetaCohort(auth.row, env)) return denyCohort(origin, json);
    const body = ctx.body || {};
    const trackId = catalogNormalize(body.trackId) || String(body.trackId || '').toUpperCase();
    if (!PACKAGES[trackId] || !['TRACK', 'REMEDIATION'].includes(PACKAGES[trackId].entityType) || installedIds().indexOf(trackId) < 0) {
      return json({ ok: false, code: 'unknown_track' }, 400, origin);
    }
    const state = await loadBeta(env, auth.session.userKey);
    const instance = {
      instanceId: newId('ti'),
      userId: auth.session.userKey,
      trackId,
      instanceStatus: 'active',
      startedAt: new Date().toISOString(),
      completedAt: null,
      waitUntil: null,
      lastStepId: 'select_goal',
      lastStepLabel: 'Что вы хотите получить этим сообщением?',
      lastMentorEvent: 'action_planned',
    };
    state.instances.push(instance);
    await saveBeta(env, auth.session.userKey, state);
    return json({ ok: true, instance }, 201, origin);
  }

  const systemActionMatch = path.match(/^\/api\/v1\/system-actions\/([^/]+)\/content$/);
  if (systemActionMatch && method === 'GET') {
    const id = catalogNormalize(decodeURIComponent(systemActionMatch[1])) || String(systemActionMatch[1] || '').toUpperCase();
    const pack = PACKAGES[id];
    if (!pack || pack.entityType !== 'SYSTEM_ACTION') return json({ ok: false, code: 'unknown_system_action' }, 404, origin);
    const auth = await requireUser(request, env, origin);
    if (auth.error) return json({ ok: false, code: 'denied', lockReason: 'AUTH_REQUIRED' }, 401, origin);
    if (!isBetaOn(env)) return json({ ok: false, code: 'denied', lockReason: 'FEATURE_DISABLED' }, 403, origin);
    if (!inBetaCohort(auth.row, env)) return denyCohort(origin, json);
    if (!systemActionInstalled(id)) return json({ ok: false, code: 'denied', lockReason: 'CONTENT_UNAVAILABLE' }, 403, origin);
    return json({ ok: true, systemActionId: id, contentVersion: pack.content.version, body: pack.content, beta: true }, 200, origin);
  }

  const outcomeMatch = path.match(/^\/api\/v1\/track-instances\/([^/]+)\/outcomes$/);
  if (outcomeMatch && method === 'POST') {
    const auth = await requireUser(request, env, origin);
    if (auth.error) return auth.error;
    if (!isBetaOn(env)) return json({ ok: false, code: 'FEATURE_DISABLED' }, 403, origin);
    if (!inBetaCohort(auth.row, env)) return denyCohort(origin, json);
    const body = ctx.body || {};
    const state = await loadBeta(env, auth.session.userKey);
    const instance = state.instances.find((row) => row.instanceId === outcomeMatch[1] && row.userId === auth.session.userKey);
    if (!instance) return json({ ok: false, code: 'instance_not_found' }, 404, origin);

    if (String(body.systemActionId || '').toUpperCase() === 'A3-008') {
      if (!systemActionInstalled('A3-008')) return json({ ok: false, code: 'denied', lockReason: 'CONTENT_UNAVAILABLE' }, 403, origin);
      const contact = body.contact && typeof body.contact === 'object' ? body.contact : {};
      const outcomeValue = String(contact.outcome || '');
      const outcomeMap = {
        MEETING_CONFIRMED: 'RESULT_MEETING',
        LATER: 'RESULT_LATER',
        REFUSAL: 'RESULT_REFUSAL',
        NO_REPLY: 'RESULT_NO_REPLY',
        REFERRAL_WITH_PERMISSION: 'RESULT_REFERRAL',
        NO_NEXT_ACTION: 'RESULT_DONE',
      };
      const outcomeCode = outcomeMap[outcomeValue];
      if (!outcomeCode) return json({ ok: false, code: 'validation_failed' }, 400, origin);
      const facts = {
        'contact.outcome': outcomeValue,
        occurred_at: body.occurredAt,
        meeting_at: body.meetingAt,
        meeting_format_code: body.meetingFormatCode,
        follow_up_permission: body.followUpPermission,
        next_action_at: body.nextActionAt,
        referral_permission_confirmed: body.referralPermissionConfirmed,
        wait_until: body.waitUntil,
        retry_count: body.retryCount,
        stop_code: body.stopCode,
      };
      const rule = matchRule('A3-008', outcomeCode, facts);
      const dest = destinationView(rule, instance.trackId);
      const decision = {
        matchedRuleId: rule ? rule.ruleId : null,
        destinationType: dest.destinationType,
        destinationId: dest.destinationId,
        destinationUrl: dest.href,
        locked: dest.preparing || (dest.destinationType === 'TRACK' && !flags.PAID_TRACK_NAVIGATION_ENABLED),
        preparingDestination: dest.preparing,
        betaPilot: true,
        reasonCode: rule ? 'MATCHED' : 'NO_MATCHING_RULE',
        next: dest,
      };
      instance.pendingSystemActionId = null;
      if (dest.destinationType === 'DONE') instance.instanceStatus = 'completed';
      else if (dest.destinationType === 'WAIT_UNTIL') instance.instanceStatus = 'waiting';
      instance.lastMentorEvent = 'result_recorded';
      state.outcomes.push({ outcomeCode, facts, at: new Date().toISOString(), systemActionId: 'A3-008' });
      state.decisions.push(decision);
      await saveBeta(env, auth.session.userKey, state);
      return json({ ok: true, decision }, 200, origin);
    }

    const facts = body.facts && typeof body.facts === 'object' ? body.facts : {};
    ['contact_name', 'phone', 'email', 'message_draft', 'real_reason_text', 'message_text', 'response_text'].forEach((key) => {
      delete facts[key];
    });
    const outcomeCode = String(body.outcomeCode || '').toUpperCase();
    const rule = matchRule(instance.trackId, outcomeCode, facts);
    const dest = destinationView(rule, instance.trackId);
    const decision = {
      matchedRuleId: rule ? rule.ruleId : null,
      destinationType: dest.destinationType,
      destinationId: dest.destinationId,
      destinationUrl: dest.href,
      locked: dest.preparing,
      preparingDestination: dest.preparing,
      betaPilot: true,
      reasonCode: rule ? 'MATCHED' : 'NO_MATCHING_RULE',
      next: dest,
    };
    if (dest.destinationType === 'DONE') instance.instanceStatus = 'completed';
    else if (dest.destinationType === 'SYSTEM_ACTION' && dest.destinationId) instance.pendingSystemActionId = dest.destinationId;
    instance.lastMentorEvent = 'result_recorded';
    state.outcomes.push({ outcomeCode, facts, at: new Date().toISOString() });
    state.decisions.push(decision);
    await saveBeta(env, auth.session.userKey, state);
    return json({ ok: true, decision }, 200, origin);
  }

  return null;
}

export { betaFlags, PACKAGES, installedIds };
