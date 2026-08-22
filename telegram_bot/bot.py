#!/usr/bin/env python3
"""IDera Helper — Telegram-бот с меню как у конкурента + подбор БАД."""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from collections import defaultdict, deque
from collections.abc import Awaitable, Callable
from io import BytesIO
from pathlib import Path
from typing import TypeVar

from dotenv import load_dotenv
from openai import AsyncOpenAI
from telegram import (
    BotCommand,
    InputFile,
    MenuButtonCommands,
    MessageEntity,
    Update,
)
from telegram.constants import ChatAction, ParseMode
from telegram.error import NetworkError, TimedOut
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)
from telegram.request import HTTPXRequest

import bad_quiz
import menus
import visitka
from stats import admin_ids, record_user, snapshot

T = TypeVar("T")

load_dotenv()

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
ASSETS = BASE_DIR / "assets"
DOCS = BASE_DIR / "docs"
WELCOME_IMAGE = ASSETS / "welcome.png"
CATALOG_IMAGE = ASSETS / "catalog.png"

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
GROQ_BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1").rstrip("/")
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
    (
        "Ты дружелюбный помощник IDera Helper. "
        "Отвечай кратко на русском, помогай с продуктом и бизнесом. "
        "Не ставь диагнозов и не обещай доход."
    ),
)
MAX_HISTORY = int(os.getenv("AI_MAX_HISTORY", "20"))

_histories: dict[int, deque[dict[str, str]]] = defaultdict(
    lambda: deque(maxlen=MAX_HISTORY)
)
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
        raise RuntimeError("Нет AI-ключей")

    for provider, client, models in chains:
        for model in models:
            try:
                response = await client.chat.completions.create(
                    model=model,
                    messages=messages,
                )
                reply = (response.choices[0].message.content or "").strip()
                if not reply:
                    reply = "Пустой ответ. Попробуйте ещё раз."
                history.append({"role": "assistant", "content": reply})
                return reply
            except Exception as exc:
                last_error = exc
                logger.warning("%s/%s недоступен: %s", provider, model, exc)

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


def screen_of(context: ContextTypes.DEFAULT_TYPE) -> str:
    return context.user_data.get("screen", "main")


def set_screen(context: ContextTypes.DEFAULT_TYPE, screen: str) -> None:
    context.user_data["screen"] = screen


def keyboard_for(screen: str):
    return {
        "main": menus.main_keyboard(),
        "business": menus.business_keyboard(),
        "about": menus.about_keyboard(),
        "partners": menus.partners_keyboard(),
        "business_tools": menus.business_tools_keyboard(),
        "visitka": menus.visitka_keyboard(),
        "ip_self": menus.ip_self_keyboard(),
        "self": menus.self_employed_keyboard(),
        "ip": menus.ip_keyboard(),
        "events": menus.events_keyboard(),
        "product": menus.product_keyboard(),
        "presentation": menus.presentation_keyboard(),
        "quiz_intro": menus.quiz_intro_keyboard(),
        "quiz": menus.quiz_choice_keyboard(),
    }.get(screen, menus.main_keyboard())


async def _tg_retry(
    factory: Callable[[], Awaitable[T]],
    *,
    attempts: int = 3,
) -> T:
    """Retry Telegram API calls on transient network timeouts."""
    last: Exception | None = None
    for i in range(attempts):
        try:
            return await factory()
        except (TimedOut, NetworkError) as exc:
            last = exc
            logger.warning(
                "Telegram timeout/network (%s/%s): %s", i + 1, attempts, exc
            )
            if i + 1 >= attempts:
                break
            await asyncio.sleep(1.5 * (i + 1))
    assert last is not None
    raise last


async def reply_html(
    update: Update,
    text: str,
    context: ContextTypes.DEFAULT_TYPE,
    *,
    screen: str | None = None,
) -> None:
    if screen:
        set_screen(context, screen)
    markup = keyboard_for(screen_of(context))
    chat_id = update.effective_chat.id if update.effective_chat else None
    chunks = split_message(text)
    for i, chunk in enumerate(chunks):
        sent = await _tg_retry(
            lambda c=chunk, last=(i == len(chunks) - 1): update.message.reply_text(
                c,
                parse_mode=ParseMode.HTML,
                reply_markup=markup if last else None,
                disable_web_page_preview=True,
            )
        )
        if chat_id:
            track_message(chat_id, sent.message_id)


