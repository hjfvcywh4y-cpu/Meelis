import { NextResponse } from 'next/server';

const ALLOWED_ORIGINS = [
  'https://mlmacademy.ru',
  'https://www.mlmacademy.ru',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
  'http://localhost:3000',
];

const MODEL = process.env.SEARCH_RERANK_MODEL || 'gpt-4o-mini';
const TIMEOUT_MS = 2200;

type Candidate = {
  trackId: string;
  title?: string;
  situation?: string;
  result?: string;
  sectionId?: string;
  score?: number;
};

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function jsonError(origin: string | null, status: number, error: string) {
  return NextResponse.json({ error }, { status, headers: corsHeaders(origin) });
}

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const apiKey = process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY || '';
  if (!apiKey) return jsonError(origin, 503, 'rerank_unconfigured');

  let body: { query?: string; candidates?: Candidate[] };
  try {
    body = await request.json();
  } catch {
    return jsonError(origin, 400, 'invalid_json');
  }

  const query = String(body.query || '').trim().slice(0, 400);
  const candidates = Array.isArray(body.candidates) ? body.candidates.slice(0, 15) : [];
  const allowed = new Set(candidates.map((item) => item.trackId).filter(Boolean));
  if (!query || allowed.size === 0) return jsonError(origin, 400, 'empty_payload');

  const endpoint = process.env.SEARCH_RERANK_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const compact = candidates.map((item) => ({
    trackId: item.trackId,
    title: item.title,
    situation: item.situation,
    result: item.result,
    sectionId: item.sectionId,
  }));

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Ты reranker библиотеки MLM Academy. Можно выбирать только trackId из списка кандидатов. Не придумывай треки, шаги и факты. Верни JSON: {"recognizedSituation": string, "results": [{"trackId": "A1-007", "confidence": 0.0, "reason": "кратко"}], "clarifyingQuestion": string|null}. Если уверенность ниже 0.45, results может быть пустым и нужен один clarifyingQuestion. Не более 6 results.',
          },
          {
            role: 'user',
            content: JSON.stringify({ query, candidates: compact }),
          },
        ],
      }),
    });
    if (!res.ok) return jsonError(origin, 502, 'upstream');
    const raw = await res.json();
    const text = raw?.choices?.[0]?.message?.content || '{}';
    let parsed: {
      recognizedSituation?: string;
      results?: Array<{ trackId?: string; confidence?: number; reason?: string }>;
      clarifyingQuestion?: string | null;
    };
    try {
      parsed = JSON.parse(text);
    } catch {
      return jsonError(origin, 502, 'bad_model_json');
    }
    const results = (parsed.results || [])
      .filter((row) => row && allowed.has(String(row.trackId || '')))
      .slice(0, 6)
      .map((row) => ({
        trackId: String(row.trackId),
        confidence: Math.max(0, Math.min(1, Number(row.confidence) || 0)),
        reason: String(row.reason || '').slice(0, 180),
      }));
    return NextResponse.json(
      {
        recognizedSituation: String(parsed.recognizedSituation || '').slice(0, 180),
        results,
        clarifyingQuestion: parsed.clarifyingQuestion ? String(parsed.clarifyingQuestion).slice(0, 220) : null,
        model: MODEL,
      },
      { headers: corsHeaders(origin) },
    );
  } catch {
    return jsonError(origin, 504, 'timeout');
  } finally {
    clearTimeout(timer);
  }
}
