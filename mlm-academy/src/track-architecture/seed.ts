import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { importRouterJson } from './importer';
import { MemoryArchitectureStore, type ArchitectureStore } from './store';

const routerPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../spec/track-architecture/MLM_Academy_Track_Router_v2.json',
);

export function routerSource(filePath = routerPath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return { filename: path.basename(filePath), text, json: JSON.parse(text) as unknown };
}

export function createSeededStore(filePath = routerPath): ArchitectureStore {
  const store = new MemoryArchitectureStore();
  const result = importRouterJson(store, routerSource(filePath), { dryRun: false });
  if (!result.ok) {
    const errors = result.issues.filter((issue) => issue.level === 'error').map((issue) => issue.message);
    throw new Error(`Router v2 seed failed:\n${errors.join('\n')}`);
  }
  return store;
}

let singleton: ArchitectureStore | null = null;

export function getArchitectureStore(): ArchitectureStore {
  if (!singleton) singleton = createSeededStore();
  return singleton;
}

export function resetArchitectureStoreForTests(store?: ArchitectureStore): ArchitectureStore {
  singleton = store || createSeededStore();
  return singleton;
}
