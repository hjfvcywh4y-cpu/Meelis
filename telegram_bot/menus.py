"""Тексты и кнопки меню IDera Helper (ReplyKeyboard)."""

from __future__ import annotations

from telegram import KeyboardButton, ReplyKeyboardMarkup

# --- Button labels ---
BTN_BAD = "🧪 Подобрать БАД"
BTN_BUSINESS = "💼 БИЗНЕС"
BTN_EVENTS = "📅 Мероприятия"
BTN_PRODUCT = "🛍 ПРОДУКТ"

BTN_BACK = "⬅️ Назад"
BTN_MAIN = "🏠 Главное меню"

BTN_IP_SELF = "📄 ИП и Самозанятость"
BTN_ABOUT = "ℹ️ О компании"
BTN_PVZ = "📦 Открыть ПВЗ"
BTN_PARTNERS = "🤝 Материалы для партнеров"
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
            [BTN_BACK, BTN_AWARDS],
            [BTN_IP_SELF, BTN_PARTNERS],
            [BTN_ABOUT, BTN_PVZ],
            [BTN_REWARDS],
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
    "👋 Добро пожаловать!\n\n"
    "Я — <b>IDera Helper</b>, твой помощник по продукту и бизнесу.\n"
    "Кофе мне не нужен, усталость — не про меня. Я всегда на связи 🚀\n\n"
    "Выбери раздел в меню ниже 👇"
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
    "Коротко о нас: миссия, ценности и путь партнёра.\n"
    "Полный текст и презентацию можно добавить сюда позже."
)

PVZ_TEXT = (
    "📦 <b>Открыть ПВЗ</b>\n\n"
    "Инструкция и требования к пункту выдачи появятся здесь.\n"
    "Пока раздел-заглушка — структуру кнопок уже заложили."
)

PARTNERS_TEXT = (
    "🤝 <b>Материалы для партнёров</b>\n\n"
    "Скрипты, презентации и полезные файлы для работы с клиентами.\n"
    "Контент добавим позже."
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
    "📚 <b>Каталог продукции</b>\n\n"
    "Здесь будет ссылка/файл каталога. Пока заглушка."
)

HOW_GET_TEXT = (
    "📦 <b>Как получить продукт</b>\n\n"
    "Пошаговая инструкция появления заказа появится здесь."
)

PRESENTATION_TEXT = (
    "🎞 <b>Презентация</b>\n\n"
    "Презентация продукта для партнёров — добавим файл позже."
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
}

DOC_FILES = {
    BTN_ACT: "act_services.pdf",
    BTN_OFFER: "offer.pdf",
    BTN_APP: "application.pdf",
    BTN_DOCS: "documents_list.pdf",
    BTN_BANK: "bank_terms.pdf",
    BTN_SWITCH: "switch_to_ip.pdf",
}

# Navigation: current screen -> parent screen
PARENT = {
    "business": "main",
    "ip_self": "business",
    "self": "ip_self",
    "ip": "ip_self",
    "events": "main",
    "product": "main",
    "quiz_intro": "main",
    "quiz": "quiz_intro",
}
