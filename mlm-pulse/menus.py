BOT_NAME = "MLM Pulse"
SAVVY_TECH_URL = "https://savv.tech"
MLM_ACADEMY_URL = "https://mlmacademy.ru/"
BOT_DESCRIPTION = (
    "MLM Pulse — дружелюбный дневник сетевика. "
    "Помогает отмечать действия, не терять договоренности и спокойно двигаться дальше."
)
BOT_SHORT_DESCRIPTION = "Дружелюбный дневник сетевика."
COMMANDS = {
    "/start": "запустить дневник",
    "/menu": "главное меню",
    "/help": "помощь",
    "/pulse": "записать действие",
    "/today": "сегодня",
    "/report": "итоги недели",
    "/settings": "настройки",
}
START_NOTES = (
    "Не ищите идеальное сообщение. Выберите одного знакомого и искренне спросите, как у него дела. Хорошая работа в сети начинается с живого внимания, а не с заученного текста.",
    "Пауза не отменяет ваш путь. Не нужно догонять все сразу: достаточно одного простого действия сегодня.",
    "Сильный разговор начинается не с презентации. Сначала человеку важно почувствовать, что его услышали.",
    "Не все ответы приходят быстро, и это нормально. Ваша задача не давить, а вовремя и по-человечески вернуться к разговору.",
    "Регулярность не выглядит героически. Чаще всего это один звонок, одно сообщение или одна встреча, сделанные спокойно и вовремя.",
)
LANGUAGE_OPTIONS = {"lang_ru": "ru", "lang_en": "en"}
TIMEZONE_OPTIONS = {
    "tz_msk": "Europe/Moscow",
    "tz_nsk": "Asia/Novosibirsk",
    "tz_ekb": "Asia/Yekaterinburg",
    "tz_other": "UTC",
}
EXPERIENCE_OPTIONS = {
    "exp_new": "Новичок",
    "exp_first": "Есть первые действия",
    "exp_team": "Есть команда",
    "exp_return": "Возвращаюсь после паузы",
}
GOAL_OPTIONS = {
    "goal_contacts": "Контакты",
    "goal_followup": "Вернуться к тем, с кем уже общались",
    "goal_sales": "Продажи",
    "goal_team": "Команда",
    "goal_regular": "Регулярность",
}
ONBOARDING_BARRIER_OPTIONS = {
    "ob_fear": "fear",
    "ob_system": "no_system",
    "ob_time": "time",
    "ob_response": "no_response",
    "ob_skill": "skill",
    "ob_energy": "energy",
}
REMINDER_OPTIONS = {
    "rem_morning": "morning",
    "rem_day": "day",
    "rem_evening": "evening",
    "rem_off": "off",
}
ACTION_TYPE_OPTIONS = {
    "ci_type_first_contact": "first_contact",
    "ci_type_return": "return_conversation",
    "ci_type_presentation": "presentation",
    "ci_type_post": "post",
    "ci_type_call": "call",
    "ci_type_meeting": "meeting",
    "ci_type_learning": "learning",
    "ci_type_care": "customer_care",
}
ACTION_TYPE_LABELS = {
    "first_contact": "Первый контакт",
    "return_conversation": "Вернуться к прежнему разговору",
    "presentation": "Презентация",
    "post": "Пост/сторис",
    "call": "Звонок",
    "meeting": "Встреча",
    "learning": "Обучение",
    "customer_care": "Забота о клиенте",
}
RESULT_OPTIONS = {
    "ci_result_positive": "positive",
    "ci_result_no_response": "no_response",
    "ci_result_refusal": "refusal",
    "ci_result_scheduled": "scheduled",
    "ci_result_sale": "sale",
    "ci_result_new_partner": "new_partner",
    "ci_result_blocked": "blocked",
}
RESULT_LABELS = {
    "positive": "Положительный ответ",
    "no_response": "Нет ответа",
    "refusal": "Отказ",
    "scheduled": "Назначено",
    "sale": "Продажа",
    "new_partner": "Новый партнер",
    "blocked": "Застрял",
}
BARRIER_OPTIONS = {
    "ci_barrier_fear": "fear",
    "ci_barrier_time": "time",
    "ci_barrier_energy": "energy",
    "ci_barrier_skill": "skill",
    "ci_barrier_follow_up": "follow_up",
    "ci_barrier_no_system": "no_system",
    "ci_barrier_no_response": "no_response",
    "ci_barrier_none": "none",
}
BARRIER_LABELS = {
    "fear": "Страх писать",
    "time": "Нет времени",
    "energy": "Нет энергии",
    "skill": "Не знаю что говорить",
    "follow_up": "Забываю вернуться к людям",
    "no_system": "Нет системы",
    "no_response": "Нет отклика",
    "none": "Не было тупника",
}
STATE_LABELS = {
    "stuck_fear": "Страх действия",
    "stuck_time": "Не хватает времени",
    "low_energy": "Мало энергии",
    "active_no_response": "Есть действия, мало ответа",
    "conversion_gap": "Есть разговоры, мало результата",
    "return_needed": "Нужен возврат к разговору",
    "progress": "Прогресс",
    "stable": "Стабильно",
    "overload": "Перегруз",
    "support_needed": "Нужна поддержка",
    "active": "Есть активность",
}
BARRIER_TIPS = {
    "fear": "Начните с одного теплого сообщения человеку, с которым уже есть контакт.",
    "skill": "Не пытайтесь сказать идеально. Спросите человека, что для него сейчас важно.",
    "follow_up": "Выберите одного человека и спокойно договоритесь с собой, когда вернетесь к разговору.",
    "time": "Выберите одно действие на пять минут. Регулярность начинается именно так.",
    "energy": "Сегодня достаточно маленького шага. Не нужно догонять весь мир за один вечер.",
    "no_system": "Зафиксируйте один следующий шаг и время, когда вы его сделаете.",
    "no_response": "Не давите. Вернитесь к одному человеку коротко и по-человечески.",
}
TRACK_BY_BARRIER = {
    "fear": "first_contact",
    "skill": "first_contact",
    "follow_up": "return_to_conversation",
    "no_response": "return_to_conversation",
    "time": "weekly_planning",
    "energy": "return_to_rhythm",
    "no_system": "weekly_planning",
}
SCRIPT_FIRST_CONTACT = (
    "Привет. Думал(а) о тебе и захотел(а) просто спросить, как у тебя сейчас дела. "
    "Без повестки и презентации — мне важно услышать тебя."
)
SCRIPT_RETURN = (
    "Привет. Мы недавно говорили, и я не хочу терять нить. "
    "Как тебе сейчас удобнее продолжить: коротко в переписке или созвониться?"
)
PAYWALL_TEXT = (
    "Базовый дневник остается доступен. PLUS открывает месячную картину, PDF, инструменты и персональные подсказки."
)


