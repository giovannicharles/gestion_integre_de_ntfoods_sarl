import { Component, ChangeDetectionStrategy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ConditionnementReferentielService, TypeEmballageBE, TypeEmballageRequestBE,
  VarieteBE, ConfigurationConditionnementBE,
} from '../../../infrastructure/conditionnement-referentiel.service';
import { AuthService } from '../../../../../core/auth/auth.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

/** Formulaire : champs numériques en `number | null` (vide = non renseigné). */
interface TypeEmballageForm {
  code: string; nom: string; description: string; niveauHierarchie: number | null;
  poidsVideG: number | null; dimensionsLongueurMm: number | null; dimensionsLargeurMm: number | null;
  dimensionsHauteurMm: number | null; capaciteMaxKg: number | null; materiau: string; couleur: string;
}

const FORM_VIDE = (): TypeEmballageForm => ({
  code: '', nom: '', description: '', niveauHierarchie: null,
  poidsVideG: null, dimensionsLongueurMm: null, dimensionsLargeurMm: null, dimensionsHauteurMm: null,
  capaciteMaxKg: null, materiau: '', couleur: '',
});

/** Rôles titulaires de STOCK_CONDITIONNEMENT_GERER (RolePermissionMatrix) ; ADMIN a toutes les permissions. */
const ROLES_GESTION = ['GESTIONNAIRE_STOCK', 'DIRECTEUR_GENERAL', 'RESPONSABLE_CONDITIONNEMENT', 'ADMIN'];

/**
 * Référentiel des types d'emballage (sachet, étui, carton, palette…) et calcul du poids d'une
 * configuration de conditionnement — ConditionnementController (/api/conditionnement).
 */
