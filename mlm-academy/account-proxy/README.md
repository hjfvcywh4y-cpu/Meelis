# Account API · MLM Academy

Серверное хранение кабинета. Секреты не класть в Tilda, HTML и git.

Живая площадка этой итерации — Cloudflare Worker + KV. SQL в `server/schema.sql` остаётся контрактом на случай подключения Supabase.

## Что умеет Worker

- `POST /api/session/bind` — первый вход: принимает `maId` / `email` с страницы Members, выдаёт HttpOnly cookie `mlma_sid`.
- `POST /api/account/get` — чтение только по cookie.
- `POST /api/account/route/save|delete|reorder`
- `POST /api/account/migrate` — перенос Track ID из localStorage.
- `POST /api/account/profile`
- `POST /api/analytics`

Клиентский `userId` после bind **игнорируется**.

## Ограничение Tilda

Tilda Members не даёт документированного server-side verify member-token. Первый bind доверяет клиентской сессии Members на Origin Академии. Это не защита оплаты. Платные права не выдаются этим bind и не защищаются только JS.

Следующий этап: отдельная серверная авторизация платформы (magic link / свой JWT) или webhook оплаты, который пишет entitlements в KV/Supabase.

## Переменные

Только в окружении Worker:

```
MLMA_SESSION_SECRET=
```

Клиенту в HEAD:

```html
<script>window.MLMA_API_URL = "https://mlma-account.<subdomain>.workers.dev/api";</script>
```

## Деплой

```bash
cd account-proxy
npx wrangler kv namespace create MLMA_ACCOUNT
# подставить id в wrangler.toml
npx wrangler secret put MLMA_SESSION_SECRET
npx wrangler deploy
```
