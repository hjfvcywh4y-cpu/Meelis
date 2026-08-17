#!/usr/bin/env python3
"""Telegram-бот-наставник по нейросетям + Gemini для свободных вопросов."""

from __future__ import annotations

import logging
import os
import sys
from collections import defaultdict, deque

from dotenv import load_dotenv
from openai import AsyncOpenAI
from telegram import (
    BotCommand,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    MenuButtonCommands,
    Update,
)
from telegram.constants import ChatAction
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

from lessons import (
    CATEGORY_INTRO,
    CHAT_LESSON,
    CHOOSE_GUIDE,
    IMAGE_STRATEGY,
    NETWORK_ORDER,
    NETWORKS,
    PROMPTS_LESSON,
    START_GUIDE,
)
from stats import admin_ids, record_user, snapshot

load_dotenv()

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

GEMINI_BASE_URL = os.getenv(
    "GEMINI_BASE_URL",
    "https://generativelanguage.googleapis.com/v1beta/openai/",
).rstrip("/") + "/"
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest")
GEMINI_FALLBACK_MODELS = [
    m.strip()
    for m in os.getenv(
        "GEMINI_FALLBACK_MODELS",
        "gemini-flash-latest,gemini-3.6-flash",
    ).split(",")
    if m.strip()
]
GROQ_BASE_URL = os.getenv(
    "GROQ_BASE_URL",
    "https://api.groq.com/openai/v1",
).rstrip("/")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_FALLBACK_MODELS = [
    m.strip()
    for m in os.getenv(
        "GROQ_FALLBACK_MODELS",
        "llama-3.1-8b-instant,gemma2-9b-it",
    ).split(",")
    if m.strip()
]
SYSTEM_PROMPT = os.getenv(
    "AI_SYSTEM_PROMPT",
    os.getenv(
        "GEMINI_SYSTEM_PROMPT",
        (
            "Ты дружелюбный наставник по нейросетям. "
            "Объясняй просто, по шагам, на русском, с эмодзи умеренно. "
            "Помогай с регистрацией (в т.ч. из РФ через VPN), промптами, "
            "постами, возражениями, картинками и видео. "
            "Не обещай доход и не дави на продажи. "
            "Не выдумывай оплату/лимиты как точные факты — говори осторожно."
        ),
    ),
)
MAX_HISTORY = int(os.getenv("AI_MAX_HISTORY", os.getenv("GEMINI_MAX_HISTORY", "20")))

_histories: dict[int, deque[dict[str, str]]] = defaultdict(
    lambda: deque(maxlen=MAX_HISTORY)
)
# chat_id -> message_ids (чтобы /clear мог удалить переписку)
_tracked_messages: dict[int, list[int]] = defaultdict(list)
_gemini_client: AsyncOpenAI | None = None
_groq_client: AsyncOpenAI | None = None


def track_message(chat_id: int, message_id: int | None) -> None:
    if message_id is None:
        return
    ids = _tracked_messages[chat_id]
    ids.append(message_id)
    if len(ids) > 120:
        _tracked_messages[chat_id] = ids[-120:]


async def delete_tracked_messages(bot, chat_id: int) -> int:
    ids = _tracked_messages.pop(chat_id, [])
    deleted = 0
    for mid in ids:
        try:
            await bot.delete_message(chat_id=chat_id, message_id=mid)
            deleted += 1
        except Exception:
            continue
    return deleted



def get_gemini_client() -> AsyncOpenAI | None:
    global _gemini_client
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None
    if _gemini_client is None:
        _gemini_client = AsyncOpenAI(
            api_key=api_key,
            base_url=GEMINI_BASE_URL,
            timeout=45.0,
            max_retries=1,
        )
    return _gemini_client


def get_groq_client() -> AsyncOpenAI | None:
    global _groq_client
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        return None
    if _groq_client is None:
        _groq_client = AsyncOpenAI(
            api_key=api_key,
            base_url=GROQ_BASE_URL,
            timeout=45.0,
            max_retries=1,
        )
    return _groq_client


def provider_chains() -> list[tuple[str, AsyncOpenAI, list[str]]]:
    """Порядок: сначала Gemini, потом запасной Groq."""
    chains: list[tuple[str, AsyncOpenAI, list[str]]] = []
    gemini = get_gemini_client()
    if gemini is not None:
        models = [GEMINI_MODEL, *[m for m in GEMINI_FALLBACK_MODELS if m != GEMINI_MODEL]]
        chains.append(("gemini", gemini, models))
    groq = get_groq_client()
    if groq is not None:
        models = [GROQ_MODEL, *[m for m in GROQ_FALLBACK_MODELS if m != GROQ_MODEL]]
        chains.append(("groq", groq, models))
    return chains


