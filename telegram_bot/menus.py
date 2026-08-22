"""Тексты и кнопки меню IDera Helper (ReplyKeyboard)."""

from __future__ import annotations

from telegram import KeyboardButton, MessageEntity, ReplyKeyboardMarkup

# Кастомные эмодзи из пака https://t.me/addemoji/IDera
IDERA_EMOJI = {
    "blue": ("5188255858605205817", "🔵"),
    "rocket": ("5467765621489968794", "🚀"),
    "coffee": ("5465148723686319832", "☕️"),
    "check": ("5467564307782869924", "✅"),
    "fire": ("5465165443994005794", "🔥"),
    "star": ("5467737725677378875", "🌟"),
}
IDERA_PACK = "IDera"


def idera(name: str) -> str:
    emoji_id, fallback = IDERA_EMOJI[name]
    return f'<tg-emoji emoji-id="{emoji_id}">{fallback}</tg-emoji>'


def _utf16_len(text: str) -> int:
    return len(text.encode("utf-16-le")) // 2


def welcome_message() -> tuple[str, list[MessageEntity]]:
    """Живое приветствие IDera без перечня разделов."""
    blue_id, blue = IDERA_EMOJI["blue"]
    star_id, star = IDERA_EMOJI["star"]
    rocket_id, rocket = IDERA_EMOJI["rocket"]
    brand = "IDera Helper"
    text = (
        f"{blue} Привет. Это {brand}.\n\n"
        f"{star} Тихий ориентир, когда хочется ясности "
        "и спокойного шага вперёд.\n\n"
        f"Кнопки уже внизу. Выбирай то, что откликается — я рядом {rocket}"
    )

    def entity(needle: str, etype: str, **kwargs) -> MessageEntity:
        idx = text.find(needle)
        if idx < 0:
            raise ValueError(f"welcome text missing {needle!r}")
        return MessageEntity(
            type=etype,
            offset=_utf16_len(text[:idx]),
            length=_utf16_len(needle),
            **kwargs,
        )

    entities = [
        entity(blue, MessageEntity.CUSTOM_EMOJI, custom_emoji_id=blue_id),
        entity(brand, MessageEntity.BOLD),
        entity(star, MessageEntity.CUSTOM_EMOJI, custom_emoji_id=star_id),
        entity(rocket, MessageEntity.CUSTOM_EMOJI, custom_emoji_id=rocket_id),
    ]
    return text, entities

# --- Button labels ---
BTN_BAD = "🧪 Подобрать БАД"
BTN_BUSINESS = "💼 БИЗНЕС"
BTN_EVENTS = "📅 Мероприятия"
BTN_PRODUCT = "🛍 ПРОДУКТ"

BTN_BACK = "⬅️ Назад"
BTN_MAIN = "🏠 Главное меню"

BTN_IP_SELF = "📄 ИП и Самозанятость"
BTN_ABOUT = "ℹ️ О компании"
BTN_ABOUT_US = "👥 О нас"
BTN_COMPANY_PRESENTATION = "🎞 Презентация компании"
BTN_PVZ = "📦 Открыть ПВЗ"
BTN_PARTNERS = "🤝 Материалы для партнеров"
BTN_BUSINESS_TOOLS = "🛠 Бизнес-инструменты"
BTN_VISITKA = "💳 Визитка"
BTN_TG_CARD = "✈️ Telegram"
BTN_PARTNERS_PDF = "📄 PDF-материалы"
BTN_AWARDS = "🏆 Номинации и лауреатства"
BTN_REWARDS = "💰 Система вознаграждений"

BTN_SELF = "👤 Самозанятость"
BTN_IP = "🏢 ИП"

BTN_ACT = "📝 Акт оказания услуг"
BTN_OFFER = "📜 Оферта / договор"
BTN_APP = "📋 Заявление"
BTN_DOCS = "📂 Список документов"
BTN_BANK = "🏦 Условия банков для ИП"
BTN_SWITCH = "🔄 Переход с самозанятости на ИП"

BTN_CHARITY = "❤️ Благотворительный фонд"
BTN_UPCOMING = "🔜 Предстоящие"
BTN_ARCHIVE = "🗂 Архив"

BTN_CATALOG = "📚 Каталог продукции"
BTN_HOW_GET = "📦 Как получить продукт"
BTN_PRESENTATION = "🎞 Презентация"
BTN_VIDEO = "🎬 Видеоотзывы"
BTN_CREATIVES = "🎨 Креативы и другое"
BTN_DETOX = "💧 Detox"
BTN_RELAX = "🌙 Relax"
BTN_GLOW = "✨ Glow"
BTN_FOCUS = "🎯 Focus"

