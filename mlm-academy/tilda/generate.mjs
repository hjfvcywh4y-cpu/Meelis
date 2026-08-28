#!/usr/bin/env node
/**
 * Собирает paste-ready фрагменты T123 и локальный предпросмотр оболочки.
 * В выход попадают только публичные поля каталога.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const MLMA = require('./src/domain.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(__dirname, 'src');
const DIST = path.join(__dirname, 'dist');
const T123_LIMIT = 45000;

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
];

const catalogFile = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/tracks.catalog.json'), 'utf8'));
const sectionsFile = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/sections.json'), 'utf8'));
const rulesFile = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/recommendation.rules.json'), 'utf8'));
const pilotFile = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/pilot.graph.json'), 'utf8'));

const tracks = catalogFile.tracks
  .slice()
  .sort((a, b) => a.order - b.order)
  .map((track) => MLMA.compactTrack(track))
  .filter(Boolean);

if (tracks.length !== 112) {
  throw new Error('Ожидалось 112 публичных треков, получено ' + tracks.length);
}

const payload = {
  version: catalogFile.version,
  config: {
    dedicatedTrackPages: [],
  },
  sections: sectionsFile.sections.map((section) => ({
    order: section.order,
    sectionId: section.sectionId,
    shortTitle: section.shortTitle,
    title: section.title,
    entryQuestion: section.entryQuestion,
    promise: section.promise,
    routeLogic: section.routeLogic.slice(),
  })),
  rules: {
    version: rulesFile.version,
    engine: rulesFile.engine,
    entryRules: rulesFile.entryRules,
    completionOutcomes: rulesFile.completionOutcomes,
    limits: rulesFile.limits,
  },
  pilot: {
    version: pilotFile.version,
    nodes: pilotFile.nodes.map((node) => ({
      step: node.step,
      trackId: node.trackId,
      sectionId: node.sectionId,
      title: node.title,
      outcome: node.outcome,
      nextTrackIds: node.nextTrackIds.slice(),
    })),
  },
  tracks,
};

const json = JSON.stringify(payload).replace(/</g, '\\u003c');
for (const needle of FORBIDDEN) {
  if (json.includes(needle)) {
    throw new Error('В публичном JSON найден запрещённый фрагмент: ' + needle);
  }
}
if (/"P[012]"/.test(json)) {
  throw new Error('В публичном JSON найден внутренний приоритет');
}

const css = fs.readFileSync(path.join(SRC, 'mlma.css'), 'utf8');
const domainCore = fs.readFileSync(path.join(SRC, 'domain.js'), 'utf8');
const accessJs = fs.readFileSync(path.join(SRC, 'access.js'), 'utf8');
const storageJs = fs.readFileSync(path.join(SRC, 'storage.js'), 'utf8');
const paymentsJs = fs.readFileSync(path.join(SRC, 'payments.js'), 'utf8');
const searchJs = fs.readFileSync(path.join(SRC, 'search.js'), 'utf8');
const analyticsJs = fs.readFileSync(path.join(SRC, 'analytics.js'), 'utf8');
const ontologyJs = fs.readFileSync(path.join(SRC, 'ontology.js'), 'utf8');
const SPLIT = '\n\n/* __MLMA_UI_SPLIT__ */\n\n';
const domainJs = [domainCore.trim(), accessJs.trim(), storageJs.trim(), paymentsJs.trim(), searchJs.trim(), analyticsJs.trim()].join(SPLIT) + '\n\n' + ontologyJs.trim();
const uiJs = fs.readFileSync(path.join(SRC, 'ui.js'), 'utf8');

