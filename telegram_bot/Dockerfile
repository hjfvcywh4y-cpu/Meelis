FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY bot.py menus.py bad_quiz.py stats.py lessons.py ./
COPY assets ./assets
COPY docs ./docs

CMD ["python", "bot.py"]