async def ask_ai(chat_id: int, user_text: str) -> str:
    history = _histories[chat_id]
    history.append({"role": "user", "content": user_text})
    messages = [{"role": "system", "content": SYSTEM_PROMPT}, *history]
    last_error: Exception | None = None
    chains = provider_chains()
    if not chains:
        if history and history[-1].get("role") == "user":
            history.pop()
        raise RuntimeError("Нет настроенных AI-ключей (GEMINI_API_KEY / GROQ_API_KEY)")

    for provider, client, models in chains:
        for model in models:
            try:
                response = await client.chat.completions.create(
                    model=model,
                    messages=messages,
                )
                reply = (response.choices[0].message.content or "").strip()
                if not reply:
                    reply = "Пустой ответ от модели. Попробуйте ещё раз."
                history.append({"role": "assistant", "content": reply})
                if provider != "gemini" or model != GEMINI_MODEL:
                    logger.info("Ответ через %s / %s", provider, model)
                return reply
            except Exception as exc:
                last_error = exc
                logger.warning("%s/%s недоступен: %s", provider, model, exc)

    assert last_error is not None
    if history and history[-1].get("role") == "user":
        history.pop()
    raise last_error


# Обратная совместимость для старых импортов/тестов
async def ask_gemini(chat_id: int, user_text: str) -> str:
    return await ask_ai(chat_id, user_text)



def split_message(text: str, limit: int = 3900) -> list[str]:
    if len(text) <= limit:
        return [text]
    chunks: list[str] = []
    while text:
        chunks.append(text[:limit])
        text = text[limit:]
    return chunks


async def send_long_message(
    message,
    text: str,
    reply_markup: InlineKeyboardMarkup | None = None,
    edit: bool = False,
    track: bool = True,
) -> None:
    chat_id = message.chat_id
    chunks = split_message(text)
    if edit and message is not None:
        edited = await message.edit_text(
            chunks[0],
            reply_markup=reply_markup if len(chunks) == 1 else None,
            disable_web_page_preview=True,
        )
        if track:
            track_message(chat_id, getattr(edited, "message_id", message.message_id))
        for i, chunk in enumerate(chunks[1:], start=1):
            markup = reply_markup if i == len(chunks) - 1 else None
            sent = await message.reply_text(
                chunk,
                reply_markup=markup,
                disable_web_page_preview=True,
            )
            if track:
                track_message(chat_id, sent.message_id)
        return

    for i, chunk in enumerate(chunks):
        markup = reply_markup if i == len(chunks) - 1 else None
        sent = await message.reply_text(
            chunk,
            reply_markup=markup,
            disable_web_page_preview=True,
        )
        if track:
            track_message(chat_id, sent.message_id)


def main_menu_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("🚀 С чего начать", callback_data="menu:startguide")],
            [InlineKeyboardButton("🧭 Какую нейросеть выбрать", callback_data="menu:choose")],
            [InlineKeyboardButton("🤖 Выбрать нейросеть (15)", callback_data="menu:nets")],
            [
                InlineKeyboardButton("📝 Текст", callback_data="menu:cat:text"),
                InlineKeyboardButton("🖼️ Картинки", callback_data="menu:cat:image"),
            ],
            [
                InlineKeyboardButton("🎬 Видео", callback_data="menu:cat:video"),
                InlineKeyboardButton("✍️ Промпты", callback_data="menu:prompts"),
            ],
            [InlineKeyboardButton("🎨 Стратегия картинок", callback_data="menu:imagestrategy")],
            [InlineKeyboardButton("💬 Как общаться с ИИ", callback_data="menu:chat")],
            [InlineKeyboardButton("🧠 Спросить наставника текстом", callback_data="menu:ask")],
        ]
    )


def nets_keyboard() -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    row: list[InlineKeyboardButton] = []
    for net_id in NETWORK_ORDER:
        net = NETWORKS[net_id]
        row.append(
            InlineKeyboardButton(
                f"{net['emoji']} {net['title']}",
                callback_data=f"net:{net_id}",
            )
        )
        if len(row) == 2:
            rows.append(row)
            row = []
    if row:
        rows.append(row)
    rows.append([InlineKeyboardButton("🏠 Главное меню", callback_data="menu:home")])
    return InlineKeyboardMarkup(rows)


