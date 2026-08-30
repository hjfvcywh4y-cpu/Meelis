import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import worker from '../../account-proxy/worker.js';
import {
  emptyAccount,
  recordOfferAcceptance,
  cancelAutoRenewal,
  canReusePaymentMethod,
  proportionalRefundAmount,
  validateCheckoutConsents,
  buildOfferAcceptanceRecord,
  OFFER_URL,
  OFFER_VERSION,
  resetRateLimitForTests,
} from '../../account-proxy/account-core.js';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

require('../src/domain.js');
require('../src/access.js');
require('../src/storage.js');
require('../src/payments.js');
require('../src/commerce.js');
require('../src/legal.js');
const MLMA = require('../src/ontology.js');

function memoryEnv() {
  const store = new Map();
  return {
    MLMA_SESSION_SECRET: 'test-secret',
    MLMA_ACCOUNT: {
      get: async (key) => store.get(key) || null,
      put: async (key, value) => { store.set(key, value); },
    },
  };
}

async function call(env, path, body, cookie) {
  const headers = { 'Content-Type': 'application/json', Origin: 'https://mlmacademy.ru' };
  if (cookie) headers.Cookie = cookie;
  const res = await worker.fetch(
    new Request('https://mlma-account.test' + path, {
      method: 'POST',
      headers,
      body: JSON.stringify(body || {}),
    }),
    env,
  );
  return { status: res.status, data: await res.json(), cookie: res.headers.get('Set-Cookie') || '' };
}

function sid(setCookie) {
  const m = String(setCookie).match(/mlma_sid=([^;]+)/);
  return m ? 'mlma_sid=' + m[1] : '';
}

