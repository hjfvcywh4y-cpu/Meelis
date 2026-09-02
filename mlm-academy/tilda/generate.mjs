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
require('./src/legal.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(__dirname, 'src');
const DIST = path.join(__dirname, 'dist');
const T123_LIMIT = 45000;
const ASSETS_VERSION = 'v1';
const PUBLIC_CACHE_VERSION = '0.3';
const ASSET_BASE_LIVE = 'https://mlma-account.mlmacademy-search.workers.dev';
const CATALOG_SCHEMA = 'mlma.catalog.public.v1';
const EXPECTED_SECTION_COUNTS = { A1: 16, A2: 16, A3: 17, A4: 17, A5: 14, A6: 32 };
const PILOT_EXECUTABLE = {
  'A2-008': { ps: 'published', cs: 'complete' },
};

const FORBIDDEN = [
  'adaptationDecision',
  'originalTitle',
  'sourceCode',
  'pageStatusRaw',
  'internalNote',
  'transformationType',
  'adaptationLevel',
  'legacyPublicUrl',
  'PILOT_DRAFT_TO_TEST',
  'legacyArchive',
  'MLMA_SERVER_ONLY_A3_002_FIXTURE',
  'Первое сообщение без рекламной простыни',
  'LOCKED_NEXT_ACTION_SLOT',
  'effectiveTrackConnections',
  'connectionIndex',
  'matchedRouteRuleIds',
  'Не создана',
  'Осовременивание',
  'mlmacademy.ru/track',
];

const catalogFile = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/tracks.catalog.json'), 'utf8'));
const sectionsFile = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/sections.json'), 'utf8'));
const rulesFile = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/recommendation.rules.json'), 'utf8'));
const pilotFile = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/pilot.graph.json'), 'utf8'));
const productsFile = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/data/products.catalog.json'), 'utf8'));

const tracks = catalogFile.tracks
  .slice()
  .sort((a, b) => a.order - b.order)
  .map((track) => MLMA.compactTrack(track))
  .filter(Boolean);

if (tracks.length !== 112) {
  throw new Error('Ожидалось 112 публичных треков, получено ' + tracks.length);
}
const uniqueIds = new Set(tracks.map((row) => row.id));
if (uniqueIds.size !== 112) {
  throw new Error('Каталог должен содержать 112 уникальных Track ID, получено ' + uniqueIds.size);
}
const sectionCounts = { A1: 0, A2: 0, A3: 0, A4: 0, A5: 0, A6: 0 };
for (const row of tracks) {
  if (sectionCounts[row.s] == null) throw new Error('Неизвестный раздел ' + row.s);
  sectionCounts[row.s] += 1;
  const pilot = PILOT_EXECUTABLE[row.id];
  if (pilot) {
    if (row.ps !== pilot.ps) throw new Error('Пилотный трек ' + row.id + ' должен быть ' + pilot.ps + ', сейчас ' + row.ps);
    if (row.cs !== pilot.cs) throw new Error('Пилотный трек ' + row.id + ' должен быть ' + pilot.cs + ', сейчас ' + row.cs);
    continue;
  }
  if (row.ps !== 'planned') throw new Error('Трек ' + row.id + ' должен быть planned, сейчас ' + row.ps);
  if (row.cs !== 'metadata_only') throw new Error('Трек ' + row.id + ' должен быть metadata_only, сейчас ' + row.cs);
}
for (const [sectionId, expected] of Object.entries(EXPECTED_SECTION_COUNTS)) {
  if (sectionCounts[sectionId] !== expected) {
    throw new Error('Раздел ' + sectionId + ': ' + sectionCounts[sectionId] + ' вместо ' + expected);
  }
}

const payload = {
  schema: CATALOG_SCHEMA,
  assetsVersion: ASSETS_VERSION,
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
  products: {
    schema: productsFile.schema,
    price_list_version: productsFile.price_list_version,
    flags: productsFile.flags,
    legal: productsFile.legal,
    products: productsFile.products,
  },
};

const requiredProductCodes = [
  'B2C-FREE-001',
  'B2C-TRACK-001',
  'B2C-PACK3-001',
  'B2C-ROUTE6-001',
  'B2C-LIB-M-001',
  'B2C-LIB-Y-001',
  'B2C-PRO-M-001',
  'B2B-PILOT30-001',
  'B2B-TEAM20-M-001',
];
const productCodes = new Set(productsFile.products.map((row) => row.product_code));
if (productCodes.size !== requiredProductCodes.length) {
  throw new Error('Ожидалось ' + requiredProductCodes.length + ' продуктов, получено ' + productCodes.size);
}
for (const code of requiredProductCodes) {
  if (!productCodes.has(code)) throw new Error('Нет продукта ' + code);
}

const legalGate = typeof MLMA.assertLegalPublishReady === 'function' ? MLMA.assertLegalPublishReady() : { ok: false, reason: 'legal_module_missing' };
if (!legalGate.ok) {
  throw new Error('Юридическая публикация заблокирована: ' + legalGate.reason);
}
for (const row of productsFile.products) {
  if (row.publication_status === 'active') {
    throw new Error('Продукт ' + row.product_code + ' не должен быть active до gate');
  }
  if (row.checkout_eligible) {
    throw new Error('Продукт ' + row.product_code + ' не должен быть checkout_eligible');
  }
}

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
const commerceJs = fs.readFileSync(path.join(SRC, 'commerce.js'), 'utf8');
const legalJs = fs.readFileSync(path.join(SRC, 'legal.js'), 'utf8');
const searchJs = fs.readFileSync(path.join(SRC, 'search.js'), 'utf8');
const analyticsJs = fs.readFileSync(path.join(SRC, 'analytics.js'), 'utf8');
const ontologyJs = fs.readFileSync(path.join(SRC, 'ontology.js'), 'utf8');
const packageRuntimeJs = fs.readFileSync(path.join(SRC, 'package-runtime.js'), 'utf8');
const SPLIT = '\n\n/* __MLMA_UI_SPLIT__ */\n\n';
const domainJs = [domainCore.trim(), accessJs.trim(), storageJs.trim(), paymentsJs.trim(), commerceJs.trim(), legalJs.trim(), searchJs.trim(), analyticsJs.trim(), packageRuntimeJs.trim()].join(SPLIT) + '\n\n' + ontologyJs.trim();
const uiJs = fs.readFileSync(path.join(SRC, 'ui.js'), 'utf8');
const publicBundle = domainJs + uiJs + css;
const oldSeller = ['Бор' + 'исенко', 'Бале' + 'шенко', '532000' + '135580', '1071@savv' + '.tech'];
for (const needle of oldSeller) {
  if (publicBundle.includes(needle)) {
    throw new Error('В публичной сборке Academy найден прежний продавец');
  }
}
if (/\b\d{20}\b/.test(legalJs) || /БИК\s*\d{9}/.test(legalJs)) {
  throw new Error('В публичных юридических текстах найдены банковские реквизиты');
}
for (const phrase of ['возвра' + 'тов нет', 'полностью оказана ' + 'в момент', 'плата за активацию ' + 'не возвращается']) {
  if (legalJs.includes(phrase)) {
    throw new Error('Запрещённая формулировка в оферте: ' + phrase);
  }
}

function listTrackModuleFiles() {
  const dir = path.join(SRC, 'tracks');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name.endsWith('.module.js')).sort();
}

