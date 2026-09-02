#!/usr/bin/env python3
"""AI is off unless AI_ENABLED is explicitly set."""

from __future__ import annotations

import os
import unittest
from unittest.mock import patch

import bot


class AiOffTests(unittest.TestCase):
    def test_disabled_by_default_even_with_keys(self) -> None:
        with patch.dict(
            os.environ,
            {
                "AI_ENABLED": "",
                "GEMINI_API_KEY": "fake-gemini-key",
                "GROQ_API_KEY": "fake-groq-key",
            },
        ):
            self.assertFalse(bot.ai_enabled())
            self.assertEqual(bot.provider_chains(), [])

    def test_enabled_flag_is_opt_in(self) -> None:
        with patch.dict(os.environ, {"AI_ENABLED": "1"}):
            self.assertTrue(bot.ai_enabled())
        with patch.dict(os.environ, {"AI_ENABLED": "true"}):
            self.assertTrue(bot.ai_enabled())
        with patch.dict(os.environ, {"AI_ENABLED": "0"}):
            self.assertFalse(bot.ai_enabled())


if __name__ == "__main__":
    unittest.main()
