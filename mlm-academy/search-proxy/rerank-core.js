/**
 * Общая логика серверного rerank. Ключ модели сюда не попадает из клиента.
 * Используется Worker, Vercel Edge и локальным preview-сервером Tilda.
 */
export const TIMEOUT_MS = 2500;
export const MODEL_DEFAULT = 'gpt-4o-mini';
export const ENDPOINT_DEFAULT = 'https://api.openai.com/v1/chat/completions';

export const ALLOWED_ORIGINS = [
  'https://mlmacademy.ru',
  'https://www.mlmacademy.ru',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
  'http://localhost:3000',
];

export const SYSTEM_PROMPT = [
  'Ты reranker библиотеки MLM Academy.',
  'Можно выбирать только trackId из списка кандидатов. Не придумывай треки, шаги, цифры и факты.',
  'Верни строго JSON:',
  '{"topMatches":[{"trackId":"A3-002","confidence":0.9,"reason":"Подходит, потому что ..."}],"relatedMatches":[{"trackId":"A3-016","confidence":0.6,"reason":"..."}],"confidence":0.8,"reason":"коротко почему такой выбор","clarification":null}',
  'Правила:',
  '- topMatches: максимум 3 точных результата, только если уверенность >= 0.6;',
  '- relatedMatches: максимум 5 близких, уверенность >= 0.45;',
  '- reason у каждого трека — одно естественное предложение на русском, без ключевых слов, тегов и служебных полей;',
  '- если точного трека нет (новая география, снять видео, открыть город, тема вне каталога) — topMatches и relatedMatches пустые, confidence < 0.4, clarification: один уточняющий вопрос;',
  '- не матчить по одному общему глаголу вроде «открыть», «собрать», «сделать»;',
  '- командную проблему не подменять личным треком про страх или первое сообщение;',
  '- не подставляй случайный трек при низкой уверенности.',
].join(' ');

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
    .slice(0, 15)
    .map((item) => ({
      trackId: String(item.trackId || ''),
      title: String(item.title || '').slice(0, 160),
      situation: String(item.situation || '').slice(0, 220),
      result: String(item.result || item.outcome || '').slice(0, 220),
      sectionId: String(item.sectionId || ''),
      tags: Array.isArray(item.tags) ? item.tags.slice(0, 8).map((tag) => String(tag).slice(0, 40)) : [],
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

export function shapeRerankResponse(parsed, allowedIds) {
  const allowed = allowedIds instanceof Set ? allowedIds : new Set(allowedIds || []);
  const rawTop = Array.isArray(parsed && parsed.topMatches) ? parsed.topMatches : [];
  const rawRelated = Array.isArray(parsed && parsed.relatedMatches) ? parsed.relatedMatches : [];
  const legacy = Array.isArray(parsed && parsed.results) ? parsed.results : [];
  const sourceTop = rawTop.length ? rawTop : legacy.slice(0, 3);
  const sourceRelated = rawRelated.length ? rawRelated : legacy.slice(3, 8);
  const seen = new Set();
  const topMatches = [];
  for (const row of sourceTop) {
    const item = normalizeRow(row, allowed);
    if (!item || item.confidence < 0.6 || seen.has(item.trackId)) continue;
    seen.add(item.trackId);
    topMatches.push(item);
    if (topMatches.length >= 3) break;
  }
  const relatedMatches = [];
  for (const row of sourceRelated) {
    const item = normalizeRow(row, allowed);
    if (!item || item.confidence < 0.45 || seen.has(item.trackId)) continue;
    seen.add(item.trackId);
    relatedMatches.push(item);
    if (relatedMatches.length >= 5) break;
  }
  const confidence = Math.max(0, Math.min(1, Number(parsed && parsed.confidence != null ? parsed.confidence : topMatches[0] ? topMatches[0].confidence : 0) || 0));
  const low = confidence < 0.45 || topMatches.length === 0;
  return {
    topMatches: low ? [] : topMatches,
    relatedMatches: low ? [] : relatedMatches,
    confidence: low ? Math.min(confidence, 0.39) : confidence,
    reason: clip(parsed && parsed.reason, 220),
    clarification: low ? clip(parsed && (parsed.clarification || parsed.clarifyingQuestion), 220) || 'Точного трека пока нет. Уточните, что происходит прямо сейчас.' : parsed && parsed.clarification ? clip(parsed.clarification, 220) : null,
  };
}

export async function callModel({ query, candidates, env, fetchImpl }) {
  const key = (env && (env.OPENAI_API_KEY || env.GROQ_API_KEY)) || '';
  if (!key) {
    const error = new Error('rerank_unconfigured');
    error.status = 503;
    throw error;
  }
  const model = (env && env.SEARCH_RERANK_MODEL) || MODEL_DEFAULT;
  const endpoint = (env && env.SEARCH_RERANK_ENDPOINT) || ENDPOINT_DEFAULT;
  const fetchFn = fetchImpl || fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify({ query: String(query || '').slice(0, 400), candidates }) },
        ],
      }),
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
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400, headers: cors });
  }
  const query = String((body && body.query) || '').trim().slice(0, 400);
  const candidates = compactCandidates(body && body.candidates);
  if (!query || !candidates.length) return Response.json({ error: 'empty_payload' }, { status: 400, headers: cors });
  try {
    const data = await callModel({ query, candidates, env: env || {} });
    return Response.json(data, { headers: cors });
  } catch (err) {
    const status = err && err.name === 'AbortError' ? 504 : err && err.status ? err.status : 504;
    const error = status === 503 ? 'rerank_unconfigured' : status === 502 ? 'upstream' : 'timeout';
    return Response.json({ error }, { status, headers: cors });
  }
}
