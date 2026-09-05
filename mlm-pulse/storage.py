import datetime as dt
import hashlib
import json
import os
import tempfile
import threading
import uuid

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.environ.get("STORAGE_FILE") or os.path.join(ROOT, "storage.json")
LOCK = threading.RLock()
SESSIONS = {}
RATE = {}
GROUPS = {
    "A": {"daily_log": True, "next_action": False, "tracks": False},
    "B": {"daily_log": True, "next_action": True, "tracks": False},
    "C": {"daily_log": True, "next_action": True, "tracks": True},
}
FREE_HISTORY_DAYS = 14
PAYWALL_AFTER_LOGS = 5


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def today():
    return dt.date.today().isoformat()


def uid():
    return uuid.uuid4().hex


def telegram_hash(telegram_id):
    return hashlib.sha256(str(telegram_id).encode()).hexdigest()


def new_data():
    return {
        "users": [],
        "consents": [],
        "partner_profiles": [],
        "pilot_groups": [{"code": key, "features": value} for key, value in GROUPS.items()],
        "daily_logs": [],
        "daily_drafts": [],
        "route_rules": [],
        "next_actions": [],
        "action_outcomes": [],
        "reminders": [],
        "paid_materials": [],
        "material_events": [],
        "tool_artifacts": [],
        "reports": [],
        "subscriptions": [],
        "ai_usage": [],
        "analytics_events": [],
        "mentor_assignments": [],
        "access_audit_log": [],
        "track_opens": [],
        "processed_telegram_updates": [],
    }


def save(data):
    folder = os.path.dirname(os.path.abspath(DATA_FILE)) or ROOT
    os.makedirs(folder, exist_ok=True)
    handle, path = tempfile.mkstemp(prefix=".pulse-", suffix=".json", dir=folder)
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as file:
            json.dump(data, file, ensure_ascii=False, indent=2)
            file.flush()
            os.fsync(file.fileno())
        os.replace(path, DATA_FILE)
    finally:
        if os.path.exists(path):
            os.unlink(path)


def load():
    if not os.path.exists(DATA_FILE):
        save(new_data())
    with open(DATA_FILE, encoding="utf-8") as file:
        return json.load(file)


def seed():
    data = load()
    if not data.get("pilot_groups"):
        data["pilot_groups"] = [{"code": key, "features": value} for key, value in GROUPS.items()]
    for key in new_data():
        data.setdefault(key, [])
    if not data["users"]:
        for role in ("partner", "mentor", "team"):
            data["users"].append(
                {
                    "id": uid(),
                    "name": "Demo " + role,
                    "role": role,
                    "pilot_group": "C",
                    "plan": "free",
                    "plan_status": "active",
                    "timezone": "UTC",
                    "consent_at": None,
                    "created_at": now(),
                    "updated_at": now(),
                    "deleted_at": None,
                }
            )
    save(data)


def user_for(data, token):
    user_id = SESSIONS.get(token)
    return next((user for user in data["users"] if user["id"] == user_id and not user.get("deleted_at")), None)


def feature(user, key):
    group = next((item["features"] for item in load()["pilot_groups"] if item["code"] == user.get("pilot_group")), GROUPS["A"])
    return group.get(key, False)


def is_plus(user):
    return user.get("plan") == "plus" and user.get("plan_status") == "active"


def event(data, name, user_id, payload=None):
    user = next((item for item in data["users"] if item["id"] == user_id), None)
    data["analytics_events"].append(
        {
            "event_id": uid(),
            "event_name": name,
            "schema_version": 1,
            "occurred_at": now(),
            "actor_user_id": user_id,
            "subject_user_id": user_id,
            "pilot_group_code": user.get("pilot_group", "") if user else "",
            "payload": payload or {},
        }
    )


def audit(data, actor, subject, resource, action, decision, reason):
    data["access_audit_log"].append(
        {
            "id": uid(),
            "actor_user_id": actor,
            "subject_user_id": subject,
            "resource": resource,
            "action": action,
            "decision": decision,
            "reason": reason,
            "occurred_at": now(),
        }
    )


def user_logs(data, user):
    logs = [item for item in data["daily_logs"] if item["user_id"] == user["id"] and not item.get("deleted_at")]
    logs.sort(key=lambda item: item.get("local_date") or "")
    return logs


def active_next_action(data, user):
    return next((item for item in data["next_actions"] if item["user_id"] == user["id"] and item["status"] == "active"), None)


def active_return_reminders(data, user):
    return [
        item
        for item in data["reminders"]
        if item.get("user_id") == user["id"] and item.get("kind") in {"follow_up", "return_to_conversation"} and item.get("status") == "scheduled"
    ]