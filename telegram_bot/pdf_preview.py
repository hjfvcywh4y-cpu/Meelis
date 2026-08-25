"""Промо-картинка с первой страницы PDF-презентации."""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path

import pymupdf

logger = logging.getLogger(__name__)

_JPEG_QUALITY = 82
_MAX_SIDE = 1920


def cover_jpeg(path: Path | str, *, page: int = 0) -> bytes:
    """JPEG обложки (первая страница). Кэш по пути и mtime файла."""
    pdf = Path(path)
    st = pdf.stat()
    return _cover_cached(str(pdf.resolve()), st.st_mtime_ns, st.st_size, page)


@lru_cache(maxsize=12)
def _cover_cached(resolved: str, mtime_ns: int, size: int, page: int) -> bytes:
    return _render(Path(resolved), page=page)


def _render(path: Path, *, page: int) -> bytes:
    doc = pymupdf.open(path)
    try:
        if page < 0 or page >= doc.page_count:
            raise ValueError(f"no page {page} in {path.name}")
        pg = doc[page]
        rect = pg.rect
        long = max(rect.width, rect.height) or 1
        scale = min(2.0, _MAX_SIDE / long)
        pix = pg.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False)
        return pix.tobytes(output="jpeg", jpg_quality=_JPEG_QUALITY)
    finally:
        doc.close()


def warm(docs_dir: Path, filenames: list[str]) -> None:
    """Прогреть кэш обложек, чтобы первая кнопка не ждала рендер."""
    for name in filenames:
        path = docs_dir / name
        if not path.exists():
            continue
        try:
            cover_jpeg(path)
            logger.info("PDF cover cached: %s", name)
        except Exception:
            logger.exception("Не удалось собрать обложку %s", name)
