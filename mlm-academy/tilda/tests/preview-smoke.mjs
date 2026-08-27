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

  await page.goto(BASE + '/library', { waitUntil: 'networkidle' });
  await page.waitForSelector('.mlma-track-card');
  const cards = await page.locator('.mlma-track-card').count();
  if (cards !== 112) throw new Error('library cards: ' + cards);
  const leaked = await page.evaluate(() => document.documentElement.innerHTML);
  for (const needle of ['pageStatusRaw', 'Осовременивание', 'adaptationLevel', '"P0"']) {
    if (leaked.includes(needle)) throw new Error('leak: ' + needle);
  }

  await page.fill('#mlma-search', 'первое сообщение');
  await page.waitForTimeout(50);
  const filtered = await page.locator('.mlma-track-card').count();
  if (filtered < 1 || filtered >= 112) throw new Error('search count: ' + filtered);

  await page.goto(BASE + '/track?id=a3-002', { waitUntil: 'networkidle' });
  await page.waitForSelector('.mlma-blueprint');
  const startBtns = await page.getByRole('link', { name: 'Начать трек' }).count();
  if (startBtns !== 0) throw new Error('unexpected start button');
  const blueprint = await page.locator('.mlma-blueprint').innerText();
  if (!blueprint.includes('Содержание трека ещё не добавлено')) throw new Error('missing blueprint');

  await page.getByRole('button', { name: 'Сохранить в мой маршрут' }).click();
  await page.waitForSelector('text=Убрать из моего маршрута');

  await page.goto(BASE + '/start', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Я знаю, кому написать/ }).click();
  await page.waitForSelector('text=Ваш раздел: A3');

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
    searchHits: filtered,
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
