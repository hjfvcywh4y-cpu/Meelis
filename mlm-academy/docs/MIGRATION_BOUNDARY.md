# Граница миграции · MLM Academy

Этот документ фиксирует, что остаётся в Tilda-MVP и что переедет позже.
Он не разрешает перенос на Next.js сейчас.

## Сейчас (Tilda-MVP)

| Слой | Роль | Что хранит | Чего не делает |
|---|---|---|---|
| Tilda | Публичная витрина и UI | HTML-страницы, Members login | Не ядро доступа после будущего переноса |
| Tilda Members | Временный вход только для FREE | `ma_id`, email, cookies, `window.mauser` | Не доказывает личность, не выдаёт START/FULL/PILOT/ADMIN |
| Cloudflare Worker `mlma-account` | Временный Account API | HMAC cookie `mlma_sid`, маршрут, мета прохождения | Не принимает артефакты, не выдаёт entitlements |
| Cloudflare KV `MLMA_ACCOUNT` | Временное хранение | Неплатный маршрут, профиль, мета run | Не источник платного права |
| `src/data/tracks.catalog.json` | Единый каталог треков | 112 стабильных Track ID | Не копировать по страницам |
| `tilda/src/data/products.catalog.json` | Справочник продуктов | Коды B2C/B2B, цены, gate | Не смешивать с Track ID |
| PostgreSQL/Supabase schema | Контракт будущей БД | Пользователи, прогресс, заказы, права | Не подключена |
| ЮKassa webhook | Будущее основание платного права | — | Выключен |
| Next.js `src/app/*` | Заготовка кабинета | Код в репозитории | Не прод |

Флаги: `PAYMENTS_ENABLED=false`, `COMMERCE_PREVIEW_ENABLED=false`, `TEST_MODE=true`.

## Не называть защищённой идентификацией

`ma_id`, email, cookies, `window.mauser`, DOM и `localStorage` **не** доказывают личность.
Текущий bind создаёт уровень `tilda_unverified`. Bind **никогда** не повышает до `verified`.

`tilda_unverified` можно использовать только для:

- бесплатного маршрута (Track ID);
- неплатных настроек интерфейса;
- метаданных прохождения без текста артефакта.

`orders`, `payments`, `refunds`, `subscriptions`, `entitlements`, платное содержание и ADMIN требуют только `verified`.

## Целевая следующая архитектура (не сейчас)

- `mlmacademy.ru` — Tilda, публичная витрина
- `app.mlmacademy.ru` — Next.js-кабинет
- Supabase Auth — подтверждённая личность (`verified`)
- PostgreSQL — пользователи, маршруты, результаты, продукты, платежи, права
- ЮKassa — оплата и webhook
- Tilda Members после переноса больше не ядро доступа

## Что нельзя потерять при будущем переносе

Track ID, каталог 112, маршруты, локальные результаты, пользователей и платёжную историю (когда она появится).

## Rollback assets

Живые страницы Tilda остаются на блоках T123, пока владелец не переключит одну тестовую страницу на `tilda/dist/t123/external-loader-v1.html`.
Откат: вернуть предыдущие блоки `01-css` / `02-data-*` / `03-domain-*` / `04-ui-*`.
Нельзя публиковать смешанные несовместимые версии каталога.
