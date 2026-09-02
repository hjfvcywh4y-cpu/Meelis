# A3-014 · Cursor-ready пакет

Это полный пакет трека **A3-014 «Снизить тревогу перед разговором»** для установки в уже существующий проект MLM Academy.

## Что здесь готово

- продуктовая конструкция и девять шагов remediation-сценария;
- точная привязка к full graph v3;
- вход из A3-002 по RR2-016;
- два существующих locked-направления: A3-013 и A6-020;
- пять draft RouteRule overlay: RETURN_TO_ROUTE, A3-013, A6-020, WAIT_UNTIL и EXPERT;
- server-only контент, локальная карточка готовности, privacy и analytics contracts;
- optional AI-зеркало без диагностики и без права маршрутизации;
- PUBLIC_METADATA, безопасное демо SANDBOX, 52 acceptance checks и 14 route fixtures.

## Единственная команда для Cursor

> Прочитай полностью все файлы ZIP, затем выполни CURSOR_INSTALL_PROMPT.md в текущем проекте MLM Academy. Не создавай новый проект, не деплой production, не применяй production-миграции, не включай оплату и PAID_TRACK_NAVIGATION.

Перед началом Cursor должен выполнить локально:

`node tools/validate-package.mjs`

Ожидаемый результат: `A3-014 PACKAGE VALID`.

Следующий пакет по производственной очереди после A3-014: **A3-005**. Это не означает автоматический пользовательский переход A3-014→A3-005.
