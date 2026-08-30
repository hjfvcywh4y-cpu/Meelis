# Ручные действия владельца · предплатёжная витрина

Автоматически обойти публикацию Tilda и настройки Members нельзя.
Формат оставшихся шагов: **раздел Tilda → страница → блок/поле → старое значение → новое значение → кнопка → проверка**.

Ниже жёстко разделено, что уже на `https://mlmacademy.ru`, что осталось владельцу, и что сознательно не публиковалось.

## Статус живого сайта (сделано агентом)

Проект `23906986`, папка MLM Academy, `ASSET_BASE=https://mlma-account.mlmacademy-search.workers.dev`.

| URL | Статус |
|---|---|
| `/academy`, `/start`, `/library`, `/library/a1`…`/a6`, `/track`, `/about` | опубликованы, внешний loader v1, старые T123 скрыты (не удалены) |
| `/pricing` | опубликована, pageid `213078109` |
| `/access` | обновлена новой копией, public |
| `/payment-and-access` | опубликована, pageid `213078309` |
| `/my`, `/my/route`, `/my/results`, `/profile` | кабинет, Member/FREE |
| `/my/purchases` | опубликована, pageid `213078509`, группы Member/Editor/FREE |
| `/` | корпоративная вёрстка не менялась; в proof-блоке есть «Открыть MLM Academy» → `/academy` |
| Account Worker | `PAYMENTS_ENABLED=false`, `COMMERCE_PREVIEW_ENABLED=false`, `SIGNUP_ENABLED=false`; `POST /api/checkout/create` → 403 |

Rollback на `/about` проверен: скрыть loader / показать старые T123 → живая страница без `/v1/domain.js`; вернуть loader → снова v1. Старые record id на about: `3424150101`–`0801`; loader `3426070101`; mount `3426070301`.

## Осталось владельцу

1. **Members → язык и extra CSS/JS.** Живой `/members/login` и `/members/signup` остаются английскими («Log In To Your Account»). API `savecustomcss` / `savecustomjs` / `savelanguage` у этого кабинета отвечают HTML 404. Сделать вручную:
   - Members → Настройки личного кабинета → extra CSS: вставить `tilda/dist/t123/members-bridge.css` → Сохранить.
   - Тот же раздел → extra HTML/JS: лучше `tilda/dist/t123/members-bridge-loader.html` (скрипт с Worker) или целиком `tilda/dist/t123/members-bridge.js` → Сохранить.
   - Если есть переключатель языка интерфейса Members → русский.
   - Проверка: https://mlmacademy.ru/members/login показывает «Войти в кабинет», фон `#f4f0e8`.
   - Не заявлять, что вход на русском, пока это не видно на живых страницах.
   - Регистрация сейчас выключена (`SIGNUP_ENABLED=false`). Чтобы снова открыть: `true` в `tilda/src/commerce.js` и `tilda/src/members-bridge.js`, `pnpm tilda:generate`, deploy Worker. Форма `/members/signup` блокируется members-bridge; если extra JS Members ещё не обновлён, в настройках Tilda Members лучше также закрыть регистрацию.
2. **Настройки сайта Tilda → robots.txt и sitemap** из `tilda/dist/seo/`.
3. **SQL** `003_product_catalog.sql` не применялся (Supabase в этой итерации не подключался).

## Сознательно не публиковалось

| URL | Почему |
|---|---|
| `/preview/commerce` | editor-only preview состояний покупки |
| checkout, «Купить», тестовые покупки, фиктивные entitlements | `PAYMENTS_ENABLED=false` |

ЮKassa, webhook, подписка, verified Auth и Supabase не подключались.

Юридические страницы `/documents`, `/privacy`, `/consent`, `/offer`, `/requisites`, `/cookies`, `/marketing-consent`, `/payment-and-access` публикуются как действующие документы исполнителя (Осипов Роман Георгиевич, НПД, ИНН 532013301192). Платные услуги по-прежнему не оказываются: `PAYMENTS_ENABLED=false`.

Публичные документы не добавлять в группы Members. ЮKassa должна получать `https://mlmacademy.ru/requisites`.

## 1. Внешние assets `/shared/v1/*`

Сделано: сначала `/about`, затем остальные Academy-страницы на том же loader. Rollback сохранён скрытыми T123.

Повторный rollback при сбое:

1. Tilda → страница → показать скрытые T123 `01-css` / `02-data-*` / `03-domain-*` / `04-ui-*`.
2. Скрыть блок `external-loader-v1.live.html` (не удалять).
3. Сохранить → Опубликовать.
4. Проверка: в HTML нет `workers.dev/v1/domain.js`, оболочка снова из inline T123.

## 2. Страницы витрины

Сделано. Повторно публиковать не нужно, пока не меняется mount/HEAD.

## 3. Юридические страницы

Публичные URL: `/privacy`, `/consent`, `/offer`, `/requisites`. В группы Members не добавлять.
При регистрации Members: текст под формой + обязательная галочка согласия (`pdn_consent`) и ссылка на `/consent`.

## 4. Members: группы

Сделано: `/access` убран из FREE (страница публичная). `/my/purchases` добавлен в Member, Editor, FREE. `/preview/commerce` в группы не добавлять.

## 5. B2B-навигация

Сделано: на `/` есть `href="/academy"` и текст «Открыть MLM Academy». Корпоративную вёрстку не менять.

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
