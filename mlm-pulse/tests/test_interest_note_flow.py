import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(__file__))
sys.path.insert(0, ROOT)

import flow
import operations
import phrases
import storage


def onboarded_user():
    return {
        "id": "user-1",
        "name": "Анна",
        "consent_at": "2026-01-01T00:00:00+00:00",
        "timezone": "Europe/Moscow",
        "onboarding_completed_at": "2026-01-01T00:00:00+00:00",
        "weekly_target": 3,
        "plan": "free",
        "plan_status": "active",
        "pilot_group": "C",
        "reminder_mode": "evening",
    }


class InterestNoteEngineTests(unittest.TestCase):
    def setUp(self):
        self.data = storage.new_data()
        self.user = onboarded_user()
        self.data["users"].append(self.user)
        flow.session(self.user)
        self.user["flow"]["history"] = ["REVIEW"]
        self.user["flow"]["state"] = "NOTE"
        self.user["flow"]["draft"] = {
            "attempt_status": "completed",
            "action_type": "first_contact",
            "outcome": "interest",
            "next_step": "none",
            "local_date": storage.today(),
        }

    def tap(self, markup, label):
        for row in markup.get("inline_keyboard") or []:
            for item in row:
                if item.get("text") == label:
                    return flow.handle_callback(self.data, self.user, item["callback_data"])
        self.fail("button not found: " + label + " in " + str(markup))

    def test_preview_then_save_then_open_card(self):
        text, markup = flow.render(self.data, self.user)
        self.assertIn("заметк", text.lower())
        result = flow.handle_input(self.data, self.user, "Перезвонить утром, без имени")
        self.assertIsNotNone(result)
        text, markup = result
        self.assertEqual(self.user["flow"]["state"], "REVIEW")
        self.assertIn("Результат: есть интерес.", text)
        self.assertIn("Всё верно?", text)
        self.assertNotIn("Действие записано", text)
        self.assertNotIn("Сохранил", text)
        self.assertNotIn("записано", text.lower())

        text, markup = self.tap(markup, "Сохранить")
        self.assertEqual(self.user["flow"]["state"], "DONE")
        self.assertTrue(text.startswith("Сохранил."))
        self.assertIn("1 день", text)
        self.assertNotIn("1 дня", text)

        logs = operations.logs_for(self.data, self.user)
        self.assertEqual(len(logs), 1)
        log = logs[0]
        self.assertEqual(log["note"], "Перезвонить утром, без имени")
        self.assertEqual(log["outcome"], "interest")
        self.assertNotIn("Перезвонить утром, без имени", log.get("human_summary") or "")
        self.assertNotIn("Действие записано", log.get("human_summary") or "")

        self.user["flow"]["state"] = "DAY"
        self.user["flow"]["draft"]["selected_date"] = storage.today()
        text, markup = flow.render(self.data, self.user)
        label = (log.get("human_summary") or "Запись")[:48]
        text, markup = self.tap(markup, label)
        self.assertEqual(self.user["flow"]["state"], "ENTRY_VIEW")
        self.assertIn("Результат: есть интерес.", text)
        self.assertIn("Заметка: Перезвонить утром, без имени", text)

        self.user["flow"]["draft"]["include_private_notes"] = False
        self.user["flow"]["draft"]["export_period"] = "week"
        self.assertTrue(operations.export_owned_records(self.data, self.user))
        export = self.user["flow"]["draft"]["export_text"]
        self.assertNotIn("Перезвонить утром, без имени", export)
        self.assertNotIn("note", export.split("\n")[0])


class LiveCopyTests(unittest.TestCase):
    def test_summary_preview_does_not_claim_save(self):
        text = operations._summary({"attempt_status": "completed", "outcome": "interest"})
        self.assertEqual(text, "Результат: есть интерес.")
        self.assertNotIn("Действие записано", text)
        self.assertNotIn("Сохранил", text)

    def test_other_outcome_preview_keeps_existing_line(self):
        text = operations._summary({"attempt_status": "completed", "outcome": "refusal"})
        self.assertEqual(text, "Отказ записан.")
        self.assertNotIn("Действие записано", text)

    def test_zero_and_forms_in_progress_strings(self):
        self.assertEqual(flow._today_summary([], 0, 3), phrases.EMPTY_WEEK)
        self.assertEqual(
            flow._week_text(storage.new_data(), onboarded_user(), "2026-08-31", "2026-09-06", 0, 3),
            phrases.EMPTY_WEEK,
        )
        self.assertIn("1 день", phrases.week_progress_text(1, 3))
        self.assertIn("2 дня", phrases.week_progress_text(2, 3))
        self.assertIn("5 дней", phrases.week_progress_text(5, 3))
        self.assertIn("21 день", phrases.week_progress_text(21, 3))
        self.assertNotIn("1 дня", phrases.week_progress_text(1, 3))
        self.assertNotIn("21 дня", phrases.week_progress_text(21, 3))
        self.assertIn(
            "2 дня",
            flow._week_text(storage.new_data(), onboarded_user(), "2026-08-31", "2026-09-06", 2, 3),
        )
        self.assertIn(
            "21 день",
            flow._week_text(storage.new_data(), onboarded_user(), "2026-08-31", "2026-09-06", 21, 3),
        )
