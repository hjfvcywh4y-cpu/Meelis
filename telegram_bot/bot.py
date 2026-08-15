#!/usr/bin/env python3
"""Telegram-бот-наставник по нейросетям + Gemini для свободных вопросов."""

from __future__ import annotations

import logging
import os
import sys
from collections import defaultdict, deque

from dotenv import load_dotenv
from openai import AsyncOpenAI
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.constants import ChatAction, ParseMode
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
    NETWORK_ORDER,
    NETWORKS,
    PROMPTS_LESSON,
)

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
SYSTEM_PROMPT = os.getenv(
    "GEMINI_SYSTEM_PROMPT",
    (
        "Ты дружелюбный наставник по нейросетям в Telegram. "
        "Объясняй просто, по шагам, на русском. "
        "Помогай с установкой, использованием и промптами. "
        "Не выдумывай оплату/лимиты как факты — говори осторожно."
    ),
)
MAX_HISTORY = int(os.getenv("GEMINI_MAX_HISTORY", "20"))

_histories: dict[int, deque[dict[str, str]]] = defaultdict(
    lambda: deque(maxlen=MAX_HISTORY)
)
_client: AsyncOpenAI | None = None


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY", "").strip()
        if not api_key:
            raise RuntimeError("Не задан GEMINI_API_KEY")
        _client = AsyncOpenAI(
            api_key=api_key,
            base_url=GEMINI_BASE_URL,
            timeout=45.0,
            max_retries=1,
        )
    return _client


async def ask_gemini(chat_id: int, user_text: str) -> str:
    history = _histories[chat_id]
    history.append({"role": "user", "content": user_text})
    messages = [{"role": "system", "content": SYSTEM_PROMPT}, *history]
    models = [GEMINI_MODEL, *[m for m in GEMINI_FALLBACK_MODELS if m != GEMINI_MODEL]]
    last_error: Exception | None = None

    for model in models:
        try:
            response = await get_client().chat.completions.create(
                model=model,
                messages=messages,
            )
            reply = (response.choices[0].message.content or "").strip()
            if not reply:
                reply = "Пустой ответ от модели. Попробуйте ещё раз."
            history.append({"role": "assistant", "content": reply})
            return reply
        except Exception as exc:
            last_error = exc
            logger.warning("Модель %s недоступна: %s", model, exc)

    assert last_error is not None
    if history and history[-1].get("role") == "user":
        history.pop()
    raise last_error


def split_message(text: str, limit: int = 3900) -> list[str]:
    if len(text) <= limit:
        return [text]
    chunks: list[str] = []
    while text:
        chunks.append(text[:limit])
        text = text[limit:]
    return chunks


def main_menu_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("1. Выбрать нейросеть", callback_data="menu:nets")],
            [
                InlineKeyboardButton("2. Текст", callback_data="menu:cat:text"),
                InlineKeyboardButton("3. Картинки", callback_data="menu:cat:image"),
            ],
            [
                InlineKeyboardButton("4. Видео", callback_data="menu:cat:video"),
                InlineKeyboardButton("5. Промпты", callback_data="menu:prompts"),
            ],
            [InlineKeyboardButton("6. Как общаться с ИИ", callback_data="menu:chat")],
            [InlineKeyboardButton("7. Спросить наставника", callback_data="menu:ask")],
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
    rows.append([InlineKeyboardButton("« Главное меню", callback_data="menu:home")])
    return InlineKeyboardMarkup(rows)


def net_actions_keyboard(net_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    "Установка / регистрация",
                    callback_data=f"step:{net_id}:install",
                )
            ],
            [
                InlineKeyboardButton(
                    "Как пользоваться",
                    callback_data=f"step:{net_id}:use",
                )
            ],
            [
                InlineKeyboardButton(
                    "Пример промпта",
                    callback_data=f"step:{net_id}:prompt",
                )
            ],
            [
                InlineKeyboardButton("« К списку", callback_data="menu:nets"),
                InlineKeyboardButton("« Меню", callback_data="menu:home"),
            ],
        ]
    )


def back_home_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [[InlineKeyboardButton("« Главное меню", callback_data="menu:home")]]
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
    rows.append([InlineKeyboardButton("« Главное меню", callback_data="menu:home")])
    return InlineKeyboardMarkup(rows)


def welcome_text(name: str) -> str:
    return (
        f"Привет, {name}!\n\n"
        "Я научу тебя пользоваться нейросетями — с нуля.\n"
        "От регистрации и установки до первых результатов:\n"
        "текст, картинки, видео, промпты и умение общаться с ИИ.\n\n"
        "Выбери, с чего начать:"
    )


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    name = user.first_name if user and user.first_name else "друг"
    if update.effective_chat:
        _histories.pop(update.effective_chat.id, None)
    await update.message.reply_text(
        welcome_text(name),
        reply_markup=main_menu_keyboard(),
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "Команды:\n"
        "/start — главное меню обучения\n"
        "/help — справка\n"
        "/menu — открыть меню\n"
        "/ping — проверка\n\n"
        "Также можно просто написать вопрос текстом — отвечу как наставник.",
        reply_markup=main_menu_keyboard(),
    )


