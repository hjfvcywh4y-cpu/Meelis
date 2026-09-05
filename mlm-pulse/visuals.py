import datetime as dt
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "assets")

PHOTOS = {
    "welcome": {
        "file": "mlm-pulse-welcome-v1.png",
        "caption": "Я рядом, чтобы день был понятнее.",
        "flag": "welcome_photo_sent",
    },
    "bot": {
        "file": "mlm-pulse-bot-v1.png",
        "caption": "MLM Pulse — спокойный напарник рядом.",
        "flag": "about_photo_sent",
    },
    "reminder": {
        "file": "mlm-pulse-reminder-v1.png",
        "caption": "Напоминание — это поддержка, не контроль.",
        "flag": "reminder_photo_sent",
    },
    "weekly": {
        "file": "mlm-pulse-weekly-v1.png",
        "caption": "Неделя видна по вашим записям, без сравнения с чужими результатами.",
        "flag": "weekly_photo_week",
    },
    "support": {
        "file": "mlm-pulse-support-v1.png",
        "caption": "Один трудный день не описывает весь путь.",
        "flag": "support_photo_sent",
    },
}


def photo_path(kind):
    item = PHOTOS.get(kind)
    if not item:
        return None
    path = os.path.join(ASSETS, item["file"])
    return path if os.path.isfile(path) else None


def should_send(user, kind, extra=None):
    if not photo_path(kind):
        return False
    item = PHOTOS[kind]
    flag = item["flag"]
    if kind in {"welcome", "reminder", "bot", "support"}:
        return not user.get(flag)
    if kind == "weekly":
        return extra and extra != user.get(flag)
    return True


def mark_sent(user, kind, extra=None):
    item = PHOTOS[kind]
    flag = item["flag"]
    if kind == "weekly":
        user[flag] = extra
    elif flag:
        user[flag] = True


def attach(response, user, kind, extra=None):
    if not should_send(user, kind, extra):
        return response
    path = photo_path(kind)
    if not path:
        return response
    response["photo"] = path
    response["photo_caption"] = PHOTOS[kind]["caption"]
    mark_sent(user, kind, extra)
    return response


def iso_week(today=None):
    return (today or __import__("datetime").date.today()).strftime("%G-W%V")