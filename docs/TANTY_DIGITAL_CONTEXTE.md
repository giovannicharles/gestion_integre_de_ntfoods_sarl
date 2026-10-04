# TANTY DIGITAL ERP — Contexte technique complet

*Document de référence à placer dans le dépôt (ex. `docs/TANTY_DIGITAL_CONTEXTE.md`) et à fournir à Claude Code au début de chaque session.*

**Règle de préséance :** ce document fait foi pour les **règles métier, les principes et les standards**. Le **code réel** fait foi pour les **noms techniques déjà existants** (entités, enums, statuts, packages). Tout écart entre les deux est **signalé et soumis à validation**, jamais résolu en silence.

**Ce document est un instantané.** Des fonctionnalités, entités, endpoints, écrans et modules ont été ajoutés depuis sa rédaction et continueront de l'être. Ne présume jamais qu'un élément n'existe pas, ni qu'il est conforme : vérifie dans le dépôt (§0.4).

---

## 0. Comment l'agent doit travailler (Claude Code)

Tu es un agent de développement senior sur un ERP réel, utilisé par une vraie entreprise. Tu travailles avec la discipline suivante. Elle prime sur la vitesse.

### 0.0 Porte d'entrée obligatoire — identifier les dossiers du projet complet

**Avant toute autre action** (avant d'auditer, de corriger, de créer un fichier), tu me dis, preuves à l'appui, **quel dossier est l'API du projet complet** et **quel dossier est le frontend du projet complet**. Puis tu t'arrêtes et tu attends ma confirmation explicite. Cette étape est **strictement en lecture seule** : aucun `git checkout`, `commit`, `stash`, `reset`, `clean`, `pull`, aucune installation, aucune écriture.

**Point de départ (indices, pas des faits — à vérifier).** Racine de travail : `D:\SAINT JEAN\ME\LICENCE 3 ISJ 2025-2026\STAGE DE FIN DE CYCLE\Developpement\local\tanty_erp` (chemins avec espaces : toujours entre guillemets). Les notes de `docs/CONTINUATION_ERP_TANTY.md` désignent :

| Rôle supposé | Dossier | Remarque |
|---|---|---|
| Cible API (projet complet) | `api_erp_tanty` | Devrait réunir Stock + modules ajoutés |
| Cible frontend (projet complet) | `tanty_digital_pwa` | |
| Source copiée : module Stock (API) | `Api_tanty` | |
| Source censée contenir Production, Commercialisation… | `tanty_erp_api_pwa` | Signalé vide ou mal structuré |
| Source copiée : module Stock (front) | `src` | |
| Source censée contenir les autres modules front | `frontend_autres_modules` | Signalé vide |
| Archives | fichiers `.rar` | Sauvegardes possibles |

**Vérification (lecture seule), pour chaque candidat :**

- **API :** racine git (`git rev-parse --show-toplevel`), remote, branche courante, 5 derniers commits, `git status --short` ; `pom.xml` / `build.gradle` ; classe `@SpringBootApplication` et package racine (`com.NTFOODS.erp_tanty` attendu) ; dossiers sous `modules/` et `shared/` avec le nombre de fichiers `.java` par module ; migrations présentes ; date de dernière modification.
- **Frontend :** `package.json`, `angular.json`, version d'Angular, dossiers `domains/`, `core/`, `shared/`, nombre de composants par domaine ; informations git identiques.
- Si possible sans rien écrire dans le dépôt : compilation à blanc de l'API et build du frontend ; signale les erreurs, ne les corrige pas.
- Ignore `node_modules`, `target`, `dist`, `.git` pendant l'exploration.
- Repère les **doublons et divergences** (même module présent à deux endroits avec des contenus différents).

**Critères de choix :** le dossier retenu (a) contient le plus de modules attendus, (b) a l'historique git le plus récent et cohérent, (c) contient à la fois le module Stock et les ajouts signalés (conditionnement, formulation, `shared/validation`…). En cas d'égalité ou de doute : **ne tranche pas**, présente les options.

**Livrable de la porte (25 lignes maximum) :**

```
API du projet complet        : <chemin>   (preuves : …)
Frontend du projet complet   : <chemin>   (preuves : …)
Dossiers sources / doublons  : <liste + rôle constaté>
Modules côté API             : présents <liste> | attendus mais absents <liste>
Contradictions avec docs/CONTINUATION_ERP_TANTY.md : <liste>
Question(s)                  : …
```

Ensuite **STOP** jusqu'à ma confirmation. Une fois confirmé, propose de copier `CLAUDE.md` et `docs/` dans le dépôt API confirmé (et un `CLAUDE.md` adapté dans le frontend) ; je valide avant.

### 0.1 Les 12 règles

1. **Explorer avant d'écrire.** Lis les fichiers, cherche les usages, comprends le code existant. Ne suppose jamais le contenu d'un fichier que tu n'as pas ouvert.
2. **Planifier avant de modifier** (utilise le mode plan). Avant tout changement, écris un plan court : objectif, fichiers touchés, risques, tests prévus. Pour tout changement de schéma, de sécurité, ou touchant plus de 5 fichiers, **attends la validation du plan**.
3. **Petits incréments.** Une tranche verticale à la fois (ex. « demande de réapprovisionnement du tampon, de bout en bout »), pas dix modules à moitié. Diff minimal, pas de refactor « au passage ».
4. **Prouver, pas affirmer.** Compile, lance les tests, lance l'application. Montre la sortie des commandes. Ne dis jamais « c'est terminé » sans preuve d'exécution.
5. **Les règles métier d'abord en tests.** Les invariants (stock jamais négatif, double validation, séparation des rôles) sont écrits comme tests avant ou avec le code.
6. **Ne jamais inventer.** Si une règle est ambiguë ou absente de ce document : **stop**, pose la question avec 2–3 options et ta recommandation. Ne tranche pas arbitrairement.
7. **Aucun geste destructif.** Pas de suppression de données ni de fichiers, pas de `git push --force`, `reset --hard`, `clean`, `stash`, `rebase`, pas de `DROP`, pas de modification de modules non concernés sans accord explicite. Travaille sur une **branche dédiée**. **Avant chaque commit, relis `git diff --stat`** : toute suppression de fichiers entiers ou de plus de 20 lignes non prévue au plan est un **STOP**. Un commit = un objectif ; jamais de suppression massive mêlée à une fonctionnalité.
8. **Ne jamais affaiblir la sécurité pour faire passer un test** (désactiver un filtre, élargir un `permitAll`, ajouter un `catch (Exception)` muet). Si un test échoue, corrige la cause.
9. **Respecter les conventions existantes** (DDD 4 couches, nommage, structure des packages) — celles du module Stock sont la référence.
10. **Cause racine.** Pour un bug : reproduis, formule une hypothèse, vérifie, corrige la cause, ajoute un test de non-régression.
11. **Honnêteté.** Signale ce qui n'est pas fait, ce qui est incertain, ce qui a été contourné. Un « je ne sais pas encore » vaut mieux qu'un faux « ça marche ».
12. **Mémoire de projet.** Au début de chaque session, relis ce document. À la fin de chaque itération, mets à jour `docs/PROGRESS.md` (fait / en cours / décisions / points ouverts).

### 0.2 Format de compte rendu à chaque itération

```
FAIT            : ce qui est livré (1-5 lignes)
FICHIERS        : créés / modifiés (liste)
PREUVES         : commandes lancées + résultat (build, tests, appel d'endpoint)
ÉCARTS DÉTECTÉS : différences spec ↔ code, incohérences entre modules
À VALIDER       : décisions qui me reviennent (options + recommandation)
SUIVANT         : prochaine tranche proposée
```

### 0.3 Checklist par endpoint (Definition of Done)

- [ ] DTO d'entrée/sortie dédiés — **aucune entité JPA exposée**
- [ ] Validation stricte des entrées (Bean Validation) + messages d'erreur homogènes
- [ ] Autorisation : rôle/permission **et** contrôle au niveau de l'objet (pas seulement `@PreAuthorize`)
- [ ] Écriture de stock **uniquement** via le circuit de demande/validation (§6)
- [ ] Soft delete respecté (§7) — aucun `DELETE` physique
- [ ] Action journalisée dans l'audit trail (qui, quoi, quand, avant/après)
- [ ] Pagination sur toute liste
- [ ] Documenté Swagger/OpenAPI, avec le **pourquoi métier**
- [ ] Tests unitaires (règles domaine) + test d'intégration (Testcontainers PostgreSQL)
- [ ] Aucune valeur métier codée en dur (§8.4 et §10)
- [ ] `git diff --stat` relu : aucune suppression non prévue

### 0.4 Le projet évolue : rester synchronisé avec l'existant

Le dépôt avance plus vite que ce document. Ton travail n'est correct que s'il repose sur **l'état réel du code**, pas sur ce que tu crois ou sur ce que dit ce texte.

**Protocole de synchronisation** — au début de chaque session et avant chaque tranche :

1. **Détecter ce qui a changé.** Lis `docs/PROGRESS.md` (champ « Dernier état synchronisé : `<hash>` »), puis `git log --oneline <hash>..HEAD`, `git status` et `git diff --stat`. Si le champ est vide, considère que tout est à inventorier.
2. **Inventorier la zone concernée** : entités et tables, endpoints (`@RequestMapping`/`@GetMapping`…), enums et statuts, services, listeners RabbitMQ, événements, composants et routes Angular. Recherche par grep, sans lire des dossiers entiers.
3. **Ne jamais dupliquer.** Avant de créer un service, DTO, enum, composant ou table, cherche si le concept existe déjà (noms français **et** anglais, synonymes). Réutilise ou étends, ne recrée pas.
4. **Une fonctionnalité ajoutée et absente de ce document est légitime** : elle a été voulue par le porteur. Ne la supprime pas, ne la « corrige » pas pour la faire coller au texte. Si elle viole une règle non négociable (écriture de stock hors circuit de validation, suppression physique, faille de sécurité), signale-la dans `ÉCARTS DÉTECTÉS` avec une proposition de mise en conformité, **sans la casser** ni la modifier avant validation.
5. **Règle de conflit code ↔ document :**
   - noms techniques (entités, statuts, packages) : **le code gagne** ;
   - règles métier, sécurité, invariants : **le document gagne**, mais tu demandes avant de changer un comportement déjà utilisé ;
   - cas ambigu : **question**, pas de décision seul.
6. **Non-régression.** Avant de modifier une zone : lance les tests existants et note ce qui échoue déjà (ligne de base). Ne fais jamais échouer plus qu'avant. Si un comportement existant n'a pas de test, écris d'abord un **test de caractérisation** qui le fige, puis modifie.
7. **Tenir la carte à jour.** `docs/CODEBASE_MAP.md` est la carte vivante du projet (modules, entités, endpoints, événements, écrans, dépendances entre modules). Tu la relis avant de coder et tu la mets à jour à la fin de chaque tranche, uniquement pour la zone touchée. Mets ensuite à jour le hash dans `docs/PROGRESS.md`.

### 0.5 Précision et efficacité

- **Lecture ciblée.** Cherche (grep, recherche de symboles) avant d'ouvrir. Lis en entier les fichiers que tu modifies, pas ceux que tu ne touches pas.
- **Compte rendu court.** Format §0.2, 30 lignes maximum hors preuves. Pas de récit, pas de répétition du code déjà visible dans le diff, pas d'explication de l'évident.
- **Précision vérifiable.** Cite `chemin:ligne`, noms exacts, commandes exactes, chiffres mesurés. Distingue toujours **« vérifié »** (tu l'as exécuté ou lu) de **« supposé »**.
- **Périmètre strict.** Une tranche = un objectif. Le livrable minimal qui satisfait la Definition of Done. Pas de fonctionnalité bonus, pas d'« amélioration » non demandée, pas d'abstraction spéculative.
- **Tests dans le bon ordre.** Tests ciblés pendant le travail, suite complète une seule fois avant de conclure.
- **Ne pas s'acharner.** Deux tentatives maximum sur une même approche ; ensuite, remonte ce que tu as observé et propose une alternative.
- **Réutiliser avant de créer** (§0.4, point 3).

---

## 1. Vision & contexte

**NTFOODS SARL** (marque **TANTY**, gamme REINE) est une entreprise agroalimentaire camerounaise de transformation de produits locaux (bouillies de soja, à grignoter, ingrédients culinaires, TANTY CHOCO). Elle croît vite, mais gère ses stocks à ~99 % sur Excel et papier : pas de traçabilité temps réel, doubles validations par signature papier, dotations et invendus des commerciaux suivis à la main, magasin tampon sans seuil ni alerte.

**TANTY DIGITAL** est l'ERP interne qui digitalise le cycle complet, **de la matière première au franc CFA encaissé** : production, stocks, commercialisation, caisse, contrôle de gestion, comptabilité, administration.

- Porteur : Direction Générale de NTFOODS (Dr. NYAMEN Thierry)
- Équipe : petite équipe de développement, un module par développeur ; **le module Stock est la référence d'architecture** pour tous les autres
- Environnement : développement assisté par IA (Claude Code), pilotage par prompts structurés, **chaque livraison est un brouillon relu de façon critique** avant acceptation
- Contraintes terrain : coupures d'électricité, connexion internet intermittente, utilisateurs peu techniques

**Principe directeur :** un stock qui bouge sans trace et sans deuxième paire d'yeux est un stock qui se perd. Le logiciel doit rendre la **bonne pratique plus simple que la mauvaise**.

---

## 2. Acteurs et rôles

| Acteur | Rôle dans le système |
|---|---|
| **Gestionnaire de stock** | Acteur central du module : réceptions, demandes de réapprovisionnement, dotations, inventaires, rapports |
| **Chef de production** | Déclare les lots fabriqués ; valide les bons de commande de produits finis |
| **Contrôleur général** | Validateur des consommables, des ajustements, des avaries, des réapprovisionnements du tampon (à confirmer §12) |
| **Comptable** | Validateur des matières premières ; signature comptable des chargements |
| **Commercial** | Demande des dotations, détient un stock mobile, déclare ses ventes et invendus |
| **Secrétaire / Caissière** | Signature caisse des chargements, saisie des ventes |
| **Directeur Général (DG)** | Définit les seuils, autorise les dérogations, valide les cas critiques, consulte les tableaux de bord |
| **Contrôleur de gestion** | Contrôle des caisses et de la bonne marche des services, rapports |
| **Responsable achats** | Achats de matières premières, consommables |
| **Administrateur système** | Rôle technique, **distinct** du DG : comptes, paramètres, maintenance |

> Les personnes titulaires (gestionnaire, chef de production, comptable…) sont des **données de seed en développement uniquement**, jamais des constantes de code.

**Principe RBAC :** un utilisateur peut avoir plusieurs rôles, mais **jamais deux étapes de validation d'une même demande** (§6.3). Les noms exacts des rôles viennent du code (attention au préfixe `ROLE_` : ne pas le doubler).

---

## 3. Modules et périmètre

| Module | Contenu | Statut |
|---|---|---|
| Authentification & administration | JWT, 2FA/OTP, rôles, utilisateurs, paramètres système | En place — à durcir (§8) |
| **Stock** | Réception, stock central, tampon, dotation, stock mobile, seuils, alertes, reporting | **Référence — à terminer et à généraliser en double validation** |
| Production | Déclaration des lots, bons de commande PF, OF, PPH, broyage, dosage, fiches, registres | **Signalé supprimé par erreur — à restaurer (§12.4)** |
| Commercialisation | Ventes, commerciaux, clients, chargements | Intégré |
| Caisse | Encaissements, RG-10 (double signature) | Intégré |
| Comptabilité / Contrôle de gestion | Écritures, rapports financiers | Intégré (partiel) |

**Modules et briques signalés comme ajoutés (à vérifier, §12.2) :** `conditionnement`, formulation (dans Stock), `shared` (audit, événements, notifications, IA par module, **validation**, `BaseEntity`), `admin` (paramètres système), `dg`, `incidents`. `commercial` et `commercialisation` sont à **unifier** en un seul module ; `admin` désigne la gestion du système (§12.3 n° 9).

**Hors périmètre V1 (voir §9.5) :** mode offline, scan code-barres, IA prédictive, multi-tenant, réappro automatique du tampon sans validation, virement de stock entre commerciaux.

---

## 4. Architecture

### 4.1 Vue d'ensemble

**Monolithe modulaire** : un seul déploiement Spring Boot, découpé en modules métier étanches. Choix assumé : une petite équipe, un seul serveur, un besoin de cohérence transactionnelle forte entre stock, production et caisse. Les microservices seraient une sur-ingénierie coûteuse à ce stade.

### 4.2 Stack

| Couche | Technologie |
|---|---|
| Frontend | Angular 18 (standalone components, signals, lazy loading), Chart.js |
| Backend | Java, Spring Boot 3.x, Spring Security, Spring Data JPA/Hibernate |
| Base de données | PostgreSQL (`erp_tanty_db`) |
| Messagerie | RabbitMQ (exchange `tanty.events`) |
| Temps réel | WebSocket (`/ws`) |
| Exports | Apache POI (Excel), iText (PDF) |
| Documentation API | Swagger / OpenAPI |
| Tests | JUnit 5, Mockito, **Testcontainers PostgreSQL (H2 exclu)** |
| Modélisation | PlantUML, Mermaid |

### 4.3 Architecture DDD 4 couches (par module)

```
domain/          entités, value objects, règles métier, événements de domaine, ports (interfaces)
application/     cas d'usage, services applicatifs, transactions, orchestration
infrastructure/  JPA (adapters de repositories), RabbitMQ, stockage fichiers, exports
presentation/    controllers REST, DTO, validation d'entrée, mapping
```

Règles de dépendance : `presentation → application → domain` ; `infrastructure → domain` (implémente les ports). **Le domaine ne dépend de rien** (ni Spring, ni JPA si possible).

### 4.4 Règles d'intégration inter-modules

- **Appels synchrones entre modules = injection directe de services applicatifs** (monolithe). **Jamais de REST interne.**
- Un module n'appelle **jamais** le repository ou l'entité JPA d'un autre module — uniquement ses **ports publics** (ex. `StockQueryPort`, `StockCommandPort`).
- **Événements asynchrones** (RabbitMQ `tanty.events`) pour ce qui n'a pas besoin de réponse immédiate (notifications, comptabilité, alertes).
- Publier un événement **après commit** (`@TransactionalEventListener(phase = AFTER_COMMIT)`) pour ne jamais annoncer un fait qui sera annulé.
- Entités partagées (`Produit`, `Client`…) : **une seule définition canonique**, celle du module Stock pour le produit. Enums divergents, conventions d'ID différentes, modèles de rôles incompatibles : à détecter par l'audit (§13, Phase 0), pas à deviner.
- **Enforcement automatique :** tests **ArchUnit** qui font échouer le build si une couche ou un module est contourné.

### 4.5 Isolation des logiques transverses

Stockage de fichiers, notifications, cache, temps réel, envoi SMS/email : **tout passe par une interface** (`StorageService`, `NotificationService`, `CacheService`…), jamais d'appel direct depuis le code métier. Cela permet de changer une brique (fournisseur SMS, stockage externe, Redis) sans chasse dans toute la base de code.

---

## 5. Module Stock — règles métier de référence

### 5.1 Les magasins

| Magasin | Contenu | Particularités |
|---|---|---|
| Matières premières (MP) | Maïs, soja, arachide, sucre, farine | Réception validée par le **Comptable** |
| Consommables | Sachets, seaux, cartons | Souvent importés (délai 5–6 mois) ; réception validée par le **Contrôleur général** |
| Produits finis — **Stock central** (réserve) | Produits TANTY prêts à vendre | Alimenté par la production |
| Produits finis — **Magasin tampon** (picking rapide) | Zone de préparation des dotations | Alimenté **depuis le central** ; les dotations se prélèvent **sur le tampon, jamais sur le central** |
| **Stock mobile** (par commercial) | Produits détenus par chaque commercial | Les **invendus ne retournent pas** au central |

### 5.2 Sous-domaines logiques

Réception · Dotation · Stock central · Magasin tampon · Stock mobile · Seuils · Alertes · Reporting. *(Le code peut en contenir davantage — ex. 16 sous-domaines : l'audit les cartographie.)*

### 5.3 Invariants (jamais violés, testés)

1. **Le stock n'est jamais négatif.** Contrôlé dans le domaine **et** par contrainte SQL `CHECK (quantity >= 0)` (en local : `@Check` sur l'entité, puisque le schéma est généré).
2. **Tout changement de quantité = un mouvement de stock** (`StockMovement`), append-only, horodaté, avec l'auteur et la **référence de la demande approuvée** qui l'a causé.
3. **Le niveau de stock est cohérent avec les mouvements** : un job de réconciliation compare niveau ↔ somme des mouvements et alerte en cas d'écart.
4. **Un seul chemin d'écriture** : `StockLedger.post(...)` — appelé uniquement par les handlers d'actions approuvées (§6). Aucun controller ni service ne modifie un niveau directement.
5. **Une réception n'augmente le stock qu'à la validation finale** — jamais avant.
6. **Concurrence :** verrouillage optimiste (`@Version`) sur niveaux et demandes ; verrou pessimiste court lors d'un transfert ; **une demande ne s'exécute qu'une fois** (idempotence).
7. **Conditionnements :** les conversions d'unités (kg → sachets, cartons → unités) sont centralisées dans un service unique avec règle d'arrondi explicite.

### 5.4 Règles par sous-domaine

**Réception**
- Numéro unique `RCP-YYYYMMDD-NNNN`. Quantité négative refusée. **Motif obligatoire en cas d'écart** entre commandé et reçu.
- Trois circuits **déjà implémentés — ne pas les casser** :
  - `CONSOMMABLE` → Gestionnaire → **Contrôleur général**
  - `MATIERE_PREMIERE` → Gestionnaire → **Comptable** (pas le Chef de production)
  - `PRODUIT_FINI` → **Responsable production** → **Gestionnaire**
- Mauvais rôle → 403. Rejet possible à chaque étape, motif obligatoire. Comptage contradictoire (livré vs trouvé → verrouillage). Avarie > 5 % → photo obligatoire.

**Stock central** : niveaux par produit/magasin, historique des mouvements, ajustement d'inventaire = mouvement `AJUSTEMENT` calculé sur l'écart (théorique vs compté).

**Magasin tampon** : réapprovisionnement depuis le central (`TRANSFERT_POUR_TAMPON`), bloqué si central insuffisant. Le système **propose** la quantité recommandée d'après les seuils.

**Dotation** : demande du commercial → approbation du gestionnaire → **exécution automatique** (tampon ↓, stock mobile ↑, mouvement `SORTIE_COMMERCIAL`). Disponibilité vérifiée **sur le tampon**. Gestion des conditionnements. La règle **RG-10** des chargements (double signature Secrétaire **et** Comptable) reste en vigueur.

**Stock mobile** : quantités détenues, dernière dotation, historique ventes/dotations, invendus non retournés. Le commercial ne voit que **son** stock.

**Seuils** : définis par le DG (global / catégorie / produit / tampon), avec **historique** (qui, quand, ancienne valeur, nouvelle valeur). Cohérence : voir §12 (le sens de la contrainte déclenchement/sécurité est à confirmer).

**Alertes** : statuts `ACTIVE → ACQUITTEE → RESOLUE` ; résolution automatique quand le seuil n'est plus violé ; génération planifiée (`@Scheduled`) et sur événement ; alerte tampon sous seuil → propose de créer la demande de réapprovisionnement.

**Reporting** : lecture seule, génération **asynchrone** (`@Async`), export PDF/Excel, stockage du fichier via `StorageService`.

**Bouclage journalier** (référence) : `Stock initial + Production validée − Retours = Ventes déclarées validées`.

### 5.5 Matrice de complétude backend (à remplir par l'audit)

Pour chaque sous-domaine : `entités | repositories | services | controllers | règles métier | double validation | audit | tests | Swagger` → état **complet / partiel / absent / cassé**. La mission « terminer le backend du module Stock » = faire passer toute la matrice à **complet**, dans l'ordre de priorité du §13.

---

## 6. Double validation généralisée — le moteur d'approbation

### 6.0 Réutiliser l'existant — `shared/validation`

Le projet contient déjà (signalé, à vérifier) `shared/validation` : `ValidationWorkflow`, `ValidationRequest`, `ValidationStep`, `ValidationRecord`, `CodeValidation`, `ValidationWorkflowService`, `CodeValidationService`, ainsi que `docs/ARCHITECTURE_VALIDATION_DELEGATION.md`. **Ce chapitre est une spécification de comportement, pas une seconde implémentation.** Marche à suivre : (1) lire l'existant et sa documentation ; (2) le comparer point par point aux règles du §6.3 ; (3) combler les écarts **dans l'existant** ; (4) ne créer de nouvelles tables que si l'existant ne peut pas porter le besoin, en le justifiant. Les noms `approval_*` du §6.4 sont **indicatifs** : mappe-les sur `ValidationWorkflow` / `ValidationRequest` / `ValidationStep`.

### 6.1 Principe

**Toute action sensible sur le stock est une DEMANDE, jamais une exécution directe.** Le gestionnaire ne « transfère » pas du stock : il **demande** un transfert. Le stock ne bouge qu'à l'**exécution**, après approbation.

```
BROUILLON → SOUMISE → EN_VALIDATION (étape n) → APPROUVEE → EXECUTEE
                          ↘ REJETEE (motif obligatoire)       ↘ ECHEC_EXECUTION
            ANNULEE (par l'initiateur, avant exécution) · EXPIREE (délai dépassé)
```

*(Les libellés exacts suivent la convention de nommage du code ; les statuts des réceptions déjà implémentés sont conservés et mappés.)*

### 6.2 Niveaux de validation (configurables)

| Niveau | Signatures | Usage |
|---|---|---|
| **V2 (défaut)** | Initiateur + 1 valideur indépendant | Majorité des actions de stock |
| **V3 (critique)** | Initiateur + 2 valideurs distincts, dont le DG, **avec ré-authentification (OTP)** | Sortie exceptionnelle, contre-passation, gros écarts, dérogations |

### 6.3 Règles non négociables du moteur

1. **Séparation des tâches, côté serveur :** l'initiateur ne peut pas valider sa propre demande ; un même utilisateur ne peut pas occuper deux étapes. Cette règle **n'est pas configurable** et **n'est pas seulement dans l'UI**.
2. **La matrice d'approbation est en base** (`approval_policy`), pas dans le code : type d'action × condition (quantité, valeur, type de marchandise) → étapes et rôles requis.
3. **Snapshot :** la demande fige les données au moment de la soumission (`payload` JSONB). L'approbation porte sur ce qui a été vu.
4. **Revalidation à l'exécution :** le stock a pu changer entre-temps ; les préconditions sont revérifiées. Sinon → `ECHEC_EXECUTION` avec la raison (rien n'est à moitié appliqué).
5. **Exécution transactionnelle (ACID) et idempotente** (`@Version` + statut) : un double clic ou un rejeu ne double jamais un mouvement.
6. **Rejet :** motif obligatoire, l'initiateur est notifié, il peut corriger et resoumettre (nouvelle demande liée).
7. **Traçabilité complète :** chaque étape enregistre qui, quand, décision, commentaire, adresse IP. Ces lignes sont **immuables**.
8. **Expiration et escalade configurables :** une demande en attente au-delà d'un délai alerte le valideur puis le DG.
9. **Chaque mouvement de stock référence la demande approuvée** qui l'a produit (`approval_request_id`). Un mouvement sans référence est refusé (hors seed de développement).

### 6.4 Schéma de référence (contrat, à adapter aux conventions du code)

```sql
CREATE TABLE approval_policy (
  id BIGSERIAL PRIMARY KEY,
  action_type VARCHAR(60) NOT NULL,          -- ex. 'TAMPON_REPLENISHMENT'
  step_order INT NOT NULL,
  required_role VARCHAR(50) NOT NULL,
  condition_field VARCHAR(30),               -- 'QUANTITY' | 'VALUE' | 'MATERIAL_TYPE' | NULL
  condition_min NUMERIC,                     -- l'étape s'applique si valeur >= min
  requires_step_up BOOLEAN DEFAULT FALSE,    -- ré-OTP pour cette étape
  active BOOLEAN DEFAULT TRUE
);

CREATE TABLE approval_request (
  id BIGSERIAL PRIMARY KEY,
  reference VARCHAR(30) UNIQUE NOT NULL,     -- DEM-YYYYMMDD-NNNN
  action_type VARCHAR(60) NOT NULL,
  payload JSONB NOT NULL,                    -- snapshot des données demandées
  status VARCHAR(20) NOT NULL,
  requested_by BIGINT NOT NULL,
  requested_at TIMESTAMP NOT NULL DEFAULT now(),
  current_step INT,
  expires_at TIMESTAMP,
  executed_at TIMESTAMP,
  execution_error TEXT,
  version BIGINT NOT NULL DEFAULT 0          -- verrou optimiste
);

CREATE TABLE approval_step (
  id BIGSERIAL PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES approval_request(id),
  step_order INT NOT NULL,
  required_role VARCHAR(50) NOT NULL,
  decided_by BIGINT,
  decision VARCHAR(10),                      -- 'APPROVED' | 'REJECTED'
  comment TEXT,
  decided_at TIMESTAMP,
  ip_address VARCHAR(45)
);
```

### 6.5 Conception logicielle (SOLID, extensible)

Le moteur est **générique** ; chaque action métier est un **handler** (patron Strategy — ouvert à l'extension, fermé à la modification) :

```java
public interface ApprovableActionHandler {
    ActionType type();
    void validateRequest(RequestPayload payload);          // règles à la soumission
    void checkPreconditions(ApprovalRequest request);      // revérifiées à l'exécution
    void execute(ApprovalRequest request);                 // effet réel, via StockLedger
}

public interface StockLedger {                             // SEUL point d'écriture du stock
    StockMovement post(PostMovementCommand cmd);           // append-only
    StockMovement reverse(Long movementId, ReversalReason reason, ApprovalRef approval);
}
```

Ajouter une nouvelle action = ajouter un handler + des lignes de politique, **sans toucher au moteur**. Un test ArchUnit garantit que seuls les handlers appellent `StockLedger`.

### 6.6 Matrice des actions

*Colonne « Statut » : **Existant** = déjà implémenté, à conserver et à brancher sur le moteur ; **Proposition** = à confirmer par le DG (§12).*

| # | Action | Initiateur | Valideur(s) | Escalade DG si | Effet à l'exécution | Statut |
|---|---|---|---|---|---|---|
| 1 | Réception matières premières | Gestionnaire | Comptable | écart > seuil | Central MP ↑ | Existant |
| 2 | Réception consommables | Gestionnaire | Contrôleur général | écart > seuil | Stock consommables ↑ | Existant |
| 3 | Réception produits finis (lot) | Resp. production | Gestionnaire | écart > seuil | Central PF ↑ | Existant |
| 4 | **Réapprovisionnement du tampon** | Gestionnaire | Contrôleur général | quantité > seuil | Central ↓, tampon ↑ | Proposition |
| 5 | Dotation commercial | Commercial | Gestionnaire (+ RG-10 chargements) | valeur > seuil | Tampon ↓, stock mobile ↑ (auto) | Existant / à finir |
| 6 | Ajustement d'inventaire | Gestionnaire | Contrôleur général | valeur d'écart > seuil | Mouvement `AJUSTEMENT` | Proposition |
| 7 | Avarie / casse / perte | Gestionnaire | Contrôleur général (photo si > 5 %) | valeur > seuil | Mouvement `PERTE` | Proposition |
| 8 | Sortie exceptionnelle (don, échantillon) | Gestionnaire | DG (toujours) + Contrôleur général | — (V3) | Mouvement `SORTIE_EXCEPTIONNELLE` | Proposition |
| 9 | Transfert entre magasins | Gestionnaire | Contrôleur général | quantité > seuil | Magasin A ↓, B ↑ | Proposition |
| 10 | Bon de commande produits finis | Gestionnaire | Chef de production | — | Commande créée | Existant |
| 11 | Bon de commande MP / consommables | Gestionnaire → Resp. achats | DG (décaissement) | toujours | Commande créée | Proposition |
| 12 | Modification des seuils | Contrôleur général | DG | — | Politique de seuil mise à jour | Existant / à formaliser |
| 13 | Création / modification produit ou prix | Gestionnaire | Contrôleur général (prix : DG) | — | Référentiel mis à jour | Proposition |
| 14 | Suppression logique d'un référentiel | Initiateur | Contrôleur général | — | `deleted_at` renseigné | Proposition |
| 15 | Annulation / contre-passation d'un mouvement | Gestionnaire | Contrôleur général + DG (V3) | toujours | Mouvement inverse | Proposition |
| 16 | Stock initial (import Excel de reprise) | Gestionnaire | Comptable + Contrôleur général (V3) | toujours | Niveaux initiaux | Proposition |

### 6.7 Expérience utilisateur

- **Aucun bouton « exécuter » direct** sur une action de stock : uniquement « Créer une demande ».
- **Boîte « Mes validations »** unique dans le frontend (demandes en attente de moi, avec compteur), **frise de statut** sur chaque demande (qui a validé, quand, quoi).
- Notifications temps réel (WebSocket) au valideur suivant ; RabbitMQ pour les notifications différées.
- Les gardes Angular ne sont qu'un confort d'affichage : **le serveur est la seule source de vérité**.

---

## 7. Soft delete

### 7.0 Existant — `BaseEntity`

`shared/infrastructure/persistence/BaseEntity` est signalé comme portant déjà le **soft delete universel** et l'audit de base. À vérifier : colonnes réelles, filtrage effectif des supprimés (`@SQLRestriction` ou équivalent, prouvé par un test), entités qui en héritent. **Ne crée pas de seconde classe de base.** Attention : « universel » ne doit pas rendre supprimables les écritures de la catégorie C ci-dessous (mouvements de stock, audit) — vérifie qu'elles sont protégées. Les entités du module `production` restauré doivent en hériter.

### 7.1 Principe

**Aucune suppression physique** d'une donnée métier. Mais « soft delete partout » sans nuance est un piège : on distingue trois catégories.

| Catégorie | Exemples | Règle |
|---|---|---|
| **A. Référentiels** | Produit, magasin, fournisseur, commercial, utilisateur, seuil | Soft delete (via demande validée §6, ligne 14) ; **refusé** s'il existe des dépendances actives |
| **B. Documents en brouillon** | Réception ou dotation non soumise | Soft delete par l'initiateur |
| **B'. Documents soumis** | Demandes, réceptions soumises | **Jamais supprimés** : statut `ANNULEE` / `REJETEE` |
| **C. Écritures** | Mouvements de stock, étapes de validation, audit trail | **Immuables** : ni supprimés, ni modifiés. Correction par **contre-passation** (§6.6, ligne 15) |

### 7.2 Colonnes standard (catégories A et B)

`deleted_at TIMESTAMP NULL`, `deleted_by BIGINT NULL`, `deletion_reason VARCHAR(255) NULL` — *aligner le nommage sur la convention réelle du code.*

### 7.3 Implémentation

- Une classe de base ne porte que les **colonnes** ; `@SQLRestriction("deleted_at IS NULL")` (Hibernate 6.3+, remplace `@Where` déprécié) et `@SQLDelete` sont déclarés **sur chaque entité concrète** (la table diffère). **Vérifier par un test d'intégration** que la restriction s'applique bien.
- Suppression via une méthode de domaine `markDeleted(actor, reason)` (renseigne qui et pourquoi) ; `@SQLDelete` reste un **filet de sécurité**, pas le mécanisme principal.
- **Interdire** les `deleteBy*`, `@Modifying` `DELETE` et `delete()` de repository sur ces entités (règle ArchUnit).
- **Unicité et soft delete :** remplacer les contraintes uniques par des **index uniques partiels** :
  ```sql
  CREATE UNIQUE INDEX ux_product_sku_active ON product(sku) WHERE deleted_at IS NULL;
  ```
  *En local (pas de migrations, schéma généré depuis les entités), Hibernate ne sait pas déclarer un index partiel de façon fiable : l'unicité parmi les non-supprimés est alors vérifiée **dans le service** ; l'index partiel entre dans la baseline Flyway du pilote.*
- **Pièges connus :** les requêtes **natives** contournent `@SQLRestriction` (ajouter le filtre à la main) ; les jointures vers une entité supprimée ; les cascades (`CascadeType.REMOVE` interdit) ; les compteurs et rapports doivent exclure les supprimés.
- **Corbeille :** vue réservée (Contrôleur général / admin) pour consulter et **restaurer** (restauration = action journalisée).
- **Purge physique :** jamais dans le code applicatif. Seulement par procédure d'administration contrôlée, après une durée de rétention **décidée par le DG** (§12).

---

## 8. Sécurité

Objectif : **sécurisé par défaut**, couche par couche. Références : OWASP Top 10 et OWASP ASVS niveau 1 comme grille de revue.

### 8.1 Authentification

- JWT à **durée courte** + refresh token avec **rotation et révocation** ; secret de signature **hors du code**, fort, différent par environnement.
- Mots de passe : **BCrypt/Argon2** ; politique de complexité ; **verrouillage temporaire** après échecs répétés.
- 2FA/OTP (déjà en place) : durée de validité et tentatives limitées ; **re-OTP** (step-up) pour les approbations V3.
- Réponses génériques sur le login (ne pas révéler si un identifiant existe).

### 8.2 Autorisation

- **RBAC** par méthode (`@PreAuthorize`) **et** contrôle au **niveau de l'objet** (un commercial ne lit que **son** stock mobile ; anti-IDOR).
- Évolution douce vers des **permissions granulaires** (`stock.tampon.request`, `stock.tampon.approve`) — la matrice `approval_policy` porte déjà les rôles requis.
- Toute règle de séparation des tâches est appliquée **côté serveur**.

### 8.3 API et données

- **Aucune entité JPA exposée** : DTO uniquement (évite le mass assignment).
- Validation stricte (Bean Validation) ; requêtes **paramétrées** (JPQL/Spring Data) ; revue de chaque requête native.
- **Rate limiting** sur **tous** les endpoints (limites plus strictes sur auth/OTP), ex. Bucket4j.
- **CORS** en liste blanche ; en-têtes de sécurité (HSTS, X-Content-Type-Options, CSP côté frontend).
- Erreurs au format standard (`ProblemDetail`), **sans stack trace** ni détail interne.
- Pagination obligatoire, taille maximale imposée.
- **Idempotence** des POST sensibles (clé d'idempotence) — utile avec les coupures réseau.
- Uploads (photos d'avarie) : type et taille contrôlés, stockage derrière `StorageService`, jamais servis depuis un chemin arbitraire.

### 8.4 Secrets, configuration, environnements

- **Aucun secret dans le dépôt** (mots de passe DB, clés JWT, identifiants RabbitMQ) : variables d'environnement. Ajouter un scan de secrets (gitleaks) au CI.
- Profils Spring **`dev` / `test` / `prod`** distincts.
- ⚠️ **`DataInitializer` uniquement en profil `dev`.** Des comptes seedés avec mots de passe par défaut en production sont une faille classique. En production : création du premier administrateur via variable d'environnement, mot de passe à changer à la première connexion.
- ⚠️ **RabbitMQ :** supprimer l'utilisateur `guest/guest`, ne pas exposer l'interface de management.
- **PostgreSQL :** l'application utilise un rôle **non superuser** ; sur la table d'audit et les mouvements, ce rôle n'a **pas** les droits `UPDATE`/`DELETE` (immuabilité garantie par la base, pas seulement par le code).
- **Swagger** désactivé ou protégé en production ; **Actuator** restreint (health seul, public ; le reste authentifié).
- Paramètres métier (seuils, durées OTP, délais d'expiration, taux d'avarie) : table `system_parameter`, **jamais de constante en dur**.

### 8.5 Transport, WebSocket, messagerie

- HTTPS/TLS 1.2+ partout en production.
- **WebSocket authentifié** : JWT vérifié à la connexion STOMP ; **autorisation par destination** (un utilisateur ne s'abonne qu'aux canaux de son rôle).
- Événements RabbitMQ : pas de données sensibles superflues dans les messages.

### 8.6 Audit trail

- Journal **immuable** des actions sensibles : création, modification, suppression logique, restauration, approbation, rejet, connexion, échec de connexion, changement de seuil.
- Contenu : utilisateur, action, entité, identifiant, avant/après, horodatage, IP, **identifiant de corrélation** de la requête.
- Jamais de mot de passe, token ou donnée sensible dans les logs.

### 8.7 Chaîne de production

- Dépendances scannées (OWASP Dependency-Check ou Dependabot) ; mises à jour de sécurité suivies.
- **Sauvegardes PostgreSQL quotidiennes**, copie hors serveur, **test de restauration** régulier.
- Serveur : pare-feu minimal (seuls 443/80 ouverts), base et RabbitMQ non exposés à Internet.
- Journaux structurés (JSON), niveau `INFO` en production.

---

## 9. Bonnes pratiques pour bien commencer petit

L'objectif n'est pas de construire « grand » mais de construire **juste**, avec des fondations qui permettent de grandir sans réécriture.

### 9.1 Tranches verticales

Toujours livrer un flux **complet et utilisable** (front → API → base → audit → test), plutôt que plusieurs couches partielles. **Première tranche recommandée :** *« demande de réapprovisionnement du tampon »* — elle traverse le moteur d'approbation, le stock, les seuils, les alertes et l'UI. Une fois cette tranche solide, les 15 autres actions du §6.6 deviennent des variations.

### 9.2 Le noyau d'abord

Les trois choses difficiles à corriger plus tard, à faire **en premier** : (1) le **StockLedger** à point d'écriture unique, (2) le **moteur d'approbation**, (3) le **soft delete + audit**. Le reste (rapports, graphiques, exports) s'ajoute sans risque.

### 9.3 Qualité automatisée dès le premier jour

- **CI** (GitHub Actions ou équivalent) : build + tests + scan de dépendances + scan de secrets à chaque push.
- **Pyramide de tests :** beaucoup de tests unitaires sur les règles du domaine, des tests d'intégration **Testcontainers PostgreSQL**, très peu de bout en bout.
- **ArchUnit :** les règles d'architecture (couches, modules étanches, point d'écriture unique du stock, pas de `DELETE`) sont **testées**, pas seulement écrites.
- Branches courtes, revue de chaque merge avec la checklist du §0.3, commits atomiques (Conventional Commits).

### 9.4 Décisions tracées

Un fichier court par décision structurante dans `docs/adr/` (contexte, décision, conséquences). Exemples déjà actés : monolithe modulaire, Comptable second valideur des MP, soft delete, double validation généralisée. Une décision non écrite sera refaite ou contredite par l'IA dans deux semaines.

### 9.5 Ce qu'on ne construit PAS maintenant

Microservices, Kubernetes, Kafka, event sourcing complet, application mobile native, mode offline, IA prédictive des ruptures, multi-tenant, génération automatique d'écritures comptables (FIFO), réapprovisionnement automatique sans validation. Ce sont des **perspectives** ; les inclure aujourd'hui ralentirait le pilote et multiplierait les bugs. L'architecture actuelle (ports, événements, config en base) laisse la porte ouverte.

### 9.6 Pilote réel

1. **Environnement de recette** avec données réelles anonymisées ou de test.
2. **Reprise du stock initial** via une demande « stock initial » (§6.6 ligne 16) — la reprise elle-même est tracée et validée.
3. **Fonctionnement en parallèle** avec Excel pendant 2 semaines sur un périmètre réduit (1 gestionnaire, 1–2 commerciaux) : comparer chaque soir les niveaux ; les écarts sont les meilleurs tests.
4. Bascule progressive, Excel en lecture seule, puis abandon.
5. Boucle de retour hebdomadaire avec le gestionnaire (Product Owner), corrections en sprint court.

### 9.7 Résilience face au terrain

Coupures de courant et réseau instable : **brouillons sauvegardés côté navigateur** (aucune saisie longue perdue), requêtes **idempotentes** (rejouables sans doublon), messages d'erreur clairs et actionnables, sauvegarde quotidienne, onduleur pour le poste/serveur si possible.

### 9.8 Observabilité minimale

Logs JSON avec **identifiant de corrélation**, endpoint de santé, métriques de base (temps de réponse, erreurs, demandes en attente > délai). Suffisant pour diagnostiquer sans outillage lourd.

---

## 10. Standards d'ingénierie non négociables

- Architecture **DDD 4 couches**, module Stock = référence.
- **SOLID** appliqué explicitement ; patrons de conception là où ils simplifient (Strategy pour les handlers, Facade/Ports pour l'inter-module).
- **Toute écriture de stock passe par une demande approuvée** (§6).
- **Soft delete** selon les 3 catégories (§7) ; aucune suppression physique.
- **Transactions ACID** explicites sur chaque exécution d'action.
- **Aucune valeur métier codée en dur** — `system_parameter` ou `approval_policy`.
- **DTO uniquement** en frontière d'API ; **Swagger** sur chaque endpoint ; **pagination** sur chaque liste.
- **Tests d'intégration Testcontainers PostgreSQL** ; H2 exclu.
- **Isolation des logiques transverses** derrière des interfaces (§4.5).
- Documentation orientée **le pourquoi métier**.
- Numéros de référence lisibles (`RCP-`, `DEM-`) générés côté serveur.

---

## 11. Méthode de travail

- Un module ou une tranche à la fois ; **audit avant tout code** ; rapport ; **attendre la validation explicite** avant modification.
- Les livraisons de l'agent sont des **brouillons** : relecture critique (dérive de spec, raccourcis de sécurité, violations d'architecture) avant acceptation.
- Base de données en développement : **reseed propre** accepté (pas de scripts de migration à ce stade). **Avant le pilote :** geler le schéma, créer une baseline **Flyway**, passer `ddl-auto` à `validate`. *(Décision actée : en local, pas de fichiers de migration, les champs sont déclarés dans les entités — §12.3 n° 8.)*
- Sprints d'une semaine, revue de sprint avec le DG et le gestionnaire.

---

## 12. État actuel, points ouverts et décisions à trancher

### 12.1 Acquis (à ne pas casser)

Module Stock largement implémenté ; trois circuits de réception avec double validation par rôle ; JWT + 2FA/OTP + `@PreAuthorize` ; couche REST complète ; `DataInitializer` avec MP, consommables et produits finis (`materialType`) ; frontend branché sur l'API réelle ; règle RG-10 sur les chargements. *Cette liste est un instantané : d'autres fonctionnalités ont été ajoutées depuis (§0.4).*

### 12.2 Points ouverts techniques

- Workflow **dotation / chargement** : différé, à finir (§5.4).
- **Nouveautés signalées par `docs/CONTINUATION_ERP_TANTY.md` — hypothèses à vérifier, pas des faits :**
  - `conditionnement` : Marque, Gamme, Variété, TypeEmballage, ConfigurationConditionnement (hiérarchie sachet → gaine → carton → palette, calculs de poids), migration V32.
  - Formulation (dans Stock) : Formulation, LigneFormulation (statuts BROUILLON / VALIDEE / OBSOLETE), calcul des besoins en MP, prédiction de production, `FormulationController`, écran front `formulation.component`.
  - `shared` : `AuditLog`, `EventPublisherService` et événements (CommandeProduction, ProduitFini, StockConsomme), `NotificationService`, `ModuleIaConfig`, `validation/` (workflows, demandes, étapes, enregistrements, `CodeValidation`), `BaseEntity`, `CodeValidationSeeder`.
  - `admin` (`ParametreSysteme`), `dg` (`DashboardService`, `KpiDashboardDto`), `incidents` (`Incident`, `IncidentComment`).
  - Migrations V26–V33 ; documents `ARCHITECTURE_*.md` et `BONNES_PRATIQUES_ET_FEATURES.md` (**à lire en priorité** : ils pèsent plus que ce résumé).
  - Tout le reste ajouté depuis n'est pas listé ici : l'inventaire de la Phase 0 le consignera dans `docs/CODEBASE_MAP.md`.
- Divergences possibles entre modules intégrés : `Produit`, `Client`, enums, ID, rôles, structure Angular.
- Écarts entre la documentation (rapport de stage) et le code : le **code fait foi** pour les noms techniques.
- `DataInitializer`, secrets et RabbitMQ à durcir avant tout déploiement (§8.4).

### 12.3 Décisions à trancher — l'agent **ne doit pas les décider seul**

| # | Question | Proposition par défaut |
|---|---|---|
| 1 | Qui valide le **réapprovisionnement du tampon** ? | Contrôleur général ; DG au-delà d'un seuil de quantité |
| 2 | **Seuils d'escalade** (quantité/valeur) pour chaque action | À fixer avec le DG ; en attendant, paramètres en base avec valeurs de dev |
| 3 | Sens de la contrainte **seuil de déclenchement vs stock de sécurité** | Le document d'origine dit « erreur si déclenchement > sécurité » ; logiquement, le point de commande doit être **≥ stock de sécurité**. À confirmer |
| 4 | **Dotation** : circuit « demande commercial → approbation gestionnaire » (retenu) vs « caisse → comptable » (rapport initial) | Conserver le circuit retenu + RG-10 sur les chargements ; formaliser |
| 5 | **Contrôleur général** et **Contrôleur de gestion** : même rôle ou deux ? | À clarifier avec le DG |
| 6 | **Durée de rétention** des données supprimées logiquement | À fixer avec le DG |
| 7 | Périmètre et date du **pilote** | 1 gestionnaire + 1–2 commerciaux, 2 semaines en parallèle |
| 8 | **Migrations** ✅ *tranché* | **En local, les migrations ne servent pas** : les champs se déclarent directement dans les entités (`ddl-auto`, reseed propre). **Aucun nouveau fichier de migration.** Flyway désactivé en profil local/dev (vérifier la config réelle). La V34, recréée par erreur, est à retirer ; V26–V33 restent inertes (ni supprimées, ni activées). Avant le pilote seulement : baseline Flyway générée depuis les entités (§11) |
| 9 | Modules aux noms proches ✅ *tranché* | **`commercial` et `commercialisation` = un seul module, à unifier** (nom canonique proposé : `commercialisation`, à confirmer dans le plan, Phase 0.6). **`admin` = gestion du système** (paramètres, configuration) ; l'audit précise ce que contient `administration` et sa frontière avec `admin` |

### 12.4 Incident signalé : module Production supprimé (à vérifier puis restaurer)

**Signalé, non vérifié :** le commit `eef1df1` (« feat: calculs des qtes par mp pour produire des pf ») aurait supprimé tout `modules/production` (~11 000 lignes : affectation, besoin, broyage, dosage, fiche, lot, of, pph, registre, rapport, dashboard, 14 controllers, listener de messagerie). Depuis, des fichiers ont été recréés : `LotMP.java`, `ReceptionMPListener.java`, migration `V34__create_formulation_tracabilite_tables.sql`.

**Procédure** (après la porte 0 et l'audit) :

1. **Vérifier l'incident** dans le dépôt API confirmé : `git show --stat eef1df1` (regarde aussi les tests et ressources supprimés hors `modules/production`), puis `git ls-tree -r --name-only eef1df1^ -- <chemin de modules/production>` pour confirmer que le parent contient bien le module.
2. **Source n° 1 : l'historique git local** (le parent du commit fautif). C'est la source exacte et complète, avec ses propres conventions : les `.rar` et la reconstruction ne sont pas nécessaires si le parent est intact. Si l'historique local est incomplet : `git reflog`, branches distantes (`git fetch` seulement après ma validation).
3. **Sources de repli, dans cet ordre :** dépôt distant GitHub (api-tanty-digital), puis `tanty_erp_api_pwa`, puis les archives `.rar`. **Reconstruire depuis zéro = dernier recours**, à me signaler avant.
4. **Restaurer dans une branche dédiée** (ex. `restore/production-module`), à l'identique d'abord, avec `git restore --source=eef1df1^ -- <chemin>` limité au seul dossier concerné, **dans un commit isolé**.
5. **Réconcilier** avec ce qui a été recréé depuis (`LotMP` vs `LotStock` existant, `ReceptionMPListener` ; la migration V34 est à retirer, §12.3 n° 8) : compare, ne remplace pas en silence ; si divergence, question.
6. **Compiler, corriger uniquement les ruptures** dues aux changements survenus depuis (formulation, conditionnement, `BaseEntity`, événements), lancer les tests, et **prouver qu'aucun fichier n'a été perdu** (liste des fichiers avant / après).
7. **Améliorations en second temps, commits séparés :** `BaseEntity`, événements de domaine, audit, codes de validation, DTO standardisés, intégration formulation / conditionnement. Restaurer d'abord à l'identique permet de comparer et de prouver qu'on n'a rien perdu.

---

## 13. Feuille de route — prompts par phase

**Règle d'or : ne jamais réécrire sans avoir audité.** Chaque phase se termine par le compte rendu du §0.2 et **attend ma validation** avant la suivante.

**Ordre : la porte 0 (§0.0), puis l'API complète (Phases 0 à 5, dont l'unification 0.6), puis le frontend (Phase 6), puis durcissement et pilote (Phases 7–8).** Comprendre l'ensemble du projet avant d'agir, puis avancer pas à pas.

### Phase 0 — Audit complet de l'API (après la porte 0 du §0.0)

```
Lis intégralement docs/TANTY_DIGITAL_CONTEXTE.md, puis analyse le dépôt SANS
modifier le code (seules écritures autorisées : docs/CODEBASE_MAP.md et
docs/PROGRESS.md). Le projet a évolué depuis la rédaction du document : ne
présume rien. Produis un rapport structuré :
1. Cartographie des modules et sous-domaines réels (avec leur état : complet /
   partiel / cassé) et matrice de complétude du module Stock (§5.5)
2. Écarts par rapport au document : architecture, statuts, enums, rôles,
   nommage, conventions d'ID
3. Conflits entre modules intégrés (Produit, Client, enums, rôles, ID, Angular)
4. Chemins qui modifient le stock SANS passer par un circuit de validation
   (liste exhaustive : controllers, services, listeners, DataInitializer)
5. Entités et repositories : lesquels ont déjà du soft delete, lesquels font
   des DELETE physiques
6. Constat sécurité : secrets en clair, comptes seedés, RabbitMQ, Swagger,
   Actuator, CORS, rate limiting, endpoints sans contrôle d'objet
7. Valeurs métier codées en dur
8. Nouveautés non décrites dans le document : fonctionnalités, entités,
   endpoints, écrans, listeners, tables ajoutés (ce qu'ils font, quel module
   les possède, conformes / non conformes aux règles non négociables)
9. Vérification point par point des affirmations de docs/CONTINUATION_ERP_TANTY.md
   (confirmé / infirmé / partiel), y compris l'incident du commit eef1df1
   (git show --stat) et l'état réel des migrations V26–V34
10. commercial / commercialisation (à unifier) : inventaire précis des doublons
   (entités, services, endpoints, listeners, tables) ; admin (gestion du système)
   vs administration : contenu et frontière
Produis docs/CODEBASE_MAP.md (carte vivante, §0.4) et initialise
docs/PROGRESS.md avec le hash de l'état analysé.
Ne propose aucune correction dans cette phase — uniquement le constat.
```

### Phase 0.5 — Restauration du module Production

```
Après validation de l'audit, applique la procédure du §12.4 : vérifie l'incident
(git show --stat eef1df1), restaure modules/production depuis le parent du commit
dans une branche dédiée, à l'identique, en commit isolé. Réconcilie avec ce qui a
été recréé depuis (LotMP → LotStock, ReceptionMPListener ; retire la migration V34, cf. §12.3 n° 8) sans rien écraser
en silence. Compile, corrige uniquement les ruptures dues aux changements
survenus depuis, lance les tests, prouve qu'aucun fichier ne manque (liste avant /
après). Les améliorations (BaseEntity, événements, audit, codes de validation,
formulation/conditionnement) viennent ensuite, en commits séparés.
```

### Phase 0.6 — Unification commercial / commercialisation

```
Décision actée : `commercial` et `commercialisation` deviennent UN seul module
(nom canonique proposé : commercialisation — confirme-le dans ton plan).
Plan d'abord, validation ensuite. Le plan contient : inventaire des deux modules
(entités, services, use cases, endpoints, listeners RabbitMQ, événements, tables),
doublons et divergences concept par concept, version canonique retenue pour chacun
avec justification, liste des appels frontend impactés.
Exécution en commits séparés : (1) déplacement du code vers le module unique en
conservant l'historique git (git mv) ; (2) fusion des doublons, une entité à la
fois ; (3) suppression du module devenu vide. Aucune fonctionnalité perdue, aucun
comportement modifié. Les URL d'API restent stables (alias conservés) jusqu'à la
Phase 6 pour ne pas casser le frontend. Rappel : en local, pas de migration, le
schéma suit les entités ; renommer une entité ou une table crée une nouvelle
table (ddl-auto ne renomme pas) : prévois le reseed. Compile, tests, compte rendu
avec preuves.
```

### Phase 1 — Fondations : audit trail, soft delete, configuration

```
À partir du rapport validé, complète et fiabilise les fondations SANS recréer
l'existant (AuditLog, BaseEntity, ParametreSysteme — à vérifier) :
- table/service system_parameter (ou l'existant, s'il y en a un) et migration
  des valeurs en dur identifiées ;
- audit trail immuable (sans UPDATE/DELETE possible pour le rôle applicatif) ;
- soft delete selon les 3 catégories du §7 : colonnes, @SQLRestriction sur
  chaque entité concrète, markDeleted(actor, reason), index uniques partiels,
  interdiction des DELETE physiques ;
- tests d'intégration Testcontainers prouvant que les supprimés sont invisibles,
  que les uniques fonctionnent, et que les mouvements sont immuables ;
- règles ArchUnit correspondantes.
Ne touche ni à l'UI ni aux nouvelles fonctionnalités. Plan d'abord, validation
ensuite, puis implémentation.
```

### Phase 2 — Noyau : StockLedger et moteur d'approbation

```
Compare d'abord shared/validation (existant) au moteur décrit au §6 et comble
les écarts sur l'existant au lieu de créer un second moteur ; puis implémente ce
qui manque du moteur d'approbation (§6) et le StockLedger à point
d'écriture unique : politique de validation configurable en base, demande, étapes,
ApprovableActionHandler, séparation des tâches côté serveur, snapshot,
revalidation à l'exécution, idempotence (@Version), expiration, événements
après commit, référence approval_request_id sur chaque StockMovement.
Prouve-le avec des tests : auto-approbation refusée, même utilisateur sur deux
étapes refusé, rejeu sans doublon de mouvement, échec d'exécution sans effet
partiel. Ne migre AUCUN circuit existant dans cette phase.
```

### Phase 3 — Première tranche verticale : réapprovisionnement du tampon

```
Implémente de bout en bout l'action « TAMPON_REPLENISHMENT » sur le moteur :
demande (avec quantité recommandée d'après les seuils), validation par le
Contrôleur général, escalade DG au-delà du seuil paramétré, exécution
(central ↓, tampon ↑, mouvement TRANSFERT_POUR_TAMPON), notifications, alerte
tampon-sous-seuil qui propose la demande. Supprime/verrouille tout endpoint
qui transférait directement. Endpoint, DTO, Swagger, audit, tests (unitaires +
intégration). Compte rendu au format §0.2, puis attends.
```

### Phase 4 — Terminer le backend du module Stock

```
Suis la matrice de complétude validée, sous-domaine par sous-domaine, dans cet
ordre : (1) brancher les 3 réceptions existantes sur le moteur via adaptateur,
sans changer leur comportement observable ; (2) dotation + stock mobile
(exécution automatique après approbation gestionnaire, RG-10 conservée) ;
(3) ajustements d'inventaire, avaries, sorties exceptionnelles, transferts,
contre-passations, stock initial ; (4) seuils (avec historique) et alertes
(ACTIVE → ACQUITTEE → RESOLUE, résolution automatique) ; (5) reporting
asynchrone et exports PDF/Excel. Une tranche à la fois, chacune avec sa
Definition of Done (§0.3) et son compte rendu.
```

### Phase 5 — Intégration inter-modules

```
Vérifie et corrige les contacts entre Stock et les autres modules
(Production, Commercialisation, Caisse, Comptabilité) : uniquement via les
ports publics (StockQueryPort, StockCommandPort) ; aucun accès direct aux
repositories ; toute écriture de stock d'un autre module passe par une demande
ou par un handler ; événements publiés après commit. Un module qui ne respecte
pas le contrat est signalé dans le rapport, pas « arrangé » en silence.
```

### Phase 6 — Frontend Angular

```
Ajoute la boîte « Mes validations », la frise de statut des demandes, les
formulaires « Créer une demande » (fin des boutons d'exécution directe), la
corbeille (soft delete / restauration), les brouillons sauvegardés localement.
Respecte la charte TANTY et l'architecture Angular du module Stock. Les gardes
de route sont un confort : aucune règle de sécurité ne repose sur elles.
```

### Phase 7 — Durcissement sécurité et qualité

```
Passe le §8 en revue endpoint par endpoint : rate limiting global, contrôle
d'objet (IDOR), validation, erreurs sans fuite, headers, CORS, WebSocket
authentifié et autorisé par destination, profils dev/test/prod, DataInitializer
limité au profil dev, secrets externalisés, RabbitMQ sécurisé, Swagger/Actuator
protégés, dépendances scannées. Complète la couverture Testcontainers et
ArchUnit. Livre un rapport de conformité point par point.
```

### Phase 8 — Préparation du pilote

```
Prépare le déploiement : Dockerfile de l'API, docker-compose de recette,
baseline Flyway, ddl-auto=validate, sauvegardes quotidiennes + procédure de
restauration testée, logs JSON avec identifiant de corrélation, endpoint de
santé, README (installation, variables d'environnement, procédure de reprise
du stock initial), et mise à jour de docs/PROGRESS.md et des schémas PlantUML.
```

---

## 14. Prompt d'amorçage (à coller en premier dans Claude Code)

```
Lis CLAUDE.md, puis docs/TANTY_DIGITAL_CONTEXTE.md en entier (la section 0 définit
ta façon de travailler), puis docs/CONTINUATION_ERP_TANTY.md (notes d'un travail
précédent : ce sont des hypothèses à vérifier, pas des faits).

ÉTAPE 0 — avant toute autre action, en lecture seule : dis-moi quel dossier est
l'API du projet complet et quel dossier est le frontend du projet complet
(méthode du §0.0). Donne les preuves, liste les dossiers sources et doublons,
signale tes incertitudes, puis ARRÊTE-TOI et attends ma confirmation.

Après ma confirmation : Phase 0, audit complet de l'API, lecture seule. Comprends
le projet en entier avant de toucher au code. Puis Phase 0.5 (restauration du
module production depuis l'historique git), puis les phases suivantes une à la
fois (§13). Le frontend vient après l'API.

Le projet a beaucoup évolué depuis la rédaction de ce document (§0.4) : ne
présume rien, considère l'existant comme légitime, ne le casse pas, ne duplique
rien (shared/validation, BaseEntity, ParametreSysteme, AuditLog existent déjà).
Sois précis et efficace (§0.5). Si une règle est ambiguë ou listée au §12.3, ne
tranche pas : pose-moi la question avec des options et une recommandation.
```

---

## 15. Perspectives (hors V1, après le pilote)

Application mobile / PWA pour valider depuis un smartphone · scan de codes-barres · mode offline · réapprovisionnement automatique du tampon (avec garde-fous) · analyse prédictive des ruptures · tableaux de bord avancés pour le DG · écritures comptables automatiques (FIFO) · virement de stock entre commerciaux · mode multi-tenant. **Aucune de ces idées n'entre dans le périmètre sans validation explicite de la Direction Générale.**
