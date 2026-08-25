"""Подбор продукта IDera: цели цифрами, уточняющие вопросы, рекомендация."""

from __future__ import annotations

from typing import Any

import menus

SHOP_CATALOG = "https://shop.idera.io/catalog"

GOALS = {
    1: "Внешний вид — кожа, волосы, ногти",
    2: "Лёгкость тела, меньше отёчности",
    3: "Комфортный вес",
    4: "Ясная голова и внимание",
    5: "Запас сил на весь день",
    6: "Спокойный внутренний фон",
    7: "Свобода движения, суставы",
}

GOAL_PRODUCT = {
    1: "glow",
    2: "detox",
    3: "detox",
    4: "focus",
    5: "focus",
    6: "relax",
    7: "glow",
}

PRODUCTS: dict[str, dict[str, str]] = {
    "glow": {
        "name": "IDera Glow",
        "blurb": (
            "Про внешний вид: кожа, волосы, ногти и ощущение ухоженности. "
            "Когда хочется, чтобы лицо и волосы выглядели живее."
        ),
    },
    "detox": {
        "name": "IDera Detox",
        "blurb": (
            "Про лёгкость тела, воду и внутреннюю чистоту. "
            "Когда к вечеру тяжесть, отёчность или хочется «перезагрузить» самочувствие."
        ),
    },
    "focus": {
        "name": "IDera Focus",
        "blurb": (
            "Про ясность, внимание и дневной тонус. "
            "Когда голова должна держать задачу, а не расплываться к обеду."
        ),
    },
    "relax": {
        "name": "IDera Relax",
        "blurb": (
            "Про внутренний фон и умение выдохнуть. "
            "Когда день держит в сжатом состоянии и трудно переключиться."
        ),
    },
}

QUESTIONS: list[dict[str, Any]] = [
    {
        "id": "energy",
        "text": "Как обычно обстоят дела с запасом сил?",
        "options": [
            "Хватает спокойно",
            "К середине дня уже мало",
            "Почти всегда на нуле",
        ],
        "weights": {"focus": [0, 1, 2]},
    },
    {
        "id": "attention",
        "text": "Насколько легко сейчас удерживать внимание?",
        "options": [
            "Держится без труда",
            "Иногда уплывает",
            "Часто разъезжается",
        ],
        "weights": {"focus": [0, 1, 2]},
    },
    {
        "id": "puffiness",
        "text": "Как тело отзывается к вечеру?",
        "options": [
            "Лёгкое",
            "Чуть тяжелеет",
            "Заметно отёчное или тяжёлое",
        ],
        "weights": {"detox": [0, 1, 2]},
    },
    {
        "id": "looks",
        "text": "Кожа, волосы и ногти сейчас скорее какие?",
        "options": [
            "В порядке",
            "Просят внимания",
            "Давно не радуют",
        ],
        "weights": {"glow": [0, 1, 2]},
    },
    {
        "id": "weight",
        "text": "Как даётся держать привычный вес?",
        "options": [
            "Без борьбы",
            "То получается, то нет",
            "Постоянно ускользает",
        ],
        "weights": {"detox": [0, 1, 2]},
    },
    {
        "id": "stress",
        "text": "Какой внутренний фон в обычный день?",
        "options": [
            "Ровный",
            "Иногда сжато",
            "Часто на пределе",
        ],
        "weights": {"relax": [0, 1, 2]},
    },
    {
        "id": "lifestyle",
        "text": "Как устроен день по движению?",
        "options": [
            "Много ходьбы и нагрузки",
            "Смешанный, как получится",
            "В основном сидя",
        ],
        "weights": {"focus": [0, 0, 1]},
    },
]

INTRO = (
    f"{menus.idera('blue')} <b>Подбор продукта</b>\n\n"
    "Короткий разговор: что сейчас важнее, как проходит день, "
    "где состояние проседает. По ответам соберу ориентир — "
    f"{menus.idera('star')} один продукт из четырёх в линейке IDera: "
    "Glow, Detox, Focus или Relax.\n\n"
    "Это не диагноз и не назначение. Просто точнее, чем листать витрину вслепую."
)

ASK = (
    "Отметь до <b>трёх</b> направлений — цифрами из списка.\n\n"
    + "\n".join(f"{n}. {title}" for n, title in GOALS.items())
    + "\n\nНапиши номера через запятую. Например: <code>1, 4</code>"
)