BTN_QUIZ_START = "✅ Начать подбор"
BTN_QUIZ_SKIP = "1,3,5"
BTN_QUIZ_SKIP2 = "2,4,6"
BTN_QUIZ_SKIP3 = "1,2,3"
BTN_QUIZ_SKIP4 = "4,5,6"
BTN_QUIZ_SKIP5 = "5,6,7"
BTN_QUIZ_SKIP6 = "1,4,7"


def kb(rows: list[list[str]], *, one_time: bool = False) -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        [[KeyboardButton(t) for t in row] for row in rows],
        resize_keyboard=True,
        one_time_keyboard=one_time,
    )


def main_keyboard() -> ReplyKeyboardMarkup:
    return kb(
        [
            [BTN_BAD, BTN_BUSINESS],
            [BTN_EVENTS, BTN_PRODUCT],
        ]
    )


def business_keyboard() -> ReplyKeyboardMarkup:
    return kb(
        [
            [BTN_IP_SELF, BTN_PARTNERS],
            [BTN_ABOUT, BTN_REWARDS],
            [BTN_BACK],
        ]
    )


def about_keyboard() -> ReplyKeyboardMarkup:
    return kb(
        [
            [BTN_ABOUT_US, BTN_COMPANY_PRESENTATION],
            [BTN_BACK],
        ]
    )


def partners_keyboard() -> ReplyKeyboardMarkup:
    return kb(
        [
            [BTN_BUSINESS_TOOLS],
            [BTN_PARTNERS_PDF],
            [BTN_BACK],
        ]
    )


def business_tools_keyboard() -> ReplyKeyboardMarkup:
    return kb(
        [
            [BTN_VISITKA, BTN_TG_CARD],
            [BTN_BACK],
        ]
    )


def ip_self_keyboard() -> ReplyKeyboardMarkup:
    return kb(
        [
            [BTN_SELF, BTN_IP],
            [BTN_BACK],
        ]
    )


def self_employed_keyboard() -> ReplyKeyboardMarkup:
    return kb(
        [
            [BTN_ACT, BTN_OFFER],
            [BTN_APP, BTN_DOCS],
            [BTN_SWITCH],
            [BTN_BACK],
        ]
    )


def ip_keyboard() -> ReplyKeyboardMarkup:
    return kb(
        [
            [BTN_ACT, BTN_OFFER],
            [BTN_APP, BTN_DOCS],
            [BTN_BANK],
            [BTN_SWITCH],
            [BTN_BACK],
        ]
    )


def events_keyboard() -> ReplyKeyboardMarkup:
    return kb(
        [
            [BTN_CHARITY, BTN_UPCOMING],
            [BTN_ARCHIVE],
            [BTN_BACK],
        ]
    )


def product_keyboard() -> ReplyKeyboardMarkup:
    return kb(
        [
            [BTN_CATALOG, BTN_HOW_GET],
            [BTN_PRESENTATION, BTN_VIDEO],
            [BTN_CREATIVES],
            [BTN_BACK],
        ]
    )


def presentation_keyboard() -> ReplyKeyboardMarkup:
    return kb(
        [
            [BTN_DETOX, BTN_RELAX],
            [BTN_GLOW, BTN_FOCUS],
            [BTN_BACK],
        ]
    )


def quiz_intro_keyboard() -> ReplyKeyboardMarkup:
    return kb([[BTN_QUIZ_START], [BTN_BACK]])


def quiz_choice_keyboard() -> ReplyKeyboardMarkup:
    return kb(
        [
            [BTN_QUIZ_SKIP, BTN_QUIZ_SKIP2],
            [BTN_QUIZ_SKIP3, BTN_QUIZ_SKIP4],
            [BTN_QUIZ_SKIP5, BTN_QUIZ_SKIP6],
            [BTN_BACK],
        ]
    )


WELCOME_CAPTION = (
    f"{idera('blue')} Привет. Это <b>IDera Helper</b>.\n\n"
    f"{idera('star')} Тихий ориентир, когда хочется ясности "
    "и спокойного шага вперёд.\n\n"
    f"Кнопки уже внизу. Выбирай то, что откликается — я рядом {idera('rocket')}"
)

BUSINESS_TEXT = (
    "💼 <b>Бизнес</b>\n\n"
    "Здесь всё для партнёров: оформление, материалы, вознаграждения и рост.\n"
    "Выбери нужный раздел 👇"
)

