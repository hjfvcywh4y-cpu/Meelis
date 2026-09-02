# Cursor prompt · установить A3-014

Ты работаешь в существующем репозитории MLM Academy. Этот ZIP — канонический install package трека A3-014. Прочитай **все файлы пакета полностью** до изменения кода.

## Цель

Установить A3-014 в текущий стек и существующую track architecture v3 как server-only REMEDIATION content package. Не создавать новый проект и не переписывать архитектуру.

## Обязательный порядок

1. Запусти `node tools/validate-package.mjs` из распакованной папки. При ошибке остановись и сообщи её дословно.
2. Найди в репозитории `docs/mlma-track-architecture/02_CURSOR_PROMPT_INSTALL_TRACK.md`, package schema, ArchitectureStore, importer, content loader, access policy, route evaluator и существующие тесты A3-002/A3-016.
3. Сопоставь package.json с фактической schema. Не теряй graphBinding и route rules. Если repo-schema новее, сделай минимальный совместимый adapter и задокументируй delta; не выдумывай новый контракт.
4. Установи полный content в `server/content/tracks/a3-014/0.1.0/`. Он не должен попадать в public bundle, Tilda catalog или browser source.
5. Зарегистрируй четыре outcomes и пять RouteRule overlay как `PILOT_DRAFT_TO_TEST`. Не активируй их в production.
6. Привяжи A3-014 по Track ID к существующему connectionIndex. Не редактируй страницы A3-002, A3-013 и A6-020 и не хардкодь кнопки в HTML.
7. Реализуй UI в текущем дизайн-стеке: readiness gate первым, девять шагов, локальная карточка, пять финалов. Не меняй тексты витрины и соседних треков.
8. Реализуй минимальный server outcome payload и client-only storage. Прогони stripUnsafeFacts на любом server request.
9. AI_ANXIETY_MIRROR_ENABLED оставь false. Без AI трек должен работать полностью. Если AI adapter уже существует, подключи только через contract; не добавляй провайдера, ключи или сетевой вызов без текущей инфраструктуры.
10. PUBLIC_METADATA выдаёт только meta. PUBLIC_DEMO работает только на предвычисленном обезличенном sample, без live instance, writes и route execution. Полное тело — только по существующей server identity + entitlement policy.
11. Добавь tests из acceptance-cases и route-fixtures к существующим test harness. Обязательно докажи, что TR-095/TR-096 сами по себе не исполняются.
12. Запусти validator пакета, все track architecture tests, typecheck и существующие project tests.

## Запрещено

- production deploy и production migrations;
- включать PAYMENTS_ENABLED, PAID_TRACK_NAVIGATION_ENABLED, ALLOW_DRAFT_RULES или ENTITLEMENT_BYPASS;
- публиковать content_status=PUBLISHED;
- создавать право из query, localStorage, success URL, email, Member ID или Tilda group;
- изменять full-graph-112-v3.json или соседние страницы ради кнопок;
- исполнять legacy nextTrackIds;
- сохранять PII, текст страха, здоровье, диагноз, переписку или AI free text;
- использовать AI для диагноза, оценки тяжести, решения о готовности или маршрутизации;
- автоматически отправлять сообщение или создавать live instance в demo.

## Итоговый отчёт Cursor

Верни:

1. список изменённых файлов;
2. как установлен content и package version;
3. доказательство точных графовых чисел 0/1 incoming и 2/2 outgoing;
4. доказательство входа RR2-016;
5. статусы пяти overlay rules;
6. результаты всех тестов;
7. доказательство отсутствия PII/public leakage;
8. подтверждение, что production, оплата, paid navigation и AI flag не включены;
9. известные ограничения и отдельные действия перед публикацией.
