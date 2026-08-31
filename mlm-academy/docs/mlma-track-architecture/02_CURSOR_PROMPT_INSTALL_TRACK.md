# Повторяемый промпт Cursor: подключить готовый трек

Подключи к существующей архитектуре MLM Academy новый готовый трек.

Входные данные:

- Track ID: `[TRACK_ID]`
- файлы содержания: `[PATH_OR_ATTACHED_FILES]`
- версия содержания: `[CONTENT_VERSION]`
- продукт/тариф доступа: `[PRODUCT_CODE_OR_TBD]`
- предложенные outcomes/rules: `[PATH_OR_NONE]`

Не создавай новую архитектуру и не копируй страницу A2-008. Используй существующие registry, content repository, Route Engine, access service, URL helper и импортёр track package.

## Порядок

1. Найди `[TRACK_ID]` в каноническом registry.
2. Покажи его `entityType`, `publishSurface`, `canonicalId`, domain и текущий status.
3. Проверь соответствие переданного содержания типу сущности:
   - `TRACK`, `CONDITIONAL_TRACK`, `REMEDIATION` могут иметь самостоятельную content version;
   - `GATE` и `EMBEDDED_TOOL` встраиваются в canonical parent;
   - `SYSTEM_ACTION` реализуется как системный UI/action;
   - `ALIAS` не получает копию контента, а разрешается в canonical ID.
4. Если файл конфликтует с типом сущности, не обходи правило. Останови публикацию и предложи точечное решение.
5. Собери package по `spec/track-package.schema.json` и проверь его до изменения базы/registry.
6. Помести полный контент в server-only слой. Проверь, что он не попал в public bundle, public HTML или открытый JSON.
7. Создай новую immutable content version. Старые прохождения не перепривязывай автоматически.
8. Добавь/обнови outcomes только из переданного материала. Не придумывай переходы из `legacyNextIds` или соседних номеров.
9. Route rules добавляй только если для них указаны наблюдаемый outcome, field/operator/value, destination, stop/recovery, priority, owner, version и status.
10. Новые draft rules не активируй в production.
11. Привяжи доступ к продукту через entitlement policy. Если продукт ещё не утверждён, используй закрытый `TBD`/draft status и не публикуй платный доступ.
12. Не включай `PAYMENTS_ENABLED` и `PAID_TRACK_NAVIGATION_ENABLED`.
13. Выполни dry-run import, покажи diff, затем apply только к локальной/тестовой среде.
14. Добавь тесты конкретного трека: registry resolve, content access, outcomes, routing, alias/gate behavior, отсутствие утечки контента.
15. Проверь сборку и существующие тесты.

## Нельзя

- менять стабильный Track ID;
- вручную вставлять ссылки в соседние страницы;
- хардкодить кнопки перехода в content-файле;
- открывать контент по URL без server entitlement;
- выдавать право через localStorage, query string или success page;
- копировать контент для alias;
- активировать 231 legacy edge;
- отправлять на сервер ФИО, телефон, email, текст переписки или свободное описание контактов.

## Выход

Верни:

1. что подключено и в какой роли;
2. package manifest;
3. dry-run diff;
4. список изменённых файлов;
5. новые outcomes/rules и их статусы;
6. access policy;
7. результаты тестов;
8. точный URL preview;
9. что остаётся locked до оплаты/публикации;
10. вердикт `готово / частично / заблокировано`.

