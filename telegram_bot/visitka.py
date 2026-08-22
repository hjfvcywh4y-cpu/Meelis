"""Генерация персональной визитки IDera из чистого PDF-шаблона."""

from __future__ import annotations

import re
import tempfile
from pathlib import Path

import pymupdf
import qrcode
from PIL import Image, ImageDraw, ImageFont

TEMPLATE = Path(__file__).resolve().parent / "docs" / "IDERA_vizitka.pdf"

# Координаты на нативном растре шаблона (1448×1086).
NAME_XY = (810, 378)
TITLE_XY = (810, 428)
TG_XY = (900, 494)  # центр по вертикали у иконки Telegram
PHONE_XY = (900, 574)  # центр по вертикали у иконки телефона
TEXT_MAX_X = 1040  # не заходить за вертикальный разделитель
QR_BOX = (1125, 365, 1335, 575)  # внутренность скруглённой рамки QR

NAME_COLOR = (25, 45, 85)
TITLE_COLOR = (90, 140, 200)
CONTACT_COLOR = (45, 105, 175)
QR_FILL = (25, 55, 110)

_FONT_BOLD = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
_FONT_REG = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")


def normalize_telegram(raw: str) -> str | None:
    text = raw.strip()
    if not text:
        return None
    text = text.replace("https://", "").replace("http://", "")
    text = text.replace("t.me/", "").replace("telegram.me/", "")
    text = text.lstrip("@").strip().strip("/")
    if not re.fullmatch(r"[A-Za-z0-9_]{4,64}", text):
        return None
    return text


def normalize_phone(raw: str) -> str | None:
    text = raw.strip()
    if not text:
        return None
    digits = re.sub(r"\D", "", text)
    if len(digits) < 10 or len(digits) > 15:
        return None
    return text


def normalize_name(raw: str) -> str | None:
    text = " ".join(raw.strip().split())
    if len(text) < 2 or len(text) > 60:
        return None
    return text


def _fit_font(
    draw: ImageDraw.ImageDraw,
    text: str,
    font_path: Path,
    max_size: int,
    max_width: int,
) -> ImageFont.FreeTypeFont:
    for size in range(max_size, 15, -1):
        font = ImageFont.truetype(str(font_path), size)
        if draw.textlength(text, font=font) <= max_width:
            return font
    return ImageFont.truetype(str(font_path), 16)


def _load_template_image() -> tuple[Image.Image, pymupdf.Rect]:
    if not TEMPLATE.exists():
        raise FileNotFoundError(f"Нет шаблона визитки: {TEMPLATE}")
    doc = pymupdf.open(TEMPLATE)
    page = doc[0]
    images = page.get_images(full=True)
    if not images:
        doc.close()
        raise RuntimeError("В шаблоне визитки нет изображения")
    xref = images[0][0]
    pix = pymupdf.Pixmap(doc, xref)
    if pix.n > 3:
        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    rect = pymupdf.Rect(page.rect)
    doc.close()
    return image, rect


def build_visitka_pdf(*, name: str, phone: str, telegram: str) -> Path:
    """Собрать персональный PDF; возвращает путь к временному файлу."""
    username = normalize_telegram(telegram)
    full_name = normalize_name(name)
    phone_n = normalize_phone(phone)
    if not username or not full_name or not phone_n:
        raise ValueError("bad fields")

    base, page_rect = _load_template_image()
    im = base.copy()
    draw = ImageDraw.Draw(im)

    name_font = _fit_font(
        draw, full_name, _FONT_BOLD, 40, TEXT_MAX_X - NAME_XY[0]
    )
    title_font = ImageFont.truetype(str(_FONT_REG), 24)
    tg_label = f"@{username}"
    contact_font = _fit_font(
        draw, tg_label, _FONT_REG, 26, TEXT_MAX_X - TG_XY[0]
    )
    phone_font = _fit_font(
        draw, phone_n, _FONT_REG, contact_font.size, TEXT_MAX_X - PHONE_XY[0]
    )

    # Только текст — без прямоугольных подложек.
    draw.text(NAME_XY, full_name, font=name_font, fill=NAME_COLOR, anchor="ls")
    draw.text(
        TITLE_XY, "Партнёр IDERA", font=title_font, fill=TITLE_COLOR, anchor="ls"
    )
    draw.text(TG_XY, tg_label, font=contact_font, fill=CONTACT_COLOR, anchor="lm")
    draw.text(
        PHONE_XY, phone_n, font=phone_font, fill=CONTACT_COLOR, anchor="lm"
    )

    qr_bg = im.getpixel(
        ((QR_BOX[0] + QR_BOX[2]) // 2, (QR_BOX[1] + QR_BOX[3]) // 2)
    )
    qr = qrcode.QRCode(
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    qr.add_data(f"https://t.me/{username}")
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color=QR_FILL, back_color=qr_bg).convert("RGB")
    qr_img = qr_img.resize(
        (QR_BOX[2] - QR_BOX[0], QR_BOX[3] - QR_BOX[1]),
        Image.Resampling.NEAREST,
    )
    im.paste(qr_img, (QR_BOX[0], QR_BOX[1]))

    tmp = tempfile.NamedTemporaryFile(
        prefix="idera_visitka_", suffix=".pdf", delete=False
    )
    tmp_path = Path(tmp.name)
    tmp.close()
    jpg_path = tmp_path.with_suffix(".jpg")
    im.save(jpg_path, format="JPEG", quality=92, optimize=True)

    out = pymupdf.open()
    new_page = out.new_page(width=page_rect.width, height=page_rect.height)
    new_page.insert_image(page_rect, filename=str(jpg_path))
    out.save(tmp_path)
    out.close()
    jpg_path.unlink(missing_ok=True)
    return tmp_path
