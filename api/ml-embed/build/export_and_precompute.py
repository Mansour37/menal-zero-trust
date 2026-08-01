#!/usr/bin/env python3
"""
Etape de build Cloud Build : produit les poids reels d'ATT&CK-BERT et les
embeddings du catalogue MITRE. NE s'execute PAS au runtime (le service ne
contient ni torch ni optimum) — uniquement dans l'etape `export-model` de
cloudbuild.yaml.

Precision : fp32, PAS int8. La quantisation dynamique int8 a ete essayee et
REJETEE par le gate d'accord de classement : cosinus int8/fp32 de 0.83-0.91
et surtout top-1 MITRE identique sur 0/5 requetes SOC (build 35eb6b51). Les
activations extremes des LayerNorm de BERT tolerent mal la quantisation
dynamique ; l'int8 produisait des classements plausibles mais qui ne sont pas
ceux d'ATTACK-BERT. Contrepartie assumee : modele ~440 Mo et service a 2 Gi.

Sorties :
  * <out-model>/  : model.onnx (fp32), config + tokenizer, VERSION, MODEL.sha256
  * <out-jsonl>   : lignes attack_embeddings avec les VRAIS vecteurs 768D,
                    model_version = attack-bert-onnx-fp32@v1.0 (remplace les
                    lignes "catalogue-only" via `bq load --replace`)

Garde-fous (valident desormais l'export ONNX lui-meme vs PyTorch) :
  * fidelite ONNX vs PyTorch fp32 (plancher 0.75, attendu ~1.0) ;
  * accord de classement : le top-1 MITRE de l'ONNX exporte doit coincider
    avec celui du PyTorch de reference sur les requetes SOC d'exemple ;
  * le chemin d'inference utilise ici (tokenizer np -> ort.InferenceSession ->
    mean pooling -> normalisation L2) est EXACTEMENT celui de app/main.py, pour
    que les vecteurs du catalogue et ceux produits en service soient comparables.

Le catalogue reprend la logique de scripts/load_attack_catalogue.py : une ligne
par (technique, tactique) reellement declaree, noms de tactiques lus du bundle.
"""

import argparse
import hashlib
import json
import shutil
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

MODEL_ID = "basel/ATTACK-BERT"
MODEL_VERSION = "attack-bert-onnx-fp32@v1.0"
MAX_TOKENS = 512
BATCH = 32
# Plancher absolu : en dessous, la quantisation a detruit le modele.
MIN_COSINE_FLOOR = 0.75
# Gate decisif : sur combien de requetes d'exemple le top-1 MITRE de l'int8
# doit coincider avec celui du fp32 (et recouvrement top-3 moyen minimal).
MIN_TOP1_AGREEMENT = 4  # sur len(FIDELITY_SAMPLES) = 5
MIN_TOP3_OVERLAP_AVG = 2.0

STIX_URL = (
    "https://raw.githubusercontent.com/mitre/cti/master/"
    "enterprise-attack/enterprise-attack.json"
)

FIDELITY_SAMPLES = [
    "Multiple failed login attempts followed by a successful login from a new IP address",
    "Process injection into lsass.exe to dump credentials",
    "Scheduled task created to maintain persistence after reboot",
    "Large outbound data transfer to an unknown external host over HTTPS",
    "PowerShell execution with encoded command line arguments",
]


def mean_pool(last_hidden: np.ndarray, mask: np.ndarray) -> np.ndarray:
    mask_expanded = np.expand_dims(mask, -1).astype(np.float32)
    return (last_hidden * mask_expanded).sum(1) / np.clip(mask_expanded.sum(1), 1e-9, None)


def l2_normalize(vectors: np.ndarray) -> np.ndarray:
    return vectors / np.clip(np.linalg.norm(vectors, axis=1, keepdims=True), 1e-9, None)


def export_model(out_model: Path) -> None:
    """basel/ATTACK-BERT -> ONNX fp32 -> out_model (pas de quantisation, cf. en-tete)."""
    from optimum.onnxruntime import ORTModelForFeatureExtraction
    from transformers import AutoTokenizer

    fp32_dir = Path("/tmp/attack-bert-onnx-fp32")

    print(f"[1/5] Export ONNX fp32 de {MODEL_ID}...")
    model = ORTModelForFeatureExtraction.from_pretrained(MODEL_ID, export=True)
    model.save_pretrained(fp32_dir)
    tok = AutoTokenizer.from_pretrained(MODEL_ID)
    tok.save_pretrained(fp32_dir)

    print("[2/5] Assemblage du repertoire modele...")
    out_model.mkdir(parents=True, exist_ok=True)
    shutil.copy2(next(fp32_dir.glob("*.onnx")), out_model / "model.onnx")
    for f in fp32_dir.iterdir():
        if f.suffix != ".onnx":
            shutil.copy2(f, out_model / f.name)
    (out_model / "VERSION").write_text(MODEL_VERSION + "\n")

    sha_lines = []
    for f in sorted(out_model.iterdir()):
        if f.name == "MODEL.sha256":
            continue
        digest = hashlib.sha256(f.read_bytes()).hexdigest()
        sha_lines.append(f"{digest}  {f.name}")
    (out_model / "MODEL.sha256").write_text("\n".join(sha_lines) + "\n")

    onnx_sha = hashlib.sha256((out_model / "model.onnx").read_bytes()).hexdigest()
    size_mb = (out_model / "model.onnx").stat().st_size / 1e6
    print(f"  model.onnx : {size_mb:.1f} Mo, sha256={onnx_sha[:12]}")


