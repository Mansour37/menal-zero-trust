import hashlib
import os

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

MODEL_DIR = os.getenv("MODEL_DIR", "/app/model")
ENVIRONMENT = os.getenv("ENVIRONMENT", "dev")
MAX_TOKENS = 512
MAX_BATCH = 64
MAX_TEXT_LENGTH = 8000

app = FastAPI(title="menal-ml-embed", version="1.0.0", docs_url=None, redoc_url=None)

try:
    import onnxruntime as ort
    from transformers import AutoTokenizer

    tok = AutoTokenizer.from_pretrained(MODEL_DIR)
    model = ort.InferenceSession(
        os.path.join(MODEL_DIR, "model.onnx"), providers=["CPUExecutionProvider"]
    )
    _input_names = {i.name for i in model.get_inputs()}
    # VERSION est ecrit par build/export_and_precompute.py — la meme valeur que
    # celle inscrite dans les lignes attack_embeddings du catalogue.
    _version_path = os.path.join(MODEL_DIR, "VERSION")
    if os.path.exists(_version_path):
        with open(_version_path, encoding="utf-8") as _vf:
            model_version = _vf.read().strip() or "unknown"
    else:
        model_version = "unknown"
    model_loaded = True
except Exception as e:
    # Le repli mock n existe QUE pour dev : des embeddings aleatoires passent
    # quand meme par VECTOR_SEARCH, qui renvoie toujours un meilleur candidat —
    # certains franchiraient le seuil et seraient ecrits comme mappings MITRE
    # valides. Hors dev, on refuse de demarrer : la startup probe echoue et la
    # revision precedente (avec modele) garde le trafic.
    if ENVIRONMENT != "dev":
        raise
    print(f"[WARN] Model not loaded, using mock fallback: {e}")
    tok = None
    model = None
    _input_names = set()
    model_version = "mock-fallback-v0.1"
    model_loaded = False


def mean_pool(last_hidden: np.ndarray, mask: np.ndarray) -> np.ndarray:
    mask_expanded = np.expand_dims(mask, -1).astype(np.float32)
    return (last_hidden * mask_expanded).sum(1) / np.clip(mask_expanded.sum(1), 1e-9, None)


def encode(texts: list[str]) -> tuple[np.ndarray, list[str]]:
    if model_loaded and tok is not None and model is not None:
        enc = tok(texts, padding=True, truncation=True, max_length=MAX_TOKENS, return_tensors="np")
        feed = {k: v.astype(np.int64) for k, v in enc.items() if k in _input_names}
        (last_hidden,) = model.run(["last_hidden_state"], feed)
        vectors = mean_pool(last_hidden, enc["attention_mask"])
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
