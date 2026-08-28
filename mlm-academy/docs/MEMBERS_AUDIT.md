# Аудит Tilda Members · 28 августа 2026

Снимок до доработки кабинета и после добавления групп доступа. Существующие группы Guest / Member / Editor не удалялись.

## Модуль

- Members Area включён, проект `23906986`.
- Самостоятельная регистрация: `allowSelfReg: true`.
- Платежи Tilda, корзина и «только после оплаты» не подключены.
- Иконка профиля: верхний правый угол.
- Header/footer личного кабинета Tilda не заданы — кабинет рисует оболочка Academy.

## Группы

| Группа | id | Страницы | Главная группы | Пользователей |
|---|---|---|---|---|
| Guest | 1637141 | 0 из академии | нет | 0 |
| Member | 1637145 | `/my`, `/my/route`, `/my/results`, `/profile` | `/my` | 0 |
| Editor | 1637149 | те же + `/preview/catalog` | нет | 0 |
| FREE | 1637897 | те же четыре кабинета | `/my` | 0 |
| START | 1637901 | те же четыре | `/my` | 0 |
| FULL | 1637905 | те же четыре | `/my` | 0 |
| PILOT | 1637909 | те же четыре | `/my` | 0 |
| ADMIN | 1637913 | те же + `/preview/catalog` | нет | 0 |

112 групп по трекам не создавались.

## Регистрация и сессия

- Вход: `https://mlmacademy.ru/members/login` (`noindex` в HTML Tilda).
- Регистрация: `https://mlmacademy.ru/members/signup` (`noindex`).
- Восстановление пароля — форма Tilda Members (появляется в JS-приложении входа).
- После входа без `redirecturl` Tilda открывает свою оболочку Members; у FREE/START/FULL/PILOT и Member задана домашняя страница `/my`.
- Выход: `/members/logout`.
- Прямая ссылка на `/my` без входа отдаёт оболочку Tilda Members (`tilda-members-init`), без HTML Академии. Контент кабинета не лежит в публичном HTML.
- Сессия Tilda: `localStorage tilda_members_profile23906986` + cookie. Поля: login/email, name, phone, token, id. Срок метки ~30 дней. После перезагрузки той же браузерной сессии вход сохраняется.
- На другом устройстве сессия Tilda не переносится сама: нужен повторный вход. Профиль Академии до Supabase живёт в `mlma.profile.v1` / `mlma.account.v1` и **теряется** при смене устройства.
- `window.mauser.email` / `name` / `phone` заполняются скриптом Members. Переменные Zero Block `ma_id`, `ma_email`, `ma_name` в T123 не подставляются автоматически; клиент читает `mauser` и профиль Members. Токен в аналитику не уходит.

## Проблемы, которые нельзя игнорировать

1. У Guest, Editor, START, FULL, PILOT, ADMIN стоит `addAfterConfirm: true`. Нужно в интерфейсе Tilda снять автодобавление после подтверждения email со всех групп, кроме Member и/или FREE. Иначе новый пользователь может попасть в Editor/ADMIN.
2. Ссылки в кабинете Tilda показаны как `http://mlmacademy.ru/members/login`.
3. `robots.txt` сайта содержит `Sitemap: http://mlmacademy.ru/sitemap.xml` (HTTP).
4. Автокарта Tilda — HTTP и почти без страниц Академии.
5. Публичные страницы Академии до этой итерации отдавали `noindex, nofollow` в исходном HEAD.
6. Критическое состояние кабинета было только в `localStorage`.

## localStorage

| Ключ | Что хранит | Переживёт другое устройство |
|---|---|---|
| `tilda_members_profile23906986` | сессия Tilda | нет, только этот браузер |
| `mlma.profile.v1` | профиль оболочки | нет |
| `mlma.account.v1` | запасной контур заказов и прав | нет |
| `mlma.runtime.v1` | прогресс трека | нет |
| `mlma.outbox.v1` | очередь событий на сервер | нет |
| `mlma.library.v1` | возврат к поиску | нет |

После подключения Supabase (`window.MLMA_API_URL`) клиент начинает писать на сервер. До этого режим честно называется `local_fallback`.
