"""Генерация персональной визитки IDera из PDF-шаблона."""

from __future__ import annotations

import re
import tempfile
from pathlib import Path

import pymupdf
import qrcode
from PIL import Image, ImageDraw, ImageFont

TEMPLATE = Path(__file__).resolve().parent / "docs" / "IDERA_vizitka.pdf"
RENDER_SCALE = 4

# Координаты на hi-res (scale=4) относительно кропа правой карточки.
# База кропа: (690, 240) на полном рендере шаблона.
_OX, _OY = 690, 240
BOXES = {
    "name": (_OX + 15, _OY + 145, _OX + 360, _OY + 220),
    "tg": (_OX + 130, _OY + 288, _OX + 370, _OY + 348),
    "phone": (_OX + 130, _OY + 348, _OX + 380, _OY + 415),
    "qr": (_OX + 380, _OY + 75, _OX + 610, _OY + 305),
}

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


def _cover(im: Image.Image, box: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = box
    sx0 = max(_OX, x0 - 25)
    sx1 = max(_OX + 1, x0)
    sample = im.crop((sx0, y0, sx1, y1))
    if sample.width < 1 or sample.height < 1:
        sample = im.crop((x0, max(0, y0 - 15), x1, y0))
    # median-ish via resize trick
    tiny = sample.resize((1, 1), Image.Resampling.BOX)
    color = tiny.getpixel((0, 0))
    ImageDraw.Draw(im).rectangle(box, fill=color)


def _fit_font(draw: ImageDraw.ImageDraw, text: str, font_path: Path, max_size: int, max_width: int) -> ImageFont.FreeTypeFont:
    size = max_size
    while size >= 16:
        font = ImageFont.truetype(str(font_path), size)
        if draw.textlength(text, font=font) <= max_width:
            return font
        size -= 2
    return ImageFont.truetype(str(font_path), 16)


def build_visitka_pdf(*, name: str, phone: str, telegram: str) -> Path:
    """Собрать персональный PDF; возвращает путь к временному файлу."""
    if not TEMPLATE.exists():
        raise FileNotFoundError(f"Нет шаблона визитки: {TEMPLATE}")

    username = normalize_telegram(telegram)
    if not username:
        raise ValueError("bad telegram")
    full_name = normalize_name(name)
    phone_n = normalize_phone(phone)
    if not full_name or not phone_n:
        raise ValueError("bad fields")

    doc = pymupdf.open(TEMPLATE)
    page = doc[0]
    mat = pymupdf.Matrix(RENDER_SCALE, RENDER_SCALE)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    im = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

    for box in BOXES.values():
        _cover(im, box)

    draw = ImageDraw.Draw(im)
    name_box = BOXES["name"]
    tg_box = BOXES["tg"]
    phone_box = BOXES["phone"]
    qr_box = BOXES["qr"]

    name_font = _fit_font(
        draw, full_name, _FONT_BOLD, 32, name_box[2] - name_box[0] - 16
    )
    contact_font = ImageFont.truetype(str(_FONT_REG), 20)
    tg_label = f"Telegram @{username}"
    if draw.textlength(tg_label, font=contact_font) > tg_box[2] - tg_box[0] - 8:
        tg_label = f"@{username}"

    draw.text((name_box[0] + 10, name_box[1] + 17), full_name, font=name_font, fill=(25, 45, 85))
    draw.text((tg_box[0] + 15, tg_box[1] + 17), tg_label, font=contact_font, fill=(45, 105, 175))
    draw.text((phone_box[0] + 15, phone_box[1] + 20), phone_n, font=contact_font, fill=(45, 105, 175))

    qr = qrcode.QRCode(
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=1,
    )
    qr.add_data(f"https://t.me/{username}")
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color=(25, 55, 110), back_color=(236, 243, 252)).convert("RGB")
    qw = qr_box[2] - qr_box[0] - 16
    qh = qr_box[3] - qr_box[1] - 16
    qr_img = qr_img.resize((qw, qh), Image.Resampling.NEAREST)
    im.paste(qr_img, (qr_box[0] + 8, qr_box[1] + 8))

    tmp = tempfile.NamedTemporaryFile(prefix="idera_visitka_", suffix=".pdf", delete=False)
    tmp_path = Path(tmp.name)
    tmp.close()
    png_path = tmp_path.with_suffix(".png")
    im.save(png_path, optimize=True)

    out = pymupdf.open()
    new_page = out.new_page(width=page.rect.width, height=page.rect.height)
    new_page.insert_image(page.rect, filename=str(png_path))
    out.save(tmp_path)
    out.close()
    doc.close()
    png_path.unlink(missing_ok=True)
    return tmp_path
