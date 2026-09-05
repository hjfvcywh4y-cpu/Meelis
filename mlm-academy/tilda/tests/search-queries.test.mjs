import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
require('../src/domain.js');
require('../src/search.js');
const MLMA = require('../src/ontology.js');
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
  { q: 'первый диалог', expect: ['A3-002', 'A3-016'], group: 'exact' },
  { q: 'кому написать', expect: ['A2-008', 'A2-010', 'A2-001'], group: 'people' },
  { q: 'не знаю кому написать', expect: ['A2-008', 'A2-010'], group: 'people' },
  { q: 'боюсь навязываться', expect: ['A1-001'], group: 'ethics' },
  { q: 'страшно написать человеку', expect: ['A3-002'], group: 'exact' },
  { q: 'хочу первого клиента', expect: ['A1-010', 'A2-008', 'A3-002'], group: 'start' },
  { q: 'как начать', expect: ['A1-004', 'A1-006', 'A1-010'], group: 'start' },
  { q: 'что делать новичку', expect: ['A1-004', 'A1-006', 'A1-010'], group: 'start' },
  { q: 'как рассказать о продукте', expect: ['A1-012', 'A1-011', 'A4-001'], group: 'product' },
  { q: 'как снять видео', expect: ['A3-002', 'A3-016', 'A1-012'], group: 'adjacent', adjacent: true },
  { q: 'Хочу открыть новый город', expect: ['A2-008', 'A2-011', 'A1-010'], group: 'adjacent', adjacent: true },
  { q: 'Клиент купил и пропал', expect: ['A6-001', 'A6-006', 'A5-010'], group: 'followup' },
  { q: 'как пригласить на встречу', expect: ['A3-005', 'A3-013', 'A3-016'], group: 'call' },
  { q: 'мне отказали', expect: ['A5-014', 'A5-001', 'A5-011'], group: 'pause' },
  { q: 'человек думает', expect: ['A5-001', 'A5-009', 'A5-011'], group: 'pause' },
  { q: 'хочу повторные продажи', expect: ['A6-006', 'A6-003', 'A6-001'], group: 'followup' },
  { q: 'как развивать команду', expect: ['A6-013', 'A1-016', 'A6-012'], group: 'team' },
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
      if (item.adjacent) {
        assert.equal(result.kind, 'ok');
        assert.ok(result.items.length >= 1, item.q + ' adjacent empty');
        assert.equal(result.matchType, 'adjacent');
      }
      const found = result.items.map((row) => row.trackId);
      const hit = item.expect.some((id) => found.slice(0, 3).includes(id) || (result.featured || []).map((row) => row.trackId).includes(id));
      assert.ok(hit, `${item.q} top3=${found.slice(0, 3).join(',')} expected one of ${item.expect.join(',')}`);
      assert.equal(found.some((id) => !/^A[1-6]-\d{3}$/.test(id)), false);
      assert.ok(found.length <= 8, item.q + ' dump ' + found.length);
      assert.ok((result.featured || []).length <= 3);
      assert.ok((result.other || []).length <= 5);
      if (result.whyMap && result.whyMap[found[0]] && result.whyMap[found[0]].text) {
        assert.match(result.whyMap[found[0]].text, /Подходит/);
        assert.equal(/Буквальное совпадение|алиас|score|trackId/i.test(result.whyMap[found[0]].text), false);
      }
      if (item.group === 'team') {
        assert.ok(found.length < 20, 'team dump ' + found.length);
        assert.ok(!found.includes('A3-002'), 'team leaked personal write ' + found.join(','));
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
    const combo = MLMA.searchCatalog(tracks, MLMA.parseLibraryState('?stage=a3&q=' + encodeURIComponent('кому написать')));
    assert.ok(combo.items.length >= 1);
    assert.ok(combo.items.every((item) => item.sectionId === 'A3'));
    assert.ok(combo.items.some((item) => item.trackId === 'A3-002'));
  });

  it('rerank не принимает неизвестные ID и низкую уверенность не подменяет локальной кучей', () => {
    const local = search('боюсь написать знакомому');
    const next = MLMA.applyRerankResponse(local, {
      confidence: 0.9,
      reason: 'Первое сообщение теплому контакту',
      topMatches: [
        { trackId: 'A9-999', confidence: 0.99, reason: 'fake' },
        { trackId: 'A3-002', confidence: 0.9, reason: 'Подходит, потому что вы хотите написать знакомому без давления.' },
      ],
      relatedMatches: [],
    });
    assert.ok(next.items.every((item) => item.trackId !== 'A9-999'));
    assert.equal(next.items[0].trackId, 'A3-002');
    assert.equal(next.source, 'ai');
    const low = MLMA.applyRerankResponse(local, {
      confidence: 0.2,
      matchType: 'adjacent',
      topMatches: [],
      relatedMatches: [],
      clarification: 'Уточните, что происходит',
    });
    assert.equal(low.kind, 'ok');
    assert.ok(low.items.length >= 1);
    assert.match(low.clarifyingQuestion, /Уточните/);
    const oos = MLMA.applyRerankResponse(local, {
      confidence: 0.1,
      matchType: 'out_of_scope',
      topMatches: [],
      relatedMatches: [],
      clarification: 'Этот запрос не относится к библиотеке',
    });
    assert.equal(oos.kind, 'zero');
    assert.equal(oos.items.length, 0);
  });

  it('для широкого и adjacent-запроса ИИ не сужает выдачу до одной карточки', () => {
    const novice = search('новичок теряется');
    assert.ok(novice.featured.length >= 3);
    const narrowed = MLMA.applyRerankResponse(novice, {
      confidence: 0.92,
      matchType: 'exact',
      topMatches: [{ trackId: 'A1-010', confidence: 0.92, reason: 'План первых действий' }],
      relatedMatches: [],
      clarification: 'Какую роль вы бы хотели?',
    }, tracks);
    assert.equal(narrowed.matchType, 'adjacent');
    assert.ok(narrowed.featured.length >= 3, 'novice featured ' + narrowed.featured.map((row) => row.trackId).join(','));
    assert.ok(narrowed.featured.some((row) => row.trackId === 'A1-004'));
    assert.match(String(narrowed.clarifyingQuestion || ''), /роль|написать|продукт/i);

    const city = search('хочу открыть новый город');
    const hijack = MLMA.applyRerankResponse(city, {
      confidence: 0.9,
      matchType: 'exact',
      topMatches: [{ trackId: 'A3-016', confidence: 0.9, reason: 'Открыть разговор' }],
      relatedMatches: [],
    }, tracks);
    assert.equal(hijack.matchType, 'adjacent');
    assert.ok(hijack.featured.some((row) => row.trackId === 'A2-008'));
    assert.ok(!hijack.featured.some((row) => row.trackId === 'A3-016'));
    assert.match(String(hijack.clarifyingQuestion || ''), /город|регион/);
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

const ROUTING = [
  { q: 'планирование', expect: ['A1-010', 'A1-008', 'A1-004'], match: ['strong', 'exact'], clarify: false },
  { q: 'нужен план', expect: ['A1-010', 'A1-008', 'A1-007'], match: ['strong', 'exact', 'adjacent'] },
  { q: 'всё хаотично', expect: ['A1-010', 'A6-011'], match: ['strong', 'adjacent'] },
  { q: 'не успеваю работать с контактами', expect: ['A1-010', 'A2-006', 'A6-010', 'A6-011'], match: ['strong', 'adjacent'] },
  { q: 'хочу составить план на месяц', expect: ['A1-010'], match: ['strong', 'exact', 'adjacent'] },
  { q: 'новичок теряется', expect: ['A1-004', 'A1-010', 'A1-011', 'A1-006'], match: ['adjacent', 'strong'], clarifyNeed: true },
  { q: 'я только зарегистрировался и не понимаю, что делать', expect: ['A1-004', 'A1-010', 'A1-006'], match: ['adjacent', 'strong'] },
  { q: 'слишком много информации', expect: ['A1-011', 'A1-004', 'A1-006', 'A1-010'], match: ['adjacent', 'strong'] },
  { q: 'с чего начать новичку', expect: ['A1-004', 'A1-010', 'A1-006'], match: ['adjacent', 'strong'] },
  { q: 'не понимаю, кому писать', expect: ['A2-008', 'A2-010'], match: ['strong', 'adjacent', 'exact'] },
  { q: 'хочу найти первых клиентов', expect: ['A1-010', 'A2-008', 'A3-002'], match: ['strong', 'adjacent', 'exact'] },
  { q: 'человек молчит', expect: ['A5-010', 'A3-008', 'A5-011'], match: ['strong', 'adjacent', 'exact'] },
  { q: 'мне сказали, что дорого', expect: ['A5-005', 'A4-013'], match: ['strong', 'adjacent', 'exact'] },
  { q: 'боюсь навязываться', expect: ['A1-001'], match: ['strong', 'exact', 'adjacent'] },
  { q: 'хочу выстроить команду', expect: ['A6-013', 'A6-012', 'A1-016', 'A1-004'], match: ['strong', 'adjacent'] },
  { q: 'партнёры стоят на месте', expect: ['A6-013', 'A6-012', 'A6-011', 'A1-016'], match: ['strong', 'adjacent'] },
  { q: 'хочу открыть новый город', expect: ['A2-008', 'A2-011', 'A1-010'], match: ['adjacent'], honesty: /город|регион/ },
  { q: 'как отремонтировать автомобиль', expect: [], empty: true },
];

describe('маршрутизация обязательных запросов', () => {
  for (const item of ROUTING) {
    it(item.q, () => {
      const result = search(item.q);
      if (item.empty) {
        assert.equal(result.kind, 'zero');
        assert.equal(result.matchType, 'out_of_scope');
        assert.equal(result.items.length, 0);
        return;
      }
      const found = result.items.map((row) => row.trackId);
      const featured = (result.featured || []).map((row) => row.trackId);
      assert.equal(result.kind, 'ok', item.q + ' kind=' + result.kind);
      assert.ok(found.length >= 1, item.q + ' empty local');
      assert.ok(
        item.expect.some((id) => found.includes(id) || featured.includes(id)),
        item.q + ' got ' + found.join(',') + ' expected ' + item.expect.join(','),
      );
      if (item.match) assert.ok(item.match.includes(result.matchType), item.q + ' matchType=' + result.matchType);
      if (item.clarifyNeed) assert.match(String(result.clarifyingQuestion || ''), /роль|написать|продукт/i);
      if (item.honesty) assert.match(String(result.clarifyingQuestion || ''), item.honesty);
      const payload = MLMA.rerankPayload(result, item.q, tracks);
      assert.ok(payload.candidates.length >= 12 && payload.candidates.length <= 20, item.q + ' candidates ' + payload.candidates.length);
      assert.equal(payload.candidates.some((row) => !/^A[1-6]-\d{3}$/.test(row.trackId)), false);
    });
  }

  it('searchDocument есть у каждого трека и не пустой для осмысленного запроса', () => {
    const doc = MLMA.searchDocument(tracks.find((row) => row.trackId === 'A1-010'));
    assert.equal(doc.trackId, 'A1-010');
    assert.ok(doc.title);
    assert.ok(Array.isArray(doc.aliases));
    assert.ok(doc.aliases.some((item) => /план/i.test(item)));
    const local = search('планирование');
    const payload = MLMA.rerankPayload(local, 'планирование', tracks);
    assert.ok(payload.candidates.some((row) => row.trackId === 'A1-010'));
    assert.ok(payload.candidates.length >= 12);
  });

  it('поиск в оболочке запускается только submit/Enter, не по вводу', () => {
    const ui = fs.readFileSync(path.join(__dirname, '../src/ui.js'), 'utf8');
    assert.match(ui, /form\.addEventListener\('submit'/);
    assert.equal(/#mlma-search[\s\S]{0,240}addEventListener\('input'/.test(ui), false);
    assert.equal(/addEventListener\('input'[\s\S]{0,200}searchCatalog/.test(ui), false);
    assert.match(ui, /type="search" name="q"/);
  });
});
