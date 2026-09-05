import datetime as dt
import json
import os
import re
from zoneinfo import ZoneInfo

import calendar_view
import menus
import operations
import phrases
import storage
import visuals

SPEC_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "docs", "mlm-pulse-dialogues-v3.json")
ALLOWED_PATCH = {
    "pending",
    "consent_choice",
    "date_selection",
    "attempt_status",
    "action_type",
    "outcome",
    "next_step",
    "task_kind",
    "help_origin",
    "help_topic",
    "ai_task",
    "contact_boundary",
    "stated_refusal_reason",
    "barrier",
    "available_minutes",
    "rest_mark",
    "goal",
    "notification",
    "task_due",
    "discard_task_draft",
    "recovery_choice",
    "step_hint",
    "template_topic",
    "ai_variant_request",
    "ai_feedback",
    "export_format",
    "include_private_notes",
    "export_period",
    "report_kind",
    "weekly_target",
    "notifications_pause_days",
    "notifications_enabled",
    "address_mode",
    "tips_enabled",
    "ai_consent_mode",
    "policy_origin",
    "selected_date",
    "task_edit",
    "learning_report",
}
CITY_TZ = {
    "москва": "Europe/Moscow",
    "санкт-петербург": "Europe/Moscow",
    "питер": "Europe/Moscow",
    "новосибирск": "Asia/Novosibirsk",
    "екатеринбург": "Asia/Yekaterinburg",
    "казань": "Europe/Moscow",
    "красноярск": "Asia/Krasnoyarsk",
    "владивосток": "Asia/Vladivostok",
    "сочи": "Europe/Moscow",
    "минск": "Europe/Minsk",
    "алматы": "Asia/Almaty",
    "ташкент": "Asia/Tashkent",
}
STEPS = {
    ("conversation", 5): "Подготовить ответ на один актуальный вопрос.",
    ("conversation", 15): "Уточнить одну договоренность.",
    ("conversation", 30): "Подготовить разговор и предложить удобное время.",
    ("agreements", 5): "Вспомнить один открытый вопрос в переписке.",
    ("agreements", 15): "Выписать три уместных повода для общения.",
    ("agreements", 30): "Разобрать незавершенные разговоры и выбрать один.",
    ("customer", 5): "Уточнить статус одного запроса.",
    ("customer", 15): "Подготовить проверенный ответ.",
    ("customer", 30): "Разобраться с одним вопросом получения или сервиса.",
    ("team", 5): "Спросить, в чем нужна помощь.",
    ("team", 15): "Вместе выбрать первое дело.",
    ("team", 30): "Подготовить короткую совместную встречу.",
    ("content", 5): "Записать одну тему.",
    ("content", 15): "Сделать короткий черновик.",
    ("content", 30): "Подготовить и проверить одну публикацию.",
    ("rhythm", 5): "Записать один непонятный вопрос.",
    ("rhythm", 15): "Закончить выбранный фрагмент.",
    ("rhythm", 30): "Закончить фрагмент и подготовить применение.",
}
ACTION_TO_GOAL = {
    "conversation_preparation": "conversation",
    "meeting_preparation": "conversation",
    "new_conversation": "conversation",
    "return_conversation": "conversation",
    "content": "content",
    "learning": "rhythm",
    "other": "rhythm",
    "customer_care": "customer",
    "team_support": "team",
}
LOCKED_OUTCOMES = {"sale", "repeat_sale", "new_partner", "interest", "refusal", "scheduled", "learned"}
ATTEMPT_RESET_STATES = {"ACTIVITY", "TASK", "POST", "LEARNING", "ACTION_TYPE", "CONTACT_KIND", "EDIT_DRAFT"}
FREE_TEST = True
PLUS_STATES = {
    "PLUS",
    "PLUS_EXAMPLE",
    "PAYMENT_REVIEW",
    "PAYMENT_START",
    "PAYMENT_WAIT",
    "PAYMENT_STATUS",
    "PAYMENT_ERROR",
    "PAID",
}
HIDDEN_TEST_LABELS = {
    "Посмотреть PLUS",
    "Подключить",
    "Подписка",
    "Перейти к оплате",
    "Подробнее о месяце",
    "Отчет для наставника",
    "Excel",
    "Оформленный PDF",
    "Условия подписки",
    "Пока бесплатно",
}
HIDDEN_TEST_NEXT = PLUS_STATES | {"MONTH_GATE", "MONTH", "MENTOR_REPORT_GATE", "MENTOR_REPORT", "PDF_BUILD", "PAYMENT_REVIEW"}
TEMPLATES = {
    "return": menus.SCRIPT_RETURN,
    "first": menus.SCRIPT_FIRST_CONTACT,
}
_SPEC = None
_STATES = None
TOKEN = re.compile(r"\{([a-zA-Z0-9_]+)\}")


