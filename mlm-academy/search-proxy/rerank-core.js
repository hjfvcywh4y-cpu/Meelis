/**
 * Общая логика серверного rerank. Ключ модели сюда не попадает из клиента.
 * Используется Worker, Vercel Edge и локальным preview-сервером Tilda.
 */
export const TIMEOUT_MS = 12000;
export const MODEL_DEFAULT = 'gpt-4o-mini';
export const ENDPOINT_DEFAULT = 'https://api.openai.com/v1/chat/completions';
export const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
export const GROQ_MODEL_DEFAULT = 'openai/gpt-oss-20b';
export const CANDIDATE_LIMIT = 20;
export const CATALOG_INDEX_LIMIT = 112;
export const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export function resolveModelConfig(env = {}) {
  const openaiKey = String((env && env.OPENAI_API_KEY) || '');
  const groqKey = String((env && env.GROQ_API_KEY) || '');
  const overrideModel = (env && env.SEARCH_RERANK_MODEL) || '';
  const overrideEndpoint = (env && env.SEARCH_RERANK_ENDPOINT) || '';
  if (openaiKey) {
    return {
      key: openaiKey,
      provider: 'openai',
      model: overrideModel || MODEL_DEFAULT,
      endpoint: overrideEndpoint || ENDPOINT_DEFAULT,
    };
  }
  if (groqKey) {
    return {
      key: groqKey,
      provider: 'groq',
      model: overrideModel || GROQ_MODEL_DEFAULT,
      endpoint: overrideEndpoint || GROQ_ENDPOINT,
    };
  }
  return { key: '', provider: null, model: MODEL_DEFAULT, endpoint: ENDPOINT_DEFAULT };
}

export const ALLOWED_ORIGINS = [
  'https://mlmacademy.ru',
  'https://www.mlmacademy.ru',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
  'http://localhost:3000',
];

export const SYSTEM_PROMPT = [
  'Ты — поисковый маршрутизатор MLM Academy. Ты не отвечаешь на вопрос пользователя самостоятельно, а находишь в переданном каталоге наиболее полезные треки.',
  'Пользователь пишет простым, разговорным и иногда неточным языком. Он может назвать не учебную тему, а симптом: «я потерялся»; «ничего не успеваю»; «люди молчат»; «стыдно писать»; «нужен план»; «команда стоит»; «не понимаю, что делать дальше».',
  'Сначала восстанови реальную задачу пользователя: 1) на какой стадии он находится; 2) что сейчас не получается; 3) какое действие ему нужно совершить; 4) какой результат он хочет получить; 5) какой трек может стать ближайшим полезным шагом.',
  'Правила:',
  '1. Используй только переданные Track ID.',
  '2. Никогда не придумывай треки и ID.',
  '3. Не ищи только буквальные совпадения.',
  '4. Сопоставляй запрос с ситуацией, результатом и действием трека.',
  '5. Для любого запроса внутри тематики MLM Academy предложи хотя бы один ближайший полезный трек.',
  '6. Если точного трека нет, верни близкие треки с типом adjacent, а не пустой ответ.',
  '7. Для широкого запроса предложи до трёх стартовых направлений и уточняющий вопрос.',
  '8. Пустой ответ разрешён только для запроса, который действительно не относится к MLM, продажам, клиентам, коммуникации, планированию, продукту, личной организации, наставничеству или развитию команды.',
  '9. Не выдавай слабое совпадение за точное.',
  '10. Объясняй выбор человеческим языком, не перечисляя ключевые слова и технические оценки.',
  '11. Главное — помочь человеку сделать следующий полезный шаг.',
  'Уровни соответствия: exact — трек прямо решает описанную ситуацию; strong — трек решает основную часть задачи; adjacent — трек является полезным ближайшим шагом; out_of_scope — запрос не относится к библиотеке.',
  'Верни строгий JSON:',
  '{"recognizedSituation":"Коротко понятая ситуация пользователя","matchType":"exact | strong | adjacent | out_of_scope","topMatches":[{"trackId":"A1-010","confidence":0.86,"reason":"Поможет превратить общую цель в конкретный план действий на месяц"}],"relatedMatches":[],"clarification":"Один короткий уточняющий вопрос или null","confidence":0.86}',
  'Если запрос широкий, confidence может быть невысоким, но topMatches не должны быть пустыми, если в каталоге есть полезные ближайшие действия.',
].join(' ');

const memoryCache = new Map();

