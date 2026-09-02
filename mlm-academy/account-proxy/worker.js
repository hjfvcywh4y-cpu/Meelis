/**
 * Cloudflare Worker кабинета MLM Academy.
 * Секреты только в env воркера. Клиентский userId не авторизует чтение.
 *
 * Ограничение идентификации Tilda: нет документированного server-side
 * verify для member token. Первый bind принимает maId/email с gated-страницы
 * Members (Origin mlmacademy.ru). Дальше все запросы идут по HMAC-cookie.
 *
 * identityLevel этой сессии всегда tilda_unverified.
 * Origin, ma_id, mauser и localStorage не подтверждают личность для оплаты.
 * Платные права, entitlements и группы START/FULL/PILOT/ADMIN этим bind не выдаются.
 */
import {
  COOKIE_NAME,
  SESSION_TTL_SEC,
  MAX_BODY_BYTES,
  RATE_BIND_LIMIT,
  RATE_BIND_WINDOW_MS,
  RATE_API_LIMIT,
  RATE_API_WINDOW_MS,
  IDENTITY_TILDA_UNVERIFIED,
  emptyAccount,
  publicAccount,
  mergeTrackIds,
  removeTrackId,
  reorderTrackIds,
  sanitizeProfile,
  sanitizeAnalytics,
  signSession,
  verifySession,
  parseCookie,
  corsHeaders,
  allowedOrigin,
  identityFromBindBody,
  userKeyFromIdentity,
  emailAliasKey,
  mergeAccountRows,
  normalizeTrackId,
  nowIso,
  newSessionId,
  clientIp,
  rateLimitHit,
  allowedMethod,
  PAYMENT_PATHS,
  paymentsEnabled,
  commercePreviewEnabled,
  testMode,
  sanitizeRunMeta,
  cancelAutoRenewal,
} from './account-core.js';
import { handleArchitectureBeta } from './architecture-beta.js';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

function json(data, status, origin, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: Object.assign({}, JSON_HEADERS, corsHeaders(origin), extra),
  });
}

function cookieHeader(token, requestUrl) {
  const secure = String(requestUrl).startsWith('https:');
  const parts = [
    COOKIE_NAME + '=' + encodeURIComponent(token),
    'Path=/',
    'HttpOnly',
    'Max-Age=' + SESSION_TTL_SEC,
    secure ? 'Secure' : '',
    secure ? 'SameSite=None' : 'SameSite=Lax',
  ].filter(Boolean);
  return parts.join('; ');
}

function kvUserKey(userKey) {
  return 'user:' + userKey;
}

async function loadAccount(env, userKey) {
  if (!env.MLMA_ACCOUNT) return null;
  const raw = await env.MLMA_ACCOUNT.get(kvUserKey(userKey));
  return raw ? JSON.parse(raw) : null;
}

async function saveAccount(env, userKey, row) {
  row.updatedAt = nowIso();
  await env.MLMA_ACCOUNT.put(kvUserKey(userKey), JSON.stringify(row));
  return row;
}

async function sessionFromRequest(request, env) {
  const token = parseCookie(request.headers.get('Cookie'), COOKIE_NAME);
  return verifySession(env.MLMA_SESSION_SECRET, token);
}

function applyIdentity(row, identity) {
  if (row.identityLevel !== 'verified') {
    row.identityLevel = IDENTITY_TILDA_UNVERIFIED;
    row.user.groups = ['FREE'];
  }
  row.user.email = identity.email || row.user.email;
  row.user.maId = identity.maId || row.user.maId;
  row.user.name = identity.name || row.user.name;
  row.user.phone = identity.phone || row.user.phone;
  if (!row.profile.displayName && identity.name) row.profile.displayName = identity.name;
  return row;
}

function sessionMatches(row, session) {
  if (!session || !session.userKey) return false;
  if (!session.sid) return true;
  if (!row.sessionSid) return true;
  return row.sessionSid === session.sid;
}

