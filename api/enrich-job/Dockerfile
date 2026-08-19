# python:3.12-slim-bookworm épinglé par digest (L7, 2026-08-19) — mise à jour
# uniquement par PR explicite.
FROM python:3.12-slim-bookworm@sha256:a116514e19457bcb7af7efe9c3dd0b9b71e85b317694e7882a1c52aa15a78134
RUN useradd -u 10001 -m appuser
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
USER 10001
CMD ["python", "main.py"]
