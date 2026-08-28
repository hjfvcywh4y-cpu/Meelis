import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke-тесты гоняются по собранному production-серверу в двух режимах сразу:
 * с включённым предпросмотром и без него. Так проверяется не только вёрстка,
 * но и главное правило — production не показывает неопубликованные треки.
 *
 * Перед запуском нужен `pnpm build`.
 */

const PREVIEW_PORT = 3101;
const PRODUCTION_PORT = 3201;
const START = 'node .next/standalone/server.js';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'preview',
      testMatch: /preview\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${PREVIEW_PORT}` },
    },
    {
      name: 'preview-mobile',
      testMatch: /mobile\.spec\.ts$/,
      use: { ...devices['Pixel 5'], baseURL: `http://127.0.0.1:${PREVIEW_PORT}` },
    },
    {
      name: 'production',
      testMatch: /production\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${PRODUCTION_PORT}` },
    },
  ],
  webServer: [
    {
      command: START,
      url: `http://127.0.0.1:${PREVIEW_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        NODE_ENV: 'production',
        ENABLE_CATALOG_PREVIEW: 'true',
        PORT: String(PREVIEW_PORT),
      },
    },
    {
      command: START,
      url: `http://127.0.0.1:${PRODUCTION_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        NODE_ENV: 'production',
        PORT: String(PRODUCTION_PORT),
      },
    },
  ],
});
