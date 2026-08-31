import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { importFullGraphJson, importRouterJson } from './importer';
import { MemoryArchitectureStore, type ArchitectureStore } from './store';
import { ProductionRepositoryNotConfiguredError, isProductionRepositoryConfigured } from './postgres';

const here = path.dirname(fileURLToPath(import.meta.url));
const routerPath = path.resolve(here, '../../spec/track-architecture/MLM_Academy_Track_Router_v2.json');
const graphPath = path.resolve(here, '../../spec/track-architecture/full-graph-112-v3.json');

export function routerSource(filePath = routerPath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return { filename: path.basename(filePath), text, json: JSON.parse(text) as unknown };
}

export function graphSource(filePath = graphPath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return { filename: path.basename(filePath), text, json: JSON.parse(text) as unknown };
}

export function createSeededStore(filePath = graphPath): ArchitectureStore {
  const store = new MemoryArchitectureStore();
  const source = filePath === routerPath ? routerSource(filePath) : graphSource(filePath);
  const result =
    filePath === routerPath
      ? importRouterJson(store, source, { dryRun: false })
      : importFullGraphJson(store, source, { dryRun: false });
  if (!result.ok) {
    const errors = result.issues.filter((issue) => issue.level === 'error').map((issue) => issue.message);
    throw new Error(`Architecture seed failed:\n${errors.join('\n')}`);
  }
  return store;
}

let singleton: ArchitectureStore | null = null;

export function getArchitectureStore(env: NodeJS.Dict<string> = process.env): ArchitectureStore {
  if (env.NODE_ENV === 'production' && !isProductionRepositoryConfigured(env)) {
    throw new ProductionRepositoryNotConfiguredError();
  }
  if (env.NODE_ENV === 'production') {
    throw new ProductionRepositoryNotConfiguredError(
      'PostgreSQL adapter is present but no live production driver is wired; refusing in-memory fallback',
    );
  }
  if (!singleton) singleton = createSeededStore();
  return singleton;
}

export function resetArchitectureStoreForTests(store?: ArchitectureStore): ArchitectureStore {
  singleton = store || createSeededStore();
  return singleton;
}
