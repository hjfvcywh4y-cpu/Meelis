# Telegram-бот + DeepSeek

Бот отвечает через [DeepSeek API](https://api-docs.deepseek.com/) (OpenAI-compatible).

## Возможности

- текстовый чат с DeepSeek (с памятью диалога)
- `/start` — приветствие
- `/help` — список команд
- `/clear` — очистить историю
- `/ping` — проверка работоспособности

## Быстрый старт

1. Создайте бота у [@BotFather](https://t.me/BotFather) и получите токен.
2. Создайте API-ключ на [platform.deepseek.com](https://platform.deepseek.com).
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
# DEEPSEEK_API_KEY=...
```

5. Запустите:

```bash
python bot.py
```

## Круглосуточная работа (без вашего ПК)

Самый простой вариант — [Railway](https://railway.app).

1. Зарегистрируйтесь на [railway.app](https://railway.app) (можно через GitHub).
2. **New Project** → **Deploy from GitHub repo** → выберите этот репозиторий.
3. Root Directory: `telegram_bot`.
4. Variables:
   - `TELEGRAM_TOKEN` — токен от @BotFather
   - `DEEPSEEK_API_KEY` — ключ с platform.deepseek.com
5. Дождитесь деплоя.

### Docker (любой VPS)

```bash
cd telegram_bot
docker build -t telegram-bot .
docker run -d --restart unless-stopped \
  -e TELEGRAM_TOKEN="ваш_токен" \
  -e DEEPSEEK_API_KEY="ваш_ключ" \
  telegram-bot
```

## Файлы

- `bot.py` — код бота
- `requirements.txt` — зависимости
- `Dockerfile` — образ для облака / VPS
- `railway.toml` — настройки для Railway
- `.env.example` — пример переменных окружения
