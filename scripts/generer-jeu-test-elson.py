#!/usr/bin/env python3
"""
Generateur de jeu de test ELSON — personas mauritaniennes synthetiques.

Produit un jeu de donnees REALISTE dans sa FORME (noms, NNI, telephones,
e-mails, audio) mais IMPOSSIBLE a confondre avec de vraies personnes. Trois
garde-fous, volontaires et documentes :

  1. E-mails en @example.com — domaine reserve par la RFC 2606 pour la
     documentation et les tests. Non routable : aucun message ne peut partir
     vers une vraie boite.
  2. NNI a 10 chiffres prefixes par "99" — le NNI mauritanien est unique par
     personne et la base porte un index UNIQUE dessus. Un tirage libre risquerait
     de heurter le numero d'un citoyen reel. Le prefixe reserve rend toute
     collision impossible et la nature synthetique evidente.
  3. Telephones en +222 9X — l'indicatif 9 n'est pas alloue aux mobiles
     mauritaniens (2, 3 et 4 le sont). Aucun numero genere n'est attribuable.

Le tirage est DETERMINISTE (--seed) : le meme seed redonne exactement le meme
jeu. Une preuve doit etre rejouable, y compris ses donnees d'entree.

Usage :
    python scripts/generer-jeu-test-elson.py --n 25
    python scripts/generer-jeu-test-elson.py --n 25 --with-audio
    python scripts/generer-jeu-test-elson.py --n 5 --seed 7 --out /tmp/jeu.json
"""
from __future__ import annotations

import argparse
import json
import math
import random
import re
import struct
import unicodedata
import wave
from datetime import date, timedelta
from pathlib import Path

# ── Anthroponymie mauritanienne ──────────────────────────────────────────────
# "Ould" = fils de, "Mint" = fille de. Le second element est le nom du pere,
# d'ou un vivier commun aux deux listes.
PRENOMS_H = [
    "Ahmed", "Mohamed", "Sidi", "Abdoullah", "Cheikh", "Mohameden", "Brahim",
    "Yahya", "Moctar", "Ely", "Bakar", "Sidina", "Hamoud", "Taleb", "Abdallahi",
    "Isselmou", "Mouhamedou", "Baba", "Sneiba", "Dahi",
]
PRENOMS_F = [
    "Fatimetou", "Mariem", "Aminetou", "Khadijetou", "Zeinabou", "Salka",
    "Lalla", "Tislem", "Vatimetou", "Nebghouha", "Toutou", "Aichetou",
    "Mounina", "Selma", "Coumba",
]
NOMS_PERE = [
    "Mohamed", "Ahmed", "Sidi", "Abdallahi", "Boubacar", "Cheikh", "Ely",
    "Moctar", "Brahim", "Hamoud", "Yahya", "Sidina", "Taleb", "Baba", "Sneiba",
]
LANGUES = ["fr"] * 6 + ["ar"] * 3 + ["en"]


def sans_accent(s: str) -> str:
    n = unicodedata.normalize("NFKD", s)
    return "".join(c for c in n if not unicodedata.combining(c))


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", ".", sans_accent(s).lower()).strip(".")


def wav_synthetique(chemin: Path, duree_ms: int, graine: int) -> None:
    """Ecrit un WAV mono 16 kHz valide : une voyelle formantique bruitee.

    Ce n'est pas de la parole — c'est un signal de la bonne FORME (duree,
    enveloppe, energie) pour exercer la chaine d'upload et de stockage sans
    pretendre etre un enregistrement humain.
    """
    sr, rng = 16000, random.Random(graine)
    n = int(sr * duree_ms / 1000)
    f0 = rng.uniform(95, 190)          # hauteur de voix plausible
    cadres = []
    for i in range(n):
        t = i / sr
        # enveloppe attaque/chute, evite les clics en bord de fichier
        env = min(1.0, t / 0.04, (duree_ms / 1000 - t) / 0.06)
        env = max(0.0, env)
        s = (0.5 * math.sin(2 * math.pi * f0 * t)
             + 0.25 * math.sin(2 * math.pi * 2 * f0 * t)
             + 0.12 * math.sin(2 * math.pi * 3 * f0 * t)
             + 0.05 * rng.uniform(-1, 1))
        cadres.append(int(max(-1.0, min(1.0, s * env * 0.6)) * 32767))
    chemin.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(chemin), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(b"".join(struct.pack("<h", c) for c in cadres))


