"""Тексты и кнопки меню IDera HUB (ReplyKeyboard)."""

from __future__ import annotations

from telegram import KeyboardButton, MessageEntity, ReplyKeyboardMarkup

import qual_card

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
BOT_NAME = "IDera HUB"


def idera(name: str) -> str:
    emoji_id, fallback = IDERA_EMOJI[name]
    return f'<tg-emoji emoji-id="{emoji_id}">{fallback}</tg-emoji>'


def idera_fallback(name: str) -> str:
    """Юникод из пака IDera — для кнопок, где кастомные эмодзи недоступны."""
    return IDERA_EMOJI[name][1]


def _utf16_len(text: str) -> int:
    return len(text.encode("utf-16-le")) // 2


def idera_entities(text: str, *names: str) -> list[MessageEntity]:
    """Custom-emoji entities в порядке появления fallback-символов."""
    entities: list[MessageEntity] = []
    pos = 0
    for name in names:
        emoji_id, token = IDERA_EMOJI[name]
        idx = text.find(token, pos)
        if idx < 0:
            raise ValueError(f"text missing IDera emoji {name!r} ({token!r})")
        entities.append(
            MessageEntity(
                type=MessageEntity.CUSTOM_EMOJI,
                offset=_utf16_len(text[:idx]),
                length=_utf16_len(token),
                custom_emoji_id=emoji_id,
            )
        )
        pos = idx + len(token)
    return entities


def welcome_message(*, with_menu_hint: bool = True) -> tuple[str, list[MessageEntity]]:
    """Живое приветствие IDera без перечня разделов."""
    blue_id, blue = IDERA_EMOJI["blue"]
    star_id, star = IDERA_EMOJI["star"]
    rocket_id, rocket = IDERA_EMOJI["rocket"]
    brand = BOT_NAME
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
BTN_MAIN = f"{idera_fallback('blue')} Главное меню"
BTN_FEEDBACK_CANCEL = "✖️ Отмена"

BTN_IP_SELF = "📄 ИП и Самозанятость"
BTN_ABOUT = "ℹ️ О компании"
BTN_ABOUT_US = "👥 О нас"
BTN_COMPANY_PRESENTATION = "🎞 Презентация компании"
BTN_PVZ = "📦 Открыть ПВЗ"
BTN_PARTNERS = "🤝 Материалы для партнеров"
BTN_BUSINESS_TOOLS = "🛠 Бизнес-инструменты"
BTN_VISITKA = "💳 Визитка"
BTN_QUAL = "🏅 Квалификация"
BTN_QUAL_H = "Горизонтальные"
BTN_QUAL_V = "Вертикальные"
BTN_VISITKA_QR = "С QR-кодом"
BTN_VISITKA_LIGHT = "Модель 1"
BTN_VISITKA_BLUE = "Модель 2"
BTN_VISITKA_MODEL3 = "Модель 3"
BTN_VISITKA_USE_NAME = "👤 Вставить имя"
BTN_VISITKA_USE_PHONE = "📱 Вставить номер"
BTN_VISITKA_USE_TELEGRAM = "✈️ Вставить никнейм"
BTN_TRACK = f"{idera_fallback('blue')} IDera GO {idera_fallback('blue')}"
BTN_VIDEO_30S = f"{idera_fallback('rocket')} GO снимать видео за 30 секунд"
BTN_VIDEO_LAUNCH = f"{idera_fallback('rocket')} Запустить"
TRACK_BUTTON_ALIASES = frozenset({"IDera GO", BTN_TRACK})
VIDEO_30S_ALIASES = frozenset({"GO снимать видео за 30 секунд", BTN_VIDEO_30S})
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

BTN_CONSENT_YES = f"{idera_fallback('check')} Согласен"
BTN_CONSENT_NO = "❌ Не согласен"

BTN_QUIZ_START = f"{idera_fallback('rocket')} Начать подбор"
QUIZ_START_ALIASES = frozenset({"Начать подбор", BTN_QUIZ_START})


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
            [BTN_QUAL],
            [BTN_TRACK],
            [BTN_BACK],
        ]
    )


