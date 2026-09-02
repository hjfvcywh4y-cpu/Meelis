import fs from 'node:fs';
import path from 'node:path';

import { createSeededStore, graphSource, routerSource } from './seed';
import { importArchitectureSource, importFullGraphJson, importRouterJson } from './importer';
import { checkTrack } from './check';
import { MemoryArchitectureStore } from './store';

function print(data: unknown) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

function readJsonFile(filePath: string) {
  const abs = path.resolve(filePath);
  const text = fs.readFileSync(abs, 'utf8');
  return { filename: path.basename(abs), text, json: JSON.parse(text) as unknown };
}

function attachPackageContentBody(
  source: { filename: string; text: string; json: unknown },
  filePath: string,
): { filename: string; text: string; json: unknown; contentBody?: unknown } {
  const json = source.json as { content?: { sourcePath?: string } } | null;
  const sourcePath = json?.content?.sourcePath;
  const dir = path.dirname(path.resolve(filePath));
  const candidates = [
    path.join(dir, 'content', 'content.json'),
    sourcePath ? path.resolve(process.cwd(), sourcePath, 'content.json') : '',
    sourcePath ? path.resolve(process.cwd(), sourcePath) : '',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) continue;
    if (!candidate.endsWith('.json')) continue;
    return { ...source, contentBody: JSON.parse(fs.readFileSync(candidate, 'utf8')) as unknown };
  }
  return source;
}

function localStorePath() {
  return path.resolve(process.cwd(), '.local/track-architecture/store.json');
}

function loadLocalStore() {
  const file = localStorePath();
  if (!fs.existsSync(file)) return createSeededStore();
  const store = new MemoryArchitectureStore();
  store.replaceAll(JSON.parse(fs.readFileSync(file, 'utf8')));
  return store;
}

function saveLocalStore(store: ReturnType<typeof createSeededStore>) {
  const file = localStorePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(store.snapshot(), null, 2));
}

export async function runTracksCli(argv: string[]): Promise<void> {
  const command = argv[0];
  if (!command || command === 'help' || command === '-h') {
    print({
      commands: {
        'tracks:validate <file>': 'Validate full-graph v3 JSON, router v2 JSON, or a track package',
        'tracks:import --dry-run <file>': 'Show diff without writing the local test store',
        'tracks:import --apply <file>': 'Apply to .local/track-architecture (never production)',
        'track:check <id>': 'Inspect one Track ID including connectionIndex',
      },
    });
    return;
  }

  if (command === 'validate') {
    const file = argv[1];
    if (!file) throw new Error('Usage: tracks:validate <graph-or-router-or-package>');
    const source = attachPackageContentBody(readJsonFile(file), file);
    const store = createSeededStore();
    const result = importArchitectureSource(store, source, { dryRun: true });
    print(result);
    if (!result.ok) process.exitCode = 1;
    return;
  }

  if (command === 'import') {
    const dryRun = argv.includes('--dry-run');
    const apply = argv.includes('--apply');
    const file = argv.find((item) => !item.startsWith('-') && item !== 'import');
    if (!file) throw new Error('Usage: tracks:import --dry-run|--apply <file>');
    const source = attachPackageContentBody(readJsonFile(file), file);
    const store = apply ? loadLocalStore() : createSeededStore();
    const result = importArchitectureSource(store, source, { dryRun: dryRun || !apply });
    if (apply && result.ok) saveLocalStore(store);
    print({ ...result, applied: apply && result.ok, store: apply ? localStorePath() : null });
    if (!result.ok) process.exitCode = 1;
    return;
  }

  if (command === 'check') {
    const id = argv[1];
    if (!id) throw new Error('Usage: track:check <track-id>');
    print(checkTrack(createSeededStore(), id));
    return;
  }

  if (command === 'seed-validate') {
    const graph = importFullGraphJson(new MemoryArchitectureStore(), graphSource(), { dryRun: true });
    const router = importRouterJson(new MemoryArchitectureStore(), routerSource(), { dryRun: true });
    print({ graph, router });
    if (!graph.ok || !router.ok) process.exitCode = 1;
    return;
  }

  throw new Error(`Unknown command ${command}`);
}
