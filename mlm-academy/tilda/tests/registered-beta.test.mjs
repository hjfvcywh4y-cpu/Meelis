import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import worker from '../../account-proxy/worker.js';
import { resetRateLimitForTests } from '../../account-proxy/account-core.js';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function memoryEnv() {
  const store = new Map();
  return {
    MLMA_SESSION_SECRET: 'test-secret',
    REGISTERED_BETA_ACCESS_ENABLED: 'true',
    PAYMENTS_ENABLED: 'false',
    MLMA_ACCOUNT: {
      get: async (key) => store.get(key) || null,
      put: async (key, value) => { store.set(key, value); },
    },
  };
}

async function call(env, path, opts = {}) {
  const headers = { Accept: 'application/json' };
  if (opts.origin !== '') headers.Origin = opts.origin === undefined ? 'https://mlmacademy.ru' : opts.origin;
  if (opts.cookie) headers.Cookie = opts.cookie;
  if (opts.body) headers['Content-Type'] = 'application/json';
  const res = await worker.fetch(
    new Request('https://mlma-account.test' + path, {
      method: opts.method || (opts.body ? 'POST' : 'GET'),
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }),
    env,
  );
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, cookie: res.headers.get('Set-Cookie') || '' };
}

function sid(setCookie) {
  const m = String(setCookie).match(/mlma_sid=([^;]+)/);
  return m ? 'mlma_sid=' + decodeURIComponent(m[1]) : '';
}

describe('registered beta worker', () => {
  it('ANON meta открыта, content закрыт; cookie открывает A3-002', async () => {
    resetRateLimitForTests();
    const env = memoryEnv();
    const meta = await call(env, '/api/v1/tracks/A3-002/meta');
    assert.equal(meta.status, 200);
    assert.equal(meta.data.meta.loginCta, 'Войти и пройти трек');
    const anon = await call(env, '/api/v1/tracks/A3-002/content');
    assert.equal(anon.status, 401);
    const bind = await call(env, '/api/session/bind', { method: 'POST', body: { maId: '11', email: 'a@b.c' } });
    const cookie = sid(bind.cookie);
    const content = await call(env, '/api/v1/tracks/A3-002/content', { cookie });
    assert.equal(content.status, 200, JSON.stringify(content.data));
    assert.equal(content.data.body.trackId, 'A3-002');
    const cabinet = await call(env, '/api/v1/me/cabinet', { cookie });
    assert.equal(cabinet.data.ownerReview, false);
    assert.equal(cabinet.data.cabinet.nextStep.trackId, 'A3-002');
  });

  it('нет owner review URL в исходниках', () => {
    const ui = fs.readFileSync(path.join(__dirname, '../src/ui.js'), 'utf8');
    assert.equal(ui.includes('/my/review/tracks'), false);
    assert.equal(ui.includes('OWNER_REVIEWER'), false);
    assert.equal(ui.includes('Чтобы пройти этот трек, войдите в личный кабинет.'), true);
  });
});
