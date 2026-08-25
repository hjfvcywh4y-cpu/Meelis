#!/usr/bin/env python3
"""First-page promo covers for product presentation PDFs."""

from __future__ import annotations

import io
import unittest
from pathlib import Path

from PIL import Image

import menus
import pdf_preview

DOCS = Path(__file__).resolve().parent / "docs"


class PdfPreviewTests(unittest.TestCase):
    def test_four_product_buttons_have_pdfs(self) -> None:
        self.assertEqual(len(menus.PRODUCT_PRESENTATION_BUTTONS), 4)
        for button in (
            menus.BTN_DETOX,
            menus.BTN_RELAX,
            menus.BTN_GLOW,
            menus.BTN_FOCUS,
        ):
            self.assertIn(button, menus.PRODUCT_PRESENTATION_BUTTONS)
            name = menus.DOC_FILES[button]
            self.assertTrue((DOCS / name).exists(), name)

    def test_cover_is_portrait_jpeg_from_first_page(self) -> None:
        path = DOCS / menus.DOC_FILES[menus.BTN_DETOX]
        data = pdf_preview.cover_jpeg(path)
        self.assertTrue(data.startswith(b"\xff\xd8\xff"))
        self.assertLess(len(data), 1_200_000)
        with Image.open(io.BytesIO(data)) as im:
            self.assertEqual(im.format, "JPEG")
            self.assertGreater(im.height, im.width)
            self.assertGreaterEqual(im.width, 1000)
            self.assertGreaterEqual(im.height, 1700)

    def test_cover_cache_returns_same_bytes(self) -> None:
        path = DOCS / menus.DOC_FILES[menus.BTN_GLOW]
        a = pdf_preview.cover_jpeg(path)
        b = pdf_preview.cover_jpeg(path)
        self.assertIs(a, b)


if __name__ == "__main__":
    unittest.main()