def keyboard(rows):
    return {"inline_keyboard": rows}


def button(text, data=None, url=None):
    item = {"text": text}
    if url:
        item["url"] = url
    else:
        item["callback_data"] = data
    return item


def main_menu():
    return keyboard(
        [
            [button("Начать", "start_onboarding"), button("Отметить день", "pulse")],
            [button("Сегодня", "today"), button("Отчет за неделю", "report")],
            [button("Спросить помощника", "ai_ask")],
            [button("Настройки", "settings"), button("О боте", "about")],
        ]
    )


def menu_only():
    return keyboard([[button("Меню", "menu")]])


def today_keyboard():
    return keyboard(
        [
            [button("Отметить день", "pulse"), button("Выполнил действие", "action_done")],
            [button("Поставить напоминание", "set_reminder"), button("Получить подсказку", "get_tip")],
            [button("Меню", "menu")],
        ]
    )


def next_action_keyboard():
    return keyboard(
        [
            [button("Выполнено", "na_done"), button("Перенести", "na_later")],
            [button("Не получилось", "na_fail"), button("Нужен скрипт", "na_script")],
            [button("Нужна подсказка", "na_tip"), button("Меню", "menu")],
        ]
    )


def consent_keyboard():
    return keyboard([[button("Даю согласие", "consent_yes")], [button("О боте", "about")]])


def continue_keyboard(data="onboarding_continue"):
    return keyboard([[button("Продолжить", data)]])


def language_keyboard():
    return keyboard([[button("Русский", "lang_ru"), button("English", "lang_en")]])


def timezone_keyboard():
    return keyboard(
        [
            [button("Москва", "tz_msk"), button("Новосибирск", "tz_nsk")],
            [button("Екатеринбург", "tz_ekb"), button("Другой пояс", "tz_other")],
        ]
    )


def experience_keyboard():
    return keyboard(
        [
            [button("Новичок", "exp_new"), button("Есть первые действия", "exp_first")],
            [button("Есть команда", "exp_team"), button("Возвращаюсь после паузы", "exp_return")],
        ]
    )


def goal_keyboard():
    return keyboard(
        [
            [button("Новые знакомства", "goal_contacts"), button("Вернуться к людям", "goal_followup")],
            [button("Продажи", "goal_sales"), button("Команда", "goal_team")],
            [button("Регулярность", "goal_regular")],
        ]
    )


def onboarding_barrier_keyboard():
    return keyboard(
        [
            [button("Страх писать", "ob_fear"), button("Нет системы", "ob_system")],
            [button("Нет времени", "ob_time"), button("Нет отклика", "ob_response")],
            [button("Не знаю что говорить", "ob_skill"), button("Нет энергии", "ob_energy")],
        ]
    )


def reminder_keyboard():
    return keyboard(
        [
            [button("Утром", "rem_morning"), button("Днем", "rem_day")],
            [button("Вечером", "rem_evening"), button("Без напоминаний", "rem_off")],
        ]
    )


def checkin_action_keyboard():
    return keyboard([[button("Да", "ci_action_yes"), button("Нет", "ci_action_no")], [button("Меню", "menu")]])


