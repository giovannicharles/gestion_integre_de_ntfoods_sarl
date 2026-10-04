import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import {
  DgService, DashboardFinancierDgBE, DashboardProductionDgBE, DashboardStockDgBE, AnomalieBE,
} from '../../../infrastructure/dg.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { fCFA } from '../../../../../shared/utils/format.utils';

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
export class DgSupervisionComponent implements OnInit {
  private readonly dgSvc = inject(DgService);

  fCFA = fCFA;
  libelleCategorie = (c: string) => LIBELLE_CATEGORIE[c] ?? c;

  loading = signal(true);
  loadError = signal<string | null>(null);

  financier = signal<DashboardFinancierDgBE | null>(null);
  production = signal<DashboardProductionDgBE | null>(null);
  stock = signal<DashboardStockDgBE | null>(null);
  anomalies = signal<AnomalieBE[]>([]);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      financier: this.dgSvc.getDashboardFinancier(),
      production: this.dgSvc.getDashboardProduction(),
      stock: this.dgSvc.getDashboardStock(),
      anomalies: this.dgSvc.getAnomalies(),
    }).subscribe({
      next: ({ financier, production, stock, anomalies }) => {
        this.financier.set(financier);
        this.production.set(production);
        this.stock.set(stock);
        this.anomalies.set(anomalies);
        this.loading.set(false);
      },
      error: e => { this.loadError.set(extractApiError(e)); this.loading.set(false); },
    });
  }
}
