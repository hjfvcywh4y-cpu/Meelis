# Ручные действия владельца · предплатёжная витрина

Автоматически обойти публикацию Tilda и настройки Members нельзя.
Формат оставшихся шагов: **раздел Tilda → страница → блок/поле → старое значение → новое значение → кнопка → проверка**.

Ниже жёстко разделено, что уже на `https://mlmacademy.ru`, что осталось владельцу, и что сознательно не публиковалось.

## Статус живого сайта (проверка 2026-09-02)

Проект `23906986`, папка MLM Academy, `ASSET_BASE=https://mlma-account.mlmacademy-search.workers.dev`.

| URL | Статус |
|---|---|
| `/academy`, `/start`, `/library`, `/track` | опубликованы, **внешний loader v1, но `?v=0.2` в HTML** (см. §A) |
| `/my` | pageid `211140509`, Members-only; без входа — пустая оболочка `tilda-members-init`, **без** academy-assets в HTML |
| `/pricing` | опубликована, pageid `213078109` |
| `/access` | обновлена новой копией, public |
| `/payment-and-access` | опубликована, pageid `213078309` |
| `/my/purchases` | опубликована, pageid `213078509`, группы Member/Editor/FREE |
| `/` | корпоративная вёрстка не менялась; в proof-блоке есть «Открыть MLM Academy» → `/academy` |
| `/members/signup` | **рабочая форма «Create Your Account»** — регистрация не закрыта (см. §B) |
| `/members/login` | английский UI, `members-bridge.js` **не подключён** |
| Account Worker | `SIGNUP_ENABLED=false`, `BETA_COHORT_CUTOFF_ISO=2026-09-02T00:00:00.000Z`, `REGISTERED_BETA_ACCESS_ENABLED=true`; assets `/v1/*?v=0.3` отдаются с Worker |

**Не заявлять**, что v=0.3 или закрытая регистрация на production, пока это не видно в HTML / на живых страницах.

Rollback на `/about` проверен: скрыть loader / показать старые T123 → живая страница без `/v1/domain.js`; вернуть loader → снова v1. Старые record id на about: `3424150101`–`0801`; loader `3426070101`; mount `3426070301`.

## Осталось владельцу (закрытие итерации)

### §A. Переключить loader на `?v=0.3` (5 страниц)

На каждой странице **два** блока T123 (type 131): **блок 1** — внешний loader, **блок 2** — mount. Менять **только блок 1**. Mount и HEAD не трогать.

| № | URL | Title в Tilda | pageid | Блок 1 (loader) record id | Блок 2 (mount) record id |
|---|---|---|---|---|---|
| 1 | `/academy` | MLM Academy — библиотека действий | `210631509` | `rec3426152701` | `rec3426153401` |
| 2 | `/start` | С чего начать · MLM Academy | `210780409` | `rec3426153601` | `rec3426153701` |
| 3 | `/library` | Библиотека · MLM Academy | `210785009` | `rec3426154001` | `rec3426154101` |
| 4 | `/track` | Трек · MLM Academy | `211142309` | `rec3426157801` | `rec3426157901` |
| 5 | `/my` | Личная главная · MLM Academy | `211140509` | первый T123 на странице (открыть в редакторе под Editor) | второй T123 |

**Путь в Tilda:** папка «MLM Academy» → страница → блок **1** (первый T123, комментарий «Внешний loader assets v1») → заменить весь HTML.

**Старое значение** (сейчас на production, пример `/academy`):

```html
<link rel="stylesheet" href="https://mlma-account.mlmacademy-search.workers.dev/v1/mlma.css?v=0.2">
<script src="https://mlma-account.mlmacademy-search.workers.dev/v1/catalog-data.js?v=0.2"></script>
<script src="https://mlma-account.mlmacademy-search.workers.dev/v1/domain.js?v=0.2"></script>
<script src="https://mlma-account.mlmacademy-search.workers.dev/v1/ui.js?v=0.2"></script>
```

**Новое значение** — вставить целиком из `tilda/dist/t123/external-loader-v1.live.html`:

```html
<link rel="stylesheet" href="https://mlma-account.mlmacademy-search.workers.dev/v1/mlma.css?v=0.3">
<script src="https://mlma-account.mlmacademy-search.workers.dev/v1/catalog-data.js?v=0.3"></script>
<script src="https://mlma-account.mlmacademy-search.workers.dev/v1/domain.js?v=0.3"></script>
<script src="https://mlma-account.mlmacademy-search.workers.dev/v1/tracks/a2-008.module.js?v=1.0.2"></script>
<script src="https://mlma-account.mlmacademy-search.workers.dev/v1/ui.js?v=0.3"></script>
```

