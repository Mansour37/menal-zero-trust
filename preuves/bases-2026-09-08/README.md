# Contenu des deux bases — relevé du 08/09/2026

Pièces produites par [`../../scripts/preuve-contenu-bases.sh`](../../scripts/preuve-contenu-bases.sh).
Elles répondent à la question : *« qu'est-ce que chaque base héberge, et comment savez-vous
qu'elles ne se mélangent pas ? »*

| Fichier | Contenu |
|---|---|
| `elson_db_inventaire.csv` | les 62 tables d'ELSON : volume estimé, taille disque, nombre de colonnes |
| `elson_db_structure.csv` | toutes les colonnes de toutes les tables — la **nature** de la donnée |
| `elson_db_volumes.csv` | comptage **exact** (`COUNT(*)`) de **toutes** les tables |
| `elson_db_activite.csv` | l'activité réelle : inscriptions, OTP, connexions, rejets |
| `elson_db_isolation.csv` | la matrice `CONNECT` croisée + appartenance à `cloudsqlsuperuser` |
| `menal_db_inventaire.csv` | les 5 tables de MENAL |
| `menal_db_structure.csv` | idem, côté dashboard/SIEM |
| `menal_db_volumes.csv` | comptage exact de toutes les tables |
| `elson_media_bucket.csv` | le stockage objet de l'audio ELSON |

## Comment lire ces fichiers

**Ils n'ont pas de ligne d'en-tête.** `gcloud sql export csv` exporte les données brutes, sans
en-tête — les colonnes se lisent donc par position, dans l'ordre décrit ci-dessus. Un lecteur CSV
configuré en mode « première ligne = en-tête » prendra la première table pour un nom de colonne.

**`lignes = -1` dans l'inventaire ne veut PAS dire « table vide ».** L'inventaire s'appuie sur
`pg_class.reltuples`, une estimation du planificateur PostgreSQL, qui vaut `-1` tant que la table
n'a jamais été analysée.

Cette distinction n'est pas théorique, elle a produit une erreur réelle : une première lecture,
qui prenait `-1` pour « vide », concluait que `elson_db` n'avait que **3** tables peuplées. Le
comptage exhaustif en montre **9** — dont `audit_log`, `otp_codes` et `email_verifications`,
c'est-à-dire toute la trace du parcours d'inscription. C'est pour cela que les `*_volumes.csv`
existent : ils portent un `COUNT(*)` exact pour **chaque** table, obtenu en une seule requête via
`query_to_xml`. L'écart existe aussi sur les estimations : `reltuples` annonçait 8 516
`audit_logs` là où le compte exact est **9 248**.

**Règle à retenir** : pour une pièce de preuve, ne jamais citer un volume issu de `reltuples` ou
de `n_live_tup`. Seul `COUNT(*)` se défend.

## Méthode

Instances en IP privée, **jamais exposées**. Tout passe par l'API d'administration Google
(`gcloud sql export csv --query=...`), donc sans ouvrir la moindre connexion réseau vers la base.
Les requêtes ne portent que sur des **métadonnées** (`pg_class`, `information_schema`) et des
**agrégats** (`COUNT(*)`, `has_database_privilege`, comptages par type d'action) : aucun
identifiant d'utilisateur, aucune adresse IP, aucune empreinte n'est extraite — ce qui rend ces
pièces versionnables telles quelles.

Le bucket temporaire créé pour l'export est supprimé automatiquement en fin de script, y compris
si une étape échoue (`trap ... EXIT`).
