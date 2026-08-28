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
const domainJs = fs.readFileSync(path.join(SRC, 'domain.js'), 'utf8');
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

const head = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@700&family=Onest:wght@400;700;800&display=swap" rel="stylesheet">
<style>
  html, body, #allrecords, .t-records, .t-body { background: #f3efe6 !important; }
  body { margin: 0 !important; }
  .t-rec { padding-top: 0 !important; padding-bottom: 0 !important; background: transparent !important; }
  .t-text { font-family: Onest, Arial, Helvetica, sans-serif !important; }
</style>
`;
write(path.join(DIST, 't123/00-head.html'), t123Wrap(head.trim() + '\n', 'HTML для вставки внутрь HEAD этой страницы (Настройки страницы).'));

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

writeScriptChunks(domainJs, '03-domain', 'доменная логика');
writeScriptChunks(uiJs, '04-ui', 'рендер оболочки');

for (const page of pages) {
  const attrs = [
    'class="mlma"',
    `data-mlma-page="${page.page}"`,
  ];
  if (page.section) attrs.push(`data-mlma-section="${page.section}"`);
  const mount = `<div ${attrs.join(' ')}>\n  <noscript><p>Для работы библиотеки нужен JavaScript.</p></noscript>\n</div>\n`;
  write(path.join(DIST, 't123/mounts', `${page.id}.html`), t123Wrap(mount, `Блок T123: монтирование «${page.title}». Members: ${page.members}. URL: ${page.url}`));
}

write(path.join(DIST, 'shared/catalog.json'), JSON.stringify(payload));
write(path.join(DIST, 'shared/catalog-data.js'), 'window.MLMA_PAYLOAD = ' + json + ';\n');
write(path.join(DIST, 'shared/mlma.css'), css);
write(path.join(DIST, 'shared/domain.js'), domainJs);
write(path.join(DIST, 'shared/ui.js'), uiJs);

function previewHtml(page) {
  const attrs = [`class="mlma"`, `data-mlma-page="${page.page}"`];
  if (page.section) attrs.push(`data-mlma-section="${page.section}"`);
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${page.title}</title>
  ${head}
  <link rel="stylesheet" href="/shared/mlma.css">
</head>
<body>
  <div ${attrs.join(' ')}>
    <noscript><p>Для работы библиотеки нужен JavaScript.</p></noscript>
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
Страницы **не публиковать**. Главную сайта \`/\` не трогать.

## Общий порядок блоков на каждой странице

1. Настройки страницы → HTML в HEAD: \`t123/00-head.html\`
2. Скрыть стандартные header/footer Tilda на этой странице
3. T123: \`01-css.html\`
4. T123: все \`02-data-*.html\` по порядку
5. T123: \`03-domain.html\` (и части, если есть)
6. T123: \`04-ui.html\` (и части, если есть)
7. T123: \`mounts/<id>.html\` этой страницы
8. Отступы блока = 0

Можно собрать одну страницу-мастер, затем дублировать и менять URL, title и mount.

В редакторе Tilda блоки T123 показывают исходный код. Это нормально: скрипт выполняется
на опубликованной странице, а не на холсте редактора. Публикация \`/academy\` не
заменяет живую главную \`/\`. Пока страницы не публикуем; локальная проверка —
\`pnpm tilda:serve\`.


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
   публикации страницы; страницы академии пока не публикуем, доступ настраиваем сразу.

| Группа | Страницы в группе |
|---|---|
| Guest | ничего из академии |
| Member | \`/my\`, \`/my/route\`, \`/my/results\`, \`/profile\` |
| Editor | те же четыре + \`/preview/catalog\` |

Публичные (не добавлять ни в одну группу): \`/academy\`, \`/start\`, \`/library\`,
\`/library/a1\`…\`/library/a6\`, \`/track\`, \`/access\`. Живую главную \`/\` и прочие
маркетинговые страницы в группы не добавлять.

После включения модуля проверить \`mlmacademy.ru\`: если на живой главной появилась
иконка профиля, не править общесайтовый HEAD и не публиковать \`/\`. Сообщить
и искать настройку видимости иконки в Личном кабинете.

Профиль оболочки (\`localStorage\` \`mlma.profile.v1\`) — это не логин Tilda.

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