def spec():
    global _SPEC, _STATES
    if _SPEC is None:
        with open(SPEC_PATH, encoding="utf-8") as handle:
            _SPEC = json.load(handle)
        _STATES = {item["id"]: item for item in _SPEC["states"]}
    return _SPEC


def states():
    spec()
    return _STATES


def session(user):
    flow = user.setdefault("flow", {})
    flow.setdefault("state", "START")
    flow.setdefault("history", [])
    flow.setdefault("draft", {})
    flow.setdefault("revision", 1)
    flow.setdefault("session_id", storage.uid())
    return flow


def looks_like(callback_data):
    text = str(callback_data or "")
    return text.startswith("v:") or text.startswith("d:")


def profile_ready(user):
    return bool(user.get("consent_at") and user.get("timezone") and user.get("onboarding_completed_at"))


def _local_now(user):
    try:
        zone = ZoneInfo(user.get("timezone") or "UTC")
    except Exception:
        zone = ZoneInfo("UTC")
    return dt.datetime.now(dt.timezone.utc).astimezone(zone)


def _ctx(data, user):
    flow = session(user)
    body = flow["draft"]
    now = _local_now(user)
    start, end, today = operations.week_bounds(user.get("timezone"), now.date())
    logs = operations.logs_for(data, user)
    today_logs = operations.logs_for(data, user, today)
    target = user.get("weekly_target") if user.get("weekly_target") is not None else 3
    acted = len(operations.action_dates(data, user, start, end))
    task = storage.active_next_action(data, user)
    selected = body.get("selected_date") or today
    return {
        "contextual_greeting": _greeting(user, now, logs),
        "today_summary": _today_summary(today_logs, acted, target),
        "nearest_task_or_small_step": f"Ближайшее дело: {task['title']}" if task else "Можно выбрать небольшой шаг или записать уже сделанное.",
        "timezone_confirmation": body.get("timezone_label") or "Не удалось определить пояс",
        "local_time": now.strftime("%H:%M"),
        "approved_policy_summary": "Утвержденный текст политики еще публикуется. Тестовые записи можно удалить в настройках.",
        "approved_policy_urls": "Ссылки появятся после публикации условий.",
        "approved_contextual_step": _step_text(body),
        "draft_summary_or_nothing_to_save": operations._summary(body) if operations.has_saveable_draft(user) else "Пока нечего сохранять. Можно записать действие или вернуться.",
        "saved_fact_confirmation": user.get("last_save_text") or "Сохранил.",
        "contextual_encouragement": "Эта история больше не зависит только от памяти.",
        "progress_change_if_any": phrases.week_progress_text(acted, target),
        "task_title": (task or {}).get("title") or body.get("task_text") or "Дело",
        "task_due_and_status": (task or {}).get("due_at") or "без срока",
        "confirmed_local_datetime": body.get("task_due_display") or body.get("task_due") or "",
        "task_date": body.get("task_date") or "",
        "localized_month": _month_title(user),
        "days_activity_rest_unknown": _month_counts(data, user),
        "selected_local_date": selected,
        "day_entries_tasks_and_rest_or_empty": _day_text(data, user, selected),
        "owned_entry_details": _entry_text(data, user),
        "computed_week_facts": _week_text(data, user, start, end, acted, target),
        "evidence_based_week_tip_or_insufficient_data": "Этого достаточно, чтобы видеть ритм. Сравнивать короткую неделю с полной пока не будем.",
        "approved_relevant_template": TEMPLATES.get(body.get("template_topic") or "first", menus.SCRIPT_FIRST_CONTACT),
        "ai_context_question_or_month_snapshot_preview": "Опишите ситуацию без имен и контактов. Можно опереться на уже выбранную ветку дневника.",
        "ai_data_scope_notice": "Имена, контакты и личные заметки по умолчанию не передаются.",
        "actual_available_plus_features_price_and_term": "В этой тестовой версии доступен бесплатный дневник.",
        "verified_invoice_summary": "Оплата еще не подключена: продаваемые функции сначала должны быть готовы.",
        "renewal_and_cancellation_terms": "Автопродление не включено.",
        "server_verified_payment_status": "Оплата не подтверждена.",
        "weekly_target_and_badges": f"Цель недели: {target or 'выключена'}. Значки появятся после первых сохраненных дней.",
        "progress_explanation": "Один день действий считается один раз, сколько бы записей ни было.",
        "notification_settings_summary": f"Напоминания: {user.get('reminder_mode') or 'не заданы'}.",
        "tone_and_tips_settings": "Сейчас обращение на «вы»." if user.get("address_mode") != "informal" else "Сейчас обращение на «ты».",
        "ai_data_preferences": "Перед каждым запросом к помощнику можно отказаться.",
        "account_deletion_scope_and_retention_notice": "Будут удалены дневник, планы и настройки этого аккаунта.",
        "verified_deletion_result": "Данные удалены. Если напишете /start, дневник начнётся заново.",
        "approved_material_title": "",
        "why_relevant_from_known_facts": "",
        "approved_material_scope_and_access": "",
        "quota_reset_text": "Лимит обновится позже.",
        "redacted_context_preview": "тип действия и выбранный результат без имен",
        "validated_ai_text": body.get("validated_ai_text") or "",
        "mentor_question": body.get("mentor_question") or "",
        "owned_saved_drafts_and_files_or_empty": "Пока нет сохраненных черновиков.",
        "owned_artifact_preview": "",
        "mentor_report_snapshot_preview": "Отчет без личных заметок будет доступен после подготовки PDF.",
        "verified_file_ready_summary": body.get("export_text") or "Файл еще не подготовлен.",
        "existing_reminder_summary": "Уже есть одно личное напоминание.",
        "entry_summary": "выбранная запись",
        "confirmed_access_end": "",
        "coverage_warning_if_needed": "",
        "computed_month_facts": _week_text(data, user, start, end, acted, target),
        "selected_period": body.get("export_period") or "неделя",
    }


