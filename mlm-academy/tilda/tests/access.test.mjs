import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const require = createRequire(import.meta.url);
require('../src/domain.js');
require('../src/access.js');
require('../src/storage.js');
require('../src/payments.js');
require('../src/commerce.js');
require('../src/search.js');
require('../src/analytics.js');
const MLMA = require('../src/ontology.js');

function track(overrides) {
  return MLMA.toPublicTrack(
    Object.assign(
      {
        sectionId: 'A3',
        module: 'Модуль',
        trackId: 'A3-002',
        title: 'Написать первое сообщение теплому контакту',
        situation: 'Знаю, кому написать, но не знаю как начать',
        outcome: 'Готово короткое сообщение',
        format: 'Практика',
        nextTrackIds: [],
        publicationStatus: 'planned',
        visibility: 'catalog',
        access: 'undecided',
        contentStatus: 'metadata_only',
      },
      overrides,
    ),
  );
}

describe('доступ и состояния', () => {
  it('гость не сохраняет маршрут и не открывает платное тело', () => {
    const item = track();
    const guest = { loggedIn: false, entitlements: [] };
    assert.equal(MLMA.resolveUserState(guest), 'guest');
    assert.equal(MLMA.isEntitledToTrack(item, guest), false);
    assert.equal(MLMA.canOpenTrackBody(item, guest), false);
    assert.equal(MLMA.cardAction(item, guest).key, 'login_save');
  });

  it('FREE видит кабинет, но платный старт закрыт пока нет содержания', () => {
    const item = track();
    const account = { loggedIn: true, email: 'a@b.c', groups: ['FREE'], entitlements: [] };
    assert.equal(MLMA.resolveUserState(account), 'registered');
    assert.equal(MLMA.getTrackStatusView(item).canStart, false);
    assert.equal(MLMA.cardAction(item, account).label, 'Открыть описание');
  });

  it('опубликованный платный трек без complete не показывает покупку', () => {
    const item = track({ publicationStatus: 'published', contentStatus: 'published' });
    const account = { loggedIn: true, email: 'a@b.c', groups: ['FREE'], entitlements: [] };
    assert.equal(MLMA.cardAction(item, account).key, 'preparing');
    assert.notEqual(MLMA.cardAction(item, account).key, 'buy');
  });

  it('tilda_unverified не открывает платное тело и не считает START/FULL правом', () => {
    const item = track({ publicationStatus: 'published', contentStatus: 'published' });
    const spoofed = {
      loggedIn: true,
      email: 'a@b.c',
      identityLevel: 'tilda_unverified',
      groups: ['START', 'FULL', 'ADMIN'],
      entitlements: [{ productId: 'full', group: 'FULL', status: 'active' }],
    };
    assert.equal(MLMA.isVerifiedAccount(spoofed), false);
    assert.equal(MLMA.hasGroup(spoofed, 'START'), false);
    assert.equal(MLMA.hasGroup(spoofed, 'FULL'), false);
    assert.equal(MLMA.hasGroup(spoofed, 'ADMIN'), false);
    assert.equal(MLMA.hasGroup(spoofed, 'FREE'), true);
    assert.equal(MLMA.isEntitledToTrack(item, spoofed), false);
    assert.equal(MLMA.canOpenTrackBody(item, spoofed), false);
    assert.equal(MLMA.resolveUserState(spoofed), 'registered');
  });

  it('verified может открыть платный трек по серверному праву', () => {
    const item = track({ publicationStatus: 'published', contentStatus: 'published' });
    const account = {
      loggedIn: true,
      identityLevel: 'verified',
      groups: ['FREE', 'FULL'],
      entitlements: [{ productId: 'full', group: 'FULL', status: 'active' }],
    };
    assert.equal(MLMA.isEntitledToTrack(item, account), true);
  });

  it('оплаченный пакет и истекший доступ различаются', () => {
    const paid = {
      loggedIn: true,
      identityLevel: 'verified',
      groups: ['START'],
      entitlements: [{ productId: 'start', group: 'START', status: 'active' }],
    };
    const expired = {
      loggedIn: true,
      identityLevel: 'verified',
      groups: ['FREE'],
      entitlements: [{ productId: 'start', status: 'expired', expiresAt: '2020-01-01T00:00:00.000Z' }],
    };
    assert.equal(MLMA.resolveUserState(paid), 'paid');
    assert.equal(MLMA.resolveUserState(expired), 'expired');
    assert.equal(MLMA.cardAction(track(), expired).key, 'renew');
  });

  it('пустой planned трек не индексируется, даже если есть title', () => {
    const item = track();
    assert.equal(item.seoStatus, 'noindex');
    assert.equal(item.access, 'paid');
    assert.equal(MLMA.deriveSeoStatus(item), 'noindex');
  });
});

