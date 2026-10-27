import { Component, ElementRef, HostListener, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ComposantEmballageBE, ConditionnementProductionBE, ProductionService, ReferentielProductionBE, TYPES_EMBALLAGE,
} from '../../../infrastructure/production.service';

interface LigneConditionnement { produit: ReferentielProductionBE; cond: ConditionnementProductionBE; }
interface ComposantEdition { type: string; quantiteComposant: number | null; quantiteUnitesProduites: number | null; }
interface Notification { texte: string; type: 'ok' | 'erreur'; }
type FiltreComposition = 'TOUS' | 'AVEC' | 'SANS';
type Tri = 'produit' | 'sku' | 'type' | 'sans-composition-d-abord';

const ICONES: Record<string, string> = {
  SACHET: 'fa-bag-shopping', COUVERCLE: 'fa-circle', SCELLE: 'fa-stamp', CARTON: 'fa-box',
  SEAU: 'fa-bucket', GAINE: 'fa-scroll', ETUI: 'fa-box-open',
};

/** Minuscules, sans accents, pour une recherche tolérante. */
export function normaliser(texte: string): string {
  return (texte ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

/**
 * COMPOSITION D'EMBALLAGE — Chef de Production / Responsable de Salle.
 *
 * Pour chaque conditionnement : son type (sachet, seau, carton...) et ses
 * composants, avec un ratio « X composant(s) pour Y unités produites ». Les
 * besoins d'emballage des plans en sont déduits, arrondis au supérieur.
 */
@Component({
  selector: 'app-composition-emballage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './composition-emballage.component.html',
  styleUrls: ['./composition-emballage.component.css'],
})
export class CompositionEmballageComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  @ViewChild('champRecherche') champRecherche?: ElementRef<HTMLInputElement>;

  readonly types = TYPES_EMBALLAGE;

  // ── État ──────────────────────────────────────────────────────────────────
  chargement = signal(true);
  enregistrement = signal(false);
  notification = signal<Notification | null>(null);
  produits = signal<ReferentielProductionBE[]>([]);

  // ── Recherche, filtres, tri ───────────────────────────────────────────────
  recherche = signal('');
  filtre = signal<FiltreComposition>('TOUS');
  typeFiltre = signal('');
  categorieFiltre = signal('');
  seulementActifs = signal(true);
  tri = signal<Tri>('produit');

  readonly filtres: { code: FiltreComposition; libelle: string }[] = [
    { code: 'TOUS', libelle: 'Tous' },
    { code: 'AVEC', libelle: 'Avec composition' },
    { code: 'SANS', libelle: 'Sans composition' },
  ];

  /** Tous les conditionnements à plat, avec leur produit. */
  lignes = computed<LigneConditionnement[]>(() =>
    this.produits().flatMap(produit => produit.conditionnements.map(cond => ({ produit, cond }))));

  stats = computed(() => {
    const liste = this.lignes().filter(l => l.produit.actif || !this.seulementActifs());
    const avec = liste.filter(l => !!l.cond.type).length;
    return { total: liste.length, avec, sans: liste.length - avec, produits: new Set(liste.map(l => l.produit.codeProduit)).size };
  });

  categories = computed(() => {
    const compte = new Map<string, number>();
    for (const p of this.produits()) compte.set(p.categorieMetier, (compte.get(p.categorieMetier) ?? 0) + 1);
    return [...compte.entries()].map(([code, n]) => ({ code, n })).sort((a, b) => a.code.localeCompare(b.code));
  });

  /** Nombre de conditionnements par type, pour les pastilles de filtre. */
  parType = computed(() => {
    const compte = new Map<string, number>();
    for (const l of this.lignes()) if (l.cond.type) compte.set(l.cond.type, (compte.get(l.cond.type) ?? 0) + 1);
    return compte;
  });

  resultats = computed(() => {
    const q = normaliser(this.recherche());
    const f = this.filtre();
    const type = this.typeFiltre();
    const cat = this.categorieFiltre();
    const liste = this.lignes().filter(({ produit, cond }) => {
      if (this.seulementActifs() && !produit.actif) return false;
      if (f === 'AVEC' && !cond.type) return false;
      if (f === 'SANS' && cond.type) return false;
      if (type && cond.type !== type) return false;
      if (cat && produit.categorieMetier !== cat) return false;
      if (!q) return true;
      return normaliser(produit.codeProduit).includes(q)
        || normaliser(produit.designation).includes(q)
        || normaliser(cond.sku).includes(q)
        || normaliser(cond.libelle).includes(q)
        || (cond.type ? normaliser(this.libelleType(cond.type)).includes(q) : false)
        || cond.composants.some(c => normaliser(this.libelleType(c.type)).includes(q));
    });
    const tri = this.tri();
    return [...liste].sort((a, b) => {
      if (tri === 'sku') return a.cond.sku.localeCompare(b.cond.sku);
      if (tri === 'type') {
        // Sans type à la fin ; à type égal, par produit
        const diff = (a.cond.type ?? '￿').localeCompare(b.cond.type ?? '￿');
        if (diff !== 0) return diff;
      }
      if (tri === 'sans-composition-d-abord') {
        const diff = Number(!!a.cond.type) - Number(!!b.cond.type);
        if (diff !== 0) return diff;
      }
      return a.produit.codeProduit.localeCompare(b.produit.codeProduit) || a.cond.sku.localeCompare(b.cond.sku);
    });
  });

  // ── Éditeur ───────────────────────────────────────────────────────────────
  edition = signal<LigneConditionnement | null>(null);
  type = signal('');
  composants = signal<ComposantEdition[]>([]);
  unitesApercu = signal<number | null>(100);

  doublons = computed(() => {
    const vus = new Map<string, number>();
    for (const c of this.composants()) vus.set(c.type, (vus.get(c.type) ?? 0) + 1);
    return new Set([...vus.entries()].filter(([, n]) => n > 1).map(([t]) => t));
  });

  composantsValides = computed(() => this.composants().every(c =>
    (Number(c.quantiteComposant) || 0) >= 1 && (Number(c.quantiteUnitesProduites) || 0) >= 1));

  formValide = computed(() => {
    if (!this.type()) return true; // effacer la composition est toujours permis
    return this.composants().length > 0 && this.composantsValides() && this.doublons().size === 0;
  });

  /** Besoins calculés pour N unités produites, arrondis au supérieur comme côté serveur. */
  apercu = computed(() => {
    const n = Number(this.unitesApercu()) || 0;
    return this.composants()
      .filter(c => (Number(c.quantiteUnitesProduites) || 0) >= 1 && (Number(c.quantiteComposant) || 0) >= 1)
      .map(c => ({
        type: c.type,
        libelle: this.libelleType(c.type),
        besoin: Math.ceil((n * (Number(c.quantiteComposant) || 0)) / (Number(c.quantiteUnitesProduites) || 1)),
      }));
  });

  // ── Cycle de vie ──────────────────────────────────────────────────────────
  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.chargement.set(true);
    this.svc.getReferentielFormules().subscribe({
      next: l => { this.produits.set(l); this.chargement.set(false); },
      error: e => {
        this.chargement.set(false);
        this.notifier(this.messageErreur(e, 'Impossible de charger les conditionnements.'), 'erreur');
      }
    });
  }

  @HostListener('document:keydown', ['$event'])
  onClavier(ev: KeyboardEvent): void {
    const cible = ev.target as HTMLElement | null;
    const saisie = cible && ['INPUT', 'TEXTAREA', 'SELECT'].includes(cible.tagName);
    if (ev.key === 'Escape' && this.edition()) { this.fermer(); return; }
    if (ev.key === '/' && !saisie && !this.edition()) {
      ev.preventDefault();
      this.champRecherche?.nativeElement.focus();
      return;
    }
    if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter' && this.edition()) {
      ev.preventDefault();
      this.enregistrer();
    }
  }

  reinitialiserFiltres(): void {
    this.recherche.set('');
    this.filtre.set('TOUS');
    this.typeFiltre.set('');
    this.categorieFiltre.set('');
    this.seulementActifs.set(true);
  }

  // ── Éditeur : ouverture, composants ───────────────────────────────────────
  ouvrir(l: LigneConditionnement): void {
    this.edition.set(l);
    this.type.set(l.cond.type ?? '');
    this.unitesApercu.set(100);
    this.composants.set(l.cond.composants.length
      ? l.cond.composants.map(c => ({ type: c.type, quantiteComposant: c.quantiteComposant, quantiteUnitesProduites: c.quantiteUnitesProduites }))
      : [{ type: 'SACHET', quantiteComposant: 1, quantiteUnitesProduites: 1 }]);
  }

  fermer(): void {
    if (this.enregistrement()) return;
    this.edition.set(null);
  }

  choisirType(code: string): void {
    this.type.set(code);
    if (this.composants().length === 0) {
      this.composants.set([{ type: code, quantiteComposant: 1, quantiteUnitesProduites: 1 }]);
    }
  }

  effacerType(): void {
    this.type.set('');
  }

  majComposant(i: number, champ: keyof ComposantEdition, valeur: string | number | null): void {
    this.composants.update(liste => liste.map((c, idx) => idx === i ? { ...c, [champ]: valeur } as ComposantEdition : c));
  }

  ajouterComposant(): void {
    const utilises = new Set(this.composants().map(c => c.type));
    const libre = TYPES_EMBALLAGE.find(t => !utilises.has(t.code))?.code ?? 'CARTON';
    this.composants.update(liste => [...liste, { type: libre, quantiteComposant: 1, quantiteUnitesProduites: 1 }]);
  }

  retirerComposant(i: number): void {
    this.composants.update(liste => liste.filter((_, idx) => idx !== i));
  }

  // ── Enregistrement ────────────────────────────────────────────────────────
  enregistrer(): void {
    const e = this.edition();
    if (!e || !this.formValide() || this.enregistrement()) return;
    this.enregistrement.set(true);
    const req = this.type()
      ? {
          type: this.type(),
          composants: this.composants().map(c => ({
            type: c.type,
            quantiteComposant: Number(c.quantiteComposant),
            quantiteUnitesProduites: Number(c.quantiteUnitesProduites),
          })) as ComposantEmballageBE[],
        }
      : { type: null, composants: [] as ComposantEmballageBE[] };
    this.svc.definirCompositionEmballage(e.produit.codeProduit, e.cond.id, req).subscribe({
      next: maj => {
        this.produits.update(liste => liste.map(x => x.codeProduit === maj.codeProduit ? maj : x));
        this.enregistrement.set(false);
        this.edition.set(null);
        this.notifier(
          this.type()
            ? `Composition de ${e.cond.sku} enregistrée. Recalculez les plans concernés pour appliquer.`
            : `Composition de ${e.cond.sku} effacée.`, 'ok');
      },
      error: err => {
        this.enregistrement.set(false);
        this.notifier(this.messageErreur(err, 'Enregistrement impossible.'), 'erreur');
      }
    });
  }

  // ── Affichage ─────────────────────────────────────────────────────────────
  libelleType(code: string): string {
    return TYPES_EMBALLAGE.find(t => t.code === code)?.libelle ?? code;
  }

  icone(code: string | null | undefined): string {
    return ICONES[code ?? ''] ?? 'fa-box';
  }

  /** Noms au pluriel des types, pour écrire « 12 seaux » plutôt que « 12 unités ». */
  private readonly pluriels: Record<string, string> = {
    SACHET: "sachets", COUVERCLE: "couvercles", SCELLE: "scellés", CARTON: "cartons",
    SEAU: "seaux", GAINE: "gaines", ETUI: "étuis",
  };

  /** Nom de l'unité produite selon le type du conditionnement (ex. « seaux »). */
  uniteDuType(code: string | null | undefined): string {
    return this.pluriels[code ?? ""] ?? "unités";
  }

  /** Phrase simple : « 1 carton pour chaque 12 seaux ». */
  phrase(c: ComposantEmballageBE, typeProduit: string | null): string {
    const nom = c.quantiteComposant > 1 ? this.uniteDuType(c.type) : this.libelleType(c.type).toLowerCase();
    return `${c.quantiteComposant} ${nom} pour chaque ${c.quantiteUnitesProduites} ${this.uniteDuType(typeProduit)}`;
  }

  notifier(texte: string, type: 'ok' | 'erreur'): void {
    this.notification.set({ texte, type });
    setTimeout(() => {
      if (this.notification()?.texte === texte) this.notification.set(null);
    }, type === 'ok' ? 5000 : 9000);
  }

  messageErreur(e: { error?: { erreur?: string; message?: string } } | null, repli: string): string {
    return e?.error?.erreur || e?.error?.message || repli;
  }

  trackLigne = (_: number, l: LigneConditionnement) => `${l.produit.codeProduit}|${l.cond.id}`;
}
