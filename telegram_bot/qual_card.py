"""Поздравительные карточки квалификации IDera: фото + имя на макете."""

from __future__ import annotations

import io
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

DOCS = Path(__file__).resolve().parent / "docs" / "qualifications"

ORIENT_H = "h"
ORIENT_V = "v"
ORIENT_IDS = (ORIENT_H, ORIENT_V)

# Нативный размер горизонтального макета. Вертикальные — 9:16 с той же
# карточкой по центру и полями сверху/снизу.
_H_SIZE = (2115, 1259)
# Внутренность скруглённой рамки справа (не золотая кайма).
_PHOTO_BOX = (1358, 328, 2062, 1096)
_PHOTO_RADIUS = 88
# Имя слева, под заголовком «ПОЗДРАВЛЯЕМ…», над бейджем ранга.
_NAME_XY = (108, 648)
_NAME_MAX_W = 1180

_FONT_BOLD = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")

_NAME_DARK = (48, 52, 60)
_NAME_LIGHT = (248, 248, 250)
_NAME_GOLD = (232, 204, 148)


@dataclass(frozen=True)
class Rank:
    id: str
    label: str


RANKS: tuple[Rank, ...] = (
    Rank("active", "ACTIVE"),
    Rank("m1", "MANAGER 1"),
    Rank("m2", "MANAGER 2"),
    Rank("m3", "MANAGER 3"),
    Rank("rm", "REGIONAL MANAGER"),
    Rank("d1", "DIRECTOR 1"),
    Rank("d2", "DIRECTOR 2"),
    Rank("d3", "DIRECTOR 3"),
    Rank("rd", "REGIONAL DIRECTOR"),
    Rank("nd", "NATIONAL DIRECTOR"),
    Rank("id", "INTERNATIONAL DIRECTOR"),
    Rank("ambassador", "AMBASSADOR"),
)

RANKS_BY_ID = {r.id: r for r in RANKS}
RANKS_BY_LABEL = {r.label: r for r in RANKS}


def normalize_name(raw: str) -> str | None:
    text = " ".join(raw.strip().split())
    if len(text) < 2 or len(text) > 60:
        return None
    return text


def template_path(orient: str, rank_id: str) -> Path:
    if orient not in ORIENT_IDS:
        raise ValueError(f"unknown qualification orientation: {orient}")
    if rank_id not in RANKS_BY_ID:
        raise ValueError(f"unknown qualification rank: {rank_id}")
    return DOCS / orient / f"{rank_id}.jpg"


def is_image_bytes(payload: bytes) -> bool:
    try:
        im = Image.open(io.BytesIO(payload))
        im.load()
        return im.size[0] >= 16 and im.size[1] >= 16
    except Exception:
        return False


def preview_jpeg_bytes(orient: str, rank_id: str) -> bytes:
    path = template_path(orient, rank_id)
    if not path.exists():
        raise FileNotFoundError(f"Нет макета квалификации: {path}")
    return path.read_bytes()


