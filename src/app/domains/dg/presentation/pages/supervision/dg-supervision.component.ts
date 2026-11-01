import { Component, signal, inject, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import {
  DgService, DashboardFinancierDgBE, DashboardProductionDgBE, DashboardStockDgBE, AnomalieBE, IncidentResumeBE,
  MoisSoldeCaisseBE, ControleGestionResumeBE,
} from '../../../infrastructure/dg.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { fCFA } from '../../../../../shared/utils/format.utils';

Chart.register(...registerables);

const LIBELLE_CATEGORIE: Record<string, string> = {
  ALERTE_ROUGE_VERSEMENT: 'Écart de versement',
  STOCK_MOBILE_ANORMAL: 'Stock mobile anormal',
  ECART_RECEPTION: 'Écart de réception',
  ACTIVITE_SUSPECTE: 'Activité suspecte (audit)',
};

/**
 * Vue consolidée du DG : 3 dashboards agrégés (financier, production, stock)
 * et la détection transversale d'anomalies. Les 4 endpoints existaient côté
 * backend sans aucun écran — cette page ne fait qu'afficher ce qu'ils
 * renvoient, sans rien recalculer ni compléter côté client.
 */
@Component({
  selector: 'app-dg-supervision',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dg-supervision.component.html',
  styleUrls: ['./dg-supervision.component.css'],
})
export class DgSupervisionComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('tresorerieCanvas') tresorerieCanvas?: ElementRef<HTMLCanvasElement>;
  private chart: Chart | null = null;
  private readonly dgSvc = inject(DgService);

  fCFA = fCFA;
  libelleCategorie = (c: string) => LIBELLE_CATEGORIE[c] ?? c;

  /** Résumé par module (2026-11-01, bloc 7 DG_MODULE_SPEC.md), trié par effectif décroissant. */
  incidentsParModule(inc: IncidentResumeBE): { module: string; count: number }[] {
    return Object.entries(inc.actifsParModule ?? {})
      .map(([module, count]) => ({ module, count }))
      .sort((a, b) => b.count - a.count);
  }

  loading = signal(true);
  loadError = signal<string | null>(null);

  financier = signal<DashboardFinancierDgBE | null>(null);
  production = signal<DashboardProductionDgBE | null>(null);
  stock = signal<DashboardStockDgBE | null>(null);
  anomalies = signal<AnomalieBE[]>([]);
  /** 2026-11-01 (demande explicite du porteur) : compteurs seuls — la gestion des incidents
   * (assigner/résoudre/clôturer, détail) reste réservée à ADMIN, décision actée du 2026-10-25. */
  incidentsResume = signal<IncidentResumeBE | null>(null);
  /** 2026-11-01 — solde de caisse en fin de mois, pas la "trésorerie" composite de /dg/kpis
   * (voir HistoriqueTresorerieService backend pour pourquoi cette distinction est délibérée). */
  historiqueTresorerie = signal<MoisSoldeCaisseBE[]>([]);
  /** 2026-11-01 — pont vers le module Contrôle (bloc 4 DG_MODULE_SPEC.md, ❌ ABSENT jusqu'ici). */
  controleGestion = signal<ControleGestionResumeBE | null>(null);

  ngOnInit(): void {
    this.charger();
  }

  ngAfterViewInit(): void { setTimeout(() => this.buildChart(), 300); }

  charger(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      financier: this.dgSvc.getDashboardFinancier(),
      production: this.dgSvc.getDashboardProduction(),
      stock: this.dgSvc.getDashboardStock(),
      anomalies: this.dgSvc.getAnomalies(),
      incidentsResume: this.dgSvc.getIncidentsResume(),
      historiqueTresorerie: this.dgSvc.getHistoriqueTresorerie(12),
      controleGestion: this.dgSvc.getControleGestion(),
    }).subscribe({
      next: ({ financier, production, stock, anomalies, incidentsResume, historiqueTresorerie, controleGestion }) => {
        this.financier.set(financier);
        this.production.set(production);
        this.stock.set(stock);
        this.anomalies.set(anomalies);
        this.incidentsResume.set(incidentsResume);
        this.historiqueTresorerie.set(historiqueTresorerie);
        this.controleGestion.set(controleGestion);
        this.loading.set(false);
        setTimeout(() => this.buildChart(), 100);
      },
      error: e => { this.loadError.set(extractApiError(e)); this.loading.set(false); },
    });
  }

  private buildChart(): void {
    this.chart?.destroy();
    const data = this.historiqueTresorerie();
    if (!this.tresorerieCanvas?.nativeElement || data.length === 0) return;
    this.chart = new Chart(this.tresorerieCanvas.nativeElement.getContext('2d')!, {
      type: 'line',
      data: {
        labels: data.map(m => m.libelleCourt),
        datasets: [{
          label: 'Solde de caisse (fin de mois)',
          data: data.map(m => m.soldeFCFA),
          borderColor: '#1A6B2A', backgroundColor: 'rgba(26,107,42,0.1)',
          fill: true, tension: 0.3, spanGaps: true,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { ticks: { callback: (v: any) => (v / 1000000).toFixed(1) + 'M' } } },
      },
    });
  }

  ngOnDestroy(): void { this.chart?.destroy(); }
}
