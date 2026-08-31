import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const productsFile = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/products.catalog.json'), 'utf8'));
const tracksFile = JSON.parse(fs.readFileSync(path.join(__dirname, '../../src/data/tracks.catalog.json'), 'utf8'));

global.MLMA_PRODUCTS = productsFile;
if (global.window) global.window.MLMA_PRODUCTS = productsFile;

require('../src/domain.js');
require('../src/access.js');
require('../src/storage.js');
require('../src/payments.js');
require('../src/commerce.js');
require('../src/legal.js');
require('../src/search.js');
require('../src/analytics.js');
const MLMA = require('../src/ontology.js');

describe('продуктовый справочник и commercial gate', () => {
  it('каталог треков: 112 unique Track ID, пилот только A2-008', () => {
    const tracks = tracksFile.tracks;
    assert.equal(tracks.length, 112);
    const ids = new Set(tracks.map((row) => row.trackId));
    assert.equal(ids.size, 112);
    const counts = { A1: 0, A2: 0, A3: 0, A4: 0, A5: 0, A6: 0 };
    const published = [];
    for (const row of tracks) {
      counts[row.sectionId] += 1;
      if (row.trackId === 'A2-008') {
        assert.equal(row.publicationStatus, 'published');
        assert.equal(row.contentStatus, 'complete');
        assert.equal(row.access, 'free');
        published.push(row.trackId);
      } else {
        assert.equal(row.publicationStatus, 'planned');
        assert.equal(row.contentStatus, 'metadata_only');
      }
      assert.equal(MLMA.canShowBuyButton(MLMA.getProductByCode('B2C-TRACK-001'), MLMA.toPublicTrack(row)), false);
    }
    assert.deepEqual(published, ['A2-008']);
    assert.deepEqual(counts, { A1: 16, A2: 16, A3: 17, A4: 17, A5: 14, A6: 32 });
  });

  it('справочник продуктов отделён от треков и не active', () => {
    const codes = productsFile.products.map((row) => row.product_code);
    assert.deepEqual(codes, MLMA.PRODUCT_CODES);
    for (const row of productsFile.products) {
      assert.notEqual(row.product_code, row.bound_track_id);
      assert.notEqual(row.publication_status, 'active');
      assert.equal(row.checkout_eligible, false);
      assert.equal(MLMA.isProductPurchasable(row), false);
    }
  });

  it('B2C-TRACK-001 нельзя активировать без complete-трека и юридических страниц', () => {
    const product = MLMA.getProductByCode('B2C-TRACK-001');
    const gate = MLMA.evaluateLaunchGate(product, {
      tracks: tracksFile.tracks.map((row) => MLMA.toPublicTrack(row)),
      legal: productsFile.legal,
      paymentsBackendTestsPassed: false,
    });
    assert.equal(gate.ok, false);
    assert.ok(gate.reasons.includes('bound_track_id_missing') || gate.reasons.includes('legal_pages_unpublished'));
    assert.deepEqual(MLMA.activateProductClient(product), {
      ok: false,
      reason: 'client_cannot_activate',
      publication_status: 'unchanged',
    });
  });

  it('PACK3 и ROUTE6 закрыты тем же gate', () => {
    for (const code of ['B2C-PACK3-001', 'B2C-ROUTE6-001']) {
      const gate = MLMA.evaluateLaunchGate(MLMA.getProductByCode(code), {
        tracks: [],
        legal: {},
        paymentsBackendTestsPassed: false,
      });
      assert.equal(gate.can_activate, false);
    }
  });

  it('подписка и B2B не идут в карточный checkout', () => {
    assert.equal(MLMA.getProductByCode('B2C-LIB-M-001').show_in_pricing, false);
    assert.equal(MLMA.getProductByCode('B2C-PRO-M-001').sale_channel, 'hidden');
    assert.equal(MLMA.getProductByCode('B2B-PILOT30-001').sale_channel, 'negotiation');
    assert.equal(MLMA.getProductByCode('B2B-TEAM20-M-001').publication_status, 'planned');
  });

  it('query, localStorage и Tilda group не выдают платное право', () => {
    assert.deepEqual(MLMA.grantFromQuery({ paid: '1', product: 'B2C-TRACK-001' }), []);
    assert.deepEqual(MLMA.grantFromLocalStorage(), []);
    assert.deepEqual(MLMA.grantFromTildaGroup(['FULL', 'START']), []);
  });

  it('платежи выключены на клиенте', () => {
    assert.equal(MLMA.PAYMENTS_ENABLED, false);
    assert.equal(MLMA.COMMERCE_PREVIEW_ENABLED, false);
    assert.equal(MLMA.SIGNUP_ENABLED, false);
    assert.equal(MLMA.PAID_TRACK_NAVIGATION_ENABLED, false);
    assert.equal(MLMA.ENTITLEMENT_BYPASS, false);
    assert.equal(MLMA.TRACK_REGISTRY_ENABLED, true);
    assert.equal(MLMA.ROUTE_ENGINE_ENABLED, true);
    assert.equal(MLMA.isPaidTrackNavigationEnabled(), false);
    assert.equal(MLMA.routeNavigationLocked().locked, true);
    assert.equal(MLMA.paymentsSafeState().reason, 'payments_disabled');
  });

  it('сохранённый трек не считается купленным', () => {
    const track = MLMA.toPublicTrack(tracksFile.tracks[0]);
    const row = MLMA.classifyAccessRow(track, { loggedIn: true, groups: ['FREE'] }, [track.trackId]);
    assert.equal(row.key, 'saved');
    assert.notEqual(row.key, 'purchased');
  });

  it('formatPrice группирует тысячи справа, без разрыва последней цифры', () => {
    const norm = (s) => String(s).replace(/\u00a0/g, ' ');
    assert.equal(norm(MLMA.formatPrice(0)), '0 ₽');
    assert.equal(norm(MLMA.formatPrice(590)), '590 ₽');
    assert.equal(norm(MLMA.formatPrice(1490)), '1 490 ₽');
    assert.equal(norm(MLMA.formatPrice(2990)), '2 990 ₽');
    assert.equal(norm(MLMA.formatPrice(99000)), '99 000 ₽');
  });

  it('нет кнопки «Сообщить о запуске» и нет сбора заявок в localStorage', () => {
    const view = MLMA.productCardView(MLMA.getProductByCode('B2C-TRACK-001'));
    assert.equal(view.cta, 'preparing');
    assert.equal(view.buy_enabled, false);
    assert.equal(typeof MLMA.writeLaunchNotify, 'undefined');
    assert.equal(typeof MLMA.readLaunchNotify, 'undefined');
  });

  it('на тарифах нет оговорок «не покупка трека» и «не образовательная услуга»', () => {
    const ui = fs.readFileSync(path.join(__dirname, '../src/ui.js'), 'utf8');
    const pricingStart = ui.indexOf('function renderPricing(');
    const pricingEnd = ui.indexOf('function linkifyEscaped(');
    const pricing = ui.slice(pricingStart, pricingEnd);
    assert.match(pricing, /Оплатить ещё нельзя/);
    assert.doesNotMatch(pricing, /не покупка/);
    assert.doesNotMatch(pricing, /не образовательн/);
    assert.doesNotMatch(pricing, /не продажа/);
    assert.doesNotMatch(pricing, /абонентский доступ к информационно-аналитической/);
    assert.doesNotMatch(pricing, /PAYMENTS_ENABLED/);
    for (const row of productsFile.products) {
      if (row.show_in_pricing !== true) continue;
      assert.doesNotMatch(row.short_description, /не покупка|не образовательн|не продажа|не комплект отдельных/);
    }
  });

  it('юридические документы опубликованы с реквизитами оператора, без плейсхолдера', () => {
    assert.equal(productsFile.legal.offer_status, 'published');
    assert.equal(productsFile.legal.privacy_status, 'approved');
    assert.equal(productsFile.legal.requisites_status, 'filled');
    const privacy = MLMA.legalDocument('privacy');
    const consent = MLMA.legalDocument('consent');
    const offer = MLMA.legalDocument('offer');
    const requisites = MLMA.legalDocument('requisites');
    const blob = JSON.stringify([privacy, consent, offer, requisites]);
    assert.match(privacy.title, /Политика/);
    assert.match(consent.title, /Согласие на обработку персональных данных/);
    assert.match(offer.title, /абонентск/);
    assert.doesNotMatch(blob, /возвратов нет|полностью оказана в момент|плата за активацию не возвращается/);
    assert.match(blob, /Осипов Роман Георгиевич/);
    assert.match(blob, /532013301192/);
    assert.doesNotMatch(blob, new RegExp('Бор' + 'исенко' + '|Бале' + 'шенко' + '|532000' + '135580'));
    assert.doesNotMatch(blob, /LEGAL_PLACEHOLDER|ЗАПОЛНИТЬ ВЛАДЕЛЬЦУ/);
    assert.equal(MLMA.assertLegalPublishReady().ok, true);
    assert.equal(MLMA.isPersonInn('532013301192'), true);
    assert.equal(MLMA.isPersonInn('532013301191'), false);
    assert.equal(MLMA.isPersonInn(''), false);
    assert.equal(MLMA.YUKASSA_PUBLIC_REQUISITES_URL, 'https://mlmacademy.ru/requisites');
  });
});
