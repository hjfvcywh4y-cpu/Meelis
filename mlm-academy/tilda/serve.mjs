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

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  let pathname = url.pathname.replace(/\/+$/, '') || '/';
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
