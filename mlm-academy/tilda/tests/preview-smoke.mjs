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
  const leaked = await page.evaluate(() => document.documentElement.innerHTML);
  for (const needle of ['pageStatusRaw', 'Осовременивание', 'adaptationLevel', '"P0"', 'entitlement', 'Войти в кабинет']) {
    if (leaked.includes(needle)) throw new Error('leak: ' + needle);
  }
  const catalogSoon = await page.locator('.mlma-track-card >> text=Скоро').count();
  if (catalogSoon) throw new Error('Скоро on library cards');

  await page.getByRole('button', { name: 'Фильтры' }).click();
  await page.waitForSelector('#mlma-drawer:not([hidden])');

  await page.fill('#mlma-search', 'боюсь написать знакомому');
  await page.waitForTimeout(350);
  const firstTitle = await page.locator('.mlma-track-card h3').first().innerText();
  if (!/первое сообщение/i.test(firstTitle)) throw new Error('search ranking: ' + firstTitle);

  await page.goto(BASE + '/library?stage=a3&q=кому+написать', { waitUntil: 'networkidle' });
  await page.waitForSelector('.mlma-track-card');
  const combo = await page.locator('.mlma-track-card').count();
  if (combo < 1 || combo >= 112) throw new Error('combo count: ' + combo);

  await page.goto(BASE + '/track?id=a3-002', { waitUntil: 'networkidle' });
  await page.waitForSelector('.mlma-blueprint, .mlma-runtime');
  const startBtns = await page.getByRole('link', { name: 'Начать трек' }).count();
  if (startBtns < 1) throw new Error('missing start button');
  await page.getByRole('link', { name: 'Начать трек' }).first().click();
  await page.waitForSelector('#mlma-runtime-form');
  await page.fill('#mlma-artifact', 'готово');
  await page.fill('#mlma-evidence', 'я сделал');
  await page.getByRole('button', { name: 'Сдать результат' }).click();
  await page.waitForSelector('text=Пока нельзя принять');
  await page.getByRole('button', { name: 'Повторить попытку' }).click();
  await page.waitForSelector('#mlma-artifact');
  await page.fill('#mlma-artifact', 'Короткое сообщение знакомой Марине: спросить, удобно ли созвониться в субботу, без обещания дохода.');
  await page.fill('#mlma-evidence', 'Черновик сохранён в заметках и готов к отправке.');
  await page.getByRole('button', { name: 'Сдать результат' }).click();
  await page.waitForSelector('text=Следующее действие');

  await page.getByRole('button', { name: /Сохранить описание/ }).click();
  await page.waitForSelector('text=Убрать описание');

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
