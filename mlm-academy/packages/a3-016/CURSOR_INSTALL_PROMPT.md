# Единственный промпт Cursor: установка A3-016

Работай в текущем проекте MLM Academy с уже принятой full graph v3. Новый проект не создавай.

Установи распакованный пакет как content version `0.1.0` для remediation ID `A3-016`.

Перед изменениями полностью прочитай каждый файл архива. Не упрощай трек до текстовой страницы и не превращай AI в генератор предлогов.

## Порядок работы

1. Запусти `node tools/validate-package.mjs` и текущий валидатор `spec/track-architecture/track-package.schema.json`.
2. Проверь product code `MLMA_FULL`. Если его нет, остановись и верни blocker; не подменяй код.
3. Сравни фактический `connectionIndex["A3-016"]` с `graph/a3-016-connection-index-v3.json`. Ожидаются 4/5 входов, 2/3 выходов, 2 incoming rules, 2 base outgoing rules, 0 external entry. При diff остановись.
4. Зарегистрируй server-only content в `server/content/tracks/a3-016/0.1.0/` или существующем эквивалентном слое. Статус — REVIEW.
5. Реализуй flow и локальную карточку из `content/content.json` и `contracts/reason-card.schema.json`.
6. Не отправляй сообщение из A3-016. При REASON_FOUND передай карточку локально в A3-002, а серверу — только минимальный outcome.
7. Подключи RR2-012 и RR2-013 без изменения их статуса `PILOT_DRAFT_TO_TEST`.
8. Добавь терминальный overlay RR3-A3-016-STOP. Он не создаёт track_connection и не изменяет full graph v3.
9. Оставь TR-099→A4-001 и TR-100→A3-017 закрытыми. Не делай из них кнопки.
10. Встрой A6-027 как необязательный компонент внутри A3-016. Не создавай для A6-027 отдельную страницу.
11. Реализуй ручной deterministic gate. REASON_FOUND возможен только при всех восьми подтверждённых проверках.
12. Реализуй AI строго по `ai/reason-critic-contract.json`. Добавь flag `AI_REASON_CRITIC_ENABLED=false`; не включай его в production.
13. Default AI mode принимает только structured codes. Sanitized text review требует отдельного согласия и preview; данные transient, без persistence/log/analytics/training.
14. AI не может придумывать факты, подтверждать real_reason, выполнять RouteRule или отправлять сообщение.
15. Выполни privacy allowlist. Любой client-only текст должен быть удалён до server persistence, logs, traces и analytics.
16. Public metadata отдели от body. Sandbox использует только фиксированные синтетические примеры, без live AI и live instance.
17. AI entry dataset используется только для ранжирования metadata. Он не создаёт external entry rule или live instance.
18. Добавь 48 acceptance cases и 12 route fixtures; запусти все существующие tests/typecheck.
19. Не включай оплату, paid navigation и регистрацию; не применяй production migration; не деплой.

## Обязательные исходы

- REASON_FOUND → RR2-012 → A3-002;
- NO_REASON → RR2-013 → WAIT_UNTIL;
- CONTACT_STOPPED → RR3-A3-016-STOP → DONE.

## Верни отчёт

- путь установки и schema validation;
- exact diff graph snapshot;
- доказательство, что закрытые slots не активированы;
- реализация embedded A6-027;
- реализация manual gate и трёх исходов;
- AI flag, два режима, redaction и доказательство advisory-only;
- доказательство отсутствия PII/free text в server, logs, traces и analytics;
- sandbox/search isolation;
- результаты 48 acceptance cases, 12 fixtures и существующих тестов;
- состояние MLMA_FULL;
- подтверждение отсутствия deploy, production migration, payment и paid-navigation activation.
