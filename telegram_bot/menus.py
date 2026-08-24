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


def welcome_message(*, with_menu_hint: bool = True) -> tuple[str, list[MessageEntity]]:
    """Живое приветствие IDera без перечня разделов."""
    blue_id, blue = IDERA_EMOJI["blue"]
    star_id, star = IDERA_EMOJI["star"]
    rocket_id, rocket = IDERA_EMOJI["rocket"]
    brand = "IDera Helper"
    text = (
        f"{blue} Привет. Это {brand}.\n\n"
        f"{star} Тихий ориентир, когда хочется ясности "
        "и спокойного шага вперёд."
    )
    if with_menu_hint:
        text += (
            f"\n\nКнопки уже внизу. Выбирай то, что откликается — я рядом {rocket}"
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
    ]
    if with_menu_hint:
        entities.append(
            entity(rocket, MessageEntity.CUSTOM_EMOJI, custom_emoji_id=rocket_id)
        )
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
BTN_TRACK = "IDera GO"
BTN_VIDEO_30S = "GO снимать видео за 30 секунд"
BTN_PARTNERS_PDF = "📄 Материалы"
BTN_PARTNER_SYSTEM = "📋 Система работы партнёров"
BTN_STICKERS = "Stickers"
BTN_EMOJI = "Emoji"
BTN_STICKER_ETG = "STICKER.ETG"
BTN_EMOD_ETG = "EMOD.ETG"
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
BTN_DETOX = "💧 Detox"
BTN_RELAX = "🌙 Relax"
BTN_GLOW = "✨ Glow"
BTN_FOCUS = "🎯 Focus"

BTN_CONSENT_YES = "✅ Согласен"
BTN_CONSENT_NO = "❌ Не согласен"

BTN_QUIZ_START = "Начать подбор"


def kb(rows: list[list[str]], *, one_time: bool = False) -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        [[KeyboardButton(t) for t in row] for row in rows],
        resize_keyboard=True,
        one_time_keyboard=one_time,
    )


def consent_keyboard() -> ReplyKeyboardMarkup:
    return kb([[BTN_CONSENT_YES, BTN_CONSENT_NO]], one_time=True)


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


def materials_keyboard() -> ReplyKeyboardMarkup:
    return kb(
        [
            [BTN_PARTNER_SYSTEM],
            [BTN_STICKERS, BTN_EMOJI],
            [BTN_BACK],
        ]
    )


def business_tools_keyboard() -> ReplyKeyboardMarkup:
    return kb(
        [
            [BTN_VISITKA],
            [BTN_TRACK],
            [BTN_BACK],
        ]
    )


def track_keyboard() -> ReplyKeyboardMarkup:
    return kb(
        [
            [BTN_VIDEO_30S],
            [BTN_BACK],
        ]
    )


def visitka_keyboard() -> ReplyKeyboardMarkup:
    return kb([[BTN_BACK]])


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


def quiz_goals_keyboard() -> ReplyKeyboardMarkup:
    return kb([[BTN_BACK]])


def quiz_options_keyboard(options: list[str]) -> ReplyKeyboardMarkup:
    rows = [[opt] for opt in options]
    rows.append([BTN_BACK])
    return kb(rows)


CONSENT_TEXT = (
    "📄 <b>Согласие на обработку персональных данных</b>\n\n"
    "Для использования бота необходимо ваше согласие на обработку персональных "
    "данных в соответствии с законодательством Российской Федерации.\n\n"
    "Мы обрабатываем ваши данные исключительно для предоставления функций бота "
    "и улучшения качества сервиса.\n\n"
    "Пожалуйста, ознакомьтесь с документом выше.\n\n"
    "Если вы согласны — нажмите «Согласен». Если нет — «Не согласен»."
)

CONSENT_DECLINED_TEXT = (
    "Без согласия на обработку персональных данных использование бота невозможно.\n\n"
    "Если передумаете — нажмите /start и подтвердите согласие."
)

CONSENT_ACCEPTED_TEXT = (
    "Спасибо! Согласие получено.\n\n"
    "Выберите раздел в главном меню 👇"
)

CONSENT_PDF = "Soglasie_na_obrabotku_personalnyh_dannyh.pdf"
CONSENT_PDF_FILENAME = "Согласие на обработку персональных данных.pdf"

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

MATERIALS_TEXT = (
    "📄 <b>Материалы</b>\n\n"
    "Система работы партнёров, стикеры и эмодзи IDera.\n"
    "Выбери, что нужно 👇"
)

STICKER_PACK_NAME = "IDera3"
STICKER_PACK_URL = "https://t.me/addstickers/IDera3"
STICKER_PACK_TEXT = (
    "✨ <b>Стикеры IDera</b>\n\n"
    "Набор для переписок и сторис.\n"
    f'<a href="{STICKER_PACK_URL}">Добавить себе</a>\n'
    f"{STICKER_PACK_URL}"
)

EMOJI_PACK_NAME = IDERA_PACK
EMOJI_PACK_URL = "https://t.me/addemoji/IDera"
EMOJI_PACK_TEXT = (
    "✨ <b>Эмодзи IDera</b>\n\n"
    "Кастомные эмодзи для сообщений.\n"
    f'<a href="{EMOJI_PACK_URL}">Добавить себе</a>\n'
    f"{EMOJI_PACK_URL}"
)

PACK_PREVIEW_LIMIT = 6

