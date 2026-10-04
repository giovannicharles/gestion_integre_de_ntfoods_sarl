# Claude Code - Documentation de Continuation ERP TANTY

## 📋 Contexte du Projet

### Projet Complet (Cible)
- **Backend**: `D:\SAINT JEAN\ME\LICENCE 3 ISJ 2025-2026\STAGE DE FIN DE CYCLE\Developpement\local\tanty_erp\api_erp_tanty`
- **Frontend**: `D:\SAINT JEAN\ME\LICENCE 3 ISJ 2025-2026\STAGE DE FIN DE CYCLE\Developpement\local\tanty_erp\tanty_digital_pwa`

### Dossiers de Référence (Source des Copies)

#### Backend Source
1. **Api_tanty** - Contient le module Stock qui a été copié dans api_erp_tanty
   - Chemin: `D:\SAINT JEAN\ME\LICENCE 3 ISJ 2025-2026\STAGE DE FIN DE CYCLE\Developpement\local\tanty_erp\Api_tanty`
   - Contenu: Module Stock (réceptions, lots, commandes, etc.)

2. **tanty_erp_api_pwa** - Devrait contenir les modules Production, Commercialisation, etc.
   - Chemin: `D:\SAINT JEAN\ME\LICENCE 3 ISJ 2025-2026\STAGE DE FIN DE CYCLE\Developpement\local\tanty_erp\tanty_erp_api_pwa`
   - ⚠️ **Note**: Ce dossier semble ne pas contenir les modules (structure incorrecte ou incomplète)

#### Frontend Source
1. **src** - Contient le module Stock qui a été copié dans tanty_digital_pwa
   - Chemin: `D:\SAINT JEAN\ME\LICENCE 3 ISJ 2025-2026\STAGE DE FIN DE CYCLE\Developpement\local\tanty_erp\src`
   - Contenu: Module Stock frontend

2. **frontend_autres_modules** - Devrait contenir les autres modules (Production, Commercial, etc.)
   - Chemin: `D:\SAINT JEAN\ME\LICENCE 3 ISJ 2025-2026\STAGE DE FIN DE CYCLE\Developpement\local\tanty_erp\frontend_autres_modules`
   - ⚠️ **Note**: Ce dossier semble vide

---

## 🚨 ERREUR CRITIQUE - SUPPRESSION DU MODULE PRODUCTION

### Ce qui a été supprimé par erreur (Commit eef1df1)

Dans le commit "feat: calculs des qtes par mp pour produire des pf", le module `modules/production` complet a été supprimé (11 009 lignes):

#### Domain Layer Supprimé
- `domain/affectation/` - Affectation journalière, postes de production
- `domain/besoin/` - Expression de besoins
- `domain/broyage/` - Sessions de broyage
- `domain/dosage/` - Sessions de dosage
- `domain/fiche/` - Fiches produit journalières
- `domain/lot/` - Lots de produits finis
- `domain/of/` - Ordres de fabrication
- `domain/pph/` - Plans de production hebdomadaires
- `domain/registre/` - Registres de production

#### Application Layer Supprimé
- `application/affectation/` - DTOs, mappers, use cases
- `application/besoin/` - DTOs, mappers, use cases
- `application/broyage/` - DTOs, mappers, use cases
- `application/dosage/` - DTOs, mappers, use cases
- `application/fiche/` - DTOs, mappers, use cases
- `application/lot/` - DTOs, mappers, use cases
- `application/of/` - DTOs, mappers, use cases
- `application/pph/` - DTOs, mappers, use cases
- `application/rapport/` - Rapports de production
- `application/registre/` - DTOs, mappers, use cases

#### Infrastructure Supprimé
- `infrastructure/persistence/affectation/` - JPA entities, repositories
- `infrastructure/persistence/besoin/` - JPA entities, repositories
- `infrastructure/persistence/broyage/` - JPA entities, repositories
- `infrastructure/persistence/dosage/` - JPA entities, repositories
- `infrastructure/persistence/fiche/` - JPA entities, repositories
- `infrastructure/persistence/lot/` - JPA entities, repositories
- `infrastructure/persistence/of/` - JPA entities, repositories
- `infrastructure/persistence/pph/` - JPA entities, repositories
- `infrastructure/persistence/registre/` - JPA entities, repositories
- `infrastructure/messaging/` - Event listeners

