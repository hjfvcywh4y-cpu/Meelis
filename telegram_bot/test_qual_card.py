#!/usr/bin/env python3
"""Qualification card compositor and menu wiring."""

from __future__ import annotations

import io
import unittest
from types import SimpleNamespace

from PIL import Image

import menus
import qual_card


def _dummy_photo(w: int = 400, h: int = 600) -> Image.Image:
    im = Image.new("RGB", (w, h), (30, 90, 110))
    return im


class QualCardTests(unittest.TestCase):
    def test_twelve_ranks_in_career_order(self) -> None:
        ids = [rank.id for rank in qual_card.RANKS]
        self.assertEqual(
            ids,
            [
                "active",
                "m1",
                "m2",
                "m3",
                "rm",
                "d1",
                "d2",
                "d3",
                "rd",
                "nd",
                "id",
                "ambassador",
            ],
        )
        self.assertEqual(len(qual_card.RANKS_BY_LABEL), 12)
        self.assertEqual(qual_card.RANKS_BY_LABEL["NATIONAL DIRECTOR"].id, "nd")

    def test_templates_exist_for_both_orientations(self) -> None:
        missing = []
        for orient in qual_card.ORIENT_IDS:
            for rank in qual_card.RANKS:
                path = qual_card.template_path(orient, rank.id)
                if not path.exists():
                    missing.append(str(path))
        self.assertEqual(missing, [])

    def test_horizontal_composite_size_and_name_color(self) -> None:
        photo = _dummy_photo()
        active = qual_card.build_card_image(
            orient="h", rank_id="active", photo=photo, name="Елена Тураева"
        )
        self.assertEqual(active.size, (2115, 1259))
        nd = qual_card.build_card_image(
            orient="h", rank_id="nd", photo=photo, name="Елена Тураева"
        )
        box, name_xy, _max_w, _r = qual_card._layout(active.size)
        self.assertGreater(name_xy[0], 300)
        self.assertGreater(name_xy[1], 740)
        self.assertLess(box[2] - box[0], 780)
        self.assertEqual(qual_card.name_fill_for(active, name_xy), qual_card._NAME_DARK)
        self.assertEqual(qual_card.name_fill_for(nd, name_xy), qual_card._NAME_GOLD)
        d1 = Image.open(qual_card.template_path("h", "d1")).convert("RGB")
        try:
            self.assertEqual(qual_card.name_fill_for(d1, name_xy), qual_card._NAME_LIGHT)
        finally:
            d1.close()

    def test_vertical_layout_shifts_photo_to_middle_band(self) -> None:
        path = qual_card.template_path("v", "active")
        with Image.open(path) as raw:
            im_size = raw.size
        box, name_xy, _max_w, radius = qual_card._layout(im_size)
        self.assertGreater(box[1], 1200)
        self.assertLess(box[3], im_size[1] - 1100)
        self.assertGreater(name_xy[1], 1600)
        self.assertGreaterEqual(radius, 100)
        jpeg = qual_card.build_card_jpeg(
            orient="v",
            rank_id="active",
            photo=_dummy_photo(),
            name="Анна Соколова",
        )
        with Image.open(io.BytesIO(jpeg)) as out:
            self.assertEqual(out.size, im_size)
            self.assertEqual(out.format, "JPEG")
        png = qual_card.build_card_png(
            orient="v",
            rank_id="active",
            photo=_dummy_photo(),
            name="Анна Соколова",
        )
        with Image.open(io.BytesIO(png)) as out:
            self.assertEqual(out.size, im_size)
            self.assertEqual(out.format, "PNG")
        self.assertLess(len(png), qual_card.PHOTO_MAX_BYTES)

    def test_normalize_name(self) -> None:
        self.assertEqual(qual_card.normalize_name("  Елена   Тураева "), "Елена Тураева")
        self.assertIsNone(qual_card.normalize_name("А"))
        self.assertIsNone(qual_card.normalize_name(""))

    def test_is_image_bytes(self) -> None:
        buf = io.BytesIO()
        _dummy_photo(32, 32).save(buf, format="JPEG")
        self.assertTrue(qual_card.is_image_bytes(buf.getvalue()))
        self.assertFalse(qual_card.is_image_bytes(b"not-an-image"))

    def test_photo_clipped_to_inner_frame(self) -> None:
        red = Image.new("RGB", (400, 600), (255, 0, 0))
        card = qual_card.build_card_image(
            orient="h", rank_id="d3", photo=red, name="Анна Соколова"
        )
        box, name_xy, _max_w, _r = qual_card._layout(card.size)
        inside = card.getpixel(((box[0] + box[2]) // 2, (box[1] + box[3]) // 2))
        self.assertGreater(inside[0], 200)
        # Слева от отверстия — металл макета, не фото.
        outside = card.getpixel((max(8, box[0] - 48), (box[1] + box[3]) // 2))
        self.assertLess(outside[0], 180)
        self.assertEqual(name_xy[1], 800)
        self.assertEqual(box, (1300, 280, 2030, 1124))
        self.assertGreater(name_xy[0], 300)
        self.assertGreater(qual_card._NAME_SIZE, 70)

    def test_menus_wire_qualification(self) -> None:
        self.assertIn(menus.BTN_QUAL, menus.MENU_LABELS)
        self.assertIn("NATIONAL DIRECTOR", menus.MENU_LABELS)
        self.assertIn("ACTIVE", menus.MENU_LABELS)
        self.assertEqual(menus.PARENT["qual_orient"], "business_tools")
        self.assertEqual(menus.PARENT["qual_rank"], "qual_orient")
        self.assertEqual(menus.PARENT["qual"], "qual_rank")
        self.assertEqual(menus.QUAL_ORIENT_BUTTONS[menus.BTN_QUAL_H], "h")
        self.assertEqual(menus.QUAL_RANK_BUTTONS["AMBASSADOR"], "ambassador")
        tools = [btn.text for row in menus.business_tools_keyboard().keyboard for btn in row]
        self.assertIn(menus.BTN_QUAL, tools)
        self.assertIn(menus.BTN_VISITKA, tools)
        ranks = [btn.text for row in menus.qual_rank_keyboard().keyboard for btn in row]
        self.assertEqual(len(ranks), 13)  # 12 ranks + back
        self.assertEqual(ranks[-1], menus.BTN_BACK)
        user = SimpleNamespace(first_name="Анна", last_name="Соколова", username="x")
        markup = menus.qual_step_keyboard("name", user=user)
        self.assertEqual(markup.keyboard[0][0].text, menus.BTN_VISITKA_USE_NAME)
        photo_kb = menus.qual_step_keyboard("photo", user=user)
        photo_labels = [btn.text for row in photo_kb.keyboard for btn in row]
        self.assertNotIn(menus.BTN_QUAL_DOWNLOAD, photo_labels)
        self.assertIn("Анна Соколова", menus.QUAL_ASK_NAME)
        self.assertNotIn("Елена Тураева", menus.QUAL_ASK_NAME)
        self.assertIn("файлом", menus.QUAL_ASK_PHOTO)
        self.assertIn("карточку", menus.QUAL_READY)
        done = [btn.text for row in menus.business_tools_keyboard(can_download=True).keyboard for btn in row]
        self.assertEqual(done[0], menus.BTN_QUAL_DOWNLOAD)
        plain = [btn.text for row in menus.business_tools_keyboard().keyboard for btn in row]
        self.assertNotIn(menus.BTN_QUAL_DOWNLOAD, plain)
        dl = menus.qual_download_keyboard()
        self.assertEqual(dl.inline_keyboard[0][0].text, menus.BTN_QUAL_DOWNLOAD)
        self.assertEqual(dl.inline_keyboard[0][0].callback_data, menus.QUAL_DOWNLOAD_CB)
        self.assertEqual(menus.BTN_QUAL_DOWNLOAD, "⬇️ Скачать")

    def test_png_matches_composite_pixels(self) -> None:
        photo = _dummy_photo()
        card = qual_card.build_card_image(
            orient="h", rank_id="active", photo=photo, name="Анна Соколова"
        )
        png = qual_card.build_card_png(
            orient="h", rank_id="active", photo=photo, name="Анна Соколова"
        )
        with Image.open(io.BytesIO(png)) as out:
            self.assertEqual(out.format, "PNG")
            self.assertEqual(out.size, card.size)
            self.assertEqual(out.convert("RGB").tobytes(), card.convert("RGB").tobytes())
        jpeg = qual_card.build_card_jpeg(
            orient="h", rank_id="active", photo=photo, name="Анна Соколова"
        )
        with Image.open(io.BytesIO(jpeg)) as lossy:
            self.assertNotEqual(
                lossy.convert("RGB").tobytes(), card.convert("RGB").tobytes()
            )
        png2, jpeg2 = qual_card.build_card_files(
            orient="h", rank_id="active", photo=photo, name="Анна Соколова"
        )
        with Image.open(io.BytesIO(png2)) as out:
            self.assertEqual(out.format, "PNG")
            self.assertEqual(out.convert("RGB").tobytes(), card.convert("RGB").tobytes())
        with Image.open(io.BytesIO(jpeg2)) as preview:
            self.assertEqual(preview.format, "JPEG")
            self.assertEqual(preview.size, card.size)


if __name__ == "__main__":
    unittest.main()
