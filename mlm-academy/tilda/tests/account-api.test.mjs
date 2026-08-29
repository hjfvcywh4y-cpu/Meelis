import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import worker from '../../account-proxy/worker.js';

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
  const headers = { 'Content-Type': 'application/json', Origin: origin || 'https://mlmacademy.ru' };
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
    const env = memoryEnv();
    const a = await call(env, '/api/session/bind', { maId: '1', email: 'a@b.c', name: 'A' });
    assert.equal(a.status, 200);
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
    const env = memoryEnv();
    const a = await call(env, '/api/session/bind', { email: 'm@b.c', maId: '9' });
    const cookieA = sid(a.cookie);
    const mig = await call(env, '/api/account/migrate', { trackIds: ['A1-010', 'A1-010', 'NOPE'] }, cookieA);
    assert.equal(mig.data.ok, true);
    assert.deepEqual(mig.data.account.savedTrackIds, ['A1-010']);
  });
});
