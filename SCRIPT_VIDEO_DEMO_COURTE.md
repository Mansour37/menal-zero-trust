# Script vidéo démo-live — 3:00 à 3:45, pentest réel depuis un poste attaquant

> **Positionnement** : ce n'est PAS une défense de PFE point par point (rôle de
> `SCRIPT_VIDEO_JURY.md`, 5 min). C'est une **preuve commerciale compacte** : « voici un socle
> Zero Trust multi-app, en production, que j'attaque en direct avec les vrais outils de pentest
> du métier — et qui tient. » Public : jury élargi, démonstration technique, portfolio, prospect.
>
> **Principe directeur (transparence)** : rien n'est fabriqué à la main ni pré-calculé. On lâche
> **les outils standards de l'industrie** (`wafw00f`, `sqlmap`, `nikto`) depuis une machine
> attaquante, comme le ferait un pentester réel, et on filme le résultat brut. C'est ce qui rend
> la démo crédible : un jury reconnaît ces outils, il sait qu'on ne triche pas.
>
> **Version 3.1 (20/08/2026)** : révisée après audit croisé red-team + jury/commercial et **tests
> live sur la cible**. Corrections majeures : cible sqlmap vérifiée (baseline 200 réelle), retrait
> du path-traversal, ordre des outils, proposition de valeur explicite, accroche renforcée.
> **v3.1** : cadrage de la latence (blocage temps réel / détection corrélée en minutes = normal ;
> 5 min est le plancher BigQuery, vérifié — pas de raccourci possible sans streaming), dashboard
> présenté comme vue naturelle du SOC sans exposer la question d'accès à l'écran.

> **Rôle de ce document** : feuille de régie. Vous manipulez deux fenêtres — le **poste attaquant**
> (terminal Kali/VM) et le **SOC** (dashboard MENAL). **Impératif : exécuter chaque commande une
> fois AVANT de tourner** (répétition générale), noter la sortie réelle, et filmer le résultat —
> pas l'attente ni l'initialisation des outils.

---

## 0. Check-list avant d'enregistrer (10 min, hors vidéo)

### 0.1 — Le poste attaquant (VM)

Une VM Kali Linux, ou toute machine Linux avec les outils. C'est le pilier de la crédibilité :
**on attaque depuis une machine séparée, pas depuis le serveur.**

```bash
which wafw00f nikto sqlmap        # tous présents ?
# Debian/Ubuntu si absents :  sudo apt install -y wafw00f nikto sqlmap
```

### 0.2 — Cibles et état de santé (à lancer depuis la VM exacte qui filmera)

```bash
export ELSON=https://elson.menal-sarl.com          # l'app cible (2e tenant)
export DASH=https://dashboard.menal-sarl.com        # le SOC / dashboard MENAL (URL "production")

curl -s -o /dev/null -w 'elson /api/health      -> %{http_code}\n' $ELSON/api/health          # 200
curl -s -o /dev/null -w 'elson /api/health?id=  -> %{http_code}\n' "$ELSON/api/health?id=test" # 200
curl -s -o /dev/null -w 'dash  /login           -> %{http_code}\n' $DASH/login                 # 200
```

### 0.3 — **POINT CRITIQUE : viser un chemin bloqué par le WAF, pas par l'auth de l'app**

Test live du 20/08 : il existe **deux 403 différents** sur Elson, à ne pas confondre —

| 403 | Exemple | Corps | Origine |
|---|---|---|---|
| **WAF Cloud Armor** ✅ | `/api/health?id=1' UNION SELECT--` | `<!doctype html>…403 Forbidden` (text/html) | **le pare-feu** — ce qu'on veut montrer |
| **App (auth)** ❌ | `/api/users?search=test` | `{"error":"Forbidden"}` (JSON) | l'auth de l'app, PAS le WAF |

**Conséquence** : sqlmap et les attaques doivent viser un chemin **non authentifié** (`/api/health`
ou la racine `/`) — là, le 403 vient du WAF sans ambiguïté. Si on vise `/api/users`, un juré pointu
peut objecter « ça, c'est juste ton auth, pas ton WAF ». **Vérifier avant de tourner** que le
payload renvoie bien un 403 **text/html** :

```bash
curl -s -D - "$ELSON/api/health?id=1%27%20UNION%20SELECT%20pass%20FROM%20users--" | head -3
#  attendu : HTTP/1.1 403 Forbidden  +  Content-Type: text/html   (= Cloud Armor)
```

### 0.4 — Répétition générale des outils (obligatoire)

Faire un **run complet de sqlmap et de nikto** avant de filmer, noter la sortie EXACTE, et régler
le débit de narration dessus. But : aucune surprise à la caméra. (Détails de commandes au §3.)

### 0.5 — Divers

