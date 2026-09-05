import datetime as dt
from zoneinfo import ZoneInfo

import reminders
import rules
import storage

OUTCOME_TO_RESULT = {
    "interest": "positive",
    "pending": "no_response",
    "scheduled": "scheduled",
    "refusal": "refusal",
    "question": "question",
    "neutral": "neutral",
    "sale": "sale",
    "repeat_sale": "sale",
    "new_partner": "new_partner",
    "considering": "considering",
    "stalled": "stalled",
    "inquiries": "positive",
    "reactions": "no_response",
    "resolved": "positive",
    "issue": "blocked",
    "partner_step": "positive",
    "partner_needs_help": "support",
    "group_meeting": "neutral",
    "learned": "positive",
}

SUCCESS_OUTCOMES = {
    "interest",
    "scheduled",
    "sale",
    "repeat_sale",
    "new_partner",
    "neutral",
    "inquiries",
    "reactions",
    "resolved",
    "partner_step",
    "group_meeting",
    "learned",
    "considering",
    "question",
}


def used_ai_intro(data, user):
    return sum(1 for item in data.get("ai_usage", []) if item.get("user_id") == user["id"] and item.get("status") == "ok")


def draft(user):
    return user.setdefault("flow", {}).setdefault("draft", {})


def logs_for(data, user, date=None):
    items = [item for item in storage.user_logs(data, user) if not item.get("deleted_at")]
    if date:
        items = [item for item in items if item.get("local_date") == date]
    return items


def action_dates(data, user, start=None, end=None):
    dates = set()
    for item in logs_for(data, user):
        if item.get("attempt_status") != "completed" and not item.get("action_done"):
            continue
        if item.get("rest_mark") and item.get("attempt_status") != "completed":
            continue
        day = item.get("local_date")
        if not day:
            continue
        if start and day < start:
            continue
        if end and day > end:
            continue
        dates.add(day)
    return dates


def week_bounds(timezone_name, today=None):
    zone = ZoneInfo(timezone_name or "UTC")
    local = today or dt.datetime.now(dt.timezone.utc).astimezone(zone).date()
    start = local - dt.timedelta(days=local.weekday())
    end = start + dt.timedelta(days=6)
    return start.isoformat(), end.isoformat(), local.isoformat()


def persist_confirmed_profile(data, user):
    body = draft(user)
    if body.get("consent_choice") == "accepted" and not user.get("consent_at"):
        user["consent_at"] = storage.now()
        data["consents"].append({"user_id": user["id"], "given_at": user["consent_at"], "kind": "diary"})
        storage.event(data, "telegram_consent_given", user["id"])
    if body.get("timezone"):
        user["timezone"] = body["timezone"]
    user["language"] = user.get("language") or "ru"
    user["onboarding_step"] = "done"
    if not user.get("onboarding_completed_at"):
        user["onboarding_completed_at"] = storage.now()
        storage.event(data, "profile_completed", user["id"])
    user.setdefault("weekly_target", 3)
    user.setdefault("address_mode", "formal")
    if not user.get("reminder_mode"):
        user["reminder_mode"] = "evening"
    reminders.upsert_daily(data, user)
    return True


def has_saveable_draft(user):
    body = draft(user)
    if body.get("rest_mark"):
        return True
    if body.get("attempt_status") or body.get("action_type") or body.get("outcome"):
        return True
    if body.get("task_text") and not body.get("discard_task_draft"):
        return True
    if body.get("task_edit") in {"cancel", "reschedule"}:
        return True
    return False


