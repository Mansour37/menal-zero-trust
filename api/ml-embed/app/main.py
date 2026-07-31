import hashlib
import os

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

MODEL_DIR = os.getenv("MODEL_DIR", "/app/model")
MODEL_VERSIONS = {
    "attack-bert-onnx-int8": "attack-bert-onnx-int8@v1.0",
}
MAX_TOKENS = 512
MAX_BATCH = 64
MAX_TEXT_LENGTH = 8000

app = FastAPI(title="menal-ml-embed", version="1.0.0", docs_url=None, redoc_url=None)

try:
    from optimum.onnxruntime import ORTModelForFeatureExtraction
    from transformers import AutoTokenizer

    tok = AutoTokenizer.from_pretrained(MODEL_DIR)
    model = ORTModelForFeatureExtraction.from_pretrained(MODEL_DIR)
    model_version = MODEL_VERSIONS.get("attack-bert-onnx-int8", "unknown")
    model_loaded = True
except Exception as e:
    print(f"[WARN] Model not loaded, using mock fallback: {e}")
    tok = None
    model = None
    model_version = "mock-fallback-v0.1"
    model_loaded = False


def mean_pool(last_hidden: np.ndarray, mask: np.ndarray) -> np.ndarray:
    mask_expanded = np.expand_dims(mask, -1).astype(np.float32)
    return (last_hidden * mask_expanded).sum(1) / np.clip(mask_expanded.sum(1), 1e-9, None)


def encode(texts: list[str]) -> tuple[np.ndarray, list[str]]:
    if model_loaded and tok is not None and model is not None:
        enc = tok(texts, padding=True, truncation=True, max_length=MAX_TOKENS, return_tensors="np")
        out = model(**enc)
        vectors = mean_pool(out.last_hidden_state, enc["attention_mask"])
        vectors = vectors / np.clip(np.linalg.norm(vectors, axis=1, keepdims=True), 1e-9, None)
    else:
        rng = np.random.RandomState(42)
        vectors = np.array([rng.randn(768).astype(np.float64) for _ in texts])
        vectors = vectors / np.clip(np.linalg.norm(vectors, axis=1, keepdims=True), 1e-9, None)
    input_hashes = [hashlib.sha256(t.encode()).hexdigest() for t in texts]
    return vectors, input_hashes


class EmbedRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1, max_length=MAX_BATCH)


class EmbedItem(BaseModel):
    input_hash: str
    embedding: list[float]


class EmbedResponse(BaseModel):
    model_version: str
    dim: int
    items: list[EmbedItem]


@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest):
    texts = [t[:MAX_TEXT_LENGTH] for t in req.texts]
    if not any(t.strip() for t in texts):
        raise HTTPException(400, "All texts are empty")
    vectors, hashes = encode(texts)
    return EmbedResponse(
        model_version=model_version,
        dim=int(vectors.shape[1]),
        items=[
            EmbedItem(input_hash=h, embedding=vec.tolist())
            for h, vec in zip(hashes, vectors)
        ],
    )


class HealthResponse(BaseModel):
    status: str
    service: str
    model_version: str
    model_loaded: bool


@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(
        status="ok",
        service="menal-ml-embed",
        model_version=model_version,
        model_loaded=model_loaded,
    )
