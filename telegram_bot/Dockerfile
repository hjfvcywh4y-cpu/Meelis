FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY bot.py menus.py bad_quiz.py stats.py lessons.py visitka.py ai_prompt.py qual_card.py pdf_preview.py ./
COPY assets ./assets
COPY docs ./docs
# Force rebuild: qualification result is a PDF document, not a chat photo.
ENV QUAL_CARD_PDF_ONLY=1
CMD ["python", "bot.py"]
