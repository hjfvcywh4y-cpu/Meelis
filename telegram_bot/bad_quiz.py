"""Подбор продукта IDera: цели цифрами, уточняющие вопросы, рекомендация."""

from __future__ import annotations

import json
import re
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
        "weights": {"focus": [0, 1, 2], "detox": [0, 0, 1]},
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
        "weights": {"focus": [0, 0, 1], "detox": [0, 0, 1], "relax": [1, 0, 0]},
    },
]

INTRO = (
    f"{menus.idera('blue')} <b>Подбор продукта</b>\n\n"
    "Не каталог «нажми наугад» и не универсальный совет для всех.\n\n"
    "Короткий разговор: что сейчас важнее, как проходит день, "
    "где состояние проседает. По ответам соберу ориентир — "
    f"{menus.idera('star')} один продукт линейки IDera, с которого логично начать.\n\n"
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
    "Ты помощник IDera Helper. По ответам человека выбираешь ОДИН продукт "
    "линейки: glow, detox, focus или relax. Не ставь диагнозов, не обещай лечение "
    "и доход, не сравнивай с лекарствами. Пиши коротко, спокойно, на русском. "
    "Верни только JSON: {\"product\":\"glow|detox|focus|relax\",\"why\":\"2-4 предложения\"}."
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
    scores = {key: 0 for key in PRODUCTS}
    for g in goals:
        key = GOAL_PRODUCT.get(g)
        if key:
            scores[key] += 3
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
            scores[product] = scores.get(product, 0) + int(weights[idx])
    return max(scores, key=lambda k: (scores[k], -list(PRODUCTS).index(k)))


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


def parse_ai_choice(raw: str) -> tuple[str, str] | None:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, re.S)
        if not m:
            return None
        try:
            data = json.loads(m.group(0))
        except json.JSONDecodeError:
            return None
    key = str(data.get("product") or "").strip().lower()
    why = str(data.get("why") or "").strip()
    if key not in PRODUCTS or not why:
        return None
    return key, why


def _escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def format_result(product_key: str, why: str | None = None) -> str:
    item = PRODUCTS[product_key]
    body = _escape(why) if why else _escape(item["blurb"])
    return (
        f"{menus.idera('check')} <b>Ориентир по твоим ответам</b>\n\n"
        f"Ближе всего сейчас — <b>{item['name']}</b>.\n\n"
        f"{body}\n\n"
        f"Карточка в магазине:\n"
        f'<a href="{SHOP_CATALOG}">{SHOP_CATALOG}</a>\n\n'
        "Это не назначение и не диагноз. Если хочешь посмотреть линейку целиком — "
        "раздел «ПРОДУКТ»."
    )
