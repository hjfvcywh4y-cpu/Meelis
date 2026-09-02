# Единственный промпт Cursor: установка A3-008

Работай в текущем проекте MLM Academy после принятой архитектуры full graph v3. Новый проект не создавай.

Установи текущий распакованный пакет как system action version `0.1.0` для ID `A3-008`.

Перед любыми изменениями полностью прочитай все файлы архива. Пакет является готовой продуктовой спецификацией: не превращай A3-008 в урок, не переписывай методику и не придумывай новые связи.

## Порядок

1. Прочитай `00_START_HERE.md`, `01_SYSTEM_ACTION_SPEC.md`, `02_ARCHITECTURE_BINDING.md` и все JSON-файлы.
2. Запусти `node tools/validate-package.mjs`. Затем проверь `package.json` текущей схемой `spec/track-architecture/track-package.schema.json`. Тип должен остаться `SYSTEM_ACTION`, format — `system-ui`.
3. Проверь product code `MLMA_FULL`. Если его нет, останови установку и отрази blocker; не выдумывай другой код.
4. Получи фактический `connectionIndex["A3-008"]` из full graph v3 и сравни с `graph/a3-008-connection-index-v3.json`. Ожидаются числа 6/6 входов, 2/6 выходов, 6 outgoing rules, 3 inbound system-action invocation rules, 0 external entry. При расхождении остановись и верни diff.
5. Зарегистрируй A3-008 как `SYSTEM_ACTION / SYSTEM_UI` в существующем Registry. Не создавай standalone learning page и не создавай A3-008 track instance.
6. Установи definition version `0.1.0` в `server/system-actions/a3-008/0.1.0/` или в уже существующий эквивалентный server-only слой. Не клади definition в public JSON.
7. Используй существующий `POST /api/v1/track-instances/:sourceInstanceId/outcomes`. Не создавай параллельный публичный Route API. Свяжи request/response с контрактами из `contracts/`.
8. Реализуй `OutcomeRecorderPanel` по `system-ui/ui-definition.json`: один вопрос, шесть исходов, условные поля, review/save. Никакой автоматической отправки сообщения или звонка.
9. Подключи входящие адаптеры RR2-014, RR2-017 и RR2-020 по `adapters/source-outcome-mappings.json`. Они открывают форму в контексте исходного instance и не предвыбирают исход.
10. Подключи шесть существующих правил RR2-026–RR2-031. Не добавляй новые RouteRule, не повышай их статус выше `PILOT_DRAFT_TO_TEST` до пилота.
11. Оставь TR-083→A3-013 и TR-084→A6-010 закрытыми слотами. Не показывай их как пользовательские кнопки.
12. Обеспечь atomic write и idempotency по `principal_id + source_instance_id + idempotency_key`. Коррекция — только append-only superseding event; после начала downstream instance вернуть 409 `OUTCOME_ALREADY_CONSUMED`.
13. Реализуй allowlist/strip policy из `privacy/privacy-contract.json`. Имя, телефон, email, текст сообщения/ответа, transcript, точные слова, адрес и данные рекомендации не должны попадать на сервер, в логи, аналитику или AI.
14. A3-008 не должна вызывать AI. Маршрутизация полностью детерминирована.
15. Реализуй sandbox по `sandbox/sandbox-contract.json`: no live instance, no outcome, no RouteDecision, no entitlement, no destination URL.
16. Пока `PAID_TRACK_NAVIGATION_ENABLED=false`, track destination остаётся locked и `destinationUrl=null`.
17. Добавь тесты всех 40 случаев из `tests/acceptance-cases.json` и сохрани существующие тесты зелёными.
18. Не включай оплату, paid navigation и регистрацию; не применяй production migration; не деплой.

## Архитектурные ожидания

- A3-008 — системная операция, не страница и не урок;
- RR2-026: MEETING_CONFIRMED → A3-010;
- RR2-027: LATER + разрешение + дата → A5-010;
- RR2-028: REFUSAL → A5-014;
- RR2-029: NO_REPLY → WAIT_UNTIL;
- RR2-030: REFERRAL_WITH_PERMISSION → A3-003;
- RR2-031: NO_NEXT_ACTION → DONE;
- исходный source instance и outcome history сохраняются;
- ни одна из 253 связей full graph v3 не переписывается.

## Верни отчёт

- куда установлена definition A3-008;
- доказательство, что A3-008 не стала track page/track instance;
- результаты package/schema/graph snapshot validation;
- фактические входящие adapters и исходящие RouteRule;
- результаты 40 acceptance cases и существующих test/typecheck команд;
- доказательство idempotency и atomic outcome+decision;
- доказательство отсутствия client-only полей в persistence, логах и аналитике;
- доказательство sandbox isolation;
- состояние product code `MLMA_FULL`;
- подтверждение отсутствия graph mutation, deploy, production migration, payment и paid-navigation activation.
