import { expect, test } from '@playwright/test';

/** Production без флага предпросмотра: неопубликованного каталога не существует. */

test('баннера предпросмотра нет', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Режим предпросмотра')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Сделать следующий результат');
});

test('библиотека показывает только опубликованный пилот и скрывает остальные', async ({ page }) => {
  await page.goto('/library');

  await expect(page.getByRole('heading', { name: 'Открытых треков пока нет' })).toHaveCount(0);
  await expect(page.getByText(/^1 трек$/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Выбрать пять людей для следующего действия' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Написать первое сообщение теплому контакту' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'A1', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'A6', exact: true })).toBeVisible();
});

test('раздел не показывает готовящиеся треки', async ({ page }) => {
  await page.goto('/library/a3');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Выйти на контакт');
  await expect(
    page.getByRole('heading', { name: 'Открытых треков в этом разделе пока нет' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Готовятся' })).toHaveCount(0);
});

test('прямая ссылка на неопубликованный трек даёт not-found без утечки данных', async ({
  page,
}) => {
  const response = await page.goto('/track/a3-002');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Такой страницы нет' })).toBeVisible();

  const html = await page.content();
  expect(html).not.toContain('Написать первое сообщение');
  expect(html).not.toContain('Осовременивание');
});

test('служебный экран каталога недоступен', async ({ page }) => {
  const response = await page.goto('/admin/catalog');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Здоровье каталога' })).toHaveCount(0);
});

test('неизвестный раздел даёт not-found', async ({ page }) => {
  const response = await page.goto('/library/a7');
  expect(response?.status()).toBe(404);
});

test('личный контур работает и предлагает начать с ситуации', async ({ page }) => {
  await page.goto('/my');
  const nextActions = page.locator('article').filter({ hasText: 'Следующее действие' });
  await expect(nextActions).toHaveCount(1);
  await expect(nextActions.first()).toContainText('Выберите ситуацию');
});

test('страница доступа не обещает оплату', async ({ page }) => {
  await page.goto('/access');
  await expect(page.getByRole('heading', { name: 'Вход и оплата пока не подключены' })).toBeVisible();
  await expect(page.getByRole('button', { name: /оплатить/i })).toHaveCount(0);
});