describe('оплата и вебхук', () => {
  it('повторный webhook не создаёт вторую покупку', () => {
    const order = MLMA.createOrder({ email: 'a@b.c', maId: '1', productId: 'start' });
    let account = { identityLevel: 'verified', entitlements: [], payments: [], orders: [], groups: ['FREE'] };
    const event = { paymentId: 'pay_1', orderId: order.orderId, status: 'paid', idempotencyKey: 'pay_1', signatureValid: true, email: 'a@b.c' };
    const first = MLMA.applyWebhook(account, event, order);
    const second = MLMA.applyWebhook(first.account, event, order);
    assert.equal(first.ok, true);
    assert.equal(second.duplicate, true);
    assert.equal(first.account.entitlements.length, 1);
    assert.equal(second.account.entitlements.length, 1);
  });

  it('отказ и отмена не выдают доступ', () => {
    const order = MLMA.createOrder({ email: 'a@b.c', productId: 'start' });
    const failed = MLMA.applyWebhook({ identityLevel: 'verified', entitlements: [], payments: [], orders: [], groups: ['FREE'] }, {
      paymentId: 'pay_f', orderId: order.orderId, status: 'failed', idempotencyKey: 'pay_f', signatureValid: true,
    }, order);
    assert.equal(failed.account.entitlements.length, 0);
    const cancelled = MLMA.applyWebhook({ identityLevel: 'verified', entitlements: [], payments: [], orders: [], groups: ['FREE'] }, {
      paymentId: 'pay_c', orderId: order.orderId, status: 'cancelled', idempotencyKey: 'pay_c', signatureValid: true,
    }, order);
    assert.equal(cancelled.account.entitlements.length, 0);
  });

  it('возврат отзывает право', () => {
    const order = MLMA.createOrder({ email: 'a@b.c', productId: 'start' });
    const paid = MLMA.applyWebhook({ identityLevel: 'verified', entitlements: [], payments: [], orders: [], groups: ['FREE'] }, {
      paymentId: 'pay_r', orderId: order.orderId, status: 'paid', idempotencyKey: 'pay_r', signatureValid: true,
    }, order);
    const refunded = MLMA.applyWebhook(paid.account, {
      paymentId: 'pay_r2', orderId: order.orderId, status: 'refunded', idempotencyKey: 'pay_r2', signatureValid: true,
    }, order);
    assert.equal(refunded.account.entitlements[0].status, 'revoked');
  });

  it('неверная подпись не записывает платёж', () => {
    const order = MLMA.createOrder({ email: 'a@b.c', productId: 'start' });
    const bad = MLMA.applyWebhook({ identityLevel: 'verified', entitlements: [], payments: [], orders: [] }, {
      paymentId: 'pay_x', orderId: order.orderId, status: 'paid', idempotencyKey: 'pay_x', signatureValid: false,
    }, order);
    assert.equal(bad.ok, false);
    assert.equal(bad.account.entitlements.length, 0);
  });

  it('tilda_unverified webhook не выдаёт пакет', () => {
    const order = MLMA.createOrder({ email: 'a@b.c', productId: 'start' });
    const blocked = MLMA.applyWebhook(
      { identityLevel: 'tilda_unverified', entitlements: [], payments: [], orders: [], groups: ['FREE'] },
      { paymentId: 'pay_u', orderId: order.orderId, status: 'paid', idempotencyKey: 'pay_u', signatureValid: true },
      order,
    );
    assert.equal(blocked.ok, false);
    assert.equal(blocked.reason, 'verified_required');
    assert.equal(blocked.account.entitlements.length, 0);
  });
});

describe('аналитика', () => {
  it('вырезает пароли, карты и длинные ответы', () => {
    const clean = MLMA.sanitizeAnalytics({
      password: 'secret',
      card: '4111',
      artifact: 'полный текст ответа пользователя',
      itemId: 'A3-002',
      email: 'roma@example.com',
    });
    assert.equal(clean.password, undefined);
    assert.equal(clean.card, undefined);
    assert.equal(clean.artifact, undefined);
    assert.equal(clean.itemId, 'A3-002');
    assert.match(clean.email, /\*\*\*/);
  });
});

describe('кабинет и маршрут', () => {
  it('пустой маршрут предлагает подобрать трек, а не «нет материалов»', () => {
    const rec = MLMA.recommendedAction({
      account: { loggedIn: true, groups: ['FREE'], entitlements: [] },
      profile: { displayName: 'Роман', partnerRole: 'novice', consentAt: '2026-01-01', savedTrackIds: [], onboardingComplete: true },
      tracks: [track({ publicationStatus: 'promo', access: 'promo', contentStatus: 'published' })],
    });
    assert.equal(rec.kind, 'empty_route');
    assert.match(rec.title, /маршрут пока пуст/i);
    assert.equal(rec.cta, 'Подобрать трек');
    assert.ok(rec.secondary);
  });

  it('гость кладёт pendingTrackId, а не выдаёт себе права', () => {
    globalThis.sessionStorage = {
      _d: {},
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
      setItem: function (k, v) { this._d[k] = String(v); },
      removeItem: function (k) { delete this._d[k]; },
    };
    MLMA.writePendingTrackId('A1-010');
    assert.equal(MLMA.readPendingTrackId(), 'A1-010');
    MLMA.clearPendingTrackId();
    assert.equal(MLMA.readPendingTrackId(), '');
  });
});
