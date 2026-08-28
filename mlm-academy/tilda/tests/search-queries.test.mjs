import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
require('../src/domain.js');
const MLMA = require('../src/search.js');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.join(__dirname, '../../src/data/tracks.catalog.json');
const tracks = MLMA.toPublicList(JSON.parse(fs.readFileSync(catalogPath, 'utf8')).tracks);

function search(q, extra) {
  return MLMA.searchCatalog(tracks, MLMA.parseLibraryState('', Object.assign({ q }, extra || {})));
}

const CASES = [
  { q: 'боюсь написать знакомому', expect: ['A3-002'], group: 'exact' },
  { q: 'хочу больше зарабатывать, но не понимаю, что делать', expect: ['A1-007'], group: 'exact' },
  { q: 'Контактов много, всё держу в голове', expect: ['A2-006', 'A6-010', 'A2-007'], group: 'crm' },
  { q: 'Я устал и всё откладываю', expect: ['A1-010', 'A6-011', 'A6-020', 'A3-014'], group: 'postpone' },
  { q: 'Как позвонить незнакомому человеку', expect: ['A3-001', 'A3-004', 'A3-007', 'A2-012'], group: 'call' },
  { q: 'Не понимаю, кому предложить продукт', expect: ['A2-001', 'A1-011', 'A2-010', 'A2-008'], group: 'audience' },
  { q: 'Клиент недоволен продуктом', expect: ['A6-001', 'A6-002', 'A6-003'], group: 'client' },
  { q: 'Партнёры ничего не делают', expect: ['A6-013', 'A6-011', 'A1-016', 'A6-012'], group: 'team' },
  { q: 'хочу стать лидером и собрать команду', expect: ['A1-004', 'A1-016', 'A6-012', 'A6-013'], group: 'team' },
  { q: 'чилавек молчит после сабщения', expect: ['A5-010', 'A3-008', 'A5-011'], group: 'typo' },
  { q: 'Человек сказал, что дорого', expect: ['A5-005', 'A4-013', 'A5-001'], group: 'price' },
  { q: 'мне некому писать', expect: ['A2-008', 'A2-010', 'A2-006'], group: 'people' },
  { q: 'стыдно продавать и навязываться', expect: ['A1-001'], group: 'ethics' },
  { q: 'человек сказал что подумает', expect: ['A5-001', 'A5-003', 'A5-008', 'A5-009'], group: 'pause' },
  { q: 'клиент купил и больше не отвечает', expect: ['A6-001', 'A6-006', 'A5-010'], group: 'followup' },
  { q: 'не знаю как рассказать о продукте', expect: ['A1-012', 'A1-011', 'A4-001'], group: 'product' },
  { q: 'боюсь первым написать знакомому', expect: ['A3-002'], group: 'exact' },
  { q: 'не понимаю, с кем начать', expect: ['A2-008', 'A2-010'], group: 'people' },
  { q: 'хочу получить первый результат', expect: ['A1-010', 'A2-008', 'A3-002'], group: 'start' },
  { q: 'аудит базы', expect: ['A2-006'], group: 'crm' },
  { q: 'навести порядок в crm', expect: ['A6-010', 'A2-006'], group: 'crm' },
  { q: 'нет рабочего ритма', expect: ['A6-011', 'A1-010'], group: 'postpone' },
  { q: 'план на 30 дней', expect: ['A1-010'], group: 'start' },
  { q: 'разобрать страх действия', expect: ['A6-020'], group: 'postpone' },
  { q: 'выбрать канал первого контакта', expect: ['A3-001'], group: 'call' },
  { q: 'структура первого звонка', expect: ['A3-004', 'A3-007'], group: 'call' },
  { q: 'холодный поиск незнакомцам', expect: ['A2-012'], group: 'call' },
  { q: 'целевая аудитория продукта', expect: ['A2-001', 'A1-011'], group: 'audience' },
  { q: 'карта теплых кругов', expect: ['A2-010'], group: 'people' },
  { q: 'продуктовый фокус', expect: ['A1-011'], group: 'product' },
  { q: 'проверить клиентский опыт', expect: ['A6-001'], group: 'client' },
  { q: 'работа с претензией', expect: ['A6-001', 'A6-002'], group: 'client' },
  { q: 'наставлять партнёров', expect: ['A6-013', 'A1-016'], group: 'team' },
  { q: 'партнеры не делают', expect: ['A6-011', 'A6-013', 'A1-016'], group: 'team' },
  { q: 'саобщение знакомому', expect: ['A3-002'], group: 'typo' },
  { q: 'пазвонить незнакомам', expect: ['A3-001', 'A3-004', 'A3-007'], group: 'typo' },
  { q: 'некаму писать', expect: ['A2-008'], group: 'typo' },
  { q: 'это слишком дорого', expect: ['A5-005', 'A4-013'], group: 'price' },
  { q: 'сказал не по карману', expect: ['A5-005', 'A4-013'], group: 'price' },
  { q: 'прочитал и молчит', expect: ['A5-010'], group: 'followup' },
  { q: 'вернуть клиента после покупки', expect: ['A6-006', 'A6-001'], group: 'followup' },
  { q: 'честная карточка продукта', expect: ['A1-012'], group: 'product' },
  { q: 'что можно обещать', expect: ['A1-013'], group: 'product' },
  { q: 'не хочу впаривать', expect: ['A1-001'], group: 'ethics' },
  { q: 'я только начал', expect: ['A1-004', 'A1-006', 'A1-010'], group: 'start' },
  { q: 'как назначить разговор', expect: ['A3-005'], group: 'call' },
  { q: 'человек взял паузу', expect: ['A5-011', 'A5-009', 'A5-001'], group: 'pause' },
  { q: 'статусы и следующие действия', expect: ['A6-010'], group: 'crm' },
  { q: 'квантовый единорог xyz', expect: [], group: 'none', empty: true },
  { q: 'asdfgh qwerty', expect: [], group: 'none', empty: true },
  { q: 'погода на марсе', expect: [], group: 'none', empty: true },
  { q: 'не', expect: [], group: 'none', needMore: true },
  { q: 'что делать', expect: [], group: 'none', needMore: true },
  { q: 'помогите пожалуйста', expect: [], group: 'none', empty: true },
  { q: 'мне не нужна команда, хочу написать знакомому', expect: ['A3-002'], group: 'negation' },
  { q: 'не хочу продавать впариванием', expect: ['A1-001'], group: 'negation' },
  { q: 'он прочитал и не отвечает', expect: ['A5-010'], group: 'followup' },
  { q: 'клиент жалуется на качество', expect: ['A6-001', 'A6-002'], group: 'client' },
  { q: 'надо вести таблицу контактов', expect: ['A2-006', 'A6-010'], group: 'crm' },
  { q: 'страшно звонить холодным', expect: ['A3-001', 'A3-004', 'A3-007', 'A2-012'], group: 'call' },
  { q: 'хочу развивать команду', expect: ['A6-013', 'A1-016', 'A6-012'], group: 'team' },
];