def _greeting(user, now, logs):
    name = ((user.get("name") or "").split() or [""])[0]
    hour = now.hour
    hello = "доброе утро" if hour < 12 else "добрый день" if hour < 18 else "добрый вечер"
    you = name or "Вы"
    if not logs:
        return f"{you}, {hello}! Можно начать с короткой записи."
    last = max((item.get("local_date") for item in logs), default=None)
    if last:
        silent = (now.date() - dt.date.fromisoformat(last)).days
        if silent >= 3:
            return "С возвращением. Можно начать с сегодняшнего дня, прошлые дни заполнять необязательно."
    return f"Рад вас видеть. {hello.capitalize()}."


def _today_summary(today_logs, acted, target):
    return phrases.today_summary_text(len(today_logs), acted, target)


def _month_title(user):
    now = _local_now(user)
    months = ("январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь")
    return f"{months[now.month - 1].capitalize()} {now.year}"


def _month_counts(data, user):
    now = _local_now(user).date()
    start = now.replace(day=1)
    action = rest = empty = 0
    day = start
    while day.month == now.month and day <= now:
        iso = day.isoformat()
        logs = operations.logs_for(data, user, iso)
        if any(item.get("attempt_status") == "completed" or item.get("action_done") for item in logs):
            action += 1
        elif any(item.get("rest_mark") for item in logs):
            rest += 1
        else:
            empty += 1
        day += dt.timedelta(days=1)
    return f"Дни действий: {action}. Дни отдыха: {rest}. Без записи: {empty}."


