import { cp, mkdir, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Next в режиме standalone не копирует статику и public автоматически.
 * Скрипт делает сборку самодостаточной: `node .next/standalone/server.js`
 * работает одинаково локально, в Docker и на площадке развёртывания.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const standalone = resolve(root, '.next/standalone');

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(standalone))) {
  console.log('[prepare-standalone] .next/standalone отсутствует — пропускаем.');
  process.exit(0);
}

await cp(resolve(root, '.next/static'), resolve(standalone, '.next/static'), {
  recursive: true,
  force: true,
});

if (await exists(resolve(root, 'public'))) {
  await cp(resolve(root, 'public'), resolve(standalone, 'public'), {
    recursive: true,
    force: true,
  });
} else {
  await mkdir(resolve(standalone, 'public'), { recursive: true });
}

console.log('[prepare-standalone] статика и public скопированы в .next/standalone');
