import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import {
  ProductionService, RapportHebdomadaireProductionBE, RapportComparatifBCBE
} from '../../../infrastructure/production.service';
import { StockService, BonCommandeBE } from '../../../../stock/infrastructure/stock.service';

type Onglet = 'hebdomadaire' | 'comparatif' | 'export';
type Format = 'xlsx' | 'pdf' | 'csv' | 'json';

/** Date au format yyyy-mm-dd en heure locale (évite le décalage de toISOString le soir). */
function formaterDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Lundi de la semaine de la date donnée. */
function lundiDe(d: Date): Date {
  const copie = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const jour = copie.getDay();
  copie.setDate(copie.getDate() - (jour === 0 ? 6 : jour - 1));
  return copie;
}

/**
 * RAPPORTS DE PRODUCTION — hebdomadaire, comparatif BC et export des lots.
 * Chaque rapport se génère à la demande, sur une période que l'utilisateur choisit.
 */
@Component({
  selector: 'app-production-rapports',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './production-rapports.component.html',
  styleUrls: ['./production-rapports.component.css']
})
export class ProductionRapportsComponent implements OnInit {
  private readonly svc = inject(ProductionService);
  private readonly stock = inject(StockService);

  readonly aujourdhui = formaterDate(new Date());
  onglet = signal<Onglet>('hebdomadaire');
  notification = signal<{ type: 'ok' | 'erreur'; texte: string } | null>(null);
  private minuterie: ReturnType<typeof setTimeout> | null = null;

  // ── Période commune ──
  debut = signal(formaterDate(lundiDe(new Date())));
  fin = signal(this.aujourdhui);
  presetActif = signal<'semaine' | 'semaine-passee' | '30j' | 'perso'>('semaine');

  periodeValide = computed(() => !!this.debut() && !!this.fin() && this.debut() <= this.fin() && this.fin() <= this.aujourdhui);
  messagePeriode = computed(() => {
    if (!this.debut() || !this.fin()) return 'Choisissez les deux dates.';
    if (this.debut() > this.fin()) return 'La date de début est après la date de fin.';
    if (this.fin() > this.aujourdhui) return 'La date de fin ne peut pas être dans le futur.';
    return '';
  });

  readonly presets: { code: 'semaine' | 'semaine-passee' | '30j'; libelle: string }[] = [
    { code: 'semaine', libelle: 'Cette semaine' },
    { code: 'semaine-passee', libelle: 'Semaine passée' },
    { code: '30j', libelle: '30 derniers jours' },
  ];

  choisirPreset(code: 'semaine' | 'semaine-passee' | '30j'): void {
    const aujourdhui = new Date();
    const lundi = lundiDe(aujourdhui);
    if (code === 'semaine') {
      this.debut.set(formaterDate(lundi));
      this.fin.set(this.aujourdhui);
    } else if (code === 'semaine-passee') {
      const debutPasse = new Date(lundi);
      debutPasse.setDate(debutPasse.getDate() - 7);
      const finPasse = new Date(lundi);
      finPasse.setDate(finPasse.getDate() - 1);
      this.debut.set(formaterDate(debutPasse));
      this.fin.set(formaterDate(finPasse));
    } else {
      const debut30 = new Date(aujourdhui);
      debut30.setDate(debut30.getDate() - 29);
      this.debut.set(formaterDate(debut30));
      this.fin.set(this.aujourdhui);
    }
    this.presetActif.set(code);
  }

  majPeriode(champ: 'debut' | 'fin', valeur: string): void {
    if (!valeur) return;
    if (champ === 'debut') this.debut.set(valeur); else this.fin.set(valeur);
    this.presetActif.set('perso');
  }

  // ── Hebdomadaire ──
  rapport = signal<RapportHebdomadaireProductionBE | null>(null);
  chargementRapport = signal(false);
  erreurRapport = signal('');

  /** Lignes par référence, triées par quantité, avec leur part relative à la plus forte. */
  references = computed(() => {
    const r = this.rapport();
    if (!r) return [];
    const liste = Object.entries(r.quantitesParReference ?? {}).map(([code, q]) => ({ code, quantite: q }))
      .sort((a, b) => b.quantite - a.quantite);
    const max = liste[0]?.quantite ?? 0;
    return liste.map(x => ({ ...x, part: max > 0 ? (x.quantite / max) * 100 : 0 }));
  });

