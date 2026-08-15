#!/usr/bin/env python3
"""Telegram-бот с DeepSeek (OpenAI-compatible API)."""

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

DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash")
SYSTEM_PROMPT = os.getenv(
    "DEEPSEEK_SYSTEM_PROMPT",
    "Ты полезный ассистент в Telegram. Отвечай кратко и по делу, на языке пользователя.",
)
MAX_HISTORY = int(os.getenv("DEEPSEEK_MAX_HISTORY", "20"))

# chat_id -> deque[{"role": "...", "content": "..."}]
_histories: dict[int, deque[dict[str, str]]] = defaultdict(
    lambda: deque(maxlen=MAX_HISTORY)
)

_client: AsyncOpenAI | None = None


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("DEEPSEEK_API_KEY", "").strip()
        if not api_key:
            raise RuntimeError("Не задан DEEPSEEK_API_KEY")
        _client = AsyncOpenAI(api_key=api_key, base_url=DEEPSEEK_BASE_URL)
    return _client


async def ask_deepseek(chat_id: int, user_text: str) -> str:
    history = _histories[chat_id]
    history.append({"role": "user", "content": user_text})

    messages = [{"role": "system", "content": SYSTEM_PROMPT}, *history]
    response = await get_client().chat.completions.create(
        model=DEEPSEEK_MODEL,
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
        "Я бот на базе DeepSeek. Просто напишите сообщение — отвечу.\n"
        "Команды: /help, /clear, /ping"
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "Команды:\n"
        "/start — приветствие\n"
        "/help — эта справка\n"
        "/clear — очистить историю диалога\n"
        "/ping — проверка, что бот жив\n\n"
        "Любое текстовое сообщение уходит в DeepSeek."
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
        reply = await ask_deepseek(update.effective_chat.id, text)
    except Exception:
        logger.exception("Ошибка DeepSeek API")
        await update.message.reply_text(
            "Не удалось получить ответ от DeepSeek. "
            "Проверьте DEEPSEEK_API_KEY и баланс на platform.deepseek.com."
        )
        return

    for chunk in split_message(reply):
        await update.message.reply_text(chunk)


async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    logger.exception("Ошибка при обработке обновления: %s", context.error)


def main() -> None:
    token = os.getenv("TELEGRAM_TOKEN", "").strip()
    deepseek_key = os.getenv("DEEPSEEK_API_KEY", "").strip()

    if not token:
        logger.error(
            "Не задан TELEGRAM_TOKEN. "
            "Скопируйте .env.example в .env и вставьте токен от @BotFather."
        )
        sys.exit(1)
    if not deepseek_key:
        logger.error(
            "Не задан DEEPSEEK_API_KEY. "
            "Возьмите ключ на https://platform.deepseek.com и добавьте в .env."
        )
        sys.exit(1)

    # Прогреваем клиент при старте
    get_client()

    app = Application.builder().token(token).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("ping", ping))
    app.add_handler(CommandHandler("clear", clear))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, chat))
    app.add_error_handler(error_handler)

    logger.info("Бот запущен (DeepSeek model=%s)", DEEPSEEK_MODEL)
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
