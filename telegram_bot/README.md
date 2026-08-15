# Telegram-бот

Простой бот на [python-telegram-bot](https://github.com/python-telegram-bot/python-telegram-bot).

## Возможности

- `/start` — приветствие
- `/help` — список команд
- `/ping` — проверка работоспособности
- `/echo <текст>` — повторить текст
- обычные сообщения — эхо

## Быстрый старт

1. Создайте бота у [@BotFather](https://t.me/BotFather) и получите токен.
2. Установите зависимости:

```bash
cd telegram_bot
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

3. Настройте токен:

```bash
cp .env.example .env
# отредактируйте .env и вставьте TELEGRAM_TOKEN
```

Или экспортируйте переменную окружения:

```bash
export TELEGRAM_TOKEN="ваш_токен"
```

4. Запустите:

```bash
python bot.py
```

## Файлы

- `bot.py` — код бота
- `requirements.txt` — зависимости
- `.env.example` — пример переменных окружения
- `.gitignore` — игнорирует `.env` и виртуальное окружение
