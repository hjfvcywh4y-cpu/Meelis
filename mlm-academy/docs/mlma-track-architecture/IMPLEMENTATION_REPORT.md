# Отчёт: маршрутная архитектура MLM Academy (корректировка полного графа v3)

Дата: 31 августа 2026  
Ветка: `cursor/track-architecture-954c`  
Статус итерации: архитектурная дельта закрыта, **без production-деплоя**, **без production-миграций**, **без включения оплаты и платной навигации**. Содержание A3-002 и других треков в этой итерации не изготавливалось.

## 1. Что изменилось относительно предыдущего отчёта (v2)

Предыдущий отчёт (`e24f2f9`, checkpoint `d458a28`) реализовал неполную модель:

| v2 (ошибочная трактовка) | v3 (актуальная) |
|---|---|
| 58 RouteRule исполняются | без изменений: engine читает только RouteRule |
| 231 legacy edge **только archive**, не в рабочем графе | 231 базовые связи **импортированы в рабочий `track_connections`** как возможные направления |
| не было rule-derived map | +22 rule-derived направления в том же `track_connections` |
| нет connectionIndex | connectionIndex на все 112 ID |
| in-memory как фактический runtime | in-memory только тесты/CLI; явный PostgreSQL adapter; production без него **fail closed** |
| нет модели PUBLIC_DEMO/SANDBOX | поля access_tier / execution_mode и контракт демо без live instance |

Источник истины: `spec/track-architecture/full-graph-112-v3.json` (импорт программно, JSON в контекст модели не загружался). Проверка: `node spec/track-architecture/tools/validate-graph.mjs` и `graph-query.mjs`.

## 2. 231 / 22 / 253 и разница connection vs RouteRule

**`track_connection` отвечает:** «куда этот узел в принципе связан?»  
**`route_rule` отвечает:** «при каком проверенном результате переход разрешено исполнить?»

Отсутствие RouteRule **не удаляет** направление. Оно остаётся слотом:

```
activation_mode=LOCKED_NEXT_ACTION_SLOT
executable=false
user_visible=false
```

Route Engine **не имеет права** исполнять закрытый slot. Кнопка пользователю не показывается. Админ/установщик видит слот (`GET /api/v1/admin/tracks/:id/connections`).

Контрольные числа после импорта v3:

```
nodes                              = 112
designConnections                  = 231
ruleDerivedConnections             = 22
effectiveTrackConnections          = 253
structuredRouteRules               = 58
connectionIndex entries            = 112
nodesWithoutEffectiveIncoming      = 36
brokenConnections                  = 0
```

Слои источника:

- 231 × `sourceLayer=BASE_DESIGN_GRAPH_V2`
- 22 × `sourceLayer=STRUCTURED_ROUTE_RULE_V2`

Исторический archive 231 сохранён отдельно (`statusV2=AUDIT_ONLY_NOT_EXECUTABLE`, `active=false`) **только для аудита**. Он не заменяет рабочий `track_connections`.

## 3. ROUTE_RULE и LOCKED_NEXT_ACTION_SLOT

Эффективные 253 связи:

| activationMode | count | executable | userVisible |
|---|---|---|---|
| `LOCKED_NEXT_ACTION_SLOT` | **216** | false | false |
| `ROUTE_RULE` | **37** | true (направление подтверждено правилом) | false до paid-nav flag |

Из 58 structured RouteRule: 37 ведут в Track ID (это и есть 37 ROUTE_RULE connections), 21 — в терминал/системное действие и поэтому не образуют track-to-track edge.

Контрольный пример: **A1-001 → A1-004** (`TR-001`) существует в `track_connections`, `LOCKED_NEXT_ACTION_SLOT`, engine возвращает `NO_MATCHING_RULE` и не подставляет `legacyNextIds`.

Связь с правилом получает `matchedRouteRuleIds` (например A2-008 → A3-002 / `TR-051` / `RR2-005`). Engine по-прежнему матчит **outcome + field + operator**, а не сам факт наличия connection.

## 4. connectionIndex: A2-008 и A3-002

Материализован для всех 112 ID.

**A2-008**

| поле | значение |
|---|---|
| incoming design / effective | 6 / 6 |
| outgoing design / effective | 2 / 6 |
| outgoingRouteRuleIds | RR2-005, RR2-006, RR2-007, RR2-008, RR2-009, RR2-010, RR2-011 |
| incomingRouteRuleIds | RR2-001, RR2-003 |
| externalEntryRuleIds | ER-001 |

Исходящие design: A3-002, A3-003. Добавленные rule-derived: A2-013, A3-005, A3-016, A2-010.

**A3-002**

| поле | значение |
|---|---|
| incoming design / effective | 5 / 6 |
| outgoing design / effective | 2 / 3 |
| outgoingRouteRuleIds | RR2-014, RR2-015, RR2-016 |
| incomingRouteRuleIds | RR2-005, RR2-012 |
| externalEntryRuleIds | ER-003 |

## 5. Модель PUBLIC_METADATA / PUBLIC_DEMO / PAID

Раздельные поля (не путать с правом пользователя `NONE | TRIAL | FULL | ADMIN`):

```
content_status  = EMPTY | DRAFT | REVIEW | READY | PUBLISHED | ARCHIVED
access_tier     = PUBLIC_METADATA | PUBLIC_DEMO | PAID | ADMIN_ONLY
route_status    = LOCKED | TEST | ACTIVE | RETIRED
execution_mode  = PREVIEW | SANDBOX | LIVE
```

