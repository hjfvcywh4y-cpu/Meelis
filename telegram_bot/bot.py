#!/usr/bin/env python3
"""IDera HUB — Telegram-бот с меню как у конкурента + подбор БАД."""

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
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    InputFile,
    InputMediaPhoto,
    MenuButtonCommands,
    MessageEntity,
    ReplyKeyboardRemove,
    Update,
    WebAppInfo,
)
from telegram.constants import ChatAction, ChatMemberStatus, ParseMode
from telegram.error import NetworkError, TimedOut
from telegram.ext import (
    Application,
    ChatMemberHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)
from telegram.request import HTTPXRequest

import ai_prompt
import bad_quiz
import menus
import pdf_preview
import qual_card
import visitka
from stats import (
    admin_ids,
    claim_owner,
    clear_service_chat,
    get_owner_id,
    get_service_chat,
    get_service_chat_id,
    has_consent,
    record_consent,
    record_feedback,
    record_user,
    set_service_chat,
    snapshot,
)

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
TRACKS_IMAGE = ASSETS / "tracks.png"
VIDEO_TRACK_IMAGE = ASSETS / "video_track.png"
CONSENT_PDF = DOCS / menus.CONSENT_PDF

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
SYSTEM_PROMPT = ai_prompt.build_system_prompt(os.getenv("AI_SYSTEM_PROMPT", ""))
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
                    temperature=0.35,
                )
                reply = ai_prompt.polish_ai_reply(
                    response.choices[0].message.content or ""
                )
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


async def ask_ai_once(system: str, user_text: str) -> str:
    """Отдельный запрос без истории чата — для подбора продукта."""
    last_error: Exception | None = None
    chains = provider_chains()
    if not chains:
        raise RuntimeError("Нет AI-ключей")
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user_text},
    ]
    for provider, client, models in chains:
        for model in models:
            try:
                response = await client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=0.3,
                )
                reply = ai_prompt.polish_ai_reply(
                    response.choices[0].message.content or ""
                )
                if reply:
                    return reply
            except Exception as exc:
                last_error = exc
                logger.warning("%s/%s недоступен: %s", provider, model, exc)
    assert last_error is not None
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


def user_has_consent(context: ContextTypes.DEFAULT_TYPE, user_id: int | None) -> bool:
    if context.user_data.get("consent_blocked"):
        return False
    if context.user_data.get("consent_given"):
        return True
    return has_consent(user_id)


def consent_blocked(context: ContextTypes.DEFAULT_TYPE) -> bool:
    return bool(context.user_data.get("consent_blocked"))


def set_consent(context: ContextTypes.DEFAULT_TYPE, *, accepted: bool) -> None:
    if accepted:
        context.user_data["consent_given"] = True
        context.user_data.pop("consent_blocked", None)
    else:
        context.user_data.pop("consent_given", None)
        context.user_data["consent_blocked"] = True