const pages = [
  { id: 'home', file: 'academy.html', url: '/academy', page: 'home', title: 'MLM Academy — библиотека действий', members: 'public' },
  { id: 'start', file: 'start.html', url: '/start', page: 'start', title: 'С чего начать · MLM Academy', members: 'public' },
  { id: 'library', file: 'library.html', url: '/library', page: 'library', title: 'Библиотека · MLM Academy', members: 'public' },
  { id: 'a1', file: 'library-a1.html', url: '/library/a1', page: 'section', section: 'A1', title: 'A1 · Старт и система · MLM Academy', members: 'public' },
  { id: 'a2', file: 'library-a2.html', url: '/library/a2', page: 'section', section: 'A2', title: 'A2 · Люди и база · MLM Academy', members: 'public' },
  { id: 'a3', file: 'library-a3.html', url: '/library/a3', page: 'section', section: 'A3', title: 'A3 · Первый контакт · MLM Academy', members: 'public' },
  { id: 'a4', file: 'library-a4.html', url: '/library/a4', page: 'section', section: 'A4', title: 'A4 · Потребность и решение · MLM Academy', members: 'public' },
  { id: 'a5', file: 'library-a5.html', url: '/library/a5', page: 'section', section: 'A5', title: 'A5 · Сомнения и отказ · MLM Academy', members: 'public' },
  { id: 'a6', file: 'library-a6.html', url: '/library/a6', page: 'section', section: 'A6', title: 'A6 · Повтор и рост · MLM Academy', members: 'public' },
  { id: 'track', file: 'track.html', url: '/track', page: 'track', title: 'Трек · MLM Academy', members: 'public' },
  { id: 'about', file: 'about.html', url: '/about', page: 'about', title: 'Как создаётся библиотека · MLM Academy', members: 'public' },
  { id: 'my', file: 'my.html', url: '/my', page: 'my', title: 'Личная главная · MLM Academy', members: 'member' },
  { id: 'route', file: 'my-route.html', url: '/my/route', page: 'route', title: 'Мой маршрут · MLM Academy', members: 'member' },
  { id: 'results', file: 'my-results.html', url: '/my/results', page: 'results', title: 'Мои результаты · MLM Academy', members: 'member' },
  { id: 'profile', file: 'profile.html', url: '/profile', page: 'profile', title: 'Профиль · MLM Academy', members: 'member' },
  { id: 'access', file: 'access.html', url: '/access', page: 'access', title: 'Доступ · MLM Academy', members: 'public' },
  { id: 'preview', file: 'preview-catalog.html', url: '/preview/catalog', page: 'preview', title: 'Предпросмотр каталога · MLM Academy', members: 'editor' },
];

function splitText(text, limit) {
  if (text.length <= limit) return [text];
  const chunks = [];
  for (let i = 0; i < text.length; i += limit) chunks.push(text.slice(i, i + limit));
  return chunks;
}

function splitJsOnMarker(source, marker) {
  if (!source.includes(marker)) return [source];
  const parts = source.split(marker).map((part) => part.trim() + '\n');
  return parts.filter((part) => part.trim().length > 0);
}

function t123Wrap(inner, note) {
  return `<!-- ${note} Не публиковать. Не вставлять в общесайтовый HEAD. -->\n${inner}\n`;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function write(file, contents) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, contents);
  return contents.length;
}

ensureDir(path.join(DIST, 't123'));
ensureDir(path.join(DIST, 't123/mounts'));
ensureDir(path.join(DIST, 'preview'));
ensureDir(path.join(DIST, 'shared'));