describe('оферта: абонентский доступ к платформе', () => {
  it('оферта описывает доступ к платформе, а не треки и не обучение', () => {
    const offer = JSON.stringify(MLMA.legalDocument('offer'));
    const payment = JSON.stringify(MLMA.legalDocument('payment-and-access'));
    assert.match(offer, /абонентск/);
    assert.match(offer, /информационно-аналитическ/);
    assert.match(offer, /не является договором купли-продажи отдельных треков/);
    assert.match(offer, /не является договором об оказании образовательной услуги/);
    assert.match(offer, /Отсутствие фактического использования/);
    assert.match(offer, /не считается неоказанием услуги/);
    assert.doesNotMatch(offer, /возвратов нет/);
    assert.doesNotMatch(offer, /полностью оказана в момент/);
    assert.doesNotMatch(offer, /плата за активацию не возвращается/);
    assert.match(offer, /Отмена автопродления/);
    assert.match(offer, /пропорционально оставшемуся неиспользованному периоду/);
    assert.match(offer, /существенно не работал по вине Исполнителя/);
    assert.match(offer, /изначально пустой/);
    assert.match(offer, /https:\/\/mlmacademy.ru\/offer/);
    assert.match(payment, /Два разных действия/);
    assert.equal(MLMA.OFFER_URL, 'https://mlmacademy.ru/offer');
    assert.equal(MLMA.LEGAL_OPERATOR.version, '1.2');
    assert.equal(MLMA.assertLegalPublishReady().ok, true);
  });

  it('галочки оферты и автопродления изначально пустые', () => {
    const html = MLMA.checkoutConsentHtml(MLMA.getProductByCode('B2C-LIB-M-001'), { autoRenewal: true });
    assert.match(html, /name="offer_accepted"/);
    assert.match(html, /name="autorenew_accepted"/);
    assert.doesNotMatch(html, /checked/);
    assert.match(html, /o_053@mail\.ru/);
    assert.match(html, /Отмена автопродления/);
    const offerOnly = MLMA.checkoutConsentHtml(MLMA.getProductByCode('B2C-TRACK-001'), { autoRenewal: false });
    assert.doesNotMatch(offerOnly, /autorenew_accepted/);
    assert.equal(MLMA.validateCheckoutConsents({ offerAccepted: false }).ok, false);
    assert.equal(MLMA.validateCheckoutConsents({ offerAccepted: true, offerPreChecked: true }).reason, 'offer_prechecked');
    assert.equal(MLMA.validateCheckoutConsents({ offerAccepted: true }).ok, true);
    assert.equal(MLMA.validateCheckoutConsents({ offerAccepted: true, autoRenewalUsed: true, autoRenewalAccepted: false }).reason, 'autorenew_required');
  });

  it('сервер фиксирует акцепт и считает пропорциональный возврат', () => {
    const row = emptyAccount({ email: 'buyer@b.c', maId: '10' });
    row.orders = [{ orderId: 'ord_1', productId: 'B2C-TRACK-001' }];
    const recorded = recordOfferAcceptance(row, {
      offerAccepted: true,
      email: 'buyer@b.c',
      userKey: 'ma:10',
      orderId: 'ord_1',
      tariff: 'B2C-TRACK-001',
      termDays: 365,
      amount: 590,
      autoRenewalUsed: true,
      autoRenewalAccepted: true,
    });
    assert.equal(recorded.ok, true);
    assert.equal(recorded.record.offerVersion, OFFER_VERSION);
    assert.equal(recorded.record.offerUrl, OFFER_URL);
    assert.equal(recorded.record.autoRenewalConsent.accepted, true);
    assert.equal(row.legalAcceptances.length, 1);
    assert.equal(row.orders[0].legalAcceptance.orderId, 'ord_1');
    const refund = proportionalRefundAmount({ paidAmount: 3650, periodDays: 365, usedDays: 65, documentedExpenses: 100 });
    assert.equal(refund.ok, true);
    assert.equal(refund.remainingDays, 300);
    assert.equal(refund.amount, 2900);
    assert.equal(buildOfferAcceptanceRecord({ offerAccepted: true, email: 'x' }).reason, 'email_required');
  });

  it('отмена автопродления сохраняет период и блокирует реквизиты', () => {
    const row = emptyAccount({ email: 'buyer@b.c', maId: '11' });
    row.orders = [{ orderId: 'ord_2', autoRenewal: { enabled: true } }];
    row.entitlements = [{ orderId: 'ord_2', autoRenewalEnabled: true, status: 'active' }];
    row.autoRenewal = { enabled: true };
    const result = cancelAutoRenewal(row, { via: 'cabinet', orderId: 'ord_2' });
    assert.equal(result.ok, true);
    assert.equal(result.accessContinuesUntilPaidPeriodEnd, true);
    assert.equal(row.orders[0].autoRenewal.enabled, false);
    assert.equal(row.entitlements[0].autoRenewalEnabled, false);
    assert.equal(row.autoRenewal.enabled, false);
    assert.equal(canReusePaymentMethod(row), false);
    const empty = cancelAutoRenewal(emptyAccount({ email: 'a@b.c' }), { via: 'email' });
    assert.equal(empty.reason, 'no_auto_renewal');
    assert.equal(validateCheckoutConsents({ offerAccepted: true, autoRenewalUsed: true, autoRenewalPreChecked: true }).reason, 'autorenew_prechecked');
  });

  it('кабинет отменяет автопродление по API, платежи выключены', async () => {
    resetRateLimitForTests();
    const env = memoryEnv();
    const bind = await call(env, '/api/session/bind', { maId: '12', email: 'c@b.c' });
    const cookie = sid(bind.cookie);
    const cancel = await call(env, '/api/account/auto-renewal/cancel', { via: 'cabinet' }, cookie);
    assert.equal(cancel.status, 200);
    assert.equal(cancel.data.result.reason, 'no_auto_renewal');
    const checkout = await call(env, '/api/checkout/create', { productId: 'B2C-TRACK-001' }, cookie);
    assert.equal(checkout.status, 403);
    assert.equal(checkout.data.reason, 'payments_disabled');
    assert.equal(MLMA.PAYMENTS_ENABLED, false);
  });
});