class OnnxEncoder:
    """Reproduit exactement le chemin d'inference de app/main.py."""

    def __init__(self, model_dir: Path):
        import onnxruntime as ort
        from transformers import AutoTokenizer

        self.tok = AutoTokenizer.from_pretrained(model_dir)
        self.sess = ort.InferenceSession(
            str(model_dir / "model.onnx"), providers=["CPUExecutionProvider"]
        )
        self.input_names = {i.name for i in self.sess.get_inputs()}

    def encode(self, texts: list[str]) -> np.ndarray:
        out = []
        for i in range(0, len(texts), BATCH):
            batch = texts[i : i + BATCH]
            enc = self.tok(
                batch, padding=True, truncation=True, max_length=MAX_TOKENS, return_tensors="np"
            )
            feed = {k: v.astype(np.int64) for k, v in enc.items() if k in self.input_names}
            (last_hidden,) = self.sess.run(["last_hidden_state"], feed)
            out.append(l2_normalize(mean_pool(last_hidden, enc["attention_mask"])))
        return np.vstack(out)


class TorchEncoder:
    """Reference fp32 (PyTorch), meme pooling/normalisation que le service."""

    def __init__(self):
        import torch
        from transformers import AutoModel, AutoTokenizer

        self._torch = torch
        self.tok = AutoTokenizer.from_pretrained(MODEL_ID)
        self.model = AutoModel.from_pretrained(MODEL_ID)
        self.model.eval()

    def encode(self, texts: list[str], batch: int = 16) -> np.ndarray:
        out = []
        for i in range(0, len(texts), batch):
            enc = self.tok(
                texts[i : i + batch],
                padding=True,
                truncation=True,
                max_length=MAX_TOKENS,
                return_tensors="pt",
            )
            with self._torch.no_grad():
                last_hidden = self.model(**enc).last_hidden_state.numpy()
            out.append(l2_normalize(mean_pool(last_hidden, enc["attention_mask"].numpy())))
        return np.vstack(out)


def check_fidelity(encoder: OnnxEncoder, ref: TorchEncoder) -> None:
    """Cosinus ONNX vs PyTorch fp32 — attendu ~1.0, plancher de securite."""
    print("[3/5] Fidelite ONNX vs PyTorch (plancher {:.2f}, attendu ~1.0)...".format(MIN_COSINE_FLOOR))
    ref_vecs = ref.encode(FIDELITY_SAMPLES)
    onnx_vecs = encoder.encode(FIDELITY_SAMPLES)
    cosines = (ref_vecs * onnx_vecs).sum(axis=1)
    for text, cos in zip(FIDELITY_SAMPLES, cosines):
        print(f"  cos={cos:.4f}  {text[:60]}")
    if cosines.min() < MIN_COSINE_FLOOR:
        print(f"ECHEC : fidelite ONNX {cosines.min():.4f} < plancher {MIN_COSINE_FLOOR}")
        sys.exit(1)


def check_ranking_agreement(
    queries: list[str],
    tech_ids: list[str],
    names: dict[str, str],
    onnx_query_vecs: np.ndarray,
    onnx_cat_vecs: np.ndarray,
    fp32_query_vecs: np.ndarray,
    fp32_cat_vecs: np.ndarray,
) -> None:
    """
    Gate decisif : l'ONNX exporte doit retrouver les memes techniques MITRE que
    le PyTorch de reference. Chaque espace est compare a lui-meme (requete ONNX
    vs catalogue ONNX, requete fp32 vs catalogue fp32) — c'est la geometrie
    relative qui compte. C'est ce gate qui a disqualifie l'int8 (top-1 : 0/5).
    """
    print("[5/5] Accord de classement ONNX vs PyTorch sur le catalogue...")

    def top3(qvec: np.ndarray, cat: np.ndarray) -> list[str]:
        sims = cat @ qvec
        return [tech_ids[i] for i in np.argsort(-sims)[:3]]

    def fmt(ids: list[str]) -> str:
        return ", ".join(t + " " + names.get(t, "")[:24] for t in ids)

    top1_hits = 0
    overlaps = []
    for i, query in enumerate(queries):
        t_fp32 = top3(fp32_query_vecs[i], fp32_cat_vecs)
        t_onnx = top3(onnx_query_vecs[i], onnx_cat_vecs)
        hit = t_fp32[0] == t_onnx[0]
        overlap = len(set(t_fp32) & set(t_onnx))
        top1_hits += hit
        overlaps.append(overlap)
        status = "OK  " if hit else "DIFF"
        print(f"  {status} overlap={overlap}/3  {query[:48]}")
        print(f"       fp32: {fmt(t_fp32)}")
        print(f"       onnx: {fmt(t_onnx)}")

    avg_overlap = float(np.mean(overlaps))
    print(f"  top-1 identiques : {top1_hits}/{len(queries)} | overlap top-3 moyen : {avg_overlap:.1f}/3")
    if top1_hits < MIN_TOP1_AGREEMENT or avg_overlap < MIN_TOP3_OVERLAP_AVG:
        print(
            f"ECHEC : l'ONNX ne reproduit pas les classements PyTorch "
            f"(top1 {top1_hits}<{MIN_TOP1_AGREEMENT} ou overlap {avg_overlap:.1f}<{MIN_TOP3_OVERLAP_AVG})."
        )
        sys.exit(1)


