# Сборка страниц Tilda · MLM Academy

Папка проекта: «Академия партнерских сетей и дистрибьюции» → «MLM Academy».
Оболочка опубликована по `/academy`. Главную сайта `/` не трогать и не
назначать академией.

## Общий порядок блоков на каждой странице

1. Настройки страницы → HTML в HEAD: `t123/heads/<id>.html` (уникальные title/description, `https://` canonical и og:url, favicon, `lang=ru`). Запасной общий файл: `t123/00-head.html`
2. Скрыть стандартные header/footer Tilda на этой странице
3. T123: `01-css.html`
4. T123: все `02-data-*.html` по порядку
5. T123: все `03-domain-*.html` по порядку (сейчас 11)
6. T123: все `04-ui-*.html` по порядку (сейчас 7)
7. T123: `mounts/<id>.html` этой страницы
8. Отступы блока = 0

После деплоя search-proxy задайте в HEAD `window.MLMA_RERANK_URL` на `https://<домен>/api/rerank`. API-ключ в Tilda не класть.

Версионируемые файлы лежат в `shared/v1/`. Живые страницы Tilda пока
остаются на проверенных блоках T123. Не переключать все 18+ страниц сразу.

Порядок внешнего переключения:

1. Локальный preview (`pnpm tilda:serve`)
2. Одна тестовая страница Tilda: вместо блоков 01–04 вставить `t123/external-loader-v1.html`,
   заменив `ASSET_BASE` на URL файлов. Mount и HEAD оставить.
3. Проверить каталог 112, поиск только по кнопке/Enter, кабинет, rollback.
4. Группами публиковать остальные страницы той же версии.
5. Rollback: вернуть предыдущие T123 01-css / 02-data / 03-domain / 04-ui
   или сменить `v1` на предыдущую папку assets.

Нельзя оставлять часть страниц на несовместимой версии каталога.

Можно собрать одну страницу-мастер, затем дублировать и менять URL, title и mount.

В редакторе Tilda блоки T123 показывают исходный код. Это нормально: скрипт выполняется
на опубликованной странице, а не на холсте редактора. Публикация `/academy` не
заменяет живую главную `/`. Оболочка на боевом домене: https://mlmacademy.ru/academy


## Страницы

| Title | URL | Mount | Members |
|---|---|---|---|
| MLM Academy — библиотека действий | `/academy` | `mounts/home.html` | public |
| С чего начать · MLM Academy | `/start` | `mounts/start.html` | public |
| Библиотека · MLM Academy | `/library` | `mounts/library.html` | public |
| A1 · Старт и система · MLM Academy | `/library/a1` | `mounts/a1.html` | public |
| A2 · Люди и база · MLM Academy | `/library/a2` | `mounts/a2.html` | public |
| A3 · Первый контакт · MLM Academy | `/library/a3` | `mounts/a3.html` | public |
| A4 · Потребность и решение · MLM Academy | `/library/a4` | `mounts/a4.html` | public |
| A5 · Сомнения и отказ · MLM Academy | `/library/a5` | `mounts/a5.html` | public |
| A6 · Повтор и рост · MLM Academy | `/library/a6` | `mounts/a6.html` | public |
| Трек · MLM Academy | `/track` | `mounts/track.html` | public |
| Как создаётся библиотека · MLM Academy | `/about` | `mounts/about.html` | public |
| Личная главная · MLM Academy | `/my` | `mounts/my.html` | member |
| Мой маршрут · MLM Academy | `/my/route` | `mounts/route.html` | member |
| Мои результаты · MLM Academy | `/my/results` | `mounts/results.html` | member |
| Профиль · MLM Academy | `/profile` | `mounts/profile.html` | member |
| Доступ · MLM Academy | `/access` | `mounts/access.html` | public |
| Тарифы · MLM Academy | `/pricing` | `mounts/pricing.html` | public |
| Оплата и доступ · MLM Academy | `/payment-and-access` | `mounts/payment-and-access.html` | public |
| Политика конфиденциальности · черновик · MLM Academy | `/privacy` | `mounts/privacy.html` | public |
| Публичная оферта · черновик · MLM Academy | `/offer` | `mounts/offer.html` | public |
| Реквизиты · черновик · MLM Academy | `/requisites` | `mounts/requisites.html` | public |
| Покупки и доступ · MLM Academy | `/my/purchases` | `mounts/purchases.html` | member |
| Предпросмотр каталога · MLM Academy | `/preview/catalog` | `mounts/preview.html` | editor |
| Предпросмотр состояний покупки · MLM Academy | `/preview/commerce` | `mounts/preview-commerce.html` | editor |

