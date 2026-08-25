"""Простая статистика уникальных пользователей бота."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock

_lock = Lock()
_path = Path(os.getenv("STATS_PATH", "data/stats.json"))
_consent_document = os.getenv(
    "CONSENT_DOCUMENT",
    "Согласие на обработку персональных данных.pdf",
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _empty() -> dict:
    return {"users": {}, "feedback": []}


_MAX_FEEDBACK = 200
_MAX_FEEDBACK_TEXT = 4000


def _load() -> dict:
    if not _path.exists():
        return _empty()
    try:
        data = json.loads(_path.read_text(encoding="utf-8"))
    except Exception:
        return _empty()
    if not isinstance(data, dict) or "users" not in data:
        return _empty()
    return data


def _save(data: dict) -> None:
    _path.parent.mkdir(parents=True, exist_ok=True)
    tmp = _path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(_path)


def has_consent(user_id: int | None) -> bool:
    if not user_id:
        return False
    with _lock:
        data = _load()
        row = (data.get("users") or {}).get(str(user_id)) or {}
        return bool(row.get("consent_given"))


def record_consent(
    user_id: int | None,
    *,
    accepted: bool,
    username: str | None = None,
    first_name: str | None = None,
) -> None:
    if not user_id:
        return
    key = str(user_id)
    with _lock:
        data = _load()
        users = data.setdefault("users", {})
        row = users.get(key) or {
            "first_seen": _now(),
            "starts": 0,
            "messages": 0,
            "callbacks": 0,
        }
        row["last_seen"] = _now()
        row["consent_given"] = accepted
        row["consent_at"] = _now()
        row["consent_document"] = _consent_document
        if username:
            row["username"] = username
        if first_name:
            row["first_name"] = first_name
        users[key] = row
        _save(data)


def record_user(
    user_id: int | None,
    *,
    event: str,
    username: str | None = None,
    first_name: str | None = None,
) -> None:
    if not user_id:
        return
    key = str(user_id)
    with _lock:
        data = _load()
        users = data.setdefault("users", {})
        row = users.get(key) or {
            "first_seen": _now(),
            "starts": 0,
            "messages": 0,
            "callbacks": 0,
        }
        row["last_seen"] = _now()
        if username:
            row["username"] = username
        if first_name:
            row["first_name"] = first_name
        if event == "start":
            row["starts"] = int(row.get("starts", 0)) + 1
        elif event == "message":
            row["messages"] = int(row.get("messages", 0)) + 1
        elif event == "callback":
            row["callbacks"] = int(row.get("callbacks", 0)) + 1
        users[key] = row
        _save(data)


def record_feedback(
    user_id: int | None,
    *,
    text: str,
    username: str | None = None,
    first_name: str | None = None,
) -> dict:
    cleaned = (text or "").strip()[:_MAX_FEEDBACK_TEXT]
    entry = {
        "at": _now(),
        "user_id": user_id,
        "username": username or "",
        "first_name": first_name or "",
        "text": cleaned,
    }
    with _lock:
        data = _load()
        items = data.setdefault("feedback", [])
        if not isinstance(items, list):
            items = []
        items.append(entry)
        data["feedback"] = items[-_MAX_FEEDBACK:]
        _save(data)
    return entry


def snapshot() -> dict:
    with _lock:
        data = _load()
    users = data.get("users") or {}
    starts = sum(int(u.get("starts", 0)) for u in users.values())
    messages = sum(int(u.get("messages", 0)) for u in users.values())
    callbacks = sum(int(u.get("callbacks", 0)) for u in users.values())
    consented = 0
    declined = 0
    pending = 0
    consents: list[dict] = []
    for uid, row in users.items():
        if "consent_given" not in row:
            pending += 1
            continue
        accepted = bool(row.get("consent_given"))
        if accepted:
            consented += 1
        else:
            declined += 1
        consents.append(
            {
                "id": uid,
                "username": row.get("username") or "",
                "first_name": row.get("first_name") or "",
                "accepted": accepted,
                "at": row.get("consent_at") or "",
                "document": row.get("consent_document") or _consent_document,
            }
        )
    consents.sort(key=lambda r: r.get("at") or "", reverse=True)
    feedback = [
        row for row in (data.get("feedback") or []) if isinstance(row, dict)
    ]
    feedback.reverse()
    return {
        "unique_users": len(users),
        "starts": starts,
        "messages": messages,
        "callbacks": callbacks,
        "consented": consented,
        "declined": declined,
        "pending": pending,
        "consents": consents,
        "feedback": feedback,
        "feedback_count": len(feedback),
        "service_chat": _service_chat_from_data(data),
        "stats_path": str(_path),
    }


def get_owner_id() -> int | None:
    with _lock:
        data = _load()
    raw = data.get("owner_id")
    if isinstance(raw, int):
        return raw
    if isinstance(raw, str) and (raw.isdigit() or (raw.startswith("-") and raw[1:].isdigit())):
        return int(raw)
    return None


def _parse_chat_id(raw) -> int | None:
    if isinstance(raw, int):
        return raw
    if isinstance(raw, str) and (raw.isdigit() or (raw.startswith("-") and raw[1:].isdigit())):
        return int(raw)
    return None


def _service_chat_from_data(data: dict) -> dict | None:
    raw = data.get("service_chat")
    if not isinstance(raw, dict):
        return None
    chat_id = _parse_chat_id(raw.get("id"))
    if chat_id is None:
        return None
    return {
        "id": chat_id,
        "title": str(raw.get("title") or ""),
        "type": str(raw.get("type") or ""),
        "linked_at": str(raw.get("linked_at") or ""),
    }


def get_service_chat() -> dict | None:
    with _lock:
        data = _load()
    return _service_chat_from_data(data)


def get_service_chat_id() -> int | None:
    row = get_service_chat()
    return None if row is None else int(row["id"])


def set_service_chat(
    chat_id: int,
    *,
    title: str = "",
    chat_type: str = "",
) -> dict:
    entry = {
        "id": int(chat_id),
        "title": title or "",
        "type": chat_type or "",
        "linked_at": _now(),
    }
    with _lock:
        data = _load()
        data["service_chat"] = entry
        _save(data)
    return entry


def clear_service_chat() -> None:
    with _lock:
        data = _load()
        data.pop("service_chat", None)
        _save(data)


def claim_owner(user_id: int | None) -> int | None:
    """Первый, кто вызовет /stats, становится владельцем, если админы не заданы."""
    if not user_id:
        return get_owner_id()
    with _lock:
        data = _load()
        current = data.get("owner_id")
        if current:
            try:
                return int(current)
            except (TypeError, ValueError):
                return None
        data["owner_id"] = user_id
        _save(data)
        return user_id


def admin_ids() -> set[int]:
    raw = os.getenv("BOT_ADMIN_IDS", "").strip()
    ids: set[int] = set()
    for part in raw.replace(";", ",").split(","):
        part = part.strip()
        if part.isdigit() or (part.startswith("-") and part[1:].isdigit()):
            ids.add(int(part))
    return ids
