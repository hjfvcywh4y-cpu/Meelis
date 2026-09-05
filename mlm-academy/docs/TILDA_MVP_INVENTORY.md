# Инвентарь Tilda-MVP · факт на 2026-08-29

Файл `mlm-academy-audit-2026-08-29.md` в репозитории и workspace **не найден**.
Ниже — проверка кода и живого контура, не старые отчёты.

## Исходники

| Что | Где |
|---|---|
| Общий код Academy | `mlm-academy/tilda/src/` (`domain.js`, `access.js`, `storage.js`, `payments.js`, `search.js`, `analytics.js`, `ontology.js`, `ui.js`, `mlma.css`) |
| Каталог 112 | `mlm-academy/src/data/tracks.catalog.json` → `tilda/generate.mjs` → `tilda/dist/shared/v1/catalog.json` |
| 17+ страниц Tilda | `tilda/pages.json` + генератор. Живые страницы получают код блоками T123. Preview грузит `/shared/v1/*` |
| Research | отдельная страница `/research/marketing-plan` |
| Account Worker | `mlm-academy/account-proxy/worker.js`, `account-core.js` |
| Search Worker | `mlm-academy/search-proxy/` |
| KV | binding `MLMA_ACCOUNT`, id `0b46cfe22b7d4f2ab1adb0af4f68d4a8` |
| Env | `.env.example`, `server/env.example`, wrangler `[vars]` `PAYMENTS_ENABLED=false` `TEST_MODE=true`. Секреты только wrangler secret |
| Supabase SQL | `server/schema.sql`, `migrations/001_identity_and_rls.sql`, `migrations/002_payments.sql`. База не подключена |
| Next.js заготовка | `mlm-academy/src/app/*` — не прод |

## Каталог (проверено генератором)

A1=16, A2=16, A3=17, A4=17, A5=14, A6=32, всего 112 уникальных Track ID.
Все карточки `planned` / `metadata_only` / `access=undecided` (в UI undecided = paid-контур описания).

## Заглушки

- `/api/session/verified` → 501
- checkout / yookassa / entitlements / refunds → 403 `payments_disabled`
- Supabase Auth не подключен
- политика — черновик
- тела треков не наполнены

## Идентификация

Tilda Members bind = `tilda_unverified`. Не называть защищённой.
