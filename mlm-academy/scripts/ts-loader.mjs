import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, extname } from 'node:path';
import ts from 'typescript';

function transpile(url) {
  const source = readFileSync(new URL(url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      resolveJsonModule: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: fileURLToPath(url),
  });
  return outputText;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const root = join(fileURLToPath(new URL('..', import.meta.url)), 'src', specifier.slice(2));
    const candidates = [root, root + '.ts', root + '.tsx', join(root, 'index.ts')];
    for (const candidate of candidates) {
      if (existsSync(candidate) && !candidate.endsWith('/')) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
  }
  if (specifier.startsWith('.') && !extname(specifier)) {
    const base = fileURLToPath(new URL(specifier, context.parentURL));
    for (const extra of ['.ts', '.tsx', '.json', '.js']) {
      if (existsSync(base + extra)) {
        return { url: pathToFileURL(base + extra).href, shortCircuit: true, format: extra === '.json' ? 'json' : 'module' };
      }
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith('file:') && (url.endsWith('.ts') || url.endsWith('.tsx'))) {
    return { format: 'module', source: transpile(url), shortCircuit: true };
  }
  return nextLoad(url, context);
}
