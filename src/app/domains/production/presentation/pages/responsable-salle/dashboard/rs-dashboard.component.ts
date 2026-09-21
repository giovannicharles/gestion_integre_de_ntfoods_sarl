import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  ProductionService, PPHBE, AffectationBE, FicheProductionBE,
  RapportHebdoAffectationBE, DashboardAgentBE
} from '../../../../infrastructure/production.service';
import { MiniChartComponent, ChartSeries } from '../../../shared/charts/mini-chart.component';

/**
 * DASHBOARD — Responsable de Salle
 * Centre de pilotage quotidien de l'atelier.
 */
@Component({
  selector: 'app-rs-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, RouterLink, MiniChartComponent],
  templateUrl: './rs-dashboard.component.html',
  styleUrls: ['./rs-dashboard.component.css', '../_shared.css']
})
export class RsDashboardComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  today = new Date().toISOString().split('T')[0];
  loading = signal(true);

  pphs = signal<PPHBE[]>([]);
  pphEnCours = signal<PPHBE | null>(null);
  affectationJour = signal<AffectationBE | null>(null);
  ficheJour = signal<FicheProductionBE | null>(null);
  rapportHebdo = signal<RapportHebdoAffectationBE | null>(null);
  dashboardAgent = signal<DashboardAgentBE | null>(null);

  // ── KPI ──
  bcEnCours = computed(() => new Set(this.pphs().filter(p => p.statut === 'EN_COURS').map(p => p.referenceBC).filter(Boolean)).size);
  pphActifs = computed(() => this.pphs().filter(p => p.statut === 'EN_COURS').length);
  employesAffectesJour = computed(() => new Set((this.affectationJour()?.lignes ?? []).flatMap(l => l.matriculesEmployes)).size);
  postesActifs = computed(() => this.affectationJour()?.lignes.length ?? 0);
  postesObjectifAtteint = computed(() => (this.affectationJour()?.saisies ?? []).filter(s => s.pctRealisation >= 100).length);
  quantiteProduiteJour = computed(() => (this.affectationJour()?.saisies ?? []).reduce((s, x) => s + x.quantiteRealisee, 0));
  tauxGlobalObjectifs = computed(() => {
    const saisies = this.affectationJour()?.saisies ?? [];
    if (!saisies.length) return 0;
    return Math.round((saisies.reduce((s, x) => s + x.pctRealisation, 0) / saisies.length) * 10) / 10;
  });
  ecartsDetectes = computed(() => (this.affectationJour()?.saisies ?? []).reduce((s, x) => s + x.warnings.length, 0));
  fichesGenerees = computed(() => this.ficheJour() ? 1 : 0);

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading.set(true);
    this.svc.getPPHs().subscribe({
      next: pphs => {
        this.pphs.set(pphs);
        const enCours = pphs.find(p => p.statut === 'EN_COURS') ?? null;
        this.pphEnCours.set(enCours);
        if (enCours) {
          this.svc.getAffectationDuJour(enCours.referencePPH).subscribe({ next: a => this.affectationJour.set(a), error: () => this.affectationJour.set(null) });
          this.svc.getFiche(enCours.referencePPH, this.today).subscribe({ next: f => this.ficheJour.set(f), error: () => this.ficheJour.set(null) });
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
    this.svc.getDashboardAgent().subscribe({ next: d => this.dashboardAgent.set(d) });
    this.svc.getRapportHebdomadaireAffectation(this.debutSemaine(), this.today).subscribe({ next: r => this.rapportHebdo.set(r) });
  }

  private debutSemaine(): string {
    const d = new Date(); const j = d.getDay();
    return new Date(d.setDate(d.getDate() - j + (j === 0 ? -6 : 1))).toISOString().split('T')[0];
  }

  labelsJours = computed(() => (this.rapportHebdo()?.comparaisonsJournalieres ?? []).map(c => c.date.slice(5).split('-').reverse().join('/')));
  serieFutsVsProduction = computed<ChartSeries[]>(() => {
    const jours = this.rapportHebdo()?.comparaisonsJournalieres ?? [];
    return [
      { name: 'Fûts nets', color: 'var(--info, #0284c7)', values: jours.map(j => j.nbFutsNets) },
      { name: 'Production (kg)', color: 'var(--success, #2e7d32)', values: jours.map(j => j.productionReelleKg) },
    ];
  });

  serieClassementPostes = computed<ChartSeries[]>(() => [{
    name: 'Taux réalisation (%)', color: 'var(--primary, #1976d2)',
    values: (this.affectationJour()?.classement ?? []).map(c => c.pctRealisation),
  }]);
  labelsClassementPostes = computed(() => (this.affectationJour()?.classement ?? []).map(c => c.libellePoste));
}
