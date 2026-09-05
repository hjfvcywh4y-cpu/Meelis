TRACKS = [
    "onboarding",
    "first_contact",
    "return_to_conversation",
    "presentation",
    "objection_handling",
    "customer_care",
    "duplication",
    "time_management",
    "personal_brand",
    "team_invitation",
    "weekly_planning",
    "metrics_basics",
    "fear_of_action",
    "return_to_rhythm",
    "mentor_team",
]
ACTIONS = {
    "warm_touch": "Одно теплое касание знакомому человеку",
    "five_min_contact": "5 минут на один контакт",
    "micro_step": "Микрошаг без давления",
    "return_one": "Вернуться к одному разговору",
    "review_presentation": "Разобрать одну презентацию без давления на продажу",
    "choose_return_time": "Выбрать время, когда спокойно вернуться к разговору",
    "repeat_action": "Повторить одно рабочее действие",
    "scale_gently": "Добавить один контакт сверх привычного ритма",
    "simple_touch": "5 минут на одно простое касание",
    "open_basic_track": "Открыть базовый материал",
    "one_followup": "Сделать один возврат к разговору",
    "next_contact": "Следующий контакт",
    "choose_date": "Выбрать дату возврата к разговору",
}
RULE_META = {
    "id",
    "priority",
    "state_code",
    "bottleneck_code",
    "action_template_id",
    "track_code",
    "reminder_kind",
    "mentor_signal",
    "version",
    "active",
}
RULES = [
    {
        "id": 1,
        "priority": 100,
        "action_done": False,
        "barrier_code": "fear",
        "state_code": "stuck_fear",
        "bottleneck_code": "fear",
        "action_template_id": "warm_touch",
        "track_code": "first_contact",
        "version": 1,
        "active": True,
    },
    {
        "id": 2,
        "priority": 95,
        "action_done": False,
        "barrier_code": "time",
        "state_code": "stuck_time",
        "bottleneck_code": "time",
        "action_template_id": "five_min_contact",
        "track_code": "weekly_planning",
        "version": 1,
        "active": True,
    },
    {
        "id": 3,
        "priority": 90,
        "action_done": False,
        "barrier_code": "energy",
        "state_code": "low_energy",
        "bottleneck_code": "energy",
        "action_template_id": "micro_step",
        "track_code": "return_to_rhythm",
        "version": 1,
        "active": True,
    },
    {
        "id": 4,
        "priority": 85,
        "action_done": True,
        "result_code": "no_response",
        "state_code": "active_no_response",
        "bottleneck_code": "conversion",
        "action_template_id": "return_one",
        "track_code": "return_to_conversation",
        "version": 1,
        "active": True,
    },
    {
        "id": 5,
        "priority": 80,
        "action_done": True,
        "action_type": "presentation",
        "result_not": "sale",
        "state_code": "conversion_gap",
        "bottleneck_code": "presentation",
        "action_template_id": "review_presentation",
        "track_code": "presentation",
        "version": 1,
        "active": True,
    },
    {
        "id": 6,
        "priority": 70,
        "return_needed": True,
        "state_code": "return_needed",
        "bottleneck_code": "follow_up",
        "action_template_id": "choose_return_time",
        "track_code": "return_to_conversation",
        "reminder_kind": "return_to_conversation",
        "version": 1,
        "active": True,
    },
    {
        "id": 7,
        "priority": 65,
        "action_done": True,
        "result_code": "positive",
        "state_code": "progress",
        "bottleneck_code": "scaling",
        "action_template_id": "next_contact",
        "version": 1,
        "active": True,
    },
    {
        "id": 8,
        "priority": 10,
        "state_code": "stable",
        "bottleneck_code": "none",
        "action_template_id": "repeat_action",
        "version": 1,
        "active": True,
    },
]


def matches(rule, payload):
    if rule.get("active") is False:
        return False
    for key, value in rule.items():
        if key in RULE_META:
            continue
        if key == "result_not":
            if payload.get("result_code") == value:
                return False
            continue
        if payload.get(key) != value:
            return False
    return True


def route(payload):
    payload = dict(payload)
    if "return_needed" not in payload and "follow_up_needed" in payload:
        payload["return_needed"] = payload.get("follow_up_needed")
    for rule in sorted(RULES, key=lambda item: (-item["priority"], item["id"])):
        if matches(rule, payload):
            return rule
    return RULES[-1]


def repeated_barrier(logs, barrier_code, times=3):
    if not barrier_code or barrier_code == "none":
        return False
    recent = sorted(logs, key=lambda item: item.get("local_date") or "")[-7:]
    return sum(1 for item in recent if item.get("barrier_code") == barrier_code) >= times


def active_days_this_week(logs):
    recent = sorted(logs, key=lambda item: item.get("local_date") or "")[-7:]
    return len({item.get("local_date") for item in recent if item.get("action_done")})