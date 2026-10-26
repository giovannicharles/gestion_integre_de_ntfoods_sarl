import { Component, ElementRef, HostListener, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormuleLigneBE, ProductionService, ReferentielProductionBE } from '../../../infrastructure/production.service';

interface LigneEdition { matierePremiere: string; proportionKg: number | null; }
interface Notification { texte: string; type: 'ok' | 'erreur'; }
type FiltreFormule = 'TOUS' | 'AVEC' | 'SANS';
type Tri = 'code' | 'designation' | 'sans-formule-d-abord';

const PALETTE = ['#14532D', '#F6B60B', '#2A9D5F', '#C49200', '#1565C0', '#8E24AA', '#E65100', '#00897B'];

/** Minuscules, sans accents : « Maïs » et « mais » se comparent comme égaux. */
export function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

/** Libellé lisible d'une catégorie métier (TANTY_BOUILLIE_DE_SOJA → Bouillie de soja). */
export function libelleCategorie(code: string): string {
  const texte = code.replace(/^TANTY_/, '').replace(/_/g, ' ').toLowerCase();
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/**
 * FORMULES DE PRODUCTION — Chef de Production / Responsable de Salle.
 *
 * Une formule est propre à un produit : des matières premières et, pour chacune,
 * les kg pour une base de produit fini. Elle pilote les besoins des plans.
 * Modifier une formule n'altère pas les plans déjà générés : il faut les recalculer.
 */
@Component({
  selector: 'app-formules-production',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule],
  templateUrl: './formules-production.component.html',
  styleUrls: ['./formules-production.component.css'],
})
export class FormulesProductionComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  @ViewChild('champRecherche') champRecherche?: ElementRef<HTMLInputElement>;

  readonly palette = PALETTE;
  readonly libelleCategorie = libelleCategorie;

  // ── État ──────────────────────────────────────────────────────────────────
  chargement = signal(true);
  enregistrement = signal(false);
  suppressionCode = signal<string | null>(null);
  notification = signal<Notification | null>(null);
  produits = signal<ReferentielProductionBE[]>([]);

  // ── Recherche, filtres, tri ───────────────────────────────────────────────
  recherche = signal('');
  filtre = signal<FiltreFormule>('TOUS');
  categorieFiltre = signal('');
  seulementActifs = signal(true);
  tri = signal<Tri>('code');

  readonly filtres: { code: FiltreFormule; libelle: string }[] = [
    { code: 'TOUS', libelle: 'Tous' },
    { code: 'AVEC', libelle: 'Avec formule' },
    { code: 'SANS', libelle: 'Sans formule' },
  ];

  /** Matières utilisées par chaque formule, normalisées, pour la recherche par ingrédient. */
  private readonly indexMatieres = computed(() => {
    const index = new Map<string, string[]>();
    for (const p of this.produits()) {
      index.set(p.codeProduit, (p.formule?.lignes ?? []).map(l => normaliser(l.matierePremiere)));
    }
    return index;
  });

  /** Toutes les matières déjà utilisées dans les formules : aide à la saisie, pour écrire le même nom partout. */
  matieresConnues = computed(() => {
    const noms = new Map<string, string>();
    for (const p of this.produits()) for (const l of p.formule?.lignes ?? []) {
      const cle = normaliser(l.matierePremiere);
      if (!noms.has(cle)) noms.set(cle, l.matierePremiere);
    }
    return [...noms.values()].sort((a, b) => a.localeCompare(b));
  });

  stats = computed(() => {
    const liste = this.produits().filter(p => p.actif || !this.seulementActifs());
    const avec = liste.filter(p => !!p.formule).length;
    return { total: liste.length, avec, sans: liste.length - avec };
  });

  categories = computed(() => {
    const compte = new Map<string, number>();
    for (const p of this.produits()) {
      compte.set(p.categorieMetier, (compte.get(p.categorieMetier) ?? 0) + 1);
    }
    return [...compte.entries()]
      .map(([code, n]) => ({ code, libelle: libelleCategorie(code), n }))
      .sort((a, b) => a.libelle.localeCompare(b.libelle));
  });

  resultats = computed(() => {
    const q = normaliser(this.recherche());
    const f = this.filtre();
    const cat = this.categorieFiltre();
    const index = this.indexMatieres();
    const liste = this.produits().filter(p => {
      if (this.seulementActifs() && !p.actif) return false;
      if (f === 'AVEC' && !p.formule) return false;
      if (f === 'SANS' && p.formule) return false;
      if (cat && p.categorieMetier !== cat) return false;
      if (!q) return true;
      return normaliser(p.codeProduit).includes(q)
        || normaliser(p.designation).includes(q)
        || normaliser(libelleCategorie(p.categorieMetier)).includes(q)
        || (index.get(p.codeProduit) ?? []).some(m => m.includes(q));
    });
    const tri = this.tri();
    return [...liste].sort((a, b) => {
      if (tri === 'designation') return a.designation.localeCompare(b.designation);
      if (tri === 'sans-formule-d-abord') {
        const diff = Number(!!a.formule) - Number(!!b.formule);
        if (diff !== 0) return diff;
      }
      return a.codeProduit.localeCompare(b.codeProduit);
    });
  });

  /** Vrai si la recherche ne correspond qu'à une matière (et pas au code ou à la désignation). */
  correspondMatiere(p: ReferentielProductionBE): string | null {
    const q = normaliser(this.recherche());
    if (!q) return null;
    if (normaliser(p.codeProduit).includes(q) || normaliser(p.designation).includes(q)) return null;
    return p.formule?.lignes.find(l => normaliser(l.matierePremiere).includes(q))?.matierePremiere ?? null;
  }

  // ── Éditeur ───────────────────────────────────────────────────────────────
  edition = signal<ReferentielProductionBE | null>(null);
  baseKg = signal<number | null>(null);
  lignes = signal<LigneEdition[]>([]);
  rechercheCopie = signal('');

  somme = computed(() => this.lignes().reduce((s, l) => s + (Number(l.proportionKg) || 0), 0));
  ecart = computed(() => Math.abs(this.somme() - (Number(this.baseKg()) || 0)));
  sommeOk = computed(() => (Number(this.baseKg()) || 0) > 0 && this.ecart() < 0.0005);

  doublons = computed(() => {
    const vus = new Map<string, number>();
    for (const l of this.lignes()) {
      const cle = normaliser(l.matierePremiere);
      if (cle) vus.set(cle, (vus.get(cle) ?? 0) + 1);
    }
    return new Set([...vus.entries()].filter(([, n]) => n > 1).map(([k]) => k));
  });

  nomsInvalides = computed(() => this.lignes().some(l => !l.matierePremiere.trim()));
  proportionsInvalides = computed(() => this.lignes().some(l => l.proportionKg === null || Number(l.proportionKg) < 0));

  formValide = computed(() =>
    this.sommeOk() && this.lignes().length > 0 && !this.nomsInvalides()
    && !this.proportionsInvalides() && this.doublons().size === 0);

  /** Largeurs des segments de la barre de composition, en % de la somme. */
  segmentsApercu = computed(() => {
    const total = this.somme();
    return this.lignes().map((l, i) => ({
      nom: l.matierePremiere || '—',
      pct: total > 0 ? ((Number(l.proportionKg) || 0) / total) * 100 : 0,
      couleur: PALETTE[i % PALETTE.length],
    }));
  });

  formulesCopiables = computed(() => {
    const q = normaliser(this.rechercheCopie());
    return this.produits()
      .filter(p => p.formule && p.codeProduit !== this.edition()?.codeProduit)
      .filter(p => !q || normaliser(p.codeProduit).includes(q) || normaliser(p.designation).includes(q))
      .slice(0, 8);
  });

  // ── Cycle de vie ──────────────────────────────────────────────────────────
  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.chargement.set(true);
    this.svc.getReferentielFormules().subscribe({
      next: l => { this.produits.set(l); this.chargement.set(false); },
      error: e => {
        this.chargement.set(false);
        this.notifier(this.messageErreur(e, 'Impossible de charger les formules.'), 'erreur');
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

  // ── Filtres ───────────────────────────────────────────────────────────────
  reinitialiserFiltres(): void {
    this.recherche.set('');
    this.filtre.set('TOUS');
    this.categorieFiltre.set('');
    this.seulementActifs.set(true);
  }

  // ── Éditeur : ouverture, saisie, copie ────────────────────────────────────
  ouvrir(p: ReferentielProductionBE): void {
    this.edition.set(p);
    this.rechercheCopie.set('');
    this.baseKg.set(p.formule?.baseKg ?? 50);
    this.lignes.set(p.formule
      ? p.formule.lignes.map(l => ({ matierePremiere: l.matierePremiere, proportionKg: l.proportionKg }))
      : [{ matierePremiere: '', proportionKg: null }]);
  }

  fermer(): void {
    if (this.enregistrement()) return;
    this.edition.set(null);
  }

  copier(source: ReferentielProductionBE): void {
    if (!source.formule) return;
    this.baseKg.set(source.formule.baseKg);
    this.lignes.set(source.formule.lignes.map(l => ({ matierePremiere: l.matierePremiere, proportionKg: l.proportionKg })));
    this.rechercheCopie.set('');
  }

  majBase(valeur: number | null): void { this.baseKg.set(valeur); }

  majLigne(i: number, champ: keyof LigneEdition, valeur: string | number | null): void {
    this.lignes.update(liste => liste.map((l, idx) => idx === i ? { ...l, [champ]: valeur } as LigneEdition : l));
  }

  ajouterLigne(): void {
    this.lignes.update(liste => [...liste, { matierePremiere: '', proportionKg: null }]);
  }

  retirerLigne(i: number): void {
    this.lignes.update(liste => liste.filter((_, idx) => idx !== i));
  }

  /** Répartit la base à parts égales — point de départ rapide pour une nouvelle formule. */
  repartirEgalement(): void {
    const n = this.lignes().length;
    const base = Number(this.baseKg()) || 0;
    if (!n || base <= 0) return;
    const part = Math.round((base / n) * 1000) / 1000;
    this.lignes.update(liste => liste.map((l, i) => ({
      ...l,
      proportionKg: i === n - 1 ? Math.round((base - part * (n - 1)) * 1000) / 1000 : part,
    })));
  }

  // ── Enregistrement et suppression ─────────────────────────────────────────
  enregistrer(): void {
    const p = this.edition();
    if (!p || !this.formValide() || this.enregistrement()) return;
    this.enregistrement.set(true);
    const req = {
      baseKg: Number(this.baseKg()),
      lignes: this.lignes().map(l => ({ matierePremiere: l.matierePremiere.trim(), proportionKg: Number(l.proportionKg) })) as FormuleLigneBE[],
    };
    this.svc.sauvegarderFormule(p.codeProduit, req).subscribe({
      next: maj => {
        this.produits.update(liste => liste.map(x => x.codeProduit === maj.codeProduit ? maj : x));
        this.enregistrement.set(false);
        this.edition.set(null);
        this.notifier(`Formule de ${maj.codeProduit} enregistrée. Recalculez les plans concernés pour appliquer.`, 'ok');
      },
      error: e => {
        this.enregistrement.set(false);
        this.notifier(this.messageErreur(e, 'Enregistrement impossible.'), 'erreur');
      }
    });
  }

  supprimer(p: ReferentielProductionBE): void {
    if (!p.formule || this.suppressionCode()) return;
    if (!confirm(`Retirer la formule de ${p.codeProduit} ? Ses plans afficheront « sans formule » après recalcul.`)) return;
    this.suppressionCode.set(p.codeProduit);
    this.svc.supprimerFormule(p.codeProduit).subscribe({
      next: () => {
        this.produits.update(liste => liste.map(x => x.codeProduit === p.codeProduit ? { ...x, formule: null } : x));
        this.suppressionCode.set(null);
        if (this.edition()?.codeProduit === p.codeProduit) this.edition.set(null);
        this.notifier(`Formule de ${p.codeProduit} retirée.`, 'ok');
      },
      error: e => {
        this.suppressionCode.set(null);
        this.notifier(this.messageErreur(e, 'Suppression impossible.'), 'erreur');
      }
    });
  }

  // ── Affichage ─────────────────────────────────────────────────────────────
  notifier(texte: string, type: 'ok' | 'erreur'): void {
    this.notification.set({ texte, type });
    setTimeout(() => {
      if (this.notification()?.texte === texte) this.notification.set(null);
    }, type === 'ok' ? 5000 : 9000);
  }

  /** Raison précise renvoyée par le backend, sinon le message de repli. */
  messageErreur(e: { error?: { erreur?: string; message?: string } } | null, repli: string): string {
    return e?.error?.erreur || e?.error?.message || repli;
  }

  largeurSegment(pct: number): string {
    return `${Math.max(0, pct).toFixed(2)}%`;
  }

  couleurLigne(i: number): string {
    return PALETTE[i % PALETTE.length];
  }

  trackProduit = (_: number, p: ReferentielProductionBE) => p.codeProduit;
}