function moduleCacheBust(fileName) {
  const source = fs.readFileSync(path.join(SRC, 'tracks', fileName), 'utf8');
  const match = source.match(/var VERSION = '([^']+)'/);
  return match ? match[1] : catalogFile.version;
}

const trackModuleFiles = listTrackModuleFiles();
function isLiveTrackModule(fileName) {
  const id = fileName.replace(/\.module\.js$/i, '').toUpperCase();
  return Object.prototype.hasOwnProperty.call(PILOT_EXECUTABLE, id);
}
const liveTrackModuleFiles = trackModuleFiles.filter(isLiveTrackModule);
const trackModuleScriptTags = (base, files = liveTrackModuleFiles) =>
  files
    .map((name) => `<script src="${base}/${ASSETS_VERSION}/tracks/${name}?v=${moduleCacheBust(name)}"></script>`)
    .join('\n');

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
  { id: 'pricing', file: 'pricing.html', url: '/pricing', page: 'pricing', title: 'Тарифы · MLM Academy', members: 'public' },
  { id: 'payment-and-access', file: 'payment-and-access.html', url: '/payment-and-access', page: 'payment-and-access', title: 'Оплата, доступ и возврат — MLM Academy', members: 'public' },
  { id: 'privacy', file: 'privacy.html', url: '/privacy', page: 'privacy', title: 'Политика обработки персональных данных — MLM Academy', members: 'public' },
  { id: 'consent', file: 'consent.html', url: '/consent', page: 'consent', title: 'Согласие на обработку персональных данных — MLM Academy', members: 'public' },
  { id: 'offer', file: 'offer.html', url: '/offer', page: 'offer', title: 'Публичная оферта — MLM Academy', members: 'public' },
  { id: 'requisites', file: 'requisites.html', url: '/requisites', page: 'requisites', title: 'Реквизиты исполнителя — MLM Academy', members: 'public' },
  { id: 'documents', file: 'documents.html', url: '/documents', page: 'documents', title: 'Документы — MLM Academy', members: 'public' },
  { id: 'cookies', file: 'cookies.html', url: '/cookies', page: 'cookies', title: 'Cookies и локальное хранилище — MLM Academy', members: 'public' },
  { id: 'marketing-consent', file: 'marketing-consent.html', url: '/marketing-consent', page: 'marketing-consent', title: 'Согласие на получение информационных и рекламных сообщений — MLM Academy', members: 'public' },
  { id: 'purchases', file: 'my-purchases.html', url: '/my/purchases', page: 'purchases', title: 'Покупки и доступ · MLM Academy', members: 'member' },
  { id: 'preview', file: 'preview-catalog.html', url: '/preview/catalog', page: 'preview', title: 'Предпросмотр каталога · MLM Academy', members: 'editor' },
  { id: 'preview-commerce', file: 'preview-commerce.html', url: '/preview/commerce', page: 'preview-commerce', title: 'Предпросмотр состояний покупки · MLM Academy', members: 'editor', noindex: true },
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
    <p>Трек — маршрут от ситуации к действию. Материал можно открыть. Трек нужно выполнить и оставить проверяемый след.</p>
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
  if (page.page === 'documents') {
    const docs = typeof MLMA.publicDocuments === 'function' ? MLMA.publicDocuments() : [];
    const list = docs
      .map((doc) => `<li><a href="${escapeHtml(doc.path)}">${escapeHtml(doc.title)}</a></li>`)
      .join('\n      ');
    return `<noscript>
  <div class="mlma-noscript">
    <h1>Центр документов MLM Academy</h1>
    <p>Отдельные публичные страницы. Тексты не объединены.</p>
    <ul>
      ${list}
    </ul>
    ${back}
  </div>
</noscript>`;
  }
  if (page.page === 'requisites') {
    const op = MLMA.LEGAL_OPERATOR || {};
    return `<noscript>
  <div class="mlma-noscript">
    <h1>Реквизиты исполнителя</h1>
    <p>Исполнитель: ${escapeHtml(op.fullName || op.name || '')}</p>
    <p>Статус: ${escapeHtml(op.legalStatus || '')}</p>
    <p>ИНН: ${escapeHtml(op.inn || '')}</p>
    <p>Email: <a href="mailto:${escapeHtml(op.email || '')}">${escapeHtml(op.email || '')}</a></p>
    <p>Телефон: <a href="tel:${escapeHtml(op.phoneE164 || '')}">${escapeHtml(op.phone || '')}</a></p>
    <p>Сайт: <a href="${escapeHtml(op.site || 'https://mlmacademy.ru')}">${escapeHtml(op.site || 'https://mlmacademy.ru')}</a></p>
    <p>Публичная ссылка для ЮKassa: https://mlmacademy.ru/requisites</p>
    <p><a href="/documents">Все документы</a></p>
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
const RERANK_PUBLIC_URL = process.env.MLMA_RERANK_PUBLIC_URL || 'https://mlma-search.mlmacademy-search.workers.dev/api/rerank';
const ACCOUNT_PUBLIC_URL = process.env.MLMA_API_PUBLIC_URL || 'https://mlma-account.mlmacademy-search.workers.dev/api';

function robotsForPage(page) {
  if (page.noindex) return 'noindex, nofollow';
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
    library: 'Каталог треков и материалов по этапам A1–A6. Поиск понимает живой запрос.',
    about: 'Как устроена MLM Academy: рабочая система от ситуации к действию и следующему шагу.',
    track: 'Карточка трека: ситуация, действие, рабочий след и следующее лучшее действие.',
    access: 'FREE, будущие разовые покупки, командный и корпоративный формат. Платные продукты готовятся, кнопки покупки нет.',
    pricing: 'Тарифы MLM Academy: демо, один трек от 590 ₽, мини-маршрут от 1 490 ₽, маршрут из шести от 2 990 ₽. Оплатить пока нельзя.',
    'payment-and-access': 'Как оплачиваются продукты MLM Academy, когда открывается доступ и как обратиться за возвратом. Сейчас эквайринг не подключён.',
    privacy: 'Как MLM Academy собирает, использует, хранит и защищает персональные данные.',
    consent: 'Отдельное согласие на обработку персональных данных при регистрации кабинета MLM Academy.',
    offer: 'Условия оказания дистанционных информационно-консультационных услуг MLM Academy.',
    requisites: 'Сведения об исполнителе и контакты MLM Academy.',
    documents: 'Центр публичных документов MLM Academy: реквизиты, оферта, политика, согласия, cookies, оплата и возврат.',
    cookies: 'Какие cookies и ключи браузера использует MLM Academy для входа, сессии и маршрута.',
    'marketing-consent': 'Необязательное согласие на новости и специальные предложения MLM Academy.',
    purchases: 'Покупки и доступ кабинета. Страница не индексируется.',
    'preview-commerce': 'Служебный предпросмотр состояний покупки. Не публиковать.',
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
  const accountUrl = opts.preview ? '/api' : ACCOUNT_PUBLIC_URL;
  const accountScript = accountUrl
    ? `<script>window.MLMA_API_URL = ${JSON.stringify(accountUrl)};window.MLMA_ASSETS_VERSION = ${JSON.stringify(ASSETS_VERSION)};</script>`
    : '<!-- window.MLMA_API_URL задаётся после деплоя account-proxy. Секреты в Tilda не класть. -->';
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
${accountScript}
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
const membersCss = fs.readFileSync(path.join(SRC, 'members-bridge.css'), 'utf8');
write(path.join(DIST, 't123/members-bridge.css'), membersCss);
write(path.join(DIST, 'shared/members-bridge.css'), membersCss);
const membersJs = fs.readFileSync(path.join(SRC, 'members-bridge.js'), 'utf8');
function readSignupFlag(source, file) {
  const match = source.match(/var SIGNUP_ENABLED = (true|false);/);
  if (!match) throw new Error('Нет var SIGNUP_ENABLED в ' + file);
  return match[1];
}
if (readSignupFlag(commerceJs, 'commerce.js') !== readSignupFlag(membersJs, 'members-bridge.js')) {
  throw new Error('SIGNUP_ENABLED в commerce.js и members-bridge.js должен совпадать');
}
write(path.join(DIST, 't123/members-bridge.js'), membersJs);
write(path.join(DIST, 'shared/members-bridge.js'), membersJs);
const membersLoader =
  '<!-- Загрузить актуальный members-bridge с Worker. Вставлять в Members extra JS один раз. -->\n' +
  '<script src="' +
  ASSET_BASE_LIVE +
  '/members-bridge.js"></script>\n';
write(path.join(DIST, 't123/members-bridge-loader.html'), t123Wrap(membersLoader, 'Members extra JS: актуальный bridge с Worker'));

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
const trackFiles = [];
if (liveTrackModuleFiles.length) {
  const inner =
    liveTrackModuleFiles
      .map(function (name) {
        return (
          '<script src="' +
          ASSET_BASE_LIVE +
          '/' +
          ASSETS_VERSION +
          '/tracks/' +
          name +
          '?v=' +
          encodeURIComponent(moduleCacheBust(name)) +
          '"></script>'
        );
      })
      .join('\n') + '\n';
  write(
    path.join(DIST, 't123', '03b-tracks.html'),
    t123Wrap(inner, 'Блок T123: модули треков. Script src, без инлайна IIFE.'),
  );
  trackFiles.push('03b-tracks.html');
}
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
write(path.join(v1, 'catalog.schema.json'), fs.readFileSync(path.join(ROOT, 'src/data/catalog.schema.json'), 'utf8'));
const logoJpg = path.join(SRC, 'assets/mlma-logo.jpg');
if (!fs.existsSync(logoJpg)) throw new Error('Нет исходного логотипа tilda/src/assets/mlma-logo.jpg');
fs.copyFileSync(logoJpg, path.join(DIST, 'shared/mlma-logo.jpg'));
fs.copyFileSync(logoJpg, path.join(v1, 'mlma-logo.jpg'));
function copyAssetDir(fromName) {
  const from = path.join(SRC, 'assets', fromName);
  if (!fs.existsSync(from)) return;
  for (const dest of [path.join(DIST, 'shared', fromName), path.join(v1, fromName)]) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(from)) {
      fs.copyFileSync(path.join(from, name), path.join(dest, name));
    }
  }
}
copyAssetDir('visual');
copyAssetDir('icons');
write(path.join(DIST, 'shared/catalog.schema.json'), fs.readFileSync(path.join(ROOT, 'src/data/catalog.schema.json'), 'utf8'));
write(path.join(v1, 'products.catalog.json'), JSON.stringify(productsFile, null, 2) + '\n');
write(path.join(DIST, 'shared/products.catalog.json'), JSON.stringify(productsFile, null, 2) + '\n');
write(path.join(v1, 'members-bridge.js'), membersJs);
write(path.join(v1, 'members-bridge.css'), membersCss);
for (const name of trackModuleFiles) {
  const contents = fs.readFileSync(path.join(SRC, 'tracks', name), 'utf8');
  write(path.join(DIST, 'shared/tracks', name), contents);
  write(path.join(v1, 'tracks', name), contents);
}
const passportFiles = fs.existsSync(path.join(SRC, 'tracks'))
  ? fs.readdirSync(path.join(SRC, 'tracks')).filter((name) => name.endsWith('.passport.json')).sort()
  : [];
for (const name of passportFiles) {
  const contents = fs.readFileSync(path.join(SRC, 'tracks', name), 'utf8');
  write(path.join(DIST, 'shared/tracks', name), contents);
  write(path.join(v1, 'tracks', name), contents);
}

function previewHtml(page) {
  const attrs = [`class="mlma"`, `data-mlma-page="${page.page}"`];
  if (page.section) attrs.push(`data-mlma-section="${page.section}"`);
  const bust = encodeURIComponent(ASSETS_VERSION + '-' + catalogFile.version);
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${page.title}</title>
  ${seoHead(page, { preview: true })}
  <link rel="stylesheet" href="/shared/${ASSETS_VERSION}/mlma.css?v=${bust}">
</head>
<body>
  <div ${attrs.join(' ')}>
    ${noscriptFor(page)}
  </div>
  <script src="/shared/${ASSETS_VERSION}/catalog-data.js?v=${bust}"></script>
  <script src="/shared/${ASSETS_VERSION}/domain.js?v=${bust}"></script>
${trackModuleFiles
    .map((name) => `  <script src="/shared/${ASSETS_VERSION}/tracks/${name}?v=${bust}-${moduleCacheBust(name)}"></script>`)
    .join('\n')}
  <script src="/shared/${ASSETS_VERSION}/ui.js?v=${bust}"></script>
</body>
</html>
`;
}

