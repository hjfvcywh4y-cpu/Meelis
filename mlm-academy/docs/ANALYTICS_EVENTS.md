# Словарь аналитики · MLM Academy

Правило: **одно пользовательское действие → одно каноническое событие**.
Полный поисковый текст во внешнюю аналитику не отправляется: только `queryHash` и `queryLength`.
Артефакты, пароли и платёжные реквизиты не логируются.

## Канонические события

| Каноническое имя | Когда | Обязательные | Допустимые | ПДн | Куда | Дедуп |
|---|---|---|---|---|---|---|
| `signup_started` | клик регистрации | `source` | `chainId` | нет | dataLayer / outbox | 800 мс |
| `signup_completed` | успешная регистрация Members | `source` | | email маскируется, если попал | dataLayer | 800 мс |
| `login_completed` | первый заход в `/my` за сессию вкладки | `source` | | нет | dataLayer | sessionStorage-флаг |
| `profile_completed` | сохранение профиля | `source` | | нет | dataLayer | 800 мс |
| `search_submitted` | кнопка «Найти решение» или Enter | `source` | `kind`, `queryHash`, `queryLength`, `chainId` | нет (текст хешируется) | dataLayer | 800 мс по hash |
| `search_results_shown` | зарезервировано; сейчас не шлётся отдельно, чтобы не дублировать поиск | `source` | `queryHash` | нет | — | не эмитить после AI rerank |
| `track_card_opened` | открыта карточка | `itemId` | `source`, `chainId` | нет | dataLayer | 800 мс |
| `track_saved` | трек в маршруте | `itemId` | `source` | нет | dataLayer | 800 мс |
| `track_unsaved` | удаление из маршрута | `itemId` | | нет | dataLayer | 800 мс |
| `route_opened` | `/my/route` | `source` | | нет | dataLayer | страница |
| `locked_track_opened` | платный трек без права | `itemId` | | нет | dataLayer | 800 мс |
| `checkout_started` | не используется, пока оплата выключена | `itemId` | | нет | — | — |
| `checkout_blocked` | клик по тестовой кнопке пакета | `itemId`, `reason` | | нет | dataLayer | 800 мс |
| `payment_succeeded` | только будущий webhook | | | нет | сервер | provider event id |
| `payment_failed` | будущий webhook | | | нет | сервер | provider event id |
| `entitlement_granted` | только verified + сервер | | | нет | сервер | unique entitlement |
| `track_started` | старт runtime | `itemId` | `chainId` | нет | dataLayer | 800 мс |
| `step_completed` | смена шага | `itemId` | | нет | dataLayer | 800 мс |
| `artifact_created` | сдача результата (самопроверка) | `itemId` | | нет, без текста | dataLayer | 800 мс |
| `track_paused` | пауза | `itemId` | | нет | dataLayer | 800 мс |
| `track_completed` | runtime complete | `itemId` | `chainId` | нет | dataLayer | 800 мс |
| `next_track_opened` | переход к следующему треку | `itemId` | | нет | dataLayer | 800 мс |
| `access_expired` | истекшее право | | | нет | — | — |
| `subscription_renewed` | не реализуется | | | нет | — | — |
| `sync_error` | ошибка KV/API | `source` | `itemId` | нет | dataLayer | 800 мс |

## Алиасы (схлопываются в канон)

| Старое | Канон |
|---|---|
| `search_query` | `search_submitted` |
| `library_search` | `search_submitted` |
| `academy_search` | `search_submitted` |
| `track_start` | `track_started` |
| `track_complete` | `track_completed` |
| `track_next_open` | `next_track_opened` |
| `track_action_submitted` | `artifact_created` |
| `track_evidence_submitted` | `artifact_created` |

## Поиск и rerank

Пользователь нажимает «Найти решение» или Enter → одно событие `search_submitted`.
Второй `paint` после AI rerank **не** шлёт повторный поиск: `paint({ skipRerank: true })` не вызывает `emitSearch`.
Набор текста поиск не запускает.
