/**
 * Cloudflare Worker кабинета MLM Academy.
 * Секреты только в env воркера. Клиентский userId не авторизует чтение.
 *
 * Ограничение идентификации Tilda: нет документированного server-side
 * verify для member token. Первый bind принимает maId/email с gated-страницы
 * Members (Origin mlmacademy.ru). Дальше все запросы идут по HMAC-cookie.
 * Платные права этим bind не выдаются.
 */
import {
  COOKIE_NAME,
  SESSION_TTL_SEC,
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
  identityFromBindBody,
  userKeyFromIdentity,
  normalizeTrackId,
  nowIso,
} from './account-core.js';

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
  row.user.email = identity.email || row.user.email;
  row.user.maId = identity.maId || row.user.maId;
  row.user.name = identity.name || row.user.name;
  row.user.phone = identity.phone || row.user.phone;
  if (!row.user.groups || !row.user.groups.length) row.user.groups = ['FREE'];
  if (!row.profile.displayName && identity.name) row.profile.displayName = identity.name;
  return row;
}

async function requireUser(request, env, origin) {
  const session = await sessionFromRequest(request, env);
  if (!session) return { error: json({ ok: false, reason: 'unauthorized' }, 401, origin) };
  let row = await loadAccount(env, session.userKey);
  if (!row) {
    row = emptyAccount({ email: session.userKey.indexOf('em:') === 0 ? session.userKey.slice(3) : '', maId: session.userKey.indexOf('ma:') === 0 ? session.userKey.slice(3) : '' });
    await saveAccount(env, session.userKey, row);
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

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const path = pathname(request);
    if (path === '/api/health' || path === '/health') {
      return json({ ok: true, service: 'mlma-account' }, 200, origin);
    }

    if (!env.MLMA_SESSION_SECRET) {
      return json({ ok: false, reason: 'server_misconfigured' }, 500, origin);
    }
    if (!env.MLMA_ACCOUNT) {
      return json({ ok: false, reason: 'kv_missing' }, 500, origin);
    }

    let body = {};
    if (request.method === 'POST') {
      try {
        body = await request.json();
      } catch (err) {
        body = {};
      }
    }

    if (path === '/api/session/bind' && request.method === 'POST') {
      const allowed = corsHeaders(origin)['Access-Control-Allow-Origin'];
      if (!allowed && origin) return json({ ok: false, reason: 'origin_denied' }, 403, origin);
      const identity = identityFromBindBody(body);
      if (!identity) return json({ ok: false, reason: 'identity_required' }, 400, origin);
      const userKey = userKeyFromIdentity(identity);
      if (!userKey) return json({ ok: false, reason: 'identity_required' }, 400, origin);
      let row = await loadAccount(env, userKey);
      if (!row) row = emptyAccount(identity);
      else applyIdentity(row, identity);
      await saveAccount(env, userKey, row);
      const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
      const token = await signSession(env.MLMA_SESSION_SECRET, userKey, exp);
      return json(
        { ok: true, account: publicAccount(row), identityBridge: 'tilda_client_bind' },
        200,
        origin,
        { 'Set-Cookie': cookieHeader(token, request.url) },
      );
    }

    if (path === '/api/account/get' && request.method === 'POST') {
      const auth = await requireUser(request, env, origin);
      if (auth.error) return auth.error;
      return json({ ok: true, account: publicAccount(auth.row) }, 200, origin);
    }

    if (path === '/api/account/profile' && request.method === 'POST') {
      const auth = await requireUser(request, env, origin);
      if (auth.error) return auth.error;
      auth.row.profile = Object.assign({}, auth.row.profile, sanitizeProfile(body.profile || body));
      await saveAccount(env, auth.session.userKey, auth.row);
      return json({ ok: true, account: publicAccount(auth.row) }, 200, origin);
    }

    if (path === '/api/account/route/save' && request.method === 'POST') {
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

    if (path === '/api/account/route/delete' && request.method === 'POST') {
      const auth = await requireUser(request, env, origin);
      if (auth.error) return auth.error;
      const result = removeTrackId(auth.row.savedTrackIds, body.trackId);
      auth.row.savedTrackIds = result.trackIds;
      auth.row.route = { trackIds: result.trackIds };
      await saveAccount(env, auth.session.userKey, auth.row);
      return json({ ok: true, removed: result.removed, account: publicAccount(auth.row) }, 200, origin);
    }

    if (path === '/api/account/route/reorder' && request.method === 'POST') {
      const auth = await requireUser(request, env, origin);
      if (auth.error) return auth.error;
      const next = reorderTrackIds(auth.row.savedTrackIds, body.trackIds || []);
      auth.row.savedTrackIds = next;
      auth.row.route = { trackIds: next };
      await saveAccount(env, auth.session.userKey, auth.row);
      return json({ ok: true, account: publicAccount(auth.row) }, 200, origin);
    }

    if (path === '/api/account/migrate' && request.method === 'POST') {
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

    if (path === '/api/account/run' && request.method === 'POST') {
      const auth = await requireUser(request, env, origin);
      if (auth.error) return auth.error;
      const trackId = normalizeTrackId(body.trackId);
      if (!trackId) return json({ ok: false, reason: 'unknown_track' }, 400, origin);
      const runtime = body.runtime && typeof body.runtime === 'object' ? body.runtime : {};
      auth.row.runs = auth.row.runs || {};
      auth.row.runs[trackId] = {
        status: String(runtime.status || 'active').slice(0, 40),
        step: String(runtime.step || '').slice(0, 40),
        updatedAt: nowIso(),
      };
      await saveAccount(env, auth.session.userKey, auth.row);
      return json({ ok: true, account: publicAccount(auth.row) }, 200, origin);
    }

    if (path === '/api/analytics' && request.method === 'POST') {
      const session = await sessionFromRequest(request, env);
      const event = sanitizeAnalytics(body.name, body.data || body);
      if (session && env.MLMA_ACCOUNT) {
        const key = 'evt:' + session.userKey + ':' + Date.now();
        await env.MLMA_ACCOUNT.put(key, JSON.stringify({ userKey: session.userKey, event, at: nowIso() }), { expirationTtl: 60 * 60 * 24 * 30 });
      }
      return json({ ok: true }, 200, origin);
    }

    return json({ ok: false, reason: 'not_found' }, 404, origin);
  },
};