def _day_text(data, user, date):
    logs = operations.logs_for(data, user, date)
    tasks = [item for item in data.get("next_actions", []) if item.get("user_id") == user["id"] and item.get("status") == "active"]
    if not logs and not tasks:
        return "Здесь пока нет записи. Это не значит, что дня не было."
    lines = [item.get("human_summary") or "Запись" for item in logs]
    for item in tasks:
        lines.append("Дело: " + item.get("title", ""))
    return "\n".join(lines)


def _entry_text(data, user):
    entry_id = user.get("selected_entry_id")
    log = next((item for item in data.get("daily_logs", []) if item.get("id") == entry_id), None)
    if not log:
        return "Запись не найдена."
    return phrases.entry_card(log) or "Сохраненная запись."


def _week_text(data, user, start, end, acted, target):
    logs = [item for item in operations.logs_for(data, user) if start <= (item.get("local_date") or "") <= end]
    days = len({item.get("local_date") for item in logs})
    if int(acted) <= 0:
        return phrases.EMPTY_WEEK
    return f"Записи есть за {days} из 7 дней. Действовали {phrases.ru_days(acted)}. Цель недели: {target}."


def _free_test_redirect(flow, state_id):
    if state_id in {"MONTH_GATE", "MONTH"}:
        return "WEEK"
    if state_id in {"MENTOR_REPORT_GATE", "MENTOR_REPORT", "MENTOR_REPORT_PREVIEW"}:
        return "DIARY"
    if state_id in PLUS_STATES:
        origin = (flow.get("draft") or {}).get("plus_origin") or ""
        if origin in {"month", "MONTH_GATE"}:
            return "WEEK"
        if origin in {"mentor", "MENTOR_REPORT_GATE"}:
            return "DIARY"
        if origin in {"ai", "AI_CONTEXT"}:
            return "TEMPLATE"
        if origin in {"material", "CATALOG_GATE"}:
            return "HELP"
        if origin in {"reminder", "LIMIT"}:
            return "LIMIT"
        return "HOME"
    return state_id


def _filter_partial_buttons(buttons, body):
    action = body.get("action_type") or ""
    filtered = []
    for item in buttons:
        label = item[0]
        if label == "Испугался реакции" and action in {"learning", "customer_care", "team_support", "other"}:
            continue
        if label == "Не понял, как продолжить" and action in {"new_conversation", "return_conversation"}:
            continue
        filtered.append(item)
    return filtered


def _step_text(body):
    goal = body.get("goal") or ACTION_TO_GOAL.get(body.get("action_type"), "conversation")
    try:
        minutes = int(body.get("available_minutes") or 5)
    except (TypeError, ValueError):
        minutes = 5
    return STEPS.get((goal, minutes), "Сделайте один небольшой следующий шаг.")


def _apply_patch(flow, from_state, nxt, patch):
    body = flow["draft"]
    for key, value in patch.items():
        if key not in ALLOWED_PATCH:
            continue
        if key == "outcome" and body.get("outcome") in LOCKED_OUTCOMES and value != body.get("outcome"):
            body["continuation"] = value
            continue
        if key == "attempt_status" and body.get("attempt_status") and from_state not in ATTEMPT_RESET_STATES:
            continue
        body[key] = value
    if from_state == "ENTRY" and patch.get("date_selection") == "today":
        body["local_date"] = storage.today()
    if from_state == "ENTRY" and patch.get("date_selection") == "yesterday":
        body["local_date"] = (dt.date.today() - dt.timedelta(days=1)).isoformat()
    if patch.get("recovery_choice") == "rest":
        body["rest_mark"] = True
    if from_state == "SMALL_STEP" and nxt == "PLAN_TIME" and not body.get("discard_task_draft"):
        body["task_text"] = _step_text(body)
        body["discard_task_draft"] = False
    if nxt == "QUESTION" and body.get("outcome") in {"sale", "repeat_sale", "new_partner"}:
        body["continuation"] = "question"