Отличие от v=0.2: версия `0.3` **и** строка `a2-008.module.js` (Digital Mentor). Без неё визуальный слой v=0.3 неполный.

**Кнопки:** Сохранить страницу → **Опубликовать** (все 5 страниц).

**Проверка после публикации** (View Source, не кэш редактора):

```bash
for p in academy library start track; do
  echo -n "$p: "; curl -sL "https://mlmacademy.ru/$p" | rg -o 'v=0\.[0-9]+' | sort -u
done
```

Ожидание: только `v=0.3` (и `v=1.0.2` для a2-008). Для `/my` — войти как Member/Editor и проверить source той же командой.

### §B. Закрыть публичную регистрацию Tilda Members

Три слоя (все нужны; серверный уже включён):

**1. Tilda Members — отключить самостоятельную регистрацию**

- Личный кабинет (левое меню Tilda) → **Настройки личного кабинета**
- Вкладка **«Основные»** → снять галочку **«Разрешить регистрацию через форму»**
- **Сохранить**

Справка: https://help-ru.tilda.cc/membership

**2. Members extra JS — `members-bridge` (резервный UI-слой)**

API `savecustomjs` для этого проекта отвечает 404 — только руками:

- Тот же раздел **Настройки личного кабинета** → **Дополнительный HTML/JS** (или «extra HTML/JS»)
- Вставить содержимое `tilda/dist/t123/members-bridge-loader.html`:

```html
<script src="https://mlma-account.mlmacademy-search.workers.dev/members-bridge.js"></script>
```

- Опционально extra CSS: `tilda/dist/t123/members-bridge.css`
- **Сохранить**

**3. Сервер (уже настроено, не менять)**

- Worker: `SIGNUP_ENABLED=false`
- Beta-когорта: `BETA_COHORT_CUTOFF_ISO=2026-09-02T00:00:00.000Z` — аккаунты, созданные **до** этой даты, сохраняют beta-доступ
- Проверка: `GET https://mlma-account.mlmacademy-search.workers.dev/api/v1/flags` → `SIGNUP_ENABLED: false`

**Проверка после публикации:**

- `https://mlmacademy.ru/members/signup` → редирект на `/members/login?signup=paused` **или** текст «Регистрация временно закрыта», форма скрыта
- В Network на `/members/login` есть запрос `members-bridge.js`
- Новый email через форму зарегистрировать нельзя

Чтобы снова открыть регистрацию: галочку в Tilda вернуть + `SIGNUP_ENABLED=true` в `commerce.js` и `members-bridge.js`, `pnpm tilda:generate`, deploy Worker.

### §C. Прочее (без изменений в этой итерации)

1. **Настройки сайта Tilda → robots.txt и sitemap** из `tilda/dist/seo/`.
2. **SQL** `003_product_catalog.sql` не применялся (Supabase в этой итерации не подключался).
3. **Язык Members** → русский (если есть переключатель в настройках кабинета).

## Сознательно не публиковалось

| URL | Почему |
|---|---|
| `/preview/commerce` | editor-only preview состояний покупки |
| checkout, «Купить», тестовые покупки, фиктивные entitlements | `PAYMENTS_ENABLED=false` |

ЮKassa, webhook, подписка, verified Auth и Supabase не подключались.

Юридические страницы `/documents`, `/privacy`, `/consent`, `/offer`, `/requisites`, `/cookies`, `/marketing-consent`, `/payment-and-access` публикуются как действующие документы исполнителя (Осипов Роман Георгиевич, НПД, ИНН 532013301192). Платные услуги по-прежнему не оказываются: `PAYMENTS_ENABLED=false`.

Публичные документы не добавлять в группы Members. ЮKassa должна получать `https://mlmacademy.ru/requisites`.

## 1. Внешние assets `/shared/v1/*`

Worker отдаёт v=0.3. Живые страницы Tilda пока на `?v=0.2` — см. **§A** выше.
Rollback сохранён скрытыми T123 на каждой странице.

Повторный rollback при сбое:

1. Tilda → страница → показать скрытые T123 `01-css` / `02-data-*` / `03-domain-*` / `04-ui-*`.
2. Скрыть блок `external-loader-v1.live.html` (не удалять).
3. Сохранить → Опубликовать.
4. Проверка: в HTML нет `workers.dev/v1/domain.js`, оболочка снова из inline T123.

## 2. Страницы витрины

Опубликованы. Для v=0.3 — повторная публикация по **§A**.

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
