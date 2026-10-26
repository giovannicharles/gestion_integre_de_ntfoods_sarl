import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import {
  ProductionService, LotBE, OFBE, PPHBE, DashboardChefBE,
  RapportHebdomadaireProductionBE, ClassementExecuteurBE, ClassementMachinisteBE
} from '../../../infrastructure/production.service';
import { MiniChartComponent, ChartSeries } from '../../shared/charts/mini-chart.component';
import { DonutChartComponent, DonutSlice } from '../../shared/charts/donut-chart.component';

/** Date au format yyyy-mm-dd en heure locale (évite le décalage de toISOString le soir). */
function formaterDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Lundi de la semaine de la date donnée, en heure locale. */
function lundiDe(d: Date): Date {
  const copie = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const jour = copie.getDay();
  copie.setDate(copie.getDate() - (jour === 0 ? 6 : jour - 1));
  return copie;
}

interface LotRecent {
  id: string;
  codeProduit: string;
  designationProduit: string;
  declaredQuantityKg: number;
  dateProduction: string;
  statut: string;
}

/**
 * TABLEAU DE BORD PRODUCTION — Chef de Production.
 * Chaque valeur vient d'un endpoint réel ou d'un calcul sur des données réelles.
 * Les périodes sont des semaines calendaires en heure locale.
 */
