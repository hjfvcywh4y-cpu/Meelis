# Отчёт: маршрутная архитектура MLM Academy v2

Дата: 31 августа 2026  
Ветка: `cursor/track-architecture-954c`  
Статус итерации: архитектура в кодовой базе, **без production-деплоя**, **без включения оплаты и платной навигации**.

## 1. Архитектура до / после

### До

Живой сайт: Tilda + Cloudflare Worker `mlma-account`. Каталог 112 карточек в `src/data/tracks.catalog.json` / Tilda compact JSON. Переходы — поле `nextTrackIds` (legacy) и хардкод в A2-008. Next.js-оболочка с `/track/<id>`. Права: KV-аккаунт, Tilda Members bind (`tilda_unverified`), клиентские `grantFromQuery` / `grantFromLocalStorage` уже возвращают пусто. Платежи выключены. Отдельного Route Engine, registry entity types и server-only content layer не было.

### После

Пять слоёв в текущем стеке (TypeScript + Zod + in-memory store, SQL как контракт):

| Слой | Где | Что хранит |
|---|---|---|
| Registry | `track_definitions` / `MemoryArchitectureStore` | 112 стабильных A-ID, тип, canonical, метаданные |
| Content | `track_content_versions` + `server/content/tracks/` | Версии содержания; не часть обязательной записи registry |
| Routing | `route_rules` + `decideRoute()` | 58 RouteRule v2; legacy 231 только в archive |
| Runtime | instances / outcomes / decisions | Прохождение ≠ шаблон трека |
| Access | flags + entitlements + IdentityProvider | Server session + entitlement AND; клиент не источник права |

Канонический URL спецификации: `trackUrl(id)` → `/track?id=<lowercase>`. Pretty `/track/<id>` сохранён как alias Next.js / dedicated Tilda pages. Парсер принимает оба.

A2-008 — первый тестовый узел, не корень графа. Entry rules и правила других ID существуют независимо.

## 2. Изменённые и добавленные файлы

Ключевые добавления:

- `spec/track-architecture/*` — router v2 JSON, schema пакета, access-policy, SQL-референс
- `src/track-architecture/*` — registry, resolver, evaluator, engine, access, importer, HTTP, CLI
- `src/app/api/v1/[...mlma]/route.ts` — API contract
- `server/migrations/004_track_architecture.sql` — локальная миграция, не production
- `server/content/tracks/a3-002/0.1.0/content.json` — server-only fixture
- `tests/track-architecture/architecture.test.ts`
- `docs/mlma-track-architecture/*` — исходные промпты, аудит, этот отчёт

Точечные правки существующего стека (без смены текстов витрины и содержания A2-008):

- `src/domain/routes.ts` — `trackUrl`, `parseTrackIdFromLocation`
- `src/server/flags.ts` — флаги архитектуры
- `tilda/src/domain.js`, `tilda/src/commerce.js`, `tilda/src/data/products.catalog.json`
- `tilda/generate.mjs` — запрет утечки `PILOT_DRAFT_TO_TEST` / fixture secret в public JSON
- `.env.example`, `package.json`, `.gitignore`, `next.config.ts`

## 3. Миграции и локальный запуск

Файл: `server/migrations/004_track_architecture.sql`.

**Не применялась к production.** Primary production storage задуман через `DATABASE_URL` (PostgreSQL-совместимый). Текущий runtime тестов и CLI — in-memory / `.local/track-architecture/store.json`.