def interpolate(text, ctx):
    def replace(match):
        key = match.group(1)
        value = ctx.get(key)
        if value in (None, ""):
            return "—"
        return str(value)

    return TOKEN.sub(replace, text or "")


def _route_value(data, user, key):
    body = session(user)["draft"]
    if key == "profile_ready":
        return "yes" if profile_ready(user) else "no"
    if key == "pending":
        return body.get("pending") or "HOME"
    if key == "policy_origin":
        return "settings" if body.get("policy_origin") == "settings" else "consent"
    if key == "plus_active":
        return "yes" if storage.is_plus(user) else "no"
    if key == "reminder_entitlement":
        if storage.is_plus(user) or not storage.active_return_reminders(data, user):
            return "available"
        return "limit"
    if key == "selected_or_next_task":
        return "found" if storage.active_next_action(data, user) or user.get("selected_task_id") else "none"
    if key == "task_result_family":
        kind = (storage.active_next_action(data, user) or {}).get("action_type") or body.get("action_type") or "other"
        if kind in {"new_conversation", "return_conversation", "conversation_preparation", "first_contact"}:
            return "contact"
        if kind in {"meeting", "meeting_preparation"}:
            return "meeting"
        if kind in {"content", "post"}:
            return "content"
        if kind in {"customer_care", "customer"}:
            return "customer"
        if kind in {"team_support", "team"}:
            return "team"
        if kind == "learning":
            return "learning"
        return "other"
    if key == "saved_entry_kind":
        return body.get("saved_entry_kind") or "completed"
    if key == "ai_access_status":
        if user.get("ai_consent_mode") == "disabled":
            return "disabled"
        if not storage.is_plus(user) and operations.used_ai_intro(data, user) >= 3:
            return "limit"
        return "allowed"
    if key == "catalog_access_status":
        return "no_match"
    if key == "verified_payment_status":
        return "failed"
    if key == "resume_resolution":
        origin = body.get("plus_origin") or body.get("help_origin") or ""
        if origin in {"month", "MONTH_GATE"}:
            return "month_free"
        if origin in {"mentor", "MENTOR_REPORT_GATE"}:
            return "mentor_free"
        if origin in {"ai", "AI_CONTEXT"}:
            return "ai_free"
        if origin in {"material", "CATALOG_GATE"}:
            return "material_free"
        if origin in {"reminder", "LIMIT"}:
            return "reminder_free"
        if session(user).get("history"):
            return "entry"
        return "HOME"
    return None


def _run_operation(data, user, name):
    func = getattr(operations, name, None)
    if not func:
        return False
    return bool(func(data, user))


def _visible_buttons(data, user, state):
    flow = session(user)
    buttons = list(state.get("buttons") or [])
    if flow["state"] == "TIMEZONE_CONFIRM" and not flow["draft"].get("timezone"):
        buttons = [item for item in buttons if item[0] != "Да"]
    if flow["state"] == "REVIEW" and not operations.has_saveable_draft(user):
        buttons = [["Записать действие", "ENTRY"], ["Сегодня", "HOME"]]
    if flow["state"] == "PARTIAL_REASON":
        buttons = _filter_partial_buttons(buttons, flow["draft"])
    if flow["state"] == "DAY":
        selected = flow["draft"].get("selected_date") or storage.today()
        if selected > storage.today():
            buttons = [item for item in buttons if item[0] not in {"Добавить запись", "Отметить отдых"}]
        else:
            extras = []
            for log in operations.logs_for(data, user, selected):
                extras.append([(log.get("human_summary") or "Запись")[:48], "ENTRY_VIEW", {"_entry_id": log["id"]}])
            for task in data.get("next_actions", []):
                if task.get("user_id") != user["id"] or task.get("status") != "active":
                    continue
                due = task.get("due_at") or ""
                if due.startswith(selected) or (not due and selected == storage.today()):
                    extras.append([("Дело: " + (task.get("title") or "без названия"))[:48], "TASK", {"_task_id": task["id"]}])
            buttons = extras + buttons
    if FREE_TEST:
        buttons = [
            item
            for item in buttons
            if item[0] not in HIDDEN_TEST_LABELS and (len(item) < 2 or item[1] not in HIDDEN_TEST_NEXT)
        ]
    return buttons