def generer(n: int, seed: int, avec_audio: bool, dossier_audio: Path) -> dict:
    rng = random.Random(seed)
    personas, nnis, tels, emails = [], set(), set(), set()

    for i in range(n):
        femme = rng.random() < 0.42
        prenom = rng.choice(PRENOMS_F if femme else PRENOMS_H)
        particule = "Mint" if femme else "Ould"
        nom = f"{particule} {rng.choice(NOMS_PERE)}"

        # NNI : prefixe reserve 99 + 8 chiffres = 10 au total.
        # L'API refuse tout autre format ("Le NNI doit contenir exactement 10
        # chiffres") — c'est bien la longueur du NNI mauritanien reel. Le
        # prefixe 99 garde la garantie de non-collision.
        while (nni := f"99{rng.randrange(0, 10**8):08d}") in nnis:
            pass
        nnis.add(nni)

        # +222 9X XX XX XX — indicatif mobile non alloue en Mauritanie
        while (tel := f"+2229{rng.randrange(0, 10**7):07d}") in tels:
            pass
        tels.add(tel)

        base = f"{slug(prenom)}.{slug(nom)}"
        email = f"{base}@example.com"
        k = 2
        while email in emails:
            email = f"{base}{k}@example.com"
            k += 1
        emails.add(email)

        naissance = date(1980, 1, 1) + timedelta(days=rng.randrange(0, 25 * 365))

        p = {
            "firstName": prenom,
            "lastName": nom,
            "username": f"{base.replace('.', '_')}",
            "email": email,
            "nni": nni,
            "whatsapp": tel,
            "birthdate": naissance.isoformat(),
            "sourceLang": rng.choice(LANGUES),
            # Mot de passe de test, assume en clair : ces comptes n'ont aucune
            # valeur hors de l'environnement de recette.
            "password": f"Test!{rng.randrange(10**6, 10**7)}",
            "_jeu_de_test": True,
        }

        if avec_audio:
            duree = rng.randrange(1400, 4200)
            fichier = dossier_audio / f"contrib_{i + 1:03d}.wav"
            wav_synthetique(fichier, duree, seed * 1000 + i)
            p["audio"] = {
                "fichier": str(fichier).replace("\\", "/"),
                "duree_ms": duree,
            }

        personas.append(p)

    return {
        "_avertissement": (
            "JEU DE TEST SYNTHETIQUE — aucune personne reelle. E-mails en "
            "@example.com (RFC 2606, non routable), NNI prefixes 99 (reserves, "
            "aucune collision possible avec un NNI reel), telephones en +222 9X "
            "(indicatif non alloue). Ne jamais presenter comme des utilisateurs."
        ),
        "_genere_par": "scripts/generer-jeu-test-elson.py",
        "_seed": seed,
        "_nombre": len(personas),
        "personas": personas,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="Genere un jeu de test ELSON synthetique.")
    ap.add_argument("--n", type=int, default=25, help="nombre de personas (defaut 25)")
    ap.add_argument("--seed", type=int, default=42, help="graine, pour un tirage rejouable")
    ap.add_argument("--out", default="preuves/corpus/jeu_test_elson.json")
    ap.add_argument("--with-audio", action="store_true", help="genere aussi un WAV par persona")
    ap.add_argument("--audio-dir", default="preuves/corpus/audio")
    a = ap.parse_args()

    jeu = generer(a.n, a.seed, a.with_audio, Path(a.audio_dir))
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(jeu, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"{jeu['_nombre']} personas -> {out}  (seed={a.seed}, rejouable)")
    if a.with_audio:
        print(f"audio WAV 16 kHz mono -> {a.audio_dir}/")
    print("\nApercu :")
    for p in jeu["personas"][:4]:
        print(f"  {p['firstName']:<12} {p['lastName']:<16} NNI {p['nni']}  "
              f"{p['whatsapp']:<13} {p['email']}")
    print("\nGarde-fous : @example.com non routable · NNI 99xxxxxx reserves · +222 9X non alloue")


if __name__ == "__main__":
    main()
