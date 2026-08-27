import { expect, test } from '@playwright/test';

/** Мобильная проверка: нижняя навигация, отсутствие горизонтального overflow. */

const PAGES = ['/', '/start', '/library', '/library/a3', '/track/a3-002', '/my', '/my/route'];

test('нижняя навигация участника из пяти пунктов', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Мобильная навигация' });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('link')).toHaveCount(5);
});

test('нет горизонтального переполнения на ключевых экранах', async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `горизонтальный overflow на ${path}`).toBeLessThanOrEqual(1);
  }
});

test('переход по нижней навигации работает', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Мобильная навигация' })
    .getByRole('link', { name: 'Библиотека' })
    .click();
  await expect(page).toHaveURL(/\/library$/);
});
