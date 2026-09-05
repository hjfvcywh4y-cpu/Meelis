import { expect, test } from '@playwright/test';

/** Режим предпросмотра: видна вся оболочка и все 112 карточек. */

test('главная показывает шесть входов и обе CTA', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Сделать следующий результат');
  await expect(page.getByText('Режим предпросмотра', { exact: true })).toBeVisible();

  const situations = page.locator('section[aria-labelledby="situations"] li');
  await expect(situations).toHaveCount(6);

  await expect(page.getByRole('link', { name: /Найти следующий шаг/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Открыть библиотеку' }).first()).toBeVisible();
});

test('библиотека загружает 112 карточек и фильтрует поиском', async ({ page }) => {
  await page.goto('/library');

  const counter = page.getByText(/^112 треков$/);
  await expect(counter).toBeVisible();

  await page.getByLabel('Поиск по ситуации и результату').fill('первое сообщение');
  await expect(page.getByText(/^\d+ (трек|трека|треков)$/)).not.toHaveText('112 треков');
  await expect(page.getByRole('heading', { name: 'Написать первое сообщение теплому контакту' })).toBeVisible();

  await page.getByLabel('Поиск по ситуации и результату').fill('такогозапросанет');
  await expect(page.getByText('Ничего не найдено')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'По этому запросу треков нет' })).toBeVisible();
});

test('фильтр по разделу оставляет только его треки', async ({ page }) => {
  await page.goto('/library');
  await page.getByRole('button', { name: 'A5', exact: true }).click();
  await expect(page.getByText(/^14 треков$/)).toBeVisible();
});

test('страница раздела показывает логику, модули и готовящиеся треки', async ({ page }) => {
  await page.goto('/library/a3');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Выйти на контакт');
  await expect(page.getByRole('navigation', { name: 'Хлебные крошки' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Готовятся' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Открытых треков в этом разделе пока нет' }),
  ).toBeVisible();
});

test('оболочка трека честно сообщает об отсутствии содержания', async ({ page }) => {
  await page.goto('/track/a3-002');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Написать первое сообщение');
  await expect(page.getByText('Подходит, если')).toBeVisible();
  await expect(page.getByText('На выходе', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Содержание трека ещё не добавлено' })).toBeVisible();

  // Кнопки «Начать трек» быть не должно, пока внутри нет шагов.
  await expect(page.getByRole('link', { name: 'Начать трек' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Начать трек' })).toHaveCount(0);
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await expect(page.getByText(/0 из \d+/)).toHaveCount(0);

  await expect(page.getByRole('heading', { name: /продолжение/i })).toBeVisible();
});

test('внутренние редакционные данные не попадают в разметку', async ({ page }) => {
  await page.goto('/track/a1-001');
  const html = await page.content();

  for (const forbidden of [
    'Осовременивание',
    'pageStatusRaw',
    'adaptationDecision',
    'Не создана',
    'mlmacademy.ru',
    'sourceCode',
  ]) {
    expect(html).not.toContain(forbidden);
  }
  expect(html).not.toMatch(/\bP[012]\b/);
});

test('быстрый старт приводит в выбранный раздел', async ({ page }) => {
  await page.goto('/start');

  await page.getByRole('button', { name: /как нормально начать/ }).click();
  await expect(page.getByText('Ваш раздел: A3 · Первый контакт')).toBeVisible();

  await page.getByRole('link', { name: 'Показать мой раздел' }).click();
  await expect(page).toHaveURL(/\/library\/a3$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Выйти на контакт');
});

test('выбранная ситуация становится следующим шагом на личной главной', async ({ page }) => {
  await page.goto('/start');
  await page.getByRole('button', { name: /Человек сомневается/ }).click();

  await page.goto('/my');
  const nextActions = page.locator('article').filter({ hasText: 'Следующее действие' });
  await expect(nextActions).toHaveCount(1);
  await expect(nextActions.first()).toContainText('A5');
});

test('маршрут показывает демо-ветку, а не полный граф', async ({ page }) => {
  await page.goto('/my/route');

  await expect(page.getByText('Демонстрация · только предпросмотр')).toBeVisible();
  const demoNodes = page.locator('section[aria-labelledby="demo-branch"] ol > li');
  await expect(demoNodes).toHaveCount(5);
});

test('результаты объясняют, откуда они возьмутся', async ({ page }) => {
  await page.goto('/my/results');
  await expect(page.getByRole('heading', { name: 'Здесь пока нет результатов' })).toBeVisible();
});

test('неизвестный Track ID даёт not-found', async ({ page }) => {
  const response = await page.goto('/track/a9-999');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Такой страницы нет' })).toBeVisible();
});

test('uppercase-адрес редиректит на канонический', async ({ page }) => {
  await page.goto('/track/A3-002');
  await expect(page).toHaveURL(/\/track\/a3-002$/);
});

test('служебная проверка каталога доступна в предпросмотре', async ({ page }) => {
  await page.goto('/admin/catalog');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Здоровье каталога');
  await expect(page.getByText('Валидация пройдена')).toBeVisible();
});

test('навигация с клавиатуры доходит до skip link', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Перейти к содержанию' })).toBeFocused();
});
