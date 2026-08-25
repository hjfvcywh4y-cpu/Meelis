#!/usr/bin/env python3
"""IDera-only AI policy checks."""

from __future__ import annotations

import unittest

import ai_prompt


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

    def test_extra_does_not_replace_policy(self) -> None:
        prompt = ai_prompt.build_system_prompt("Отвечай ещё короче.")
        self.assertTrue(prompt.startswith(ai_prompt.IDERA_POLICY))
        self.assertIn("Отвечай ещё короче.", prompt)


if __name__ == "__main__":
    unittest.main()
