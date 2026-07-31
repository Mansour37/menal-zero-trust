FROM python:3.12-slim-bookworm
RUN useradd -u 10001 -m appuser
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
USER 10001
CMD ["python", "main.py"]
