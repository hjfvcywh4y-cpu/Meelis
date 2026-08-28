# Подключение Supabase к MLM Academy

Секреты не класть в Tilda, HEAD, клиентский JavaScript и git.

## Переменные окружения (только сервер)

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
MLMA_WEBHOOK_SECRET=
MLMA_API_PUBLIC_URL=
```

Клиенту в HEAD Tilda можно отдать только публичный URL API:

```html
<script>window.MLMA_API_URL = "https://<worker-or-edge>/api";</script>
```

`SUPABASE_SERVICE_ROLE_KEY` и `MLMA_WEBHOOK_SECRET` на сайт не попадают.

## Шаги

1. Создать проект Supabase.
2. Выполнить `server/schema.sql`.
3. Собрать Worker/Edge из `server/payment-webhook.js` и `server/account-api.js`.
4. Задать секреты в окружении воркера, не в репозитории.
5. Проверить, что анонимный GET HTML Академии не содержит `service_role` и webhook secret.
6. После этого выставить `window.MLMA_API_URL`. До этого кабинет работает в `local_fallback`.

## Что умеет заглушка без Supabase

- Регистрация и вход — Tilda Members.
- Профиль, сохранённые треки, тестовые заказы — `localStorage` `mlma.account.v1`.
- Это запасной контур: при смене устройства данные профиля Академии не восстанавливаются, пока нет сервера.
- Сессия Tilda (email/имя) восстанавливается, если пользователь снова входит.

## Интерфейс репозитория

См. `tilda/src/storage.js`: `loadAccount`, `saveProfile`, `saveSavedTracks`, `saveEntitlements`, `saveOrder`, `savePayment`, `saveArtifact`, `saveRun`.
