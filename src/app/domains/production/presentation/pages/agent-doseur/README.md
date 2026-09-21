# Module Agent Doseur — refactorisé + aligné charte TANTY

Refactorisation UX + architecture du module `agent-doseur`, branchée exclusivement
sur `ProductionService`, et **alignée sur le design system global TANTY**
(vert #14532D · jaune #F6B60B · rouge #C22B2B · Poppins/Inter). Toutes les
fonctionnalités métier existantes sont conservées.

## Contenu du livrable
- `agent-doseur/` : le module refactorisé (à déposer à la place de l'ancien).
- `styles.css` : votre design system **inchangé**, complété en fin de fichier d'un
  petit bloc « COMPAT — Espace Agent Doseur ». À placer à la racine des styles
  globaux (ex. `src/styles.css`).

---

## 1. Écran guidé « Ma session du jour » (`session-jour/`)
Assistant unique en 5 étapes qui remplace les 6 anciens écrans pour une session :
**1. Ma session** · **2. Dosage** (Bouillie/Arachide + fûts, matières auto) ·
**3. Fûts** · **4. Machines** (optionnel) · **5. Terminer** (estimation, registre, clôture).
Pensé agent non-informaticien / tactile / gants : cibles ≥ 60 px, gros chiffres,
une action principale par étape, reprise auto de la session ouverte.

Câblage du routage (fichier de routes non fourni) :
```ts
{ path: 'ma-session',
  loadComponent: () => import('./session-jour/ad-session-jour.component')
    .then(m => m.AdSessionJourComponent) },
{ path: '', redirectTo: 'ma-session', pathMatch: 'full' },
```

## 2. Alignement charte TANTY (nouveauté de cette version)
- L'écran guidé est **100 % recalé sur les tokens officiels** (`--g`, `--y`, `--r`,
  `--o`, `--s`, `--n*`, `--sh-*`, `--r-*`, `--font-d/-b`). Il était auparavant sur des
  variables inexistantes (`--primary`…) et rendait en bleu ; il est désormais **vert TANTY**.
- `_shared.css` (utilitaires du module) recalé sur les mêmes tokens ; les
  redéfinitions divergentes de `.badge` / `.bg-*` ont été **supprimées** pour laisser
  gagner le thème (badges « pill » verts/pâles uniformes partout).
- `styles.css` complété : alias `.input` (= `.form-control`), plus `.text-muted`,
  `.sr-only`, `.row-actions` — classes utilisées par le module mais absentes du thème.
  **Ajouts uniquement, aucune règle existante modifiée.**
- Correctifs de classes : `bg-warning` → `bg-orange` (mélange) ; le composant racine
  importe désormais `_shared.css` (ses `.gap-note` étaient sans style).

## 3. Refactorisation DRY : `AdSessionContextService`
Centralise le chargement des sessions ouvertes du jour + la sélection active
(logique auparavant copiée à l'identique dans 5 composants, avec 5 appels API
redondants). Auto-sélection quand une seule session est ouverte. Documents garde
son propre chargement (doit cibler aussi les sessions clôturées).

## 4. Nettoyage
- Code mort retiré du service (`getMachinistes()` commenté) →
  `_infrastructure/production.service.ts`, à recopier vers son emplacement réel.
- CSS dupliqué du composant racine supprimé.

---

## Reste pour un build 100 % vérifié
Pour garantir la compilation de bout en bout, joignez `api.service.ts`,
`auth.service.ts`, `api-response.model.ts` et les composants `mini-chart` /
`donut-chart` (hors ZIP). Le reste est prêt à l'emploi.
