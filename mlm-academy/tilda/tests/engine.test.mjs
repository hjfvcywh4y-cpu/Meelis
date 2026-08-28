import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const MLMA = require('../src/domain.js');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PUBLIC_FIELDS = MLMA.PUBLIC_FIELDS.slice().sort();
const FORBIDDEN = [
  'adaptationDecision',
  'originalTitle',
  'sourceCode',
  'pageStatusRaw',
  'internalNote',
  'transformationType',
  'adaptationLevel',
  'legacyPublicUrl',
  'Не создана',
  'Осовременивание',
  'mlmacademy.ru/track',
  'priority',
];

function sampleTrack(overrides) {
  return Object.assign(
    {
      order: 1,
      sectionId: 'A3',
      module: 'Модуль',
      trackId: 'A3-002',
      title: 'Написать первое сообщение теплому контакту',
      situation: 'Знаю, кому написать, но не знаю как начать',
      outcome: 'Готово короткое сообщение',
      priority: 'P0',
      format: 'Практика',
      nextTrackIds: ['A3-016', 'A3-008'],
      legacyPublicUrl: 'https://mlmacademy.ru/track/a3-002',
      pageStatusRaw: 'Не создана',
      publicationStatus: 'planned',
      visibility: 'catalog',
      access: 'undecided',
      contentStatus: 'metadata_only',
      adaptationLevel: 'Осовременить',
      transformationType: 'Осовременивание',
      internalNote: 'secret',
      source: { sourceCode: '1.1', originalTitle: 'old', pages: '1', adaptationDecision: 'x' },
    },
    overrides,
  );
}

describe('санитайзер Tilda', () => {
  it('оставляет только белый список полей', () => {
    const publicTrack = MLMA.toPublicTrack(sampleTrack());
    assert.deepEqual(Object.keys(publicTrack).sort(), PUBLIC_FIELDS);
  });

  it('не пропускает внутренние поля', () => {
    const publicTrack = MLMA.toPublicTrack(sampleTrack());
    for (const field of ['priority', 'source', 'adaptationLevel', 'transformationType', 'internalNote', 'pageStatusRaw', 'legacyPublicUrl', 'order']) {
      assert.equal(Object.prototype.hasOwnProperty.call(publicTrack, field), false);
    }
  });

  it('компактная запись разворачивается в тот же публичный объект', () => {
    const compact = MLMA.compactTrack(sampleTrack());
    const expanded = MLMA.toPublicTrack(compact);
    const original = MLMA.toPublicTrack(sampleTrack());
    assert.deepEqual(expanded, original);
    assert.equal(compact.id, 'A3-002');
    assert.equal(Object.prototype.hasOwnProperty.call(compact, 'priority'), false);
  });
});

describe('честные статусы', () => {
  it('не даёт кнопку «Начать», пока содержания нет', () => {
    const status = MLMA.getTrackStatusView(MLMA.toPublicTrack(sampleTrack()));
    assert.equal(status.canStart, false);
    assert.equal(status.showProgress, false);
    assert.equal(status.availability, 'preparing');
    assert.equal(status.cta, 'Открыть описание');
    assert.notEqual(status.label, 'Скоро');
  });
});

describe('поиск', () => {
  it('находит по ситуации без учёта регистра и ё', () => {
    const tracks = [MLMA.toPublicTrack(sampleTrack({ situation: 'Человек взял паузу' }))];
    const found = MLMA.filterTracks(tracks, { query: 'ПАУЗУ' });
    assert.equal(found.length, 1);
  });

  it('поднимает title выше описания', () => {
    const tracks = [
      MLMA.toPublicTrack(sampleTrack({ trackId: 'A3-008', title: 'Другое', situation: 'первый диалог уже был', outcome: 'заметка' })),
      MLMA.toPublicTrack(sampleTrack({ trackId: 'A3-002', title: 'Первый диалог', situation: 'Нужно начать разговор', outcome: 'Сообщение' })),
    ];
    const found = MLMA.filterTracks(tracks, { query: 'первый диалог' });
    assert.equal(found[0].trackId, 'A3-002');
  });

  it('понимает синонимы «боюсь навязываться»', () => {
    const tracks = [MLMA.toPublicTrack(sampleTrack({ sectionId: 'A1', trackId: 'A1-001', title: 'Этика', situation: 'Мне неловко предлагать продукт: кажется, что я навязываюсь', outcome: 'Позиция' }))];
    const found = MLMA.filterTracks(tracks, { query: 'боюсь навязываться' });
    assert.equal(found.length, 1);
  });

  it('не выдаёт случайные карточки на стоп-словах', () => {
    const tracks = [MLMA.toPublicTrack(sampleTrack())];
    const found = MLMA.filterTracks(tracks, { query: 'а что мне' });
    assert.equal(found.length, 0);
    assert.equal(MLMA.analyzeQuery('а что мне').kind, 'need_more');
  });

  it('фильтрует этап и ищет одновременно', () => {
    const tracks = [
      MLMA.toPublicTrack(sampleTrack({ sectionId: 'A3', trackId: 'A3-002', title: 'Написать сообщение', situation: 'Знаю, кому написать' })),
      MLMA.toPublicTrack(sampleTrack({ sectionId: 'A1', trackId: 'A1-001', title: 'Написать план', situation: 'Хочу начать' })),
    ];
    const found = MLMA.filterTracks(tracks, { query: 'написать', sectionId: 'A3' });
    assert.equal(found.length, 1);
    assert.equal(found[0].trackId, 'A3-002');
  });
});

