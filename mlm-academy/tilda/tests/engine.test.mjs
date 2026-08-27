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
  });
});

describe('поиск', () => {
  it('находит по ситуации без учёта регистра и ё', () => {
    const tracks = [MLMA.toPublicTrack(sampleTrack({ situation: 'Человек взял паузу' }))];
    const found = MLMA.filterTracks(tracks, { query: 'ПАУЗУ' });
    assert.equal(found.length, 1);
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
  });

  it('переключается на красивый URL, когда страница заведена', () => {
    const R = MLMA.routes({ dedicatedTrackPages: ['a3-002'] });
    assert.equal(R.track('A3-002'), '/track/a3-002');
    assert.equal(R.track('A1-001'), '/track?id=a1-001');
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