def net_actions_keyboard(net_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    "🔧 Регистрация / VPN",
                    callback_data=f"step:{net_id}:install",
                )
            ],
            [
                InlineKeyboardButton(
                    "🛠 Как пользоваться",
                    callback_data=f"step:{net_id}:use",
                )
            ],
            [
                InlineKeyboardButton(
                    "📌 Промпты (несколько)",
                    callback_data=f"step:{net_id}:prompt",
                )
            ],
            [
                InlineKeyboardButton("🔙 К списку", callback_data="menu:nets"),
                InlineKeyboardButton("🏠 Меню", callback_data="menu:home"),
            ],
        ]
    )


def back_home_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [[InlineKeyboardButton("🏠 Главное меню", callback_data="menu:home")]]
    )


def category_nets(kind_key: str) -> list[str]:
    mapping = {
        "text": {"Текст", "Поиск"},
        "image": {"Картинки"},
        "video": {"Видео"},
    }
    kinds = mapping[kind_key]
    return [nid for nid in NETWORK_ORDER if NETWORKS[nid]["kind"] in kinds]


def category_keyboard(kind_key: str) -> InlineKeyboardMarkup:
    rows: list[list[InlineKeyboardButton]] = []
    row: list[InlineKeyboardButton] = []
    for net_id in category_nets(kind_key):
        net = NETWORKS[net_id]
        row.append(
            InlineKeyboardButton(
                f"{net['emoji']} {net['title']}",
                callback_data=f"net:{net_id}",
            )
        )
        if len(row) == 2:
            rows.append(row)
            row = []
    if row:
        rows.append(row)
    rows.append([InlineKeyboardButton("🏠 Главное меню", callback_data="menu:home")])
    return InlineKeyboardMarkup(rows)