describe('URL state', () => {
  it('сериализует только активные параметры', () => {
    const qs = MLMA.serializeLibraryState({ q: 'кому написать', stage: 'A3', type: 'track', goal: 'first-dialogue' });
    assert.equal(qs.includes('q='), true);
    assert.equal(qs.includes('stage=a3'), true);
    assert.equal(qs.includes('goal=first-dialogue'), true);
    const parsed = MLMA.parseLibraryState('?' + qs);
    assert.equal(parsed.stage, 'A3');
    assert.equal(parsed.goal, 'first-dialogue');
    assert.equal(parsed.q, 'кому написать');
  });

  it('раскрывает preset без подмены целым разделом', () => {
    const parsed = MLMA.parseLibraryState('?preset=just-started');
    assert.equal(parsed.preset, 'just-started');
    assert.equal(parsed.stage, null);
    const preset = MLMA.getPreset('just-started');
    assert.ok(preset.trackIds.includes('A1-004'));
    assert.ok(preset.trackIds.length < 16);
  });
});

describe('видимость каталога', () => {
  it('показывает planned-треки в библиотеке и открывает карточку', () => {
    const track = MLMA.toPublicTrack(sampleTrack());
    assert.equal(MLMA.isListed(track, false), true);
    assert.equal(MLMA.isReachable(track, false), true);
    assert.equal(MLMA.getById([track], 'A3-002', false).title, track.title);
  });
});

describe('следующий шаг', () => {
  it('без истории предлагает выбрать ситуацию', () => {
    assert.deepEqual(
      MLMA.resolveNextAction({ profile: MLMA.EMPTY_PROFILE, tracks: [] }),
      { kind: 'choose_situation' },
    );
  });

  it('честно сообщает, что раздел готовится', () => {
    const track = MLMA.toPublicTrack(sampleTrack({ trackId: 'A5-001', sectionId: 'A5' }));
    const decision = MLMA.resolveNextAction({
      profile: MLMA.sanitizeProfile({ selectedSectionId: 'A5' }),
      tracks: [track],
    });
    assert.deepEqual(decision, { kind: 'section_preparing', sectionId: 'A5' });
  });

  it('не показывает больше трёх альтернатив', () => {
    const tracks = ['A1-001', 'A1-002', 'A1-003', 'A1-004', 'A1-005'].map((id) =>
      MLMA.toPublicTrack(sampleTrack({ trackId: id, sectionId: 'A1' })),
    );
    const decision = { kind: 'choose_situation' };
    const alts = MLMA.resolveAlternatives(decision, {
      profile: MLMA.sanitizeProfile({
        selectedSectionId: 'A1',
        savedTrackIds: tracks.map((item) => item.trackId),
      }),
      tracks,
    });
    assert.equal(alts.length, 3);
  });
});

describe('рекомендации', () => {
  it('берёт продолжения только из nextTrackIds', () => {
    const current = MLMA.toPublicTrack(sampleTrack());
    const next = MLMA.toPublicTrack(sampleTrack({ trackId: 'A3-016', title: 'Продолжение' }));
    const stranger = MLMA.toPublicTrack(sampleTrack({ trackId: 'A6-001', sectionId: 'A6' }));
    const result = MLMA.recommendNextTracks({
      current,
      visibleTracks: { 'A3-016': next, 'A3-008': stranger, 'A6-001': stranger },
    });
    assert.equal(result.primary.track.trackId, 'A3-016');
    assert.ok(result.needsFallback);
  });
});

