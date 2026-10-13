# syntax=docker/dockerfile:1

FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Dependencies are installed before the source is copied so an edit to the
# application code does not invalidate the (slow) pip layer.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# The model directory is bind-mounted in development; create it so the service
# can write freshly trained artefacts here.
RUN mkdir -p /app/models && useradd --create-home --uid 10001 ml \
    && chown -R ml:ml /app
USER ml

EXPOSE 8000

# One worker: the models are loaded into memory once, and scikit-learn
# prediction does not benefit from multiple processes per container.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