def goto(data, user, state_id, remember=True):
    flow = session(user)
    current = flow.get("state")
    if remember and current and current != state_id:
        flow["history"].append(current)
        if len(flow["history"]) > 30:
            flow["history"] = flow["history"][-30:]
    flow["state"] = state_id
    flow["await_input"] = None
    flow["revision"] = int(flow.get("revision") or 1) + 1
    return render(data, user)


def render(data, user):
    flow = session(user)
    seen = set()
    while True:
        state_id = flow["state"]
        if FREE_TEST:
            redirected = _free_test_redirect(flow, state_id)
            if redirected != state_id:
                flow["state"] = redirected
                continue
        if state_id in seen:
            break
        seen.add(state_id)
        state = states().get(state_id) or states()["HOME"]
        if "route_by" in state:
            value = _route_value(data, user, state["route_by"])
            nxt = state.get("cases", {}).get(value) or state.get("default") or "HOME"
            if nxt == "PLUS":
                flow["draft"]["plus_origin"] = state_id
            flow["state"] = nxt
            continue
        if "operation" in state:
            if state["operation"] == "atomic_save_entry_task_notification_and_events" and not operations.has_saveable_draft(user):
                flow["state"] = "REVIEW"
                continue
            ok = _run_operation(data, user, state["operation"])
            flow["state"] = state.get("next") if ok else state.get("on_error") or state.get("next") or "HOME"
            if ok and state["operation"] == "atomic_save_entry_task_notification_and_events":
                user["last_save_text"] = phrases.SAVE_CONFIRMATION
            continue
        break
    state = states().get(flow["state"]) or states()["HOME"]
    ctx = _ctx(data, user)
    text = interpolate(state.get("text") or "", ctx)
    if flow["state"] == "REVIEW" and not operations.has_saveable_draft(user):
        text = "Пока нечего сохранять.\nМожно записать действие или вернуться."
    rows = []
    buttons = _visible_buttons(data, user, state)
    for index, button in enumerate(buttons):
        rows.append([menus.button(button[0], f"v:{flow['revision']}:{index}")])
    if state.get("input") and flow["state"] != "REVIEW":
        flow["await_input"] = state["input"]
    elif state.get("input") and any(item[0] == "Пропустить" for item in buttons):
        flow["await_input"] = state["input"]
    else:
        flow["await_input"] = state.get("input")
    nav = []
    if flow["history"]:
        nav.append(menus.button("Назад", f"v:{flow['revision']}:b"))
    nav.append(menus.button("Меню", f"v:{flow['revision']}:h"))
    rows.append(nav)
    markup = menus.keyboard(rows)
    if flow["state"] == "CALENDAR":
        now = _local_now(user)
        year = int(flow["draft"].get("cal_year") or now.year)
        month = int(flow["draft"].get("cal_month") or now.month)
        grid = calendar_view.month_grid(year, month, now.date().isoformat(), data, user["id"], flow["revision"])
        grid["inline_keyboard"].extend(markup["inline_keyboard"])
        markup = grid
        flow["draft"]["cal_year"] = year
        flow["draft"]["cal_month"] = month
    image = state.get("image")
    if image == "support":
        user["_pending_photo"] = "support"
    elif image == "welcome":
        user["_pending_photo"] = "welcome"
    elif image == "weekly":
        user["_pending_photo"] = "weekly"
        user["_pending_photo_extra"] = visuals.iso_week()
    return text, markup