for (const name of fs.readdirSync(path.join(DIST, 't123'))) {
  const full = path.join(DIST, 't123', name);
  if (name.endsWith('.html')) fs.unlinkSync(full);
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tracksForSection(sectionId) {
  return tracks.filter((row) => row.s === sectionId).slice(0, 8);
}

function trackListHtml(rows) {
  if (!rows.length) return '';
  return `<ul>
      ${rows.map((row) => `<li><a href="/track?id=${String(row.id).toLowerCase()}">${escapeHtml(row.t)}</a></li>`).join('\n      ')}
    </ul>`;
}

function noscriptFor(page) {
  const section = page.section ? payload.sections.find((item) => item.sectionId === page.section) : null;
  const back = `<p><a href="/library">Библиотека</a> · <a href="/academy">Academy</a></p>`;
  if (page.page === 'section' && section) {
    const list = tracksForSection(section.sectionId);
    return `<noscript>
  <div class="mlma-noscript">
    <h1>${escapeHtml(section.sectionId)} · ${escapeHtml(section.shortTitle)}</h1>
    <p>${escapeHtml(section.promise)}</p>
    <p>Здесь можно открыть описания треков направления и понять, какое действие делать первым. Поиск и фильтры работают с JavaScript.</p>
    ${trackListHtml(list)}
    ${back}
  </div>
</noscript>`;
  }
  if (page.page === 'library') {
    return `<noscript>
  <div class="mlma-noscript">
    <h1>Библиотека MLM Academy</h1>
    <p>Каталог рабочих треков: ситуация, действие, результат и следующий шаг.</p>
    <p>Можно выбрать направление A1–A6 или открыть карточку трека по ссылке.</p>
    <nav>
      <a href="/library/a1">A1 Старт и система</a>
      <a href="/library/a2">A2 Люди и база</a>
      <a href="/library/a3">A3 Первый контакт</a>
      <a href="/library/a4">A4 Потребность и решение</a>
      <a href="/library/a5">A5 Сомнения и отказ</a>
      <a href="/library/a6">A6 Повтор и рост</a>
    </nav>
    <p><a href="/academy">Academy</a></p>
  </div>
</noscript>`;
  }
  if (page.page === 'home') {
    return `<noscript>
  <div class="mlma-noscript">
    <h1>MLM Academy — библиотека действий</h1>
    <p>Рабочий навигатор партнёра: ситуация → действие → результат → следующий шаг.</p>
    <p>Выберите направление или опишите, что происходит сейчас.</p>
    <nav>
      <a href="/start">С чего начать</a>
      <a href="/library">Библиотека</a>
      <a href="/about">Как создаётся</a>
    </nav>
  </div>
</noscript>`;
  }
  if (page.page === 'start') {
    return `<noscript>
  <div class="mlma-noscript">
    <h1>С чего начать</h1>
    <p>Один ответ по ситуации определяет раздел и первый шаг. Кабинет для этого не нужен.</p>
    <p>Шесть направлений: старт, люди, первый контакт, потребность, сомнения, повтор и рост.</p>
    ${back}
  </div>
</noscript>`;
  }
  if (page.page === 'about') {
    return `<noscript>
  <div class="mlma-noscript">
    <h1>Как создаётся библиотека</h1>
    <p>Трек — это маршрут изменения состояния, а не страница с видео. Материал можно открыть. Трек нужно выполнить и оставить проверяемый след.</p>
    ${back}
  </div>
</noscript>`;
  }
  if (page.page === 'track') {
    const samples = ['A1-004', 'A2-008', 'A3-002', 'A4-001', 'A5-001', 'A6-001']
      .map((id) => tracks.find((row) => row.id === id))
      .filter(Boolean);
    return `<noscript>
  <div class="mlma-noscript">
    <h1>Карточка трека MLM Academy</h1>
    <p>Откройте трек по адресу /track?id=a3-002. Даже без JavaScript видно назначение: ситуация, действие и рабочий след.</p>
    <p>Статус большинства карточек сейчас — контур прохождения. Уроки появятся, когда содержание будет готово. Просмотр страницы не завершает трек.</p>
    ${trackListHtml(samples)}
    ${back}
  </div>
</noscript>`;
  }
  return `<noscript>
  <div class="mlma-noscript">
    <h1>${escapeHtml(page.title)}</h1>
    <p>MLM Academy. Для поиска и фильтров включите JavaScript.</p>
    ${back}
  </div>
</noscript>`;
}

const FAVICON_SVG =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#C45F42"/><rect x="7" y="7" width="18" height="18" rx="3" fill="none" stroke="#1c1914" stroke-width="2"/></svg>',
  );
const RERANK_PUBLIC_URL = process.env.MLMA_RERANK_PUBLIC_URL || '';

function robotsForPage(page) {
  if (page.members === 'member' || page.members === 'editor') return 'noindex, nofollow';
  if (page.page === 'track') return 'noindex, nofollow';
  return 'index, follow';
}