def qual_orient_keyboard() -> ReplyKeyboardMarkup:
    return kb(
        [
            [BTN_QUAL_H],
            [BTN_QUAL_V],
            [BTN_BACK],
        ]
    )


def qual_rank_keyboard() -> ReplyKeyboardMarkup:
    labels = [rank.label for rank in qual_card.RANKS]
    rows: list[list[str]] = []
    for i in range(0, len(labels), 2):
        rows.append(labels[i : i + 2])
    rows.append([BTN_BACK])
    return kb(rows)


def qual_step_keyboard(step: str | None, user=None) -> ReplyKeyboardMarkup:
    rows: list[list[KeyboardButton]] = []
    if step == "name" and _telegram_profile_name(user):
        rows.append([KeyboardButton(BTN_VISITKA_USE_NAME)])
    rows.append([KeyboardButton(BTN_BACK)])
    return ReplyKeyboardMarkup(rows, resize_keyboard=True)


def track_keyboard() -> ReplyKeyboardMarkup:
    return kb(
        [
            [BTN_VIDEO_30S],
            [BTN_BACK],
        ]
    )


def visitka_keyboard() -> ReplyKeyboardMarkup:
    return visitka_step_keyboard("name")


def visitka_step_keyboard(step: str | None, user=None) -> ReplyKeyboardMarkup:
    """Ввод вручную или кнопка подставить данные из Telegram."""
    rows: list[list[KeyboardButton]] = []
    if step == "name" and _telegram_profile_name(user):
        rows.append([KeyboardButton(BTN_VISITKA_USE_NAME)])
    elif step == "phone":
        rows.append(
            [KeyboardButton(BTN_VISITKA_USE_PHONE, request_contact=True)]
        )
    elif step == "telegram" and getattr(user, "username", None):
        rows.append([KeyboardButton(BTN_VISITKA_USE_TELEGRAM)])
    rows.append([KeyboardButton(BTN_BACK)])
    return ReplyKeyboardMarkup(rows, resize_keyboard=True)


def _telegram_profile_name(user) -> str:
    if user is None:
        return ""
    parts = [
        str(getattr(user, "first_name", None) or "").strip(),
        str(getattr(user, "last_name", None) or "").strip(),
    ]
    return " ".join(p for p in parts if p)


