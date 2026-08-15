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

## Круглосуточная работа (без вашего ПК)

Бот должен крутиться на сервере в облаке. Самый простой вариант — [Railway](https://railway.app).

### Railway (рекомендуется)

1. Зарегистрируйтесь на [railway.app](https://railway.app) (можно через GitHub).
2. **New Project** → **Deploy from GitHub repo** → выберите этот репозиторий.
3. В настройках сервиса укажите **Root Directory**: `telegram_bot`.
4. **Variables** → добавьте:
   - `TELEGRAM_TOKEN` = токен от @BotFather
5. Дождитесь деплоя — бот запустится сам и будет работать, пока сервис включён.

Ваш компьютер при этом может быть выключен.

### Docker (любой VPS)

```bash
cd telegram_bot
docker build -t telegram-bot .
docker run -d --restart unless-stopped -e TELEGRAM_TOKEN="ваш_токен" telegram-bot
```

Подходит для Timeweb, Selectel, DigitalOcean, Oracle Cloud Free Tier и т.п.

## Файлы

- `bot.py` — код бота
- `requirements.txt` — зависимости
- `Dockerfile` — образ для облака / VPS
- `railway.toml` — настройки для Railway
- `.env.example` — пример переменных окружения
- `.gitignore` — игнорирует `.env` и виртуальное окружение
