import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import { DgService, KpisDgBE, ClassementCommercialBE, TauxOccupationSecteurBE, AnomalieBE, ZonePerformanceBE, ValidationEnAttenteBE, DashboardStockDgBE, DashboardFinancierDgBE, DashboardProductionDgBE } from '../../../infrastructure/dg.service';
import { fCFA } from '../../../../../shared/utils/format.utils';
import { AlertBadgeService } from '../../../../../core/services/alert-badge.service';

Chart.register(...registerables);

@Component({
  selector: 'app-dg-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './dg-dashboard.component.html',
  styleUrls: ['./dg-dashboard.component.css']
})
export class DgDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('caZoneCanvas') caZoneCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('caMensuelCanvas') caMensuelCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('stockDoughnutCanvas') stockDoughnutCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('objectifGaugeCanvas') objectifGaugeCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('comRadarCanvas') comRadarCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('financeBarCanvas') financeBarCanvas!: ElementRef<HTMLCanvasElement>;
  private charts: Chart[] = [];
  private readonly dgSvc = inject(DgService);
  private readonly alertBadge = inject(AlertBadgeService);
  private refreshInterval: any = null;

  today = new Date();
  loading = signal(true);
  selectedPeriod = signal<'today' | 'week' | 'month'>('today');
  lastRefresh = signal<Date | null>(null);

  // === DATA SIGNALS ===
  kpis = signal<KpisDgBE | null>(null);
  commerciaux = signal<ClassementCommercialBE[]>([]);
  occupation = signal<TauxOccupationSecteurBE[]>([]);
  anomalies = signal<AnomalieBE[]>([]);
  zones = signal<ZonePerformanceBE[]>([]);
  validations = signal<ValidationEnAttenteBE[]>([]);
  dashStock = signal<DashboardStockDgBE | null>(null);
  dashFinancier = signal<DashboardFinancierDgBE | null>(null);
  dashProduction = signal<DashboardProductionDgBE | null>(null);

  // Alert badge from shared service
  alertCount = this.alertBadge.totalCount;
  criticalCount = this.alertBadge.criticalCount;

  caMensuel = signal<{ mois: string; n: number; nMoins1: number }[]>([]);
  caZones = computed(() => this.zones().map(z => ({ zone: z.secteur, ca: z.caMoisCourantFCFA, objectif: 0 })));
  Math = Math;

  // === COMMERCIAL COMPUTED ===
  caTotal = computed(() => this.kpis()?.caTotal ?? 0);
  tauxRecouvrement = computed(() => {
    const k = this.kpis();
    if (!k || k.caTotal === 0) return 0;
    return Math.round((k.tresorerie / k.caTotal) * 100);
  });
  versementsEnAttente = computed(() => this.kpis()?.ventesCount ?? 0);
  alertesRouges = computed(() => this.anomalies().length);
  margeGlobale = computed(() => this.kpis()?.margeGlobale ?? 0);
  occupationMoyenne = computed(() => {
    const list = this.occupation();
    if (list.length === 0) return 0;
    return Math.round(list.reduce((s, o) => s + o.tauxOccupationPourcent, 0) / list.length);
  });
  anomaliesElevees = computed(() => this.anomalies().length);
  tauxRealisationObj = computed(() => {
    const k = this.kpis();
    if (!k || k.objectifCible === 0) return 0;
    return Math.round((k.objectifRealise / k.objectifCible) * 100);
  });
  nbCommerciauxActifs = computed(() => this.kpis()?.commerciauxActifs ?? 0);
  nbVentesMois = computed(() => this.kpis()?.ventesCount ?? 0);

  // === STOCK COMPUTED ===
  valoStock = computed(() => {
    const k = this.kpis();
    if (!k) return 0;
    return (k.stockMatieresPremieres + k.stockConsommables + k.stockProduitsFinis);
  });
  stockMP = computed(() => this.kpis()?.stockMatieresPremieres ?? 0);
  stockConso = computed(() => this.kpis()?.stockConsommables ?? 0);
  stockPF = computed(() => this.kpis()?.stockProduitsFinis ?? 0);
  nbAlertesStock = computed(() => this.dashStock()?.nbAlertesActives ?? 0);
  nbProduitsSousSeuil = computed(() => this.dashStock()?.nbProduitsSousSeuil ?? 0);
  totalQuantiteStock = computed(() => {
    const s = this.dashStock();
    if (!s) return 0;
    return s.totalQuantiteCentral + s.totalQuantiteTampon + s.totalQuantiteMobile;
  });

  // === FINANCIER COMPUTED ===
  soldeCaisse = computed(() => this.dashFinancier()?.soldeCaisse ?? 0);
  totalFacturesEmises = computed(() => this.dashFinancier()?.totalFacturesEmises ?? 0);
  totalFacturesPayees = computed(() => this.dashFinancier()?.totalFacturesPayees ?? 0);
  totalDecaissements = computed(() => this.dashFinancier()?.totalDecaissementsExecutes ?? 0);
  totalVersements = computed(() => this.dashFinancier()?.totalVersements ?? 0);
  totalPrimes = computed(() => this.dashFinancier()?.totalPrimes ?? 0);
  totalRecouvrements = computed(() => this.dashFinancier()?.totalRecouvrements ?? 0);
  tauxFacturation = computed(() => {
    const emit = this.totalFacturesEmises();
    if (emit === 0) return 0;
    return Math.round((this.totalFacturesPayees() / emit) * 100);
  });

  // === PRODUCTION COMPUTED ===
  totalPPH = computed(() => this.dashProduction()?.totalPPH ?? 0);
  totalOF = computed(() => this.dashProduction()?.totalOF ?? 0);
  totalLots = computed(() => this.dashProduction()?.totalLots ?? 0);
  totalQteProduite = computed(() => this.dashProduction()?.totalQuantiteProduite ?? 0);
  rentabiliteProduction = computed(() => this.kpis()?.rentabiliteProductionPct ?? 0);

  // === VALIDATIONS COMPUTED ===
  nbValidationsEnAttente = computed(() => this.validations().length);
  validationsParType = computed(() => {
    const list = this.validations();
    const map = new Map<string, number>();
    list.forEach(v => map.set(v.type, (map.get(v.type) || 0) + 1));
    return Array.from(map.entries()).map(([type, count]) => ({ type, count }));
  });

  fCFA = fCFA;

  tauxOccupation(o: TauxOccupationSecteurBE): number {
    return o.tauxOccupationPourcent;
  }

  getCommercialNom(id: string): string {
    return this.commerciaux().find(c => c.matricule === id)?.nomComplet ?? id;
  }

  tauxRealisationCom(com: ClassementCommercialBE): number {
    const cible = this.kpis()?.objectifCible ?? 0;
    if (cible === 0) return 0;
    return Math.round((com.caRealise / cible) * 100);
  }

  // === DATA LOADING ===
  ngOnInit() {
    this.loadAll();
    this.refreshInterval = setInterval(() => this.loadAll(), 60000);
  }

  loadAll() {
    this.dgSvc.getKpis().subscribe({ next: k => this.kpis.set(k), error: () => {} });
    this.dgSvc.getClassement().subscribe({ next: c => this.commerciaux.set(c), error: () => {} });
    this.dgSvc.getTauxOccupationMarches().subscribe({ next: o => this.occupation.set(o), error: () => {} });
    this.dgSvc.getAnomalies().subscribe({ next: a => this.anomalies.set(a), error: () => {} });
    this.dgSvc.getZones().subscribe({ next: z => this.zones.set(z), error: () => {} });
    this.dgSvc.getValidationsEnAttente().subscribe({ next: v => this.validations.set(v), error: () => {} });
    this.dgSvc.getDashboardStock().subscribe({ next: s => this.dashStock.set(s), error: () => {} });
    this.dgSvc.getDashboardFinancier().subscribe({ next: f => this.dashFinancier.set(f), error: () => {} });
    this.dgSvc.getDashboardProduction().subscribe({ next: p => this.dashProduction.set(p), error: () => {} });
    this.lastRefresh.set(new Date());
    setTimeout(() => { this.loading.set(false); this.rebuildCharts(); }, 600);
  }

  ngAfterViewInit() {
    setTimeout(() => this.buildCharts(), 700);
  }

  setPeriod(p: 'today' | 'week' | 'month') { this.selectedPeriod.set(p); }

  refreshNow() {
    this.loading.set(true);
    this.alertBadge.refresh();
    this.loadAll();
  }

  // === CHARTS ===
  private rebuildCharts() {
    this.charts.forEach(c => c.destroy());
    this.charts = [];
    this.buildCharts();
  }

  private buildCharts() {
    this.buildCaZoneChart();
    this.buildCaMensuelChart();
    this.buildStockDoughnut();
    this.buildObjectifGauge();
    this.buildComRadar();
    this.buildFinanceBar();
  }

  private buildCaZoneChart() {
    const zones = this.caZones();
    if (this.caZoneCanvas?.nativeElement && zones.length > 0) {
      const ctx = this.caZoneCanvas.nativeElement.getContext('2d')!;
      this.charts.push(new Chart(ctx, {
        type: 'bar',
        data: {
          labels: zones.map(z => z.zone),
          datasets: [
            { label: 'CA Réalisé', data: zones.map(z => z.ca), backgroundColor: '#1A6B2A', borderRadius: 6 },
            { label: 'Objectif', data: zones.map(z => z.objectif), backgroundColor: '#FFD70066', borderColor: '#FFD700', borderWidth: 2, borderRadius: 6 },
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { ticks: { callback: (v: any) => (v / 1000000).toFixed(1) + 'M' } } } }
      }));
    }
  }

  private buildCaMensuelChart() {
    const caMensuel = this.caMensuel();
    if (this.caMensuelCanvas?.nativeElement && caMensuel.length > 0) {
      const ctx2 = this.caMensuelCanvas.nativeElement.getContext('2d')!;
      this.charts.push(new Chart(ctx2, {
        type: 'line',
        data: {
          labels: caMensuel.map(m => m.mois),
          datasets: [
            { label: 'CA N (2026)', data: caMensuel.map(m => m.n), borderColor: '#1A6B2A', backgroundColor: '#1A6B2A22', tension: 0.4, fill: true, pointBackgroundColor: '#1A6B2A' },
            { label: 'CA N-1 (2025)', data: caMensuel.map(m => m.nMoins1), borderColor: '#FFD700', backgroundColor: '#FFD70011', tension: 0.4, fill: false, borderDash: [6, 3], pointBackgroundColor: '#FFD700' },
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { ticks: { callback: (v: any) => (v / 1000000).toFixed(1) + 'M' } } } }
      }));
    }
  }

  private buildStockDoughnut() {
    if (this.stockDoughnutCanvas?.nativeElement) {
      const ctx = this.stockDoughnutCanvas.nativeElement.getContext('2d')!;
      this.charts.push(new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Matières Premières', 'Consommables', 'Produits Finis'],
          datasets: [{
            data: [this.stockMP(), this.stockConso(), this.stockPF()],
            backgroundColor: ['#1A6B2A', '#FFD700', '#2196F3'],
            borderWidth: 0,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { padding: 14, font: { size: 11 } } } },
          cutout: '65%'
        }
      }));
    }
  }

  private buildObjectifGauge() {
    if (this.objectifGaugeCanvas?.nativeElement) {
      const ctx = this.objectifGaugeCanvas.nativeElement.getContext('2d')!;
      const pct = Math.min(this.tauxRealisationObj(), 100);
      this.charts.push(new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Réalisé', 'Restant'],
          datasets: [{
            data: [pct, Math.max(100 - pct, 0)],
            backgroundColor: [pct >= 80 ? '#1A6B2A' : pct >= 50 ? '#FFD700' : '#dc2626', '#e5e7eb'],
            borderWidth: 0,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          cutout: '72%'
        }
      }));
    }
  }

  private buildComRadar() {
    const commerciaux = this.commerciaux().slice(0, 8);
    if (this.comRadarCanvas?.nativeElement && commerciaux.length > 0) {
      const ctx = this.comRadarCanvas.nativeElement.getContext('2d')!;
      this.charts.push(new Chart(ctx, {
        type: 'radar',
        data: {
          labels: commerciaux.map(c => c.nomComplet.split(' ')[1] || c.nomComplet),
          datasets: [{
            label: 'CA Réalisé (FCFA)',
            data: commerciaux.map(c => c.caRealise),
            backgroundColor: '#1A6B2A22',
            borderColor: '#1A6B2A',
            pointBackgroundColor: '#1A6B2A',
            borderWidth: 2,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { r: { beginAtZero: true, ticks: { display: false }, grid: { color: '#e5e7eb' }, angleLines: { color: '#e5e7eb' } } }
        }
      }));
    }
  }

  private buildFinanceBar() {
    if (this.financeBarCanvas?.nativeElement) {
      const ctx = this.financeBarCanvas.nativeElement.getContext('2d')!;
      this.charts.push(new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Factures Émises', 'Factures Payées', 'Versements', 'Décaissements', 'Primes', 'Recouvrements'],
          datasets: [{
            label: 'Montant (FCFA)',
            data: [this.totalFacturesEmises(), this.totalFacturesPayees(), this.totalVersements(), this.totalDecaissements(), this.totalPrimes(), this.totalRecouvrements()],
            backgroundColor: ['#1A6B2A', '#22c55e', '#2196F3', '#f59e0b', '#ec4899', '#8b5cf6'],
            borderRadius: 6,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { ticks: { callback: (v: any) => (v / 1000000).toFixed(1) + 'M' } } }
        }
      }));
    }
  }

  ngOnDestroy() {
    this.charts.forEach(c => c.destroy());
    if (this.refreshInterval) clearInterval(this.refreshInterval);
  }
}