@Component({
  selector: 'app-production-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, RouterLink, FormsModule, MiniChartComponent, DonutChartComponent],
  templateUrl: './production-dashboard.component.html',
  styleUrls: ['./production-dashboard.component.css']
})
export class ProductionDashboardComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly aujourdhui = formaterDate(new Date());
  loading = signal(true);
  erreur = signal('');
  erreurStats = signal('');
  derniereMaj = signal<Date | null>(null);

  lots = signal<LotRecent[]>([]);
  ordres = signal<OFBE[]>([]);
  pphs = signal<PPHBE[]>([]);
  dashboard = signal<DashboardChefBE | null>(null);
  pphEnCours = signal<PPHBE | null>(null);

  // ── Indicateurs ──
  /** Lots déclarés non validés par le stock, tous jours confondus (même source que la liste des lots). */
  nbLotsDeclares = computed(() => this.lots().filter(l => l.statut === 'DECLARE').length);
  nbLotsValides = computed(() => this.lots().filter(l => l.statut === 'VALIDATED_BY_STOCK').length);
  nbLotsRejetes = computed(() => this.lots().filter(l => l.statut === 'REJETE').length);

  ofEnCours = computed(() => this.dashboard()?.ofsEnCours ?? this.ordres().filter(o => o.statut === 'EN_COURS').length);
  ofPlanifies = computed(() => this.dashboard()?.ofsPlanifies ?? this.ordres().filter(o => o.statut === 'PLANIFIE').length);
  ofHonores = computed(() => this.dashboard()?.ofsHonores ?? this.ordres().filter(o => o.statut === 'HONORE').length);

  /** Taux de charge : production réalisée sur production demandée, tous OF non annulés. */
  tauxCharge = computed(() => {
    const ofs = this.ordres().filter(o => o.statut !== 'ANNULE');
    const dem = ofs.reduce((s, o) => s + o.qteDemandee, 0);
    const rea = ofs.reduce((s, o) => s + o.qteRealisee, 0);
    return dem ? Math.min(100, Math.round((rea / dem) * 100)) : 0;
  });

  tauxAvancementPPH = computed(() => this.dashboard()?.tauxAvancementPPH ?? 0);
  fichesSemaine = computed(() => this.dashboard()?.fichesSemaine ?? 0);
  pphEnCoursReference = computed(() => this.dashboard()?.pphEnCoursReference ?? null);
  semaineAffichee = computed(() => this.dashboard()?.pphEnCoursSemaine ?? null);
  periodeSemaine = computed(() => {
    const d = this.dashboard();
    return d ? { debut: d.debutSemaine, fin: d.finSemaine } : null;
  });

  /** Lots récents : les 5 plus récents par date de production. */
  lotsRecents = computed(() => [...this.lots()].sort((a, b) => b.dateProduction.localeCompare(a.dateProduction)).slice(0, 5));

  // ── Statistiques : 4 semaines calendaires, 4 appels réels ──
  tendance4Semaines = signal<{ label: string; rapport: RapportHebdomadaireProductionBE }[]>([]);
  classementExecuteurs = signal<ClassementExecuteurBE[]>([]);
  classementMachinistes = signal<ClassementMachinisteBE | null>(null);
  chargementStats = signal(true);

  rapportSemaineCourante = computed(() => {
    const t = this.tendance4Semaines();
    return t.length ? t[t.length - 1].rapport : null;
  });
  rapportSemainePrecedente = computed(() => {
    const t = this.tendance4Semaines();
    return t.length >= 2 ? t[t.length - 2].rapport : null;
  });

  comparaisonSemaineNvsN1 = computed(() => {
    const cur = this.rapportSemaineCourante();
    const prev = this.rapportSemainePrecedente();
    if (!cur || !prev) return null;
    const variation = prev.totalQuantiteLots > 0
      ? Math.round(((cur.totalQuantiteLots - prev.totalQuantiteLots) / prev.totalQuantiteLots) * 1000) / 10
      : null;
    return { actuelle: cur.totalQuantiteLots, precedente: prev.totalQuantiteLots, variation };
  });

  labelsEvolution = computed(() => this.tendance4Semaines().map(t => t.label));
  serieEvolutionProductionKg = computed<ChartSeries[]>(() => [{
    name: 'Production validée (kg)', color: '#14532D',
    values: this.tendance4Semaines().map(t => t.rapport.totalQuantiteLots),
  }]);
  serieEvolutionPertes = computed<ChartSeries[]>(() => [{
    name: 'Taux de pertes (%)', color: '#C62828',
    values: this.tendance4Semaines().map(t => Math.round(t.rapport.tauxPertesGlobal * 10) / 10),
  }]);
  serieFuts = computed<ChartSeries[]>(() => [
    { name: 'Fûts sortis', color: '#1565C0', values: this.tendance4Semaines().map(t => t.rapport.totalFutsProduits) },
    { name: 'Fûts nets', color: '#2A9D5F', values: this.tendance4Semaines().map(t => t.rapport.totalFutsNets) },
  ]);

  /** Répartition des références produites (semaine courante) : quantités en unités, issues des fiches. */
  donutProduits = computed<DonutSlice[]>(() => {
    const r = this.rapportSemaineCourante();
    if (!r) return [];
    const palette = ['#14532D', '#F6B60B', '#2A9D5F', '#1565C0', '#8E24AA', '#C62828', '#6B7280'];
    return Object.entries(r.quantitesParReference)
      .filter(([, q]) => q > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({ label, value, color: palette[i % palette.length] }));
  });

  donutPertes = computed<DonutSlice[]>(() => {
    const r = this.rapportSemaineCourante();
    if (!r) return [];
    const couleurs: Record<string, string> = { MAIS: '#f9a825', SOJA: '#558b2f', ARACHIDE: '#6d4c41' };
    return Object.entries(r.pertesParTypePoudre)
      .filter(([, kg]) => kg > 0)
      .map(([label, value]) => ({ label, value: Math.round(value * 10) / 10, color: couleurs[label] ?? '#999' }));
  });

  labelsAvancementBC = computed(() => Object.keys(this.rapportSemaineCourante()?.tauxAvancementParBC ?? {}));
  serieAvancementBC = computed<ChartSeries[]>(() => [{
    name: 'Avancement (%)', color: '#14532D',
    values: Object.values(this.rapportSemaineCourante()?.tauxAvancementParBC ?? {}),
  }]);

  showCreerOF = signal(false);
  showProduireOF = signal<string | null>(null);
  ofDetail = signal<OFBE | null>(null);
  nouveauOF = { idOF: '', referencePPH: '', codeProduit: '', designationProduit: '', qteDemandee: 0, dateButoir: '' };
  quantiteProduire = 0;

  ngOnInit(): void {
    this.chargerDonnees();
  }

  chargerDonnees(): void {
    this.loading.set(true);
    this.erreur.set('');
    forkJoin({
      lots: this.svc.getLots(),
      ofs: this.svc.getOFs(),
      dashboard: this.svc.getDashboardChef(),
      pphs: this.svc.getPPHs(),
    }).subscribe({
      next: ({ lots, ofs, dashboard, pphs }) => {
        this.lots.set(lots.map((l: LotBE) => ({
          id: l.numeroLot,
          codeProduit: l.productSku,
          designationProduit: l.productName,
          declaredQuantityKg: l.declaredQuantityKg,
          dateProduction: l.dateProduction,
          statut: l.statut,
        })));
        this.ordres.set(ofs);
        this.dashboard.set(dashboard);
        this.pphs.set(pphs);
        this.loading.set(false);
        this.derniereMaj.set(new Date());
      },
      error: e => {
        this.loading.set(false);
        this.erreur.set(e?.error?.erreur || e?.error?.message || 'Le tableau de bord n\'a pas pu être chargé.');
      },
    });
    this.svc.getPPHEnCours().subscribe({
      next: p => this.pphEnCours.set(p),
      error: () => this.pphEnCours.set(null), // 404 quand aucun PPH n'est en cours
    });
    this.chargerStatistiques();
  }

  /** Quatre semaines calendaires réelles, plus la semaine courante pour les classements. */
  private chargerStatistiques(): void {
    this.chargementStats.set(true);
    this.erreurStats.set('');
    const semaines = this.dernieresSemaines(4);
    const courante = semaines[semaines.length - 1];
    forkJoin({
      rapports: forkJoin(semaines.map(s => this.svc.getRapportHebdomadaireProduction(s.debut, s.fin))),
      executeurs: this.svc.getClassementExecuteurs(courante.debut, courante.fin),
      machinistes: this.svc.getClassementMachinistes(courante.debut, courante.fin),
    }).subscribe({
      next: r => {
        this.tendance4Semaines.set(r.rapports.map((rapport, i) => ({ label: semaines[i].label, rapport })));
        this.classementExecuteurs.set(r.executeurs.slice(0, 5));
        this.classementMachinistes.set(r.machinistes);
        this.chargementStats.set(false);
      },
      error: e => {
        this.chargementStats.set(false);
        this.erreurStats.set(e?.error?.erreur || e?.error?.message || 'Les statistiques n\'ont pas pu être chargées.');
      },
    });
  }

  /** Les n dernières semaines lundi→dimanche, la plus ancienne en premier, en heure locale. */
  private dernieresSemaines(n: number): { debut: string; fin: string; label: string }[] {
    const result: { debut: string; fin: string; label: string }[] = [];
    const maintenant = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const lundi = lundiDe(new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() - i * 7));
      const dimanche = new Date(lundi);
      dimanche.setDate(lundi.getDate() + 6);
      result.push({
        debut: formaterDate(lundi),
        fin: formaterDate(dimanche),
        label: i === 0 ? 'Cette semaine' : `S-${i}`,
      });
    }
    return result;
  }

  // ── Ordres de fabrication ──
  creerOF(): void {
    if (!this.nouveauOF.idOF || !this.nouveauOF.referencePPH || !this.nouveauOF.codeProduit || this.nouveauOF.qteDemandee <= 0) return;
    const req = { ...this.nouveauOF, dateButoir: this.nouveauOF.dateButoir || undefined };
    this.svc.creerOF(req).subscribe({
      next: o => {
        this.ordres.update(list => [o, ...list]);
        this.showCreerOF.set(false);
        this.nouveauOF = { idOF: '', referencePPH: '', codeProduit: '', designationProduit: '', qteDemandee: 0, dateButoir: '' };
      },
      error: e => this.erreur.set(e?.error?.erreur || e?.error?.message || 'Création de l\'OF impossible.'),
    });
  }

  demarrerOF(idOF: string): void {
    this.svc.demarrerOF(idOF).subscribe({
      next: o => this.mettreAJourOF(o),
      error: e => this.erreur.set(e?.error?.erreur || e?.error?.message || 'Démarrage impossible.'),
    });
  }

  annulerOF(idOF: string): void {
    if (!confirm('Annuler cet ordre de fabrication ?')) return;
    this.svc.annulerOF(idOF).subscribe({
      next: o => this.mettreAJourOF(o),
      error: e => this.erreur.set(e?.error?.erreur || e?.error?.message || 'Annulation impossible.'),
    });
  }

  ouvrirProduire(idOF: string): void {
    this.showProduireOF.set(idOF);
    this.quantiteProduire = 0;
  }

  produireOF(idOF: string): void {
    if (this.quantiteProduire <= 0) return;
    this.svc.produireOF(idOF, this.quantiteProduire).subscribe({
      next: o => { this.mettreAJourOF(o); this.showProduireOF.set(null); },
      error: e => this.erreur.set(e?.error?.erreur || e?.error?.message || 'Enregistrement de la production impossible.'),
    });
  }

  private mettreAJourOF(o: OFBE): void {
    this.ordres.update(list => list.map(x => x.idOF === o.idOF ? o : x));
  }

  voirDetailOF(idOF: string): void {
    this.svc.getOF(idOF).subscribe({
      next: o => this.ofDetail.set(o),
      error: () => this.ofDetail.set(null),
    });
  }

  // ── Affichage ──
  progression(realise: number, prevu: number): number {
    if (prevu <= 0) return 0;
    return Math.min(Math.round((realise / prevu) * 100), 100);
  }

  teinte(pct: number): 'bas' | 'moyen' | 'ok' {
    if (pct >= 100) return 'ok';
    if (pct >= 60) return 'moyen';
    return 'bas';
  }

  libelleStatutLot(s: string): string {
    return ({ DECLARE: 'En attente', RECEPTIONNE_STOCK: 'Réceptionné', VALIDATED_BY_STOCK: 'Validé stock', REJETE: 'Rejeté' } as Record<string, string>)[s] ?? s;
  }

  classeStatutLot(s: string): string {
    return ({ DECLARE: 'db-statut-attente', RECEPTIONNE_STOCK: 'db-statut-info', VALIDATED_BY_STOCK: 'db-statut-ok', REJETE: 'db-statut-erreur' } as Record<string, string>)[s] ?? '';
  }

  libelleStatutOF(s: string): string {
    return ({ PLANIFIE: 'Planifié', EN_COURS: 'En cours', HONORE: 'Honoré', ANNULE: 'Annulé' } as Record<string, string>)[s] ?? s;
  }

  classeStatutOF(s: string): string {
    return ({ PLANIFIE: 'db-statut-neutre', EN_COURS: 'db-statut-attente', HONORE: 'db-statut-ok', ANNULE: 'db-statut-erreur' } as Record<string, string>)[s] ?? '';
  }
}
