# ADR 0001 : Choix du framework frontend — Next.js

**Statut :** Accepté
**Date :** 2026-07-30
**Auteur :** Équipe MENAL Zero Trust

## Contexte

Le HLD (architecture cible) spécifie Next.js pour le dashboard de sécurité.
Pendant le développement initial, un dashboard Streamlit a été déployé par souci de rapidité
(prototypage Python avec BigQuery).

Ce hiatus entre le HLD et l'implémentation réelle crée une dette architecturale.

## Décision

Revenir à **Next.js** comme prévu dans le HLD, et décommissionner le dashboard Streamlit.

Justifications :

- **HLD alignment** — Le HLD et les schémas d'architecture montrent Next.js ; tout écart
  doit être intentionnel et documenté.
- **SSR & performance** — Next.js permet un rendu serveur, des layouts complexes,
  et une meilleure expérience utilisateur qu'une SPA multithread Streamlit.
- **Typage** — TypeScript/Next.js apporte des types forts, un écosystème de composants
  mature (MUI, Tremor, shadcn/ui) et une maintenabilité supérieure pour une app
  appelée à évoluer (tableaux de bord multi-vues, graphiques interactifs, exports).
- **Séparation API/UI** — Le dashboard Streamlit appelle BigQuery directement.
  Next.js + une BFF (Backend For Frontend) renforce le Zero Trust (pas d'accès BQ
  depuis le navigateur).
- **Équipe** — Le choix initial de Streamlit n'a pas été challengé. Cet ADR formalise
  le retour au plan.

## Conséquences

| Aspect | Impact |
|--------|--------|
| **Délai** | Réécriture du dashboard en Next.js (estimé 2-3 sprints). |
| **I18n / Auth** | NextAuth.js + OIDC possible ; l'authentification HMAC actuelle (Streamlit) n'est plus nécessaire. |
| **Backend** | Une couche API (App Router API routes ou API Gateway) sert les données BQ au frontend. |
| **Migration** | Période de transition : les deux dashboards coexisteront jusqu'à ce que Next.js atteigne la parité fonctionnelle. |
| **Streamlit** | Décommissionné après validation du nouveau dashboard. |

## Alternatives rejetées

- **Conserver Streamlit** — Plus rapide mais non aligné HLD, extension difficile,
  pas de SSR, couplage BQ direct.
- **Vue.js / Svelte** — Valides mais Next.js est déjà dans le HLD et mieux connu de l'équipe.

## Références

- HLD v1.2 — Section Dashboard
- Dossier `api/dashboard/` (Streamlit actuel, à décommissionner)