export function normalizeCacheQuery(query) {
  return String(query || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function cacheKeyFor(query) {
  return normalizeCacheQuery(query);
}

function readMemory(key) {
  const row = memoryCache.get(key);
  if (!row) return null;
  if (Date.now() - row.at > CACHE_TTL_MS) {
    memoryCache.delete(key);
    return null;
  }
  return row.data;
}

function writeMemory(key, data) {
  memoryCache.set(key, { at: Date.now(), data });
  if (memoryCache.size > 400) {
    const first = memoryCache.keys().next().value;
    memoryCache.delete(first);
  }
}

export function corsHeaders(origin) {
  const allow = pickOrigin(origin);
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function pickOrigin(origin) {
  const value = String(origin || '');
  if (ALLOWED_ORIGINS.includes(value)) return value;
  if (/^https:\/\/[a-z0-9-]+\.tilda\.ws$/i.test(value)) return value;
  if (/^https:\/\/[a-z0-9-]+\.tilda\.cc$/i.test(value)) return value;
  if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(value)) return value;
  return ALLOWED_ORIGINS[0];
}

export function compactCandidates(candidates) {
  return (Array.isArray(candidates) ? candidates : [])
    .slice(0, CANDIDATE_LIMIT)
    .map((item) => ({
      trackId: String(item.trackId || item.id || ''),
      title: String(item.title || '').slice(0, 160),
      situation: String(item.situation || (item.situations && item.situations[0]) || '').slice(0, 220),
      result: String(item.result || item.outcome || '').slice(0, 220),
      sectionId: String(item.sectionId || item.stage || ''),
      aliases: Array.isArray(item.aliases)
        ? item.aliases.slice(0, 10).map((tag) => String(tag).slice(0, 48))
        : Array.isArray(item.tags)
          ? item.tags.slice(0, 10).map((tag) => String(tag).slice(0, 48))
          : [],
    }))
    .filter((item) => /^A[1-6]-\d{3}$/.test(item.trackId));
}

export function compactCatalogIndex(rows) {
  return (Array.isArray(rows) ? rows : [])
    .slice(0, CATALOG_INDEX_LIMIT)
    .map((item) => ({
      trackId: String(item.trackId || item.id || ''),
      title: String(item.title || '').slice(0, 80),
      situation: String(item.situation || (item.situations && item.situations[0]) || '').slice(0, 90),
      result: String(item.result || item.outcome || '').slice(0, 90),
      sectionId: String(item.sectionId || item.stage || ''),
      aliases: Array.isArray(item.aliases)
        ? item.aliases.slice(0, 6).map((tag) => String(tag).slice(0, 32))
        : [],
    }))
    .filter((item) => /^A[1-6]-\d{3}$/.test(item.trackId));
}

function clip(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizeRow(row, allowed) {
  const trackId = String(row && row.trackId ? row.trackId : '');
  if (!allowed.has(trackId)) return null;
  const confidence = Math.max(0, Math.min(1, Number(row.confidence) || 0));
  const reason = clip(row.reason, 180);
  return { trackId, confidence, reason };
}

function inferMatchType(confidence, topCount, parsedType) {
  const allowed = { exact: 1, strong: 1, adjacent: 1, out_of_scope: 1 };
  if (parsedType && allowed[parsedType]) return parsedType;
  if (confidence >= 0.7 && topCount) return 'exact';
  if (confidence >= 0.45) return 'strong';
  if (confidence >= 0.2) return 'adjacent';
  return 'out_of_scope';
}

export function shapeRerankResponse(parsed, allowedIds) {
  const allowed = allowedIds instanceof Set ? allowedIds : new Set(allowedIds || []);
  const rawTop = Array.isArray(parsed && parsed.topMatches) ? parsed.topMatches : [];
  const rawRelated = Array.isArray(parsed && parsed.relatedMatches) ? parsed.relatedMatches : [];
  const legacy = Array.isArray(parsed && parsed.results) ? parsed.results : [];
  const sourceTop = rawTop.length ? rawTop : legacy.slice(0, 3);
  const sourceRelated = rawRelated.length ? rawRelated : legacy.slice(3, 8);
  const seen = new Set();
  const topMatches = [];
  const relatedMatches = [];
  const parsedType = parsed && parsed.matchType ? String(parsed.matchType) : '';
  const outOfScope = parsedType === 'out_of_scope';

  function take(rows, bucket, limit, minConf) {
    for (const row of rows) {
      const item = normalizeRow(row, allowed);
      if (!item || seen.has(item.trackId)) continue;
      if (item.confidence < minConf) continue;
      seen.add(item.trackId);
      bucket.push(item);
      if (bucket.length >= limit) break;
    }
  }

  take(sourceTop, topMatches, 3, 0.2);
  take(sourceRelated, relatedMatches, 5, 0.2);
  if (!topMatches.length && relatedMatches.length) {
    topMatches.push(relatedMatches.shift());
  }

  const confidence = Math.max(
    0,
    Math.min(
      1,
      Number(parsed && parsed.confidence != null ? parsed.confidence : topMatches[0] ? topMatches[0].confidence : 0) || 0,
    ),
  );
  const matchType = outOfScope && !topMatches.length
    ? 'out_of_scope'
    : inferMatchType(confidence, topMatches.length, parsedType === 'out_of_scope' ? '' : parsedType);

  if (matchType === 'out_of_scope' && confidence < 0.2) {
    return {
      recognizedSituation: clip(parsed && parsed.recognizedSituation, 180),
      matchType: 'out_of_scope',
      topMatches: [],
      relatedMatches: [],
      confidence,
      reason: clip(parsed && parsed.reason, 220),
      clarification: clip(parsed && (parsed.clarification || parsed.clarifyingQuestion), 220) || 'Этот запрос не относится к библиотеке MLM Academy.',
    };
  }

  const clarify = parsed && (parsed.clarification || parsed.clarifyingQuestion)
    ? clip(parsed.clarification || parsed.clarifyingQuestion, 220)
    : (confidence < 0.45 ? clip(parsed && parsed.clarification, 220) : null);

  return {
    recognizedSituation: clip(parsed && parsed.recognizedSituation, 180),
    matchType,
    topMatches,
    relatedMatches,
    confidence,
    reason: clip(parsed && parsed.reason, 220),
    clarification: clarify || null,
  };
}

export async function callModel({ query, candidates, catalog, env, fetchImpl }) {
  const { key, model, endpoint } = resolveModelConfig(env);
  if (!key) {
    const error = new Error('rerank_unconfigured');
    error.status = 503;
    throw error;
  }
  const fetchFn = fetchImpl || fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const payload = {
    query: String(query || '').slice(0, 400),
    candidates,
  };
  if (Array.isArray(catalog) && catalog.length) payload.catalog = catalog;
  const body = {
    model,
    temperature: 0,
    max_tokens: 500,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(payload) },
    ],
  };
  if (/gpt-oss/.test(model)) body.reasoning_effort = 'low';
  if (/qwen/.test(model)) body.reasoning_effort = 'none';
  try {
    const res = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        'User-Agent': 'mlma-search-rerank/2',
      },
      signal: ctrl.signal,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const error = new Error('upstream');
      error.status = 502;
      throw error;
    }
    const raw = await res.json();
    const text = raw && raw.choices && raw.choices[0] && raw.choices[0].message ? raw.choices[0].message.content : '{}';
    let parsed;
    try {
      parsed = JSON.parse(text || '{}');
    } catch {
      const error = new Error('bad_model_json');
      error.status = 502;
      throw error;
    }
    const allowed = new Set(candidates.map((item) => item.trackId));
    if (Array.isArray(catalog)) {
      for (const row of catalog) if (row && row.trackId) allowed.add(row.trackId);
    }
    const shaped = shapeRerankResponse(parsed, allowed);
    shaped.model = model;
    shaped.source = 'ai';
    return shaped;
  } finally {
    clearTimeout(timer);
  }
}

