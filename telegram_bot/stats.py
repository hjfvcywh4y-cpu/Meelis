"""Простая статистика уникальных пользователей бота."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock

_lock = Lock()
_path = Path(os.getenv("STATS_PATH", "data/stats.json"))


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _empty() -> dict:
    return {"users": {}}


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


def snapshot() -> dict:
    with _lock:
        data = _load()
    users = data.get("users") or {}
    starts = sum(int(u.get("starts", 0)) for u in users.values())
    messages = sum(int(u.get("messages", 0)) for u in users.values())
    callbacks = sum(int(u.get("callbacks", 0)) for u in users.values())
    return {
        "unique_users": len(users),
        "starts": starts,
        "messages": messages,
        "callbacks": callbacks,
    }


def admin_ids() -> set[int]:
    raw = os.getenv("BOT_ADMIN_IDS", "").strip()
    ids: set[int] = set()
    for part in raw.replace(";", ",").split(","):
        part = part.strip()
        if part.isdigit() or (part.startswith("-") and part[1:].isdigit()):
            ids.add(int(part))
    return ids
