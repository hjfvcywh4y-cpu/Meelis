import { chromium } from '@playwright/test';

const BASE = process.env.MLMA_TILDA_URL || 'http://127.0.0.1:4173';

async function main() {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto(BASE + '/academy', { waitUntil: 'networkidle' });
  await page.waitForSelector('.mlma-display');
  const homeTitle = await page.locator('h1').first().innerText();
  const sectionCards = await page.locator('.mlma-section-card').count();
  if (sectionCards !== 6) throw new Error('home sections: ' + sectionCards);
  const findBtn = page.locator('form.mlma-search button[type="submit"]').first();
  const findText = (await findBtn.innerText()).trim();
  if (!findText) throw new Error('home search button has no visible text');
  const soon = await page.locator('text=Скоро').count();
  if (soon) throw new Error('unexpected Скоро on home');

  await page.goto(BASE + '/library', { waitUntil: 'networkidle' });
  await page.waitForSelector('.mlma-track-card');
  const cards = await page.locator('.mlma-track-card').count();
  if (cards < 12 || cards > 18) throw new Error('library first page cards: ' + cards);
  const leaked = await page.evaluate(() => (document.querySelector('.mlma') || document.body).innerText);
  for (const needle of ['pageStatusRaw', 'Осовременивание', 'adaptationLevel', '"P0"', 'metadata_only', 'Войти в кабинет']) {
    if (leaked.includes(needle)) throw new Error('leak: ' + needle);
  }
  const catalogSoon = await page.locator('.mlma-track-card >> text=Скоро').count();
  if (catalogSoon) throw new Error('Скоро on library cards');

  await page.getByRole('button', { name: 'Фильтры' }).click();
  await page.waitForSelector('#mlma-drawer:not([hidden])');
  await page.locator('#mlma-drawer [data-mlma-drawer-close]').first().click();
  await page.waitForFunction(() => document.querySelector('#mlma-drawer')?.hidden === true);

  await page.fill('#mlma-search', 'боюсь написать знакомому');
  await page.waitForTimeout(400);
  const stillDefault = await page.locator('.mlma-track-card').count();
  if (stillDefault < 12 || stillDefault > 18) {
    throw new Error('typing must not search until submit: ' + stillDefault);
  }
  await page.locator('#mlma-lib-form button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelectorAll('.mlma-track-card').length <= 8);
  const firstTitle = await page.locator('.mlma-track-card h3').first().innerText();
  if (!/первое сообщение/i.test(firstTitle)) throw new Error('search ranking: ' + firstTitle);
  const covers = await page.locator('.mlma-track-cover').count();
  if (covers < 1) throw new Error('search cards missing covers');
  const whyText = await page.locator('.mlma-why').first().innerText();
  if (/Буквальное совпадение|алиас|score=/i.test(whyText)) throw new Error('leaked ranking: ' + whyText);
  if (!/Подходит/i.test(whyText)) throw new Error('missing human why');
  const searchCards = await page.locator('.mlma-track-card').count();
  if (searchCards > 8) throw new Error('too many weak matches: ' + searchCards);

  await page.fill('#mlma-search', 'Хочу открыть новый город');
  await page.waitForTimeout(400);
  const stillOldSearch = await page.locator('.mlma-track-card h3').first().innerText();
  if (!/первое сообщение/i.test(stillOldSearch)) {
    throw new Error('typing over previous query must wait for submit: ' + stillOldSearch);
  }
  await page.locator('#mlma-lib-form button[type="submit"]').click();
  await page.waitForFunction(() => /города пока нет|регион пока нет/i.test(document.querySelector('#mlma-results')?.innerText || ''));
  const cityTitle = await page.locator('#mlma-results').innerText();
  if (/Точного трека пока нет/i.test(cityTitle)) throw new Error('city should show adjacent tracks: ' + cityTitle.slice(0, 240));
  if (!/города пока нет|регион пока нет/i.test(cityTitle)) throw new Error('city missing honesty: ' + cityTitle.slice(0, 240));
  const cityCards = await page.locator('#mlma-results .mlma-track-card').count();
  if (cityCards < 1) throw new Error('city adjacent without cards');

  const html = await page.content();
  if (/OPENAI_API_KEY|sk-[A-Za-z0-9]{10,}/.test(html)) throw new Error('api key leaked into page');
  const lang = await page.evaluate(() => document.documentElement.lang);
  if (lang !== 'ru') throw new Error('html lang: ' + lang);
  const canon = await page.evaluate(() => document.querySelector('link[rel="canonical"]')?.getAttribute('href') || '');
  if (!canon.startsWith('http://127.0.0.1') && !canon.startsWith('https://')) throw new Error('canonical: ' + canon);

  await page.goto(BASE + '/library?stage=a3&q=кому+написать', { waitUntil: 'networkidle' });
  await page.waitForSelector('.mlma-track-card');
  const combo = await page.locator('.mlma-track-card').count();
  if (combo < 1 || combo >= 112) throw new Error('combo count: ' + combo);

  await page.goto(BASE + '/track?id=a3-002', { waitUntil: 'networkidle' });
  await page.waitForSelector('.mlma-blueprint, .mlma-runtime, .mlma-track-card, #mlma-main');
  const startBtns = await page.getByRole('link', { name: 'Начать трек' }).count();
  if (startBtns) throw new Error('unfilled track must not show Начать трек');
  const contour = await page.locator('.mlma-blueprint').count();
  const contourText = await page.locator('body').innerText();
  if (!contour && !/Контур прохождения/.test(contourText)) {
    throw new Error('expected contour copy for unfilled track');
  }
  await page.getByRole('link', { name: /Войти, чтобы сохранить/ }).waitFor();
  const saveGuest = await page.getByRole('link', { name: /Войти, чтобы сохранить/ }).count();
  if (!saveGuest) throw new Error('guest must be asked to log in to save');

  await page.goto(BASE + '/start', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /написать/i }).first().click();
  await page.waitForSelector('text=Начните с этого');

  await page.goto(BASE + '/about', { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Как создаётся');

  await page.goto(BASE + '/access', { waitUntil: 'networkidle' });
  const accessHtml = await page.locator('#mlma-main').innerText();
  if (/entitlement|organization|тариф не выбран/i.test(accessHtml)) throw new Error('access jargon');

  await page.goto(BASE + '/my', { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Следующее действие');
  const nextCount = await page.locator('article.mlma-lime h2').count();
  if (nextCount !== 1) throw new Error('next action cards: ' + nextCount);

  const mobile = await browser.newPage({ viewport: { width: 360, height: 740 } });
  await mobile.goto(BASE + '/academy', { waitUntil: 'networkidle' });
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 2) throw new Error('horizontal overflow: ' + overflow);

  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
  console.log(JSON.stringify({
    homeTitle,
    sectionCards,
    libraryCards: cards,
    firstSearchTitle: firstTitle,
    startButtonsOnTrack: startBtns,
    nextActionCards: nextCount,
    mobileOverflow: overflow,
    ok: true,
  }, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
