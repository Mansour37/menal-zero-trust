FROM python:3.12-slim AS base
RUN useradd -u 10001 -m appuser
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Model weights embedded at build time.
# To include the real model: copy model directory and pass --build-arg WITH_MODEL=true
# (build/export_and_precompute.py produces models/attack-bert-onnx/ + MODEL.sha256)
ARG WITH_MODEL=false
COPY models/attack-bert-onnx/ /app/model/
RUN if [ "$WITH_MODEL" = "true" ]; then \
        cd /app/model && \
        sha256sum -c MODEL.sha256 --quiet && \
        echo "Model integrity verified"; \
    else \
        echo "No model weights embedded — app will use mock fallback"; \
    fi

COPY app/ /app/app/

ENV HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 OMP_NUM_THREADS=1
ENV MODEL_DIR=/app/model
USER 10001
EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