describe('маршруты Tilda', () => {
  it('ведёт на /track?id= пока нет отдельной страницы', () => {
    const R = MLMA.routes({ dedicatedTrackPages: [] });
    assert.equal(R.home(), '/academy');
    assert.equal(R.track('A3-002'), '/track?id=a3-002');
    assert.equal(R.section('A1'), '/library/a1');
    assert.equal(R.about(), '/about');
  });

  it('переключается на красивый URL, когда страница заведена', () => {
    const R = MLMA.routes({ dedicatedTrackPages: ['a3-002'] });
    assert.equal(R.track('A3-002'), '/track/a3-002');
    assert.equal(R.track('A1-001'), '/track?id=a1-001');
  });
});

describe('поисковые ситуации каталога', () => {
  const catalogPath = path.join(__dirname, '../../src/data/tracks.catalog.json');
  const raw = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const tracks = MLMA.toPublicList(raw.tracks);

  function ids(query) {
    return MLMA.searchCatalog(tracks, MLMA.parseLibraryState('', { q: query })).items.map((item) => item.trackId);
  }

  it('боюсь написать знакомому → A3-002 первым', () => {
    assert.equal(ids('боюсь написать знакомому')[0], 'A3-002');
  });

  it('мне некому писать поднимает базу и круги', () => {
    const top = ids('мне некому писать').slice(0, 6).join(' ');
    assert.match(top, /A2-008/);
    assert.match(top, /A2-010|A2-006|A2-011/);
  });

  it('стыдно продавать и навязываться → A1-001', () => {
    assert.equal(ids('стыдно продавать и навязываться')[0], 'A1-001');
  });

  it('человек сказал что подумает → A5', () => {
    const top = ids('человек сказал что подумает').slice(0, 5);
    assert.ok(top.every((id) => id.startsWith('A5')), top.join(','));
  });

  it('клиент купил и больше не отвечает → follow-up', () => {
    const top = ids('клиент купил и больше не отвечает').slice(0, 5);
    assert.ok(top.some((id) => id.startsWith('A6') || id === 'A5-010'), top.join(','));
  });

  it('не знаю как рассказать о продукте', () => {
    const top = ids('не знаю как рассказать о продукте').slice(0, 6);
    assert.ok(top.includes('A1-012') || top.includes('A1-011') || top.includes('A4-001'), top.join(','));
  });

  it('партнёры ничего не делают не выдаёт весь A6', () => {
    const result = ids('партнёры ничего не делают');
    assert.ok(result.length > 0 && result.length < 20, String(result.length));
    assert.ok(result.includes('A6-013') || result.includes('A1-016') || result.includes('A6-011'));
  });

  it('пресет не открывает весь раздел', () => {
    const result = MLMA.searchCatalog(tracks, MLMA.parseLibraryState('?preset=grow-team'));
    assert.ok(result.items.length <= 8);
    assert.ok(result.items.every((item) => ['A1', 'A6'].includes(item.sectionId)));
  });
});

describe('собранный каталог', () => {
  it('не содержит внутренних строк и имеет 112 треков', () => {
    const catalogPath = path.join(__dirname, '../dist/shared/catalog.json');
    assert.equal(fs.existsSync(catalogPath), true, 'сначала запустите node tilda/generate.mjs');
    const raw = fs.readFileSync(catalogPath, 'utf8');
    const payload = JSON.parse(raw);
    assert.equal(payload.tracks.length, 112);
    for (const needle of FORBIDDEN) {
      assert.equal(raw.includes(needle), false, needle);
    }
    assert.equal(/"P[012]"/.test(raw), false);
    const expanded = MLMA.toPublicList(payload.tracks);
    assert.equal(expanded.length, 112);
    assert.deepEqual(Object.keys(expanded[0]).sort(), PUBLIC_FIELDS);
  });

  it('фрагменты T123 укладываются в лимит', () => {
    const dir = path.join(__dirname, '../dist/t123');
    const files = fs.readdirSync(dir).filter((name) => name.endsWith('.html'));
    assert.ok(files.length >= 5);
    for (const name of files) {
      const chars = fs.readFileSync(path.join(dir, name), 'utf8').length;
      assert.ok(chars <= 45000, name + ' = ' + chars);
    }
  });
});
