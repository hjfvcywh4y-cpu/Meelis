"""Copy helpers for MLM Pulse: preview vs save, private notes, Russian day forms.

Wire into the live Pulse bot:
- REVIEW text <- review_text(draft), never _summary() with «Действие записано»
- DONE / last_save_text <- SAVE_CONFIRMATION only after persist succeeds
- ENTRY_VIEW <- entry_card(log), which appends log["note"]
- default CSV/export <- export_csv(..., include_notes=False)
- week/today/progress strings <- week_progress_text / ru_days
"""

from __future__ import annotations

import csv
import io
from typing import Any, Iterable, Sequence

SAVE_CONFIRMATION = "Сохранил."
SAVED_CONFIRMATION = SAVE_CONFIRMATION
REVIEW_QUESTION = "Всё верно?"
EMPTY_WEEK = "На этой неделе пока нет записанных действий"

OUTCOME_PREVIEW = {
    "sale": "Результат: продажа.",
    "interest": "Результат: есть интерес.",
    "refusal": "Результат: отказ.",
    "partial": "Результат: частичный контакт.",
    "no_energy": "Результат: не было сил.",
    "no_contact": "Результат: не дошёл.",
}

_EXPORT_FIELDS = ("local_date", "outcome", "human_summary", "action_type")


def ru_days(n: int) -> str:
    n = abs(int(n))
    if 11 <= (n % 100) <= 14:
        return f"{n} дней"
    rem = n % 10
    if rem == 1:
        return f"{n} день"
    if rem in (2, 3, 4):
        return f"{n} дня"
    return f"{n} дней"


def week_progress_text(days: int, *_unused: Any) -> str:
    days = int(days)
    if days <= 0:
        return EMPTY_WEEK
    marked = "отмечен" if ru_days(days).endswith("день") else "отмечено"
    return f"На этой неделе {marked} {ru_days(days)}."


def today_summary_text(today_count: int, week_days: int, *_unused: Any) -> str:
    if int(week_days) <= 0 and int(today_count) <= 0:
        return EMPTY_WEEK
    return week_progress_text(week_days)


def progress_change_if_any(before_days: int, after_days: int) -> str:
    if int(after_days) == int(before_days):
        return ""
    return week_progress_text(after_days)


def _public_body(body: dict[str, Any] | None) -> dict[str, Any]:
    data = dict(body or {})
    data.pop("private_note", None)
    data["note"] = ""
    return data


def preview_summary(body: dict[str, Any] | None) -> str:
    """REVIEW preview. Must not claim the entry is already saved."""
    body = body or {}
    parts: list[str] = []
    if body.get("day_kind") == "rest":
        parts.append("День отдыха.")
    if body.get("outcome") in OUTCOME_PREVIEW:
        parts.append(OUTCOME_PREVIEW[body["outcome"]])
    elif body.get("channel") or body.get("action_type"):
        parts.append("Действие готово к записи.")
    text = " ".join(parts).strip()
    if not text:
        return "Пока нечего сохранять."
    lowered = text.lower()
    if "записано" in lowered or "сохранил" in lowered:
        raise ValueError("preview must not claim the entry is already saved")
    return text


def review_text(body: dict[str, Any] | None) -> str:
    preview = preview_summary(body)
    if preview == "Пока нечего сохранять.":
        return f"{preview}\nВсе верно?"
    return f"{preview}\n{REVIEW_QUESTION}"


def persist_entry(
    body: dict[str, Any] | None,
    store: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Save after explicit confirm. Private note is stored on the log, not in human_summary."""
    body = dict(body or {})
    note = str(body.get("private_note") or body.get("note") or "").strip()
    log = {
        "outcome": body.get("outcome"),
        "attempt_status": "completed",
        "note": note,
        "human_summary": preview_summary(_public_body(body)),
        "action_type": body.get("action_type") or body.get("channel") or "",
        "local_date": body.get("local_date") or "",
        "next_step": body.get("next_step") or "",
        "decision_version": 3,
    }
    if store is not None:
        store.append(log)
    return log


def commit_entry(
    body: dict[str, Any] | None,
    store: list[dict[str, Any]] | None = None,
) -> tuple[str, dict[str, Any]]:
    log = persist_entry(body, store=store)
    return SAVE_CONFIRMATION, log


def entry_card(log: dict[str, Any] | None) -> str:
    """Personal diary card: public summary plus private note when present."""
    log = log or {}
    summary = str(log.get("human_summary") or "").strip()
    note = str(log.get("note") or "").strip()
    if note:
        if summary:
            return f"{summary}\nЗаметка: {note}"
        return f"Заметка: {note}"
    return summary


def export_csv(
    logs: Iterable[dict[str, Any]] | None,
    include_notes: bool = False,
) -> str:
    """Default export omits personal notes. Pass include_notes=True only for a private dump."""
    fields: Sequence[str] = _EXPORT_FIELDS + (("note",) if include_notes else ())
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=list(fields), extrasaction="ignore")
    writer.writeheader()
    for log in logs or []:
        row = {key: log.get(key, "") for key in fields}
        writer.writerow(row)
    return buf.getvalue()