function jsonLdForPage(page) {
  const abs = 'https://mlmacademy.ru' + page.url;
  const crumbs = [{ '@type': 'ListItem', position: 1, name: 'Academy', item: 'https://mlmacademy.ru/academy' }];
  if (page.page === 'library' || page.page === 'section' || page.page === 'track') {
    crumbs.push({ '@type': 'ListItem', position: 2, name: 'Библиотека', item: 'https://mlmacademy.ru/library' });
  }
  if (page.page === 'section') {
    crumbs.push({ '@type': 'ListItem', position: 3, name: page.section, item: abs });
  } else if (page.url !== '/academy') {
    crumbs.push({ '@type': 'ListItem', position: crumbs.length + 1, name: page.title.split(' · ')[0], item: abs });
  }
  const graph = [
    { '@type': 'BreadcrumbList', itemListElement: crumbs },
  ];
  if (page.page === 'home' || page.page === 'library') {
    graph.push({
      '@type': 'CollectionPage',
      name: page.title,
      url: abs,
      inLanguage: 'ru',
      hasPart: {
        '@type': 'ItemList',
        itemListElement: payload.sections.map((section, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: section.sectionId + ' · ' + section.shortTitle,
          url: 'https://mlmacademy.ru/library/' + section.sectionId.toLowerCase(),
        })),
      },
    });
  } else if (page.page === 'section') {
    const rows = tracks.filter((row) => row.s === page.section).slice(0, 12);
    graph.push({
      '@type': 'CollectionPage',
      name: page.title,
      url: abs,
      inLanguage: 'ru',
      hasPart: {
        '@type': 'ItemList',
        itemListElement: rows.map((row, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: row.t,
          url: 'https://mlmacademy.ru/track?id=' + String(row.id).toLowerCase(),
        })),
      },
    });
  } else if (page.page === 'about') {
    graph.push({ '@type': 'Article', headline: page.title, url: abs, inLanguage: 'ru' });
  }
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')}</script>`;
}

