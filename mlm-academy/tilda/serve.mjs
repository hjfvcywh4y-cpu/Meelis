#!/usr/bin/env node
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');
const PREVIEW = path.join(DIST, 'preview');
const PAGES = JSON.parse(fs.readFileSync(path.join(__dirname, 'pages.json'), 'utf8'));
const PORT = Number(process.env.MLMA_TILDA_PORT || 4173);

const byUrl = new Map(PAGES.map((page) => [page.url, page.file]));
const accountStore = new Map();
const accountEnv = {
  MLMA_SESSION_SECRET: process.env.MLMA_SESSION_SECRET || 'local-dev-only-not-for-tilda',
  MLMA_ACCOUNT: {
    get: async (key) => accountStore.get(key) || null,
    put: async (key, value) => { accountStore.set(key, value); },
  },
};

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  let pathname = url.pathname.replace(/\/+$/, '') || '/';
  if (
    pathname === '/api/health' ||
    pathname === '/health' ||
    pathname.indexOf('/api/session/') === 0 ||
    pathname.indexOf('/api/account/') === 0 ||
    pathname === '/api/analytics'
  ) {
    const accountWorker = (await import(path.join(__dirname, '../account-proxy/worker.js'))).default;
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(',') : String(value));
    }
    const request = new Request('http://127.0.0.1' + pathname, {
      method: req.method || 'GET',
      headers,
      body: req.method === 'POST' || req.method === 'PUT' || req.method === 'OPTIONS' ? body : undefined,
    });
    const out = await accountWorker.fetch(request, accountEnv);
    const outHeaders = Object.fromEntries(out.headers.entries());
    res.writeHead(out.status, outHeaders);
    res.end(Buffer.from(await out.arrayBuffer()));
    return;
  }
  if (pathname === '/api/search/rerank' || pathname === '/api/rerank') {
    const { handleRerankRequest } = await import(path.join(__dirname, '../search-proxy/rerank-core.js'));
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(',') : String(value));
    }
    const request = new Request('http://127.0.0.1' + pathname, {
      method: req.method || 'GET',
      headers,
      body: req.method === 'POST' || req.method === 'PUT' ? body : undefined,
    });
    const out = await handleRerankRequest(request, process.env);
    res.writeHead(out.status, Object.fromEntries(out.headers.entries()));
    res.end(Buffer.from(await out.arrayBuffer()));
    return;
  }
  if (pathname === '/') {
    res.writeHead(302, { Location: '/academy' });
    res.end();
    return;
  }
  if (pathname.startsWith('/shared/')) {
    const safe = path.normalize(pathname.replace(/^\/shared\//, '')).replace(/^(\.\.(\/|\\|$))+/, '');
    const file = path.join(DIST, 'shared', safe);
    if (!file.startsWith(path.join(DIST, 'shared')) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
    return;
  }
  const file = byUrl.get(pathname);
  const trackPretty = pathname.match(/^\/track\/([a-z0-9-]+)$/i);
  if (trackPretty) {
    res.writeHead(302, { Location: '/track?id=' + encodeURIComponent(trackPretty[1].toLowerCase()) });
    res.end();
    return;
  }
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><meta charset="utf-8"><p>Нет страницы ' + pathname + '</p>');
    return;
  }
  const html = fs.readFileSync(path.join(PREVIEW, file));
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('MLM Academy Tilda preview: http://127.0.0.1:' + PORT + '/academy');
});