@Component({
  selector: 'app-types-emballage',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule],
  templateUrl: './types-emballage.component.html',
  styleUrls: ['./types-emballage.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TypesEmballageComponent implements OnInit {
  private readonly svc = inject(ConditionnementReferentielService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly peutGerer = computed(() => ROLES_GESTION.includes(this.auth.role() ?? ''));

  // ── Liste ──
  loading = signal(true);
  erreurChargement = signal('');
  types = signal<TypeEmballageBE[]>([]);
  recherche = signal('');
  filtreNiveau = signal<string>('');

  niveauxPresents = computed(() => [...new Set(this.types().map(t => t.niveauHierarchie))].sort((a, b) => a - b));
  nbMateriaux = computed(() => new Set(this.types().map(t => (t.materiau ?? '').trim().toLowerCase()).filter(Boolean)).size);
  typesFiltres = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    const n = this.filtreNiveau();
    return this.types()
      .filter(t => !n || String(t.niveauHierarchie) === n)
      .filter(t => !q || [t.code, t.nom, t.materiau ?? '', t.couleur ?? ''].some(v => v.toLowerCase().includes(q)))
      .sort((a, b) => a.niveauHierarchie - b.niveauHierarchie || a.code.localeCompare(b.code));
  });

  // ── Création / modification ──
  showForm = signal(false);
  enEdition = signal<TypeEmballageBE | null>(null);
  form: TypeEmballageForm = FORM_VIDE();
  erreurForm = signal('');
  saving = signal(false);

  // ── Désactivation ──
  aDesactiver = signal<TypeEmballageBE | null>(null);
  desactivation = signal(false);

  // ── Calculateur de poids ──
  varietes = signal<VarieteBE[]>([]);
  varietesErreur = signal('');
  varieteId: number | null = null;
  configurations = signal<ConfigurationConditionnementBE[]>([]);
  chargementConfigs = signal(false);
  configurationId: number | null = null;
  nombreUnites: number | null = 1;
  poidsCalcule = signal<{ kg: number; unites: number; config: ConfigurationConditionnementBE } | null>(null);
  erreurCalcul = signal('');
  calcul = signal(false);

  ngOnInit(): void {
    this.charger();
    this.svc.listerVarietes().subscribe({
      next: v => this.varietes.set(v.filter(x => x.actif !== false).sort((a, b) => a.nom.localeCompare(b.nom))),
      error: e => this.varietesErreur.set(extractApiError(e)),
    });
  }

  charger(): void {
    this.loading.set(true);
    this.erreurChargement.set('');
    this.svc.listerTypesEmballage().subscribe({
      next: t => { this.types.set(t); this.loading.set(false); },
      error: e => { this.erreurChargement.set(extractApiError(e)); this.loading.set(false); },
    });
  }

  // ── Formulaire ────────────────────────────────────────────────────────────

  ouvrirCreation(): void {
    this.enEdition.set(null);
    this.form = FORM_VIDE();
    this.erreurForm.set('');
    this.showForm.set(true);
  }

  ouvrirEdition(t: TypeEmballageBE): void {
    this.enEdition.set(t);
    this.form = {
      code: t.code, nom: t.nom, description: t.description ?? '', niveauHierarchie: t.niveauHierarchie,
      poidsVideG: t.poidsVideG, dimensionsLongueurMm: t.dimensionsLongueurMm, dimensionsLargeurMm: t.dimensionsLargeurMm,
      dimensionsHauteurMm: t.dimensionsHauteurMm, capaciteMaxKg: t.capaciteMaxKg,
      materiau: t.materiau ?? '', couleur: t.couleur ?? '',
    };
    this.erreurForm.set('');
    this.showForm.set(true);
  }

  fermerForm(): void {
    if (this.saving()) return;
    this.showForm.set(false);
  }

  /** Mêmes règles que TypeEmballageRequest (@NotBlank, @Size, @Min/@Max, @PositiveOrZero). */
  private validerForm(): string | null {
    const f = this.form;
    if (!f.code.trim() || !f.nom.trim()) return 'Le code et le nom sont obligatoires.';
    if (f.code.trim().length > 50) return 'Le code ne doit pas dépasser 50 caractères.';
    if (f.nom.trim().length > 100) return 'Le nom ne doit pas dépasser 100 caractères.';
    if (f.niveauHierarchie === null || !Number.isInteger(f.niveauHierarchie) || f.niveauHierarchie < 1 || f.niveauHierarchie > 10) {
      return 'Le niveau hiérarchique est obligatoire : un entier de 1 à 10.';
    }
    const positifs: [number | null, string][] = [
      [f.poidsVideG, 'Le poids à vide'], [f.dimensionsLongueurMm, 'La longueur'], [f.dimensionsLargeurMm, 'La largeur'],
      [f.dimensionsHauteurMm, 'La hauteur'], [f.capaciteMaxKg, 'La capacité maximale'],
    ];
    for (const [v, lib] of positifs) if (v !== null && v < 0) return `${lib} ne peut pas être négatif(ve).`;
    if (f.materiau.trim().length > 100) return 'Le matériau ne doit pas dépasser 100 caractères.';
    if (f.couleur.trim().length > 50) return 'La couleur ne doit pas dépasser 50 caractères.';
    return null;
  }

  private versRequete(): TypeEmballageRequestBE {
    const f = this.form;
    const entier = (v: number | null) => (v === null || (v as unknown) === '' ? null : Math.round(Number(v)));
    return {
      code: f.code.trim().toUpperCase(),
      nom: f.nom.trim(),
      description: f.description.trim() || null,
      niveauHierarchie: Number(f.niveauHierarchie),
      poidsVideG: entier(f.poidsVideG),
      dimensionsLongueurMm: entier(f.dimensionsLongueurMm),
      dimensionsLargeurMm: entier(f.dimensionsLargeurMm),
      dimensionsHauteurMm: entier(f.dimensionsHauteurMm),
      capaciteMaxKg: f.capaciteMaxKg === null || (f.capaciteMaxKg as unknown) === '' ? null : Number(f.capaciteMaxKg),
      materiau: f.materiau.trim() || null,
      couleur: f.couleur.trim() || null,
    };
  }

  enregistrer(): void {
    const erreur = this.validerForm();
    if (erreur) { this.erreurForm.set(erreur); return; }
    const edition = this.enEdition();
    const req = this.versRequete();
    this.erreurForm.set('');
    this.saving.set(true);
    const action$ = edition ? this.svc.modifierTypeEmballage(edition.id, req) : this.svc.creerTypeEmballage(req);
    action$.subscribe({
      next: t => {
        this.saving.set(false);
        this.showForm.set(false);
        this.types.update(l => edition ? l.map(x => x.id === t.id ? t : x) : [...l, t]);
        this.toast.success(edition ? `Type d'emballage ${t.code} modifié.` : `Type d'emballage ${t.code} créé.`);
      },
      error: e => { this.saving.set(false); this.erreurForm.set(extractApiError(e)); },
    });
  }

  // ── Désactivation ─────────────────────────────────────────────────────────

  demanderDesactivation(t: TypeEmballageBE): void { this.aDesactiver.set(t); }

  annulerDesactivation(): void { if (!this.desactivation()) this.aDesactiver.set(null); }

  confirmerDesactivation(): void {
    const t = this.aDesactiver();
    if (!t) return;
    this.desactivation.set(true);
    this.svc.desactiverTypeEmballage(t.id).subscribe({
      next: () => {
        this.desactivation.set(false);
        this.aDesactiver.set(null);
        this.types.update(l => l.filter(x => x.id !== t.id));
        this.toast.success(`Type d'emballage ${t.code} désactivé.`);
      },
      error: e => {
        this.desactivation.set(false);
        this.aDesactiver.set(null);
        this.toast.error(extractApiError(e), 'Désactivation impossible');
      },
    });
  }

  // ── Calculateur ───────────────────────────────────────────────────────────

  choisirVariete(id: number | null): void {
    this.varieteId = id;
    this.configurationId = null;
    this.configurations.set([]);
    this.poidsCalcule.set(null);
    this.erreurCalcul.set('');
    if (id === null) return;
    this.chargementConfigs.set(true);
    this.svc.listerConfigurationsVariete(id).subscribe({
      next: c => {
        this.configurations.set(c.filter(x => x.actif !== false).sort((a, b) => a.niveau - b.niveau));
        this.chargementConfigs.set(false);
      },
      error: e => { this.chargementConfigs.set(false); this.erreurCalcul.set(extractApiError(e)); },
    });
  }

  choisirConfiguration(id: number | null): void {
    this.configurationId = id;
    this.poidsCalcule.set(null);
    this.erreurCalcul.set('');
  }

  calculer(): void {
    const config = this.configurations().find(c => c.id === this.configurationId);
    const n = Number(this.nombreUnites);
    if (!config) { this.erreurCalcul.set('Choisissez une configuration.'); return; }
    if (!Number.isInteger(n) || n < 1) { this.erreurCalcul.set('Le nombre d\'unités doit être un entier d\'au moins 1.'); return; }
    this.erreurCalcul.set('');
    this.calcul.set(true);
    this.svc.calculerPoidsTotal(config.id, n).subscribe({
      next: kg => { this.calcul.set(false); this.poidsCalcule.set({ kg, unites: n, config }); },
      error: e => { this.calcul.set(false); this.erreurCalcul.set(extractApiError(e)); },
    });
  }

  /** Configuration choisie sans poids net ni poids total : le serveur refusera le calcul (409). */
  configurationSansPoids(): boolean {
    const c = this.configurations().find(x => x.id === this.configurationId);
    return !!c && c.poidsTotalKg === null && c.poidsNetG === null && !this.erreurCalcul();
  }

  // ── Affichage ─────────────────────────────────────────────────────────────

  dimensions(t: TypeEmballageBE): string {
    const d = [t.dimensionsLongueurMm, t.dimensionsLargeurMm, t.dimensionsHauteurMm];
    return d.every(v => v === null || v === undefined) ? '—' : d.map(v => v ?? '?').join(' × ') + ' mm';
  }
}