def _summary(body):
    parts = []
    if body.get("rest_mark"):
        parts.append("Отмечен отдых.")
    status = body.get("attempt_status")
    if status == "partial":
        parts.append("Записано незавершенное дело.")
    elif status == "not_started":
        parts.append("Записано, что начать не получилось.")
    outcome = body.get("outcome")
    if outcome == "interest":
        parts.append("Результат: есть интерес.")
    elif outcome == "pending":
        parts.append("Ответа пока нет.")
    elif outcome == "refusal":
        parts.append("Отказ записан.")
    elif outcome == "sale":
        parts.append("Заказ оформлен.")
    elif outcome == "scheduled":
        parts.append("Есть договоренность о времени.")
    if body.get("contact_boundary") == "do_not_contact":
        parts.append("Повторно писать не будем.")
    if body.get("task_text") and not body.get("discard_task_draft"):
        parts.append("Дело: " + body["task_text"])
    if body.get("barrier") == "not_disclosed":
        parts.append("Причину разбирать не стали.")
    return " ".join(parts) or "Готово к записи."


def atomic_save_entry_task_notification_and_events(data, user):
    body = draft(user)
    if not has_saveable_draft(user):
        return False
    date = body.get("local_date") or storage.today()
    outcome = body.get("outcome")
    barrier = body.get("barrier")
    if outcome in SUCCESS_OUTCOMES:
        barrier = None
    attempt = body.get("attempt_status")
    if body.get("rest_mark") and not attempt:
        attempt = None
    action_done = attempt == "completed"
    inp = {
        "action_done": action_done,
        "action_type": body.get("action_type"),
        "result_code": OUTCOME_TO_RESULT.get(outcome, outcome),
        "barrier_code": barrier,
        "return_needed": body.get("next_step") in {"wait", "await_person"} or body.get("task_kind") == "return_conversation",
        "follow_up_needed": False,
        "scheduled_at": body.get("task_due_iso"),
        "support_needed": body.get("help_origin") in {"refusal", "meeting"} or body.get("barrier") in {"fear", "skill"},
    }
    rule = rules.route(inp)
    log = {
        "id": storage.uid(),
        "user_id": user["id"],
        "local_date": date,
        "recorded_at": storage.now(),
        "action_done": action_done,
        "attempt_status": attempt,
        "action_type": body.get("action_type"),
        "outcome": outcome,
        "result_code": inp["result_code"],
        "barrier_code": barrier,
        "barrier_source": "button" if barrier else None,
        "next_step": body.get("next_step"),
        "contact_boundary": body.get("contact_boundary"),
        "stated_refusal_reason": body.get("stated_refusal_reason"),
        "continuation": body.get("continuation"),
        "rest_mark": bool(body.get("rest_mark") or body.get("recovery_choice") == "rest"),
        "note": body.get("private_note") or "",
        "return_needed": inp["return_needed"],
        "return_at": body.get("task_due_iso"),
        "state_code": rule["state_code"],
        "bottleneck_code": rule["bottleneck_code"],
        "rule_version": rule.get("version", 1),
        "decision_version": 3,
        "dialogue_version": 3,
        "branch_code": body.get("action_type") or body.get("attempt_status") or "entry",
        "human_summary": _summary(body),
        "rule_input": inp,
        "source_rule_id": rule["id"],
        "completed_at": storage.now(),
        "revision": int(user.get("flow", {}).get("revision") or 1),
    }
    data["daily_logs"].append(log)
    storage.event(data, "entry_saved", user["id"], {"entry_id": log["id"], "outcome": outcome or "", "attempt_status": attempt or ""})
    task = None
    if body.get("task_edit") == "cancel":
        action = storage.active_next_action(data, user)
        if action:
            action["status"] = "cancelled"
            action["completed_at"] = storage.now()
            storage.event(data, "task_cancelled", user["id"], {"task_id": action["id"]})
    elif not body.get("discard_task_draft") and (body.get("task_text") or body.get("task_kind")):
        title = body.get("task_text") or {
            "call": "Созвониться",
            "meeting": "Встретиться",
            "return_conversation": "Вернуться к разговору",
            "customer_care": "Помочь клиенту",
            "send_product_info": "Отправить сведения о продукте",
            "send_terms": "Отправить условия",
            "send_answer": "Ответить на вопрос",
        }.get(body.get("task_kind"), "Следующий шаг")
        due = body.get("task_due_iso")
        task = {
            "id": storage.uid(),
            "user_id": user["id"],
            "daily_log_id": log["id"],
            "title": title,
            "status": "active",
            "action_type": body.get("action_type") or body.get("task_kind"),
            "source_rule_id": log.get("source_rule_id"),
            "assigned_at": storage.now(),
            "due_at": due,
            "original_due_at": due,
            "notification": body.get("notification") or "off",
        }
        data["next_actions"].append(task)
        storage.event(data, "task_created", user["id"], {"task_id": task["id"]})
        if body.get("notification") in {"requested", "replace_confirmed"} and due:
            if body.get("notification") == "replace_confirmed":
                for item in data["reminders"]:
                    if item.get("user_id") == user["id"] and item.get("status") == "scheduled":
                        item["status"] = "cancelled"
            elif not storage.is_plus(user) and storage.active_return_reminders(data, user):
                task["notification"] = "off"
            else:
                reminders.add_return(data, user, due, task["id"])
                storage.event(data, "reminder_requested", user["id"], {"task_id": task["id"]})
    user["last_saved_entry_id"] = log["id"]
    user["flow"]["draft"] = {}
    _recalc_progress(data, user)
    return True


