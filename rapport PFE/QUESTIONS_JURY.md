# QUESTIONS DU JURY — 18 questions probables

> Pour chacune : la section qui y répond dans le rapport, et la réponse en trois lignes.
> Toutes les valeurs citées ici figurent dans le rapport avec leur date. État au 26/08/2026.

---

**1. Qu'avez-vous fait personnellement, par rapport à l'application qui existait déjà ?** — §1.1.3, §1.3.2, §5.10.1

Le code applicatif d'ELSON est hors périmètre : je ne l'ai pas écrit et je ne l'ai pas corrigé. J'ai audité l'existant, dérivé les exigences, conçu l'architecture, écrit l'infrastructure en code, construit les deux chaînes de livraison et la chaîne de détection, puis mené la campagne de validation.

**2. Combien de temps s'écoule entre l'attaque et l'alerte ?** — §4.4, §6.3.3

Le blocage est synchrone, au périmètre, avant que la requête n'atteigne l'application. La qualification en incident dépend de la requête planifiée : règles réévaluées toutes les 5 min sur une fenêtre glissante de 15 min. Deux mesures : 6 min 15 s le 10/08, environ 15 min le 19/08. C'est un choix de coût, pas une limite technique.

**3. Pourquoi douze tests sur vingt n'ont-ils pas été exécutés ?** — §6.2

Par manque de temps de campagne en fin de projet, pas par absence de dispositif : chaque protocole est écrit et publié en annexe E, et chacun se ramène à une commande ou à un commit. La priorité a été donnée aux correctifs d'infrastructure du 19/08, qui conditionnaient la validité des tests eux-mêmes.

**4. Deux locataires dans un seul réseau privé, est-ce une isolation réelle ?** — §5.9.2, §6.8

Non, et le rapport le dit. L'isolation est réalisée par l'identité, les secrets et la base de données ; le réseau privé, le connecteur et l'instance de base restent partagés. Le 19/08, une connexion croisée a été réellement tentée et refusée, six vérifications sur six. La segmentation réseau par locataire est la première perspective.

**5. Vos politiques d'organisation sont-elles en vigueur ?** — §4.6, §5.1.1, écart É7

Non. Elles sont définies dans le code mais inapplicables : elles supposent une organisation cloud qui n'existe pas dans le périmètre administratif disponible. Les interdictions correspondantes sont portées par la configuration des modules, l'analyse automatisée et la revue du plan. L'absence de clé est vérifiée par inventaire, pas garantie structurellement.

**6. Déployez-vous par empreinte ou par étiquette ?** — §4.2.3, §5.3.1, écart É8

Par étiquette immuable égale au SHA du commit. L'étiquette identifie le commit et n'est jamais réaffectée, mais elle ne garantit pas à elle seule que le contenu de l'image est inchangé : seule l'empreinte l'assure. Le chemin d'amorçage résout une empreinte, le chemin quotidien s'arrête à l'étiquette. L'unification reste l'écart É8, et le critère de T9 a été révisé.

**7. Vous parlez de détection comme code, mais vos règles ne sont pas des règles Sigma.** — §2.3.2, §5.5.2

Exact. Aucun moteur de conversion pris en charge ne cible l'entrepôt de données retenu. Les règles sont donc du SQL écrit et versionné à la main, avec un gabarit systématique. Le rapport n'emploie pas le format comme un label : il en tire la conséquence, un plafond de couverture lié au coût de traduction manuelle.

**8. À quoi sert le modèle sémantique si le score d'incident l'ignore ?** — §5.6.2, §6.4

Il fournit à l'analyste, depuis chaque alerte, une technique candidate et la procédure associée, ce qui raccourcit la qualification manuelle. Ce que le rapport ne peut pas affirmer, faute de mesure comparative, c'est que ce rattachement soit assez précis pour être automatisé dans le calcul de priorité. La décision de ne pas le joindre au score est datée du 25/08.

**9. Reconstruction, retour arrière, restauration : lesquels sont mesurés ?** — §6.5.2

Restauration mesurée le 03/08 : 32 min 45 s, 314 lignes sur 314 au point demandé, aucune perte de données ; mesure faite sur configuration zonale, avant le passage en haute disponibilité régionale du 08/08. Retour arrière applicatif mesuré le 07/08 : 11,6 s et 16,5 s selon le sens de bascule. Reconstruction complète : non chronométrée, et le rapport ne la compte pas comme résultat.

**10. Combien coûte ce socle par mois ?** — §6.5.3

