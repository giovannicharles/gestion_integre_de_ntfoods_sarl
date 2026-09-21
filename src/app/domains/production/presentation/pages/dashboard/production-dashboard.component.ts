import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import {
  ProductionService, LotBE, OFBE, PPHBE, DashboardChefBE,
  RapportHebdomadaireProductionBE, ClassementExecuteurBE, ClassementMachinisteBE
} from '../../../infrastructure/production.service';
import { MiniChartComponent, ChartSeries } from '../../shared/charts/mini-chart.component';
import { DonutChartComponent, DonutSlice } from '../../shared/charts/donut-chart.component';

interface LotDashUI {
  id: string; codeProduit: string; designationProduit: string;
  declaredQuantityKg: number; statut: string;
}

interface PlanUI {
  semaine: string; dateDebut: string; dateFin: string;
  chefProduction: string; statut: string;
}

@Component({
  selector: 'app-production-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, FormsModule, MiniChartComponent, DonutChartComponent],
  templateUrl: './production-dashboard.component.html',
  styleUrls: ['./production-dashboard.component.css']
})
export class ProductionDashboardComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  today = new Date();
  loading = signal(true);

  lots = signal<LotDashUI[]>([]);
  ordres = signal<OFBE[]>([]);
  pphs = signal<PPHBE[]>([]);

  plan = signal<PlanUI>({
    semaine: '—', dateDebut: '—', dateFin: '—',
    chefProduction: '—', statut: '—',
  });

  dashboard = signal<DashboardChefBE | null>(null);
  pphEnCours = signal<PPHBE | null>(null);

  // ── Section statistiques (Section 2 du document — DG/Chef Production) ──
  /** 4 dernières semaines (S-3 à S courante), chacune un vrai appel à /rapports/hebdomadaire. */
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

  /** Évolution hebdomadaire de la production (kg) — 4 dernières semaines. */
  serieEvolutionProductionKg = computed<ChartSeries[]>(() => [{
    name: 'Production (kg)', color: 'var(--primary, #1976d2)',
    values: this.tendance4Semaines().map(t => t.rapport.totalQuantiteLots),
  }]);
  labelsEvolution = computed(() => this.tendance4Semaines().map(t => t.label));

  /** Évolution hebdomadaire des pertes (%). */
  serieEvolutionPertes = computed<ChartSeries[]>(() => [{
    name: 'Pertes (%)', color: 'var(--danger, #d32f2f)',
    values: this.tendance4Semaines().map(t => Math.round(t.rapport.tauxPertesGlobal * 10) / 10),
  }]);

  /** Comparaison fûts produits / cassés / nets sur les 4 dernières semaines. */
  serieFuts = computed<ChartSeries[]>(() => [
    { name: 'Fûts produits', color: 'var(--info, #0284c7)', values: this.tendance4Semaines().map(t => t.rapport.totalFutsProduits) },
    { name: 'Fûts nets', color: 'var(--success, #2e7d32)', values: this.tendance4Semaines().map(t => t.rapport.totalFutsNets) },
  ]);

  /** Répartition des produits fabriqués (semaine courante). */
  donutProduits = computed<DonutSlice[]>(() => {
    const r = this.rapportSemaineCourante();
    if (!r) return [];
    const palette = ['#1976d2', '#2e7d32', '#f57c00', '#7b1fa2', '#c2185b', '#00838f'];
    return Object.entries(r.quantitesParReference).map(([label, value], i) => ({
      label, value, color: palette[i % palette.length]
    }));
  });

  /** Pertes par type de poudre (semaine courante). */
  donutPertes = computed<DonutSlice[]>(() => {
    const r = this.rapportSemaineCourante();
    if (!r) return [];
    const couleurs: Record<string, string> = { MAIS: '#f9a825', SOJA: '#558b2f', ARACHIDE: '#6d4c41' };
    return Object.entries(r.pertesParTypePoudre).map(([label, value]) => ({
      label, value, color: couleurs[label] ?? '#999'
    }));
  });

  /** Taux d'avancement par BC (semaine courante). */
  serieAvancementBC = computed<ChartSeries[]>(() => {
    const r = this.rapportSemaineCourante();
    if (!r) return [{ name: 'Avancement (%)', color: 'var(--primary, #1976d2)', values: [] }];
    return [{ name: 'Avancement (%)', color: 'var(--primary, #1976d2)', values: Object.values(r.tauxAvancementParBC) }];
  });
  labelsAvancementBC = computed(() => {
    const r = this.rapportSemaineCourante();
    return r ? Object.keys(r.tauxAvancementParBC) : [];
  });

  /** Comparaison Semaine N vs Semaine N-1 (production kg). */
  comparaisonSemaineNvsN1 = computed(() => {
    const cur = this.rapportSemaineCourante();
    const prev = this.rapportSemainePrecedente();
    if (!cur || !prev) return null;
    const variation = prev.totalQuantiteLots > 0
      ? Math.round(((cur.totalQuantiteLots - prev.totalQuantiteLots) / prev.totalQuantiteLots) * 1000) / 10
      : 0;
    return { actuelle: cur.totalQuantiteLots, precedente: prev.totalQuantiteLots, variation };
  });

  nbLotsDeclares = computed(() => this.lots().filter(l => l.statut === 'DECLARE').length);
  nbLotsValides = computed(() => this.lots().filter(l => l.statut === 'VALIDATED_BY_STOCK').length);

  ofEnCours = computed(() => this.dashboard()?.ofsEnCours ?? this.ordres().filter(o => o.statut === 'EN_COURS').length);
  ofPlanifies = computed(() => this.dashboard()?.ofsPlanifies ?? this.ordres().filter(o => o.statut === 'PLANIFIE').length);
  ofHonores = computed(() => this.dashboard()?.ofsHonores ?? this.ordres().filter(o => o.statut === 'HONORE').length);
  tauxCharge = computed(() => {
    const ofs = this.ordres();
    const dem = ofs.reduce((s, o) => s + o.qteDemandee, 0);
    const rea = ofs.reduce((s, o) => s + o.qteRealisee, 0);
    return dem ? Math.round((rea / dem) * 100) : 0;
  });
  lotsEnAttente = computed(() => this.dashboard()?.lotsEnAttenteValidation ?? 0);
  tauxAvancementPPH = computed(() => this.dashboard()?.tauxAvancementPPH ?? 0);
  pphEnCoursReference = computed(() => this.dashboard()?.pphEnCoursReference ?? null);
  fichesSemaine = computed(() => this.dashboard()?.fichesSemaine ?? 0);

  showCreerOF = signal(false);
  showProduireOF = signal<string | null>(null);
  ofDetail = signal<OFBE | null>(null);
  nouveauOF = {
    idOF: '', referencePPH: '', codeProduit: '', designationProduit: '', qteDemandee: 0, dateButoir: ''
  };
  quantiteProduire = 0;

  ngOnInit(): void {
    this.chargerDonnees();
  }

  private chargerDonnees(): void {
    this.loading.set(true);
    forkJoin({
      lots: this.svc.getLots(),
      ofs: this.svc.getOFs(),
      dashboard: this.svc.getDashboardChef(),
      pphs: this.svc.getPPHs(),
    }).subscribe({
      next: ({ lots, ofs, dashboard, pphs }) => {
        this.lots.set(lots.map(l => ({
          id: l.numeroLot,
          codeProduit: l.codeProduit,
          designationProduit: l.designationProduit,
          declaredQuantityKg: l.quantiteKg,
          statut: l.statut,
        })));
        this.ordres.set(ofs);
        this.dashboard.set(dashboard);
        this.pphs.set(pphs);
        this.plan.update(p => ({
          ...p,
          semaine: dashboard.pphEnCoursSemaine ?? p.semaine,
          chefProduction: dashboard.pphEnCoursReference ?? p.chefProduction,
          dateDebut: dashboard.debutSemaine ?? p.dateDebut,
          dateFin: dashboard.finSemaine ?? p.dateFin,
        }));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.svc.getPPHEnCours().subscribe({
      next: p => this.pphEnCours.set(p),
      error: () => this.pphEnCours.set(null),
    });
    this.chargerStatistiques();
  }

  /**
   * Construit la tendance des 4 dernières semaines en appelant réellement
   * GET /production/rapports/hebdomadaire pour chaque fenêtre lundi→dimanche.
   * Aucune donnée inventée : 4 vrais appels API sur 4 périodes réelles.
   */
  private chargerStatistiques(): void {
    this.chargementStats.set(true);
    const semaines = this.dernieresSemaines(4);
    forkJoin(semaines.map(s => this.svc.getRapportHebdomadaireProduction(s.debut, s.fin))).subscribe({
      next: rapports => {
        this.tendance4Semaines.set(rapports.map((rapport, i) => ({ label: semaines[i].label, rapport })));
        this.chargementStats.set(false);
      },
      error: () => this.chargementStats.set(false),
    });

    const { debut, fin } = this.dernieresSemaines(1)[0];
    this.svc.getClassementExecuteurs(debut, fin).subscribe({
      next: c => this.classementExecuteurs.set(c.slice(0, 5)),
      error: () => this.classementExecuteurs.set([]),
    });
    this.svc.getClassementMachinistes(debut, fin).subscribe({
      next: c => this.classementMachinistes.set(c),
      error: () => this.classementMachinistes.set(null),
    });
  }

  /** Renvoie les N dernières semaines calendaires (lundi→dimanche), la plus ancienne en premier. */
  private dernieresSemaines(n: number): { debut: string; fin: string; label: string }[] {
    const result: { debut: string; fin: string; label: string }[] = [];
    const aujourdHui = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const ref = new Date(aujourdHui);
      ref.setDate(ref.getDate() - i * 7);
      const jour = ref.getDay();
      const diffLundi = ref.getDate() - jour + (jour === 0 ? -6 : 1);
      const lundi = new Date(ref);
      lundi.setDate(diffLundi);
      const dimanche = new Date(lundi);
      dimanche.setDate(lundi.getDate() + 6);
      result.push({
        debut: lundi.toISOString().split('T')[0],
        fin: dimanche.toISOString().split('T')[0],
        label: i === 0 ? 'Cette semaine' : `S-${i}`,
      });
    }
    return result;
  }

  creerOF(): void {
    if (!this.nouveauOF.idOF || !this.nouveauOF.referencePPH || !this.nouveauOF.codeProduit || this.nouveauOF.qteDemandee <= 0) return;
    const req = { ...this.nouveauOF, dateButoir: this.nouveauOF.dateButoir || undefined };
    this.svc.creerOF(req).subscribe({
      next: o => {
        this.ordres.update(list => [o, ...list]);
        this.showCreerOF.set(false);
        this.nouveauOF = { idOF: '', referencePPH: '', codeProduit: '', designationProduit: '', qteDemandee: 0, dateButoir: '' };
      }
    });
  }

  demarrerOF(idOF: string): void {
    this.svc.demarrerOF(idOF).subscribe({
      next: o => this.mettreAJourOF(o)
    });
  }

  annulerOF(idOF: string): void {
    if (!confirm('Annuler cet ordre de fabrication ?')) return;
    this.svc.annulerOF(idOF).subscribe({
      next: o => this.mettreAJourOF(o)
    });
  }

  ouvrirProduire(idOF: string): void {
    this.showProduireOF.set(idOF);
    this.quantiteProduire = 0;
  }

  produireOF(idOF: string): void {
    if (this.quantiteProduire <= 0) return;
    this.svc.produireOF(idOF, this.quantiteProduire).subscribe({
      next: o => { this.mettreAJourOF(o); this.showProduireOF.set(null); }
    });
  }

  private mettreAJourOF(o: OFBE): void {
    this.ordres.update(list => list.map(x => x.idOF === o.idOF ? o : x));
  }

  /** Consultation détaillée d'un OF (rafraîchit depuis le serveur, indépendamment de la liste locale). */
  voirDetailOF(idOF: string): void {
    this.svc.getOF(idOF).subscribe({
      next: o => this.ofDetail.set(o),
      error: () => this.ofDetail.set(null)
    });
  }

  getProduitDesignation(code: string): string {
    return this.lots().find(l => l.codeProduit === code)?.designationProduit ?? code;
  }

  progression(realise: number, prevu: number): number {
    if (prevu === 0) return 0;
    return Math.min(Math.round((realise / prevu) * 100), 100);
  }

  progressClass(pct: number): string {
    if (pct >= 100) return 'prog-bar prog-g';
    if (pct >= 60) return 'prog-bar prog-y';
    return 'prog-bar prog-r';
  }
}
