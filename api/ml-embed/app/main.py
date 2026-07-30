import os
import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="MENAL ML Embed", version="0.1.0")

class EmbedRequest(BaseModel):
    text: str

class EmbedResponse(BaseModel):
    vector: list[float]
    dimensions: int
    model_version: str = "mock-v0.1"

@app.post("/embed")
def embed(req: EmbedRequest):
    rng = np.random.RandomState(hash(req.text) % (2**31))
    vec = rng.randn(600).astype(np.float64).tolist()
    return EmbedResponse(vector=vec, dimensions=600)

@app.get("/health")
def health():
    return {"status": "ok", "service": "menal-ml-embed"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)
