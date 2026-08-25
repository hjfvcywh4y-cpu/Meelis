"""Генерация персональной визитки IDera из выбранного макета."""

from __future__ import annotations

import io
import re
import tempfile
from pathlib import Path

import pymupdf
import qrcode
from PIL import Image, ImageDraw, ImageFont

DOCS = Path(__file__).resolve().parent / "docs"

TEMPLATE_QR = "qr"
TEMPLATE_LIGHT = "light"
TEMPLATE_BLUE = "blue"
TEMPLATE_MODEL3 = "model3"
TEMPLATE_IDS = (TEMPLATE_QR, TEMPLATE_LIGHT, TEMPLATE_BLUE, TEMPLATE_MODEL3)

_FILES = {
    TEMPLATE_QR: DOCS / "IDERA_vizitka.pdf",
    TEMPLATE_LIGHT: DOCS / "IDERA_vizitka_light.jpg",
    TEMPLATE_BLUE: DOCS / "IDERA_vizitka_blue.jpg",
    TEMPLATE_MODEL3: DOCS / "IDERA_vizitka_model3.jpg",
}

# Координаты на нативном растре QR-макета (1448×1086).
NAME_XY = (800, 419)
TITLE_XY = (800, 479)
TG_XY = (800, 559)
PHONE_XY = (800, 619)
TEXT_MAX_X = 1090
QR_BOX = (1133, 380, 1327, 574)

NAME_COLOR = (25, 45, 85)
TITLE_COLOR = (90, 140, 200)
CONTACT_COLOR = (45, 105, 175)
QR_FILL = (25, 55, 110)

# Светлый макет: пустые «таблетки» на обороте (полный JPEG 1280×404).
LIGHT_NAME_BOX = (924, 223, 1174, 254)
LIGHT_CONTACT_BOX = (924, 281, 1174, 311)
LIGHT_FILL = (30, 70, 120)

# Голубой макет: текст над белыми линиями (полный JPEG 1280×434).
BLUE_TEXT_X = 707
BLUE_NAME_Y = 275
BLUE_PHONE_Y = 333
BLUE_TG_Y = 359
BLUE_MAX_W = 480
BLUE_FILL = (25, 45, 85)

# Модель 3: белые полосы под подписями на обороте (полный JPEG 1280×401).
MODEL3_NAME_BOX = (706, 236, 1211, 260)
MODEL3_CONTACT_BOX = (706, 310, 1211, 344)
MODEL3_FILL = (30, 70, 120)

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


def profile_name(user) -> str | None:
    if user is None:
        return None
    parts = [
        str(getattr(user, "first_name", None) or "").strip(),
        str(getattr(user, "last_name", None) or "").strip(),
    ]
    return normalize_name(" ".join(p for p in parts if p))


def profile_username(user) -> str | None:
    if user is None:
        return None
    return normalize_telegram(str(getattr(user, "username", None) or ""))


def template_path(template_id: str) -> Path:
    path = _FILES.get(template_id)
    if path is None:
        raise ValueError(f"unknown visitka template: {template_id}")
    return path


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


def _load_qr_template_image() -> tuple[Image.Image, pymupdf.Rect]:
    path = template_path(TEMPLATE_QR)
    if not path.exists():
        raise FileNotFoundError(f"Нет шаблона визитки: {path}")
    doc = pymupdf.open(path)
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


def preview_jpeg_bytes(template_id: str) -> bytes:
    """JPEG превью пустого макета."""
    if template_id == TEMPLATE_QR:
        image, _rect = _load_qr_template_image()
        buf = io.BytesIO()
        image.save(buf, format="JPEG", quality=88, optimize=True)
        return buf.getvalue()
    path = template_path(template_id)
    if not path.exists():
        raise FileNotFoundError(f"Нет шаблона визитки: {path}")
    return path.read_bytes()


def _save_image_pdf(im: Image.Image, page_rect: pymupdf.Rect | None = None) -> Path:
    tmp = tempfile.NamedTemporaryFile(
        prefix="idera_visitka_", suffix=".pdf", delete=False
    )
    tmp_path = Path(tmp.name)
    tmp.close()
    jpg_path = tmp_path.with_suffix(".jpg")
    im.convert("RGB").save(jpg_path, format="JPEG", quality=92, optimize=True)
    if page_rect is None:
        w, h = im.size
        page_w = 160 / 25.4 * 72
        page_h = page_w * h / w
        page_rect = pymupdf.Rect(0, 0, page_w, page_h)
    out = pymupdf.open()
    new_page = out.new_page(width=page_rect.width, height=page_rect.height)
    new_page.insert_image(page_rect, filename=str(jpg_path))
    out.save(tmp_path)
    out.close()
    jpg_path.unlink(missing_ok=True)
    return tmp_path