function seoHead(page, opts = {}) {
  const map = {
    home: 'Рабочий навигатор партнёра: ситуация, действие, результат и следующий шаг. Шесть направлений от старта до роста команды.',
    start: 'Выберите ситуацию, в которой сейчас застряли. Академия подберёт первый трек без кабинета.',
    library: 'Каталог треков и материалов по этапам A1–A6. Поиск понимает живой запрос, а не только название.',
    about: 'Как устроена MLM Academy: трек как маршрут изменения состояния, а не страница с видео.',
    track: 'Карточка трека: ситуация, действие, рабочий след и следующее лучшее действие.',
    access: 'Сначала бесплатный кабинет, затем пакет START или FULL. Реальные списания пока выключены.',
    my: 'Личный кабинет MLM Academy. Страница не индексируется.',
    route: 'Маршрут и сохранённые треки. Страница не индексируется.',
    results: 'Результаты прохождения. Страница не индексируется.',
    profile: 'Профиль и настройки. Страница не индексируется.',
    preview: 'Служебный предпросмотр каталога. Страница не индексируется.',
  };
  const sectionMap = {
    A1: 'A1 Старт и система: роль, причина, продукт и рабочий план.',
    A2: 'A2 Люди и база: с кем начать, база и сегменты.',
    A3: 'A3 Первый контакт: канал, сообщение, звонок и договорённость.',
    A4: 'A4 Потребность и решение: услышать человека и собрать рекомендацию.',
    A5: 'A5 Сомнения и отказ: пауза, возражение и следующий шаг.',
    A6: 'A6 Повтор и рост: клиент, ритм и команда без ложных обещаний.',
  };
  const desc = page.section ? sectionMap[page.section] : map[page.page] || map.home;
  const abs = 'https://mlmacademy.ru' + page.url;
  const rerankUrl = opts.preview ? '/api/search/rerank' : RERANK_PUBLIC_URL;
  const rerankScript = rerankUrl
    ? `<script>window.MLMA_RERANK_URL = ${JSON.stringify(rerankUrl)};</script>`
    : '<!-- window.MLMA_RERANK_URL задаётся после деплоя search-proxy. Ключ модели в Tilda не класть. -->';
  return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@700&family=Onest:wght@400;700;800&display=swap" rel="stylesheet">
<meta name="robots" content="${robotsForPage(page)}">
<meta name="description" content="${escapeHtml(desc)}">
<link rel="canonical" href="${escapeHtml(abs)}">
<meta property="og:title" content="${escapeHtml(page.title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:url" content="${escapeHtml(abs)}">
<meta property="og:locale" content="ru_RU">
<meta property="og:type" content="website">
<link rel="icon" type="image/svg+xml" href="${FAVICON_SVG}">
<script>document.documentElement.lang = 'ru';</script>
${jsonLdForPage(page)}
${rerankScript}
<style>
  html, body, #allrecords, .t-records, .t-body { background: #f4f0e8 !important; }
  body { margin: 0 !important; }
  .t-rec { padding-top: 0 !important; padding-bottom: 0 !important; background: transparent !important; }
  .t-text { font-family: Onest, Arial, Helvetica, sans-serif !important; }
</style>
`;
}

write(path.join(DIST, 't123/00-head.html'), t123Wrap(seoHead(pages[0]).trim() + '\n', 'HTML для вставки внутрь HEAD этой страницы (Настройки страницы). Для разделов используйте t123/heads/<id>.html.'));
ensureDir(path.join(DIST, 't123/heads'));
for (const page of pages) {
  write(
    path.join(DIST, 't123/heads', `${page.id}.html`),
    t123Wrap(seoHead(page).trim() + '\n', `HEAD «${page.title}». URL: ${page.url}`),
  );
}

const cssBlock = `<style>\n${css.trim()}\n</style>\n`;
if (cssBlock.length > T123_LIMIT) throw new Error('CSS больше лимита T123: ' + cssBlock.length);
write(path.join(DIST, 't123/01-css.html'), t123Wrap(cssBlock, 'Блок T123 №1: стили .mlma'));

const dataChunks = splitText(json, 40000);
dataChunks.forEach((chunk, index) => {
  const n = String(index + 1).padStart(2, '0');
  const html = `<script type="application/json" id="mlma-data-${n}">${chunk}</script>\n`;
  if (html.length > T123_LIMIT) throw new Error('Фрагмент данных больше лимита: ' + html.length);
  write(path.join(DIST, `t123/02-data-${n}.html`), t123Wrap(html, `Блок T123 данные ${n}/${dataChunks.length}`));
});

function writeScriptChunks(source, basename, label) {
  const parts = splitJsOnMarker(source, '/* __MLMA_UI_SPLIT__ */');
  const files = [];
  parts.forEach((part, index) => {
    const html = `<script>\n${part.trim()}\n</script>\n`;
    const wrapped = t123Wrap(html, parts.length === 1 ? `Блок T123: ${label}` : `Блок T123: ${label} ${index + 1}/${parts.length}`);
    if (wrapped.length > T123_LIMIT) {
      throw new Error(`${label} часть ${index + 1} больше лимита T123: ${wrapped.length}`);
    }
    const name = parts.length === 1 ? `${basename}.html` : `${basename}-${String(index + 1).padStart(2, '0')}.html`;
    write(path.join(DIST, 't123', name), wrapped);
    files.push(name);
  });
  return files;
}

const domainFiles = writeScriptChunks(domainJs, '03-domain', 'доменная логика');
const uiFiles = writeScriptChunks(uiJs, '04-ui', 'рендер оболочки');

for (const page of pages) {
  const attrs = [
    'class="mlma"',
    `data-mlma-page="${page.page}"`,
  ];
  if (page.section) attrs.push(`data-mlma-section="${page.section}"`);
  const noscript = noscriptFor(page);
  const mount = `<div ${attrs.join(' ')}>\n  ${noscript}\n</div>\n`;
  write(path.join(DIST, 't123/mounts', `${page.id}.html`), t123Wrap(mount, `Блок T123: монтирование «${page.title}». Members: ${page.members}. URL: ${page.url}`));
}

write(path.join(DIST, 'shared/catalog.json'), JSON.stringify(payload));
write(path.join(DIST, 'shared/catalog-data.js'), 'window.MLMA_PAYLOAD = ' + json + ';\n');
write(path.join(DIST, 'shared/mlma.css'), css);
write(path.join(DIST, 'shared/domain.js'), domainJs);
write(path.join(DIST, 'shared/ui.js'), uiJs);
const v1 = path.join(DIST, 'shared/v1');
ensureDir(v1);
write(path.join(v1, 'catalog.json'), JSON.stringify(payload));
write(path.join(v1, 'catalog-data.js'), 'window.MLMA_PAYLOAD = ' + json + ';\n');
write(path.join(v1, 'mlma.css'), css);
write(path.join(v1, 'domain.js'), domainJs);
write(path.join(v1, 'ui.js'), uiJs);

function previewHtml(page) {
  const attrs = [`class="mlma"`, `data-mlma-page="${page.page}"`];
  if (page.section) attrs.push(`data-mlma-section="${page.section}"`);
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${page.title}</title>
  ${seoHead(page, { preview: true })}
  <link rel="stylesheet" href="/shared/mlma.css">
</head>
<body>
  <div ${attrs.join(' ')}>
    ${noscriptFor(page)}
  </div>
  <script src="/shared/catalog-data.js"></script>
  <script src="/shared/domain.js"></script>
  <script src="/shared/ui.js"></script>
</body>
</html>
`;
}

