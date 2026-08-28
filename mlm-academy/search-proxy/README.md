# Search rerank proxy

Tilda вызывает этот endpoint с запросом и максимум 15 кандидатами локального поиска.
Ключ модели живёт только здесь и никогда не попадает в Tilda, HTML или клиентский JS.

## Основная площадка: Vercel Edge Function

Файлы:

- `api/rerank.js` — Edge Function
- `rerank-core.js` — общая логика
- `vercel.json` — алиас `/api/search/rerank` → `/api/rerank`

Переменные площадки:

- `OPENAI_API_KEY` или `GROQ_API_KEY` **обязательно**
- `SEARCH_RERANK_MODEL` (по умолчанию `gpt-4o-mini`)
- `SEARCH_RERANK_ENDPOINT` (по умолчанию `https://api.openai.com/v1/chat/completions`)

Деплой из каталога `mlm-academy/search-proxy`:

```bash
npx vercel --prod
```

После деплоя в HEAD страниц Academy:

```html
<script>window.MLMA_RERANK_URL = 'https://<проект>.vercel.app/api/rerank';</script>
```

Или задайте `MLMA_RERANK_PUBLIC_URL` при сборке `tilda/generate.mjs`.

## Cloudflare Worker

`worker.js` + `wrangler.toml`. Секреты те же.

```bash
npx wrangler deploy
```

## Next.js (прототип, не Tilda)

Маршрут: `src/app/api/search/rerank/route.ts` — тот же `rerank-core.js`.

## Ответ

```json
{
  "topMatches": [{"trackId":"A3-002","confidence":0.9,"reason":"Подходит, потому что ..."}],
  "relatedMatches": [],
  "confidence": 0.9,
  "reason": "коротко",
  "clarification": null
}
```

Таймаут модели — 2,5 с. При ошибке клиент остаётся на локальном поиске.

Оценка стоимости `gpt-4o-mini` на один запрос: около $0.00015–$0.0004
(запрос + 15 карточек ≈ 1.2k input / 200 output tokens).
