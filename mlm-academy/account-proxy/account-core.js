/**
 * Серверная логика кабинета: сессия HMAC, маршрут, миграция.
 * Платные права здесь не выдаются клиентским userId.
 *
 * identityLevel:
 * - tilda_unverified — временная сессия после bind maId/email с Origin Академии.
 *   Разрешено: Track ID маршрута, порядок, неплатный профиль, миграция localStorage.
 * - verified — будущая серверно подтверждённая личность (Supabase / webhook).
 *   Только она может читать и менять entitlements, покупки и платное содержание.
 *
 * Уровень из cookie не является доказательством verified.
 */
import { TRACK_IDS } from './track-ids.js';

export const TRACK_ID_SET = new Set(TRACK_IDS);
export const ALLOWED_GROUPS = ['FREE', 'START', 'FULL', 'PILOT', 'ADMIN'];
export const PAID_GROUPS = ['START', 'FULL', 'PILOT', 'ADMIN'];
export const IDENTITY_TILDA_UNVERIFIED = 'tilda_unverified';
export const IDENTITY_VERIFIED = 'verified';
export const COOKIE_NAME = 'mlma_sid';
export const SESSION_TTL_SEC = 60 * 60 * 24 * 7;
export const MAX_BODY_BYTES = 16 * 1024;
export const RATE_BIND_LIMIT = 20;
export const RATE_BIND_WINDOW_MS = 10 * 60 * 1000;
export const RATE_API_LIMIT = 90;
export const RATE_API_WINDOW_MS = 60 * 1000;
const ANALYTICS_BLOCKED = /password|passwd|secret|token|card|pan|cvv|cvc|iban|artifact|answer|message_body|full_text|candidateDescriptor|descriptor|reasonText|planText|personalData|completedArtifact/i;