def visitka_pick_keyboard() -> ReplyKeyboardMarkup:
    return kb(
        [
            [BTN_VISITKA_QR],
            [BTN_VISITKA_LIGHT],
            [BTN_VISITKA_BLUE],
            [BTN_VISITKA_MODEL3],
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


def feedback_keyboard() -> ReplyKeyboardMarkup:
    return kb([[BTN_FEEDBACK_CANCEL], [BTN_BACK]])


CONSENT_TEXT = (
    f"{idera('check')} <b>Согласие на обработку персональных данных</b>\n\n"
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
    f"{idera('check')} Спасибо! Согласие получено.\n\n"
    f"Выберите раздел в главном меню {idera('blue')}"
)

CONSENT_PDF = "Soglasie_na_obrabotku_personalnyh_dannyh.pdf"
CONSENT_PDF_FILENAME = "Согласие на обработку персональных данных.pdf"

WELCOME_CAPTION = (
    f"{idera('blue')} Привет. Это <b>{BOT_NAME}</b>.\n\n"
    f"{idera('star')} Тихий ориентир, когда хочется ясности "
    "и спокойного шага вперёд.\n\n"
    f"Кнопки уже внизу. Выбирай то, что откликается — я рядом {idera('rocket')}"
)

MAIN_TEXT = f"{idera('blue')} <b>Главное меню</b>"

FEEDBACK_PROMPT_TEXT = (
    f"{idera('blue')} <b>Книга жалоб и предложений</b>\n\n"
    "Напишите одним сообщением, что важно сказать команде IDera: "
    "жалобу, идею или пожелание.\n\n"
    "Чтобы передумать — нажмите «Отмена» или /menu."
)

FEEDBACK_THANKS_TEXT = (
    f"{idera('check')} <b>Спасибо, мы получили ваше сообщение.</b>\n\n"
    "Команда IDera его увидит."
)

FEEDBACK_CANCEL_TEXT = (
    "Обратную связь отменили. Можете продолжить с меню ниже."
)

FEEDBACK_TOO_SHORT_TEXT = (
    "Напишите чуть подробнее — одним сообщением.\n"
    "Или нажмите «Отмена»."
)

SERVICE_LINKED_CHAT_TEXT = (
    "📥 Этот канал привязан как служебный ящик IDera HUB.\n\n"
    "Сюда будут приходить обращения из книги жалоб и предложений.\n"
    "Никого сюда не добавляйте — тогда сообщения видите только вы."
)

BUSINESS_TEXT = (
    f"{idera('blue')} <b>Бизнес</b>\n\n"
    "Здесь всё для партнёров: оформление, материалы, вознаграждения и рост.\n"
    f"Выбери нужный раздел {idera('blue')}"
)

IP_SELF_TEXT = (
    f"{idera('blue')} <b>ИП и Самозанятость</b>\n\n"
    "Выбери формат работы — открою нужные документы и инструкции."
)

SELF_TEXT = (
    f"{idera('blue')} <b>Самозанятость</b>\n\n"
    "Документы и шаблоны для самозанятых партнёров.\n"
    "Нажми кнопку — пришлю PDF (пока черновик, позже заменим на финальный файл)."
)

IP_TEXT = (
    f"{idera('blue')} <b>ИП</b>\n\n"
    "Документы, заявление, оферта и банковские условия для открытия ИП.\n"
    "Нажми кнопку — пришлю PDF."
)

ABOUT_TEXT = (
    f"{idera('blue')} <b>О компании</b>\n\n"
    "Узнай больше об IDera и посмотри презентацию.\n"
    f"Выбери раздел {idera('blue')}"
)

ABOUT_US_TEXT = (
    f"{idera('blue')} <b>IDera — компания нового поколения, которая растёт "
    "вместе с партнёрами.</b>\n\n"
    "<b>IDera объединяет продукт, технологии, предпринимательство и развитие "
    "человека в одну систему.</b>\n\n"
    f"{idera('star')} <b>Продукты IDera — часть ежедневной системы заботы о себе.</b>\n"
    "Сегодня в экосистеме уже развиваются направления "
    "<b>RELAX, DETOX, GLOW, FOCUS и новые продукты, каждый со своей задачей "
    "и своим местом в повседневной жизни.</b>\n\n"
    f"{idera('rocket')} <b>IDera развивается как полноценная партнёрская "
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
    f"{idera('check')} <b>Мы растём. И вместе с ростом меняется сама IDera.</b>\n\n"
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
    f"{idera('blue')} <b>IDera — это движение вперёд.</b>\n\n"
    "Продукт становится системой.\n"
    "Обучение становится действием.\n"
    "Опыт лидеров становится технологией.\n"
    "А отдельные партнёры становятся сильной, растущей сетью.\n\n"
    f"<b>IDera — МОЖНО БОЛЬШЕ.</b> {idera('blue')}"
)

PVZ_TEXT = (
    f"{idera('blue')} <b>Открыть ПВЗ</b>\n\n"
    "Инструкция и требования к пункту выдачи появятся здесь.\n"
    "Пока раздел-заглушка — структуру кнопок уже заложили."
)

PARTNERS_TEXT = (
    f"{idera('blue')} <b>Материалы для партнёров</b>\n\n"
    "Бизнес-инструменты и файлы для работы с клиентами.\n"
    f"Выбери раздел {idera('blue')}"
)

MATERIALS_TEXT = (
    f"{idera('blue')} <b>Материалы</b>\n\n"
    "Система работы партнёров, стикеры и эмодзи IDera.\n"
    f"Выбери, что нужно {idera('blue')}"
)

STICKER_PACK_NAME = "IDera3"
STICKER_PACK_URL = "https://t.me/addstickers/IDera3"
STICKER_PACK_TEXT = (
    f"{idera('star')} <b>Стикеры IDera</b>\n\n"
    "Набор для переписок и сторис.\n"
    f'<a href="{STICKER_PACK_URL}">Добавить себе</a>\n'
    f"{STICKER_PACK_URL}"
)

EMOJI_PACK_NAME = IDERA_PACK
EMOJI_PACK_URL = "https://t.me/addemoji/IDera"
EMOJI_PACK_TEXT = (
    f"{idera('star')} <b>Эмодзи IDera</b>\n\n"
    "Кастомные эмодзи для сообщений.\n"
    f'<a href="{EMOJI_PACK_URL}">Добавить себе</a>\n'
    f"{EMOJI_PACK_URL}"
)

PACK_PREVIEW_LIMIT = 6

BUSINESS_TOOLS_TEXT = (
    f"{idera('blue')} <b>Бизнес-инструменты</b>\n\n"
    f"Визитка, карточка квалификации и {idera('blue')} IDera GO {idera('blue')}.\n"
    f"Выбери, с чего начать {idera('rocket')}"
)

QUAL_ORIENT_TEXT = (
    f"{idera('star')} <b>Карточка квалификации</b>\n\n"
    "Соберу поздравление с фото и именем: выбери формат, ранг, "
    "затем пришли портрет.\n\n"
    "Горизонтальные — для поста. Вертикальные — для сторис."
)

QUAL_RANK_TEXT = (
    f"{idera('blue')} <b>Квалификация</b>\n\n"
    "Выбери ранг — пришлю превью макета, затем вставим фото и имя."
)

QUAL_ORIENT_BUTTONS = {
    BTN_QUAL_H: qual_card.ORIENT_H,
    BTN_QUAL_V: qual_card.ORIENT_V,
}

QUAL_RANK_BUTTONS = {rank.label: rank.id for rank in qual_card.RANKS}

QUAL_ASK_PHOTO = (
    "Пришлите <b>фото</b> — лучше портрет, лицо крупно.\n"
    "Вставлю его в рамку на карточке."
)

QUAL_NEED_PHOTO = "Нужно именно фото. Отправьте снимок как фото или файл-картинку."

QUAL_BAD_PHOTO = "Не смог прочитать снимок. Пришлите другое фото."

QUAL_ASK_NAME = (
    "Напишите <b>имя и фамилию</b>, как на карточке.\n"
    "Например: <code>Анна Соколова</code>\n\n"
    "Или нажмите кнопку внизу — подставлю имя из Telegram."
)

QUAL_BAD_NAME = "Не понял имя. Пришлите имя и фамилию текстом."

QUAL_READY = f"{idera('check')} Готово! Собираю карточку…"

TRACK_TEXT = (
    f"{idera('blue')} IDera GO {idera('blue')}\n\n"
    f"Выбери цель → пройди маршрут → сделай. {idera('rocket')}"
)

VIDEO_WIZARD_URL = "https://video-creator-track.vercel.app"


def track_cover_message() -> tuple[str, list[MessageEntity]]:
    """Обложка IDera GO с фирменными эмодзи."""
    blue = idera_fallback("blue")
    rocket = idera_fallback("rocket")
    text = (
        f"{blue} IDera GO {blue}\n\n"
        f"Выбери цель → пройди маршрут → сделай. {rocket}"
    )
    return text, idera_entities(text, "blue", "blue", "rocket")


def video_track_message() -> tuple[str, list[MessageEntity]]:
    """Короткий текст карточки трека с фирменными эмодзи IDera."""
    star = idera_fallback("star")
    check = idera_fallback("check")
    blue = idera_fallback("blue")
    rocket = idera_fallback("rocket")
    text = (
        f"{rocket} Сними видео о продукте за 30 секунд\n\n"
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
    return text, idera_entities(text, "rocket", "star", "check", "blue")


VIDEO_TRACK_TEXT = video_track_message()[0]

VISITKA_PICK_TEXT = (
    f"{idera('blue')} <b>Визитка</b>\n\n"
    "Выбери макет — пришлю превью, затем заполним твои данные."
)

VISITKA_TEMPLATE_BUTTONS = {
    BTN_VISITKA_QR: "qr",
    BTN_VISITKA_LIGHT: "light",
    BTN_VISITKA_BLUE: "blue",
    BTN_VISITKA_MODEL3: "model3",
}

VISITKA_ASK_NAME = (
    "Напишите <b>имя и фамилию</b>, как на визитке.\n"
    "Например: <code>Анна Соколова</code>\n\n"
    "Или нажмите кнопку внизу — подставлю имя из Telegram."
)

VISITKA_ASK_PHONE = (
    "Теперь отправьте <b>номер телефона</b>.\n"
    "Например: <code>+7 999 123 45 67</code>\n\n"
    "Или нажмите «Вставить номер» — Telegram подставит телефон из вашей карточки."
)

VISITKA_ASK_TELEGRAM = (
    "И <b>Telegram</b> (username без ссылки).\n"
    "Например: <code>@anna_idera</code> или <code>anna_idera</code>\n\n"
    "Из него сделаем QR для связи.\n"
    "Если внизу есть кнопка — можно подставить ваш никнейм одним нажатием."
)

VISITKA_BAD_NAME = "Не понял имя. Пришлите имя и фамилию текстом."
VISITKA_BAD_PHONE = "Не похоже на телефон. Пример: <code>+7 999 123 45 67</code>"
VISITKA_BAD_TELEGRAM = (
    "Не похоже на Telegram-username. Пример: <code>@anna_idera</code>"
)

VISITKA_READY = (
    f"{idera('check')} Готово! Собираю вашу визитку…"
)

AWARDS_TEXT = (
    f"{idera('star')} <b>Номинации и лауреатства</b>\n\n"
    "Наши награды и достижения. Раздел готов к наполнению."
)

REWARDS_TEXT = (
    f"{idera('blue')} <b>Система вознаграждений</b>\n\n"
    "Порядок получения вознаграждений и бонусов.\n"
    "Детали и таблицы добавим позже."
)

EVENTS_TEXT = (
    f"{idera('blue')} <b>Мероприятия</b>\n\n"
    "Благотворительность, ближайшие события и архив."
)

CHARITY_TEXT = (
    f"{idera('star')} <b>Благотворительный фонд</b>\n\n"
    "Информация о фонде и участии появится здесь."
)

UPCOMING_TEXT = (
    f"{idera('rocket')} <b>Предстоящие мероприятия</b>\n\n"
    "Ближайшие встречи и эфиры.\n"
    f"Выбери запись {idera('blue')}"
)

# Новые эфиры добавляются сюда — кнопка собирается из date + name.
UPCOMING_EVENTS: list[dict[str, str]] = [
    {
        "date": "26–28.08.2026",
        "name": "Старт в IDera",
        "url": "https://t.me/ideraofficial/127",
        "title": "Старт в IDera | Разбираемся вместе",
        "body": (
            "Двухдневный интенсив для новых партнёров с Дианой Хадиуллиной — "
            "топ-лидером, обладателем первого контракта и первого чека компании.\n\n"
            "26 августа, 19:00 МСК — база сетевого предпринимательства, "
            "бизнес-модель IDera и первые шаги после регистрации.\n\n"
            "28 августа, 19:00 МСК — маркетинг-план IDera: система роста, "
            "бонусы и возможности для партнёров.\n\n"
            "Подключиться можно, даже если вы пока только присматриваетесь к IDera."
        ),
    },
]

ARCHIVE_TEXT = (
    f"{idera('blue')} <b>Архив мероприятий</b>\n\n"
    "Здесь прошедшие мероприятия.\n"
    f"Выбери запись {idera('blue')}"
)

# Новые эфиры добавляются сюда — кнопка в архиве собирается из date + name.
ARCHIVE_EVENTS: list[dict[str, str]] = [
    {
        "date": "21.08.2026",
        "name": "IDera DETOX",
        "url": "https://t.me/ideraofficial/124",
        "title": "Запись эфира | IDera DETOX",
        "body": (
            "Обучение для партнёров: что такое правильный детокс.\n\n"
            "Ксения Митрай разбирает IDera DETOX: как устроена формула, "
            "чего ждать от курса, почему детокс не должен давать резкий эффект "
            "и какую роль играет пищеварительная система.\n\n"
            "Длительность ≈ 1 час 07 мин."
        ),
    },
]


def archive_button_label(event: dict[str, str]) -> str:
    """ReplyKeyboard: дата и название. В Telegram не больше 64 символов."""
    return f"{event['date']} | {event['name']}"[:64]


def archive_event_text(event: dict[str, str]) -> str:
    url = event["url"]
    return (
        f"{event['date']}\n\n"
        f"<b>{event['title']}</b>\n"
        f"{event['body']}\n\n"
        "Смотреть запись:\n"
        f'<a href="{url}">{url}</a>'
    )


def upcoming_button_label(event: dict[str, str]) -> str:
    """ReplyKeyboard: дата и название. В Telegram не больше 64 символов."""
    return f"{event['date']} | {event['name']}"[:64]


def upcoming_event_text(event: dict[str, str]) -> str:
    url = event["url"]
    return (
        f"{event['date']}\n\n"
        f"<b>{event['title']}</b>\n"
        f"{event['body']}\n\n"
        "Подробности и подключение:\n"
        f'<a href="{url}">{url}</a>'
    )


def upcoming_keyboard() -> ReplyKeyboardMarkup:
    rows = [[upcoming_button_label(event)] for event in UPCOMING_EVENTS]
    rows.append([BTN_BACK])
    return kb(rows)


UPCOMING_BY_BUTTON = {
    upcoming_button_label(event): event for event in UPCOMING_EVENTS
}
if len(UPCOMING_BY_BUTTON) != len(UPCOMING_EVENTS):
    raise ValueError("Upcoming events must have unique date + name buttons")


def archive_keyboard() -> ReplyKeyboardMarkup:
    rows = [[archive_button_label(event)] for event in ARCHIVE_EVENTS]
    rows.append([BTN_BACK])
    return kb(rows)


ARCHIVE_BY_BUTTON = {
    archive_button_label(event): event for event in ARCHIVE_EVENTS
}
if len(ARCHIVE_BY_BUTTON) != len(ARCHIVE_EVENTS):
    raise ValueError("Archive events must have unique date + name buttons")

PRODUCT_TEXT = (
    f"{idera('blue')} <b>Продукт</b>\n\n"
    "Каталог, получение, презентация и видеоотзывы."
)

CATALOG_TEXT = (
    f"{idera('blue')} <b>Каталог IDera</b>\n\n"
    "Открыть магазин:\n"
    '<a href="https://shop.idera.io/catalog">https://shop.idera.io/catalog</a>'
)

HOW_GET_TEXT = (
    f"{idera('blue')} <b>Как получить продукт</b>\n\n"
    "Пошаговая инструкция появления заказа появится здесь."
)

PRESENTATION_TEXT = (
    f"{idera('star')} <b>Презентация</b>\n\n"
    f"Выбери материал {idera('blue')}"
)

VIDEO_TEXT = (
    f"{idera('fire')} <b>Видеоотзывы</b>\n\n"
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

MENU_LABELS = frozenset(
    {
        value
        for name, value in globals().items()
        if name.startswith("BTN_") and isinstance(value, str)
    }
    | TRACK_BUTTON_ALIASES
    | VIDEO_30S_ALIASES
    | QUIZ_START_ALIASES
    | set(ARCHIVE_BY_BUTTON)
    | set(UPCOMING_BY_BUTTON)
    | set(QUAL_RANK_BUTTONS)
    | {"🏠 Главное меню"}
)

# Navigation: current screen -> parent screen
PARENT = {
    "feedback": "main",
    "business": "main",
    "about": "business",
    "partners": "business",
    "materials": "partners",
    "business_tools": "partners",
    "visitka_pick": "business_tools",
    "visitka": "visitka_pick",
    "qual_orient": "business_tools",
    "qual_rank": "qual_orient",
    "qual": "qual_rank",
    "track": "business_tools",
    "ip_self": "business",
    "self": "ip_self",
    "ip": "ip_self",
    "events": "main",
    "upcoming": "events",
    "upcoming_item": "upcoming",
    "archive": "events",
    "archive_item": "archive",
    "product": "main",
    "presentation": "product",
    "quiz_intro": "main",
    "quiz_goals": "quiz_intro",
    "quiz_step": "quiz_goals",
}
