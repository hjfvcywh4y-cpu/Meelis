# Telegram-бот + Google Gemini (бесплатный API)

Бот отвечает через [Gemini API](https://ai.google.dev/) (OpenAI-compatible endpoint).

## Возможности

- текстовый чат с Gemini (с памятью диалога)
- `/start` — приветствие
- `/help` — список команд
- `/clear` — очистить историю
- `/ping` — проверка работоспособности

## Быстрый старт

1. Токен бота от [@BotFather](https://t.me/BotFather).
2. Бесплатный ключ Gemini: [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
3. Установите зависимости:

```bash
cd telegram_bot
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

4. Настройте переменные:

```bash
cp .env.example .env
# TELEGRAM_TOKEN=...
# GEMINI_API_KEY=...
```

5. Запустите:

```bash
python bot.py
```

## Круглосуточная работа (без вашего ПК)

Самый простой вариант — [Railway](https://railway.app).

1. New Project → Deploy from GitHub repo.
2. Root Directory: `telegram_bot`.
3. Variables:
   - `TELEGRAM_TOKEN`
   - `GEMINI_API_KEY`
4. Дождитесь деплоя.

### Docker

```bash
cd telegram_bot
docker build -t telegram-bot .
docker run -d --restart unless-stopped \
  -e TELEGRAM_TOKEN="ваш_токен" \
  -e GEMINI_API_KEY="ваш_ключ" \
  telegram-bot
```

## Файлы

- `bot.py` — код бота
- `requirements.txt` — зависимости
- `Dockerfile` — образ для облака / VPS
- `railway.toml` — настройки для Railway
- `.env.example` — пример переменных окружения
