# SEO Академии · техническая готовность к индексации

Это не обещание позиций. Ниже — что открыто роботам, что закрыто, и какие страницы усиливать.

## Публичные URL (`index, follow` в исходном HEAD)

- `https://mlmacademy.ru/academy`
- `https://mlmacademy.ru/library`
- `https://mlmacademy.ru/start`
- `https://mlmacademy.ru/library/a1` … `/library/a6`
- `https://mlmacademy.ru/about`
- `https://mlmacademy.ru/access`
- `https://mlmacademy.ru/research/marketing-plan`

`canonical` и `og:url` — HTTPS. В HEAD есть description, Open Graph, favicon, JSON-LD `CollectionPage` / `ItemList` / `Article` / `BreadcrumbList`. Тип `Course` не ставится на пустые треки.

## Закрытые URL (`noindex, nofollow`)

- `/my`, `/my/route`, `/my/results`, `/profile`
- `/members/login`, `/members/signup`, восстановление пароля
- `/access?checkout=…` (страница та же, но сценарий оплаты не для индекса)
- `/preview/catalog`
- `/track?id=…` — общая страница-проигрыватель, без уникального серверного title на каждый трек
- внутренний runtime (`?run=1`)

Pretty URL `/track/a3-002` готовится в маршрутизаторе. Индексировать его можно только после отдельной страницы Tilda с полным промоописанием (ситуация, результат, кому подходит, состав, уникальные мета, свой canonical). Сейчас 112 пустых страниц в индекс не добавляются.

Правило каталога: `planned` → `noindex`; `promo`/`published` с полным публичным описанием → `index`; внутренний плеер всегда `noindex`.

## Что сделать в кабинете Tilda / Вебмастеров

1. Настройки сайта → SEO: вставить `tilda/dist/seo/robots.txt`.
2. Заменить sitemap на HTTPS. Фрагмент Академии: `tilda/dist/seo/sitemap-academy.xml`.
3. Язык сайта: `ru` (у `<html>` Tilda; оболочка дополнительно ставит `document.documentElement.lang`).
4. Яндекс Вебмастер и Google Search Console: добавить URL из списка публичных выше. Не отправлять `/my` и `/track?id=`.
5. Не имитировать отправку, если кабинетов вебмастеров в этой среде нет.

## Карта запросов — не переписывать тексты автоматически

| Запрос | Страница, которую стоит усилить | Заметка |
|---|---|---|
| старт в MLM | `/start`, `/library/a1` | Короткий вход «с чего начать» |
| первые действия новичка | `/start`, `/academy` | Не плодить тонкие дубли |
| как написать человеку | `/library/a3`, промо A3-002 когда будет отдельная страница | Сейчас карточка с `?id=` |
| как найти первых клиентов | `/library/a2` | База и круги |
| как отвечать на возражения | `/library/a5` | |
| клиент сказал дорого | `/library/a5` | Не плодить отдельную пустую URL |
| клиент перестал отвечать | `/library/a5`, `/library/a6` | |
| как попросить рекомендацию | `/library/a4` | |
| как вести базу контактов | `/library/a2` | |
| обучение партнёров MLM | `/library/a6`, `/about`, `/research/marketing-plan` | Исследование уже индексируется |

Тексты разделов и карточек не менялись в этой итерации. Сначала эта карта, затем точечное усиление H1/description у живых страниц.
