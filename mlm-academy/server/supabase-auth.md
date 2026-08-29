# Подключение Supabase Auth · следующий этап

Сейчас живой кабинет работает на Cloudflare Worker + KV.
Supabase **не подключён**: ключей в репозитории и в Tilda нет.

Не вставляйте выдуманные значения. Не кладите service role и webhook-секрет в Tilda, HEAD и клиентский JavaScript.

## Зачем

Текущий `POST /api/session/bind` даёт только `identityLevel: tilda_unverified`.
Этого достаточно для Track ID маршрута. Этого **недостаточно** для оплаты.

Нужный контур:

1. Supabase Auth: magic link или одноразовый код на email.
2. Серверно подтверждённый UUID (`auth.uid()`).
3. HttpOnly Secure SameSite cookie или проверяемый JWT на Worker.
4. RLS на таблицах из `schema.sql` / `migrations/001_identity_and_rls.sql`.
5. Маршрут привязан к UUID, не к `ma_id` из браузера.
6. Платные права только из серверного webhook (`identityLevel: verified`).

## Переменные (только сервер)

Имена без значений. Скопировать в секрет-хранилище Worker/Supabase, не в git:

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
MLMA_WEBHOOK_SECRET=
MLMA_SESSION_SECRET=
MLMA_API_PUBLIC_URL=
PAYMENT_GATEWAY=test
```

Клиенту по-прежнему только публичный URL:

```
MLMA_API_PUBLIC_URL=https://mlma-account.<subdomain>.workers.dev/api
```

`SUPABASE_ANON_KEY` можно отдать браузеру только если RLS включён и entitlements нельзя писать с клиента. Service role — никогда.

## Короткие шаги

1. Создать проект Supabase (EU, если нужно).
2. Authentication → Providers → Email: включить Magic link. OTP — по желанию.
3. Site URL: `https://mlmacademy.ru`. Redirect: `https://mlmacademy.ru/my`.
4. SQL editor: сначала `server/schema.sql`, затем `server/migrations/001_identity_and_rls.sql`.
5. В Cloudflare Worker добавить те же переменные через `wrangler secret put`.
6. `POST /api/session/verified` сейчас отвечает `501 verified_auth_not_configured`. После ключей Worker должен проверить JWT Supabase и выставить `identityLevel: verified` + `auth_user_id`.
7. Webhook оплаты пишет `entitlements` service role-ом. Клиентский bind этого не делает.

Текущий кабинет Tilda Members не ломать: bind и KV-маршрут остаются для FREE, пока magic link не станет основным входом.
