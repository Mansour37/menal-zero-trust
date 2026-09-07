# Introduction Générale

La sécurité des systèmes d'information des entreprises émergentes repose encore largement
sur un modèle périmétrique : un pare-feu unique sépare l'intérieur de l'extérieur, et tout
ce qui se trouve de l'autre côté du pare-feu est considéré comme hostile, tandis que tout
ce qui se trouve de ce côté-ci est considéré comme digne de confiance. Ce modèle, qui a
dominé l'ingénierie de sécurité pendant trois décennies, montre ses limites face à des
menaces qui contournent désormais les frontières — compromission d'identités légitimes,
attaques de la chaîne d'approvisionnement, mouvements latéraux après intrusion.

MENAL-SARL, entreprise mauritanienne de services informatiques et de cybersécurité, a
identifié ce constat comme un obstacle au développement de son activité de prestataire
cloud. L'application hébergée — ELSON, plateforme de crowdsourcing linguistique — repose
sur un environnement dont l'infrastructure n'est pas reproductible, dont les identités
techniques ne sont pas isolées et dont la chaîne de détection des menaces n'existe pas.
L'audit technique mené en début de projet a identifié six carences bloquantes et 41 critères
de préparation dont 23 n'étaient pas satisfaits.

Le problème posé par ce projet est le suivant : **comment construire, à partir de zéro, un
socle d'hébergement cloud qui applique les principes Zero Trust tout en restantsimple
 enough to be operated by a small team of five engineers?**

La démarche adoptée a suivi cinq phases : audit de l'état existant et analyse des menaces,
conception d'une architecture en couches fondée sur le référentiel NIST SP 800-207,
réalisation en Infrastructure as Code avec Terraform, mise en place de chaînes de livraison
et de détection automatisées, et enfin validation par une campagne de vingt tests adverses
et des mesures de performance, de coût et de couverture de détection.

Les objectifs fixés étaient six : éliminer la dépendance à un pare-feu unique, fournir
une identité distincte à chaque charge de travail, rendre les données inaccessibles depuis
Internet, décrire toute l'infrastructure en code, contrôler automatiquement chaque livraison,
et construire une capacité de détection des menaces alimentée par l'enrichissement
sémantique des alertes.

Le présent mémoire s'organise en six chapitres. Le premier expose le cadre général et
l'étude de l'existant, en présentant l'entreprise d'accueil, l'application pilote et les
résultats de l'audit. Le second passe en revue l'état de l'art en matière d'architecture
Zero Trust, d'approche DevSecOps et d'enrichissement sémantique des alertes, et positionne
le projet par rapport aux travaux existants. Le troisième modélise les menaces par la
méthode EBIOS Risk Manager et dérive vingt exigences de sécurité, chacune rattachée à un
test de validation. Le quatrième présente l'architecture conçue : un modèle en couches et
deux plans transversaux (identité et observabilité), avec un registre de treize décisions
d'architecture justifiées. Le cinquième rend compte de la réalisation : l'infrastructure
en code, les chaînes de livraison et de détection, la couche d'enrichissement sémantique,
l'accueil d'un second locataire, et les quatre incidents d'ingénierie survenus pendant le
projet. Le sixième confronte
l'ensemble à l'épreuve de la mesure : vingt tests de validation, évaluation de la
couverture de détection et de la qualité de l'enrichissement sémantique, objectifs de
service observés, coût réel et limites identifiées.
