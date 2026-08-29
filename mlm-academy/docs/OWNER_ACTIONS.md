# Ручные действия владельца · предплатёжная витрина

Автоматически обойти публикацию Tilda и настройки Members нельзя.
Формат шага: **раздел Tilda → страница → блок/поле → старое значение → новое значение → кнопка → проверка**.

Ничего из этого агент не публиковал на живой сайт. Пока шаг не выполнен в Tilda и не открыт без `preview`, считать его только в GitHub.

## 1. Внешние assets `/shared/v1/*` — сначала одна страница

Живой сайт сейчас на блоках T123. Не переключать все страницы сразу.

1. Assets уже на Account Worker: `ASSET_BASE=https://mlma-account.mlmacademy-search.workers.dev` (`/v1/mlma.css`, `catalog-data.js`, `domain.js`, `ui.js`).
2. Tilda → страница `/about` → блоки T123 `01-css`, `02-data-*`, `03-domain-*`, `04-ui-*` → скрыть, не удалять (rollback).
3. Та же страница → новый T123 → вставить `tilda/dist/t123/external-loader-v1.live.html` → Сохранить → Опубликовать страницу.
4. HEAD и mount `mounts/about.html` не менять.
5. Проверка: https://mlmacademy.ru/about открывается, стили `.mlma` на месте, в консоли нет 404 по assets.
6. Rollback: показать обратно скрытые T123 `01-css` / `02-data-*` / `03-domain-*` / `04-ui-*` → Сохранить → Опубликовать.

После успешного `/about`:

1. Группа 1: `/academy`, `/start` — тот же loader, smoke: 6 карточек разделов, поиск не стартует при наборе.
2. Группа 2: `/library`, `/library/a1`…`/library/a6`, `/track` — 112 карточек, Enter и «Найти решение».
3. Группа 3: `/my`, `/my/route`, `/my/results`, `/my/purchases`, `/profile` — кабинет, мобильное меню.
4. Группа 4: `/pricing`, `/access`, `/payment-and-access`.

Не оставлять часть страниц на другой версии каталога.

## 2. Страницы, которые можно опубликовать

Проект `23906986`, папка MLM Academy. Members: **не** добавлять в группы (кроме кабинета).

Для каждой новой страницы:

1. Tilda → Страницы → Создать страницу.
2. Настройки страницы → Title / URL / HTML в HEAD → значения из таблицы.
3. Скрыть стандартные header/footer Tilda.
4. Добавить блоки T123 по `tilda/dist/TILDA_CHECKLIST.md` **или** external-loader после шага 1.
5. Последний блок: mount из таблицы.
6. Отступы блока = 0 → Сохранить → Опубликовать.
7. Проверка: URL открывается без `tilda.cc/page` preview, нет кнопки «Купить».

| Title | URL | HEAD | Mount | Индексация |
|---|---|---|---|---|
| Тарифы · MLM Academy | `/pricing` | `t123/heads/pricing.html` | `t123/mounts/pricing.html` | да |
| Доступ · MLM Academy | `/access` уже есть — обновить блоки T123/loader | `t123/heads/access.html` | `t123/mounts/access.html` | да |
| Оплата и доступ · MLM Academy | `/payment-and-access` | `t123/heads/payment-and-access.html` | `t123/mounts/payment-and-access.html` | да |
| Покупки и доступ · MLM Academy | `/my/purchases` | `t123/heads/purchases.html` | `t123/mounts/purchases.html` | нет; группа Member |

`/access` на живом сайте, скорее всего, ещё со старым текстом про тестовый пакет. Обновить блоки до новой сборки, затем опубликовать.

После публикации обновить в настройках сайта Tilda `robots.txt` и sitemap из `tilda/dist/seo/`.

## 3. Страницы, которые нельзя публиковать как действующие документы

Создать в редакторе можно, **не нажимать «Опубликовать» как оферту/политику/реквизиты**:

| Title | URL | Пометка |
|---|---|---|
| Политика… черновик | `/privacy` | `noindex`; не называть утверждённой |
| Публичная оферта · черновик | `/offer` | поля `[ЗАПОЛНИТЬ ВЛАДЕЛЬЦУ ПЕРЕД ПУБЛИКАЦИЕЙ]` |
| Реквизиты · черновик | `/requisites` | без фиктивных ФИО/ИНН |
| Предпросмотр состояний покупки | `/preview/commerce` | только editor; не публиковать на боевом домене |

Если `/privacy` уже создана как публичная — в Настройки страницы → HTML в HEAD поставить `noindex, nofollow` из `t123/heads/privacy.html`. Не добавлять в sitemap.

## 4. Members: язык, CSS, JS

1. Настройки сайта → Личный кабинет / Members → дополнительный CSS
   - старое: пусто или предыдущий фрагмент
   - новое: `tilda/dist/t123/members-bridge.css`
   - Сохранить → проверить `/members/login`: фон `#f4f0e8`
2. Тот же раздел → дополнительный HTML/JS
   - новое: `tilda/dist/t123/members-bridge.js`
   - проверить `/members/login?mlma=recover`
3. Язык интерфейса Members → русский
   - живой `/members/login` сейчас английский («Log In To Your Account»)
4. Группа Member → Страницы → добавить `/my/purchases` → Сохранить.
5. `/preview/commerce` не добавлять в Member. Если нужен editor — только группа Editor, и не публиковать URL.

**Не заявлять, что вход на русском, пока это не видно на живых `/members/login` и `/members/signup`.**

## 5. B2B-навигация

Tilda → страница `/` → блок меню/кнопки → старое: нет `href="/academy"` → новое: ссылка «MLM Academy» → `/academy` → Сохранить → Опубликовать.
Проверка: в HTML живой `/` есть `href="/academy"` или `href="https://mlmacademy.ru/academy"`.
Корпоративную вёрстку не менять.

## 6. Worker

```
cd mlm-academy/account-proxy
npx wrangler deploy
```

В `[vars]` оставить `PAYMENTS_ENABLED="false"` и `COMMERCE_PREVIEW_ENABLED="false"`.
Секреты не печатать. Ключи ЮKassa в Tilda и git не класть. Supabase не подключать.

Проверка: `GET /api/health` → `PAYMENTS_ENABLED: false`, `COMMERCE_PREVIEW_ENABLED: false`.
`POST /api/checkout/create` → 403.

## 7. Что не делать

- Не регистрировать и не настраивать ЮKассу.
- Не вводить Shop ID и secret key.
- Не подключать webhook и не проводить платежи.
- Не подключать Supabase.
- Не включать подписку и автоплатежи.
- Не выдавать платные права через группу Tilda, localStorage или query.
- Не показывать активную кнопку «Купить».
- Не показывать «Сообщить о запуске»: localStorage не является заявкой, email в этой итерации не собирать.
- Не публиковать незаполненную оферту и реквизиты.
- Не публиковать `/preview/commerce`.
