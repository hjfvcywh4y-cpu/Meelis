import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import worker from '../../account-proxy/worker.js';
import { resetRateLimitForTests } from '../../account-proxy/account-core.js';

function memoryEnv(secret) {
  const store = new Map();
  return {
    MLMA_SESSION_SECRET: secret || 'test-secret',
    MLMA_ACCOUNT: {
      get: async (key) => store.get(key) || null,
      put: async (key, value) => { store.set(key, value); },
    },
    _store: store,
  };
}

async function call(env, path, body, cookie, origin) {
  const headers = { 'Content-Type': 'application/json' };
  if (origin !== '') headers.Origin = origin === undefined ? 'https://mlmacademy.ru' : origin;
  if (cookie) headers.Cookie = cookie;
  const res = await worker.fetch(
    new Request('https://mlma-account.test' + path, {
      method: 'POST',
      headers,
      body: JSON.stringify(body || {}),
    }),
    env,
  );
  const data = await res.json();
  return { status: res.status, data, cookie: res.headers.get('Set-Cookie') || '' };
}

function sid(setCookie) {
  const m = String(setCookie).match(/mlma_sid=([^;]+)/);
  return m ? 'mlma_sid=' + m[1] : '';
}

describe('Account API Worker', () => {
  it('сохраняет маршрут, не дублирует и не отдаёт чужие данные', async () => {
    resetRateLimitForTests();
    const env = memoryEnv();
    const a = await call(env, '/api/session/bind', { maId: '1', email: 'a@b.c', name: 'A' });
    assert.equal(a.status, 200);
    assert.equal(a.data.identityLevel, 'tilda_unverified');
    assert.deepEqual(a.data.account.user.groups, ['FREE']);
    assert.ok(String(a.cookie).includes('HttpOnly'));
    assert.ok(String(a.cookie).includes('Secure'));
    assert.ok(String(a.cookie).includes('SameSite=None'));
    const cookieA = sid(a.cookie);
    const save1 = await call(env, '/api/account/route/save', { trackId: 'A1-010' }, cookieA);
    assert.equal(save1.data.ok, true);
    assert.equal(save1.data.added, true);
    const save2 = await call(env, '/api/account/route/save', { trackId: 'A1-010' }, cookieA);
    assert.equal(save2.data.duplicate, true);
    assert.deepEqual(save2.data.account.savedTrackIds, ['A1-010']);

    const b = await call(env, '/api/session/bind', { maId: '2', email: 'b@b.c', name: 'B' });
    const cookieB = sid(b.cookie);
    const other = await call(env, '/api/account/get', {}, cookieB);
    assert.deepEqual(other.data.account.savedTrackIds, []);

    const stolen = await call(env, '/api/account/get', { maId: '1', email: 'a@b.c' }, cookieB);
    assert.deepEqual(stolen.data.account.savedTrackIds, []);

    const anon = await call(env, '/api/account/get', { maId: '1' });
    assert.equal(anon.status, 401);
  });

  it('мигрирует localStorage без потери при ошибке каталога', async () => {
    resetRateLimitForTests();
    const env = memoryEnv();
    const a = await call(env, '/api/session/bind', { email: 'm@b.c', maId: '9' });
    const cookieA = sid(a.cookie);
    const mig = await call(env, '/api/account/migrate', { trackIds: ['A1-010', 'A1-010', 'NOPE'] }, cookieA);
    assert.equal(mig.data.ok, true);
    assert.deepEqual(mig.data.account.savedTrackIds, ['A1-010']);
  });

  it('bind не выдаёт START и требует Origin', async () => {
    resetRateLimitForTests();
    const env = memoryEnv();
    const noOrigin = await call(env, '/api/session/bind', { maId: '3', email: 'c@b.c' }, '', '');
    assert.equal(noOrigin.status, 403);
    const paidAttempt = await call(env, '/api/session/bind', {
      maId: '4',
      email: 'd@b.c',
      groups: ['ADMIN', 'FULL'],
      entitlements: [{ productId: 'full', status: 'active' }],
    });
    assert.equal(paidAttempt.status, 200);
    assert.equal(paidAttempt.data.identityLevel, 'tilda_unverified');
    assert.deepEqual(paidAttempt.data.account.user.groups, ['FREE']);
    assert.deepEqual(paidAttempt.data.account.entitlements, []);
  });

  it('ротация сессии инвалидирует старую cookie', async () => {
    resetRateLimitForTests();
    const env = memoryEnv();
    const first = await call(env, '/api/session/bind', { maId: '5', email: 'e@b.c' });
    const oldCookie = sid(first.cookie);
    await call(env, '/api/account/route/save', { trackId: 'A1-010' }, oldCookie);
    const second = await call(env, '/api/session/bind', { maId: '5', email: 'e@b.c' });
    const newCookie = sid(second.cookie);
    const stale = await call(env, '/api/account/get', {}, oldCookie);
    assert.equal(stale.status, 401);
    const fresh = await call(env, '/api/account/get', {}, newCookie);
    assert.deepEqual(fresh.data.account.savedTrackIds, ['A1-010']);
    assert.equal(fresh.data.identityLevel, 'tilda_unverified');
  });

  it('не принимает GET и не открывает entitlements без verified', async () => {
    resetRateLimitForTests();
    const env = memoryEnv();
    const getSave = await worker.fetch(
      new Request('https://mlma-account.test/api/account/route/save', {
        method: 'GET',
        headers: { Origin: 'https://mlmacademy.ru' },
      }),
      env,
    );
    assert.equal(getSave.status, 405);
    const entitlements = await call(env, '/api/account/entitlements', { groups: ['FULL'] });
    assert.equal(entitlements.status, 403);
    const verified = await call(env, '/api/session/verified', {});
    assert.equal(verified.status, 501);
    assert.equal(verified.data.identityLevel, 'tilda_unverified');
  });
});