export async function handleRerankRequest(request, env) {
  const origin = request.headers.get('origin') || request.headers.get('Origin') || '';
  const cors = corsHeaders(origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (request.method !== 'POST') return Response.json({ error: 'method' }, { status: 405, headers: cors });
  const started = Date.now();
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400, headers: cors });
  }
  const query = String((body && body.query) || '').trim().slice(0, 400);
  let candidates = compactCandidates(body && body.candidates);
  const catalog = compactCatalogIndex(body && body.catalog);
  if ((!candidates.length) && catalog.length) {
    candidates = compactCandidates(catalog);
  }
  if (!query || !candidates.length) return Response.json({ error: 'empty_payload' }, { status: 400, headers: cors });
  const key = cacheKeyFor(query);
  const cached = readMemory(key);
  if (cached) {
    return Response.json(
      Object.assign({}, cached, { cached: true, latencyMs: Date.now() - started }),
      { headers: Object.assign({ 'X-MLMA-Cache': 'hit' }, cors) },
    );
  }
  try {
    const edge = typeof caches !== 'undefined' && caches.default
      ? await caches.default.match(new Request('https://mlma-search.internal/rerank?q=' + encodeURIComponent(key)))
      : null;
    if (edge) {
      const data = await edge.json();
      writeMemory(key, data);
      return Response.json(
        Object.assign({}, data, { cached: true, latencyMs: Date.now() - started }),
        { headers: Object.assign({ 'X-MLMA-Cache': 'edge' }, cors) },
      );
    }
  } catch {
    /* local node has no Cache API */
  }
  try {
    const data = await callModel({
      query,
      candidates,
      catalog: catalog.length > candidates.length ? catalog : undefined,
      env: env || {},
    });
    data.cached = false;
    data.latencyMs = Date.now() - started;
    writeMemory(key, data);
    try {
      if (typeof caches !== 'undefined' && caches.default) {
        await caches.default.put(
          new Request('https://mlma-search.internal/rerank?q=' + encodeURIComponent(key)),
          new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=21600' } }),
        );
      }
    } catch {
      /* ignore */
    }
    return Response.json(data, { headers: Object.assign({ 'X-MLMA-Cache': 'miss' }, cors) });
  } catch (err) {
    const status = err && err.name === 'AbortError' ? 504 : err && err.status ? err.status : 504;
    const error = status === 503 ? 'rerank_unconfigured' : status === 502 ? 'upstream' : 'timeout';
    return Response.json({ error, latencyMs: Date.now() - started }, { status, headers: cors });
  }
}
