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
    assert.match(publicTrack.imageUrl, /^data:image\/svg\+xml/);
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
  it('даёт контур прохождения, а не фальшивый урок', () => {
    const status = MLMA.getTrackStatusView(MLMA.toPublicTrack(sampleTrack()));
    assert.equal(status.canStart, false);
    assert.equal(status.cta, 'Открыть описание');
    assert.equal(status.availability, 'shell');
    assert.notEqual(status.label, 'Скоро');
    assert.match(status.explanation, /Начать/);
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
    assert.equal(R.research(), '/research/marketing-plan');
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
    const t123 = fs.readFileSync(path.join(__dirname, '../dist/t123/04-ui-01.html'), 'utf8') +
      fs.readFileSync(path.join(__dirname, '../dist/t123/00-head.html'), 'utf8');
    assert.equal(/OPENAI_API_KEY|sk-[A-Za-z0-9]{16,}/.test(t123), false);
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

describe('онтология и runtime', () => {
  const catalogPath = path.join(__dirname, '../../src/data/tracks.catalog.json');
  const raw = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const tracks = MLMA.toPublicList(raw.tracks);

  it('разводит трек и материал', () => {
    const track = MLMA.toPublicTrack(sampleTrack());
    const material = MLMA.toPublicTrack(sampleTrack({ format: 'Статья / гайд', trackId: 'A1-002' }));
    assert.equal(MLMA.itemKind(track), 'track');
    assert.equal(MLMA.itemKind(material), 'material');
    assert.equal(MLMA.getTrackStatusView(material).cta, 'Открыть материал');
    assert.equal(MLMA.getTrackStatusView(track).cta, 'Открыть описание');
    assert.equal(MLMA.getTrackStatusView(track).canStart, false);
  });

  it('validateTrack ловит дыры паспорта и битые связи', () => {
    const broken = MLMA.toPublicTrack(sampleTrack({ nextTrackIds: ['A9-999'], situation: '' }));
    const result = MLMA.validateTrack(broken, tracks);
    assert.equal(result.ok, false);
    assert.ok(result.issues.includes('missing_trigger'));
    assert.ok(result.issues.includes('broken_nextTrackId'));
  });

  it('validateCatalog проходит по 112 объектам без критичных дыр', () => {
    const report = MLMA.validateCatalog(tracks);
    assert.equal(report.total, 112);
    assert.equal(report.ok, true, JSON.stringify(report.failures.slice(0, 5)));
  });

  it('самоотметка «готово» не завершает трек', () => {
    const track = MLMA.toPublicTrack(sampleTrack());
    const check = MLMA.qualityCheck(track, { artifact: 'готово', evidenceNote: 'я сделал' });
    assert.equal(check.branch, 'error');
    assert.ok(check.gaps.some((item) => /доказательств|коротк|сделал/i.test(item)));
  });

  it('принимает конкретный артефакт и отделяет NBA от related', () => {
    const track = tracks.find((item) => item.trackId === 'A3-002');
    const artifact = 'Короткое сообщение знакомому Марине: написать про встречу в субботу и спросить, удобно ли созвониться. Без гарантий дохода.';
    const note = 'Черновик сохранён в заметках и готов к отправке в чат.';
    const check = MLMA.qualityCheck(track, { artifact, evidenceNote: note });
    assert.ok(check.branch === 'success' || check.branch === 'highResult', check.branch);
    const nba = MLMA.nextBestAction(track, tracks, { branch: 'success', attempts: 1 }, { selectedSectionId: 'A3' });
    assert.equal(nba.kind, 'open_track');
    assert.ok(track.nextTrackIds.includes(nba.track.trackId));
    const related = MLMA.relatedContent(track, tracks, 3);
    assert.ok(related.every((item) => item.trackId !== nba.track.trackId));
    const retry = MLMA.nextBestAction(track, tracks, { branch: 'error', attempts: 1 }, null);
    assert.equal(retry.kind, 'retry');
  });

  it('пасспорт не показывает служебные ID как пользовательский текст', () => {
    const passport = MLMA.derivePassport(tracks[0]);
    assert.ok(passport.trigger);
    assert.ok(passport.targetState);
    assert.notEqual(passport.trigger, passport.targetState);
    assert.match(passport.leadingMechanic.id, /^MEC-/);
    assert.match(passport.dominantGenre, /^GEN-/);
  });
});

describe('статический fallback', () => {
  it('A1–A6 и track имеют собственный H1', () => {
    const dir = path.join(__dirname, '../dist/t123/mounts');
    const a1 = fs.readFileSync(path.join(dir, 'a1.html'), 'utf8');
    const a2 = fs.readFileSync(path.join(dir, 'a2.html'), 'utf8');
    const track = fs.readFileSync(path.join(dir, 'track.html'), 'utf8');
    const library = fs.readFileSync(path.join(dir, 'library.html'), 'utf8');
    assert.match(a1, /<h1>A1 · Старт и система<\/h1>/);
    assert.match(a2, /<h1>A2 · Люди и база<\/h1>/);
    assert.notEqual(a1.match(/<h1>[^<]+<\/h1>/)[0], a2.match(/<h1>[^<]+<\/h1>/)[0]);
    assert.match(track, /<h1>Карточка трека MLM Academy<\/h1>/);
    assert.match(library, /<h1>Библиотека MLM Academy<\/h1>/);
    assert.match(a1, /href="\/library"/);
    assert.match(a1, /href="\/academy"/);
  });
});

describe('статья-мост research/marketing-plan', () => {
  it('ведёт в исследование и в B2B с UTM', () => {
    const R = MLMA.routes();
    assert.equal(R.research(), '/research/marketing-plan');
    assert.equal(MLMA.siteHomeUrl(), '/');
    assert.match(MLMA.b2bFromResearchUrl(), /utm_source=mlm_academy/);
    assert.match(MLMA.b2bFromResearchUrl(), /utm_campaign=marketing_plan/);
  });

  it('не содержит B2C-навигации и запрещённых ссылок', () => {
    const body = fs.readFileSync(path.join(__dirname, '../research/article.body.html'), 'utf8');
    assert.match(body, /Посмотреть решение для компании/);
    assert.match(body, /b2b_open_from_research/);
    assert.equal(/href="\/library/.test(body), false);
    assert.equal(/href="\/start/.test(body), false);
    assert.equal(/href="\/my/.test(body), false);
    assert.equal(/href="\/profile/.test(body), false);
    assert.equal(/href="\/track/.test(body), false);
    assert.match(body, /utm_source=mlm_academy/);
  });

  it('передаёт поля воронки в событие', () => {
    const sent = MLMA.funnelEvent('research_open_from_b2c', {
      source_page: '/academy',
      target_page: '/research/marketing-plan',
      cta_position: 'academy_home_after_route',
    });
    assert.equal(sent.event, 'research_open_from_b2c');
    assert.equal(sent.source_page, '/academy');
    assert.equal(sent.target_page, '/research/marketing-plan');
    assert.equal(sent.cta_position, 'academy_home_after_route');
    assert.equal(sent.article_slug, 'marketing-plan');
    assert.ok(sent.timestamp);
  });

  it('индексируется и сохраняет один canonical на оригинал', () => {
    const head = fs.readFileSync(path.join(__dirname, '../research/head.html'), 'utf8');
    assert.match(head, /content="index, follow"/);
    assert.equal(/noindex/.test(head), false);
    assert.equal((head.match(/rel="canonical"/g) || []).length, 1);
    assert.match(head, /href="https:\/\/mlmacademy\.ru\/research\/marketing-plan"/);
    assert.match(head, /property="og:url" content="https:\/\/mlmacademy\.ru\/research\/marketing-plan"/);
    assert.match(head, /property="og:description"/);
  });

  it('на B2B даёт вход в статью без новой формы', () => {
    const proof = fs.readFileSync(path.join(__dirname, '../research/b2b-proof.html'), 'utf8');
    assert.match(proof, /research_open_from_b2b/);
    assert.match(proof, /href="\/research\/marketing-plan"/);
    assert.equal(/t-input|t-form/.test(proof), false);
  });
});