def keyboard_for(
    screen: str,
    context: ContextTypes.DEFAULT_TYPE | None = None,
    user=None,
):
    if screen == "quiz_step" and context is not None:
        quiz = context.user_data.get("quiz") or {}
        idx = int(quiz.get("q_index") or 0)
        idx = max(0, min(idx, len(bad_quiz.QUESTIONS) - 1))
        return bad_quiz.step_keyboard(idx)
    if screen == "visitka":
        step = "name"
        if context is not None:
            step = str((context.user_data.get("visitka") or {}).get("step") or "name")
        return menus.visitka_step_keyboard(step, user=user)
    if screen == "qual":
        step = "photo"
        if context is not None:
            step = str((context.user_data.get("qual") or {}).get("step") or "photo")
        return menus.qual_step_keyboard(step, user=user)
    return {
        "main": menus.main_keyboard(),
        "consent": menus.consent_keyboard(),
        "business": menus.business_keyboard(),
        "about": menus.about_keyboard(),
        "partners": menus.partners_keyboard(),
        "materials": menus.materials_keyboard(),
        "business_tools": menus.business_tools_keyboard(),
        "track": menus.track_keyboard(),
        "visitka": menus.visitka_keyboard(),
        "visitka_pick": menus.visitka_pick_keyboard(),
        "qual_orient": menus.qual_orient_keyboard(),
        "qual_rank": menus.qual_rank_keyboard(),
        "qual": menus.qual_step_keyboard("photo", user=user),
        "ip_self": menus.ip_self_keyboard(),
        "self": menus.self_employed_keyboard(),
        "ip": menus.ip_keyboard(),
        "events": menus.events_keyboard(),
        "upcoming": menus.upcoming_keyboard(),
        "upcoming_item": menus.upcoming_keyboard(),
        "archive": menus.archive_keyboard(),
        "archive_item": menus.archive_keyboard(),
        "product": menus.product_keyboard(),
        "presentation": menus.presentation_keyboard(),
        "quiz_intro": menus.quiz_intro_keyboard(),
        "quiz_goals": menus.quiz_goals_keyboard(),
        "quiz_step": menus.quiz_goals_keyboard(),
        "feedback": menus.feedback_keyboard(),
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
    preview: bool = False,
) -> None:
    if screen:
        set_screen(context, screen)
    markup = keyboard_for(screen_of(context), context, update.effective_user)
    chat_id = update.effective_chat.id if update.effective_chat else None
    chunks = split_message(text)
    for i, chunk in enumerate(chunks):
        sent = await _tg_retry(
            lambda c=chunk, last=(i == len(chunks) - 1): update.message.reply_text(
                c,
                parse_mode=ParseMode.HTML,
                reply_markup=markup if last else None,
                disable_web_page_preview=not preview,
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


async def send_pack_preview(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    *,
    set_name: str,
    text: str,
) -> None:
    """Сразу ссылка «добавить себе», затем короткое превью картинок."""
    if not update.message or not update.effective_chat:
        return
    chat_id = update.effective_chat.id
    set_screen(context, "materials")
    markup = menus.materials_keyboard()

    sent = await _tg_retry(
        lambda: update.message.reply_text(
            text,
            parse_mode=ParseMode.HTML,
            reply_markup=markup,
            disable_web_page_preview=False,
        )
    )
    track_message(chat_id, sent.message_id)

    try:
        pack = await asyncio.wait_for(
            context.bot.get_sticker_set(set_name),
            timeout=8,
        )
    except Exception:
        logger.exception("Не удалось загрузить набор %s", set_name)
        return

    stickers = list(pack.stickers or [])[: menus.PACK_PREVIEW_LIMIT]
    media: list[InputMediaPhoto] = []
    for sticker in stickers:
        thumb = getattr(sticker, "thumbnail", None) or getattr(sticker, "thumb", None)
        file_id = getattr(thumb, "file_id", None) if thumb else None
        if file_id:
            media.append(InputMediaPhoto(media=file_id))

    if len(media) >= 2:
        try:
            messages = await asyncio.wait_for(
                context.bot.send_media_group(chat_id=chat_id, media=media),
                timeout=12,
            )
            for msg in messages:
                track_message(chat_id, msg.message_id)
            return
        except Exception:
            logger.warning("Превью-альбом набора %s не отправился", set_name)

    for sticker in stickers[:4]:
        try:
            sent = await asyncio.wait_for(
                context.bot.send_sticker(chat_id=chat_id, sticker=sticker.file_id),
                timeout=5,
            )
            track_message(chat_id, sent.message_id)
        except Exception:
            logger.warning("Стикер набора %s не отправился", set_name)
            break


async def send_consent_flow(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    *,
    include_pdf: bool | None = None,
) -> None:
    """Показать PDF согласия и кнопки подтверждения."""
    if not update.message or not update.effective_chat:
        return
    chat_id = update.effective_chat.id
    if include_pdf is None:
        include_pdf = screen_of(context) != "consent"
    set_screen(context, "consent")

    if include_pdf:
        if CONSENT_PDF.exists():
            payload = CONSENT_PDF.read_bytes()

            async def _send_pdf():
                return await update.message.reply_document(
                    document=InputFile(
                        BytesIO(payload),
                        filename=menus.CONSENT_PDF_FILENAME,
                    ),
                )

            sent = await _tg_retry(_send_pdf)
            track_message(chat_id, sent.message_id)
        else:
            logger.warning("Файл согласия не найден: %s", CONSENT_PDF)

    sent = await _tg_retry(
        lambda: update.message.reply_text(
            menus.CONSENT_TEXT,
            parse_mode=ParseMode.HTML,
            reply_markup=menus.consent_keyboard(),
            disable_web_page_preview=True,
        )
    )
    track_message(chat_id, sent.message_id)


async def send_welcome(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    *,
    with_menu: bool = True,
) -> None:
    if with_menu:
        set_screen(context, "main")
    if not update.message or not update.effective_chat:
        return
    chat_id = update.effective_chat.id
    markup = menus.main_keyboard() if with_menu else ReplyKeyboardRemove()
    text, entities = menus.welcome_message(with_menu_hint=with_menu)

    if WELCOME_IMAGE.exists():
        payload = WELCOME_IMAGE.read_bytes()

        async def _send_photo():
            return await update.message.reply_photo(
                photo=InputFile(BytesIO(payload), filename="welcome.png"),
                caption=text,
                caption_entities=entities,
                reply_markup=markup,
            )

        sent = await _tg_retry(_send_photo)
        track_message(chat_id, sent.message_id)
        kept = [e.type for e in (sent.caption_entities or [])]
    else:
        async def _send_text():
            return await update.message.reply_text(
                text,
                entities=entities,
                reply_markup=markup,
                disable_web_page_preview=True,
            )

        sent = await _tg_retry(_send_text)
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
    chat = update.effective_chat
    sent_cover = False

    if button in menus.PRODUCT_PRESENTATION_BUTTONS:
        try:
            cover = pdf_preview.cover_jpeg(path)
            cover_name = Path(download_name).stem + ".jpg"
            if update.message:
                await update.message.chat.send_action(ChatAction.UPLOAD_PHOTO)

            async def _send_cover():
                return await update.message.reply_photo(
                    photo=InputFile(BytesIO(cover), filename=cover_name),
                    caption=caption_text,
                )

            cover_msg = await _tg_retry(_send_cover)
            if chat:
                track_message(chat.id, cover_msg.message_id)
            sent_cover = True
        except Exception:
            logger.exception("Не удалось отправить обложку презентации %s", filename)

    if update.message:
        await update.message.chat.send_action(ChatAction.UPLOAD_DOCUMENT)

    async def _send():
        kwargs: dict = {
            "document": InputFile(BytesIO(payload), filename=download_name),
        }
        if not sent_cover:
            kwargs["caption"] = caption_text
        return await update.message.reply_document(**kwargs)

    sent = await _tg_retry(_send)
    if chat:
        track_message(chat.id, sent.message_id)


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


async def send_tracks(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Обложка раздела IDera GO: картинка и короткий текст."""
    if not update.message or not update.effective_chat:
        return
    set_screen(context, "track")
    chat_id = update.effective_chat.id
    markup = menus.track_keyboard()

    caption, entities = menus.track_cover_message()

    if TRACKS_IMAGE.exists():
        payload = TRACKS_IMAGE.read_bytes()

        async def _send_photo():
            return await update.message.reply_photo(
                photo=InputFile(BytesIO(payload), filename="tracks.png"),
                caption=caption,
                caption_entities=entities,
                reply_markup=markup,
            )

        sent = await _tg_retry(_send_photo)
        track_message(chat_id, sent.message_id)
        return

    await reply_html(update, menus.TRACK_TEXT, context, screen="track")


def video_launch_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    menus.BTN_VIDEO_LAUNCH,
                    web_app=WebAppInfo(url=menus.VIDEO_WIZARD_URL),
                )
            ]
        ]
    )


async def send_video_track(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Картинка трека, описание и кнопка мини-приложения «Запустить»."""
    if not update.message or not update.effective_chat:
        return
    set_screen(context, "track")
    chat_id = update.effective_chat.id
    markup = video_launch_keyboard()
    caption, entities = menus.video_track_message()

    if VIDEO_TRACK_IMAGE.exists():
        payload = VIDEO_TRACK_IMAGE.read_bytes()

        async def _send_photo():
            return await update.message.reply_photo(
                photo=InputFile(BytesIO(payload), filename="video_track.png"),
                caption=caption,
                caption_entities=entities,
                reply_markup=markup,
            )

        sent = await _tg_retry(_send_photo)
        track_message(chat_id, sent.message_id)
        return

    sent = await _tg_retry(
        lambda: update.message.reply_text(
            caption,
            entities=entities,
            reply_markup=markup,
        )
    )
    track_message(chat_id, sent.message_id)


async def start_visitka(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    context.user_data.pop("qual", None)
    context.user_data["visitka"] = {"step": "pick"}
    await reply_html(update, menus.VISITKA_PICK_TEXT, context, screen="visitka_pick")


async def choose_visitka_template(
    update: Update, context: ContextTypes.DEFAULT_TYPE, template_id: str, button: str
) -> None:
    context.user_data["visitka"] = {"step": "name", "template_id": template_id}
    set_screen(context, "visitka")
    if not update.message or not update.effective_chat:
        return
    caption = f"Макет «{button}».\n\n{menus.VISITKA_ASK_NAME}"
    markup = menus.visitka_step_keyboard("name", user=update.effective_user)
    try:
        payload = visitka.preview_jpeg_bytes(template_id)
    except Exception:
        logger.exception("visitka preview failed")
        await reply_html(update, caption, context, screen="visitka")
        return

    async def _send_preview():
        return await update.message.reply_photo(
            photo=InputFile(BytesIO(payload), filename=f"visitka_{template_id}.jpg"),
            caption=caption,
            parse_mode=ParseMode.HTML,
            reply_markup=markup,
        )

    sent = await _tg_retry(_send_preview)
    track_message(update.effective_chat.id, sent.message_id)


async def handle_visitka_flow(
    update: Update, context: ContextTypes.DEFAULT_TYPE, text: str
) -> bool:
    """Return True if the message was consumed by the visitka wizard."""
    screen = screen_of(context)
    if screen == "visitka_pick":
        template_id = menus.VISITKA_TEMPLATE_BUTTONS.get(text)
        if template_id:
            await choose_visitka_template(update, context, template_id, text)
            return True
        await reply_html(
            update, menus.VISITKA_PICK_TEXT, context, screen="visitka_pick"
        )
        return True

    data = context.user_data.get("visitka")
    if screen != "visitka" or not isinstance(data, dict):
        return False

    step = data.get("step")
    user = update.effective_user
    if step == "name":
        if text == menus.BTN_VISITKA_USE_NAME:
            name = visitka.profile_name(user)
        else:
            name = visitka.normalize_name(text)
        if not name:
            await reply_html(update, menus.VISITKA_BAD_NAME, context, screen="visitka")
            return True
        data["name"] = name
        data["step"] = "phone"
        await reply_html(update, menus.VISITKA_ASK_PHONE, context, screen="visitka")
        return True

    if step == "phone":
        if text == menus.BTN_VISITKA_USE_PHONE:
            await reply_html(
                update,
                "Нажмите «Вставить номер» ещё раз и разрешите Telegram "
                "отправить телефон из вашей карточки.",
                context,
                screen="visitka",
            )
            return True
        phone = visitka.normalize_phone(text)
        if not phone:
            await reply_html(update, menus.VISITKA_BAD_PHONE, context, screen="visitka")
            return True
        data["phone"] = phone
        data["step"] = "telegram"
        await reply_html(update, menus.VISITKA_ASK_TELEGRAM, context, screen="visitka")
        return True

    if step == "telegram":
        if text == menus.BTN_VISITKA_USE_TELEGRAM:
            username = visitka.profile_username(user)
        else:
            username = visitka.normalize_telegram(text)
        if not username:
            await reply_html(
                update, menus.VISITKA_BAD_TELEGRAM, context, screen="visitka"
            )
            return True
        return await _finish_visitka(update, context, data, username)

    return False


async def _finish_visitka(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    data: dict,
    username: str,
) -> bool:
    data["telegram"] = username
    data["step"] = "done"
    await reply_html(update, menus.VISITKA_READY, context, screen="visitka")
    path = None
    template_id = data.get("template_id") or visitka.TEMPLATE_QR
    try:
        path = visitka.build_visitka_pdf(
            name=data["name"],
            phone=data["phone"],
            telegram=username,
            template_id=template_id,
        )
        payload = path.read_bytes()
        caption = (
            f"💳 Визитка для {data['name']}\n"
            f"✈️ @{username} · {data['phone']}"
        )
        filename = f"IDera_vizitka_{template_id}_{username}.pdf"

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


async def handle_visitka_contact(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> None:
    if not update.message or not update.message.contact or not update.effective_chat:
        return
    if screen_of(context) != "visitka":
        return
    data = context.user_data.get("visitka")
    if not isinstance(data, dict):
        return
    track_message(update.effective_chat.id, update.message.message_id)
    contact = update.message.contact
    phone = visitka.normalize_phone(contact.phone_number or "")
    contact_name = visitka.normalize_name(
        " ".join(
            p
            for p in (contact.first_name or "", contact.last_name or "")
            if p
        )
    )
    step = data.get("step")
    if step == "name":
        name = contact_name or visitka.profile_name(update.effective_user)
        if not name:
            await reply_html(update, menus.VISITKA_BAD_NAME, context, screen="visitka")
            return
        data["name"] = name
        if phone:
            data["phone"] = phone
            data["step"] = "telegram"
            await reply_html(
                update, menus.VISITKA_ASK_TELEGRAM, context, screen="visitka"
            )
            return
        data["step"] = "phone"
        await reply_html(update, menus.VISITKA_ASK_PHONE, context, screen="visitka")
        return
    if step != "phone":
        return
    if not phone:
        await reply_html(update, menus.VISITKA_BAD_PHONE, context, screen="visitka")
        return
    data["phone"] = phone
    data["step"] = "telegram"
    await reply_html(update, menus.VISITKA_ASK_TELEGRAM, context, screen="visitka")


def _qual_data(context: ContextTypes.DEFAULT_TYPE) -> dict:
    data = context.user_data.get("qual")
    if not isinstance(data, dict):
        data = {}
        context.user_data["qual"] = data
    return data


async def start_qual(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    context.user_data.pop("visitka", None)
    context.user_data["qual"] = {"step": "orient"}
    await reply_html(update, menus.QUAL_ORIENT_TEXT, context, screen="qual_orient")


async def choose_qual_orient(
    update: Update, context: ContextTypes.DEFAULT_TYPE, orient: str
) -> None:
    data = _qual_data(context)
    data["orient"] = orient
    data["step"] = "rank"
    data.pop("rank_id", None)
    data.pop("photo", None)
    await reply_html(update, menus.QUAL_RANK_TEXT, context, screen="qual_rank")


async def choose_qual_rank(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    rank_id: str,
    button: str,
) -> None:
    data = _qual_data(context)
    orient = data.get("orient")
    if orient not in qual_card.ORIENT_IDS:
        await start_qual(update, context)
        return
    data["rank_id"] = rank_id
    data["step"] = "photo"
    data.pop("photo", None)
    set_screen(context, "qual")
    if not update.message or not update.effective_chat:
        return
    caption = f"Макет «{button}».\n\n{menus.QUAL_ASK_PHOTO}"
    markup = menus.qual_step_keyboard("photo", user=update.effective_user)
    try:
        payload = qual_card.preview_jpeg_bytes(orient, rank_id)
    except Exception:
        logger.exception("qual preview failed")
        await reply_html(update, caption, context, screen="qual")
        return

    async def _send_preview():
        return await update.message.reply_photo(
            photo=InputFile(BytesIO(payload), filename=f"qual_{orient}_{rank_id}.jpg"),
            caption=caption,
            parse_mode=ParseMode.HTML,
            reply_markup=markup,
        )

    sent = await _tg_retry(_send_preview)
    track_message(update.effective_chat.id, sent.message_id)


async def handle_qual_flow(
    update: Update, context: ContextTypes.DEFAULT_TYPE, text: str
) -> bool:
    """Return True if the message was consumed by the qualification wizard."""
    screen = screen_of(context)
    if screen == "qual_orient":
        orient = menus.QUAL_ORIENT_BUTTONS.get(text)
        if orient:
            await choose_qual_orient(update, context, orient)
            return True
        await reply_html(
            update, menus.QUAL_ORIENT_TEXT, context, screen="qual_orient"
        )
        return True

    if screen == "qual_rank":
        rank_id = menus.QUAL_RANK_BUTTONS.get(text)
        if rank_id:
            await choose_qual_rank(update, context, rank_id, text)
            return True
        await reply_html(update, menus.QUAL_RANK_TEXT, context, screen="qual_rank")
        return True

    data = context.user_data.get("qual")
    if screen != "qual" or not isinstance(data, dict):
        return False

    step = data.get("step")
    if step == "photo":
        await reply_html(update, menus.QUAL_NEED_PHOTO, context, screen="qual")
        return True

    if step != "name":
        return False

    if text == menus.BTN_VISITKA_USE_NAME:
        name = visitka.profile_name(update.effective_user)
    else:
        name = qual_card.normalize_name(text)
    if not name:
        await reply_html(update, menus.QUAL_BAD_NAME, context, screen="qual")
        return True
    return await _finish_qual(update, context, data, name)


async def _message_image_bytes(message) -> bytes | None:
    if message.photo:
        tg_file = await message.photo[-1].get_file()
        return bytes(await tg_file.download_as_bytearray())
    document = message.document
    if document and str(document.mime_type or "").startswith("image/"):
        tg_file = await document.get_file()
        return bytes(await tg_file.download_as_bytearray())
    return None


async def handle_qual_media(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> None:
    if not update.message or not update.effective_chat:
        return
    user = update.effective_user
    uid = user.id if user else None
    if consent_blocked(context) or not user_has_consent(context, uid):
        return
    if screen_of(context) != "qual":
        return
    data = context.user_data.get("qual")
    if not isinstance(data, dict):
        return
    track_message(update.effective_chat.id, update.message.message_id)
    if data.get("step") not in {"photo", "name"}:
        return
    try:
        payload = await _message_image_bytes(update.message)
    except Exception:
        logger.exception("qual photo download failed")
        await reply_html(update, menus.QUAL_BAD_PHOTO, context, screen="qual")
        return
    if not payload:
        await reply_html(update, menus.QUAL_NEED_PHOTO, context, screen="qual")
        return
    if len(payload) > 8 * 1024 * 1024 or not qual_card.is_image_bytes(payload):
        await reply_html(update, menus.QUAL_BAD_PHOTO, context, screen="qual")
        return
    data["photo"] = payload
    data["step"] = "name"
    await reply_html(update, menus.QUAL_ASK_NAME, context, screen="qual")


async def _finish_qual(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    data: dict,
    name: str,
) -> bool:
    """Готовая квалификация — PNG-файл. Без фото и без PDF."""
    photo = data.get("photo")
    orient = data.get("orient")
    rank_id = data.get("rank_id")
    if not photo or orient not in qual_card.ORIENT_IDS or rank_id not in qual_card.RANKS_BY_ID:
        data["step"] = "photo"
        await reply_html(update, menus.QUAL_NEED_PHOTO, context, screen="qual")
        return True
    data["name"] = name
    data["step"] = "done"
    await reply_html(update, menus.QUAL_READY, context, screen="qual")
    rank = qual_card.RANKS_BY_ID[rank_id]
    try:
        png = await asyncio.to_thread(
            lambda: qual_card.build_card_png(
                orient=orient, rank_id=rank_id, photo=photo, name=name
            )
        )
        filename = f"IDera_kvalifikaciya_{rank_id}_{orient}.png"
        caption = (
            f"🏅 Квалификация {rank.label}\n"
            f"{name}\n\n"
            "PNG в полном размере — нажмите, чтобы скачать."
        )

        if update.message:
            try:
                await update.message.chat.send_action(ChatAction.UPLOAD_DOCUMENT)
            except Exception:
                logger.warning("qual card upload action failed", exc_info=True)

        async def _send_png():
            return await update.message.reply_document(
                document=InputFile(BytesIO(png), filename=filename),
                caption=caption,
                disable_content_type_detection=True,
                reply_markup=menus.business_tools_keyboard(),
            )

        sent = await _tg_retry(_send_png)
        if update.effective_chat:
            track_message(update.effective_chat.id, sent.message_id)
    except Exception:
        logger.exception("qual card build failed")
        await reply_html(
            update,
            "Не удалось собрать карточку квалификации. Попробуйте ещё раз позже.",
            context,
            screen="business_tools",
        )
    finally:
        context.user_data.pop("qual", None)
        set_screen(context, "business_tools")
    return True


async def handle_qual_back(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> None:
    current = screen_of(context)
    data = context.user_data.get("qual")
    if not isinstance(data, dict):
        data = {}
    if current == "qual":
        data.pop("photo", None)
        data["step"] = "rank"
        context.user_data["qual"] = data
        await reply_html(update, menus.QUAL_RANK_TEXT, context, screen="qual_rank")
        return
    if current == "qual_rank":
        data.pop("rank_id", None)
        data.pop("photo", None)
        data["step"] = "orient"
        context.user_data["qual"] = data
        await reply_html(
            update, menus.QUAL_ORIENT_TEXT, context, screen="qual_orient"
        )
        return
    context.user_data.pop("qual", None)
    await reply_html(
        update, menus.BUSINESS_TOOLS_TEXT, context, screen="business_tools"
    )


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    uid = user.id if user else None
    record_user(
        uid,
        event="start",
        username=user.username if user else None,
        first_name=user.first_name if user else None,
    )
    if update.effective_chat:
        _histories.pop(update.effective_chat.id, None)
        if update.message:
            track_message(update.effective_chat.id, update.message.message_id)

    context.user_data.pop("consent_blocked", None)
    context.user_data.pop("awaiting_feedback", None)
    if user_has_consent(context, uid):
        await send_welcome(update, context, with_menu=True)
        return

    context.user_data.pop("consent_given", None)
    await send_welcome(update, context, with_menu=False)
    await send_consent_flow(update, context, include_pdf=True)


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.message and update.effective_chat:
        track_message(update.effective_chat.id, update.message.message_id)
    user = update.effective_user
    if not user_has_consent(context, user.id if user else None):
        await send_consent_flow(update, context)
        return
    context.user_data.pop("awaiting_feedback", None)
    await reply_html(
        update,
        f"{menus.idera('blue')} <b>Команды {menus.BOT_NAME}</b>\n"
        "/start — приветствие и главное меню\n"
        "/menu — открыть главное меню\n"
        "/feedback — книга жалоб и предложений\n"
        "/clear — очистить чат\n"
        "/id — ваш Telegram ID\n"
        "/ping — проверка\n\n"
        f"Кнопки меню внизу экрана {menus.idera('rocket')}",
        context,
        screen="main",
    )


async def menu_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.message and update.effective_chat:
        track_message(update.effective_chat.id, update.message.message_id)
    user = update.effective_user
    if not user_has_consent(context, user.id if user else None):
        await send_consent_flow(update, context)
        return
    context.user_data.pop("awaiting_feedback", None)
    context.user_data.pop("quiz", None)
    context.user_data.pop("visitka", None)
    context.user_data.pop("qual", None)
    await reply_html(update, menus.MAIN_TEXT, context, screen="main")


async def feedback_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.message and update.effective_chat:
        track_message(update.effective_chat.id, update.message.message_id)
    user = update.effective_user
    if not user_has_consent(context, user.id if user else None):
        await send_consent_flow(update, context)
        return
    context.user_data.pop("quiz", None)
    context.user_data.pop("visitka", None)
    context.user_data.pop("qual", None)
    context.user_data["awaiting_feedback"] = True
    await reply_html(update, menus.FEEDBACK_PROMPT_TEXT, context, screen="feedback")


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
    user = update.effective_user
    uid = user.id if user else None
    if user_has_consent(context, uid):
        sent = await context.bot.send_message(
            chat_id=chat_id,
            text=(
                f"🧹 Чат очищен. Удалено сообщений: {deleted}.\n"
                "Нажми /start или выбери раздел в меню."
            ),
            reply_markup=menus.main_keyboard(),
        )
        set_screen(context, "main")
    else:
        sent = await context.bot.send_message(
            chat_id=chat_id,
            text=(
                f"🧹 Чат очищен. Удалено сообщений: {deleted}.\n"
                "Нажми /start, чтобы продолжить."
            ),
            reply_markup=ReplyKeyboardRemove(),
        )
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
    if not user_id:
        return False
    allowed = admin_ids()
    if allowed:
        return user_id in allowed
    owner = claim_owner(user_id)
    return owner == user_id


def _feedback_destinations() -> set[int]:
    service = get_service_chat_id()
    if service:
        return {service}
    dest = set(admin_ids())
    owner = get_owner_id()
    if owner:
        dest.add(owner)
    raw = os.getenv("FEEDBACK_CHAT_ID", "").strip()
    if raw.isdigit() or (raw.startswith("-") and raw[1:].isdigit()):
        dest.add(int(raw))
    return dest


def _forwarded_origin_chat(message):
    origin = getattr(message, "forward_origin", None)
    chat = getattr(origin, "chat", None)
    if chat is not None:
        return chat
    chat = getattr(origin, "sender_chat", None)
    if chat is not None:
        return chat
    return getattr(message, "forward_from_chat", None)


def _service_inbox_error(chat) -> str | None:
    if chat is None:
        return "Не вижу канал. Перешлите пост из вашего приватного канала."
    if getattr(chat, "type", None) == "private":
        return (
            "Личный чат с ботом для этого не подходит. "
            "Нужен отдельный приватный канал только для вас."
        )
    if getattr(chat, "username", None):
        return (
            "Этот канал публичный, его могут найти по ссылке.\n"
            "Создайте приватный канал без @имени, никого туда не добавляйте "
            "и сделайте бота администратором."
        )
    if getattr(chat, "type", None) not in {"channel", "group", "supergroup"}:
        return "Нужен приватный канал (лучше) или закрытая группа только с вами."
    return None


async def _link_service_chat(bot, *, actor_id: int, chat) -> str:
    if not _is_admin(actor_id):
        return "Привязать служебный канал может только владелец бота."
    error = _service_inbox_error(chat)
    if error:
        return error
    try:
        sent = await bot.send_message(
            chat_id=chat.id,
            text=menus.SERVICE_LINKED_CHAT_TEXT,
        )
    except Exception:
        logger.exception("Не удалось написать в служебный чат %s", chat.id)
        return (
            "Бот не смог написать в этот канал.\n"
            "Сделайте его администратором с правом публиковать сообщения "
            "и повторите: добавьте бота заново или перешлите пост после /service."
        )
    set_service_chat(
        chat.id,
        title=getattr(chat, "title", None) or "",
        chat_type=getattr(chat, "type", None) or "",
    )
    try:
        await bot.pin_chat_message(
            chat.id, sent.message_id, disable_notification=True
        )
    except Exception:
        logger.info("Не удалось закрепить сообщение в служебном чате %s", chat.id)
    title = getattr(chat, "title", None) or str(chat.id)
    extra = ""
    if getattr(chat, "type", None) in {"group", "supergroup"}:
        extra = (
            "\n\nЭто группа. Если в ней есть ещё люди, они тоже увидят обращения. "
            "Для полной приватности лучше приватный канал, где подписчик только вы."
        )
    return (
        f"Готово. Обращения из книги жалоб будут приходить в «{title}».\n"
        "Личный чат с ботом больше этим не забивается."
        f"{extra}"
    )


async def _bot_mention(bot) -> str:
    try:
        me = await bot.get_me()
    except Exception:
        return "@lDera_bot"
    if me.username:
        return f"@{me.username}"
    return me.first_name or "бот"


def _service_status_text(bot_mention: str) -> str:
    row = get_service_chat()
    if row:
        title = row.get("title") or str(row.get("id"))
        return (
            f"Служебный ящик привязан: «{title}».\n"
            "Обращения приходят только туда. Никого в этот канал не добавляйте.\n\n"
            "Отвязать: /service off"
        )
    return (
        "Чтобы не пропустить личные обращения, заведите отдельный приватный канал "
        "только для себя.\n\n"
        "1. Telegram → Новый канал.\n"
        "2. Название, например: IDera — обращения.\n"
        "3. Сделайте канал приватным, без ссылки и без @имени.\n"
        "4. Никого не приглашайте — подписчик только вы.\n"
        f"5. Добавьте {bot_mention} администратором с правом публиковать сообщения.\n"
        "6. Как только добавите бота, канал привяжется сам.\n\n"
        "Если не привязался — напишите сюда /service и перешлите любой пост "
        "из этого канала.\n\n"
        "Отвязать позже: /service off"
    )


def _format_feedback_notice(entry: dict) -> str:
    username = (entry.get("username") or "").strip()
    first_name = (entry.get("first_name") or "").strip()
    if username:
        who = f"{first_name} @{username}".strip()
    else:
        who = first_name or "без имени"
    when = (entry.get("at") or "").replace("T", " ").replace("+00:00", " UTC")
    body = (entry.get("text") or "").strip()
    header = (
        "✍️ Книга жалоб и предложений\n"
        f"От: {who}\n"
        f"ID: {entry.get('user_id') or '—'}\n"
        f"Когда: {when or '—'}\n"
        "\n"
        "Текст:\n"
    )
    limit = 3900 - len(header)
    if len(body) > limit:
        body = body[: max(0, limit - 1)] + "…"
    return header + body


async def notify_feedback(bot, entry: dict, *, sender_chat_id: int | None) -> int:
    text = _format_feedback_notice(entry)
    dests = _feedback_destinations()
    delivered = 0
    failed: list[int] = []
    for chat_id in dests:
        try:
            await bot.send_message(chat_id=chat_id, text=text)
            delivered += 1
        except Exception:
            logger.exception("Не удалось отправить обращение в чат %s", chat_id)
            failed.append(chat_id)
    service = get_service_chat_id()
    if service and service in failed:
        owner = get_owner_id()
        if owner and owner not in dests:
            try:
                await bot.send_message(
                    chat_id=owner,
                    text="⚠️ Служебный канал недоступен. Обращение:\n\n" + text,
                )
                delivered += 1
            except Exception:
                logger.exception("Не удалось продублировать обращение владельцу")
    if not dests:
        logger.warning(
            "Обращение от %s сохранено, получатели не заданы",
            sender_chat_id,
        )
    return delivered


async def submit_feedback(
    update: Update, context: ContextTypes.DEFAULT_TYPE, text: str
) -> None:
    context.user_data.pop("awaiting_feedback", None)
    user = update.effective_user
    entry = record_feedback(
        user.id if user else None,
        text=text,
        username=user.username if user else None,
        first_name=user.first_name if user else None,
    )
    delivered = await notify_feedback(
        context.bot,
        entry,
        sender_chat_id=update.effective_chat.id if update.effective_chat else None,
    )
    if delivered == 0:
        logger.warning("Обращение сохранено, но некому переслать в Telegram")
    await reply_html(update, menus.FEEDBACK_THANKS_TEXT, context, screen="main")


async def stats_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if not update.message:
        return
    if not _is_admin(user.id if user else None):
        await update.message.reply_text("Эта команда только для владельца бота.")
        return
    data = snapshot()
    lines = [
        "📊 Статистика бота",
        "",
        f"👥 Уникальных людей: {data['unique_users']}",
        f"🚀 /start: {data['starts']}",
        f"💬 Сообщений: {data['messages']}",
        f"🔘 Кликов: {data['callbacks']}",
        "",
        f"✅ Согласие дали: {data['consented']}",
        f"❌ Отказали: {data['declined']}",
        f"⏳ Ещё не ответили: {data['pending']}",
        f"💾 Файл: {data['stats_path']}",
    ]
    recent = data.get("consents") or []
    if recent:
        lines.append("")
        lines.append("Последние согласия:")
        for row in recent[:20]:
            mark = "✅" if row["accepted"] else "❌"
            who = f"@{row['username']}" if row["username"] else row["first_name"] or "—"
            when = (row.get("at") or "")[:19].replace("T", " ")
            lines.append(f"{mark} {row['id']} {who} {when}")
    feedback_items = data.get("feedback") or []
    lines.append("")
    lines.append(f"✍️ Обращений: {data.get('feedback_count', len(feedback_items))}")
    service = data.get("service_chat")
    if service:
        title = service.get("title") or str(service.get("id"))
        lines.append(f"📥 Служебный канал: {title}")
    else:
        lines.append("📥 Служебный канал: не привязан — напишите /service")
    if feedback_items:
        lines.append("Последние обращения:")
        for row in feedback_items[:8]:
            who = f"@{row['username']}" if row.get("username") else row.get("first_name") or "—"
            when = (row.get("at") or "")[:19].replace("T", " ")
            preview = " ".join((row.get("text") or "").split())
            if len(preview) > 80:
                preview = preview[:79] + "…"
            lines.append(f"• {who} {when}: {preview}")
    text = "\n".join(lines)
    sent = await update.message.reply_text(text)
    if update.effective_chat:
        track_message(update.effective_chat.id, update.message.message_id)
        track_message(update.effective_chat.id, sent.message_id)


async def service_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    if not update.message or not user:
        return
    if not _is_admin(user.id):
        await update.message.reply_text("Эта команда только для владельца бота.")
        return
    args = " ".join(context.args or []).strip().lower()
    if args in {"off", "unlink", "stop", "отвязать"}:
        clear_service_chat()
        context.user_data.pop("awaiting_service_link", None)
        await update.message.reply_text(
            "Служебный канал отвязан. Обращения снова будут приходить вам в личку с ботом."
        )
        return

    chat = update.effective_chat
    if chat and chat.type in {"channel", "group", "supergroup"}:
        result = await _link_service_chat(
            context.bot, actor_id=user.id, chat=chat
        )
        await update.message.reply_text(result)
        return

    mention = await _bot_mention(context.bot)
    if get_service_chat_id() is None:
        context.user_data["awaiting_service_link"] = True
    await update.message.reply_text(_service_status_text(mention))


async def on_my_chat_member(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> None:
    event = update.my_chat_member
    if not event or not event.new_chat_member:
        return
    new = event.new_chat_member
    if new.user.id != context.bot.id:
        return
    actor = event.from_user
    chat = event.chat
    if new.status in {ChatMemberStatus.LEFT, ChatMemberStatus.BANNED}:
        if get_service_chat_id() == chat.id:
            clear_service_chat()
            if actor:
                try:
                    await context.bot.send_message(
                        chat_id=actor.id,
                        text=(
                            "Служебный канал отвязан: бота убрали из канала. "
                            "Обращения снова будут приходить в личку. "
                            "Привязать заново: /service"
                        ),
                    )
                except Exception:
                    logger.exception("Не удалось сообщить об отвязке служебного канала")
        return
    if not actor or not _is_admin(actor.id):
        return
    if new.status != ChatMemberStatus.ADMINISTRATOR:
        if actor and chat.type == "channel":
            try:
                await context.bot.send_message(
                    chat_id=actor.id,
                    text=(
                        "В канале бот должен быть администратором "
                        "с правом публиковать сообщения. Назначьте его админом."
                    ),
                )
            except Exception:
                logger.exception("Не удалось подсказать про права в канале")
        return
    result = await _link_service_chat(
        context.bot, actor_id=actor.id, chat=chat
    )
    try:
        context.application.user_data[actor.id].pop("awaiting_service_link", None)
    except Exception:
        pass
    try:
        await context.bot.send_message(chat_id=actor.id, text=result)
    except Exception:
        logger.exception("Не удалось подтвердить привязку служебного канала")


async def on_service_forward(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> None:
    message = update.message
    user = update.effective_user
    if not message or not user or not _is_admin(user.id):
        return
    if not context.user_data.get("awaiting_service_link"):
        return
    origin = _forwarded_origin_chat(message)
    if origin is None:
        await message.reply_text(
            "Не вижу канал в пересланном сообщении. "
            "Перешлите пост из вашего приватного канала."
        )
        return
    context.user_data.pop("awaiting_service_link", None)
    result = await _link_service_chat(
        context.bot, actor_id=user.id, chat=origin
    )
    await message.reply_text(result)


async def ping(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.message and update.effective_chat:
        track_message(update.effective_chat.id, update.message.message_id)
    sent = await update.message.reply_text("pong ✅")
    if update.effective_chat:
        track_message(update.effective_chat.id, sent.message_id)


def _quiz_data(context: ContextTypes.DEFAULT_TYPE) -> dict:
    data = context.user_data.get("quiz")
    if not isinstance(data, dict):
        data = {}
        context.user_data["quiz"] = data
    return data


async def start_quiz(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    context.user_data["quiz"] = {"phase": "intro"}
    await reply_html(update, bad_quiz.INTRO, context, screen="quiz_intro")


async def send_quiz_goals(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    data = _quiz_data(context)
    data["phase"] = "goals"
    data.pop("q_index", None)
    await reply_html(update, bad_quiz.ASK, context, screen="quiz_goals")


async def send_quiz_question(
    update: Update, context: ContextTypes.DEFAULT_TYPE, index: int
) -> None:
    data = _quiz_data(context)
    data["phase"] = "step"
    data["q_index"] = index
    await reply_html(
        update, bad_quiz.question_text(index), context, screen="quiz_step"
    )


async def finish_quiz(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    data = context.user_data.pop("quiz", {}) or {}
    set_screen(context, "main")
    goals = list(data.get("goals") or [])
    answers = list(data.get("answers") or [])
    product = bad_quiz.score_product(goals, answers)
    why: str | None = None

    if update.message:
        await update.message.chat.send_action(ChatAction.TYPING)
        sent_wait = await _tg_retry(
            lambda: update.message.reply_text(
                bad_quiz.RESULT_WAIT,
                reply_markup=menus.main_keyboard(),
            )
        )
        if update.effective_chat:
            track_message(update.effective_chat.id, sent_wait.message_id)

    try:
        item = bad_quiz.PRODUCTS[product]
        raw = await ask_ai_once(
            bad_quiz.AI_SYSTEM,
            "Продукт уже выбран, менять нельзя: "
            f"{item['name']} ({product}).\n"
            f"О продукте: {item['blurb']}\n\n"
            f"{bad_quiz.answers_for_ai(goals, answers)}",
        )
        why = bad_quiz.parse_ai_why(raw)
    except Exception:
        logger.exception("Quiz AI recommendation failed")

    await reply_html(
        update, bad_quiz.format_result(product, why), context, screen="main"
    )


async def handle_quiz_back(
    update: Update, context: ContextTypes.DEFAULT_TYPE
) -> None:
    current = screen_of(context)
    data = context.user_data.get("quiz")
    if current == "quiz_step" and isinstance(data, dict):
        answers = list(data.get("answers") or [])
        if answers:
            answers.pop()
            data["answers"] = answers
        idx = int(data.get("q_index") or 0)
        if idx > 0:
            await send_quiz_question(update, context, idx - 1)
            return
        await send_quiz_goals(update, context)
        return
    if current == "quiz_goals":
        await start_quiz(update, context)
        return
    context.user_data.pop("quiz", None)
    await reply_html(update, menus.MAIN_TEXT, context, screen="main")


async def handle_quiz_flow(
    update: Update, context: ContextTypes.DEFAULT_TYPE, text: str
) -> bool:
    screen = screen_of(context)
    if screen not in {"quiz_intro", "quiz_goals", "quiz_step"}:
        return False
    if text == menus.BTN_BACK:
        await handle_quiz_back(update, context)
        return True
    if text == menus.BTN_MAIN or text == "🏠 Главное меню":
        context.user_data.pop("quiz", None)
        await reply_html(update, menus.MAIN_TEXT, context, screen="main")
        return True
    if screen == "quiz_intro":
        if text in menus.QUIZ_START_ALIASES:
            await send_quiz_goals(update, context)
            return True
        return False
    if screen == "quiz_goals":
        goals = bad_quiz.parse_goals(text)
        if goals is None:
            await reply_html(update, bad_quiz.ASK_RETRY, context, screen="quiz_goals")
            return True
        data = _quiz_data(context)
        data["goals"] = goals
        data["answers"] = []
        await send_quiz_question(update, context, 0)
        return True

    data = _quiz_data(context)
    idx = int(data.get("q_index") or 0)
    option = bad_quiz.match_option(idx, text)
    if option is None:
        await reply_html(update, bad_quiz.STEP_RETRY, context, screen="quiz_step")
        return True
    answers = list(data.get("answers") or [])
    qid = bad_quiz.QUESTIONS[idx]["id"]
    answers = [row for row in answers if row.get("id") != qid]
    answers.append({"id": qid, "text": option})
    data["answers"] = answers
    nxt = idx + 1
    if nxt >= len(bad_quiz.QUESTIONS):
        await finish_quiz(update, context)
        return True
    await send_quiz_question(update, context, nxt)
    return True


async def handle_back(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    current = screen_of(context)
    if current in {"quiz_intro", "quiz_goals", "quiz_step"}:
        await handle_quiz_back(update, context)
        return
    if current in {"visitka", "visitka_pick"}:
        context.user_data.pop("visitka", None)
    if current in {"qual_orient", "qual_rank", "qual"}:
        await handle_qual_back(update, context)
        return
    if current == "feedback":
        context.user_data.pop("awaiting_feedback", None)
    parent = menus.PARENT.get(current, "main")
    texts = {
        "main": menus.MAIN_TEXT,
        "business": menus.BUSINESS_TEXT,
        "about": menus.ABOUT_TEXT,
        "partners": menus.PARTNERS_TEXT,
        "materials": menus.MATERIALS_TEXT,
        "business_tools": menus.BUSINESS_TOOLS_TEXT,
        "track": menus.TRACK_TEXT,
        "ip_self": menus.IP_SELF_TEXT,
        "quiz_intro": bad_quiz.INTRO,
        "events": menus.EVENTS_TEXT,
        "upcoming": menus.UPCOMING_TEXT,
        "archive": menus.ARCHIVE_TEXT,
        "visitka_pick": menus.VISITKA_PICK_TEXT,
        "qual_orient": menus.QUAL_ORIENT_TEXT,
        "qual_rank": menus.QUAL_RANK_TEXT,
        "product": menus.PRODUCT_TEXT,
    }
    text = texts.get(parent, menus.MAIN_TEXT)
    await reply_html(update, text, context, screen=parent)


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.message.text or not update.effective_chat:
        return

    text = update.message.text.strip()
    chat_id = update.effective_chat.id
    user = update.effective_user
    uid = user.id if user else None
    record_user(
        uid,
        event="message",
        username=user.username if user else None,
        first_name=user.first_name if user else None,
    )
    track_message(chat_id, update.message.message_id)

    if context.user_data.get("awaiting_service_link") and _is_admin(uid):
        origin = _forwarded_origin_chat(update.message)
        if origin is not None:
            context.user_data.pop("awaiting_service_link", None)
            result = await _link_service_chat(
                context.bot, actor_id=uid, chat=origin
            )
            sent = await update.message.reply_text(result)
            track_message(chat_id, sent.message_id)
            return

    if text == menus.BTN_CONSENT_YES:
        set_consent(context, accepted=True)
        record_consent(
            uid,
            accepted=True,
            username=user.username if user else None,
            first_name=user.first_name if user else None,
        )
        await send_welcome(update, context, with_menu=True)
        return

    if text == menus.BTN_CONSENT_NO:
        set_consent(context, accepted=False)
        record_consent(
            uid,
            accepted=False,
            username=user.username if user else None,
            first_name=user.first_name if user else None,
        )
        sent = await _tg_retry(
            lambda: update.message.reply_text(
                menus.CONSENT_DECLINED_TEXT,
                reply_markup=ReplyKeyboardRemove(),
            )
        )
        track_message(chat_id, sent.message_id)
        return

    if consent_blocked(context):
        sent = await _tg_retry(
            lambda: update.message.reply_text(
                menus.CONSENT_DECLINED_TEXT,
                reply_markup=ReplyKeyboardRemove(),
            )
        )
        track_message(chat_id, sent.message_id)
        return

    if not user_has_consent(context, uid):
        await send_consent_flow(update, context)
        return

    if context.user_data.get("awaiting_feedback"):
        if text == menus.BTN_FEEDBACK_CANCEL:
            context.user_data.pop("awaiting_feedback", None)
            await reply_html(
                update, menus.FEEDBACK_CANCEL_TEXT, context, screen="main"
            )
            return
        if text not in menus.MENU_LABELS:
            if len(text) < 3:
                await reply_html(
                    update, menus.FEEDBACK_TOO_SHORT_TEXT, context, screen="feedback"
                )
                return
            await submit_feedback(update, context, text)
            return
        context.user_data.pop("awaiting_feedback", None)

    screen = screen_of(context)

    if await handle_quiz_flow(update, context, text):
        return

    # Navigation buttons
    if text == menus.BTN_MAIN or text == "🏠 Главное меню":
        context.user_data.pop("visitka", None)
        context.user_data.pop("qual", None)
        context.user_data.pop("quiz", None)
        await reply_html(update, menus.MAIN_TEXT, context, screen="main")
        return
    if text == menus.BTN_BACK:
        await handle_back(update, context)
        return

    if await handle_visitka_flow(update, context, text):
        return

    if await handle_qual_flow(update, context, text):
        return

    if text == menus.BTN_BAD:
        await start_quiz(update, context)
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
    if text == menus.BTN_PARTNERS_PDF:
        await reply_html(update, menus.MATERIALS_TEXT, context, screen="materials")
        return
    if text in {menus.BTN_STICKERS, menus.BTN_STICKER_ETG}:
        await send_pack_preview(
            update,
            context,
            set_name=menus.STICKER_PACK_NAME,
            text=menus.STICKER_PACK_TEXT,
        )
        return
    if text in {menus.BTN_EMOJI, menus.BTN_EMOD_ETG}:
        await send_pack_preview(
            update,
            context,
            set_name=menus.EMOJI_PACK_NAME,
            text=menus.EMOJI_PACK_TEXT,
        )
        return
    if text == menus.BTN_BUSINESS_TOOLS:
        await reply_html(
            update, menus.BUSINESS_TOOLS_TEXT, context, screen="business_tools"
        )
        return
    if text == menus.BTN_VISITKA:
        await start_visitka(update, context)
        return
    if text == menus.BTN_QUAL:
        await start_qual(update, context)
        return
    if text in menus.TRACK_BUTTON_ALIASES:
        await send_tracks(update, context)
        return
    if text in menus.VIDEO_30S_ALIASES:
        await send_video_track(update, context)
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
        await reply_html(update, menus.UPCOMING_TEXT, context, screen="upcoming")
        return
    upcoming_event = menus.UPCOMING_BY_BUTTON.get(text)
    if upcoming_event:
        await reply_html(
            update,
            menus.upcoming_event_text(upcoming_event),
            context,
            screen="upcoming_item",
            preview=True,
        )
        return
    if text == menus.BTN_ARCHIVE:
        await reply_html(update, menus.ARCHIVE_TEXT, context, screen="archive")
        return
    archive_event = menus.ARCHIVE_BY_BUTTON.get(text)
    if archive_event:
        await reply_html(
            update,
            menus.archive_event_text(archive_event),
            context,
            screen="archive_item",
            preview=True,
        )
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

    # Free-text AI fallback (no reply-keyboard wipe)
    if not provider_chains():
        await reply_html(
            update,
            "Выбери раздел в меню ниже.\nИли нажми /menu",
            context,
        )
        return

    await update.message.chat.send_action(ChatAction.TYPING)
    try:
        reply = await ask_ai(chat_id, text)
    except Exception:
        logger.exception("AI error")
        sent = await update.message.reply_text(
            "Сейчас не могу ответить текстом. Пользуйся кнопками меню.",
            reply_markup=keyboard_for(
                screen_of(context), context, update.effective_user
            ),
        )
        track_message(chat_id, sent.message_id)
        return

    for chunk in split_message(reply):
        entities = menus.idera_entities_from_text(chunk)
        sent = await update.message.reply_text(
            chunk,
            entities=entities or None,
            reply_markup=keyboard_for(
                screen_of(context), context, update.effective_user
            ),
        )
        track_message(chat_id, sent.message_id)


async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    logger.exception("Ошибка: %s", context.error)


async def post_init(app: Application) -> None:
    await app.bot.set_my_commands(
        [
            BotCommand("start", f"{menus.idera_fallback('rocket')} Старт"),
            BotCommand("menu", f"{menus.idera_fallback('blue')} Меню"),
            BotCommand("feedback", "✍️ Книга жалоб и предложений"),
            BotCommand("clear", "🧹 Очистить чат"),
        ]
    )
    await app.bot.set_chat_menu_button(menu_button=MenuButtonCommands())
    try:
        await app.bot.set_my_description(
            description=(
                f"{menus.BOT_NAME} — тихий ориентир рядом с тобой.\n"
                "Ясность в нужный момент и кнопка, с которой можно начать."
            )
        )
        await app.bot.set_my_short_description(
            short_description=f"{menus.BOT_NAME}. Ясность рядом, всегда на связи."
        )
        await app.bot.set_my_name(name=menus.BOT_NAME)
    except Exception:
        logger.exception("Не удалось обновить описание бота")
    names = [
        menus.DOC_FILES[button]
        for button in menus.PRODUCT_PRESENTATION_BUTTONS
        if button in menus.DOC_FILES
    ]
    asyncio.create_task(asyncio.to_thread(pdf_preview.warm, DOCS, names))


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
        .concurrent_updates(True)
        .build()
    )
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("menu", menu_command))
    app.add_handler(CommandHandler("feedback", feedback_command))
    app.add_handler(CommandHandler("clear", clear_command))
    app.add_handler(CommandHandler("ping", ping))
    app.add_handler(CommandHandler("id", id_command))
    app.add_handler(CommandHandler("stats", stats_command))
    app.add_handler(CommandHandler("service", service_command))
    app.add_handler(
        ChatMemberHandler(on_my_chat_member, ChatMemberHandler.MY_CHAT_MEMBER)
    )
    app.add_handler(
        MessageHandler(
            filters.FORWARDED & ~filters.TEXT & filters.ChatType.PRIVATE,
            on_service_forward,
        )
    )
    app.add_handler(MessageHandler(filters.CONTACT, handle_visitka_contact))
    app.add_handler(
        MessageHandler(
            filters.ChatType.PRIVATE
            & (filters.PHOTO | filters.Document.IMAGE),
            handle_qual_media,
        )
    )
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    app.add_error_handler(error_handler)

    logger.info(
        "IDera HUB запущен (%s); stats=%s",
        " -> ".join(providers) or "без AI",
        os.getenv("STATS_PATH", "data/stats.json"),
    )
    app.run_polling(
        allowed_updates=Update.ALL_TYPES,
        drop_pending_updates=True,
    )


if __name__ == "__main__":
    main()