#### Presentation Supprimé
- `presentation/controller/AffectationController.java`
- `presentation/controller/BroyageController.java`
- `presentation/controller/ChefMachinisteController.java`
- `presentation/controller/DashboardProductionController.java`
- `presentation/controller/DosageController.java`
- `presentation/controller/ExpressionBesoinController.java`
- `presentation/controller/FicheController.java`
- `presentation/controller/LotController.java`
- `presentation/controller/OFController.java`
- `presentation/controller/PPHController.java`
- `presentation/controller/PosteProductionController.java`
- `presentation/controller/PosteProductionPublicController.java`
- `presentation/controller/RapportProductionController.java`
- `presentation/controller/RegistreController.java`

---

## ✅ Ce qui a été ajouté correctement

### Module Conditionnement (Nouveau)
**Backend**: `modules/conditionnement/`
- `domain/Marque.java` - Marques (TANTY, REINE)
- `domain/Gamme.java` - Gammes (Boeuf, Volaille, Poisson, Porc)
- `domain/Variete.java` - Variétés avec poids unitaire
- `domain/TypeEmballage.java` - Types d'emballage (Sachet, Gaine, Carton, Palette)
- `domain/ConfigurationConditionnement.java` - Hiérarchie conditionnement
- `application/ConfigurationConditionnementService.java`
- `infrastructure/persistence/*Repository.java` (5 repositories)
- **Migration**: V32__create_conditionnement_tables.sql

**Fonctionnalités**:
- Hiérarchie 4 niveaux (sachet → gaine → carton → palette)
- Calculs automatiques de poids (net, brut, total)
- Relations entre niveaux (contient_niveau_inferieur, nombre_unites)
- Code barres, conservation, température
- Configuration par défaut par variété

### Module Formulation (Nouveau - dans Stock)
**Backend**: `modules/stock/domain/formulation/`
- `model/Formulation.java` - Nomenclature de production
- `model/LigneFormulation.java` - Détail MP avec quantité et perte
- `enums/FormulationStatut.java` - BROUILLON, VALIDEE, OBSOLETE
- `service/FormulationService.java` - Calcul des besoins et prédictions
- `repository/FormulationRepository.java`
- `repository/LigneFormulationRepository.java`

**Backend**: `modules/stock/infrastructure/persistence/formulation/`
- `jpa/FormulationJpaEntity.java`
- `jpa/LigneFormulationJpaEntity.java`
- `jpa/FormulationJpaRepository.java`
- `jpa/LigneFormulationJpaRepository.java`
- `mapper/FormulationMapper.java`
- `repository/FormulationRepositoryImpl.java`

**Backend**: `modules/stock/application/formulation/usecase/`
- `CreerFormulationUseCase.java`
- `ValiderFormulationUseCase.java`
- `CalculerBesoinMPUseCase.java`
- `PredireProductionUseCase.java`

**Backend**: `modules/stock/presentation/controller/`
- `FormulationController.java`

**Fonctionnalités**:
- Calcul des besoins en MP avant envoi à Production
- Prédiction de production à partir des MP disponibles
- Intégration avec ConfigurationConditionnement (multiplications automatiques)
- Utilise LotStock existant (pas de duplication)
- Production reçoit un snapshot (ne recalcule pas)

### Frontend Formulation (Nouveau)
**Frontend**: `tanty_digital_pwa/src/`
- `core/services/formulation.service.ts`
- `domains/production/presentation/pages/formulation/formulation.component.ts`
- `domains/production/presentation/pages/formulation/formulation.component.html`
- `domains/production/presentation/pages/formulation/formulation.component.css`

### Modules Partagés (Nouveau - Shared)
**Backend**: `shared/`
- `audit/domain/AuditLog.java` - Audit trail
- `events/application/EventPublisherService.java` - Events inter-modules
- `events/domain/CommandeProductionEvent.java`
- `events/domain/ProduitFiniEvent.java`
- `events/domain/StockConsommeEvent.java`
- `ia/application/ModuleIaConfigService.java` - IA par module
- `ia/domain/ModuleIaConfig.java`
- `notifications/application/NotificationService.java`
- `notifications/domain/Notification.java`
- `validation/application/CodeValidationService.java` - Codes de validation
- `validation/application/ValidationWorkflowService.java` - Workflows de validation
- `validation/domain/CodeValidation.java`
- `validation/domain/ValidationRecord.java`
- `validation/domain/ValidationRequest.java`
- `validation/domain/ValidationStep.java`
- `validation/domain/ValidationWorkflow.java`
- `infrastructure/persistence/BaseEntity.java` - Soft delete universel
- `infrastructure/seeding/CodeValidationSeeder.java`