Aucun relevé de facturation ventilé n'a été produit : le rapport ne publie donc aucun montant par poste. Le seul fait attesté est un ordre de grandeur de quelques dizaines d'euros par mois, poste dominant l'ingestion de journaux. Un tableau donne l'ordre de grandeur reconstitué à partir du dimensionnement réellement déclaré dans le code, présenté comme reconstitution et non comme mesure.

**11. Quel est votre taux de faux positifs ?** — §6.3.3, §6.8

Il n'est pas établi, et le rapport l'écrit. La recette ne reçoit pas de trafic d'utilisateurs réels : sans population légitime, un taux de faux positifs n'a pas de sens statistique. La requête légitime en 200 du scénario du 19/08 est une observation ponctuelle, pas une mesure.

**12. Qu'est-ce que votre système ne détecte pas ?** — §6.3.2

Sept causes de non-couverture sont listées : exfiltration de données, abus des droits et du plan de contrôle, seuils codés en dur, absence de test unitaire par règle, plafond de traduction manuelle, absence de trafic réel, journalisation des refus réseau non rejouée. Le rapport publie la liste plutôt qu'un taux, faute d'inventaire versionné du dénominateur.

**13. Un motif d'attaque est passé à travers le filtrage. Lequel, et pourquoi ?** — §6.2, §6.7.4, test T1

Un motif de traversée de chemin envoyé brut a reçu une redirection 302 au lieu d'un refus 403 : le filtrage le traite par redirection, faute de règle de blocage couvrant cette forme. Le contrôle attendu par EX1 n'est donc pas complet, et T1 reste partiellement conforme jusqu'à l'ajout de la règle et son rejeu.

**14. Pourquoi un entrepôt de données généraliste plutôt qu'une solution de supervision ?** — §2.3.1, §2.3.4

Le modèle économique d'une solution commerciale facture le volume ingéré, ce qui est incompatible avec le budget. Le critère décisif est autre : l'entrepôt permet d'appliquer un traitement automatique aux alertes stockées sans les exporter. Le prix payé est explicite : ni règles, ni interface, ni corrélation fournies.

**15. Comment traitez-vous le RGPD et les données biométriques ?** — §1.5.1

Le socle prend en charge trois obligations techniques : hébergement dans une région unique et documentée, chiffrement par clés gérées des secrets et de l'espace média, journalisation centralisée des accès d'administration. La base légale, la durée de conservation et le droit d'effacement relèvent du responsable de traitement : c'est la carence C5, non refermée par ce projet.

**16. Qu'y a-t-il de nouveau dans votre travail ?** — §2.6.2, §5.8

Aucune contribution théorique n'est revendiquée. La contribution est d'ingénierie, en quatre points : une architecture Zero Trust dimensionnée pour une contrainte réelle, une chaîne de détection versionnée sur entrepôt généraliste avec ses limites publiées, un protocole d'évaluation du modèle sémantique, et le prototype de boucle entre livraison et détection.

**17. Votre planning tenait-il ?** — §5.10.4

Le calendrier prévisionnel n'a pas été conservé : le diagramme trace le réalisé seul, et la légende le dit. Les jalons sont datés du 29/07 au 23/08. Deux changements aux objectifs initiaux sont documentés : abandon du quatrième projet d'amorçage et simplification de la fédération d'identité.

**18. Pourquoi deux environnements seulement ?** — §5.1.1

La recette porte la topologie complète de la cible, ce qui rend les mesures représentatives ; la production ne sera provisionnée qu'à la première mise en service réelle. Un troisième environnement permanent aurait ajouté un coût récurrent sans apporter de contrôle nouveau. Le rapport signale la contrepartie : l'environnement de développement n'est pas un miroir fidèle, et la chaîne de promotion complète n'a jamais été déroulée.

---

## Trois questions pièges à préparer en plus

**« Votre haute disponibilité, l'avez-vous testée ? »** — Non. La bascule régionale est appliquée et confirmée en direct depuis le 08/08/2026, mais le basculement de zone n'a jamais été provoqué. Le dire avant qu'on le demande.

**« Votre graphique de couverture ATT&CK, où est-il ? »** — Il n'existe pas, volontairement : publier un taux exigerait un dénominateur versionné qui n'a pas été constitué. Le rapport publie la liste des angles morts à la place.

**« Vos captures d'écran manquent pour douze tests. »** — Ces douze tests sont déclarés non exécutés dans le rapport lui-même. Produire une capture les concernant serait une contradiction interne. L'annexe H donne, pour chacun, la capture attendue et ce qu'elle devra montrer.
