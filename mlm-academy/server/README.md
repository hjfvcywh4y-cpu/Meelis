# Подключение хранилища кабинета MLM Academy

Секреты не класть в Tilda, HEAD, клиентский JavaScript и git.

## Что работает сейчас

Живой контур этой итерации — Cloudflare Worker `account-proxy` + KV:

- публичный URL: `https://mlma-account.mlmacademy-search.workers.dev/api`
- cookie `mlma_sid` (HMAC, HttpOnly)
- маршрут, профиль, миграция localStorage, аналитика

SQL в `schema.sql` — контракт на случай Supabase. RLS: пользователь читает только свои строки.

## Идентификация

Документированный клиентский слой Tilda Members: `window.mauser`, `localStorage tilda_members_profile23906986`, cookie `ma_id` / `ma_email`.

Tilda не даёт server-side verify member-token. Первый `POST /api/session/bind` принимает maId/email с Origin Академии и выдаёт свою cookie. Дальше чтение и запись идут только по cookie. Клиентский `userId` не авторизует.

Это **не** защита оплаты. Платные права не выдаются bind-ом.

Следующий этап оплаты: вебхук пишет entitlements в KV/Supabase; отдельная серверная авторизация платформы (magic link) снимет зависимость от клиентского bind.

## Переменные (только сервер Worker)

```
MLMA_SESSION_SECRET=
```

Клиенту в HEAD:

```html
<script>window.MLMA_API_URL = "https://mlma-account.mlmacademy-search.workers.dev/api";</script>
```

Если понадобится Supabase:

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
MLMA_WEBHOOK_SECRET=
```

## Интерфейс репозитория

См. `tilda/src/storage.js`: `loadAccount`, `saveTrackToRoute`, `removeTrackFromRoute`, `hydrateAccountFromServer`, `saveProfile`.
