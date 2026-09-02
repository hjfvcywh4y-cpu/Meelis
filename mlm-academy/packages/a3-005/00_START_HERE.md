# A3-005 · Cursor-ready пакет

Полный install package трека **A3-005 «Назначить время и формат разговора»** для существующего проекта MLM Academy.

## Внутри

- девять шагов от consent gate до точной карточки встречи;
- graph snapshot v3: 2/3 входа и 2/4 выхода;
- вход RR2-008 из A2-008;
- три существующих RouteRule: A3-010, WAIT_UNTIL, A5-014;
- терминальный DONE overlay при отсутствии разрешённого follow-up;
- локальные детали + минимальные серверные данные встречи;
- optional AI-редактор без права подтверждать, бронировать или отправлять;
- PUBLIC_METADATA, безопасное SANDBOX demo, 55 acceptance checks и 14 route fixtures.

## Команда Cursor

> Прочитай полностью все файлы ZIP, затем выполни CURSOR_INSTALL_PROMPT.md в текущем проекте MLM Academy. Не создавай новый проект, не деплой production, не применяй production-миграции, не включай оплату и PAID_TRACK_NAVIGATION.

Сначала выполнить: `node tools/validate-package.mjs`.

Следующий по производственной очереди: **A5-010**. Это порядок изготовления, не автоматическая стрелка A3-005→A5-010.
