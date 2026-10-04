# CLAUDE.md — TANTY DIGITAL ERP (Frontend)

Frontend Angular 18 (PWA) de l'ERP interne NTFOODS SARL (marque TANTY). Consomme l'API Spring Boot du dépôt `api_erp_tanty` (voisin de ce dépôt).

**Références (à lire en entier au début de chaque session) :**

- @docs/TANTY_DIGITAL_CONTEXTE.md — règles métier, principes, standards, feuille de route par phases. **Fait foi** pour le métier, la sécurité et les invariants. La section 0 (méthode de travail) et la Phase 6 (§13) concernent directement ce dépôt.
- @docs/CONTINUATION_ERP_TANTY.md — notes d'un travail précédent. **Hypothèses à vérifier, pas des faits.**
- `docs/PROGRESS.md` et `docs/CODEBASE_MAP.md` — état d'avancement et carte du code côté API (Phase 0), à consulter pour comprendre les contrats consommés par ce frontend.

Le **code réel** fait foi pour les noms techniques existants. Tout écart avec le document est signalé, jamais résolu en silence.

---

## Porte d'entrée déjà franchie

La porte d'entrée (§0.0 du document de contexte) a été traitée côté monorepo racine (`tanty_erp/`) : ce dépôt (`tanty_digital_pwa`) est confirmé comme **frontend du projet complet**. L'API correspondante est `api_erp_tanty` (dépôt voisin). Sources déjà partiellement intégrées ici : `src` (racine, module Stock) et `frontend_autres_modules` (autres modules, dont Production déjà copié) — voir `docs/CONTINUATION_ERP_TANTY.md` pour l'historique et les divergences connues (ex. domaine `stock` avec un compte de fichiers différent entre source et cible, à vérifier avant toute nouvelle copie).

**L'ordre du projet place le frontend après l'API complète (Phase 6).** Ne pas anticiper de travail fonctionnel ici tant que l'audit et les fondations côté API (Phases 0 à 5) ne sont pas validés, sauf demande explicite.

## Règles de travail (détail : §0 du document de contexte)

- **Explorer avant d'écrire.** Recherche ciblée, puis lecture des fichiers concernés. Ne suppose jamais le contenu d'un fichier non ouvert.
- **Mode plan avant toute modification.** Attends validation pour tout changement touchant plus de 5 fichiers ou la structure des domaines.
- **Petits incréments**, une tranche verticale à la fois, diff minimal, aucun refactor « au passage », aucune fonctionnalité non demandée.
- **Réutiliser avant de créer.** Vérifie `core/`, `shared/` avant d'ajouter un service, composant ou modèle.
- **Aucun geste destructif.** Branche dédiée. **Relis `git diff --stat` avant chaque commit** : toute suppression non prévue de fichiers ou de plus de 20 lignes est un STOP. Un commit = un objectif.
- **Les gardes de route sont un confort, jamais une sécurité.** Aucune règle de sécurité ne doit reposer uniquement sur le routing Angular — la sécurité réelle vient de l'API.
- **Respecte les contrats API existants** (DTO, formats de réponse, codes d'erreur) tels qu'exposés par `api_erp_tanty` ; signale toute divergence plutôt que de la contourner côté client.
- **Non-régression** : lance les tests existants avant de toucher une zone ; un comportement sans test reçoit d'abord un test de caractérisation.

## Invariants côté frontend (non négociables)

1. **Aucune écriture de stock directe** : toute action passe par un formulaire de demande, jamais par un bouton d'exécution directe (cf. Phase 6 : boîte « Mes validations », frise de statut, formulaires de demande).
2. **Soft delete visible** : corbeille avec restauration pour les référentiels et brouillons ; ne jamais proposer de suppression physique dans l'UI.
3. **Aucune valeur métier codée en dur** dans les composants — vient des paramètres système exposés par l'API.
4. **Respecte la charte TANTY** et l'architecture Angular du module Stock (référence d'architecture pour les autres domaines).

## Décisions actées (ne pas remettre en question sans confirmation)

- `commercial` et `commercialisation` seront unifiés côté API (Phase 0.6) ; les URL d'API restent stables jusqu'à la Phase 6 frontend — ne pas migrer les appels avant le signal explicite.
- `admin` = gestion du système (paramètres, configuration) ; `administration` a une frontière distincte, précisée par l'audit API.

## Format de compte rendu (30 lignes max hors preuves)

```
FAIT · FICHIERS · PREUVES · ÉCARTS DÉTECTÉS · À VALIDER · SUIVANT
```

## Commandes utiles

Les commandes exactes (`ng serve`, `ng build`, `ng test`) seront consignées ici après vérification (Angular 18.2, voir `package.json` / `angular.json` de ce dépôt).
