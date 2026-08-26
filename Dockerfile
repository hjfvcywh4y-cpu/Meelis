FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN apt-get update \
    && apt-get install -y --no-install-recommends fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
COPY telegram_bot/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY telegram_bot/bot.py telegram_bot/menus.py telegram_bot/bad_quiz.py telegram_bot/stats.py telegram_bot/lessons.py telegram_bot/visitka.py telegram_bot/ai_prompt.py telegram_bot/qual_card.py telegram_bot/pdf_preview.py ./
COPY telegram_bot/assets ./assets
COPY telegram_bot/docs ./docs
# Bust image cache so the qualification PNG download is in this image.
ENV QUAL_CARD_PNG=1
CMD ["python", "bot.py"]