Правила access layer:

- **PUBLIC_METADATA** — только название, краткое описание, ситуация, ожидаемый результат (`GET .../meta`). Тело урока не выдаётся.
- **PUBLIC_DEMO + SANDBOX** — специально опубликованный обезличенный пример. **Не** создаёт live instance, **не** меняет маршрут, **не** исполняет переход (`SANDBOX_NO_LIVE_INSTANCE`).
- **PAID** — тело только при verified server identity AND entitlement AND product grant AND `content_status=PUBLISHED` AND feature flags. Query / localStorage / success URL / email / Member ID / Tilda group / рекомендация AI **не** являются правом.
- Оплата **не** открывает `DRAFT` / `REVIEW` / `READY`.
- Содержание демо-пакета в этой итерации **не создавалось** — только модель, API-контракт (`kind`, `sandbox`, `liveInstance`) и тесты.

Пакет трека обязан нести `graphBinding`:

```
mode=AUTO_BY_TRACK_ID
graphVersion=3.0
editNeighborPages=false
unboundConnectionPolicy=KEEP_AS_LOCKED_NEXT_ACTION_SLOT
```

Установка пакета не переписывает `track_connections` и не меняет страницы соседей.

## 6. Состояние PostgreSQL adapter

- Интерфейс: `ArchitectureStore` (`src/track-architecture/store.ts`).
- In-memory / `.local/track-architecture/store.json` — **только тесты и CLI**.
- Adapter: `PostgresArchitectureStore` + `PostgresClient` (`src/track-architecture/postgres.ts`). Живой `pg` к production **не подключался**.
- Локальная миграция (файл, не применялась): `server/migrations/005_track_connections.sql` — `track_connections`, `connection_index_entries`, поля access/status, payload overlay.
- `NODE_ENV=production` без настроенного production repository → **503 `STORAGE_UNCONFIGURED`**, без тихого fallback на memory. `MLMA_ARCHITECTURE_STORE=memory` в production запрещён.

## 7. Статус A6-017

ID **сохранён** в registry 112. Новый canonical ID не выдумывался, 112 ID не перенумеровывались.

- `entityType=ALIAS`, `canonicalId=A6-017` (self-alias)
- `dataQuality=DATA_BLOCKED`
- resolver: `CANONICAL_MISSING`, `canonicalId=null` — самоссылка **не** успешный alias
- Route Engine: `NO_SUCH_TRACK` / `DATA_BLOCKED`, не исполняется
- связи A6-017 остаются LOCKED слотами в карте
- импорт пишет warning в issues; `checkTrack('A6-017').ok === false`

A1-005 → A6-017 также `DATA_BLOCKED` (канон не существует).

## 8. Что намеренно не отменялось

- server-only content
- fail-closed entitlement AND
- запрет выдачи прав из query / localStorage / success page / email / Member ID / Tilda group
- `stripUnsafeFacts` для контактных данных A2-008
- поиск только по кнопке «Найти решение» или Enter
- production clamp опасных flags (`PAYMENTS_ENABLED`, `PAID_TRACK_NAVIGATION_ENABLED`, `ALLOW_DRAFT_RULES`, `ENTITLEMENT_BYPASS`)
- игнор `x-mlma-test-session` в production
- канонический `trackUrl(id)` → `/track?id=<lowercase>`
- отсутствие production-деплоя и production-миграций

## 9. Команды и результаты тестов

Из каталога `mlm-academy`:

```bash
node spec/track-architecture/tools/validate-graph.mjs
node spec/track-architecture/tools/graph-query.mjs summary
node spec/track-architecture/tools/graph-query.mjs track A2-008
pnpm tracks:validate spec/track-architecture/full-graph-112-v3.json
pnpm tracks:validate spec/track-architecture/MLM_Academy_Track_Router_v2.json
pnpm tracks:import --dry-run tests/fixtures/track-packages/a3-002-test/package.json
pnpm track:check A2-008
pnpm test
pnpm tilda:test
pnpm typecheck
```

Результаты этой итерации:

- `validate-graph.mjs` — GRAPH VALIDATION PASSED (112 / 231 / 22 / 253 / 58 / 112 / 36 / broken=0)
- `tracks:validate` v3 — ok, 216 LOCKED_NEXT_ACTION_SLOT + 37 ROUTE_RULE connections
- `tracks:validate` router v2 — ok, 112 / 58 / 231 archive (совместимость сохранена)
- `track:check A2-008` — TRACK, 7 rules, connectionIndex 6/2/6/6, 0 executable archive
- `pnpm test` — 87 passed
- `pnpm tilda:test` — 225 passed
- `pnpm typecheck` — clean

`--apply` пишет только `.local/` (gitignore). Это не production.

## 10. Подтверждение границ этой итерации

- Production Worker / Next **не деплоился**.
- SQL 004/005 **не применялись** к production.
- `PAYMENTS_ENABLED=false`, `PAID_TRACK_NAVIGATION_ENABLED=false`.
- YuKassa не подключалась.
- Учебное содержание A3-002 и остальных треков **не изготавливалось**.

Следующий шаг (отдельная итерация): установка готового трека по `02_CURSOR_PROMPT_INSTALL_TRACK.md` после закрытия этой архитектурной дельты.