def _build_qr_pdf(*, name: str, phone: str, telegram: str) -> Path:
    username = telegram
    full_name = name
    phone_n = phone

    base, page_rect = _load_qr_template_image()
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

    draw.text(NAME_XY, full_name, font=name_font, fill=NAME_COLOR, anchor="ls")
    draw.text(
        TITLE_XY, "Партнёр IDERA", font=title_font, fill=TITLE_COLOR, anchor="ls"
    )
    draw.text(TG_XY, tg_label, font=contact_font, fill=CONTACT_COLOR, anchor="ls")
    draw.text(
        PHONE_XY, phone_n, font=phone_font, fill=CONTACT_COLOR, anchor="ls"
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
    return _save_image_pdf(im, page_rect)


def _draw_centered(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    text: str,
    font_path: Path,
    max_size: int,
    fill: tuple[int, int, int],
) -> None:
    x0, y0, x1, y1 = box
    font = _fit_font(draw, text, font_path, max_size, max(20, x1 - x0 - 12))
    draw.text(((x0 + x1) / 2, (y0 + y1) / 2), text, font=font, fill=fill, anchor="mm")


def _draw_contact_two_lines(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    phone: str,
    telegram: str,
    fill: tuple[int, int, int],
    *,
    max_size: int = 16,
    dy: int = 8,
) -> None:
    x0, y0, x1, y1 = box
    cx = (x0 + x1) / 2
    cy = (y0 + y1) / 2
    max_w = max(20, x1 - x0 - 12)
    tg = f"@{telegram}"
    phone_font = _fit_font(draw, phone, _FONT_REG, max_size, max_w)
    tg_font = _fit_font(draw, tg, _FONT_REG, max_size, max_w)
    draw.text((cx, cy - dy), phone, font=phone_font, fill=fill, anchor="mm")
    draw.text((cx, cy + dy), tg, font=tg_font, fill=fill, anchor="mm")


def _build_light_pdf(*, name: str, phone: str, telegram: str) -> Path:
    path = template_path(TEMPLATE_LIGHT)
    if not path.exists():
        raise FileNotFoundError(f"Нет шаблона визитки: {path}")
    im = Image.open(path).convert("RGB")
    draw = ImageDraw.Draw(im)
    _draw_centered(draw, LIGHT_NAME_BOX, name, _FONT_BOLD, 22, LIGHT_FILL)
    _draw_contact_two_lines(draw, LIGHT_CONTACT_BOX, phone, telegram, LIGHT_FILL)
    return _save_image_pdf(im)


def _build_model3_pdf(*, name: str, phone: str, telegram: str) -> Path:
    path = template_path(TEMPLATE_MODEL3)
    if not path.exists():
        raise FileNotFoundError(f"Нет шаблона визитки: {path}")
    im = Image.open(path).convert("RGB")
    draw = ImageDraw.Draw(im)
    _draw_centered(draw, MODEL3_NAME_BOX, name, _FONT_BOLD, 20, MODEL3_FILL)
    _draw_contact_two_lines(
        draw, MODEL3_CONTACT_BOX, phone, telegram, MODEL3_FILL, max_size=14, dy=7
    )
    return _save_image_pdf(im)


def _build_blue_pdf(*, name: str, phone: str, telegram: str) -> Path:
    path = template_path(TEMPLATE_BLUE)
    if not path.exists():
        raise FileNotFoundError(f"Нет шаблона визитки: {path}")
    im = Image.open(path).convert("RGB")
    draw = ImageDraw.Draw(im)
    name_font = _fit_font(draw, name, _FONT_BOLD, 18, BLUE_MAX_W)
    phone_font = _fit_font(draw, phone, _FONT_REG, 16, BLUE_MAX_W)
    tg_font = _fit_font(draw, f"@{telegram}", _FONT_REG, 16, BLUE_MAX_W)
    draw.text(
        (BLUE_TEXT_X, BLUE_NAME_Y), name, font=name_font, fill=BLUE_FILL, anchor="ls"
    )
    draw.text(
        (BLUE_TEXT_X, BLUE_PHONE_Y),
        phone,
        font=phone_font,
        fill=BLUE_FILL,
        anchor="ls",
    )
    draw.text(
        (BLUE_TEXT_X, BLUE_TG_Y),
        f"@{telegram}",
        font=tg_font,
        fill=BLUE_FILL,
        anchor="ls",
    )
    return _save_image_pdf(im)


def build_visitka_pdf(
    *,
    name: str,
    phone: str,
    telegram: str,
    template_id: str = TEMPLATE_QR,
) -> Path:
    """Собрать персональный PDF; возвращает путь к временному файлу."""
    username = normalize_telegram(telegram)
    full_name = normalize_name(name)
    phone_n = normalize_phone(phone)
    if not username or not full_name or not phone_n:
        raise ValueError("bad fields")
    if template_id == TEMPLATE_LIGHT:
        return _build_light_pdf(name=full_name, phone=phone_n, telegram=username)
    if template_id == TEMPLATE_BLUE:
        return _build_blue_pdf(name=full_name, phone=phone_n, telegram=username)
    if template_id == TEMPLATE_MODEL3:
        return _build_model3_pdf(name=full_name, phone=phone_n, telegram=username)
    return _build_qr_pdf(name=full_name, phone=phone_n, telegram=username)
