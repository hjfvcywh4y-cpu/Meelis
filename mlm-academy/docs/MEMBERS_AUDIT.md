# Аудит Tilda Members · снимок 29 августа 2026

Перепроверено по API `getgroups` / `getmembers` и опубликованному сайту.
Старые записи «editgroup не работает» и «все группы с addAfterConfirm: true» недействительны.

## Модуль

- Members Area включён, проект `23906986`.
- Самостоятельная регистрация: включена.
- Платежи Tilda, корзина и «только после оплаты» не подключены.
- Header/footer личного кабинета Tilda не заданы — кабинет рисует оболочка Academy.

## Группы · API `getgroups` (источник истины для автодобавления)

| Группа | id | addAfterConfirm | Главная | Страниц в группе | Пользователей |
|---|---|---|---|---|---|
| Guest | 1637141 | **false** | нет | 0 | 0 |
| Member | 1637145 | **false** | `/my` | 4 | 0 |
| Editor | 1637149 | **false** | нет | 5 | 0 |
| **FREE** | **1637897** | **true** | **`/my`** | **5** | **2** |
| START | 1637901 | **false** | `/my` | 4 | 0 |
| FULL | 1637905 | **false** | `/my` | 4 | 0 |
| PILOT | 1637909 | **false** | `/my` | 4 | 0 |
| ADMIN | 1637913 | **false** | нет | 5 | 0 |

FREE: `/my`, `/my/route`, `/my/results`, `/profile`, `/access`. Платное тело трека группе FREE не открывается.

Чекбокс в UI Tilda («Добавлять пользователей в группу без подтверждения») **визуально инвертирован** относительно API:

- FREE: API `true`, экранный чекбокс пустой;
- START / FULL / PILOT / ADMIN: API `false`, экранный чекбокс с галкой.

Не сохранять настройки группы вслепую: прошлый клик по этому чекбоксу переворачивал API. После любого Save снова проверить `getgroups`.

## Пользователи

- `61058717` `o_053@mail.ru` — только FREE.
- `61060949` `mlma.qa.f9aa.2@gmail.com` «QA Cabinet 2» — только FREE. Админ-созданный тестовый аккаунт. После проверки удалить.
- `mlma.qa.f9aa@gmail.com` создавался и уходил в корзину Tilda — не использовать.

Самостоятельная регистрация с подтверждением email **в этой проверке не завершена** (нет входа в почтовый ящик). Автодобавление только в FREE доказано API-флагами и составом групп админ-созданного QA, не письмом подтверждения.

## Регистрация и сессия Tilda

- Вход: `https://mlmacademy.ru/members/login` (`noindex`).
- Регистрация: `https://mlmacademy.ru/members/signup` (`noindex`).
- После входа домашняя страница FREE — `/my`.
- Выход: `/members/logout`. URL после logout может остаться `/my`; повторный вход в том же браузере всё равно требует форму логина после очистки сессии.
- `/my` без входа: оболочка `tilda-members-init`, page id `211140509`, без HTML Академии.

## Кабинет Академии и KV

- Account API: `https://mlma-account.mlmacademy-search.workers.dev/api`.
- Маршрут хранится в Cloudflare KV. `localStorage` (`mlma.account.v1` / `mlma.profile.v1`) — fallback и миграция. Режим `server` только после ответа API.
- Cookie `mlma_sid`: HttpOnly, Secure, SameSite=None, 7 дней. Ротация sid на bind.
- `identityLevel: tilda_unverified` — текущий bind. Не основание для оплаты.
- `identityLevel: verified` — не выдаётся. `/api/session/verified` → 501. `/api/account/entitlements` → 403 `verified_required`.

## Проверенные сценарии (QA Cabinet 2, живой логин Tilda)

1. Вход → `/my`, группа FREE, `tilda_unverified`.
2. Сохранение `A1-010` → карточка на `/my` и `/my/route`, статус ЗАКРЫТ.
3. Повторный `POST /api/account/route/save` → `duplicate: true`, без второго id.
4. Выход / очистка сессии → вход → маршрут восстановлен с сервера.
5. Второй Playwright-контекст (чистый браузер) → тот же маршрут `['A1-010']`, `storageMode: server`.
6. Удаление → пустой маршрут. Новый контекст после входа → пусто сохранилось.
7. `/track?id=a1-010&run=1` → нет `data-mlma-run-start`, нет runtime-формы, `isEntitledToTrack === false`.
8. Чужой bind + `maId` жертвы в body → чужой маршрут не отдан (`saved: []`).
9. Bind с `groups: [ADMIN, FULL]` → всё равно `tilda_unverified` и `groups: [FREE]`.
10. Кнопка «Купить в тестовом режиме» → «Оплата ещё не подключена…», entitlements пустые.

Подмена `mauser` в DevTools как доказательство не использовалась.

## localStorage

| Ключ | Что хранит | Другое устройство |
|---|---|---|
| `tilda_members_profile23906986` | сессия Tilda | нет |
| `mlma.profile.v1` | профиль оболочки / миграция | нет, сервер после bind |
| `mlma.account.v1` | fallback маршрута | нет, сервер после bind |
| `mlma.runtime.v1` | прогресс трека | нет |
| `mlma.outbox.v1` | очередь событий | нет |
| `mlma.library.v1` | возврат к поиску | нет |

## Незакрытые риски

1. Self-reg + confirm email не пройдены до конца.
2. UI-чекбокс автодобавления инвертирован относительно API — риск, если кто-то нажмёт «Сохранить» в настройках группы.
3. `wrangler kv key list` может быть пустым при живом persist Worker — не считать CLI доказательством пустого KV.
4. Старые ключи `user:em:` могли остаться до склейки с `user:ma:`.
5. Origin + cookie — не платёжная авторизация.
6. Все 112 треков в каталоге `planned` / `metadata_only` / `paid`. Тело не открывается и не должно.
7. Живая оплата и `verified` не подключены. Подключать оплату нельзя.