for (const page of pages) {
  write(path.join(DIST, 'preview', page.file), previewHtml(page));
}

const checklist = `# Сборка страниц Tilda · MLM Academy

Папка проекта: «Академия партнерских сетей и дистрибьюции» → «MLM Academy».
Оболочка опубликована по \`/academy\`. Главную сайта \`/\` не трогать и не
назначать академией.

## Общий порядок блоков на каждой странице

1. Настройки страницы → HTML в HEAD: \`t123/heads/<id>.html\` (уникальные title/description, \`https://\` canonical и og:url, favicon, \`lang=ru\`). Запасной общий файл: \`t123/00-head.html\`
2. Скрыть стандартные header/footer Tilda на этой странице
3. T123: \`01-css.html\`
4. T123: все \`02-data-*.html\` по порядку
5. T123: все \`03-domain-*.html\` по порядку (сейчас ${domainFiles.length})
6. T123: все \`04-ui-*.html\` по порядку (сейчас ${uiFiles.length})
7. T123: \`mounts/<id>.html\` этой страницы
8. Отступы блока = 0

После деплоя search-proxy задайте в HEAD \`window.MLMA_RERANK_URL\` на \`https://<домен>/api/rerank\`. API-ключ в Tilda не класть.

Версионируемые файлы лежат в \`shared/v1/\`. Живые страницы Tilda пока грузят каталог из T123 — так публикация уже проверена. Переход на внешние файлы делать только после отдельной проверки Tilda.

Можно собрать одну страницу-мастер, затем дублировать и менять URL, title и mount.

В редакторе Tilda блоки T123 показывают исходный код. Это нормально: скрипт выполняется
на опубликованной странице, а не на холсте редактора. Публикация \`/academy\` не
заменяет живую главную \`/\`. Оболочка на боевом домене: https://mlmacademy.ru/academy


## Страницы

| Title | URL | Mount | Members |
|---|---|---|---|
${pages.map((page) => `| ${page.title} | \`${page.url}\` | \`mounts/${page.id}.html\` | ${page.members} |`).join('\n')}

