# Cursor prompt · установить A3-005

Работай только в существующем репозитории MLM Academy. Полностью прочитай все файлы пакета до изменения кода.

## Порядок

1. Запусти `node tools/validate-package.mjs`. При ошибке остановись и верни её дословно.
2. Найди текущие track-package schema, importer, ArchitectureStore, content loader, route evaluator, access policy и уже установленные пакеты A3-002/A3-008/A3-016/A3-014.
3. Установи content в `server/content/tracks/a3-005/0.1.0/`; он не должен попадать в public bundle, Tilda catalog или browser source.
4. Зарегистрируй 4 outcomes, три base RouteRule и один terminal overlay. Все остаются PILOT_DRAFT_TO_TEST.
5. Привяжи пакет по Track ID к connectionIndex v3. Не редактируй страницы A2-008, A3-006, A3-008, A3-010, A3-013, A5-014, A3-001 или A6-030.
6. Реализуй девять шагов в текущем UI-стеке. Consent gate идёт первым; MEETING_SCHEDULED недоступен без explicitConfirmation=true и полного набора параметров.
7. Храни на сервере только разрешённые appointment mechanics. Имя, контакты, meeting link, location, черновики и attendee data остаются client-only.
8. Личное напоминание/ICS разрешено только после подтверждения. Не добавляй attendee и не отправляй внешний invite автоматически.
9. AI_SCHEDULING_EDITOR_ENABLED оставь false. Без AI трек обязан работать через deterministic template. Не добавляй нового провайдера или ключи.
10. PUBLIC_METADATA содержит только meta. PUBLIC_DEMO использует предвычисленный sample без instance, writes, calendar и routing.
11. Добавь acceptance и route fixtures в текущий test harness. Докажи, что TR-077/TR-078 и legacy nextTrackIds не исполняются.
12. Запусти validator, architecture tests, typecheck и существующие project tests.

## Запрещено

- production deploy и production migrations;
- включать PAYMENTS_ENABLED, PAID_TRACK_NAVIGATION_ENABLED, ALLOW_DRAFT_RULES или ENTITLEMENT_BYPASS;
- публиковать content_status=PUBLISHED;
- создавать права из query/localStorage/success URL/email/Member ID/Tilda group;
- переписывать full graph или хардкодить соседние кнопки;
- считать молчание или вежливость согласием;
- создавать календарную встречу до подтверждения;
- отправлять сообщение/invite автоматически;
- передавать PII или календарные детали AI;
- разрешать AI выбирать status, время, адресата или маршрут.

## Отчёт

Верни список файлов, место установки content, точные graph counts 2/3 и 2/4, доказательство RR2-008 и четырёх исходящих правил, результаты тестов, доказательство отсутствия public/PII leakage и подтверждение, что production, оплата, paid navigation, draft execution и AI flag не включены.
