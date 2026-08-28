# Сборка страниц Tilda · MLM Academy

Папка проекта: «Академия партнерских сетей и дистрибьюции» → «MLM Academy».
Оболочка опубликована по `/academy`. Главную сайта `/` не трогать и не
назначать академией.

## Общий порядок блоков на каждой странице

1. Настройки страницы → HTML в HEAD: `t123/00-head.html`
2. Скрыть стандартные header/footer Tilda на этой странице
3. T123: `01-css.html`
4. T123: все `02-data-*.html` по порядку
5. T123: `03-domain.html` (и части, если есть)
6. T123: `04-ui.html` (и части, если есть)
7. T123: `mounts/<id>.html` этой страницы
8. Отступы блока = 0

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
| Личная главная · MLM Academy | `/my` | `mounts/my.html` | member |
| Мой маршрут · MLM Academy | `/my/route` | `mounts/route.html` | member |
| Мои результаты · MLM Academy | `/my/results` | `mounts/results.html` | member |
| Профиль · MLM Academy | `/profile` | `mounts/profile.html` | member |
| Доступ · MLM Academy | `/access` | `mounts/access.html` | public |
| Предпросмотр каталога · MLM Academy | `/preview/catalog` | `mounts/preview.html` | editor |

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
| Member | `/my`, `/my/route`, `/my/results`, `/profile` |
| Editor | те же четыре + `/preview/catalog` |

Публичные (не добавлять ни в одну группу): `/academy`, `/start`, `/library`,
`/library/a1`…`/library/a6`, `/track`, `/access`. Живую главную `/` и прочие
маркетинговые страницы в группы не добавлять.

После включения модуля проверить `mlmacademy.ru`: если на живой главной появилась
иконка профиля, не править общесайтовый HEAD и не публиковать `/`. Сообщить
и искать настройку видимости иконки в Личном кабинете.

Профиль оболочки (`localStorage` `mlma.profile.v1`) — это не логин Tilda.

## После появления настоящего трека

1. Дублировать страницу `/track`
2. Задать URL `track/a3-002`
3. Добавить ID в `config.dedicatedTrackPages` генератора и пересобрать JSON