def delete_selected_owned_entry_and_recalculate(data, user):
    entry_id = draft(user).get("selected_entry_id") or user.get("selected_entry_id")
    log = next((item for item in data["daily_logs"] if item["id"] == entry_id and item["user_id"] == user["id"]), None)
    if not log:
        return False
    log["deleted_at"] = storage.now()
    storage.event(data, "entry_deleted", user["id"], {"entry_id": log["id"]})
    _recalc_progress(data, user)
    return True


def save_user_rhythm_setting(data, user):
    target = draft(user).get("weekly_target")
    user["weekly_target_next"] = target
    if user.get("weekly_target") is None:
        user["weekly_target"] = target
    storage.event(data, "rhythm_updated", user["id"])
    return True


def save_tone_preferences(data, user):
    body = draft(user)
    if "address_mode" in body:
        user["address_mode"] = body["address_mode"]
    if "tips_enabled" in body:
        user["tips_enabled"] = body["tips_enabled"]
    return True


def save_ai_data_preferences(data, user):
    user["ai_consent_mode"] = draft(user).get("ai_consent_mode") or "ask_each_request"
    return True


def save_notification_preferences_and_reconcile_pending_deliveries(data, user):
    body = draft(user)
    if "notifications_enabled" in body:
        user["reminder_mode"] = "evening" if body["notifications_enabled"] else "off"
        reminders.upsert_daily(data, user)
    if body.get("daily_time"):
        user["daily_time"] = body["daily_time"]
    if body.get("quiet_hours"):
        user["quiet_hours"] = body["quiet_hours"]
    if body.get("notifications_pause_days"):
        user["notifications_paused_until"] = (dt.date.today() + dt.timedelta(days=int(body["notifications_pause_days"]))).isoformat()
    return True


def persist_owned_ai_artifact_only(data, user):
    text = (user.get("flow", {}).get("draft") or {}).get("ai_text") or user.get("ai_session", {}).get("last_text")
    if not text:
        return False
    data.setdefault("tool_artifacts", []).append(
        {
            "id": storage.uid(),
            "user_id": user["id"],
            "kind": "ai_draft",
            "ai_generated": True,
            "text": text,
            "created_at": storage.now(),
        }
    )
    return True


def persist_owned_mentor_question_artifact(data, user):
    text = draft(user).get("mentor_question")
    if not text:
        return False
    data.setdefault("tool_artifacts", []).append(
        {
            "id": storage.uid(),
            "user_id": user["id"],
            "kind": "mentor_question",
            "text": text,
            "created_at": storage.now(),
        }
    )
    return True


def delete_owned_data_cancel_jobs_and_revoke_access(data, user):
    user["deleted_at"] = storage.now()
    for item in data.get("reminders", []):
        if item.get("user_id") == user["id"] and item.get("status") == "scheduled":
            item["status"] = "cancelled"
    storage.event(data, "user_deleted", user["id"])
    return True