async function requireUser(request, env, origin) {
  const session = await sessionFromRequest(request, env);
  if (!session) return { error: json({ ok: false, reason: 'unauthorized' }, 401, origin) };
  let row = await loadAccount(env, session.userKey);
  if (!row) {
    row = emptyAccount({
      email: session.userKey.indexOf('em:') === 0 ? session.userKey.slice(3) : '',
      maId: session.userKey.indexOf('ma:') === 0 ? session.userKey.slice(3) : '',
    });
    await saveAccount(env, session.userKey, row);
  }
  if (!sessionMatches(row, session)) {
    return { error: json({ ok: false, reason: 'unauthorized' }, 401, origin) };
  }
  return { session, row };
}

function pathname(request) {
  try {
    return new URL(request.url).pathname.replace(/\/+$/, '') || '/';
  } catch (err) {
    return '/';
  }
}

function requireAllowedOrigin(origin) {
  return !!allowedOrigin(origin);
}

async function readJsonBody(request, origin) {
  const len = Number(request.headers.get('content-length') || 0);
  if (len > MAX_BODY_BYTES) return { error: json({ ok: false, reason: 'payload_too_large' }, 413, origin) };
  let text = '';
  try {
    text = await request.text();
  } catch (err) {
    return { body: {} };
  }
  if (text.length > MAX_BODY_BYTES) return { error: json({ ok: false, reason: 'payload_too_large' }, 413, origin) };
  if (!text) return { body: {} };
  try {
    const body = JSON.parse(text);
    return { body: body && typeof body === 'object' ? body : {} };
  } catch (err) {
    return { error: json({ ok: false, reason: 'invalid_json' }, 400, origin) };
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const path = pathname(request);
    const method = request.method || 'GET';

    if (method === 'OPTIONS') {
      if (!requireAllowedOrigin(origin)) {
        return json({ ok: false, reason: 'origin_denied' }, 403, origin);
      }
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (path === '/api/health' || path === '/health') {
      if (method !== 'GET' && method !== 'HEAD') {
        return json({ ok: false, reason: 'method_not_allowed' }, 405, origin, { Allow: 'GET, HEAD, OPTIONS' });
      }
      return json(
        {
          ok: true,
          service: 'mlma-account',
          PAYMENTS_ENABLED: paymentsEnabled(env),
          COMMERCE_PREVIEW_ENABLED: commercePreviewEnabled(env),
          TEST_MODE: testMode(env),
        },
        200,
        origin,
      );
    }

    if (path.indexOf('/api/v1/') === 0) {
      if (method !== 'GET' && method !== 'POST') {
        return json({ ok: false, reason: 'method_not_allowed' }, 405, origin, { Allow: 'GET, POST, OPTIONS' });
      }
      const isPublicMeta = /\/api\/v1\/tracks\/[^/]+\/meta$/.test(path) || path === '/api/v1/flags';
      if (!isPublicMeta && !requireAllowedOrigin(origin)) {
        return json({ ok: false, reason: 'origin_denied' }, 403, origin);
      }
      if (!isPublicMeta) {
        if (!env.MLMA_SESSION_SECRET) return json({ ok: false, reason: 'server_misconfigured' }, 500, origin);
        if (!env.MLMA_ACCOUNT) return json({ ok: false, reason: 'kv_missing' }, 500, origin);
      }
      let body = {};
      if (method === 'POST') {
        const parsed = await readJsonBody(request, origin);
        if (parsed.error) return parsed.error;
        body = parsed.body || {};
      }
      const handled = await handleArchitectureBeta(request, env, {
        json,
        origin,
        requireUser,
        method,
        path,
        body,
      });
      if (handled) return handled;
      return json({ ok: false, code: 'not_found' }, 404, origin);
    }

    if (PAYMENT_PATHS.indexOf(path) !== -1) {
      if (!paymentsEnabled(env)) {
        return json(
          {
            ok: false,
            reason: 'payments_disabled',
            message: 'Оплата ещё не запущена',
            PAYMENTS_ENABLED: false,
            COMMERCE_PREVIEW_ENABLED: false,
            TEST_MODE: testMode(env),
          },
          403,
          origin,
        );
      }
      return json({ ok: false, reason: 'payments_not_configured' }, 503, origin);
    }

    if (!allowedMethod(path, method)) {
      return json({ ok: false, reason: 'method_not_allowed' }, 405, origin, { Allow: 'POST, OPTIONS' });
    }

    if (!requireAllowedOrigin(origin)) {
      return json({ ok: false, reason: 'origin_denied' }, 403, origin);
    }

    if (!env.MLMA_SESSION_SECRET) {
      return json({ ok: false, reason: 'server_misconfigured' }, 500, origin);
    }
    if (!env.MLMA_ACCOUNT) {
      return json({ ok: false, reason: 'kv_missing' }, 500, origin);
    }

    const ip = clientIp(request);
    const isBind = path === '/api/session/bind';
    if (
      rateLimitHit(
        (isBind ? 'bind:' : 'api:') + ip,
        isBind ? RATE_BIND_LIMIT : RATE_API_LIMIT,
        isBind ? RATE_BIND_WINDOW_MS : RATE_API_WINDOW_MS,
      )
    ) {
      return json({ ok: false, reason: 'rate_limited' }, 429, origin, { 'Retry-After': '60' });
    }

    if (path === '/api/session/verified') {
      return json(
        {
          ok: false,
          reason: 'verified_auth_not_configured',
          identityLevel: IDENTITY_TILDA_UNVERIFIED,
        },
        501,
        origin,
      );
    }

    if (
      path === '/api/account/entitlements' ||
      path === '/api/account/payments' ||
      path === '/api/payments/webhook'
    ) {
      return json({ ok: false, reason: 'verified_required' }, 403, origin);
    }

    const parsed = await readJsonBody(request, origin);
    if (parsed.error) return parsed.error;
    const body = parsed.body || {};

    if (path === '/api/session/bind') {
      const identity = identityFromBindBody(body);
      if (!identity) return json({ ok: false, reason: 'identity_required' }, 400, origin);
      const userKey = userKeyFromIdentity(identity);
      if (!userKey) return json({ ok: false, reason: 'identity_required' }, 400, origin);
      let row = await loadAccount(env, userKey);
      const aliasKey = emailAliasKey(identity);
      if (aliasKey && aliasKey !== userKey) {
        const alias = await loadAccount(env, aliasKey);
        if (alias) {
          row = mergeAccountRows(row || emptyAccount(identity), alias);
        }
      }
      if (!row) row = emptyAccount(identity);
      else applyIdentity(row, identity);
      if (row.identityLevel !== 'verified') {
        row.identityLevel = IDENTITY_TILDA_UNVERIFIED;
        row.user.groups = ['FREE'];
      }
      row.sessionSid = newSessionId();
      await saveAccount(env, userKey, row);
      if (aliasKey && aliasKey !== userKey) {
        await saveAccount(env, aliasKey, row);
      }
      const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
      const token = await signSession(env.MLMA_SESSION_SECRET, userKey, exp, { sid: row.sessionSid });
      const pub = publicAccount(row);
      return json(
        {
          ok: true,
          account: pub,
          identityLevel: pub.identityLevel,
          identityBridge: pub.identityBridge,
        },
        200,
        origin,
        { 'Set-Cookie': cookieHeader(token, request.url) },
      );
    }

    if (path === '/api/account/get') {
      const auth = await requireUser(request, env, origin);
      if (auth.error) return auth.error;
      const pub = publicAccount(auth.row);
      return json({ ok: true, account: pub, identityLevel: pub.identityLevel }, 200, origin);
    }

    if (path === '/api/account/profile') {
      const auth = await requireUser(request, env, origin);
      if (auth.error) return auth.error;
      auth.row.profile = Object.assign({}, auth.row.profile, sanitizeProfile(body.profile || body));
      await saveAccount(env, auth.session.userKey, auth.row);
      return json({ ok: true, account: publicAccount(auth.row) }, 200, origin);
    }

    if (path === '/api/account/route/save') {
      const auth = await requireUser(request, env, origin);
      if (auth.error) return auth.error;
      const trackId = normalizeTrackId(body.trackId);
      if (!trackId) return json({ ok: false, reason: 'unknown_track' }, 400, origin);
      const merged = mergeTrackIds(auth.row.savedTrackIds, [trackId]);
      auth.row.savedTrackIds = merged.trackIds;
      auth.row.route = { trackIds: merged.trackIds };
      await saveAccount(env, auth.session.userKey, auth.row);
      return json({ ok: true, added: merged.added > 0, duplicate: merged.added === 0, account: publicAccount(auth.row) }, 200, origin);
    }

    if (path === '/api/account/route/delete') {
      const auth = await requireUser(request, env, origin);
      if (auth.error) return auth.error;
      const result = removeTrackId(auth.row.savedTrackIds, body.trackId);
      auth.row.savedTrackIds = result.trackIds;
      auth.row.route = { trackIds: result.trackIds };
      await saveAccount(env, auth.session.userKey, auth.row);
      return json({ ok: true, removed: result.removed, account: publicAccount(auth.row) }, 200, origin);
    }

    if (path === '/api/account/route/reorder') {
      const auth = await requireUser(request, env, origin);
      if (auth.error) return auth.error;
      const next = reorderTrackIds(auth.row.savedTrackIds, body.trackIds || []);
      auth.row.savedTrackIds = next;
      auth.row.route = { trackIds: next };
      await saveAccount(env, auth.session.userKey, auth.row);
      return json({ ok: true, account: publicAccount(auth.row) }, 200, origin);
    }

    if (path === '/api/account/migrate') {
      const auth = await requireUser(request, env, origin);
      if (auth.error) return auth.error;
      const incoming = Array.isArray(body.trackIds) ? body.trackIds : [];
      const merged = mergeTrackIds(auth.row.savedTrackIds, incoming);
      auth.row.savedTrackIds = merged.trackIds;
      auth.row.route = { trackIds: merged.trackIds };
      if (body.profile) auth.row.profile = Object.assign({}, auth.row.profile, sanitizeProfile(body.profile));
      auth.row.migratedLocalAt = nowIso();
      await saveAccount(env, auth.session.userKey, auth.row);
      return json({ ok: true, added: merged.added, account: publicAccount(auth.row) }, 200, origin);
    }

    if (path === '/api/account/run') {
      const auth = await requireUser(request, env, origin);
      if (auth.error) return auth.error;
      const trackId = normalizeTrackId(body.trackId);
      if (!trackId) return json({ ok: false, reason: 'unknown_track' }, 400, origin);
      const runtime = body.runtime && typeof body.runtime === 'object' ? body.runtime : {};
      auth.row.runs = auth.row.runs || {};
      const prev = auth.row.runs[trackId] || {};
      auth.row.runs[trackId] = Object.assign({}, sanitizeRunMeta(prev), sanitizeRunMeta(runtime), {
        updatedAt: nowIso(),
      });
      delete auth.row.runs[trackId].artifact;
      delete auth.row.runs[trackId].content;
      delete auth.row.runs[trackId].evidenceNote;
      delete auth.row.runs[trackId].answer;
      await saveAccount(env, auth.session.userKey, auth.row);
      return json({ ok: true, account: publicAccount(auth.row) }, 200, origin);
    }

    if (path === '/api/account/auto-renewal/cancel') {
      const auth = await requireUser(request, env, origin);
      if (auth.error) return auth.error;
      const result = cancelAutoRenewal(auth.row, { via: body.via || 'cabinet', orderId: body.orderId || '' });
      await saveAccount(env, auth.session.userKey, auth.row);
      return json({ ok: true, result, account: publicAccount(auth.row) }, 200, origin);
    }

    if (path === '/api/analytics') {
      const session = await sessionFromRequest(request, env);
      const event = sanitizeAnalytics(body.name, body.data || body);
      if (session && env.MLMA_ACCOUNT) {
        const key = 'evt:' + Date.now() + ':' + Math.random().toString(36).slice(2, 8);
        await env.MLMA_ACCOUNT.put(key, JSON.stringify({ event, at: nowIso() }), { expirationTtl: 60 * 60 * 24 * 30 });
      }
      return json({ ok: true }, 200, origin);
    }

    return json({ ok: false, reason: 'not_found' }, 404, origin);
  },
};