describe('50 пользовательских запросов', () => {
  for (const item of CASES) {
    it(item.q, () => {
      const result = search(item.q);
      if (item.needMore) {
        assert.equal(result.kind, 'need_more');
        return;
      }
      if (item.empty) {
        assert.equal(result.kind, 'zero');
        assert.equal(result.close.length, 0);
        assert.ok(result.clarifyingQuestion);
        return;
      }
      const found = result.items.map((row) => row.trackId);
      const hit = item.expect.some((id) => found.slice(0, 3).includes(id));
      assert.ok(hit, `${item.q} top3=${found.slice(0, 3).join(',')} expected one of ${item.expect.join(',')}`);
      assert.equal(found.some((id) => !/^A[1-6]-\d{3}$/.test(id)), false);
      if (item.group === 'team') {
        assert.ok(found.length < 20, 'team dump ' + found.length);
      }
      if (item.group === 'price') {
        assert.ok(found.slice(0, 3).some((id) => ['A5-005', 'A4-013', 'A5-001'].includes(id)));
      }
      if (item.group === 'negation' && item.q.includes('написать знакомому')) {
        assert.ok(!found.slice(0, 3).includes('A6-013'));
      }
    });
  }

  it('фильтры работают вместе с поиском и остаются в URL', () => {
    const state = MLMA.parseLibraryState('?q=' + encodeURIComponent('дорого') + '&stage=a5&sit=doubt');
    const result = MLMA.searchCatalog(tracks, state);
    assert.ok(result.items.every((item) => item.sectionId === 'A5'));
    const href = MLMA.libraryHref(state);
    assert.match(href, /q=/);
    assert.match(href, /stage=a5/);
    assert.match(href, /sit=doubt/);
  });

  it('rerank не принимает неизвестные ID', () => {
    const local = search('боюсь написать знакомому');
    const next = MLMA.applyRerankResponse(local, {
      recognizedSituation: 'первое сообщение',
      results: [
        { trackId: 'A9-999', confidence: 0.99, reason: 'fake' },
        { trackId: 'A3-002', confidence: 0.9, reason: 'первое сообщение' },
      ],
    });
    assert.ok(next.items.every((item) => item.trackId !== 'A9-999'));
    assert.equal(next.items[0].trackId, 'A3-002');
  });

  it('почему разделено на literal / situation / intent', () => {
    const result = search('Контактов много, всё держу в голове');
    const topId = result.items[0].trackId;
    const why = result.whyMap[topId];
    assert.equal(Array.isArray(why), false);
    assert.ok(why.literal || why.situation || why.intent);
    const query = MLMA.normalizeSearchText('Контактов много всё держу в голове');
    for (const word of why.literal || []) {
      const parts = MLMA.normalizeSearchText(word).split(' ').filter(Boolean);
      assert.ok(
        parts.every((part) => query.includes(part) || /^a[1-6]-\d{3}$/.test(part)),
        'literal leaked ' + word,
      );
    }
    const html = why.literal || why.situation || why.intent ? 'ok' : '';
    assert.equal(html, 'ok');
  });

  it('пустой поиск не выдаёт первые карточки A1 как ближайшие', () => {
    const result = search('квантовый единорог xyz');
    assert.equal(result.kind, 'zero');
    assert.equal(result.close.length, 0);
    assert.ok(result.clarifyingQuestion);
    assert.ok(!result.items.some((item) => item.trackId === 'A1-001'));
  });
});
