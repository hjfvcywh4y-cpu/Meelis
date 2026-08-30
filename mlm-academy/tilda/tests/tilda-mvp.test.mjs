import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, it, before } from 'node:test';
import { fileURLToPath } from 'node:url';
import worker from '../../account-proxy/worker.js';
import { resetRateLimitForTests } from '../../account-proxy/account-core.js';

const productsCatalog = JSON.parse(
  fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/data/products.catalog.json'), 'utf8'),
);

function memoryStore() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
  };
}

function installBrowserGlobals() {
  const local = memoryStore();
  const session = memoryStore();
  global.window = {
    localStorage: local,
    sessionStorage: session,
    MLMA_PAYLOAD: {
      version: '0.2',
      tracks: [{ id: 'A3-002' }, { id: 'A1-010' }, { id: 'A2-008' }],
      products: productsCatalog,
    },
    MLMA_PRODUCTS: productsCatalog,
    dataLayer: [],
  };
  global.MLMA_PRODUCTS = productsCatalog;
  global.localStorage = local;
  global.sessionStorage = session;
}

installBrowserGlobals();
const require = createRequire(import.meta.url);
require('../src/domain.js');
require('../src/access.js');
require('../src/storage.js');
require('../src/payments.js');
require('../src/commerce.js');
require('../src/legal.js');
require('../src/search.js');
require('../src/analytics.js');
const MLMA = require('../src/ontology.js');

function sampleTrack() {
  return MLMA.toPublicTrack({
    sectionId: 'A3',
    module: 'Модуль',
    trackId: 'A3-002',
    title: 'Написать первое сообщение теплому контакту',
    situation: 'Знаю, кому написать, но не знаю как начать',
    outcome: 'Готово короткое сообщение без давления',
    format: 'Практика',
    nextTrackIds: ['A3-016'],
    publicationStatus: 'planned',
    visibility: 'catalog',
    access: 'undecided',
    contentStatus: 'metadata_only',
  });
}

