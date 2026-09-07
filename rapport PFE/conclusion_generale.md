# Conclusion Générale

Ce mémoire a présenté la conception, la réalisation et la validation d'un socle
d'hébergement cloud sécurisé selon les principes Zero Trust, construit pour l'entreprise
MENAL-SARL à partir de l'audit d'une plateforme existante et de l'analyse de ses menaces.

La démarche a suivi un fil conducteur rigoureux : partir d'un constat factuel (six carences
identifiées par l'audit, 23 critères de préparation non satisfaits), dériver des exigences
de sécurité à partir de scénarios de menace modélisés par EBIOS Risk Manager et STRIDE,
concevoir une architecture qui les realise, la construire intégralement en Infrastructure as
Code, et la confronter enfin à l'épreuve de la mesure.

**Les résultats obtenus répondent aux six objectifs fixés.** Le pare-feu unique a été
remplacé par un modèle en couches où chaque composant possède sa propre identité et ses
propres droits. Les données Cloud SQL sont inaccessibles depuis Internet, accessible
uniquement en IP privée via le Private Service Access. L'intégralité de l'infrastructure
est décrite en Terraform, versionnée et scannée avant tout déploiement. La chaîne de
livraison applique trois portes de contrôle bloquantes — secret scanning, analyse statique
et scan de vulnérabilités — dont quatre cas de refus ont été démontrés. Le déploiement est
réalisé par étiquette immuable égale au SHA du commit. La chaîne de détection, construite
sur BigQuery, traite les journaux de toutes les couches et les associe à des techniques
d'attaque connues via un enrichissement sémantique réalisé avec le modèle ATT&CK-BERT.

**Les mesures ont révélé des écarts significatifs** entre les estimations initiales et la
réalité. Le temps de cold start du service d'enrichissement, estimé à quelques secondes,
a été mesuré à vingt-sept secondes en moyenne avec un pic de quatre-vingt-quatorze
secondes — un écart de plus d'un ordre de grandeur qui a conduit à revoir le
dimensionnement. La journalisation des refus réseau a été activée le 19/08/2026, corrigeant
l'écart É1. Le retour arrière applicatif a été mesuré : 11,6 secondes pour basculer vers
une révision antérieure, 16,5 secondes pour revenir. Et surtout, l'enrichissement
sémantique, bien que fonctionnel, n'alimente pas encore le score d'incident présenté à
l'analyste — cette intégration reste à compléter.

**Les difficultés rencontrées** ont été rapportées sans aveuglement : estimation erronée
des performances, état Terraform désynchronisé après une application partiellement échouée,
accumulation de déchets dans BigQuery, et une porte SAST en faux vert pendant dix-sept
jours. Chacune a produit une correction documentée et une leçon transférable, intégrée aux
procédures.

**Les apports du projet sont doubles.** Pour l'entreprise MENAL-SARL, le socle constitue
un actif réutilisable : l'accueil du second locataire ELSON en cours de projet démontre
qu'un nouveau client peut être accueilli sans reconception. Le module d'infrastructure est
paramétrique, chaque application reçoit sa propre identité, et une procédure d'accueil a
été rédigée. Les limites de l'isolation (applicative et par identité, pas réseau) sont
documentées comme points d'amélioration. Pour l'élève-ingénieur, le projet a permis de
confronter des connaissances théoriques — architecture Zero Trust, modélisation des menaces,
Machine Learning — à des réalités opérationnelles : dimensionnement de services serverless,
gestion d'état Terraform, discipline de chaîne de preuve. La compétence la plus utile
acquise n'est pas technique : c'est la capacité à documenter des écarts plutôt qu'à les
contourner.

**Les perspectives d'approfondissement** portent sur les sept composants évalués puis
écartés au chapitre 4 : VPC Service Controls, GKE avec service mesh, Memorystore pour
le cache distribué, multi-région et reprise d'activité, Binary Authorization, IAP devant
le dashboard, et LLM génératif pour l'enrichissement. Chacun devient réévaluable lorsque
les conditions qui ont motivé son refus évoluent — et le registre des décisions qui les
documente constitue la feuille de route naturelle du projet.