ASK_RETRY = (
    "Нужны цифры из списка, до трёх, через запятую.\n"
    "Например: <code>1, 4</code>"
)

STEP_RETRY = "Выбери один из вариантов на кнопках ниже."

RESULT_WAIT = "Сверяю ответы с линейкой IDera…"

AI_SYSTEM = (
    "Ты помощник IDera HUB. Продукт уже выбран, его менять нельзя. "
    "Напиши 2-3 спокойных предложения на русском, почему он подходит по ответам. "
    "Не ставь диагнозов, не обещай лечение, не предлагай другой продукт. "
    "Только текст, без JSON, без заголовка и без названия других продуктов линейки."
)


def parse_goals(text: str) -> list[int] | None:
    raw = text.replace(" ", "")
    if not raw:
        return None
    parts = raw.split(",")
    nums: list[int] = []
    for p in parts:
        if not p.isdigit():
            return None
        n = int(p)
        if n not in GOALS or n in nums:
            return None
        nums.append(n)
    if not nums or len(nums) > 3:
        return None
    return nums


def step_keyboard(index: int):
    q = QUESTIONS[index]
    return menus.quiz_options_keyboard(list(q["options"]))


def match_option(index: int, text: str) -> str | None:
    q = QUESTIONS[index]
    for opt in q["options"]:
        if text == opt:
            return opt
    return None


def question_text(index: int) -> str:
    q = QUESTIONS[index]
    return f"{q['text']}"


def score_product(goals: list[int], answers: list[dict[str, str]]) -> str:
    """Главный сигнал — выбранные цели. Detox не получает бонус «по умолчанию»."""
    scores = {key: 0 for key in PRODUCTS}
    goal_keys: list[str] = []
    for i, g in enumerate(goals):
        key = GOAL_PRODUCT.get(g)
        if not key:
            continue
        goal_keys.append(key)
        scores[key] += 5 if i == 0 else 3

    selected = set(goal_keys)
    by_id = {q["id"]: q for q in QUESTIONS}
    for row in answers:
        q = by_id.get(row["id"])
        if not q:
            continue
        try:
            idx = q["options"].index(row["text"])
        except ValueError:
            continue
        for product, weights in q.get("weights", {}).items():
            weight = int(weights[idx])
            if weight <= 0:
                continue
            # Средние ответы не перетягивают на продукт вне выбранных целей.
            if idx < 2 and selected and product not in selected:
                continue
            scores[product] += weight

    tie_order = list(dict.fromkeys(goal_keys + ["glow", "focus", "relax", "detox"]))

    def sort_key(name: str) -> tuple[int, int]:
        try:
            rank = tie_order.index(name)
        except ValueError:
            rank = 99
        return scores[name], -rank

    return max(scores, key=sort_key)


def catalog_for_ai() -> str:
    lines = []
    for key, item in PRODUCTS.items():
        lines.append(f"{key}: {item['name']}. {item['blurb']}")
    return "\n".join(lines)


def answers_for_ai(goals: list[int], answers: list[dict[str, str]]) -> str:
    lines = ["Направления:"]
    for g in goals:
        lines.append(f"- {g}. {GOALS[g]}")
    lines.append("Ответы:")
    by_id = {q["id"]: q for q in QUESTIONS}
    for row in answers:
        title = by_id.get(row["id"], {}).get("text", row["id"])
        lines.append(f"- {title} → {row['text']}")
    return "\n".join(lines)


def parse_ai_why(raw: str) -> str | None:
    text = raw.strip().strip("`")
    if text.lower().startswith("json"):
        text = text[4:].strip()
    text = text.strip().strip('"').strip()
    if len(text) < 20:
        return None
    return text[:1200]


def _escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def format_result(product_key: str, why: str | None = None) -> str:
    item = PRODUCTS[product_key]
    body = _escape(why) if why else _escape(item["blurb"])
    names = " · ".join(p["name"] for p in PRODUCTS.values())
    return (
        f"{menus.idera('check')} <b>Ориентир по твоим ответам</b>\n\n"
        f"В линейке четыре продукта: {names}.\n"
        f"По твоим ответам ближе всего — <b>{item['name']}</b>.\n\n"
        f"{body}\n\n"
        f"Карточка в магазине:\n"
        f'<a href="{SHOP_CATALOG}">{SHOP_CATALOG}</a>\n\n'
        "Это не назначение и не диагноз. Если хочешь посмотреть линейку целиком — "
        "раздел «ПРОДУКТ»."
    )
