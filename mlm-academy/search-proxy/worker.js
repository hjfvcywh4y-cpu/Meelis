/**
 * Cloudflare Worker / любой fetch-handler для rerank поиска MLM Academy.
 * Секрет OPENAI_API_KEY (или GROQ_API_KEY) задаётся в окружении Worker, не в Tilda.
 */
const ALLOWED_ORIGINS = ['https://mlmacademy.ru', 'https://www.mlmacademy.ru'];

const worker = {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return Response.json({ error: 'method' }, { status: 405, headers: cors });
    const key = env.OPENAI_API_KEY || env.GROQ_API_KEY;
    if (!key) return Response.json({ error: 'rerank_unconfigured' }, { status: 503, headers: cors });
    const body = await request.json().catch(() => null);
    if (!body || !body.query || !Array.isArray(body.candidates)) {
      return Response.json({ error: 'empty_payload' }, { status: 400, headers: cors });
    }
    const allowed = new Set(body.candidates.map((item) => item.trackId).filter(Boolean));
    const model = env.SEARCH_RERANK_MODEL || 'gpt-4o-mini';
    const endpoint = env.SEARCH_RERANK_ENDPOINT || 'https://api.openai.com/v1/chat/completions';
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2200);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'Ты reranker библиотеки MLM Academy. Можно выбирать только trackId из списка кандидатов. Не придумывай треки. JSON: {"recognizedSituation":"...","results":[{"trackId":"A1-007","confidence":0.9,"reason":"..."}],"clarifyingQuestion":null}',
            },
            { role: 'user', content: JSON.stringify({ query: String(body.query).slice(0, 400), candidates: body.candidates.slice(0, 15) }) },
          ],
        }),
      });
      const raw = await res.json();
      const parsed = JSON.parse(raw?.choices?.[0]?.message?.content || '{}');
      const results = (parsed.results || [])
        .filter((row) => allowed.has(String(row.trackId || '')) && Number(row.confidence || 0) >= 0.35)
        .slice(0, 6)
        .map((row) => ({
          trackId: String(row.trackId),
          confidence: Math.max(0, Math.min(1, Number(row.confidence) || 0)),
          reason: String(row.reason || '').slice(0, 180),
        }));
      return Response.json(
        {
          recognizedSituation: parsed.recognizedSituation || '',
          results,
          clarifyingQuestion: parsed.clarifyingQuestion || null,
          model,
        },
        { headers: cors },
      );
    } catch {
      return Response.json({ error: 'timeout' }, { status: 504, headers: cors });
    } finally {
      clearTimeout(timer);
    }
  },
};

export default worker;