**Migrations**:
- V26__create_codes_validation_table.sql
- V27__create_module_ia_config_table.sql
- V28__create_validation_workflows_tables.sql
- V29__create_audit_log_table.sql
- V30__create_incidents_table.sql
- V31__create_notifications_table.sql
- V33__create_parametres_systeme_table.sql

### Module Admin (Nouveau)
**Backend**: `modules/admin/`
- `domain/ParametreSysteme.java` - Paramètres système configurables
- `application/ParametreSystemeService.java`
- `infrastructure/persistence/ParametreSystemeRepository.java`

### Module DG (Nouveau)
**Backend**: `modules/dg/`
- `application/DashboardService.java`
- `application/dto/KpiDashboardDto.java`

### Module Incidents (Nouveau)
**Backend**: `modules/incidents/`
- `domain/Incident.java`
- `domain/IncidentComment.java`
- `infrastructure/persistence/IncidentRepository.java`

### Documentation Ajoutée
- `ARCHITECTURE_ABSTRACTION_VERSIONING.md`
- `ARCHITECTURE_CONDITIONNEMENT.md`
- `ARCHITECTURE_FORMULATION.md`
- `ARCHITECTURE_VALIDATION_DELEGATION.md`
- `BONNES_PRATIQUES_ET_FEATURES.md`

---

## 🔧 Ce qui doit être RESTAURÉ

### URGENT: Module Production Complet

**OÙ COPIER LE MODULE PRODUCTION**:

Source (à vérifier):
- `D:\SAINT JEAN\ME\LICENCE 3 ISJ 2025-2026\STAGE DE FIN DE CYCLE\Developpement\local\tanty_erp\tanty_erp_api_pwa\src\main\java\com\NTFOODS\erp_tanty\modules\production`
- OU chercher dans les fichiers .rar du dossier tanty_erp

Destination:
- `D:\SAINT JEAN\ME\LICENCE 3 ISJ 2025-2026\STAGE DE FIN DE CYCLE\Developpement\local\tanty_erp\api_erp_tanty\src\main\java\com\NTFOODS\erp_tanty\modules\production`

**⚠️ Note**: Certains fichiers de production ont déjà été recréés:
- `LotMP.java` - À vérifier si c'est correct ou s'il faut utiliser LotStock existant
- `V34__create_formulation_tracabilite_tables.sql` - Migration à supprimer (selon préférence utilisateur: pas de migrations en local)
- `ReceptionMPListener.java` - Event listener à vérifier

**Option pour la restauration**:
1. **Depuis GitHub**: Vérifier si le projet api-tanty-digital sur GitHub contient le module production avant le commit eef1df1
2. **Depuis une sauvegarde**: Rechercher dans les fichiers .rar dans le dossier tanty_erp
3. **Reconstruire**: Recréer le module production en se basant sur l'architecture des autres modules

