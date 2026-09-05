import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(__file__))
sys.path.insert(0, ROOT)

import phrases as pulse_copy


class PreviewTests(unittest.TestCase):
    def test_interest_preview_before_save(self):
        body = {"attempt_status": "completed", "outcome": "interest", "next_step": "none"}
        text = pulse_copy.review_text(body)
        self.assertEqual(text, "Результат: есть интерес.\nВсё верно?")
        self.assertNotIn("Действие записано", text)
        self.assertNotIn("Сохранил", text)
        self.assertNotIn("записано", text.lower())

    def test_interest_with_note_still_preview_only(self):
        body = {
            "attempt_status": "completed",
            "outcome": "interest",
            "next_step": "none",
            "private_note": "Перезвонить утром, без имени",
        }
        text = pulse_copy.review_text(body)
        self.assertEqual(text, "Результат: есть интерес.\nВсё верно?")
        self.assertNotIn("Действие записано", text)
        self.assertNotIn("Сохранил", text)

    def test_save_confirmation_only_after_persist(self):
        body = {"attempt_status": "completed", "outcome": "interest"}
        self.assertNotIn("Сохранил", pulse_copy.preview_summary(body))
        self.assertNotIn("Сохранил", pulse_copy.review_text(body))
        confirm, log = pulse_copy.commit_entry(body)
        self.assertEqual(confirm, "Сохранил.")
        self.assertEqual(pulse_copy.SAVED_CONFIRMATION, "Сохранил.")
        self.assertEqual(log["outcome"], "interest")


class NoteCardTests(unittest.TestCase):
    def test_note_is_saved_and_shown_on_card(self):
        body = {
            "attempt_status": "completed",
            "outcome": "interest",
            "next_step": "none",
            "private_note": "Перезвонить утром, без имени",
        }
        store: list = []
        log = pulse_copy.persist_entry(body, store=store)
        self.assertEqual(len(store), 1)
        self.assertIs(store[0], log)
        self.assertEqual(log["note"], "Перезвонить утром, без имени")
        self.assertEqual(log["outcome"], "interest")
        self.assertNotIn("Перезвонить утром, без имени", log["human_summary"])
        card = pulse_copy.entry_card(log)
        self.assertIn("есть интерес", card)
        self.assertIn("Заметка: Перезвонить утром, без имени", card)

    def test_opening_saved_entry_shows_note(self):
        log = pulse_copy.persist_entry(
            {
                "attempt_status": "completed",
                "outcome": "interest",
                "private_note": "Перезвонить утром, без имени",
            }
        )
        opened = pulse_copy.entry_card(log)
        self.assertIn("Заметка: Перезвонить утром, без имени", opened)

    def test_export_without_notes_omits_private_text(self):
        log = pulse_copy.persist_entry(
            {
                "attempt_status": "completed",
                "outcome": "interest",
                "private_note": "секретная заметка",
                "local_date": "2026-09-05",
                "action_type": "new_conversation",
            }
        )
        plain = pulse_copy.export_csv([log], include_notes=False)
        self.assertNotIn("секретная заметка", plain)
        self.assertNotIn("note", plain.split("\n")[0])
        with_notes = pulse_copy.export_csv([log], include_notes=True)
        self.assertIn("секретная заметка", with_notes)
        self.assertIn("note", with_notes.split("\n")[0])


class InterestNoteSaveOpenFlowTests(unittest.TestCase):
    def test_interest_note_save_then_open_record(self):
        body = {
            "attempt_status": "completed",
            "outcome": "interest",
            "next_step": "none",
            "action_type": "new_conversation",
            "private_note": "Перезвонить утром, без имени",
            "local_date": "2026-09-05",
        }
        preview = pulse_copy.review_text(body)
        self.assertEqual(preview, "Результат: есть интерес.\nВсё верно?")
        self.assertNotIn("записано", preview.lower())

        confirm, log = pulse_copy.commit_entry(body)
        self.assertEqual(confirm, "Сохранил.")
        self.assertEqual(log["note"], "Перезвонить утром, без имени")

        card = pulse_copy.entry_card(log)
        self.assertIn("Результат: есть интерес.", card)
        self.assertIn("Заметка: Перезвонить утром, без имени", card)

        export = pulse_copy.export_csv([log], include_notes=False)
        self.assertNotIn("Перезвонить утром, без имени", export)


class DayFormsTests(unittest.TestCase):
    def test_zero_week_has_no_false_days(self):
        self.assertEqual(
            pulse_copy.week_progress_text(0, 3),
            "На этой неделе пока нет записанных действий",
        )
        self.assertEqual(
            pulse_copy.today_summary_text(0, 0, 3),
            "На этой неделе пока нет записанных действий",
        )
        self.assertNotIn("0 дн", pulse_copy.week_progress_text(0))
        self.assertNotIn("дня", pulse_copy.week_progress_text(0))

    def test_common_forms(self):
        self.assertEqual(pulse_copy.ru_days(1), "1 день")
        self.assertEqual(pulse_copy.ru_days(2), "2 дня")
        self.assertEqual(pulse_copy.ru_days(5), "5 дней")
        self.assertEqual(pulse_copy.ru_days(21), "21 день")
        self.assertEqual(pulse_copy.ru_days(11), "11 дней")
        self.assertEqual(pulse_copy.ru_days(22), "22 дня")
        self.assertEqual(pulse_copy.ru_days(25), "25 дней")

    def test_progress_sentences_use_forms(self):
        self.assertIn("1 день", pulse_copy.week_progress_text(1, 3))
        self.assertIn("отмечен 1 день", pulse_copy.week_progress_text(1, 3))
        self.assertIn("2 дня", pulse_copy.week_progress_text(2, 3))
        self.assertIn("5 дней", pulse_copy.week_progress_text(5, 3))
        self.assertIn("21 день", pulse_copy.week_progress_text(21, 3))
        self.assertNotIn("1 дня", pulse_copy.week_progress_text(1, 3))
        self.assertNotIn("2 день", pulse_copy.week_progress_text(2, 3))
        self.assertNotIn("21 дня", pulse_copy.week_progress_text(21, 3))


if __name__ == "__main__":
    unittest.main()