IP_SELF_TEXT = (
    "📄 <b>ИП и Самозанятость</b>\n\n"
    "Выбери формат работы — открою нужные документы и инструкции."
)

SELF_TEXT = (
    "👤 <b>Самозанятость</b>\n\n"
    "Документы и шаблоны для самозанятых партнёров.\n"
    "Нажми кнопку — пришлю PDF (пока черновик, позже заменим на финальный файл)."
)

IP_TEXT = (
    "🏢 <b>ИП</b>\n\n"
    "Документы, заявление, оферта и банковские условия для открытия ИП.\n"
    "Нажми кнопку — пришлю PDF."
)

ABOUT_TEXT = (
    "ℹ️ <b>О компании</b>\n\n"
    "Узнай больше об IDera и посмотри презентацию.\n"
    "Выбери раздел 👇"
)

ABOUT_US_TEXT = (
    f"{idera('blue')} <b>IDERA — компания нового поколения, которая растёт "
    "вместе с партнёрами.</b>\n\n"
    "<b>IDERA объединяет продукт, технологии, предпринимательство и развитие "
    "человека в одну систему.</b>\n\n"
    "💎 <b>Продукты IDERA — часть ежедневной системы заботы о себе.</b>\n"
    "Сегодня в экосистеме уже развиваются направления "
    "<b>RELAX, DETOX, GLOW, FOCUS и новые продукты, каждый со своей задачей "
    "и своим местом в повседневной жизни.</b>\n\n"
    f"{idera('rocket')} <b>IDERA развивается как полноценная партнёрская "
    "экосистема:</b>\n\n"
    "· собственный <b>Личный кабинет и интернет-магазин</b>;\n"
    "· инструменты для работы со структурой, объёмами и результатами;\n"
    "· современная партнёрская система вознаграждений;\n"
    "· обучение не только через информацию, а через "
    "<b>треки и реальные действия</b>;\n"
    "· экспертные эфиры и продуктовая поддержка;\n"
    "· цифровые инструменты для партнёров и наставников;\n"
    "· новые сервисы, контент и технологии, которые помогают сделать "
    "следующий шаг.\n\n"
    "🌱 <b>Мы растём. И вместе с ростом меняется сама IDERA.</b>\n\n"
    "Мы запускаем новые продукты.\n"
    "Развиваем цифровую платформу.\n"
    "Создаём инструменты для партнёров.\n"
    "Собираем опыт сильных лидеров и превращаем его в технологии для "
    "всей сети.\n\n"
    "Потому что наша цель — не оставить человека один на один с "
    "маркетинг-планом, чатом и десятками обучающих материалов.\n\n"
    "Наша цель — чтобы у каждого было понятно:\n\n"
    "<b>где я сейчас → куда хочу прийти → какой следующий шаг → "
    "какой инструмент поможет его сделать.</b>\n\n"
    "🌍 <b>IDERA — это движение вперёд.</b>\n\n"
    "Продукт становится системой.\n"
    "Обучение становится действием.\n"
    "Опыт лидеров становится технологией.\n"
    "А отдельные партнёры становятся сильной, растущей сетью.\n\n"
    f"<b>IDERA — МОЖНО БОЛЬШЕ.</b> {idera('blue')}"
)

PVZ_TEXT = (
    "📦 <b>Открыть ПВЗ</b>\n\n"
    "Инструкция и требования к пункту выдачи появятся здесь.\n"
    "Пока раздел-заглушка — структуру кнопок уже заложили."
)

PARTNERS_TEXT = (
    "🤝 <b>Материалы для партнёров</b>\n\n"
    "Бизнес-инструменты и файлы для работы с клиентами.\n"
    "Выбери раздел 👇"
)

BUSINESS_TOOLS_TEXT = (
    "🛠 <b>Бизнес-инструменты</b>\n\n"
    "Визитка и материалы для связи в Telegram.\n"
    "Выбери инструмент 👇"
)

VISITKA_CAPTION = (
    "💳 <b>Визитка IDera</b>\n\n"
    "Пример макета 90×50 мм (лицо и оборот)."
)

TG_CARD_CAPTION = (
    "✈️ <b>Telegram на визитке</b>\n\n"
    "На обороте — username, телефон и QR для связи."
)

AWARDS_TEXT = (
    "🏆 <b>Номинации и лауреатства</b>\n\n"
    "Наши награды и достижения. Раздел готов к наполнению."
)

REWARDS_TEXT = (
    "💰 <b>Система вознаграждений</b>\n\n"
    "Порядок получения вознаграждений и бонусов.\n"
    "Детали и таблицы добавим позже."
)