def _recalc_progress(data, user):
    start, end, _ = week_bounds(user.get("timezone"))
    days = len(action_dates(data, user, start, end))
    user["week_action_days"] = days
    badges = user.setdefault("badges", [])
    if days >= 1 and "first_day" not in badges:
        badges.append("first_day")
    target = user.get("weekly_target")
    if target and days >= int(target) and "week_target" not in badges:
        badges.append("week_target")


def bounded_ai_request_and_validate(data, user):
    import ai_client
    import ai_context
    import ai_safety
    import ai_usage

    body = draft(user)
    if user.get("ai_consent_mode") == "disabled":
        return False
    if not storage.is_plus(user) and used_ai_intro(data, user) >= 3:
        return False
    if not ai_usage.can_request(data, user["id"]):
        return False
    prompt = body.get("ai_user_request") or "Подготовьте короткий спокойный черновик без обещаний дохода и без выдуманных ссылок."
    context = ai_context.as_text(ai_context.snapshot(data, user, include_history=False))
    try:
        result = ai_client.complete(f"{prompt}\n\nКонтекст:\n{context}")
    except Exception:
        ai_usage.log_call(data, user["id"], "", "error", "unavailable")
        return False
    text = ai_safety.sanitize(result.get("text") or "")
    lowered = (text or "").lower()
    if "http" in lowered and not any(host in lowered for host in ("mlmacademy.ru", "savv.tech")):
        ai_usage.log_call(data, user["id"], result.get("provider") or "", "rejected", "unapproved_url")
        return False
    body["validated_ai_text"] = text
    body["ai_text"] = text
    ai_usage.log_call(data, user["id"], result.get("provider") or "", "ok")
    return True


def render_owned_snapshot_pdf(data, user):
    return False


def export_owned_records(data, user):
    body = draft(user)
    logs = operations_logs_safe(data, user, body.get("export_period") or "week")
    include_notes = bool(body.get("include_private_notes"))
    lines = ["date,action_type,attempt_status,outcome"]
    if include_notes:
        lines[0] += ",note"
    for item in logs:
        row = [
            item.get("local_date") or "",
            item.get("action_type") or "",
            item.get("attempt_status") or "",
            item.get("outcome") or item.get("result_code") or "",
        ]
        if include_notes:
            note = item.get("note") or ""
            if note[:1] in {"=", "+", "-", "@"}:
                note = "'" + note
            row.append(note.replace("\n", " ").replace(",", ";"))
        lines.append(",".join(row))
    body["export_text"] = "CSV готов:\n" + "\n".join(lines[:80])
    storage.event(data, "export_ready", user["id"])
    return True


def operations_logs_safe(data, user, period):
    logs = logs_for(data, user)
    if period == "week":
        start, end, _ = week_bounds(user.get("timezone"))
        return [item for item in logs if start <= (item.get("local_date") or "") <= end]
    if period == "month":
        now = dt.date.today().replace(day=1).isoformat()
        return [item for item in logs if (item.get("local_date") or "") >= now]
    return logs


def open_validated_catalog_url_without_private_query_data(data, user):
    return False


def create_telegram_stars_invoice_if_features_ready(data, user):
    return False


def load_owned_entry_into_edit_draft(data, user):
    entry_id = user.get("selected_entry_id")
    log = next((item for item in data["daily_logs"] if item["id"] == entry_id and item["user_id"] == user["id"]), None)
    if not log:
        return False
    body = draft(user)
    body.update(
        {
            "local_date": log.get("local_date"),
            "attempt_status": log.get("attempt_status"),
            "action_type": log.get("action_type"),
            "outcome": log.get("outcome"),
            "barrier": log.get("barrier_code"),
            "selected_entry_id": log["id"],
            "saved_entry_kind": "rest"
            if log.get("rest_mark")
            else (log.get("attempt_status") or "completed"),
        }
    )
    return True