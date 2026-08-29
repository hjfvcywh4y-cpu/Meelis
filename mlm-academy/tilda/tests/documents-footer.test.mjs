import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '../src');

require('../src/domain.js');
require('../src/access.js');
require('../src/storage.js');
require('../src/payments.js');
require('../src/commerce.js');
require('../src/legal.js');
const MLMA = require('../src/ontology.js');

describe('центр документов и подвал', () => {
  it('публичные маршруты документов не требуют кабинета', () => {
    const R = MLMA.routes();
    assert.equal(R.documents(), '/documents');
    assert.equal(R.requisites(), '/requisites');
    assert.equal(R.offer(), '/offer');
    assert.equal(R.privacy(), '/privacy');
    assert.equal(R.consent(), '/consent');
    assert.equal(R.marketingConsent(), '/marketing-consent');
    assert.equal(R.cookies(), '/cookies');
    assert.equal(R.paymentAndAccess(), '/payment-and-access');
  });

  it('хаб ссылается на семь отдельных URL и не сливает тексты', () => {
    const docs = MLMA.publicDocuments();
    assert.equal(docs.length, 7);
    assert.deepEqual(
      docs.map((row) => row.path),
      ['/requisites', '/offer', '/privacy', '/consent', '/marketing-consent', '/cookies', '/payment-and-access'],
    );
    const offer = JSON.stringify(MLMA.legalDocument('offer'));
    const privacy = JSON.stringify(MLMA.legalDocument('privacy'));
    assert.match(offer, /Осипов Роман Георгиевич/);
    assert.match(privacy, /Осипов Роман Георгиевич/);
    assert.notEqual(MLMA.legalDocument('offer').title, MLMA.legalDocument('privacy').title);
  });

  it('подвал сгруппирован по четырём колонкам, юридические ссылки не свалены в один ряд', () => {
    const ui = fs.readFileSync(path.join(SRC, 'ui.js'), 'utf8');
    assert.match(ui, /title: 'Платформа'/);
    assert.match(ui, /title: 'О проекте'/);
    assert.match(ui, /title: 'Доступ'/);
    assert.match(ui, /title: 'Документы'/);
    assert.match(ui, /label: 'Все документы'/);
    assert.match(ui, /label: 'Реквизиты'/);
    assert.match(ui, /label: 'Оферта'/);
    assert.match(ui, /mlma-footer-col/);
    const footerStart = ui.indexOf("function footer(");
    const footerEnd = ui.indexOf("function cookieBannerHtml(");
    const footer = ui.slice(footerStart, footerEnd);
    assert.match(footer, /Все документы/);
    assert.match(footer, /Реквизиты/);
    assert.match(footer, /Оферта/);
    assert.doesNotMatch(footer, /Политика конфиденциальности/);
    assert.doesNotMatch(footer, /Согласие на обработку/);
  });

  it('формы и ЮKassa ведут на прямые документы, платежи выключены', () => {
    const bridge = fs.readFileSync(path.join(SRC, 'members-bridge.js'), 'utf8');
    const ui = fs.readFileSync(path.join(SRC, 'ui.js'), 'utf8');
    assert.match(bridge, /https:\/\/mlmacademy\.ru\/consent/);
    assert.match(bridge, /https:\/\/mlmacademy\.ru\/privacy/);
    assert.match(bridge, /https:\/\/mlmacademy\.ru\/marketing-consent/);
    assert.match(ui, /R\.consent && R\.consent\(\)\) \|\| '\/consent'/);
    assert.match(ui, /R\.privacy && R\.privacy\(\)\) \|\| '\/privacy'/);
    assert.equal(MLMA.YUKASSA_PUBLIC_REQUISITES_URL, 'https://mlmacademy.ru/requisites');
    assert.equal(MLMA.yookassaPublicUrls().sellerInfo, 'https://mlmacademy.ru/requisites');
    assert.equal(MLMA.PAYMENTS_ENABLED, false);
    assert.equal(MLMA.COMMERCE_PREVIEW_ENABLED, false);
  });

  it('в юридических текстах Academy нет прежнего продавца и банковских реквизитов', () => {
    const blob = JSON.stringify([
      MLMA.LEGAL_OPERATOR,
      MLMA.legalDocument('requisites'),
      MLMA.legalDocument('offer'),
      MLMA.legalDocument('privacy'),
    ]);
    assert.match(blob, /o_053@mail\.ru/);
    assert.match(blob, /\+7 996 545-21-31/);
    assert.doesNotMatch(blob, new RegExp('Бор' + 'исенко' + '|Бале' + 'шенко' + '|ОГРНИП|Линейная'));
    assert.doesNotMatch(blob, /БИК\s*\d{9}/);
    assert.equal(MLMA.assertLegalPublishReady().ok, true);
  });
});
