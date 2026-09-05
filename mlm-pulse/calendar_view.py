import calendar as cal
import datetime as dt


def marks_for_date(data, user_id, date):
    logs = [item for item in data.get("daily_logs", []) if item.get("user_id") == user_id and item.get("local_date") == date and not item.get("deleted_at")]
    tasks = [item for item in data.get("next_actions", []) if item.get("user_id") == user_id and item.get("status") == "active" and (item.get("due_at") or "").startswith(date)]
    has_action = any(item.get("attempt_status") == "completed" or item.get("action_done") for item in logs)
    has_rest = any(item.get("rest_mark") for item in logs)
    has_task = bool(tasks)
    if has_action:
        return "✓"
    if has_task:
        return "!"
    if has_rest:
        return "~"
    return "·"


def month_grid(year, month, today_iso, data, user_id, revision):
    today = dt.date.fromisoformat(today_iso)
    weeks = cal.Calendar(firstweekday=0).monthdayscalendar(year, month)
    rows = [[{"text": item, "callback_data": f"d:{revision}:hdr"} for item in ("Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс")]]
    for week in weeks:
        row = []
        for day in week:
            if day == 0:
                row.append({"text": " ", "callback_data": f"d:{revision}:noop"})
                continue
            date = dt.date(year, month, day).isoformat()
            mark = marks_for_date(data, user_id, date)
            label = f"{day} {mark}"
            if date == today_iso:
                label = f"({day} {mark})"
            row.append({"text": label[:16], "callback_data": f"d:{revision}:{date}"})
        rows.append(row)
    rows.append(
        [
            {"text": "←", "callback_data": f"d:{revision}:prev"},
            {"text": "Сегодня", "callback_data": f"d:{revision}:today"},
            {"text": "→", "callback_data": f"d:{revision}:next"},
        ]
    )
    return {"inline_keyboard": rows}


def shift_month(year, month, delta):
    value = dt.date(year, month, 1) + dt.timedelta(days=32 if delta > 0 else -1)
    return value.year, value.month