def tactics_from_bundle(bundle: dict) -> dict[str, str]:
    return {
        obj["x_mitre_shortname"]: obj["name"]
        for obj in bundle.get("objects", [])
        if obj.get("type") == "x-mitre-tactic"
        and not obj.get("revoked")
        and obj.get("x_mitre_shortname")
    }


def fetch_catalogue() -> tuple[dict[str, dict], list[tuple[str, str]], list[str], list[str]]:
    """Catalogue MITRE — meme structure que load_attack_catalogue.py."""
    print("[4/5] Telechargement du bundle STIX MITRE...")
    with urllib.request.urlopen(STIX_URL, timeout=180) as resp:
        bundle = json.loads(resp.read().decode("utf-8"))

    tactic_by_shortname = tactics_from_bundle(bundle)
    techniques: dict[str, dict] = {}
    pairs: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()

    for obj in bundle.get("objects", []):
        if obj.get("type") != "attack-pattern" or obj.get("revoked") or obj.get("x_mitre_deprecated"):
            continue
        technique_id = next(
            (
                ref.get("external_id")
                for ref in obj.get("external_references", [])
                if ref.get("source_name") == "mitre-attack" and ref.get("external_id")
            ),
            None,
        )
        if not technique_id:
            continue
        techniques[technique_id] = obj
        for phase in obj.get("kill_chain_phases", []):
            if phase.get("kill_chain_name") != "mitre-attack":
                continue
            tactic = tactic_by_shortname.get(phase.get("phase_name", ""))
            if not tactic:
                continue
            key = (technique_id, tactic)
            if key not in seen:
                seen.add(key)
                pairs.append(key)

    # Un seul embedding par technique (nom + description complete), reutilise
    # pour chacune de ses tactiques.
    tech_ids = sorted({tid for tid, _ in pairs})
    texts = [
        f"{techniques[tid].get('name', tid)}. {(techniques[tid].get('description') or '')[:4000]}"
        for tid in tech_ids
    ]
    print(f"  {len(tech_ids)} techniques ({len(pairs)} lignes technique x tactique)")
    return techniques, pairs, tech_ids, texts


def write_jsonl(
    out_jsonl: Path,
    techniques: dict[str, dict],
    pairs: list[tuple[str, str]],
    tech_ids: list[str],
    vectors: np.ndarray,
) -> None:
    vec_by_tech = {tid: vectors[i] for i, tid in enumerate(tech_ids)}
    now = datetime.now(timezone.utc).isoformat()
    out_jsonl.parent.mkdir(parents=True, exist_ok=True)
    with out_jsonl.open("w", encoding="utf-8") as f:
        for technique_id, tactic in pairs:
            obj = techniques[technique_id]
            f.write(
                json.dumps(
                    {
                        "technique_id": technique_id,
                        "tactic": tactic,
                        "technique_name": obj.get("name", technique_id),
                        "description": (obj.get("description") or "")[:1024],
                        "embedding": [float(x) for x in vec_by_tech[technique_id]],
                        "model_version": MODEL_VERSION,
                        "created_at": now,
                    }
                )
                + "\n"
            )
    print(f"  {len(pairs)} lignes ecrites dans {out_jsonl}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-model", type=Path, required=True)
    ap.add_argument("--out-jsonl", type=Path, required=True)
    args = ap.parse_args()

    export_model(args.out_model)
    encoder = OnnxEncoder(args.out_model)
    ref = TorchEncoder()
    check_fidelity(encoder, ref)

    techniques, pairs, tech_ids, texts = fetch_catalogue()
    print("  Encodage ONNX du catalogue...")
    onnx_cat = encoder.encode(texts)
    print("  Encodage PyTorch de reference du catalogue (plus lent)...")
    fp32_cat = ref.encode(texts)
    names = {tid: techniques[tid].get("name", "") for tid in tech_ids}

    check_ranking_agreement(
        FIDELITY_SAMPLES,
        tech_ids,
        names,
        encoder.encode(FIDELITY_SAMPLES),
        onnx_cat,
        ref.encode(FIDELITY_SAMPLES),
        fp32_cat,
    )

    write_jsonl(args.out_jsonl, techniques, pairs, tech_ids, onnx_cat)
    print("Build modele : OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