BUSINESS_TOOLS_TEXT = (
    "🛠 <b>Бизнес-инструменты</b>\n\n"
    "Визитка и IDera GO.\n"
    "Выбери, с чего начать 👇"
)

TRACK_TEXT = "Выбери цель → пройди маршрут → сделай."

VIDEO_WIZARD_URL = "https://video-creator-track.vercel.app"
BTN_VIDEO_LAUNCH = "🚀 Запустить"


def video_track_message() -> tuple[str, list[MessageEntity]]:
    """Короткий текст карточки трека с фирменными эмодзи IDera."""
    star_id, star = IDERA_EMOJI["star"]
    check_id, check = IDERA_EMOJI["check"]
    blue_id, blue = IDERA_EMOJI["blue"]
    text = (
        "Сними видео о продукте за 30 секунд 📱\n\n"
        "Камеру включил и всё забыл? 😬\n"
        "Не знаешь, что сказать и куда смотреть?\n\n"
        "Мы уже собрали маршрут:\n\n"
        f"{star} выбери продукт\n"
        "📝 получи готовую структуру\n"
        "👀 читай текст с телесуфлёра\n"
        "🎥 запиши ролик по шагам\n\n"
        f"{check} Результат: твоё готовое видео о продукте\n\n"
        f"{blue} IDERA | Сила партнёра"
    )

    def entity(needle: str, etype: str, **kwargs) -> MessageEntity:
        idx = text.find(needle)
        if idx < 0:
            raise ValueError(f"video track text missing {needle!r}")
        return MessageEntity(
            type=etype,
            offset=_utf16_len(text[:idx]),
            length=_utf16_len(needle),
            **kwargs,
        )

    return text, [
        entity(star, MessageEntity.CUSTOM_EMOJI, custom_emoji_id=star_id),
        entity(check, MessageEntity.CUSTOM_EMOJI, custom_emoji_id=check_id),
        entity(blue, MessageEntity.CUSTOM_EMOJI, custom_emoji_id=blue_id),
    ]


VIDEO_TRACK_TEXT = video_track_message()[0]

VISITKA_ASK_NAME = (
    "💳 <b>Визитка</b>\n\n"
    "Напишите <b>имя и фамилию</b>, как на визитке.\n"
    "Например: <code>Анна Соколова</code>"
)

VISITKA_ASK_PHONE = (
    "Теперь отправьте <b>номер телефона</b>.\n"
    "Например: <code>+7 999 123 45 67</code>"
)

VISITKA_ASK_TELEGRAM = (
    "И <b>Telegram</b> (username без ссылки).\n"
    "Например: <code>@anna_idera</code> или <code>anna_idera</code>\n\n"
    "Из него сделаем QR для связи."
)

VISITKA_BAD_NAME = "Не понял имя. Пришлите имя и фамилию текстом."
VISITKA_BAD_PHONE = "Не похоже на телефон. Пример: <code>+7 999 123 45 67</code>"
VISITKA_BAD_TELEGRAM = (
    "Не похоже на Telegram-username. Пример: <code>@anna_idera</code>"
)

VISITKA_READY = (
    "Готово! Собираю вашу визитку…"
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
    "21.08.2026\n\n"
    "🗂 <b>Архив мероприятий</b>\n\n"
    "<b>Запись эфира | IDera DETOX</b>\n"
    "Обучение для партнёров: что такое правильный детокс.\n\n"
    "Ксения Митрай разбирает IDera DETOX: как устроена формула, "
    "чего ждать от курса, почему детокс не должен давать резкий эффект "
    "и какую роль играет пищеварительная система.\n\n"
    "Длительность ≈ 1 час 07 мин.\n"
    "Смотреть запись:\n"
    '<a href="https://t.me/ideraofficial/124">https://t.me/ideraofficial/124</a>'
)

PRODUCT_TEXT = (
    "🛍 <b>Продукт</b>\n\n"
    "Каталог, получение, презентация и видеоотзывы."
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
    BTN_PARTNER_SYSTEM: "📋 Система работы партнёров",
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
    BTN_PARTNER_SYSTEM: "IDera_partners.pdf",
    BTN_COMPANY_PRESENTATION: "IDera_company.pdf",
}

DOC_DOWNLOAD_NAMES = {
    BTN_REWARDS: "IDera M.pdf",
    BTN_DETOX: "IDera_DETOX_1.pdf",
    BTN_RELAX: "IDera Relax.pdf",
    BTN_GLOW: "IDera Glow.pdf",
    BTN_FOCUS: "IDera Focus.pdf",
    BTN_PARTNER_SYSTEM: "IDera материалы для партнеров.pdf",
    BTN_COMPANY_PRESENTATION: "IDera презентация компании.pdf",
}

# Финальные файлы — без пометки «черновик»
FINAL_DOCS = {
    BTN_REWARDS,
    BTN_DETOX,
    BTN_RELAX,
    BTN_GLOW,
    BTN_FOCUS,
    BTN_PARTNER_SYSTEM,
    BTN_COMPANY_PRESENTATION,
}

# Navigation: current screen -> parent screen
PARENT = {
    "business": "main",
    "about": "business",
    "partners": "business",
    "materials": "partners",
    "business_tools": "partners",
    "visitka": "business_tools",
    "track": "business_tools",
    "ip_self": "business",
    "self": "ip_self",
    "ip": "ip_self",
    "events": "main",
    "product": "main",
    "presentation": "product",
    "quiz_intro": "main",
    "quiz_goals": "quiz_intro",
    "quiz_step": "quiz_goals",
}
