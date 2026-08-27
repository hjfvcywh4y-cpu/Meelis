#!/usr/bin/env python3
"""Tests for the complaints/suggestions guestbook."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import menus
import stats


class FeedbackStatsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "stats.json"
        stats._path = self.path

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_record_feedback_roundtrip(self) -> None:
        entry = stats.record_feedback(
            42,
            text="  Сделайте раздел с доставкой.  ",
            username="anna",
            first_name="Анна",
        )
        self.assertEqual(entry["user_id"], 42)
        self.assertEqual(entry["username"], "anna")
        self.assertEqual(entry["text"], "Сделайте раздел с доставкой.")
        snap = stats.snapshot()
        self.assertEqual(snap["feedback_count"], 1)
        self.assertEqual(snap["feedback"][0]["text"], "Сделайте раздел с доставкой.")

    def test_feedback_keeps_latest_only(self) -> None:
        with patch.object(stats, "_MAX_FEEDBACK", 2):
            stats.record_feedback(1, text="первая")
            stats.record_feedback(2, text="вторая")
            stats.record_feedback(3, text="третья")
        texts = [row["text"] for row in stats.snapshot()["feedback"]]
        self.assertEqual(texts, ["третья", "вторая"])

    def test_menu_labels_include_navigation(self) -> None:
        self.assertIn(menus.BTN_BUSINESS, menus.MENU_LABELS)
        self.assertIn(menus.BTN_BACK, menus.MENU_LABELS)
        self.assertIn(menus.BTN_FEEDBACK_CANCEL, menus.MENU_LABELS)
        self.assertEqual(menus.PARENT["feedback"], "main")
        self.assertEqual(
            menus.UPCOMING_EVENTS[0]["url"],
            "https://t.me/ideraofficial/127",
        )
        self.assertIn(
            menus.upcoming_button_label(menus.UPCOMING_EVENTS[0]),
            menus.MENU_LABELS,
        )
        self.assertIn(menus.BTN_VIDEO_LESSONS, menus.MENU_LABELS)
        self.assertEqual(menus.PARENT["video_lessons"], "partners")
        self.assertEqual(menus.PARENT["video_lesson_item"], "video_lessons")
        self.assertEqual(
            menus.VIDEO_LESSONS[0]["url"],
            "https://t.me/ideraofficial/143",
        )
        self.assertIn(
            menus.video_lesson_button_label(menus.VIDEO_LESSONS[0]),
            menus.MENU_LABELS,
        )
        partner_btns = [
            btn.text
            for row in menus.partners_keyboard().keyboard
            for btn in row
        ]
        self.assertIn(menus.BTN_VIDEO_LESSONS, partner_btns)

    def test_service_chat_roundtrip(self) -> None:
        self.assertIsNone(stats.get_service_chat_id())
        stats.set_service_chat(
            -100123456,
            title="IDera — обращения",
            chat_type="channel",
        )
        row = stats.get_service_chat()
        self.assertIsNotNone(row)
        self.assertEqual(row["id"], -100123456)
        self.assertEqual(row["title"], "IDera — обращения")
        self.assertEqual(stats.snapshot()["service_chat"]["id"], -100123456)
        stats.clear_service_chat()
        self.assertIsNone(stats.get_service_chat_id())
        self.assertIsNone(stats.snapshot()["service_chat"])


if __name__ == "__main__":
    unittest.main()