- \`public\` — без ограничения Members
- \`member\` — группы Member и Editor
- \`editor\` — только Editor

## Members

Справка: https://help-ru.tilda.cc/membership

1. Настройки сайта → Подключаемые модули → Личный кабинет → Управление модулем.
   Включить модуль. Платежи, корзину и приёмщик «только после оплаты» **не** подключать.
2. Служебные адреса \`/members/login\` и \`/members/signup\` появятся сами. Их не занимать
   адресами академии и не назначать академии \`/\`.
3. Создать (или переименовать) группы: **Guest**, **Member**, **Editor**.
   Guest — без страниц академии: публичные URL остаются открытыми.
4. В группе вкладка «Страницы». Статус «Добавлено в группу» закрывает страницу
   для всех, кто не в этой группе. Ограничение начинает действовать после
   публикации страницы; страницы академии опубликованы, доступ настроен.

| Группа | Страницы в группе |
|---|---|
| Guest | ничего из академии |
| Member | \`/my\`, \`/my/route\`, \`/my/results\`, \`/profile\` |
| FREE / START / FULL / PILOT | те же четыре; после входа главная группы — \`/my\` |
| Editor / ADMIN | те же четыре + \`/preview/catalog\` |

Публичные (не добавлять ни в одну группу): \`/academy\`, \`/start\`, \`/library\`,
\`/library/a1\`…\`/library/a6\`, \`/track\`, \`/about\`, \`/access\`. Живую главную \`/\` и прочие
маркетинговые страницы в группы не добавлять.

Группы доступа: **Guest**, **Member**, **FREE**, **START**, **FULL**, **PILOT**, **ADMIN**, **Editor**.
Не создавать группу на каждый трек. Member и FREE — кабинет после регистрации.
START/FULL выдаются после оплаты (пока тестовый режим). Editor/ADMIN — служебные.
После самостоятельной регистрации пользователь должен попадать в Member или FREE,
не в Editor и не в ADMIN. В интерфейсе Tilda снимите «добавлять после подтверждения»
с Editor, ADMIN, START, FULL, PILOT и Guest.

Профиль оболочки (\`localStorage\` \`mlma.profile.v1\` / \`mlma.account.v1\`) — запасной
контур. Это не серверное сохранение и не логин Tilda.

## SEO

Публичные страницы Академии: \`index, follow\` в HEAD. Кабинет, вход, preview и
\`/track?id=\` — \`noindex, nofollow\`. Индексировать отдельный трек можно только
после отдельной страницы \`/track/<id>\` с полным промоописанием. 112 пустых
страниц в индекс не добавлять.

В настройках сайта Tilda: язык HTML = ru; robots.txt из \`dist/seo/robots.txt\`;
sitemap — HTTPS, без кабинета. Автокарта Tilda сейчас отдаёт \`http://\` — заменить.

## После появления настоящего трека

1. Дублировать страницу \`/track\`
2. Задать URL \`track/a3-002\`
3. Добавить ID в \`config.dedicatedTrackPages\` генератора и пересобрать JSON
`;

write(path.join(DIST, 'TILDA_CHECKLIST.md'), checklist);

const sizes = {
  css: cssBlock.length,
  json: json.length,
  dataChunks: dataChunks.length,
  domain: domainJs.length,
  ui: uiJs.length,
  tracks: tracks.length,
};

write(path.join(DIST, 'sizes.json'), JSON.stringify(sizes, null, 2) + '\n');
write(path.join(__dirname, 'pages.json'), JSON.stringify(pages, null, 2) + '\n');

const publicUrls = pages
  .filter((page) => page.members === 'public' && page.page !== 'track')
  .map((page) => `https://mlmacademy.ru${page.url}`);
publicUrls.push('https://mlmacademy.ru/research/marketing-plan');
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${publicUrls.map((url) => `  <url><loc>${url}</loc></url>`).join('\n')}
</urlset>
`;
const robotsTxt = `User-Agent: *
Allow: /academy
Allow: /library
Allow: /start
Allow: /about
Allow: /access
Allow: /research
Disallow: /my
Disallow: /my/
Disallow: /profile
Disallow: /preview
Disallow: /members/
Disallow: /admin
Disallow: /tilda/
Disallow: /tilda/form*
Disallow: /tilda/rec*
Disallow: /tilda/click*
Disallow: /tilda/scroll*
Disallow: /tilda/popup*
Disallow: /tilda/cart*
Disallow: /tilda/product*
Disallow: /tilda/event*

Sitemap: https://mlmacademy.ru/sitemap.xml
`;
write(path.join(DIST, 'seo/sitemap-academy.xml'), sitemap);
write(path.join(DIST, 'seo/robots.txt'), robotsTxt);

console.log('Tilda dist assembled');
console.log(JSON.stringify(sizes, null, 2));
for (const [label, value] of Object.entries({
  '01-css.html': cssBlock.length,
  'json payload': json.length,
  'domain.js': domainJs.length,
  'ui.js': uiJs.length,
})) {
  if (value > T123_LIMIT && !String(label).includes('json') && !String(label).includes('ui') && !String(label).includes('domain')) {
    console.warn('OVER LIMIT', label, value);
  }
}
