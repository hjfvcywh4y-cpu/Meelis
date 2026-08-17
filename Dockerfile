FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY telegram_bot/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY telegram_bot/bot.py telegram_bot/lessons.py telegram_bot/stats.py .
CMD ["python", "bot.py"]