  bcs = computed(() => {
    const r = this.rapport();
    if (!r) return [];
    return Object.entries(r.tauxAvancementParBC ?? {}).map(([numero, taux]) => ({ numero, taux }))
      .sort((a, b) => b.taux - a.taux);
  });

  poudres = computed(() => {
    const r = this.rapport();
    if (!r) return [];
    return Object.keys(r.quantiteBroyeeParTypePoudre ?? {}).map(code => ({
      code,
      broye: r.quantiteBroyeeParTypePoudre[code] ?? 0,
      pertes: r.pertesParTypePoudre?.[code] ?? 0,
      pct: r.pctPertesParTypePoudre?.[code] ?? 0,
    })).sort((a, b) => b.broye - a.broye);
  });

  genererRapport(): void {
    if (!this.periodeValide()) return;
    this.chargementRapport.set(true);
    this.erreurRapport.set('');
    this.svc.getRapportHebdomadaireProduction(this.debut(), this.fin()).subscribe({
      next: r => { this.rapport.set(r); this.chargementRapport.set(false); },
      error: e => {
        this.rapport.set(null);
        this.chargementRapport.set(false);
        this.erreurRapport.set(e?.error?.erreur || e?.error?.message || 'Génération impossible.');
      },
    });
  }

  // ── Comparatif BC ──
  bonsCommande = signal<BonCommandeBE[]>([]);
  referenceBC = signal('');
  comparatif = signal<RapportComparatifBCBE | null>(null);
  chargementComparatif = signal(false);
  erreurComparatif = signal('');

  ngOnInit(): void {
    this.genererRapport();
    this.stock.getBonsCommande().subscribe({ next: l => this.bonsCommande.set(l), error: () => this.bonsCommande.set([]) });
  }

  /** Avancement global du BC : produit sur planifié. */
  tauxComparatif = computed(() => {
    const r = this.comparatif();
    if (!r || r.totalQuantitePlanifiee === 0) return 0;
    return Math.min(100, Math.round((r.totalQuantiteProduite * 100) / r.totalQuantitePlanifiee));
  });

  genererComparatif(): void {
    const ref = this.referenceBC();
    if (!ref) return;
    this.chargementComparatif.set(true);
    this.erreurComparatif.set('');
    this.svc.getRapportComparatifBC(ref).subscribe({
      next: r => { this.comparatif.set(r); this.chargementComparatif.set(false); },
      error: e => {
        this.comparatif.set(null);
        this.chargementComparatif.set(false);
        this.erreurComparatif.set(e?.error?.erreur || e?.error?.message || 'Rapport impossible à générer.');
      },
    });
  }

  choisirBC(ref: string): void {
    this.referenceBC.set(ref);
    this.comparatif.set(null);
    if (ref) this.genererComparatif();
  }

  // ── Export des lots ──
  readonly formats: { code: Format; libelle: string; extension: string }[] = [
    { code: 'xlsx', libelle: 'Excel', extension: 'xlsx' },
    { code: 'pdf', libelle: 'PDF', extension: 'pdf' },
    { code: 'csv', libelle: 'CSV', extension: 'csv' },
    { code: 'json', libelle: 'JSON', extension: 'json' },
  ];
  format = signal<Format>('xlsx');
  telechargement = signal(false);

  telechargerLots(): void {
    if (!this.periodeValide() || this.telechargement()) return;
    this.telechargement.set(true);
    this.svc.getRapportLots(this.debut(), this.fin(), this.format()).subscribe({
      next: blob => {
        this.declencherTelechargement(blob, `rapport-lots-${this.debut()}-${this.fin()}.${this.format()}`);
        this.telechargement.set(false);
        this.notifier('Rapport des lots téléchargé.', 'ok');
      },
      error: () => {
        this.telechargement.set(false);
        this.notifier('Export impossible : vérifiez la période et réessayez.', 'erreur');
      },
    });
  }

  notifier(texte: string, type: 'ok' | 'erreur'): void {
    this.notification.set({ type, texte });
    if (this.minuterie) clearTimeout(this.minuterie);
    this.minuterie = setTimeout(() => this.notification.set(null), 5000);
  }

  private declencherTelechargement(blob: Blob, nom: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nom;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  formaterKg(v: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(v);
  }

  formaterPct(v: number): string {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v)} %`;
  }
}
