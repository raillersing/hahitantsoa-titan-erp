# syntax=docker/dockerfile:1.7

FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml /app/
COPY backend/config/ /app/backend/config/

RUN --mount=type=cache,target=/root/.cache/pip \
    python -m pip install --upgrade pip \
    && python -m pip install -e ".[dev]"

COPY backend/ /app/backend/
COPY tests/ /app/tests/
COPY scripts/ /app/scripts/

CMD ["python", "backend/manage.py", "runserver", "0.0.0.0:8000"]
