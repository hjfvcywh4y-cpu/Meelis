# Search rerank proxy

Tilda вызывает этот endpoint с запросом и 10–15 кандидатами локального поиска.
Ключ модели живёт только здесь.

## Next.js

Маршрут: `src/app/api/search/rerank/route.ts`

Переменные площадки:

- `OPENAI_API_KEY` или `GROQ_API_KEY`
- `SEARCH_RERANK_MODEL` (по умолчанию `gpt-4o-mini`)
- `SEARCH_RERANK_ENDPOINT` (по умолчанию OpenAI chat completions)

После деплоя в Tilda, в HEAD страниц Academy:

```html
<script>window.MLMA_RERANK_URL = 'https://<ваш-домен>/api/search/rerank';</script>
```

## Cloudflare Worker

Файл `worker.js`. Секреты те же. URL вида `https://mlma-search.<account>.workers.dev`.

Оценка стоимости `gpt-4o-mini` на один запрос: около $0.0003–$0.0006
(запрос + 15 карточек ≈ 1.5k input / 250 output tokens).