async def menu_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "Главное меню:",
        reply_markup=main_menu_keyboard(),
    )


async def ping(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text("pong")


async def on_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query:
        return
    await query.answer()
    data = query.data or ""

    if data in {"menu:home", "menu:main"}:
        name = update.effective_user.first_name if update.effective_user else "друг"
        await query.edit_message_text(
            welcome_text(name),
            reply_markup=main_menu_keyboard(),
        )
        return

    if data == "menu:nets":
        await query.edit_message_text(
            "Выбери нейросеть (15 штук).\n"
            "Потом открою: установка → использование → пример промпта.",
            reply_markup=nets_keyboard(),
        )
        return

    if data == "menu:prompts":
        await query.edit_message_text(
            PROMPTS_LESSON,
            reply_markup=back_home_keyboard(),
        )
        return

    if data == "menu:chat":
        await query.edit_message_text(
            CHAT_LESSON,
            reply_markup=back_home_keyboard(),
        )
        return

    if data == "menu:ask":
        await query.edit_message_text(
            "Напиши мне обычным сообщением свой вопрос.\n"
            "Например: «Как зарегистрироваться в Leonardo?» или "
            "«Составь промпт для аватарки».",
            reply_markup=back_home_keyboard(),
        )
        return

    if data.startswith("menu:cat:"):
        kind = data.split(":")[-1]
        intro = CATEGORY_INTRO.get(kind)
        if not intro:
            await query.edit_message_text(
                "Раздел не найден.",
                reply_markup=back_home_keyboard(),
            )
            return
        await query.edit_message_text(
            intro + "\n\nВыбери сервис:",
            reply_markup=category_keyboard(kind),
        )
        return

    if data.startswith("net:"):
        net_id = data.split(":", 1)[1]
        net = NETWORKS.get(net_id)
        if not net:
            await query.edit_message_text(
                "Не нашёл эту нейросеть.",
                reply_markup=nets_keyboard(),
            )
            return
        text = (
            f"{net['emoji']} {net['title']} ({net['kind']})\n\n"
            f"{net['blurb']}\n\n"
            f"Сайт: {net['site']}\n\n"
            "Что открыть дальше?"
        )
        await query.edit_message_text(
            text,
            reply_markup=net_actions_keyboard(net_id),
            disable_web_page_preview=True,
        )
        return

    if data.startswith("step:"):
        _, net_id, step = data.split(":", 2)
        net = NETWORKS.get(net_id)
        if not net or step not in {"install", "use", "prompt"}:
            await query.edit_message_text(
                "Урок не найден.",
                reply_markup=back_home_keyboard(),
            )
            return
        titles = {
            "install": "Установка и регистрация",
            "use": "Как пользоваться",
            "prompt": "Пример промпта",
        }
        body = net[step]
        text = f"{net['emoji']} {net['title']} — {titles[step]}\n\n{body}"
        await query.edit_message_text(
            text,
            reply_markup=net_actions_keyboard(net_id),
            disable_web_page_preview=True,
        )
        return

    await query.edit_message_text(
        "Не понял кнопку. Открой меню заново: /start",
        reply_markup=main_menu_keyboard(),
    )


async def chat(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.message.text or not update.effective_chat:
        return

    text = update.message.text.strip()
    if not text:
        return

    await update.message.chat.send_action(ChatAction.TYPING)
    try:
        reply = await ask_gemini(update.effective_chat.id, text)
    except Exception:
        logger.exception("Ошибка Gemini API")
        await update.message.reply_text(
            "Сейчас наставник недоступен. Нажми /menu и учись по кнопкам — "
            "там уроки работают без ожидания.",
            reply_markup=main_menu_keyboard(),
        )
        return

    chunks = split_message(reply)
    for i, chunk in enumerate(chunks):
        markup = main_menu_keyboard() if i == len(chunks) - 1 else None
        await update.message.reply_text(chunk, reply_markup=markup)


async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    logger.exception("Ошибка при обработке обновления: %s", context.error)


def main() -> None:
    token = os.getenv("TELEGRAM_TOKEN", "").strip()
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()

    if not token:
        logger.error("Не задан TELEGRAM_TOKEN.")
        sys.exit(1)
    if not gemini_key:
        logger.error("Не задан GEMINI_API_KEY.")
        sys.exit(1)

    get_client()

    app = Application.builder().token(token).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("menu", menu_command))
    app.add_handler(CommandHandler("ping", ping))
    app.add_handler(CallbackQueryHandler(on_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, chat))
    app.add_error_handler(error_handler)

    logger.info("Бот-наставник запущен (Gemini model=%s)", GEMINI_MODEL)
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
