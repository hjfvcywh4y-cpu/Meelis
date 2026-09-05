import datetime as dt
from zoneinfo import ZoneInfo

from storage import now, uid

REMINDER_HOURS = {"morning": 9, "day": 13, "evening": 18}
RETURN_KIND = "return_to_conversation"
DAILY_KIND = "daily_checkin"
STALE_KIND = "stale"


def _zone(name):
    try:
        return ZoneInfo(name or "UTC")
    except Exception:
        return ZoneInfo("UTC")


def parse_iso(value):
    if not value:
        return None
    text = value.replace("Z", "+00:00")
    try:
        parsed = dt.datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt.timezone.utc)
    return parsed


def next_daily_at(timezone_name, mode, after=None):
    if mode in ("", "off", None):
        return None
    hour = REMINDER_HOURS.get(mode, 18)
    zone = _zone(timezone_name)
    moment = after or dt.datetime.now(dt.timezone.utc)
    local = moment.astimezone(zone)
    candidate = local.replace(hour=hour, minute=0, second=0, microsecond=0)
    if candidate <= local:
        candidate = candidate + dt.timedelta(days=1)
    return candidate.astimezone(dt.timezone.utc).isoformat()


def return_at(timezone_name, when):
    zone = _zone(timezone_name)
    local = dt.datetime.now(dt.timezone.utc).astimezone(zone)
    if when == "tomorrow":
        local = local + dt.timedelta(days=1)
    local = local.replace(hour=18, minute=0, second=0, microsecond=0)
    if when == "today" and local <= dt.datetime.now(dt.timezone.utc).astimezone(zone):
        local = local + dt.timedelta(hours=1)
    return local.astimezone(dt.timezone.utc).isoformat()


def upsert_daily(data, user):
    mode = user.get("reminder_mode")
    existing = next(
        (
            item
            for item in data["reminders"]
            if item.get("user_id") == user["id"] and item.get("kind") == DAILY_KIND and item.get("status") == "scheduled"
        ),
        None,
    )
    scheduled = next_daily_at(user.get("timezone"), mode)
    if not scheduled:
        if existing:
            existing["status"] = "cancelled"
        return None
    payload = {
        "kind": DAILY_KIND,
        "text": "Короткий пульс дня: если есть минута, отметьте одно действие. Даже маленький шаг считается.",
        "scheduled_at": scheduled,
        "timezone": user.get("timezone") or "UTC",
        "status": "scheduled",
        "attempts": 0,
        "user_id": user["id"],
    }
    if existing:
        existing.update(payload)
        return existing
    item = {"id": uid(), **payload, "next_action_id": None, "return_person_label": ""}
    data["reminders"].append(item)
    return item


def add_return(data, user, scheduled_at, action_id=None):
    item = {
        "id": uid(),
        "user_id": user["id"],
        "kind": RETURN_KIND,
        "text": "Пора спокойно вернуться к разговору. Одно короткое сообщение достаточно.",
        "scheduled_at": scheduled_at,
        "timezone": user.get("timezone") or "UTC",
        "status": "scheduled",
        "attempts": 0,
        "sent_at": None,
        "next_action_id": action_id,
        "return_person_label": "",
    }
    data["reminders"].append(item)
    return item


def due_items(data, moment=None):
    moment = moment or dt.datetime.now(dt.timezone.utc)
    due = []
    for item in data["reminders"]:
        if item.get("status") != "scheduled":
            continue
        scheduled = parse_iso(item.get("scheduled_at"))
        if scheduled and scheduled <= moment:
            user = next((row for row in data["users"] if row["id"] == item.get("user_id") and not row.get("deleted_at")), None)
            if user:
                due.append((item, user))
    return due


def mark_sent(data, item, user):
    item["sent_at"] = now()
    item["attempts"] = int(item.get("attempts") or 0) + 1
    if item.get("kind") == DAILY_KIND:
        nxt = next_daily_at(user.get("timezone"), user.get("reminder_mode"))
        if nxt:
            item["scheduled_at"] = nxt
            item["status"] = "scheduled"
        else:
            item["status"] = "sent"
    else:
        item["status"] = "sent"


def maybe_stale(data, user):
    if user.get("reminder_mode") in ("", "off", None):
        return None
    logs = [item for item in data["daily_logs"] if item.get("user_id") == user["id"]]
    last_date = max((item.get("local_date") for item in logs if item.get("local_date")), default=None)
    today = dt.date.today()
    if last_date:
        silent_days = (today - dt.date.fromisoformat(last_date)).days
    else:
        created = parse_iso(user.get("onboarding_completed_at") or user.get("created_at"))
        silent_days = (today - created.date()).days if created else 0
    if silent_days < 2:
        return None
    recent = [
        item
        for item in data["reminders"]
        if item.get("user_id") == user["id"] and item.get("kind") == STALE_KIND and item.get("status") in {"scheduled", "sent"}
    ]
    if any((parse_iso(item.get("sent_at") or item.get("scheduled_at")) or dt.datetime.min.replace(tzinfo=dt.timezone.utc)) > dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=1) for item in recent):
        return None
    item = {
        "id": uid(),
        "user_id": user["id"],
        "kind": STALE_KIND,
        "text": "Пауза не отменяет путь. Если есть силы, отметьте день одним маленьким шагом. Я рядом.",
        "scheduled_at": now(),
        "timezone": user.get("timezone") or "UTC",
        "status": "scheduled",
        "attempts": 0,
        "sent_at": None,
        "next_action_id": None,
        "return_person_label": "",
    }
    data["reminders"].append(item)
    return item