- **Géo-blocage** : le géo-blocage Cloud Armor n'exempte que le chemin exact `/health` (qui sur
  Elson renvoie 404 — d'où l'usage de `/api/health`). Si vous tournez hors zone autorisée (UE /
  Maghreb / Mauritanie / IP admin), `/api/health` peut lui-même renvoyer 403 : le test §0.2 le
  révèle → tourner sous VPN de la zone.
- **Risque de ban d'IP** : `nikto`/`sqlmap` envoient beaucoup de requêtes ; le rate-limiting peut
  basculer l'IP en `429`/ban temporaire — comportement **normal et désirable**. D'où l'ordre du §3
  (référence saine d'abord, outil-vedette ensuite, nikto en dernier car il encaisse le ban).
- Se connecter une fois au dashboard **avant** l'enregistrement (cold start du login).
- Terminal plein écran, police ≥16 pt, thème sombre contrasté ; fermer tout secret/token à l'écran.
- **Précondition URL "production"** : ce script vise `https://dashboard.menal-sarl.com` (URL sans
  « staging », pour montrer un service en production). Cette bascule doit être **terminée et
  vérifiée AVANT de tourner** — sinon utiliser l'ancienne `https://dash-staging.menal-sarl.com`.
  Test go/no-go : `curl -sI https://dashboard.menal-sarl.com/login` doit renvoyer `200`. (Procédure
  de bascule DNS+certificat : voir le bloc commenté dans `terraform/environments/staging/
  terraform.tfvars`.)

---

## 1. Accroche (0:00–0:20)

**À l'écran** : split-screen — à gauche le terminal de la VM attaquante (`kali@attacker`), à droite
le dashboard MENAL. Ou schéma d'architecture minimal.

**Narration** (~18s — enjeu réel + présent d'action) :
> « Cette application est en production, en ce moment, avec de vrais utilisateurs. Sur cet écran,
> la machine d'un attaquant, avec l'arsenal complet d'un pentester professionnel. Je n'ai rien
> préparé, rien truqué. Je lance l'attaque maintenant — et je vous montre, des deux côtés à la
> fois, ce qui se passe réellement. »

---

## 2. Contexte : la cible est saine et protégée (0:20–0:45)

**Vous manipulez le terminal attaquant.**

```bash
# 1) La cible répond normalement à un utilisateur légitime (contrôle scientifique)
curl -s -o /dev/null -w 'requete legitime -> HTTP %{http_code}\n' $ELSON/api/health

# 2) Reconnaissance : derriere quoi tourne cette app ?
wafw00f $ELSON
```

**Résultat attendu** : `200` sur la requête légitime, puis `wafw00f` signale la présence d'un
pare-feu applicatif. **Cas nominal** : détection générique (« the site seems to be behind a WAF »).
S'il nomme précisément « Google Cloud Armor », c'est un bonus — ne pas le promettre dans la voix.

**À dire** :
> « L'application répond normalement à un utilisateur légitime. Mais dès la reconnaissance,
> l'attaquant se heurte à un mur : elle est protégée par un pare-feu applicatif. Et cette
> application, Elson, n'est qu'un des deux locataires du socle. Aucune application ne fait
> confiance à l'autre, aucune n'a plus de droits que nécessaire : la confiance ne se suppose pas,
> elle se vérifie. »

---

## 3. Le pentest en direct (0:45–2:15)

**À l'écran** : terminal attaquant plein écran. **Ordre imposé** (minimise la casse — voir §0.5) :
sqlmap sur IP fraîche d'abord, nikto (qui encaisse un éventuel ban) ensuite.

```bash
# --- Outil 1 : injection SQL automatisee (sqlmap, standard mondial) ---
#     Cible NON authentifiee => le blocage vient du WAF, pas de l'auth (cf. §0.3)
echo "[*] sqlmap : injection SQL automatisee contre un endpoint public"
sqlmap -u "$ELSON/api/health?id=test" --batch --level=1 --risk=1 \
  --technique=BEU --timeout=10 --retries=1 -v 1 --flush-session

# --- Outil 2 : scan de vulnerabilites web sur toute la surface (Nikto) ---
echo "[*] Nikto : scan de vulnerabilites, surface complete"
nikto -h $ELSON -Tuning x6 -Display E -maxtime 45s
```

**Résultat attendu** (à confirmer et chronométrer en répétition — §0.4) :
- `sqlmap` obtient une **baseline 200** (vérifiée live), puis **chaque payload d'injection revient
  en 403** ; il signale un **WAF/IPS** (`[CRITICAL] ... WAF/IPS`) et **ne parvient à injecter aucun
  paramètre**. L'outil de référence mondial pour le SQLi est bloqué net.
- `nikto` (`-Tuning x6` = toute la surface **sauf** les tests DoS ; `-Display E` = affiche les
  erreurs HTTP) produit un **mur de 403** et signale souvent `Host may be protected by a
  Firewall/IPS`.
- Effet de bord : ce volume dépasse largement **10 requêtes bloquées / même IP / 15 min** — le
  seuil de la détection R2 (§4).

**Narration pendant l'exécution** (une réplique par outil, pas un bloc — évite le silence) :
> « sqlmap, l'outil de référence pour l'injection SQL. Il détecte le pare-feu, et chaque tentative
> d'injection est rejetée : aucun paramètre injectable. » *(pendant sqlmap)*
> « Ensuite un scan complet de la surface avec Nikto : un mur de blocages. » *(pendant nikto)*
> « Ce sont exactement les outils qu'un attaquant réel emploierait. Vous ne me croyez pas sur
> parole : vous regardez l'outil conclure lui-même. » *(à la fin)*

> **Repli si un outil est trop lent/verbeux à la caméra** : le lancer 5-10 s avant de démarrer
> l'enregistrement pour passer l'initialisation, puis filmer le déroulé + la conclusion. On filme
> le *résultat*, pas l'attente — ce n'est pas de la triche, l'attaque est bien réelle.
>
> **Repli si la sortie sqlmap prête à confusion** (ex. une ligne heuristique ambiguë au lieu d'un
> « not injectable » net — à détecter en répétition §0.4) : basculer nikto en outil principal
> (mur de 403 très lisible) et présenter sqlmap comme « l'outil détecte le pare-feu et se fait
> bloquer », sans parier sur le verdict final exact.

---

## 4. Le SOC voit, classe et attribue l'attaque (2:15–3:00)

**À l'écran** : bascule vers le dashboard MENAL, **déjà connecté**, page `/detections`.
Présenter la console comme **la vue naturelle du SOC** — on l'ouvre, elle est là, elle affiche
l'attaque. Ne rien expliquer sur *comment* on y accède, ni sur son hébergement (voir l'annexe
« ce qu'il ne faut PAS montrer »). L'effet recherché : ça marche, logiquement, par défaut.

**Narration** (cadrer la latence comme une force, pas une excuse) :
> « Côté défense maintenant. L'attaque, elle, a été bloquée à la milliseconde — vous l'avez vu.
> Ce que vous voyez ici, c'est l'étape d'après : le SOC qui corrèle. Chaque requête bloquée a été
> collectée, rattachée à son auteur, puis classée selon le référentiel mondial des techniques
> d'attaque, MITRE ATT&CK, et attribuée automatiquement à la bonne application. »

> **Point de framing à assumer si on vous interroge sur le délai** : le **blocage est instantané**
> (Cloud Armor, <1 ms) ; seule la **corrélation** — « plusieurs requêtes depuis la même IP = une
> attaque » — prend quelques minutes. C'est exactement le fonctionnement d'un vrai SOC (Sentinel,
> Chronicle : détection en minutes). L'attaquant est arrêté tout de suite ; le motif est reconnu
> juste après. Ne jamais présenter ce délai comme une limite : c'est la séparation normale entre
> *prévention temps réel* et *détection corrélée*.

**Preuve attendue** (vérifiée live le 19/08/2026 — détection R2 réelle observée en ~15 min) :
```
rule_id=R2, entity=<IP de la VM attaquante>,
service=menal-elson-api-backend-staging
message="N requetes bloquees par Cloud Armor depuis <IP> en 15 min"   (N > 10)
mitre_tactic=TA0040 (Impact), mitre_technique=T1498 (Network DoS)
```

**À dire** :
> « La colonne "service" indique `menal-elson-api-backend-staging` : l'attaque est attribuée à
> l'application précise — Elson — pas mélangée avec l'autre locataire. En quelques minutes, sans
> aucune intervention humaine : l'attaque est identifiée, datée, rattachée à son auteur et à
> l'application visée. »

> **Repli si la ligne R2 n'est pas encore remontée** : basculer sur `/logs` filtré
> `elson-api-staging` (requêtes bloquées à la seconde) — dire : « la vue corrélée met quelques
> minutes ; la preuve brute, elle, est immédiate. »
>
> **Rappel tournage** : R2 remonte 5-15 min après l'attaque. Soit prise longue (filmer §1→§3,
> attendre, filmer §4), soit montage avec un plan de coupe entre attaque et SOC — parfaitement
> admis, personne n'attend une latence nulle.
>
> **Peut-on raccourcir l'attente ?** Non, pas sans changer d'architecture : BigQuery impose un
> **plancher de 5 min** sur les scheduled queries (`min_schedule_interval=5m`, vérifié via l'API le
> 20/08 — un `every 2 minutes` est rejeté en HTTP 400). La chaîne a deux étages de 5 min
> (normalisation puis règle de détection), d'où les 5-15 min. Descendre plus bas exigerait un
> pipeline streaming (Pub/Sub → Dataflow), hors périmètre PFE et contraire au principe « simple et
> défendable ». **Conclusion tournage : assumer le montage/plan de coupe** — c'est la bonne réponse,
> pas un contournement.

---

## 5. Clôture (3:00–3:40)

**À l'écran** : split-screen figé — terminal « toutes attaques bloquées » | SOC « détection R2 ».

**Narration** (récap + proposition de valeur explicite + slogan) :
> « Des outils d'attaque professionnels, lancés en direct sur une application en production,
> hébergée à côté d'un autre client sur le même socle. Bloqués, détectés, classés selon MITRE
> ATT&CK, et attribués au bon locataire — automatiquement. Concrètement : vous déployez votre
> application sur ce socle, et elle hérite immédiatement d'un pare-feu applicatif, de l'isolation
> entre clients, et d'un SOC qui détecte et attribue les attaques — sans écrire une seule ligne de
> code de sécurité. Ce n'est pas une maquette. La preuve, pas la promesse. »

**Carton de fin** (texte, sans voix — **choisir UN seul CTA** selon la diffusion, ne pas laisser
les deux dans la version tournée) :
- *Contexte jury / portfolio* → lien vers le dépôt et le rapport PFE.
- *Contexte prospect / commercial* → « Demander une démo » + une adresse de contact.

**Fin.**

---

## Annexe — minutage strict

| Temps | Séquence | À ne jamais raccourcir |
|---|---|---|
| 0:00–0:20 | Accroche | |
| 0:20–0:45 | Contexte : cible saine + WAF détecté | |
| 0:45–2:15 | Pentest en direct (sqlmap → nikto) | ★ cœur de preuve |
| 2:15–3:00 | SOC : détection + MITRE + attribution | ★ cœur de preuve |
| 3:00–3:40 | Clôture + proposition de valeur | |

**Marge** : si dépassement de 3:45, raccourcir la narration du §5, puis le §2. Ne jamais rogner
§3 ni §4 — c'est la démonstration.

---

## Annexe — ce qu'il ne faut PAS montrer / dire (limites assumées)

Un jury qui a déjà vu passer des projets n'est PAS impressionné par des évidences ; il l'est par
la **rigueur** et l'**honnêteté**. D'où :

- **Ne pas montrer** : la mécanique interne des `curl` (peu remarquable), le code source à
  l'écran, des captures pré-enregistrées présentées comme du live, un dashboard vide « pour faire
  joli », ni une commande IAM `grep` (texte gris qui ne prouve rien à l'œil — la vraie preuve
  d'isolation, c'est la colonne `service=` du §4). Montrer uniquement ce qui **prouve** l'objectif :
  attaque réelle → blocage → détection → attribution.
- **Ne pas viser un endpoint authentifié** pour l'attaque (cf. §0.3) : son 403 vient de l'auth,
  pas du WAF, et affaiblit la démonstration.
- **Dashboard : le présenter comme la vue naturelle du SOC**, rien de plus. Ne PAS montrer ni
  mentionner à l'écran comment on y accède, son URL, son hébergement, ni la question du contrôle
  d'accès (exposition publique, IAP, allowlist IP). La console s'ouvre et affiche l'attaque —
  logique, par défaut. Le sujet « posture d'accès du dashboard » est un **briefing interne**
  (le dashboard est protégé par WAF + auth + MFA + ingress verrouillé ; l'IAP a été écarté faute
  d'organisation Google Workspace ; l'allowlist IP est le durcissement prod recommandé). À sortir
  uniquement **si un juré pose la question**, jamais spontanément dans la vidéo.
- **Ne pas présenter le délai de détection comme une limite** (cf. §4) : blocage temps réel,
  corrélation en quelques minutes = fonctionnement normal d'un SOC.
- **Ne pas dire couvrir tout** : ce format de 3-4 min ne montre ni MFA, ni chiffrement, ni
  rétention, ni segmentation réseau. Ce n'est pas un audit filmé, c'est une preuve ciblée.
- **Si question après la vidéo** : renvoyer vers `SCRIPT_VIDEO_JURY.md` (version longue :
  MFA / IAM / ML) ou `02_SECURITE_AUDITS_ECARTS.md` (registre complet, incluant les 3 réserves
  ouvertes assumées : segmentation réseau multi-tenant, gap WAF path-traversal, 74 findings SAST
  en cours de triage). **Assumer ces réserves à voix haute si on les pose est un atout** — mais on
  ne les déballe jamais spontanément. Cette annexe est un briefing interne pour le présentateur,
  **pas un document à joindre à un envoi client.**