def _layout(size: tuple[int, int]) -> tuple[tuple[int, int, int, int], tuple[int, int], int, int]:
    """Photo box, name origin, max name width, corner radius for this canvas."""
    w, h = size
    sx = w / _H_SIZE[0]
    card_h = round(_H_SIZE[1] * sx)
    yoff = max(0, (h - card_h) // 2)
    x0, y0, x1, y1 = _PHOTO_BOX
    box = (
        round(x0 * sx),
        round(y0 * sx) + yoff,
        round(x1 * sx),
        round(y1 * sx) + yoff,
    )
    nx, ny = _NAME_XY
    name_xy = (round(nx * sx), round(ny * sx) + yoff)
    max_w = round(_NAME_MAX_W * sx)
    radius = max(12, round(_PHOTO_RADIUS * sx))
    return box, name_xy, max_w, radius


def _cover_crop(im: Image.Image, tw: int, th: int) -> Image.Image:
    src = im.convert("RGB")
    sw, sh = src.size
    if sw < 1 or sh < 1 or tw < 1 or th < 1:
        raise ValueError("empty image")
    scale = max(tw / sw, th / sh)
    nw = max(1, round(sw * scale))
    nh = max(1, round(sh * scale))
    src = src.resize((nw, nh), Image.Resampling.LANCZOS)
    left = max(0, (nw - tw) // 2)
    top = max(0, (nh - th) // 2)
    return src.crop((left, top, left + tw, top + th))


def _rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    w, h = size
    rad = max(1, min(radius, w // 2, h // 2))
    draw.rounded_rectangle((0, 0, w - 1, h - 1), radius=rad, fill=255)
    return mask


def _region_rgb(im: Image.Image, box: tuple[int, int, int, int]) -> tuple[int, int, int]:
    x0, y0, x1, y1 = box
    x0 = max(0, min(im.width - 1, x0))
    y0 = max(0, min(im.height - 1, y0))
    x1 = max(x0 + 1, min(im.width, x1))
    y1 = max(y0 + 1, min(im.height, y1))
    sample = im.crop((x0, y0, x1, y1)).resize((1, 1), Image.Resampling.BOX)
    pix = sample.getpixel((0, 0))
    if isinstance(pix, int):
        return (pix, pix, pix)
    return (int(pix[0]), int(pix[1]), int(pix[2]))


def name_fill_for(im: Image.Image, name_xy: tuple[int, int]) -> tuple[int, int, int]:
    """Тёмный текст на светлых макетах, светлый/золотой — на тёмных."""
    nx, ny = name_xy
    r, g, b = _region_rgb(im, (nx, ny - 20, nx + 520, ny + 90))
    mean = (r + g + b) / 3
    if mean >= 150:
        return _NAME_DARK
    if r >= g + 6 and r >= 28:
        return _NAME_GOLD
    return _NAME_LIGHT


def _load_font(size: int) -> ImageFont.FreeTypeFont:
    if _FONT_BOLD.exists():
        return ImageFont.truetype(str(_FONT_BOLD), size)
    return ImageFont.load_default()


def _name_lines(
    draw: ImageDraw.ImageDraw,
    name: str,
    max_width: int,
    max_size: int,
) -> tuple[list[str], ImageFont.FreeTypeFont]:
    words = name.split()
    for size in range(max_size, 22, -1):
        font = _load_font(size)
        if draw.textlength(name, font=font) <= max_width:
            return [name], font
        if len(words) >= 2:
            # Две строки: всё кроме последнего слова / фамилия.
            left = " ".join(words[:-1])
            right = words[-1]
            if (
                draw.textlength(left, font=font) <= max_width
                and draw.textlength(right, font=font) <= max_width
            ):
                return [left, right], font
    font = _load_font(22)
    if draw.textlength(name, font=font) <= max_width or len(words) < 2:
        return [name], font
    return [" ".join(words[:-1]), words[-1]], font


def _draw_name(
    im: Image.Image,
    name: str,
    origin: tuple[int, int],
    max_width: int,
) -> None:
    draw = ImageDraw.Draw(im)
    fill = name_fill_for(im, origin)
    max_size = 52 if im.width >= 1800 else 36
    lines, font = _name_lines(draw, name, max_width, max_size)
    x, y = origin
    ascent, descent = font.getmetrics()
    line_h = ascent + descent + 8
    for i, line in enumerate(lines):
        draw.text((x, y + i * line_h), line, font=font, fill=fill, anchor="ls")


def _open_photo(photo: Image.Image | bytes | Path) -> Image.Image:
    if isinstance(photo, Image.Image):
        return photo
    if isinstance(photo, (bytes, bytearray)):
        return Image.open(io.BytesIO(photo))
    return Image.open(photo)


def build_card_image(
    *,
    orient: str,
    rank_id: str,
    photo: Image.Image | bytes | Path,
    name: str,
) -> Image.Image:
    full_name = normalize_name(name)
    if not full_name:
        raise ValueError("bad name")
    path = template_path(orient, rank_id)
    if not path.exists():
        raise FileNotFoundError(f"Нет макета квалификации: {path}")
    base = Image.open(path).convert("RGB")
    box, name_xy, max_w, radius = _layout(base.size)
    x0, y0, x1, y1 = box
    tw, th = x1 - x0, y1 - y0
    fitted = _cover_crop(_open_photo(photo), tw, th)
    mask = _rounded_mask((tw, th), radius)
    base.paste(fitted, (x0, y0), mask)
    _draw_name(base, full_name, name_xy, max_w)
    return base


def build_card_jpeg(
    *,
    orient: str,
    rank_id: str,
    photo: Image.Image | bytes | Path,
    name: str,
    quality: int = 90,
) -> bytes:
    im = build_card_image(orient=orient, rank_id=rank_id, photo=photo, name=name)
    buf = io.BytesIO()
    im.save(buf, format="JPEG", quality=quality, optimize=True)
    return buf.getvalue()