def checkin_type_keyboard():
    return keyboard(
        [
            [button("Первый контакт", "ci_type_first_contact"), button("Вернуться к разговору", "ci_type_return")],
            [button("Презентация", "ci_type_presentation"), button("Пост/сторис", "ci_type_post")],
            [button("Звонок", "ci_type_call"), button("Встреча", "ci_type_meeting")],
            [button("Обучение", "ci_type_learning"), button("Забота о клиенте", "ci_type_care")],
        ]
    )


def checkin_result_keyboard():
    return keyboard(
        [
            [button("Положительный ответ", "ci_result_positive"), button("Нет ответа", "ci_result_no_response")],
            [button("Отказ", "ci_result_refusal"), button("Назначено", "ci_result_scheduled")],
            [button("Продажа", "ci_result_sale"), button("Новый партнер", "ci_result_new_partner")],
            [button("Застрял", "ci_result_blocked")],
        ]
    )


def checkin_barrier_keyboard():
    return keyboard(
        [
            [button("Страх писать", "ci_barrier_fear"), button("Нет времени", "ci_barrier_time")],
            [button("Нет энергии", "ci_barrier_energy"), button("Не знаю что говорить", "ci_barrier_skill")],
            [button("Забываю вернуться к людям", "ci_barrier_follow_up"), button("Нет системы", "ci_barrier_no_system")],
            [button("Нет отклика", "ci_barrier_no_response"), button("Тупника не было", "ci_barrier_none")],
        ]
    )


def checkin_follow_keyboard():
    return keyboard([[button("Да, поставить напоминание", "ci_follow_yes")], [button("Нет", "ci_follow_no")]])


def return_when_keyboard():
    return keyboard(
        [
            [button("Сегодня вечером", "ci_when_today")],
            [button("Завтра", "ci_when_tomorrow")],
            [button("Меню", "menu")],
        ]
    )


def difficulty_keyboard():
    return keyboard([[button(str(score), f"ci_diff_{score}") for score in range(1, 6)]])


def mentor_keyboard():
    return keyboard([[button("Да", "ci_mentor_yes"), button("Нет", "ci_mentor_no")]])


def note_keyboard():
    return keyboard([[button("Пропустить", "ci_note_skip")], [button("Меню", "menu")]])


def settings_keyboard():
    return keyboard(
        [
            [button("Язык", "set_lang"), button("Часовой пояс", "set_tz")],
            [button("Напоминания", "set_rem"), button("Цель на 30 дней", "set_goal")],
            [button("Приватность", "set_privacy"), button("Экспорт данных", "set_export")],
            [button("Удалить мои данные", "set_delete"), button("Подписка", "subscription")],
            [button("Меню", "menu")],
        ]
    )


def tools_keyboard():
    return keyboard(
        [
            [button("Скрипт первого контакта", "tool_first")],
            [button("Текст, чтобы вернуться к разговору", "tool_return")],
            [button("Визитка партнера", "tool_card")],
            [button("PDF-отчет", "tool_pdf")],
            [button("Меню", "menu")],
        ]
    )


def paywall_keyboard():
    return keyboard(
        [
            [button("Подключить PLUS", "plus_connect")],
            [button("Что входит", "plus_what")],
            [button("Остаться в базовой версии", "plus_stay")],
        ]
    )


def delete_keyboard():
    return keyboard([[button("Да, удалить", "delete_yes")], [button("Отмена", "menu")]])


def start_text(note):
    return (
        f"Привет, я {BOT_NAME}. Я рядом, чтобы сетевой не превращался в бесконечный список мыслей: "
        "кому написать, кому ответить и с чего начать.\n\n"
        "Каждый день я задам пару простых вопросов. Так мы увидим, что уже получается, "
        "где разговоры останавливаются и какой небольшой шаг вернет движение.\n\n"
        f"{note}\n\n"
        "Я буду бережно напоминать о договоренностях, поддерживать после паузы и собирать вашу картину недели. "
        "Начнем спокойно."
    )


def about_text():
    return (
        f"{BOT_NAME} — спокойный напарник в ежедневной работе сетевика.\n\n"
        "Он не обещает доход и не заменяет наставника. "
        "Он помогает держать ритм, не терять договоренности и выбирать один следующий шаг.\n\n"
        f"Проект создан при поддержке MLM Academy и SavyTech.\n"
        f"{MLM_ACADEMY_URL}\nSavyTech: {SAVVY_TECH_URL}"
    )


def help_text():
    lines = ["Коротко, что нажимать:\n"]
    lines.extend(f"{command} — {label}" for command, label in COMMANDS.items())
    lines.append("\nКнопка «Меню» возвращает сюда из любого места.")
    return "\n".join(lines)


def onboarding_intro_text():
    return "Я помогу не терять договоренности, замечать свой прогресс и двигаться маленькими шагами."


def pulse_text():
    return (
        "Давайте коротко отметим день.\n\n"
        "Было ли сегодня рабочее действие: знакомство, возвращение к разговору, презентация, пост, звонок или встреча?"
    )