function memoryEnv(secret) {
  const store = new Map();
  return {
    MLMA_SESSION_SECRET: secret || 'test-secret',
    PAYMENTS_ENABLED: 'false',
    COMMERCE_PREVIEW_ENABLED: 'false',
    TEST_MODE: 'true',
    MLMA_ACCOUNT: {
      get: async (key) => store.get(key) || null,
      put: async (key, value) => {
        store.set(key, value);
      },
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

describe('Tilda-MVP: pending, runtime, analytics, payments', () => {
  before(() => {
    resetRateLimitForTests();
  });

  it('pending хранит массив без дублей и не принимает неизвестный Track ID', () => {
    MLMA.clearPendingTrackId();
    MLMA.writePendingTrackId('A3-002');
    MLMA.writePendingTrackId('A3-002');
    MLMA.writePendingTrackId('A1-010');
    MLMA.writePendingTrackId('ZZ-999');
    const list = MLMA.readPendingTracks();
    assert.deepEqual(list.map((row) => row.trackId), ['A3-002', 'A1-010']);
    assert.ok(list[0].createdAt);
    assert.ok(list[0].expiresAt);
  });

  it('локальный runtime восстанавливается после повторного чтения', () => {
    const track = sampleTrack();
    MLMA.startRuntime(track);
    const first = MLMA.getRuntime(track.trackId);
    assert.equal(first.status, 'active');
    const again = MLMA.getRuntime(track.trackId);
    assert.equal(again.status, 'active');
    assert.equal(again.step, 'action');
    const submitted = MLMA.submitRuntime(track, {
      artifact: 'Короткое сообщение знакомому без давления и без чужих телефонов, с конкретной просьбой о встрече на этой неделе.',
      evidenceNote: 'Текст сохранён в черновике и готов к отправке',
    });
    assert.equal(submitted.state.verificationLabel, 'Самопроверка по критериям');
    assert.equal(submitted.state.verificationStatus, 'self_checked');
    const listed = MLMA.listRuntimes();
    assert.equal(listed[track.trackId].status, submitted.state.status);
  });

  it('аналитика хеширует запрос и схлопывает алиасы поиска', () => {
    const clean = MLMA.sanitizeAnalytics({ query: 'боюсь написать знакомому Ивану 8900', source: 'library' });
    assert.equal(clean.query, undefined);
    assert.ok(clean.queryHash);
    assert.equal(typeof clean.queryLength, 'number');
    assert.equal(MLMA.canonicalEventName('search_query'), 'search_submitted');
    assert.equal(MLMA.canonicalEventName('track_start'), 'track_started');
    assert.equal(MLMA.canonicalEventName('track_complete'), 'track_completed');
    assert.equal(MLMA.canonicalEventName('track_next_open'), 'next_track_opened');
    assert.equal(MLMA.canonicalEventName('track_action_submitted'), 'artifact_created');
    window.dataLayer = [];
    MLMA.trackEvent('search_submitted', { query: 'один запрос', source: 'library' });
    MLMA.trackEvent('search_submitted', { query: 'один запрос', source: 'library' });
    const searches = window.dataLayer.filter((row) => row.event === 'search_submitted');
    assert.equal(searches.length, 1);
    assert.equal(searches[0].query, undefined);
  });

  it('платёжные маршруты выключены и run не сохраняет текст артефакта', async () => {
    resetRateLimitForTests();
    const env = memoryEnv();
    const health = await worker.fetch(new Request('https://mlma-account.test/api/health', { method: 'GET' }), env);
    const healthData = await health.json();
    assert.equal(healthData.PAYMENTS_ENABLED, false);
    assert.equal(healthData.COMMERCE_PREVIEW_ENABLED, false);
    assert.equal(healthData.TEST_MODE, true);

    const checkout = await call(env, '/api/checkout/create', { productId: 'full' });
    assert.equal(checkout.status, 403);
    assert.equal(checkout.data.reason, 'payments_disabled');
    const webhook = await call(env, '/api/webhooks/yookassa', { event: 'payment.succeeded' });
    assert.equal(webhook.status, 403);
    const entitlements = await worker.fetch(
      new Request('https://mlma-account.test/api/me/entitlements', {
        method: 'GET',
        headers: { Origin: 'https://mlmacademy.ru' },
      }),
      env,
    );
    assert.equal(entitlements.status, 403);
    const refunds = await call(env, '/api/refunds/process', { orderId: 'x' });
    assert.equal(refunds.status, 403);

    const bound = await call(env, '/api/session/bind', { maId: '77', email: 'run@b.c' });
    const cookie = sid(bound.cookie);
    const saved = await call(
      env,
      '/api/account/run',
      {
        trackId: 'A3-002',
        runtime: {
          status: 'complete',
          step: 'feedback',
          trackVersion: '0.2',
          artifact: 'секретный текст результата',
          content: 'нельзя на сервер',
          evidenceNote: 'следы',
        },
      },
      cookie,
    );
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    const run = saved.data.account.runs['A3-002'];
    assert.equal(run.status, 'complete');
    assert.equal(run.trackVersion, '0.2');
    assert.equal(run.artifact, undefined);
    assert.equal(run.content, undefined);
    assert.equal(run.evidenceNote, undefined);
  });

  it('негативные проверки identity: cookie, чужой маршрут, Track ID, размер, replay', async () => {
    resetRateLimitForTests();
    const env = memoryEnv();
    const noCookie = await call(env, '/api/account/get', { maId: '1', email: 'a@b.c' });
    assert.equal(noCookie.status, 401);

    const a = await call(env, '/api/session/bind', { maId: '10', email: 'owner@b.c' });
    const cookieA = sid(a.cookie);
    await call(env, '/api/account/route/save', { trackId: 'A1-010' }, cookieA);

    const b = await call(env, '/api/session/bind', { maId: '11', email: 'other@b.c' });
    const cookieB = sid(b.cookie);
    const stolenGet = await call(env, '/api/account/get', { maId: '10', email: 'owner@b.c', userId: 'ma:10' }, cookieB);
    assert.deepEqual(stolenGet.data.account.savedTrackIds, []);
    const stolenSave = await call(env, '/api/account/route/save', { trackId: 'A2-008', maId: '10' }, cookieB);
    assert.deepEqual(stolenSave.data.account.savedTrackIds, ['A2-008']);
    const owner = await call(env, '/api/account/get', {}, cookieA);
    assert.deepEqual(owner.data.account.savedTrackIds, ['A1-010']);

    const badId = await call(env, '/api/account/route/save', { trackId: 'NOPE' }, cookieA);
    assert.equal(badId.status, 400);

    const huge = 'x'.repeat(20 * 1024);
    const tooBig = await call(env, '/api/account/profile', { displayName: huge }, cookieA);
    assert.equal(tooBig.status, 413);

    const rotated = await call(env, '/api/session/bind', { maId: '10', email: 'owner@b.c' });
    const stale = await call(env, '/api/account/get', {}, cookieA);
    assert.equal(stale.status, 401);
    assert.ok(sid(rotated.cookie));
  });

  it('массовые bind ограничиваются', async () => {
    resetRateLimitForTests();
    const env = memoryEnv();
    let limited = 0;
    for (let i = 0; i < 22; i += 1) {
      const res = await worker.fetch(
        new Request('https://mlma-account.test/api/session/bind', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: 'https://mlmacademy.ru',
            'CF-Connecting-IP': '203.0.113.10',
          },
          body: JSON.stringify({ maId: 'ip-' + i, email: 'flood' + i + '@b.c' }),
        }),
        env,
      );
      if (res.status === 429) limited += 1;
    }
    assert.ok(limited >= 1);
  });

  it('маршруты pricing/privacy есть, платежи в клиенте выключены', () => {
    const R = MLMA.routes();
    assert.equal(R.pricing(), '/pricing');
    assert.equal(R.privacy(), '/privacy');
    assert.equal(R.consent(), '/consent');
    assert.equal(R.purchases(), '/my/purchases');
    assert.equal(R.offer(), '/offer');
    assert.equal(R.requisites(), '/requisites');
    assert.equal(R.paymentAndAccess(), '/payment-and-access');
    assert.equal(R.documents(), '/documents');
    assert.equal(R.cookies(), '/cookies');
    assert.equal(R.marketingConsent(), '/marketing-consent');
    assert.equal(R.logout(), '/members/login?exit=y');
    assert.equal(MLMA.membersLogoutUrl(), '/members/login?exit=y');
    assert.equal(MLMA.membersRecoverUrl('/profile'), '/members/login?mlma=recover&redirecturl=profile');
    assert.equal(MLMA.PAYMENTS_ENABLED, false);
    assert.equal(MLMA.COMMERCE_PREVIEW_ENABLED, false);
    assert.equal(MLMA.PAYMENT_TEST_MODE, true);
    assert.equal(MLMA.SIGNUP_ENABLED, false);
  });

  it('логотип в шапке — файл с макета, ссылка на /academy', () => {
    const ui = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/ui.js'), 'utf8');
    const css = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/mlma.css'), 'utf8');
    const logo = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/assets/mlma-logo.jpg');
    assert.match(ui, /class="mlma-logo"/);
    assert.match(ui, /esc\(\(R\.home && R\.home\(\)\) \|\| '\/academy'\)/);
    assert.match(ui, /assetUrl\('mlma-logo\.jpg'\)/);
    assert.match(ui, /class="mlma-logo-img"/);
    assert.doesNotMatch(ui, /mlma-mark-svg/);
    assert.match(css, /\.mlma-logo-img/);
    assert.equal(fs.existsSync(logo), true);
    assert.equal(fs.readFileSync(logo).subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])), true);
  });

  it('выход идёт на Tilda exit=y, в UI есть обработчик, в регистрации — галочка согласия', () => {
    const ui = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/ui.js'), 'utf8');
    const bridge = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/members-bridge.js'), 'utf8');
    assert.match(ui, /data-mlma-logout/);
    assert.match(ui, /performMembersLogout/);
    assert.match(bridge, /pdn_consent/);
    assert.match(bridge, /mlmacademy\.ru\/consent/);
    assert.match(bridge, /mlmacademy\.ru\/privacy/);
    assert.match(bridge, /mlmacademy\.ru\/marketing-consent/);
    assert.match(bridge, /name="marketing_consent"/);
    assert.doesNotMatch(bridge, /name="marketing_consent" required/);
    assert.match(bridge, /var SIGNUP_ENABLED = false;/);
  });
});