async def send_idera_stickers(bot, chat_id: int) -> None:
    """Fallback: send pack stickers if Telegram strips inline custom emoji."""
    wanted = {menus.IDERA_EMOJI[name][0] for name in ("blue", "star", "rocket")}
    try:
        pack = await bot.get_sticker_set(menus.IDERA_PACK)
    except Exception:
        logger.exception("Не удалось загрузить пак %s", menus.IDERA_PACK)
        return
    for sticker in pack.stickers:
        emoji_id = getattr(sticker, "custom_emoji_id", None)
        if emoji_id not in wanted:
            continue
        try:
            sent = await bot.send_sticker(chat_id=chat_id, sticker=sticker.file_id)
            track_message(chat_id, sent.message_id)
        except Exception:
            logger.warning("Стикер IDera не отправился: %s", emoji_id)
        wanted.discard(emoji_id)
        if not wanted:
            break


async def send_welcome(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    set_screen(context, "main")
    if not update.message or not update.effective_chat:
        return
    chat_id = update.effective_chat.id
    markup = menus.main_keyboard()
    text, entities = menus.welcome_message()

    if WELCOME_IMAGE.exists():
        with WELCOME_IMAGE.open("rb") as photo:
            sent = await update.message.reply_photo(
                photo=InputFile(photo, filename="welcome.png"),
                caption=text,
                caption_entities=entities,
                reply_markup=markup,
            )
        track_message(chat_id, sent.message_id)
        kept = [e.type for e in (sent.caption_entities or [])]
    else:
        sent = await update.message.reply_text(
            text,
            entities=entities,
            reply_markup=markup,
            disable_web_page_preview=True,
        )
        track_message(chat_id, sent.message_id)
        kept = [e.type for e in (sent.entities or [])]

    logger.info("welcome entities kept by Telegram: %s", kept)
    if MessageEntity.CUSTOM_EMOJI not in kept:
        logger.warning("Кастомные эмодзи срезаны — отправляю стикеры из пака IDera")
        await send_idera_stickers(context.bot, chat_id)


async def send_document_for_button(update: Update, button: str) -> None:
    filename = menus.DOC_FILES.get(button)
    caption = menus.DOC_CAPTIONS.get(button, button)
    if not filename:
        await update.message.reply_text("Документ пока не привязан.")
        return
    path = DOCS / filename
    if not path.exists():
        await update.message.reply_text(
            f"{caption}\n\nФайл ещё не загружен. Скоро добавим PDF."
        )
        return
    caption_text = caption
    if button not in menus.FINAL_DOCS:
        caption_text = f"{caption}\n\n⚠️ Пока это черновик — заменим на финальный PDF."
    payload = path.read_bytes()
    download_name = menus.DOC_DOWNLOAD_NAMES.get(button, filename)

    async def _send():
        return await update.message.reply_document(
            document=InputFile(BytesIO(payload), filename=download_name),
            caption=caption_text,
        )

    sent = await _tg_retry(_send)
    if update.effective_chat:
        track_message(update.effective_chat.id, sent.message_id)


async def send_catalog(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    set_screen(context, "product")
    if not update.message:
        return
    markup = menus.product_keyboard()
    if CATALOG_IMAGE.exists():
        with CATALOG_IMAGE.open("rb") as photo:
            sent = await update.message.reply_photo(
                photo=InputFile(photo, filename="catalog.png"),
                caption=menus.CATALOG_TEXT,
                parse_mode=ParseMode.HTML,
                reply_markup=markup,
            )
        if update.effective_chat:
            track_message(update.effective_chat.id, sent.message_id)
        return
    await reply_html(update, menus.CATALOG_TEXT, context, screen="product")


async def start_visitka(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    context.user_data["visitka"] = {"step": "name"}
    await reply_html(update, menus.VISITKA_ASK_NAME, context, screen="visitka")


async def handle_visitka_flow(
    update: Update, context: ContextTypes.DEFAULT_TYPE, text: str
) -> bool:
    """Return True if the message was consumed by the visitka wizard."""
    data = context.user_data.get("visitka")
    if screen_of(context) != "visitka" or not isinstance(data, dict):
        return False

    step = data.get("step")
    if step == "name":
        name = visitka.normalize_name(text)
        if not name:
            await reply_html(update, menus.VISITKA_BAD_NAME, context, screen="visitka")
            return True
        data["name"] = name
        data["step"] = "phone"
        await reply_html(update, menus.VISITKA_ASK_PHONE, context, screen="visitka")
        return True

    if step == "phone":
        phone = visitka.normalize_phone(text)
        if not phone:
            await reply_html(update, menus.VISITKA_BAD_PHONE, context, screen="visitka")
            return True
        data["phone"] = phone
        data["step"] = "telegram"
        await reply_html(update, menus.VISITKA_ASK_TELEGRAM, context, screen="visitka")
        return True

    if step == "telegram":
        username = visitka.normalize_telegram(text)
        if not username:
            await reply_html(
                update, menus.VISITKA_BAD_TELEGRAM, context, screen="visitka"
            )
            return True
        data["telegram"] = username
        data["step"] = "done"
        await reply_html(update, menus.VISITKA_READY, context, screen="visitka")
        path = None
        try:
            path = visitka.build_visitka_pdf(
                name=data["name"],
                phone=data["phone"],
                telegram=username,
            )
            payload = path.read_bytes()
            caption = (
                f"💳 Визитка для {data['name']}\n"
                f"✈️ @{username} · {data['phone']}"
            )
            filename = f"IDera_vizitka_{username}.pdf"

            async def _send_visitka():
                return await update.message.reply_document(
                    document=InputFile(BytesIO(payload), filename=filename),
                    caption=caption,
                    reply_markup=menus.business_tools_keyboard(),
                )

            sent = await _tg_retry(_send_visitka)
            if update.effective_chat:
                track_message(update.effective_chat.id, sent.message_id)
        except Exception:
            logger.exception("visitka build failed")
            await reply_html(
                update,
                "Не удалось собрать визитку. Попробуйте ещё раз позже.",
                context,
                screen="business_tools",
            )
        finally:
            context.user_data.pop("visitka", None)
            set_screen(context, "business_tools")
            if path is not None:
                path.unlink(missing_ok=True)
        return True

    return False


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    record_user(
        user.id if user else None,
        event="start",
        username=user.username if user else None,
        first_name=user.first_name if user else None,
    )
    if update.effective_chat:
        _histories.pop(update.effective_chat.id, None)
        if update.message:
            track_message(update.effective_chat.id, update.message.message_id)
    await send_welcome(update, context)


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.message and update.effective_chat:
        track_message(update.effective_chat.id, update.message.message_id)
    await reply_html(
        update,
        "ℹ️ <b>Команды</b>\n"
        "/start — приветствие и главное меню\n"
        "/menu — открыть главное меню\n"
        "/clear — очистить чат\n"
        "/id — ваш Telegram ID\n"
        "/stats — статистика (для владельца)\n"
        "/ping — проверка\n\n"
        "Кнопки меню внизу экрана — как у удобных бизнес-ботов.",
        context,
        screen="main",
    )


async def menu_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.message and update.effective_chat:
        track_message(update.effective_chat.id, update.message.message_id)
    await reply_html(update, "🏠 Главное меню:", context, screen="main")


async def clear_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.effective_chat or not update.message:
        return
    chat_id = update.effective_chat.id
    _histories.pop(chat_id, None)
    context.user_data.clear()
    track_message(chat_id, update.message.message_id)
    deleted = await delete_tracked_messages(context.bot, chat_id)
    try:
        await update.message.delete()
    except Exception:
        pass
    sent = await context.bot.send_message(
        chat_id=chat_id,
        text=(
            f"🧹 Чат очищен. Удалено сообщений: {deleted}.\n"
            "Нажми /start или выбери раздел в меню."
        ),
        reply_markup=menus.main_keyboard(),
    )
    set_screen(context, "main")
    track_message(chat_id, sent.message_id)


async def id_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if not update.message or not user:
        return
    sent = await update.message.reply_text(f"Ваш Telegram ID: `{user.id}`", parse_mode="Markdown")
    if update.effective_chat:
        track_message(update.effective_chat.id, update.message.message_id)
        track_message(update.effective_chat.id, sent.message_id)


def _is_admin(user_id: int | None) -> bool:
    allowed = admin_ids()
    if not allowed:
        return True
    return bool(user_id and user_id in allowed)


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
        f"🚀 /start: {data['starts']}\n"
        f"💬 Сообщений: {data['messages']}\n"
        f"🔘 Кликов: {data['callbacks']}"
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


async def handle_back(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    current = screen_of(context)
    if current == "visitka":
        context.user_data.pop("visitka", None)
    parent = menus.PARENT.get(current, "main")
    texts = {
        "main": "🏠 Главное меню:",
        "business": menus.BUSINESS_TEXT,
        "about": menus.ABOUT_TEXT,
        "partners": menus.PARTNERS_TEXT,
        "business_tools": menus.BUSINESS_TOOLS_TEXT,
        "ip_self": menus.IP_SELF_TEXT,
        "quiz_intro": bad_quiz.INTRO,
        "product": menus.PRODUCT_TEXT,
    }
    text = texts.get(parent, "🏠 Главное меню:")
    await reply_html(update, text, context, screen=parent)


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.message.text or not update.effective_chat:
        return

    text = update.message.text.strip()
    chat_id = update.effective_chat.id
    user = update.effective_user
    record_user(
        user.id if user else None,
        event="message",
        username=user.username if user else None,
        first_name=user.first_name if user else None,
    )
    track_message(chat_id, update.message.message_id)

    screen = screen_of(context)

    # Quiz number input
    if screen == "quiz":
        goals = bad_quiz.parse_goals(text)
        if goals is None:
            await reply_html(
                update,
                "Не понял выбор. Пришли до 3 номеров через запятую, например <code>1,3,5</code>",
                context,
                screen="quiz",
            )
            return
        await reply_html(update, bad_quiz.build_result(goals), context, screen="main")
        return

    # Navigation buttons
    if text == menus.BTN_MAIN:
        context.user_data.pop("visitka", None)
        await reply_html(update, "🏠 Главное меню:", context, screen="main")
        return
    if text == menus.BTN_BACK:
        await handle_back(update, context)
        return

    if await handle_visitka_flow(update, context, text):
        return

    if text == menus.BTN_BAD:
        await reply_html(update, bad_quiz.INTRO, context, screen="quiz_intro")
        return
    if text == menus.BTN_QUIZ_START:
        await reply_html(update, bad_quiz.ASK, context, screen="quiz")
        return

    if text == menus.BTN_BUSINESS:
        await reply_html(update, menus.BUSINESS_TEXT, context, screen="business")
        return
    if text == menus.BTN_IP_SELF:
        await reply_html(update, menus.IP_SELF_TEXT, context, screen="ip_self")
        return
    if text == menus.BTN_SELF:
        await reply_html(update, menus.SELF_TEXT, context, screen="self")
        return
    if text == menus.BTN_IP:
        await reply_html(update, menus.IP_TEXT, context, screen="ip")
        return
    if text == menus.BTN_ABOUT:
        await reply_html(update, menus.ABOUT_TEXT, context, screen="about")
        return
    if text == menus.BTN_ABOUT_US:
        await reply_html(update, menus.ABOUT_US_TEXT, context, screen="about")
        return
    if text == menus.BTN_PARTNERS:
        await reply_html(update, menus.PARTNERS_TEXT, context, screen="partners")
        return
    if text == menus.BTN_BUSINESS_TOOLS:
        await reply_html(
            update, menus.BUSINESS_TOOLS_TEXT, context, screen="business_tools"
        )
        return
    if text == menus.BTN_VISITKA:
        await start_visitka(update, context)
        return

    if text == menus.BTN_SWITCH:
        # From self-employment → open IP docs + send memo PDF
        await send_document_for_button(update, text)
        if screen_of(context) == "self":
            await reply_html(update, menus.IP_TEXT, context, screen="ip")
        return

    if text in menus.DOC_FILES:
        await send_document_for_button(update, text)
        return

    if text == menus.BTN_EVENTS:
        await reply_html(update, menus.EVENTS_TEXT, context, screen="events")
        return
    if text == menus.BTN_CHARITY:
        await reply_html(update, menus.CHARITY_TEXT, context, screen="events")
        return
    if text == menus.BTN_UPCOMING:
        await reply_html(update, menus.UPCOMING_TEXT, context, screen="events")
        return
    if text == menus.BTN_ARCHIVE:
        await reply_html(update, menus.ARCHIVE_TEXT, context, screen="events")
        return

    if text == menus.BTN_PRODUCT:
        await reply_html(update, menus.PRODUCT_TEXT, context, screen="product")
        return
    if text == menus.BTN_CATALOG:
        await send_catalog(update, context)
        return
    if text == menus.BTN_HOW_GET:
        await reply_html(update, menus.HOW_GET_TEXT, context, screen="product")
        return
    if text == menus.BTN_PRESENTATION:
        await reply_html(update, menus.PRESENTATION_TEXT, context, screen="presentation")
        return
    if text == menus.BTN_VIDEO:
        await reply_html(update, menus.VIDEO_TEXT, context, screen="product")
        return
    if text == menus.BTN_CREATIVES:
        await reply_html(update, menus.CREATIVES_TEXT, context, screen="product")
        return

    # Free-text AI fallback (no reply-keyboard wipe)
    if not provider_chains():
        await reply_html(
            update,
            "Выбери раздел в меню ниже 👇\nИли нажми /menu",
            context,
        )
        return

    await update.message.chat.send_action(ChatAction.TYPING)
    try:
        reply = await ask_ai(chat_id, text)
    except Exception:
        logger.exception("AI error")
        sent = await update.message.reply_text(
            "Сейчас не могу ответить текстом. Пользуйся кнопками меню 👇",
            reply_markup=keyboard_for(screen_of(context)),
        )
        track_message(chat_id, sent.message_id)
        return

    for chunk in split_message(reply):
        sent = await update.message.reply_text(
            chunk,
            reply_markup=keyboard_for(screen_of(context)),
        )
        track_message(chat_id, sent.message_id)


async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    logger.exception("Ошибка: %s", context.error)


async def post_init(app: Application) -> None:
    await app.bot.set_my_commands(
        [
            BotCommand("start", "🚀 Старт"),
            BotCommand("menu", "🏠 Меню"),
            BotCommand("clear", "🧹 Очистить чат"),
        ]
    )
    await app.bot.set_chat_menu_button(menu_button=MenuButtonCommands())
    try:
        await app.bot.set_my_description(
            description=(
                "IDera Helper — тихий ориентир рядом с тобой.\n"
                "Ясность в нужный момент и кнопка, с которой можно начать."
            )
        )
        await app.bot.set_my_short_description(
            short_description="IDera Helper. Ясность рядом, всегда на связи."
        )
        await app.bot.set_my_name(name="IDera Helper")
    except Exception:
        logger.exception("Не удалось обновить описание бота")


def main() -> None:
    token = os.getenv("TELEGRAM_TOKEN", "").strip()
    if not token:
        logger.error("Не задан TELEGRAM_TOKEN.")
        sys.exit(1)

    providers = []
    if get_gemini_client() is not None:
        providers.append(f"gemini:{GEMINI_MODEL}")
    if get_groq_client() is not None:
        providers.append(f"groq:{GROQ_MODEL}")

    request = HTTPXRequest(
        connection_pool_size=8,
        connect_timeout=30.0,
        read_timeout=30.0,
        write_timeout=60.0,
        pool_timeout=30.0,
    )
    get_updates_request = HTTPXRequest(
        connection_pool_size=4,
        connect_timeout=30.0,
        read_timeout=30.0,
        write_timeout=30.0,
        pool_timeout=30.0,
    )
    app = (
        Application.builder()
        .token(token)
        .request(request)
        .get_updates_request(get_updates_request)
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
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    app.add_error_handler(error_handler)

    logger.info("IDera Helper запущен (%s)", " -> ".join(providers) or "без AI")
    app.run_polling(
        allowed_updates=Update.ALL_TYPES,
        drop_pending_updates=True,
    )


if __name__ == "__main__":
    main()
