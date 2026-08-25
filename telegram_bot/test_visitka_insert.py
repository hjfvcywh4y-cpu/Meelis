#!/usr/bin/env python3
"""Visitka insert-from-Telegram helpers."""

from __future__ import annotations

import unittest
from types import SimpleNamespace

import menus
import visitka


class VisitkaInsertTests(unittest.TestCase):
    def test_profile_name_and_username(self) -> None:
        user = SimpleNamespace(
            first_name="Анна",
            last_name="Соколова",
            username="anna_idera",
        )
        self.assertEqual(visitka.profile_name(user), "Анна Соколова")
        self.assertEqual(visitka.profile_username(user), "anna_idera")

    def test_phone_keyboard_requests_contact(self) -> None:
        markup = menus.visitka_step_keyboard("phone")
        btn = markup.keyboard[0][0]
        self.assertTrue(btn.request_contact)
        self.assertEqual(btn.text, menus.BTN_VISITKA_USE_PHONE)
        self.assertEqual(markup.keyboard[1][0].text, menus.BTN_BACK)

    def test_name_keyboard_shows_insert(self) -> None:
        user = SimpleNamespace(first_name="Анна", last_name="Соколова", username="x")
        markup = menus.visitka_step_keyboard("name", user=user)
        self.assertEqual(markup.keyboard[0][0].text, menus.BTN_VISITKA_USE_NAME)

    def test_telegram_keyboard_without_username(self) -> None:
        user = SimpleNamespace(first_name="Анна", last_name=None, username=None)
        markup = menus.visitka_step_keyboard("telegram", user=user)
        self.assertEqual(markup.keyboard[0][0].text, menus.BTN_BACK)


if __name__ == "__main__":
    unittest.main()
