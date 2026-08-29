# Контракт данных · MLM Academy

Единые поля для Tilda-MVP, Cloudflare Worker/KV и будущего PostgreSQL.
Клиент не является источником истины для цены, пакета и права.

## Пользователь

| Поле | Сейчас | Потом |
|---|---|---|
| `user_uuid` | нет (KV ключ `ma:` / `em:`) | `users.id` |
| `identity_level` | `guest` \| `tilda_unverified` | + `verified` |
| `tilda_member_id` | `maId` из Members | колонка `tilda_member_id` |
| `email_normalized` | lower(email) | unique |
| `display_name` | профиль | `users.display_name` |
| `created_at` / `updated_at` | KV | timestamptz |
| `source` | `tilda_members` / `local` | `tilda_members` \| `supabase` \| `migration` |

Разрешённые уровни: `guest`, `tilda_unverified`, `verified`.

Правило: bind Tilda Members **никогда** не повышает до `verified`.
`/api/session/verified` сейчас отвечает `501`.

## Маршрут

| Поле | Смысл |
|---|---|
| `route_id` | будущий UUID; сейчас массив Track ID пользователя |
| `user_uuid` или временная Tilda identity | KV userKey |
| `track_id` | стабильный ID вида `A3-002` |
| `position` | порядок в массиве |
| `status` | saved / removed |
| `created_at` / `updated_at` | |
| `source` | `local` \| `pending` \| `kv` \| `migration` |
| `catalog_version` | версия каталога, с которой сохранён ID |

Хранение сейчас: KV для вошедшего FREE; `localStorage` `mlma.pendingTracks.v1` для гостя.
Гостевой pending — массив `{ trackId, createdAt, expiresAt }`, TTL 14 дней, без дублей, проверка по каталогу.

## Прохождение

| Поле | Смысл |
|---|---|
| `run_id` | локальный ключ = Track ID; позже UUID |
| `user_uuid` | только после verified |
| `track_id` | |
| `track_version` | версия каталога/трека |
| `status` | preview / active / retry / complete |
| `current_step` | preview / action / feedback |
| `started_at` / `completed_at` / `updated_at` | |

На сервер (если есть сессия) уходит **только мета**. Текст артефакта — нет, пока нет `verified`, политики и согласия.

## Результат

| Поле | Смысл |
|---|---|
| `artifact_id` | локальный |
| `run_id` | |
| `type` | artifact kind |
| `content` | только на устройстве |
| `verification_status` | см. ниже |
| `created_at` / `updated_at` | |

Локальная эвристика **не** является доказательством выполнения.
Формулировка в UI: **«Самопроверка по критериям»**.

Статусы результата: `draft`, `self_checked`, `submitted`, `reviewed`, `rejected`.
Сейчас выставляется `self_checked`. `submitted` появится после verified.

Честный статус в `/my/results`:

- «Сохранено на этом устройстве»
- «Синхронизация между устройствами пока недоступна»

Межустройственные результаты требуют Supabase Auth.

## Платежи и права (выключены)

Цена и состав продукта — только сервер. Клиент не может достоверно сказать «открой FULL».
`entitlement` создаётся только для `verified user_uuid`.
Источник права: `payment` \| `promo` \| `manual` \| `admin` \| `migration`.
Есть начало и окончание доступа. Возврат отзывает или пересчитывает право.
Повтор webhook с тем же `provider_event_id` не создаёт вторую оплату и второе право.
RLS запрещает читать чужие заказы, платежи и права.

Маршруты (заглушки, 403 пока `PAYMENTS_ENABLED=false`):

- `POST /api/checkout/create`
- `POST /api/webhooks/yookassa`
- `GET /api/me/entitlements`
- `POST /api/refunds/process` — только административный серверный контур

Рекуррентная подписка не реализуется. Состояния описаны в `subscription_events`.