def welcome_text(name: str) -> str:
    return (
        f"👋 Привет, {name}!\n\n"
        "Я научу тебя пользоваться нейросетями — с нуля 🚀\n"
        "Разберём регистрацию (в том числе из РФ через VPN), "
        "посты и возражения, картинки, видео, промпты и сценарии.\n\n"
        "💬 Важно: этот чат тоже можно использовать как нейросеть.\n"
        "Просто напиши мне текстом вопрос или задачу — отвечу как наставник.\n"
        "Например: «напиши ответ на возражение: нет времени».\n\n"
        "Сначала выбери кнопку ниже 👇\n"
        "Потом меню всегда в кнопке Menu слева от поля ввода "
        "(рядом со скрепкой 📎). Команда /clear очищает чат."
    )


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    name = user.first_name if user and user.first_name else "друг"
    record_user(
        user.id if user else None,
        event="start",
        username=user.username if user else None,
        first_name=name,
    )
    if update.effective_chat:
        _histories.pop(update.effective_chat.id, None)
    if update.message:
        track_message(update.effective_chat.id, update.message.message_id)
    await send_long_message(
        update.message,
        welcome_text(name),
        reply_markup=main_menu_keyboard(),
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.message and update.effective_chat:
        track_message(update.effective_chat.id, update.message.message_id)
    await send_long_message(
        update.message,
        "ℹ️ Команды (кнопка Menu рядом с полем ввода 📎):\n"
        "/start — приветствие и меню уроков\n"
        "/menu — открыть меню уроков\n"
        "/clear — очистить чат и память диалога\n"
        "/help — справка\n"
        "/ping — проверка\n"
        "/id — ваш Telegram ID\n\n"
        "💬 Можно просто писать текстом — отвечу как нейросеть.\n"
        "Во время обычной переписки кнопки меню не показываю.",
        reply_markup=None,
    )


async def menu_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.message and update.effective_chat:
        track_message(update.effective_chat.id, update.message.message_id)
    sent = await update.message.reply_text(
        "🏠 Меню уроков:",
        reply_markup=main_menu_keyboard(),
    )
    if update.effective_chat:
        track_message(update.effective_chat.id, sent.message_id)


async def clear_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.effective_chat or not update.message:
        return
    chat_id = update.effective_chat.id
    _histories.pop(chat_id, None)
    track_message(chat_id, update.message.message_id)
    deleted = await delete_tracked_messages(context.bot, chat_id)
    try:
        await update.message.delete()
    except Exception:
        pass
    sent = await context.bot.send_message(
        chat_id=chat_id,
        text=(
            "🧹 Чат очищен.\n"
            f"Удалено сообщений: {deleted}. Память диалога сброшена.\n\n"
            "Меню уроков — кнопка Menu слева от поля ввода "
            "(рядом со скрепкой) или команда /menu."
        ),
    )
    track_message(chat_id, sent.message_id)


def _is_admin(user_id: int | None) -> bool:
    allowed = admin_ids()
    if not allowed:
        return True
    return bool(user_id and user_id in allowed)


async def id_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if not update.message or not user:
        return
    sent = await update.message.reply_text(
        f"Ваш Telegram ID: `{user.id}`",
        parse_mode="Markdown",
    )
    if update.effective_chat:
        track_message(update.effective_chat.id, update.message.message_id)
        track_message(update.effective_chat.id, sent.message_id)


async def stats_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if not update.message:
        return
    if not _is_admin(user.id if user else None):
        await update.message.reply_text("Эта команда только для владельца бота.")
        return
    data = snapshot()
    text = (
        "📊 Статистика бота\n\n"
        f"👥 Уникальных людей: {data['unique_users']}\n"
        f"🚀 Нажали /start: {data['starts']}\n"
        f"💬 Текстовых сообщений: {data['messages']}\n"
        f"🔘 Нажатий по кнопкам: {data['callbacks']}\n\n"
        "Счёт идёт с момента этого обновления. "
        "После нового деплоя Railway цифры могут сброситься, "
        "если нет постоянного диска."
    )
    sent = await update.message.reply_text(text)
    if update.effective_chat:
        track_message(update.effective_chat.id, update.message.message_id)
        track_message(update.effective_chat.id, sent.message_id)


async def ping(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.message and update.effective_chat:
        track_message(update.effective_chat.id, update.message.message_id)
    sent = await update.message.reply_text("pong ✅")
    if update.effective_chat:
        track_message(update.effective_chat.id, sent.message_id)


async def on_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query or not query.message:
        return
    await query.answer()
    user = update.effective_user
    record_user(
        user.id if user else None,
        event="callback",
        username=user.username if user else None,
        first_name=user.first_name if user else None,
    )
    data = query.data or ""

    if data in {"menu:home", "menu:main"}:
        name = update.effective_user.first_name if update.effective_user else "друг"
        await send_long_message(
            query.message,
            welcome_text(name),
            reply_markup=main_menu_keyboard(),
            edit=True,
        )
        return

    if data == "menu:startguide":
        await send_long_message(
            query.message,
            START_GUIDE,
            reply_markup=back_home_keyboard(),
            edit=True,
        )
        return

    if data == "menu:choose":
        await send_long_message(
            query.message,
            CHOOSE_GUIDE,
            reply_markup=back_home_keyboard(),
            edit=True,
        )
        return

    if data == "menu:nets":
        await send_long_message(
            query.message,
            "🤖 Выбери нейросеть (15 шт.).\n"
            "Дальше открою: 🔧 регистрация/VPN → 🛠 использование → 📌 несколько промптов.",
            reply_markup=nets_keyboard(),
            edit=True,
        )
        return

    if data == "menu:prompts":
        await send_long_message(
            query.message,
            PROMPTS_LESSON,
            reply_markup=back_home_keyboard(),
            edit=True,
        )
        return

    if data == "menu:imagestrategy":
        await send_long_message(
            query.message,
            IMAGE_STRATEGY,
            reply_markup=back_home_keyboard(),
            edit=True,
        )
        return

    if data == "menu:chat":
        await send_long_message(
            query.message,
            CHAT_LESSON,
            reply_markup=back_home_keyboard(),
            edit=True,
        )
        return

    if data == "menu:ask":
        await send_long_message(
            query.message,
            "🧠 Напиши обычным сообщением свой вопрос — отвечу как нейросеть.\n\n"
            "Примеры:\n"
            "• «Напиши ответ на: у меня нет времени»\n"
            "• «Сделай 5 хуков для Reels про команду»\n"
            "• «Составь промпт для обложки сторис с текстом СТАРТ»",
            reply_markup=back_home_keyboard(),
            edit=True,
        )
        return

    if data.startswith("menu:cat:"):
        kind = data.split(":")[-1]
        intro = CATEGORY_INTRO.get(kind)
        if not intro:
            await send_long_message(
                query.message,
                "Раздел не найден.",
                reply_markup=back_home_keyboard(),
                edit=True,
            )
            return
        await send_long_message(
            query.message,
            intro + "\n\nВыбери сервис 👇",
            reply_markup=category_keyboard(kind),
            edit=True,
        )
        return

    if data.startswith("net:"):
        net_id = data.split(":", 1)[1]
        net = NETWORKS.get(net_id)
        if not net:
            await send_long_message(
                query.message,
                "Не нашёл эту нейросеть.",
                reply_markup=nets_keyboard(),
                edit=True,
            )
            return
        text = (
            f"{net['emoji']} {net['title']} · {net['kind']}\n\n"
            f"{net['blurb']}\n\n"
            f"🎯 Лучше всего для: {net.get('best_for', 'универсальных задач')}\n"
            f"🔗 Сайт: {net['site']}\n\n"
            "Что открыть дальше?"
        )
        await send_long_message(
            query.message,
            text,
            reply_markup=net_actions_keyboard(net_id),
            edit=True,
        )
        return

    if data.startswith("step:"):
        _, net_id, step = data.split(":", 2)
        net = NETWORKS.get(net_id)
        if not net or step not in {"install", "use", "prompt"}:
            await send_long_message(
                query.message,
                "Урок не найден.",
                reply_markup=back_home_keyboard(),
                edit=True,
            )
            return
        titles = {
            "install": "🔧 Регистрация / VPN",
            "use": "🛠 Как пользоваться",
            "prompt": "📌 Готовые промпты",
        }
        body = net[step]
        text = f"{net['emoji']} {net['title']} — {titles[step]}\n\n{body}"
        await send_long_message(
            query.message,
            text,
            reply_markup=net_actions_keyboard(net_id),
            edit=True,
        )
        return

    await send_long_message(
        query.message,
        "Не понял кнопку. Открой меню заново: /start",
        reply_markup=main_menu_keyboard(),
        edit=True,
    )


async def chat(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.message.text or not update.effective_chat:
        return

    text = update.message.text.strip()
    if not text:
        return

    chat_id = update.effective_chat.id
    user = update.effective_user
    record_user(
        user.id if user else None,
        event="message",
        username=user.username if user else None,
        first_name=user.first_name if user else None,
    )
    track_message(chat_id, update.message.message_id)

    await update.message.chat.send_action(ChatAction.TYPING)
    try:
        reply = await ask_ai(chat_id, text)
    except Exception:
        logger.exception("Ошибка AI API (Gemini/Groq)")
        sent = await update.message.reply_text(
            "Сейчас наставник недоступен (лимит Gemini/Groq).\n"
            "Открой Menu → /menu для уроков без ИИ."
        )
        track_message(chat_id, sent.message_id)
        return

    for chunk in split_message(reply):
        sent = await update.message.reply_text(chunk)
        track_message(chat_id, sent.message_id)


async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    logger.exception("Ошибка при обработке обновления: %s", context.error)


async def post_init(app: Application) -> None:
    await app.bot.set_my_commands(
        [
            BotCommand("start", "🚀 Старт и меню уроков"),
            BotCommand("menu", "🏠 Открыть меню уроков"),
            BotCommand("clear", "🧹 Очистить чат и память"),
            BotCommand("help", "ℹ️ Справка"),
            BotCommand("ping", "✅ Проверка бота"),
        ]
    )
    # Кнопка Menu рядом со скрепкой / полем ввода
    await app.bot.set_chat_menu_button(menu_button=MenuButtonCommands())


def main() -> None:
    token = os.getenv("TELEGRAM_TOKEN", "").strip()
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    groq_key = os.getenv("GROQ_API_KEY", "").strip()

    if not token:
        logger.error("Не задан TELEGRAM_TOKEN.")
        sys.exit(1)
    if not gemini_key and not groq_key:
        logger.error("Нужен хотя бы один ключ: GEMINI_API_KEY или GROQ_API_KEY.")
        sys.exit(1)

    providers = []
    if get_gemini_client() is not None:
        providers.append(f"gemini:{GEMINI_MODEL}")
    if get_groq_client() is not None:
        providers.append(f"groq:{GROQ_MODEL}")

    app = (
        Application.builder()
        .token(token)
        .post_init(post_init)
        .build()
    )
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("menu", menu_command))
    app.add_handler(CommandHandler("clear", clear_command))
    app.add_handler(CommandHandler("ping", ping))
    app.add_handler(CommandHandler("id", id_command))
    app.add_handler(CommandHandler("stats", stats_command))
    app.add_handler(CallbackQueryHandler(on_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, chat))
    app.add_error_handler(error_handler)

    logger.info("Бот-наставник запущен (%s)", " -> ".join(providers))
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