export function nowIso(date = new Date()) {
  return date.toISOString();
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeMaId(value) {
  return String(value || '').trim();
}

export function normalizeTrackId(value) {
  const raw = String(value || '').trim().toUpperCase();
  return TRACK_ID_SET.has(raw) ? raw : '';
}

export function userKeyFromIdentity(identity) {
  const maId = normalizeMaId(identity && identity.maId);
  if (maId) return 'ma:' + maId;
  const email = normalizeEmail(identity && identity.email);
  if (email && email.includes('@')) return 'em:' + email;
  return '';
}

export function emailAliasKey(identity) {
  const email = normalizeEmail(identity && identity.email);
  if (email && email.includes('@')) return 'em:' + email;
  return '';
}

export function mergeAccountRows(primary, alias) {
  if (!alias) return primary;
  if (!primary) return alias;
  const merged = mergeTrackIds(primary.savedTrackIds, alias.savedTrackIds);
  primary.savedTrackIds = merged.trackIds;
  primary.route = { trackIds: merged.trackIds };
  if (!primary.profile || !primary.profile.displayName) {
    primary.profile = Object.assign({}, alias.profile || {}, primary.profile || {});
  }
  return primary;
}

export function isVerifiedIdentity(level) {
  return level === IDENTITY_VERIFIED;
}

export function newSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function publicGroups(row) {
  if (isVerifiedIdentity(row && row.identityLevel)) {
    const groups = Array.isArray(row.user && row.user.groups) ? row.user.groups : [];
    const out = [];
    groups.forEach((name) => {
      if (ALLOWED_GROUPS.indexOf(name) >= 0 && out.indexOf(name) < 0) out.push(name);
    });
    if (out.indexOf('FREE') < 0) out.unshift('FREE');
    return out;
  }
  return ['FREE'];
}

export function emptyAccount(identity) {
  const email = normalizeEmail(identity && identity.email);
  const maId = normalizeMaId(identity && identity.maId);
  return {
    identityLevel: IDENTITY_TILDA_UNVERIFIED,
    sessionSid: '',
    user: {
      maId,
      email,
      name: String((identity && identity.name) || '').trim(),
      phone: String((identity && identity.phone) || '').trim(),
      groups: ['FREE'],
    },
    profile: {
      displayName: String((identity && identity.name) || '').trim(),
      partnerRole: '',
      experience: '',
      currentTask: '',
      difficulty: '',
      desiredResult: '',
      availableTime: '',
      selectedSectionId: null,
      consentAt: '',
      onboardingComplete: false,
      notifyEmail: true,
    },
    entitlements: [],
    orders: [],
    payments: [],
    savedTrackIds: [],
    route: { trackIds: [] },
    runs: {},
    artifacts: [],
    migratedLocalAt: '',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

export function publicAccount(row) {
  if (!row) return null;
  const verified = isVerifiedIdentity(row.identityLevel);
  return {
    identityLevel: verified ? IDENTITY_VERIFIED : IDENTITY_TILDA_UNVERIFIED,
    identityBridge: verified ? 'server_verified' : 'tilda_client_bind',
    user: {
      maId: row.user.maId,
      email: row.user.email,
      name: row.user.name,
      phone: row.user.phone,
      groups: publicGroups(row),
    },
    profile: row.profile || {},
    entitlements: verified && Array.isArray(row.entitlements) ? row.entitlements : [],
    orders: verified && Array.isArray(row.orders) ? row.orders : [],
    payments: verified && Array.isArray(row.payments) ? row.payments : [],
    savedTrackIds: Array.isArray(row.savedTrackIds) ? row.savedTrackIds.slice() : [],
    route: { trackIds: ((row.route && row.route.trackIds) || row.savedTrackIds || []).slice() },
    runs: publicRuns(row.runs),
    artifacts: [],
    migratedLocalAt: row.migratedLocalAt || '',
    storageMode: 'server',
    updatedAt: row.updatedAt || '',
  };
}

export function mergeTrackIds(current, incoming) {
  const out = [];
  const seen = {};
  function push(id) {
    const trackId = normalizeTrackId(id);
    if (!trackId || seen[trackId]) return false;
    seen[trackId] = true;
    out.push(trackId);
    return true;
  }
  (current || []).forEach(push);
  let added = 0;
  (incoming || []).forEach((id) => {
    if (push(id)) added += 1;
  });
  return { trackIds: out, added };
}

export function removeTrackId(current, trackId) {
  const id = normalizeTrackId(trackId);
  const next = (current || []).filter((item) => item !== id);
  return { trackIds: next, removed: next.length !== (current || []).length };
}

export function reorderTrackIds(current, ordered) {
  const allowed = new Set((current || []).map((id) => normalizeTrackId(id)).filter(Boolean));
  const next = [];
  const seen = {};
  (ordered || []).forEach((id) => {
    const trackId = normalizeTrackId(id);
    if (!trackId || !allowed.has(trackId) || seen[trackId]) return;
    seen[trackId] = true;
    next.push(trackId);
  });
  (current || []).forEach((id) => {
    if (!seen[id]) next.push(id);
  });
  return next;
}

export function publicRuns(runs) {
  const out = {};
  if (!runs || typeof runs !== 'object') return out;
  Object.keys(runs).forEach((id) => {
    out[id] = sanitizeRunMeta(runs[id]);
  });
  return out;
}

export function sanitizeRunMeta(runtime) {
  const src = runtime && typeof runtime === 'object' ? runtime : {};
  return {
    status: String(src.status || '').slice(0, 40),
    step: String(src.step || '').slice(0, 40),
    trackVersion: String(src.trackVersion || '').slice(0, 40),
    startedAt: String(src.startedAt || '').slice(0, 40),
    completedAt: String(src.completedAt || '').slice(0, 40),
    updatedAt: String(src.updatedAt || '').slice(0, 40),
    branch: String(src.branch || '').slice(0, 40),
    nextTrackId: String(src.nextTrackId || '').slice(0, 16),
  };
}

export function sanitizeProfile(profile) {
  const src = profile || {};
  return {
    displayName: String(src.displayName || '').trim().slice(0, 80),
    partnerRole: ['novice', 'partner', 'leader'].indexOf(src.partnerRole) >= 0 ? src.partnerRole : '',
    experience: String(src.experience || '').slice(0, 40),
    currentTask: String(src.currentTask || src.currentGoal || '').trim().slice(0, 240),
    difficulty: String(src.difficulty || '').trim().slice(0, 240),
    desiredResult: String(src.desiredResult || '').trim().slice(0, 240),
    availableTime: String(src.availableTime || '').slice(0, 20),
    selectedSectionId: src.selectedSectionId || null,
    consentAt: src.consentAt || '',
    onboardingComplete: !!src.onboardingComplete,
    notifyEmail: src.notifyEmail !== false,
  };
}

export function sanitizeAnalytics(name, payload) {
  const out = {};
  if (!payload || typeof payload !== 'object') return { name: String(name || ''), data: out };
  Object.keys(payload).forEach((key) => {
    if (ANALYTICS_BLOCKED.test(key)) return;
    let value = payload[key];
    if (key === 'query' || key === 'q' || key === 'search_query') {
      const text = String(value || '');
      out.queryLength = text.length;
      let hash = 5381;
      const lower = text.trim().toLowerCase();
      for (let i = 0; i < lower.length; i += 1) hash = ((hash << 5) + hash + lower.charCodeAt(i)) | 0;
      out.queryHash = 'q' + (hash >>> 0).toString(16);
      return;
    }
    if (typeof value === 'string' && value.length > 180) value = value.slice(0, 180);
    if (key === 'email' && typeof value === 'string') {
      const at = value.indexOf('@');
      value = at > 1 ? value.slice(0, 1) + '***' + value.slice(at) : '***';
    }
    out[key] = value;
  });
  return { name: String(name || '').slice(0, 80), data: out };
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return toHex(sig);
}

function macEqual(expected, actual) {
  if (!expected || !actual || expected.length !== actual.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  return diff === 0;
}

function tokenPart(value) {
  return encodeURIComponent(String(value)).replace(/\./g, '%2E');
}

export async function signSession(secret, userKey, exp, extra = {}) {
  const sid = extra.sid || newSessionId();
  const payload = sid + '.' + userKey + '.' + exp;
  const mac = await hmacHex(secret, payload);
  return 'v2.' + tokenPart(sid) + '.' + tokenPart(userKey) + '.' + exp + '.' + mac;
}

export async function verifySession(secret, token) {
  if (!secret || !token) return null;
  const parts = String(token).split('.');
  if (parts[0] === 'v2' && parts.length === 5) {
    const sid = decodeURIComponent(parts[1] || '');
    const userKey = decodeURIComponent(parts[2] || '');
    const exp = Number(parts[3]);
    const mac = parts[4];
    if (!sid || !userKey || !exp || !mac) return null;
    if (exp * 1000 < Date.now()) return null;
    const expected = await hmacHex(secret, sid + '.' + userKey + '.' + exp);
    if (!macEqual(expected, mac)) return null;
    return { userKey, exp, sid };
  }
  if (parts.length === 4 && parts[0] === 'v1') {
    const userKey = decodeURIComponent(parts[1] || '');
    const exp = Number(parts[2]);
    const mac = parts[3];
    if (!userKey || !exp || !mac) return null;
    if (exp * 1000 < Date.now()) return null;
    const expected = await hmacHex(secret, userKey + '.' + exp);
    if (!macEqual(expected, mac)) return null;
    return { userKey, exp, sid: '' };
  }
  return null;
}

export function parseCookie(header, name) {
  const raw = String(header || '');
  const parts = raw.split(';');
  for (let i = 0; i < parts.length; i += 1) {
    const row = parts[i].trim();
    if (row.indexOf(name + '=') === 0) return decodeURIComponent(row.slice(name.length + 1));
  }
  return '';
}

export function allowedOrigin(origin, extra = []) {
  const list = [
    'https://mlmacademy.ru',
    'https://www.mlmacademy.ru',
    'http://127.0.0.1:4173',
    'http://localhost:4173',
    'http://127.0.0.1:8788',
    'http://localhost:8788',
  ].concat(extra || []);
  if (!origin) return '';
  if (list.indexOf(origin) !== -1) return origin;
  if (/^https:\/\/[a-z0-9-]+\.tilda\.ws$/i.test(origin)) return origin;
  return '';
}

export function corsHeaders(origin) {
  const allow = allowedOrigin(origin);
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (allow) headers['Access-Control-Allow-Origin'] = allow;
  return headers;
}

export function identityFromBindBody(body) {
  const email = normalizeEmail(body && (body.email || body.login));
  const maId = normalizeMaId(body && (body.maId || body.id));
  const name = String((body && body.name) || '').trim().slice(0, 80);
  const phone = String((body && body.phone) || '').trim().slice(0, 40);
  if (!email && !maId) return null;
  if (email && !email.includes('@')) return null;
  return { email, maId, name, phone };
}

export function clientIp(request) {
  const cf = request && request.headers && request.headers.get('CF-Connecting-IP');
  if (cf) return String(cf).slice(0, 64);
  const fwd = request && request.headers && request.headers.get('X-Forwarded-For');
  if (fwd) return String(fwd).split(',')[0].trim().slice(0, 64);
  return 'unknown';
}

const rateBuckets = new Map();

export function rateLimitHit(key, limit, windowMs) {
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.start > windowMs) {
    bucket = { start: now, n: 0 };
    rateBuckets.set(key, bucket);
  }
  bucket.n += 1;
  if (rateBuckets.size > 4000) {
    for (const [id, item] of rateBuckets) {
      if (now - item.start > windowMs) rateBuckets.delete(id);
    }
  }
  return bucket.n > limit;
}

export function resetRateLimitForTests() {
  rateBuckets.clear();
}

export function allowedMethod(path, method) {
  if (method === 'OPTIONS') return true;
  if (path === '/api/health' || path === '/health') return method === 'GET' || method === 'HEAD';
  if (path === '/api/me/entitlements') return method === 'GET' || method === 'POST';
  if (path === '/api/commerce/preview') return method === 'GET' || method === 'POST';
  if (path === '/api/webhooks/yookassa') return method === 'POST';
  return method === 'POST';
}

export const PAYMENT_PATHS = [
  '/api/checkout/create',
  '/api/webhooks/yookassa',
  '/api/me/entitlements',
  '/api/refunds/process',
  '/api/commerce/preview',
];

export function paymentsEnabled(env) {
  return String((env && env.PAYMENTS_ENABLED) || '').toLowerCase() === 'true';
}

export function commercePreviewEnabled(env) {
  return String((env && env.COMMERCE_PREVIEW_ENABLED) || '').toLowerCase() === 'true';
}

export function testMode(env) {
  const raw = env && env.TEST_MODE;
  if (raw == null || raw === '') return true;
  return String(raw).toLowerCase() !== 'false';
}
