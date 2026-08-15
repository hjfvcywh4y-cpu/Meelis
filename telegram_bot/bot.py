#!/usr/bin/env python3
"""Простой Telegram-бот на python-telegram-bot."""

from __future__ import annotations

import logging
import os
import sys

from dotenv import load_dotenv
from telegram import Update
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


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    name = user.first_name if user else "друг"
    await update.message.reply_text(
        f"Привет, {name}!\n\n"
        "Я простой Telegram-бот.\n"
        "Напиши /help, чтобы увидеть команды."
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "Доступные команды:\n"
        "/start — приветствие\n"
        "/help — эта справка\n"
        "/ping — проверка, что бот жив\n"
        "/echo <текст> — повторить текст\n\n"
        "Любое обычное сообщение я тоже повторю."
    )


async def ping(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text("pong")


async def echo_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = " ".join(context.args).strip() if context.args else ""
    if not text:
        await update.message.reply_text("Использование: /echo <текст>")
        return
    await update.message.reply_text(text)


async def echo_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.message and update.message.text:
        await update.message.reply_text(update.message.text)


async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    logger.exception("Ошибка при обработке обновления: %s", context.error)


def main() -> None:
    token = os.getenv("TELEGRAM_TOKEN", "").strip()
    if not token:
        logger.error(
            "Не задан TELEGRAM_TOKEN. "
            "Скопируйте .env.example в .env и вставьте токен от @BotFather."
        )
        sys.exit(1)

    app = Application.builder().token(token).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("ping", ping))
    app.add_handler(CommandHandler("echo", echo_command))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, echo_message))
    app.add_error_handler(error_handler)

    logger.info("Бот запущен (polling)")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