Локально, когда появится Postgres:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f server/migrations/004_track_architecture.sql
```

KV не является хранилищем entitlements этой архитектуры.

## 4. Env / feature flags (без секретов)

Defaults (и production clamp):

```
TRACK_REGISTRY_ENABLED=true
ROUTE_ENGINE_ENABLED=true
PAID_TRACK_NAVIGATION_ENABLED=false
PAYMENTS_ENABLED=false
ALLOW_DRAFT_RULES=false
ADMIN_PREVIEW_ENABLED=true
ENTITLEMENT_BYPASS=false
```

В `NODE_ENV=production` код принудительно держит `PAYMENTS_ENABLED`, `PAID_TRACK_NAVIGATION_ENABLED`, `ALLOW_DRAFT_RULES`, `ENTITLEMENT_BYPASS` равными `false`. Test header `x-mlma-test-session` в production игнорируется.

`ENTITLEMENT_BYPASS` даже при `true` в non-prod **не открывает контент** (`decideContentAccess` отклоняет bypass).

## 5. Команды validate / import / test

Из каталога `mlm-academy`:

```bash
pnpm tracks:validate spec/track-architecture/MLM_Academy_Track_Router_v2.json
pnpm tracks:import --dry-run tests/fixtures/track-packages/a3-002-test/package.json
pnpm tracks:import --apply tests/fixtures/track-packages/a3-002-test/package.json
pnpm track:check A2-008
pnpm test
pnpm tilda:test
pnpm typecheck
```

`--apply` пишет только `.local/` (gitignore). Это не production.

## 6. Загруженные 112 ID и 58 rules

Импорт `MLM_Academy_Track_Router_v2.json`:

- 112 уникальных A-ID
- типы: 49 TRACK, 2 CONDITIONAL_TRACK, 17 REMEDIATION, 9 GATE, 19 EMBEDDED_TOOL, 8 SYSTEM_ACTION, 8 ALIAS
- 58 RouteRule v2 (7 `VALIDATED_RULE`, 51 `PILOT_DRAFT_TO_TEST`)
- 9 entry rules
- 231 archive edge со `statusV2=ARCHIVED_NOT_EXECUTABLE`, `active=false`

Предупреждения данных (не блокируют импорт): alias `A6-017` указывает сам на себя, `A1-005` → `A6-017` не имеет не-alias канона. Resolver возвращает `CANONICAL_MISSING` / не создаёт урок.

## 7. Доказательство: legacy 231 не исполняются

- Archive хранится отдельно (`listArchiveEdges`), engine читает только `listRules()`.
- Тест: исход A1-001 + любой outcome → `NO_MATCHING_RULE`, destination не берётся из `legacyNextIds` (там есть A1-004).
- `checkTrack('A2-008')`: `archivedEdgesExecutable = 0`.

## 8. Доказательство: paid content без entitlement недоступен

- `GET /api/v1/tracks/a3-002/content` без сессии → 403, тело без секрета фикстуры.
- `maId` / email / groups FULL без `verified` → 403 (IdentityProvider игнорирует клиентский bind).
- Query/localStorage/success page: `identityFromUntrustedClient` → ANON.
- Entitled + published content → `decideContentAccess.allowed === true` только на серверном контексте.
- `PAID_TRACK_NAVIGATION_ENABLED=false` → RouteDecision `locked: true`, `lockReason: FEATURE_DISABLED`, `destinationUrl: null`.
- Admin preview (`role=ADMIN`, verified) видит content; обычный FULL без entitlement — нет.
- Фикстура `MLMA_SERVER_ONLY_A3_002_FIXTURE` есть только в `server/content/...`; generate падает, если она попадёт в public JSON.

## 9. Что намеренно выключено

- Оплата и YuKassa (`PAYMENTS_ENABLED=false`; webhook stub → `payments_disabled`)
- Платная маршрутная навигация (кнопка перехода для обычного пользователя не работает)
- Регистрация (`SIGNUP_ENABLED=false`, без изменений этой итерации)
- Production deploy Worker / Next
- Массовая генерация 112 HTML-страниц и выдуманный учебный контент
- Исполнение `PILOT_DRAFT_TO_TEST` в `mode=production`
- Перенос 231 legacy edge в engine
- Отправка ФИО/телефона/email/текста переписки A2-008 на сервер (`stripUnsafeFacts`)

Содержание A2-008, поиск (только кнопка «Найти решение» / Enter), юридические тексты и визуал витрины не переписывались.

## 10. Как добавить следующий готовый трек

1. Найти ID в registry: `pnpm track:check A3-002`.
2. Собрать пакет по `spec/track-architecture/track-package.schema.json` (шаблон рядом).
3. Полный контент положить в `server/content/tracks/<id>/<version>/` (`serverOnly: true`).
4. `pnpm tracks:validate <package.json>` и `pnpm tracks:import --dry-run <package.json>`.
5. `--apply` только в локальный/тестовый store. Не активировать draft rules в production.
6. Не хардкодить кнопки перехода в HTML; outcomes идут в `POST /api/v1/track-instances/:id/outcomes`.
7. Пока платежи и `PAID_TRACK_NAVIGATION_ENABLED` выключены, пользователь получает locked decision.
8. Повторяемый промпт: `docs/mlma-track-architecture/02_CURSOR_PROMPT_INSTALL_TRACK.md`.

Независимый аудит реализации: `docs/mlma-track-architecture/03_CURSOR_PROMPT_AUDIT.md`.

## Проверки, которые прогнаны

- `pnpm test` — 77 passed
- `pnpm tilda:test` — 225 passed
- `pnpm typecheck` — clean
- `pnpm tracks:validate spec/track-architecture/MLM_Academy_Track_Router_v2.json` — ok, 112 / 58 / 231
- `pnpm track:check A2-008` — TRACK, 7 v2 rules, 0 executable legacy

Известные ограничения: Tilda Members по-прежнему `tilda_unverified`; живой A2-008 остаётся клиентским модулем до отдельной установки контент-пакета; alias A6-017 в исходных данных v2 битый (self-alias) и сознательно не «лечится» перенумерацией ID.