**Structure à restaurer**:
```
modules/production/
├── domain/
│   ├── affectation/
│   │   ├── aggregate/AffectationJournaliere.java
│   │   ├── entity/DetailsRealisationPoste.java
│   │   ├── entity/LigneAffectationPoste.java
│   │   ├── entity/PosteProduction.java
│   │   ├── entity/ProductionIndividuelle.java
│   │   ├── entity/SaisirRealisationPoste.java
│   │   ├── enums/CodePoste.java
│   │   ├── enums/DureeAffectation.java
│   │   ├── enums/StatutAffectation.java
│   │   ├── enums/UniteProduction.java
│   │   └── repository/AffectationJournaliereRepository.java
│   ├── besoin/
│   │   ├── model/ExpressionBesoin.java
│   │   ├── enums/StatutBesoin.java
│   │   ├── enums/TypeBesoin.java
│   │   └── repository/ExpressionBesoinRepository.java
│   ├── broyage/
│   │   ├── aggregate/SessionBroyage.java
│   │   ├── entity/ObjectifMachiniste.java
│   │   ├── entity/RealisationMachiniste.java
│   │   ├── enums/OperationBroyage.java
│   │   ├── enums/StatutSessionBroyage.java
│   │   ├── enums/TypePoudre.java
│   │   └── repository/SessionBroyageRepository.java
│   ├── dosage/
│   │   ├── aggregate/SessionDosage.java
│   │   └── repository/SessionDosageRepository.java
│   ├── fiche/
│   │   ├── aggregate/FicheProduitJournaliere.java
│   │   ├── entity/LigneFicheProduit.java
│   │   ├── events/FicheEnregistreeEvent.java
│   │   ├── events/FicheVerrouilleeEvent.java
│   │   ├── repository/FicheProduitRepository.java
│   │   ├── service/CalculateurPredictionsFiche.java
│   │   └── specification/FicheSpecification.java
│   ├── lot/
│   │   ├── aggregate/LotProduitFini.java
│   │   ├── enums/StatutLot.java
│   │   ├── events/LotDeclareEvent.java
│   │   ├── events/LotValideParStockEvent.java
│   │   ├── repository/LotRepository.java
│   │   └── specification/LotSpecification.java
│   ├── of/
│   │   ├── aggregate/OrdreFabrication.java
│   │   ├── enums/StatutOF.java
│   │   └── repository/OFRepository.java
│   ├── pph/
│   │   ├── aggregate/PlanProductionHebdomadaire.java
│   │   ├── entity/LignePPH.java
│   │   ├── entity/LignePlanDetail.java
│   │   ├── entity/RepartitionJournaliere.java
│   │   ├── enums/RecetteBouillie.java
│   │   ├── enums/StatutPPH.java
│   │   ├── events/PPHValideEvent.java
│   │   └── repository/PPHRepository.java
│   └── registre/
│       ├── aggregate/RegistreProduction.java
│       ├── entity/LigneRegistreEmploye.java
│       └── repository/RegistreProductionRepository.java
├── application/
│   ├── affectation/
│   │   ├── dto/
│   │   ├── mapper/
│   │   ├── service/
│   │   └── usecase/
│   ├── besoin/
│   │   ├── dto/
│   │   ├── mapper/
│   │   └── usecase/
│   ├── broyage/
│   │   ├── dto/
│   │   ├── mapper/
│   │   └── usecase/
│   ├── dosage/
│   │   ├── dto/
│   │   ├── mapper/
│   │   ├── service/
│   │   └── usecase/
│   ├── fiche/
│   │   ├── dto/
│   │   ├── mapper/
│   │   └── usecase/
│   ├── lot/
│   │   ├── dto/
│   │   ├── mapper/
│   │   ├── service/
│   │   └── usecase/
│   ├── of/
│   │   ├── dto/
│   │   ├── mapper/
│   │   └── usecase/
│   ├── pph/
│   │   ├── dto/
│   │   ├── mapper/
│   │   ├── service/
│   │   └── usecase/
│   ├── rapport/
│   │   └── usecase/
│   ├── registre/
│   │   ├── dto/
│   │   ├── mapper/
│   │   └── usecase/
│   └── dashboard/
│       └── usecase/
├── infrastructure/
│   ├── persistence/
│   │   ├── affectation/
│   │   │   ├── jpa/
│   │   │   └── repository/
│   │   ├── besoin/
│   │   │   ├── jpa/
│   │   │   └── repository/
│   │   ├── broyage/
│   │   │   ├── jpa/
│   │   │   └── repository/
│   │   ├── dosage/
│   │   │   ├── jpa/
│   │   │   └── repository/
│   │   ├── fiche/
│   │   │   ├── jpa/
│   │   │   └── repository/
│   │   ├── lot/
│   │   │   ├── jpa/
│   │   │   └── repository/
│   │   ├── of/
│   │   │   ├── jpa/
│   │   │   └── repository/
│   │   ├── pph/
│   │   │   ├── jpa/
│   │   │   └── repository/
│   │   └── registre/
│   │       ├── jpa/
│   │       └── repository/
│   └── messaging/
│       └── FicheVerrouillageListener.java
└── presentation/
    └── controller/
        ├── AffectationController.java
        ├── BroyageController.java
        ├── ChefMachinisteController.java
        ├── DashboardProductionController.java
        ├── DosageController.java
        ├── ExpressionBesoinController.java
        ├── FicheController.java
        ├── LotController.java
        ├── OFController.java
        ├── PPHController.java
        ├── PosteProductionController.java
        ├── PosteProductionPublicController.java
        ├── RapportProductionController.java
        └── RegistreController.java
```