for (const page of pages) {
  write(path.join(DIST, 'preview', page.file), previewHtml(page));
}

const loader = `<!-- Внешние assets ${ASSETS_VERSION}. Не публиковать все страницы сразу.
Rollback: вернуть блоки T123 01-css, 02-data-*, 03-domain-*, 03b-tracks-*, 04-ui-*.
Замените ASSET_BASE на URL файлов. Секреты сюда не класть. -->
<link rel="stylesheet" href="ASSET_BASE/${ASSETS_VERSION}/mlma.css?v=${PUBLIC_CACHE_VERSION}">
<script src="ASSET_BASE/${ASSETS_VERSION}/catalog-data.js?v=${PUBLIC_CACHE_VERSION}"></script>
<script src="ASSET_BASE/${ASSETS_VERSION}/domain.js?v=${PUBLIC_CACHE_VERSION}"></script>
${trackModuleScriptTags('ASSET_BASE')}
<script src="ASSET_BASE/${ASSETS_VERSION}/ui.js?v=${PUBLIC_CACHE_VERSION}"></script>
`;
write(path.join(DIST, 't123/external-loader-v1.html'), t123Wrap(loader, `Внешний loader assets ${ASSETS_VERSION}. Сначала одна тестовая страница.`));
write(
  path.join(DIST, 't123/external-loader-v1.live.html'),
  t123Wrap(loader.replace(/ASSET_BASE/g, ASSET_BASE_LIVE), `Живой loader ${ASSETS_VERSION}. ASSET_BASE=${ASSET_BASE_LIVE}`),
);

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
6. T123: все \`03b-tracks-*.html\` по порядку, если есть исполняемые модули (сейчас ${trackFiles.length})
7. T123: все \`04-ui-*.html\` по порядку (сейчас ${uiFiles.length})
8. T123: \`mounts/<id>.html\` этой страницы
9. Отступы блока = 0

После деплоя search-proxy задайте в HEAD \`window.MLMA_RERANK_URL\` на \`https://<домен>/api/rerank\`. API-ключ в Tilda не класть.

Версионируемые файлы лежат в \`shared/${ASSETS_VERSION}/\`. Живые страницы Tilda пока
остаются на проверенных блоках T123. Не переключать все 18+ страниц сразу.

Порядок внешнего переключения:

1. Локальный preview (\`pnpm tilda:serve\`)
2. Одна тестовая страница Tilda: вместо блоков 01–04 вставить \`t123/external-loader-v1.html\`,
   заменив \`ASSET_BASE\` на URL файлов. Mount и HEAD оставить.
3. Проверить каталог 112, поиск только по кнопке/Enter, кабинет, rollback.
4. Группами публиковать остальные страницы той же версии.
5. Rollback: вернуть предыдущие T123 01-css / 02-data / 03-domain / 04-ui
   или сменить \`v1\` на предыдущую папку assets.

Нельзя оставлять часть страниц на несовместимой версии каталога.

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
| Member | \`/my\`, \`/my/route\`, \`/my/results\`, \`/my/purchases\`, \`/profile\` |
| FREE / START / FULL / PILOT | те же четыре + \`/my/purchases\`; после входа главная группы — \`/my\` |
| Editor / ADMIN | те же кабинетные + \`/preview/catalog\` + \`/preview/commerce\` (commerce не публиковать на боевом сайте) |

Публичные (не добавлять ни в одну группу): \`/academy\`, \`/start\`, \`/library\`,
\`/library/a1\`…\`/library/a6\`, \`/track\`, \`/about\`, \`/access\`, \`/pricing\`, \`/payment-and-access\`,
\`/privacy\`, \`/consent\`, \`/offer\`, \`/requisites\`, \`/documents\`, \`/cookies\`, \`/marketing-consent\`.
\`/preview/commerce\` не публиковать. Живую главную \`/\` и прочие
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

const sizesPath = path.join(DIST, 'sizes.json');
let previousSizes = null;
if (fs.existsSync(sizesPath)) {
  try { previousSizes = JSON.parse(fs.readFileSync(sizesPath, 'utf8')); } catch (err) { previousSizes = null; }
}
const sizes = {
  assetsVersion: ASSETS_VERSION,
  schema: CATALOG_SCHEMA,
  css: cssBlock.length,
  json: json.length,
  dataChunks: dataChunks.length,
  domain: domainJs.length,
  ui: uiJs.length,
  trackModules: trackModuleFiles.slice(),
  tracks: tracks.length,
  uniqueTrackIds: uniqueIds.size,
  sectionCounts,
  previous: previousSizes,
};

write(path.join(DIST, 'sizes.json'), JSON.stringify(sizes, null, 2) + '\n');
write(path.join(__dirname, 'pages.json'), JSON.stringify(pages, null, 2) + '\n');

const publicUrls = pages
  .filter((page) => page.members === 'public' && page.page !== 'track' && !page.noindex)
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
Allow: /pricing
Allow: /payment-and-access
Allow: /privacy
Allow: /consent
Allow: /offer
Allow: /requisites
Allow: /documents
Allow: /cookies
Allow: /marketing-consent
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