def handle_callback(data, user, callback_data):
    flow = session(user)
    if callback_data.startswith("d:"):
        return _handle_calendar(data, user, callback_data)
    parts = str(callback_data).split(":")
    if len(parts) < 3:
        return goto(data, user, "HOME", remember=False)
    rev, action = parts[1], parts[2]
    if str(flow.get("revision")) != str(rev):
        return render(data, user)
    if action == "h":
        flow["history"] = []
        return goto(data, user, "HOME", remember=False)
    if action == "b":
        prev = flow["history"].pop() if flow["history"] else "HOME"
        flow["state"] = prev
        flow["revision"] = int(flow.get("revision") or 1) + 1
        return render(data, user)
    try:
        index = int(action)
    except ValueError:
        return render(data, user)
    state = states().get(flow["state"]) or {}
    buttons = _visible_buttons(data, user, state)
    if index < 0 or index >= len(buttons):
        return render(data, user)
    button = buttons[index]
    nxt = button[1]
    patch = button[2] if len(button) > 2 and isinstance(button[2], dict) else {}
    _apply_patch(flow, flow["state"], nxt, patch)
    if nxt == "ENTRY_VIEW":
        entry_id = patch.get("_entry_id")
        owned = next((item for item in operations.logs_for(data, user) if item.get("id") == entry_id), None)
        if not owned:
            return render(data, user)
        user["selected_entry_id"] = owned["id"]
        flow["draft"]["selected_entry_id"] = owned["id"]
    if nxt == "TASK":
        task_id = patch.get("_task_id") or user.get("selected_task_id")
        owned_task = next((item for item in data.get("next_actions", []) if item.get("id") == task_id and item.get("user_id") == user["id"]), None)
        if patch.get("_task_id") and not owned_task:
            return render(data, user)
        if owned_task:
            user["selected_task_id"] = owned_task["id"]
    today = storage.today()
    selected = flow["draft"].get("local_date") or flow["draft"].get("selected_date") or today
    if nxt in {"ACTIVITY", "REST"} and selected > today:
        return render(data, user)
    if nxt == "HELP":
        flow["draft"]["resume_target"] = "REVIEW" if operations.has_saveable_draft(user) else "HOME"
    if flow["state"] == "HELP" and nxt == "REVIEW":
        nxt = flow["draft"].get("resume_target") or "REVIEW"
    if nxt == "PLUS":
        flow["draft"]["plus_origin"] = flow["state"]
    if nxt == "ACTIVITY" and flow["draft"].get("selected_date"):
        flow["draft"]["local_date"] = flow["draft"]["selected_date"]
    return goto(data, user, nxt)


def _handle_calendar(data, user, callback_data):
    flow = session(user)
    parts = str(callback_data).split(":")
    if len(parts) < 3:
        return render(data, user)
    action = ":".join(parts[2:])
    now = _local_now(user).date()
    year = int(flow["draft"].get("cal_year") or now.year)
    month = int(flow["draft"].get("cal_month") or now.month)
    if action in {"noop", "hdr"}:
        return render(data, user)
    if action == "prev":
        year, month = calendar_view.shift_month(year, month, -1)
        flow["draft"]["cal_year"] = year
        flow["draft"]["cal_month"] = month
        return goto(data, user, "CALENDAR", remember=False)
    if action == "next":
        year, month = calendar_view.shift_month(year, month, 1)
        flow["draft"]["cal_year"] = year
        flow["draft"]["cal_month"] = month
        return goto(data, user, "CALENDAR", remember=False)
    if action == "today":
        flow["draft"]["selected_date"] = now.isoformat()
        return goto(data, user, "DAY")
    try:
        chosen = dt.date.fromisoformat(action)
    except ValueError:
        return render(data, user)
    flow["draft"]["selected_date"] = chosen.isoformat()
    if chosen > now:
        flow["draft"]["local_date"] = chosen.isoformat()
        return goto(data, user, "TASK_TEXT")
    return goto(data, user, "DAY")


