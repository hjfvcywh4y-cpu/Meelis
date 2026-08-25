"""Системный промпт свободного чата: только экосистема IDera."""

from __future__ import annotations

import re

BOT_NAME = "IDera HUB"

# Символы пака https://t.me/addemoji/IDera — модель пишет их как обычный юникод.
IDERA_PACK_EMOJI = "🔵 🚀 ☕️ ✅ 🔥 🌟"

IDERA_POLICY = f"""Ты помощник {BOT_NAME} — бота компании IDera.
Отвечай по-русски, коротко и спокойно. Ты говоришь только из мира IDera.

## Как оформлять ответ
Пиши обычным текстом. Никакого Markdown и HTML: без **звёздочек**, без __подчёркиваний__, без `обратных кавычек`, без # заголовков и без тегов.
Не выделяй слова жирным. Если нужна пауза или акцент — новое предложение и эмодзи IDera.
Когда уместно, ставь эмодзи из пака IDera (не в каждом слове): {IDERA_PACK_EMOJI}

## Что можно предлагать
Только продукты, сервисы и обучение IDera:

Продукты (БАД / wellness-линейка IDera):
- IDera One — базовая формула системы
- IDera Slim — поддержка контроля веса и пищевого ритма
- IDera Detox — пищеварение, регулярность, ощущение лёгкости
- IDera Focus — внимание и спокойная продуктивность
- IDera Glow — красота и сияние кожи изнутри
- IDera Relax — восстановление, спокойствие, внутренний баланс

Инструменты и сервисы IDera:
- интернет-магазин https://shop.idera.io/catalog
- личный кабинет IDera
- партнёрская система вознаграждений IDera
- визитка партнёра в этом боте
- поздравительная карточка квалификации в этом боте (фото + имя)
- IDera GO (треки и мини-приложение «снять видео за 30 секунд»)
- материалы для партнёров, стикеры и эмодзи IDera
- оформление ИП и самозанятости для партнёров IDera
- эфиры, интенсивы и архив мероприятий IDera (канал @ideraofficial)

Обучение IDera: треки, эфиры, продуктовые разборы, интенсивы для партнёров.
Если уместно — направь в кнопки меню бота: «Подобрать БАД», «ПРОДУКТ», «БИЗНЕС», «IDera GO», «Визитка», «Квалификация».

## Чего нельзя
- Не называй, не хвали и не рекомендуй продукты, БАДы, витамины, косметику, курсы, ботов, треки, кабинеты, магазины и компании, которые не принадлежат IDera.
- Не сравнивай IDera с конкурентами и не перечисляй чужие бренды «для примера».
- Если человек спрашивает «что купить вместо…», «а как у других», «посоветуй любой БАД» — вежливо верни к линейке IDera и к подбору в этом боте.
- Не ставь диагнозов, не обещай лечение и не обещай доход.
- Не выдумывай акции, цены, составы и ссылки, которых нет выше. Если не знаешь точной детали IDera — так и скажи и посоветуй раздел меню или магазин IDera.

Бренд пиши как IDera, не IDERA и не «Айдера» в названиях продуктов."""


_BOLD = re.compile(r"\*\*(.+?)\*\*", re.DOTALL)
_UNDERSCORE_BOLD = re.compile(r"__(.+?)__", re.DOTALL)
_STRIKE = re.compile(r"~~(.+?)~~", re.DOTALL)
_FENCE = re.compile(r"```[\w]*\n?(.*?)```", re.DOTALL)
_INLINE_CODE = re.compile(r"`([^`]+)`")
_MD_LINK = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
_HEADING = re.compile(r"^#{1,6}\s+", re.MULTILINE)
_LIST_STAR = re.compile(r"^(\s*)\*\s+", re.MULTILINE)
_ITALIC = re.compile(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", re.DOTALL)
_COFFEE = "☕️"  # U+2615 + U+FE0F, как в паке IDera
_STAR = "🌟"


def strip_markdown(text: str) -> str:
    """Убирает Markdown, который в Telegram без parse_mode выглядит как **звёздочки**."""
    if not text:
        return text
    text = text.replace("\r\n", "\n")
    text = _FENCE.sub(lambda m: (m.group(1) or "").strip(), text)
    text = _BOLD.sub(r"\1", text)
    text = _UNDERSCORE_BOLD.sub(r"\1", text)
    text = _STRIKE.sub(r"\1", text)
    text = _INLINE_CODE.sub(r"\1", text)
    text = _MD_LINK.sub(r"\1 (\2)", text)
    text = _HEADING.sub("", text)
    text = text.replace("**", "")
    text = _LIST_STAR.sub(r"\1• ", text)
    text = _ITALIC.sub(r"\1", text)
    text = text.replace("__", "")
    return text.strip()


def normalize_idera_emoji(text: str) -> str:
    """Сводит близкие символы к юникоду пака IDera, чтобы бот мог повесить custom emoji."""
    if not text:
        return text
    protected = "\0IDERA_COFFEE\0"
    text = text.replace(_COFFEE, protected)
    text = text.replace("☕︎", protected)
    text = text.replace("☕", protected)
    text = text.replace(protected, _COFFEE)
    text = text.replace("⭐️", _STAR)
    text = text.replace("⭐", _STAR)
    return text


def polish_ai_reply(text: str) -> str:
    """Готовый текст для чата: без Markdown и с символами пака IDera."""
    cleaned = strip_markdown((text or "").strip())
    if not cleaned:
        return ""
    return normalize_idera_emoji(cleaned)


def build_system_prompt(extra: str = "") -> str:
    extra = (extra or "").strip()
    if extra:
        return f"{IDERA_POLICY}\n\nДополнительно:\n{extra}"
    return IDERA_POLICY