---

## 📝 Améliorations à Appliquer lors de la Restauration

Lors de la restauration du module production, appliquer les améliorations suivantes:

1. **Utiliser BaseEntity** pour toutes les entités (soft delete, audit)
2. **Utiliser Domain Events** pour la communication inter-modules
3. **Intégrer avec Formulation** pour le calcul des besoins en MP
4. **Intégrer avec Conditionnement** pour les produits finis
5. **Ajouter l'audit trail** sur toutes les opérations critiques
6. **Standardiser les DTOs** selon le pattern des autres modules
7. **Ajouter les validations** avec les codes de validation système
8. **Utiliser les repository interfaces** + implementations

---

## 🎯 Architecture Actuelle du Projet

### Backend Modules Existants
- ✅ admin - Paramètres système
- ✅ administration - Administration
- ✅ auth - Authentification
- ✅ commercial - Commercial
- ✅ commercialisation - Commercialisation
- ✅ comptabilite - Comptabilité
- ✅ conditionnement - Conditionnement (NOUVEAU)
- ✅ controle - Contrôle
- ✅ dg - Direction Générale
- ✅ ia - Intelligence Artificielle
- ✅ incidents - Incidents (NOUVEAU)
- ✅ rp - Relations Publiques
- ✅ secretaire - Secrétariat
- ✅ stock - Stock (EXISTANT)
- ✅ sync - Synchronisation
- ✅ users - Utilisateurs
- ❌ **production - PRODUCTION (SUPPRIMÉ PAR ERREUR - À RESTAURER)**

### Frontend Structure
- ✅ core/ - Services partagés
- ✅ domains/ - Modules métier
- ✅ layout/ - Layout partagé
- ✅ pages/ - Pages génériques
- ✅ shared/ - Composants partagés

---

## 🔍 Points de Validation

### Vérifications à faire
1. **Vérifier la structure de tanty_erp_api_pwa** - Pourquoi est-il vide ?
2. **Vérifier la structure de frontend_autres_modules** - Pourquoi est-il vide ?
3. **Restaurer le module production** depuis une source valide
4. **Vérifier que la formulation s'intègre correctement** avec le production restauré
5. **Compiler le backend** après restauration
6. **Compiler le frontend**
7. **Tester les intégrations** entre modules

### Questions pour Claude Code
1. Quelle est la meilleure source pour restaurer le module production ?
2. Les dossiers de référence ont-ils été correctement copiés ?
3. Faut-il vérifier les fichiers .rar pour trouver une sauvegarde du module production ?
4. Faut-il cloner depuis GitHub avant le commit eef1df1 ?

---

## 📌 Instructions pour Claude Code

1. **PRIORITÉ ABSOLUE**: Restaurer le module production complet
2. Utiliser les patterns d'architecture des autres modules comme référence
3. Appliquer les améliorations listées ci-dessus
4. Intégrer avec les nouveaux modules (formulation, conditionnement, events)
5. Maintenir la cohérence avec le module Stock existant
6. Ne pas créer de duplications avec les entités existantes (LotStock, etc.)
7. Suivre les principes DDD du projet
8. Garantir la traçabilité complète (audit trail, events)

---

## 🔄 Historique des Copies

Ce qui a été copié dans le projet complet:

### Backend → api_erp_tanty
- **Depuis Api_tanty**: Module Stock (réceptions, lots, commandes, etc.)
- **Depuis tanty_erp_api_pwa**: Modules Production, Commercialisation, etc. (⚠️ Structure à vérifier)

### Frontend → tanty_digital_pwa
- **Depuis src**: Module Stock frontend
- **Depuis frontend_autres_modules**: Autres modules (⚠️ Structure à vérifier)

---

## 📞 Contact en cas de doute

Si la structure des dossiers de référence n'est pas claire, demander clarification avant de procéder à la restauration.