def handle_input(data, user, text):
    flow = session(user)
    spec_input = flow.get("await_input")
    if not spec_input:
        return None
    field = spec_input.get("field")
    kind = spec_input.get("kind")
    nxt = spec_input.get("next")
    value = (text or "").strip()
    if kind == "text" and field == "city_query":
        zone = _resolve_city(value)
        if zone:
            flow["draft"]["timezone"] = zone
            flow["draft"]["timezone_label"] = f"{value}: {zone}"
        else:
            flow["draft"].pop("timezone", None)
            flow["draft"]["timezone_label"] = "Не удалось определить пояс"
        flow["draft"]["city_query"] = value
        return goto(data, user, nxt)
    if kind == "past_or_today_date":
        parsed = _parse_date(value)
        if not parsed or parsed > dt.date.today():
            return "Нужна сегодняшняя или прошедшая дата. Например, 05.09.2026.", menus.keyboard([[menus.button("Меню", f"v:{flow['revision']}:h")]])
        flow["draft"]["local_date"] = parsed.isoformat()
        return goto(data, user, nxt)
    if kind == "today_or_future_date":
        parsed = _parse_date(value)
        if not parsed or parsed < dt.date.today():
            return "Нужна сегодняшняя или будущая дата. Например, 07.09.2026.", menus.keyboard([[menus.button("Меню", f"v:{flow['revision']}:h")]])
        flow["draft"]["task_date"] = parsed.isoformat()
        return goto(data, user, nxt)
    if kind == "future_local_datetime":
        parsed = _parse_datetime(value, user.get("timezone"))
        if not parsed:
            return "Не понял дату и время. Пример: 07.09.2026 18:30.", menus.keyboard([[menus.button("Меню", f"v:{flow['revision']}:h")]])
        flow["draft"]["task_due_iso"] = parsed.astimezone(dt.timezone.utc).isoformat()
        flow["draft"]["task_due_display"] = parsed.strftime("%d.%m.%Y %H:%M")
        flow["draft"]["task_due"] = flow["draft"]["task_due_display"]
        return goto(data, user, nxt)
    if kind in {"private_short_text", "private_text", "redactable_text"}:
        flow["draft"][field] = value[:500]
        if field == "task_text":
            flow["draft"]["discard_task_draft"] = False
        return goto(data, user, nxt)
    if kind == "local_time":
        flow["draft"][field] = value
        return goto(data, user, nxt)
    if kind == "local_time_range":
        flow["draft"][field] = value
        return goto(data, user, nxt)
    return None


def _resolve_city(text):
    raw = (text or "").strip().lower().replace("ё", "е")
    if raw in CITY_TZ:
        return CITY_TZ[raw]
    if "/" in raw:
        try:
            ZoneInfo(text.strip())
            return text.strip()
        except Exception:
            return None
    for name, zone in CITY_TZ.items():
        if name in raw:
            return zone
    return None


def _parse_date(text):
    for fmt in ("%d.%m.%Y", "%Y-%m-%d", "%d.%m.%y"):
        try:
            return dt.datetime.strptime(text.strip(), fmt).date()
        except ValueError:
            continue
    return None


def _parse_datetime(text, timezone_name):
    raw = (text or "").strip()
    for fmt in ("%d.%m.%Y %H:%M", "%Y-%m-%d %H:%M"):
        try:
            local = dt.datetime.strptime(raw, fmt)
            zone = ZoneInfo(timezone_name or "UTC")
            return local.replace(tzinfo=zone)
        except ValueError:
            continue
    return None


def start(data, user):
    session(user)
    user["flow"]["history"] = []
    user["flow"]["state"] = "START"
    return render(data, user)