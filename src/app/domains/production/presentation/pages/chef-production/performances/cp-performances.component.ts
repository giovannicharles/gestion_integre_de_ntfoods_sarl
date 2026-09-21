import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ProductionService, ClassementMachinisteBE, ClassementExecuteurBE } from '../../../../infrastructure/production.service';
import { MiniChartComponent, ChartSeries } from '../../../shared/charts/mini-chart.component';

/**
 * ANALYSE DES PERFORMANCES — Chef de Production
 * Performance des machinistes (broyage) et des exécutants de postes
 * (Responsable Salle), rendement global et taux d'atteinte des objectifs.
 */
@Component({
  selector: 'app-cp-performances',
  standalone: true,
  imports: [CommonModule, DecimalPipe, MiniChartComponent],
  templateUrl: './cp-performances.component.html',
  styleUrls: ['./cp-performances.component.css', '../_shared.css']
})
export class CpPerformancesComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  classementMachinistes = signal<ClassementMachinisteBE | null>(null);
  classementExecuteurs = signal<ClassementExecuteurBE[]>([]);

  serieMachinistes: () => ChartSeries[] = () => [{
    name: 'Productivité (kg)', color: 'var(--success, #2e7d32)',
    values: (this.classementMachinistes()?.classements ?? []).map(c => c.productiviteKg),
  }];
  labelsMachinistes: () => string[] = () => (this.classementMachinistes()?.classements ?? []).map(c => c.nomMachiniste);

  serieExecuteurs: () => ChartSeries[] = () => [{
    name: 'Taux réalisation (%)', color: 'var(--primary, #1976d2)',
    values: this.classementExecuteurs().map(c => c.tauxRealisationMoyen),
  }];
  labelsExecuteurs: () => string[] = () => this.classementExecuteurs().map(c => c.nomEmploye);

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading.set(true);
    const fin = new Date().toISOString().split('T')[0];
    const debut = this.debutSemaine();
    this.svc.getClassementMachinistes(debut, fin).subscribe({ next: c => this.classementMachinistes.set(c) });
    this.svc.getClassementExecuteurs(debut, fin).subscribe({ next: c => { this.classementExecuteurs.set(c); this.loading.set(false); } });
  }

  private debutSemaine(): string {
    const d = new Date(); const j = d.getDay();
    return new Date(d.setDate(d.getDate() - j + (j === 0 ? -6 : 1))).toISOString().split('T')[0];
  }

  efficaciteMoyenneMachinistes(): number {
    const c = this.classementMachinistes()?.classements ?? [];
    return c.length ? Math.round((c.reduce((s, x) => s + x.efficacite, 0) / c.length) * 10) / 10 : 0;
  }
  tauxMoyenExecuteurs(): number {
    const c = this.classementExecuteurs();
    return c.length ? Math.round((c.reduce((s, x) => s + x.tauxRealisationMoyen, 0) / c.length) * 10) / 10 : 0;
  }
}
