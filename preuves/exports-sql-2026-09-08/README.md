# Exports Cloud SQL du 08/09/2026 — pièces justificatives

Ces trois fichiers sont les **sorties brutes** de l'extraction décrite dans
[`../../PREUVES_CHAINE_DONNEES.md`](../../PREUVES_CHAINE_DONNEES.md) §4.1. Ils servent de pièce
justificative : les chiffres de la fiche peuvent être recoupés ligne à ligne avec eux.

| Fichier | Base | Contenu |
|---|---|---|
| `usage_menal.csv` | `menal_db` | comptes, MFA, rôles, clés d'API, volume et bornes du journal d'audit |
| `usage_elson.csv` | `elson_db` | comptes, phrases, contributions, validations |
| `audit_detail.csv` | `menal_db` | top 15 des actions auditées : action, ressource, appels, comptes, jours distincts |

## Comment ils ont été produits

Instance `menal-db-staging`, IP privée, **jamais exposée**. L'extraction est passée par l'API
d'administration Google (`gcloud sql export csv`), avec des **requêtes d'agrégat** au lieu d'un
dump de table :

1. création d'un bucket temporaire daté ;
2. octroi de `roles/storage.objectAdmin` au seul compte de service de l'instance
   (`p110809493492-n4kr03@gcp-sa-cloud-sql.iam.gserviceaccount.com`) ;
3. trois `gcloud sql export csv --query=...` ;
4. récupération des fichiers ;
5. **suppression du bucket** — vérifiée : le projet est revenu à ses 3 buckets d'origine.

## Pourquoi ces fichiers peuvent être versionnés

Ils ne contiennent **que des agrégats** : aucun e-mail, aucun nom, aucun identifiant de compte,
aucune empreinte de mot de passe. Contrôle passé avant archivage — `grep -riE "@|password|hash|secret"`
ne renvoie rien.

C'est précisément la différence à souligner devant un jury : un export `--table` aurait produit un
dump de données personnelles qu'il aurait fallu détruire ; un export `--query` d'agrégats produit
une pièce justificative conservable. La minimisation n'est pas une intention, c'est le choix de la
commande.

L'opération elle-même est tracée dans `cloudaudit_googleapis_com_activity` : l'extraction est
auditée au même titre que le reste.
