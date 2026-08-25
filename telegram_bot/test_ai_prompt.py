#!/usr/bin/env python3
"""IDera-only AI policy checks."""

from __future__ import annotations

import unittest

import ai_prompt
import menus


class AiPromptTests(unittest.TestCase):
    def test_policy_names_idera_line(self) -> None:
        text = ai_prompt.IDERA_POLICY
        for name in (
            "IDera Detox",
            "IDera Relax",
            "IDera Glow",
            "IDera Focus",
            "IDera GO",
            "shop.idera.io",
            "квалификации",
        ):
            self.assertIn(name, text)
        self.assertIn("не рекомендуй", text.lower())
        self.assertIn("без **звёздочек**", text)
        self.assertIn("🔵", text)
        self.assertIn("🌟", text)

    def test_extra_does_not_replace_policy(self) -> None:
        prompt = ai_prompt.build_system_prompt("Отвечай ещё короче.")
        self.assertTrue(prompt.startswith(ai_prompt.IDERA_POLICY))
        self.assertIn("Отвечай ещё короче.", prompt)

    def test_strip_markdown_removes_stars(self) -> None:
        raw = "**IDera Glow** поможет коже.\n* список\nЕщё *акцент*."
        cleaned = ai_prompt.strip_markdown(raw)
        self.assertNotIn("**", cleaned)
        self.assertIn("IDera Glow поможет коже.", cleaned)
        self.assertIn("• список", cleaned)
        self.assertIn("Ещё акцент.", cleaned)

    def test_polish_maps_star_and_coffee(self) -> None:
        out = ai_prompt.polish_ai_reply("Возьми паузу ☕ и смотри ⭐ IDera")
        self.assertIn("☕️", out)
        self.assertIn("🌟", out)
        self.assertNotIn("⭐", out)

    def test_entities_cover_pack_symbols(self) -> None:
        text = "🔵 старт 🚀 и ✅ готово 🔵"
        entities = menus.idera_entities_from_text(text)
        self.assertEqual(len(entities), 4)
        self.assertEqual(entities[0].custom_emoji_id, menus.IDERA_EMOJI["blue"][0])
        self.assertEqual(entities[1].custom_emoji_id, menus.IDERA_EMOJI["rocket"][0])
        self.assertEqual(entities[2].custom_emoji_id, menus.IDERA_EMOJI["check"][0])
        self.assertEqual(entities[3].custom_emoji_id, menus.IDERA_EMOJI["blue"][0])
        named = menus.idera_entities(text, "blue", "rocket", "check", "blue")
        self.assertEqual(
            [(e.offset, e.length, e.custom_emoji_id) for e in entities],
            [(e.offset, e.length, e.custom_emoji_id) for e in named],
        )

    def test_html_replaces_without_double_wrap(self) -> None:
        html = menus.idera_html_from_text("Смотри 🔵 и 🚀")
        self.assertIn('emoji-id="5188255858605205817"', html)
        self.assertIn('emoji-id="5467765621489968794"', html)
        self.assertEqual(html.count("<tg-emoji"), 2)


if __name__ == "__main__":
    unittest.main()
