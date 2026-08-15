# Telegram-бот-наставник по нейросетям

Учит пользоваться ИИ с нуля: выбор из 15 нейросетей, установка, использование,
промпты, текст/картинки/видео. Свободные вопросы: сначала Gemini, при сбое — Groq.

## Для канала

В посте укажите ссылку на бота:

```text
https://t.me/lDera_bot
```

или `@lDera_bot`. Люди нажимают ссылку → **Start** → видят приветствие и меню выбора.

В @BotFather полезно задать:
- `/setdescription` — короткое описание
- `/setabouttext` — «О боте»
- `/setuserpic` — аватар

## Возможности

После `/start`:
1. Выбор нейросети (15 шт.)
2. Текст / картинки / видео
3. Урок по промптам
4. Как общаться с ИИ
5. Спросить наставника (Gemini)

У каждой нейросети: установка → использование → пример промпта.

## Запуск

```bash
cd telegram_bot
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # TELEGRAM_TOKEN + GEMINI_API_KEY
python bot.py
```

## Переменные

- `TELEGRAM_TOKEN` — от @BotFather
- `GEMINI_API_KEY` — https://aistudio.google.com/apikey
- `GROQ_API_KEY` — запасной, https://console.groq.com/keys