EVENTS_TEXT = (
    "📅 <b>Мероприятия</b>\n\n"
    "Благотворительность, ближайшие события и архив."
)

CHARITY_TEXT = (
    "❤️ <b>Благотворительный фонд</b>\n\n"
    "Информация о фонде и участии появится здесь."
)

UPCOMING_TEXT = (
    "🔜 <b>Предстоящие мероприятия</b>\n\n"
    "Список ближайших встреч и эфиров — скоро наполним."
)

ARCHIVE_TEXT = (
    "🗂 <b>Архив мероприятий</b>\n\n"
    "Записи прошедших событий появятся здесь."
)

PRODUCT_TEXT = (
    "🛍 <b>Продукт</b>\n\n"
    "Каталог, получение, презентация, видеоотзывы и креативы."
)

CATALOG_TEXT = (
    "🛍 <b>Каталог IDera</b>\n\n"
    "Открыть магазин:\n"
    '<a href="https://shop.idera.io/catalog">https://shop.idera.io/catalog</a>'
)

HOW_GET_TEXT = (
    "📦 <b>Как получить продукт</b>\n\n"
    "Пошаговая инструкция появления заказа появится здесь."
)

PRESENTATION_TEXT = (
    "🎞 <b>Презентация</b>\n\n"
    "Выбери материал 👇"
)

VIDEO_TEXT = (
    "🎬 <b>Видеоотзывы</b>\n\n"
    "Подборка видеоотзывов — раздел готов к ссылкам."
)

CREATIVES_TEXT = (
    "🎨 <b>Креативы и другое</b>\n\n"
    "Готовые креативы, баннеры и материалы для сторис."
)

DOC_CAPTIONS = {
    BTN_ACT: "📝 Акт оказания услуг",
    BTN_OFFER: "📜 Оферта / предложение заключить договор",
    BTN_APP: "📋 Заявление",
    BTN_DOCS: "📂 Список документов",
    BTN_BANK: "🏦 Особые условия банков для открытия ИП",
    BTN_SWITCH: "🔄 Переход с самозанятости на ИП",
    BTN_REWARDS: "💰 Система вознаграждений IDera",
    BTN_DETOX: "💧 Detox",
    BTN_RELAX: "🌙 Relax",
    BTN_GLOW: "✨ Glow",
    BTN_FOCUS: "🎯 Focus",
    BTN_PARTNERS_PDF: "🤝 Материалы для партнеров",
    BTN_COMPANY_PRESENTATION: "🎞 Презентация компании IDera",
}

DOC_FILES = {
    BTN_ACT: "act_services.pdf",
    BTN_OFFER: "offer.pdf",
    BTN_APP: "application.pdf",
    BTN_DOCS: "documents_list.pdf",
    BTN_BANK: "bank_terms.pdf",
    BTN_SWITCH: "switch_to_ip.pdf",
    BTN_REWARDS: "IDera_M.pdf",
    BTN_DETOX: "IDera_DETOX_1.pdf",
    BTN_RELAX: "IDera_RELAX.pdf",
    BTN_GLOW: "IDera_GLOW.pdf",
    BTN_FOCUS: "IDera_FOCUS.pdf",
    BTN_PARTNERS_PDF: "IDera_partners.pdf",
    BTN_COMPANY_PRESENTATION: "IDera_company.pdf",
}

DOC_DOWNLOAD_NAMES = {
    BTN_REWARDS: "IDera M.pdf",
    BTN_DETOX: "IDera_DETOX_1.pdf",
    BTN_RELAX: "IDera Relax.pdf",
    BTN_GLOW: "IDera Glow.pdf",
    BTN_FOCUS: "IDera Focus.pdf",
    BTN_PARTNERS_PDF: "IDera материалы для партнеров.pdf",
    BTN_COMPANY_PRESENTATION: "IDera презентация компании.pdf",
}

# Финальные файлы — без пометки «черновик»
FINAL_DOCS = {
    BTN_REWARDS,
    BTN_DETOX,
    BTN_RELAX,
    BTN_GLOW,
    BTN_FOCUS,
    BTN_PARTNERS_PDF,
    BTN_COMPANY_PRESENTATION,
}

# Navigation: current screen -> parent screen
PARENT = {
    "business": "main",
    "about": "business",
    "partners": "business",
    "business_tools": "partners",
    "ip_self": "business",
    "self": "ip_self",
    "ip": "ip_self",
    "events": "main",
    "product": "main",
    "presentation": "product",
    "quiz_intro": "main",
    "quiz": "quiz_intro",
}