- `public` — без ограничения Members
- `member` — группы Member и Editor
- `editor` — только Editor

## Members

Справка: https://help-ru.tilda.cc/membership

1. Настройки сайта → Подключаемые модули → Личный кабинет → Управление модулем.
   Включить модуль. Платежи, корзину и приёмщик «только после оплаты» **не** подключать.
2. Служебные адреса `/members/login` и `/members/signup` появятся сами. Их не занимать
   адресами академии и не назначать академии `/`.
3. Создать (или переименовать) группы: **Guest**, **Member**, **Editor**.
   Guest — без страниц академии: публичные URL остаются открытыми.
4. В группе вкладка «Страницы». Статус «Добавлено в группу» закрывает страницу
   для всех, кто не в этой группе. Ограничение начинает действовать после
   публикации страницы; страницы академии опубликованы, доступ настроен.

| Группа | Страницы в группе |
|---|---|
| Guest | ничего из академии |
| Member | `/my`, `/my/route`, `/my/results`, `/my/purchases`, `/profile` |
| FREE / START / FULL / PILOT | те же четыре + `/my/purchases`; после входа главная группы — `/my` |
| Editor / ADMIN | те же кабинетные + `/preview/catalog` + `/preview/commerce` (commerce не публиковать на боевом сайте) |

Публичные (не добавлять ни в одну группу): `/academy`, `/start`, `/library`,
`/library/a1`…`/library/a6`, `/track`, `/about`, `/access`, `/pricing`, `/payment-and-access`.
Черновики `/privacy`, `/offer`, `/requisites` не публиковать как действующие документы.
`/preview/commerce` не публиковать. Живую главную `/` и прочие
маркетинговые страницы в группы не добавлять.

Группы доступа: **Guest**, **Member**, **FREE**, **START**, **FULL**, **PILOT**, **ADMIN**, **Editor**.
Не создавать группу на каждый трек. Member и FREE — кабинет после регистрации.
START/FULL выдаются после оплаты (пока тестовый режим). Editor/ADMIN — служебные.
После самостоятельной регистрации пользователь должен попадать в Member или FREE,
не в Editor и не в ADMIN. В интерфейсе Tilda снимите «добавлять после подтверждения»
с Editor, ADMIN, START, FULL, PILOT и Guest.

Профиль оболочки (`localStorage` `mlma.profile.v1` / `mlma.account.v1`) — запасной
контур. Это не серверное сохранение и не логин Tilda.

## SEO

Публичные страницы Академии: `index, follow` в HEAD. Кабинет, вход, preview и
`/track?id=` — `noindex, nofollow`. Индексировать отдельный трек можно только
после отдельной страницы `/track/<id>` с полным промоописанием. 112 пустых
страниц в индекс не добавлять.

В настройках сайта Tilda: язык HTML = ru; robots.txt из `dist/seo/robots.txt`;
sitemap — HTTPS, без кабинета. Автокарта Tilda сейчас отдаёт `http://` — заменить.

## После появления настоящего трека

1. Дублировать страницу `/track`
2. Задать URL `track/a3-002`
3. Добавить ID в `config.dedicatedTrackPages` генератора и пересобрать JSON
