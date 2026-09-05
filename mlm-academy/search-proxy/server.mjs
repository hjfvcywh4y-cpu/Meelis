/**
 * Локальный HTTPS-прокси rerank без Vercel.
 * Ключ только в env процесса. Запуск: GROQ_API_KEY=... node server.mjs
 */
import http from 'node:http';
import { handleRerankRequest } from './rerank-core.js';

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';

function toWebRequest(req, body) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const url = 'http://' + (req.headers.host || '127.0.0.1') + (req.url || '/');
  const method = req.method || 'GET';
  const init = { method, headers };
  if (method !== 'GET' && method !== 'HEAD') init.body = body;
  return new Request(url, init);
}

const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, configured: Boolean(process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY) }));
    return;
  }
  if (pathname !== '/api/rerank' && pathname !== '/api/search/rerank') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
    return;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  try {
    const out = await handleRerankRequest(toWebRequest(req, body), process.env);
    res.writeHead(out.status, Object.fromEntries(out.headers.entries()));
    res.end(Buffer.from(await out.arrayBuffer()));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'proxy' }));
  }
});

server.listen(PORT, HOST, () => {
  console.log('mlma-search-proxy http://' + HOST + ':' + PORT + '/api/rerank');
});
