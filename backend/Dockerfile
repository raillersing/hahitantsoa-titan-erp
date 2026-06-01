FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY pyproject.toml /app/
COPY backend/ /app/backend/

RUN python -m pip install --upgrade pip \
    && python -m pip install --no-cache-dir -e .

CMD ["python", "backend/manage.py", "runserver", "0.0.0.0:8000"]
