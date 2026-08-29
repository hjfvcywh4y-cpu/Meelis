# Перенос в Next.js + Supabase · не выполнять сейчас

Живой продукт остаётся в Tilda. Этот файл — карта переноса без запуска миграции.

Целевое разделение:

- `mlmacademy.ru` — Tilda, публичная витрина
- `app.mlmacademy.ru` — Next.js-кабинет
- Supabase Auth — `verified`
- PostgreSQL — пользователи, маршруты, результаты, продукты, платежи, права
- ЮKassa webhook — единственное основание платного права
- Tilda Members после переноса не ядро доступа

## Что можно переиспользовать

Из Tilda JS (`tilda/src/`):

- `domain.js` — Track ID, маршруты URL, профиль, секции
- `search.js` — поисковый движок (не менять логику без отдельной задачи)
- `access.js` — матрица прав, `identityLevel`
- `ontology.js` — runtime и паспорт трека
- `analytics.js` — канонические имена
- `mlma.css` — визуальная система кабинета, не пересобирать без нужды

Из уже лежащего Next.js (`src/`):

- `src/domain/*` — типы, sanitizer, validation, Track ID
- `src/components/catalog/*`, `src/components/my/*`, `src/components/track/*`
- `src/app/library`, `src/app/my`, `src/app/track/[trackId]`
- `src/data/tracks.catalog.json` — тот же каталог 112

Не переносить: inline T123, Members cookies как auth, клиентский checkout.

## Каталог в PostgreSQL

1. Источник: `src/data/tracks.catalog.json` + `catalog.schema.json`.
2. Импорт в таблицу `tracks` с первичным ключом `track_id`.
3. Track ID не регенерировать и не переименовывать.
4. Публичная витрина Tilda продолжает читать тот же набор ID.
5. Перед публикацией: ровно 112 уникальных ID, счётчики A1=16 … A6=32.

## Экспорт маршрутов из KV

Формат без секретов:

```json
{
  "format": "mlma.kv-route-export.v1",
  "exportedAt": "ISO-8601",
  "users": [
    {
      "legacyKey": "ma:123",
      "tilda_member_id": "123",
      "email_normalized": "user@example.com",
      "identity_level": "tilda_unverified",
      "savedTrackIds": ["A3-002"],
      "runs": { "A3-002": { "status": "complete", "step": "feedback", "trackVersion": "0.2" } }
    }
  ]
}
```

Не включать session secret, service role, ключи ЮKassa, тексты артефактов.

Команда экспорта появится отдельной задачей. Сейчас KV читается только Worker'ом.

## Связка Tilda-пользователя с `user_uuid`

1. Создать `users` строку с `identity_level = tilda_unverified`, `tilda_member_id`, `email_normalized`.
2. Не ставить `verified` автоматически.
3. Совпадения email: не сливать молча. Показать «этот email уже есть» и требовать magic link.
4. Пользователь подтверждает новый вход magic link Supabase.
5. Только после подтверждения: `identity_level = verified`, `auth_user_id = auth.uid()`.
6. Маршрут из KV копируется в `user_routes` / `saved_tracks`.
7. Локальные результаты: клиент предлагает импорт `mlma.runtime.v1` после входа. Не удалять localStorage до подтверждённого серверного сохранения.

## Переключение доменов

1. Оставить Tilda на `mlmacademy.ru` как витрину (`/`, `/academy`, `/library`, SEO).
2. Кабинетные URL `/my`, `/profile`, `/access` сначала редиректят на `app.mlmacademy.ru` (после готовности Auth).
3. Tilda Members отключить, когда magic link работает и rollback проверен.
4. DNS rollback: снять редирект кабинета, вернуть Members-gated страницы Tilda.
5. Каталог и Track ID не зависят от домена кабинета.

## Безопасный экспортный пакет

Без секретов, с версией схемы:

- `users.json` — uuid, identity_level, tilda_member_id, email_normalized, display_name, timestamps, source
- `routes.json` — user_uuid, track_id, position, status, catalog_version
- `runs.json` — мета прохождения, без content
- `results.json` — только после согласия и verified; иначе локальный экспорт устройства
- `catalog.json` — 112 публичных карточек
- `products.json` / `entitlements.json` / `payments.json` — когда появятся

## Что придётся пересобрать

- Auth (вместо Members bind)
- Платежный контур на webhook
- Серверное хранение артефактов
- RLS-политики на живой базе
- Редиректы кабинета и отключение Members
