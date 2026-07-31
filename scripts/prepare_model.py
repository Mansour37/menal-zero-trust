#!/usr/bin/env python3
"""
ATT&CK-BERT Model Preparation Script
======================================
Télécharge le modèle, vérifie safetensors, exporte ONNX int8, valide la quantisation.

Usage:
    python scripts/prepare_model.py

Prérequis:
    pip install "sentence-transformers" "optimum[onnxruntime]" "onnxruntime" "huggingface_hub"
"""

import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

MODEL_ID = "basel/ATTACK-BERT"
MODEL_DIR = Path("models/attack-bert")
ONNX_DIR = Path("models/attack-bert-onnx-int8")
SHA_FILE = Path("MODEL.sha256")


def step(msg):
    print(f"\n{'='*60}")
    print(f"  {msg}")
    print(f"{'='*60}")


def check_safetensors_only(model_dir: Path):
    step("Vérification : safetensors uniquement (refus du pickle)")
    unsafe = []
    for ext in ("*.bin", "*.pkl", "*.pt"):
        unsafe.extend(model_dir.rglob(ext))
    if unsafe:
        print(f"  ERREUR: Fichiers pickle détectés : {[str(p) for p in unsafe]}")
        print("  Les artefacts pickle sont refusés pour la sécurité de la chaîne d'approvisionnement.")
        sys.exit(1)
    safetensors = list(model_dir.rglob("*.safetensors"))
    print(f"  ✅ {len(safetensors)} fichiers safetensors trouvés, aucun pickle détecté")


def compute_sha256(model_dir: Path, output_file: Path):
    step("Calcul des empreintes SHA256")
    hashes = []
    for f in sorted(model_dir.rglob("*")):
        if f.is_file():
            h = hashlib.sha256(f.read_bytes()).hexdigest()
            rel = f.relative_to(model_dir.parent)
            hashes.append(f"{h}  {rel}")
    output_file.write_text("\n".join(hashes) + "\n")
    print(f"  ✅ {len(hashes)} fichiers hachés → {output_file}")


def export_onnx(model_dir: Path, output_dir: Path):
    step("Export ONNX + Quantisation int8")
    subprocess.run([
        sys.executable, "-c", f"""
from optimum.onnxruntime import ORTModelForFeatureExtraction
from optimum.onnxruntime.configuration import AutoQuantizationConfig
from optimum.onnxruntime import ORTQuantizer
from transformers import AutoTokenizer

import os
os.environ["HF_HUB_OFFLINE"] = "1"

SRC = r"{model_dir}"
DST = r"{output_dir}"

print("  Exporting ONNX from safetensors...")
model = ORTModelForFeatureExtraction.from_pretrained(SRC, export=True)
tok = AutoTokenizer.from_pretrained(SRC)
model.save_pretrained(DST)
tok.save_pretrained(DST)
print(f"  ONNX exported to {{DST}}")

print("  Quantizing to int8...")
qconfig = AutoQuantizationConfig.avx512_vnni(is_static=False, per_channel=True)
quantizer = ORTQuantizer.from_pretrained(DST)
quantizer.quantize(save_dir=DST, quantization_config=qconfig)
print(f"  Quantized ONNX saved to {{DST}}")
"""
    ], check=True)
    print(f"  ✅ ONNX int8 exporté → {output_dir}")


def validate_quantization(model_dir: Path, onnx_dir: Path):
    step("Validation de la quantisation (similarité > 0.99)")
    subprocess.run([
        sys.executable, "-c", f"""
import numpy as np
from optimum.onnxruntime import ORTModelForFeatureExtraction
from transformers import AutoTokenizer
import os
os.environ["HF_HUB_OFFLINE"] = "1"

test_phrases = [
    "Attacker takes a screenshot of the desktop",
    "Attacker enumerates IAM roles in the cloud",
    "Malicious process creates a new user account",
    "Attacker exfiltrates data via DNS tunneling",
    "PowerShell downloads and executes a remote script",
    "Attacker modifies Windows registry to establish persistence",
    "SQL injection on login endpoint",
    "Attacker scans for open ports on internal network",
    "Suspicious API call to Cloud KMS decrypt",
    "Attacker creates a new service account with admin privileges",
]

tok = AutoTokenizer.from_pretrained(r"{onnx_dir}")
# Load float32 model
model_fp32 = ORTModelForFeatureExtraction.from_pretrained(r"{model_dir}")
# Load int8 model (already quantized)
model_int8 = ORTModelForFeatureExtraction.from_pretrained(r"{onnx_dir}")

def mean_pool(out, mask):
    m = np.expand_dims(mask, -1).astype(np.float32)
    return (out * m).sum(1) / np.clip(m.sum(1), 1e-9, None)

def encode(model, texts):
    enc = tok(texts, padding=True, truncation=True, max_length=512, return_tensors="np")
    out = model(**enc)
    v = mean_pool(out.last_hidden_state, enc["attention_mask"])
    v = v / np.clip(np.linalg.norm(v, axis=1, keepdims=True), 1e-9, None)
    return v

vecs_fp32 = encode(model_fp32, test_phrases)
vecs_int8 = encode(model_int8, test_phrases)

cosines = np.sum(vecs_fp32 * vecs_int8, axis=1)
mean_sim = float(np.mean(cosines))
min_sim = float(np.min(cosines))

print(f"  Similarité moyenne : {mean_sim:.4f}")
print(f"  Similarité min     : {min_sim:.4f}")

if mean_sim > 0.99:
    print("  ✅ Quantisation validée (mean > 0.99)")
else:
    print("  ❌ Quantisation NON validée — seuil 0.99 non atteint")
    print("  Revenir à float32 ou ajuster la config de quantisation")
    sys.exit(1)
"""
    ], check=True)
    print("  ✅ Validation de quantisation réussie")


def main():
    step(f"1. Téléchargement du modèle {MODEL_ID}")
    subprocess.run([
        "huggingface-cli", "download", MODEL_ID,
        "--local-dir", str(MODEL_DIR),
    ], check=True)
    print(f"  ✅ Modèle téléchargé → {MODEL_DIR}")

    check_safetensors_only(MODEL_DIR)
    compute_sha256(MODEL_DIR, SHA_FILE)
    export_onnx(MODEL_DIR, ONNX_DIR)
    compute_sha256(ONNX_DIR, Path("MODEL-ONNX.sha256"))
    validate_quantization(MODEL_DIR, ONNX_DIR)

    step("✅ Modèle prêt pour le déploiement")
    print(f"  Poids ONNX int8 : {ONNX_DIR}")
    print(f"  Taille         : {sum(f.stat().st_size for f in ONNX_DIR.rglob('*')) / 1024 / 1024:.0f} Mo")
    print(f"  Empreinte      : MODEL.sha256 et MODEL-ONNX.sha256")


if __name__ == "__main__":
    main()
