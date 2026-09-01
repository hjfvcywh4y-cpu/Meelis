# Единственный промпт Cursor: установка A3-002

Работай в текущем проекте MLM Academy после успешной независимой приёмки full graph v3. Новый проект не создавай.

Установи текущий распакованный пакет как content version `0.1.0` для Track ID `A3-002`.

Перед любыми изменениями полностью прочитай все файлы архива, включая `02_ARCHITECTURE_BINDING.md` и `graph/a3-002-connection-index-v3.json`. Архив является готовым продуктовым пакетом: не переписывай его методику и не придумывай новые связи.

Порядок:

1. Прочитай `00_START_HERE.md`, `01_PRODUCT_SPEC.md`, `package.json` и машинные файлы комплекта.
2. Проверь `package.json` текущей схемой `spec/track-architecture/track-package.schema.json`.
3. Проверь, существует ли product code `MLMA_FULL`. Если нет - остановись и отрази blocker; не подменяй его догадкой.
4. Получи `connectionIndex["A3-002"]` из full graph v3 и сравни его с `graph/a3-002-connection-index-v3.json`. Ожидается 6 effective incoming, 3 effective outgoing, 3 outgoing RouteRule, 2 incoming RouteRule и внешний вход `ER-003`. При расхождении остановись и верни diff; не исправляй граф догадкой.
5. Зарегистрируй содержание в `server/content/tracks/a3-002/0.1.0/` как server-only.
6. Не меняй соседние страницы и не переписывай `track_connections`.
7. Свяжи RR2-014, RR2-015 и RR2-016 с outcomes пакета. Не повышай их до `VALIDATED_RULE` до полевого пилота.
8. Добавь terminal rule `RR3-A3-002-STOP`; он не создаёт новую track-to-track connection и до пилота имеет статус `PILOT_DRAFT_TO_TEST`.
9. Реализуй локальное хранение `message_draft`, `real_reason_text` и данных контакта. Не отправляй их на сервер, в аналитику, логи или AI API.
10. Реализуй публичную metadata-карточку отдельно от paid content.
11. Реализуй sandbox-демо по `demo/demo-sandbox.json`: без live instance, outcome и RouteDecision.
12. Поиск должен по-прежнему запускаться только кнопкой или Enter.
13. Не включай оплату и платную навигацию, не применяй production-миграции и не деплой.
14. Запусти существующие тесты и добавь проверки из `tests/acceptance-cases.json`.

Архитектурные ожидания:

- вход по `RR2-005`: `A2-008 → A3-002`;
- возврат по `RR2-012`: `A3-016 → A3-002`;
- `MESSAGE_SENT` по `RR2-014` → системное действие `A3-008`;
- `MESSAGE_NOT_SENT_NO_REASON` по `RR2-015` → `A3-016`;
- `MESSAGE_NOT_SENT_ANXIETY` по `RR2-016` → `A3-014`;
- `MESSAGE_STOPPED` по `RR3-A3-002-STOP` → `DONE`;
- входы из `A2-003`, `A2-005`, `A2-011`, `A3-001` остаются закрытыми слотами, пока для них нет проверенного RouteRule.

Важно:

- статус содержания после установки - `REVIEW`, не `PUBLISHED`;
- `PAID_TRACK_NAVIGATION_ENABLED=false`;
- route buttons обычному пользователю пока закрыты;
- тексты примеров являются содержанием трека, но не должны попадать в public metadata bundle;
- автоматическая отправка сообщения запрещена.

Верни отчёт:

- куда установлен контент;
- результат schema validation;
- фактические входы/выходы A3-002;
- результат всех acceptance cases;
- доказательство отсутствия client-only полей на сервере и в аналитике;
- доказательство sandbox isolation;
- product code blocker, если он есть;
- diff контрольного снимка графа и фактического `connectionIndex["A3-002"]`;
- подтверждение отсутствия deploy, production migration и включения оплаты.
