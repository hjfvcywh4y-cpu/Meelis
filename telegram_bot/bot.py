#!/usr/bin/env python3
"""Telegram-бот с Google Gemini (OpenAI-compatible API)."""

from __future__ import annotations

import logging
import os
import sys
from collections import defaultdict, deque

from dotenv import load_dotenv
from openai import AsyncOpenAI
from telegram import Update
from telegram.constants import ChatAction
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
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
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-latest")
SYSTEM_PROMPT = os.getenv(
    "GEMINI_SYSTEM_PROMPT",
    "Ты полезный ассистент в Telegram. Отвечай кратко и по делу, на языке пользователя.",
)
MAX_HISTORY = int(os.getenv("GEMINI_MAX_HISTORY", "20"))

# chat_id -> deque[{"role": "...", "content": "..."}]
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
        _client = AsyncOpenAI(api_key=api_key, base_url=GEMINI_BASE_URL)
    return _client


async def ask_gemini(chat_id: int, user_text: str) -> str:
    history = _histories[chat_id]
    history.append({"role": "user", "content": user_text})

    messages = [{"role": "system", "content": SYSTEM_PROMPT}, *history]
    response = await get_client().chat.completions.create(
        model=GEMINI_MODEL,
        messages=messages,
    )
    reply = (response.choices[0].message.content or "").strip()
    if not reply:
        reply = "Пустой ответ от модели. Попробуйте ещё раз."
    history.append({"role": "assistant", "content": reply})
    return reply


def split_message(text: str, limit: int = 4000) -> list[str]:
    if len(text) <= limit:
        return [text]
    chunks: list[str] = []
    while text:
        chunks.append(text[:limit])
        text = text[limit:]
    return chunks


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    name = user.first_name if user else "друг"
    await update.message.reply_text(
        f"Привет, {name}!\n\n"
        "Я бот на базе Google Gemini. Просто напишите сообщение — отвечу.\n"
        "Команды: /help, /clear, /ping"
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "Команды:\n"
        "/start — приветствие\n"
        "/help — эта справка\n"
        "/clear — очистить историю диалога\n"
        "/ping — проверка, что бот жив\n\n"
        "Любое текстовое сообщение уходит в Gemini."
    )


async def ping(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text("pong")


async def clear(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat = update.effective_chat
    if chat is not None:
        _histories.pop(chat.id, None)
    await update.message.reply_text("История диалога очищена.")


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
            "Не удалось получить ответ от Gemini. "
            "Проверьте GEMINI_API_KEY на https://aistudio.google.com/apikey."
        )
        return

    for chunk in split_message(reply):
        await update.message.reply_text(chunk)


async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    logger.exception("Ошибка при обработке обновления: %s", context.error)


def main() -> None:
    token = os.getenv("TELEGRAM_TOKEN", "").strip()
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()

    if not token:
        logger.error(
            "Не задан TELEGRAM_TOKEN. "
            "Скопируйте .env.example в .env и вставьте токен от @BotFather."
        )
        sys.exit(1)
    if not gemini_key:
        logger.error(
            "Не задан GEMINI_API_KEY. "
            "Возьмите ключ на https://aistudio.google.com/apikey и добавьте в .env."
        )
        sys.exit(1)

    get_client()

    app = Application.builder().token(token).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("ping", ping))
    app.add_handler(CommandHandler("clear", clear))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, chat))
    app.add_error_handler(error_handler)

    logger.info("Бот запущен (Gemini model=%s)", GEMINI_MODEL)
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
