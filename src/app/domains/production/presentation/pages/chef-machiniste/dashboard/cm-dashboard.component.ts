import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  ProductionService, SessionBroyageBE, EmployeBE, ClassementMachinisteBE, PPHBE
} from '../../../../infrastructure/production.service';
import { MiniChartComponent, ChartSeries } from '../../../shared/charts/mini-chart.component';
import { DonutChartComponent, DonutSlice } from '../../../shared/charts/donut-chart.component';

/**
 * DASHBOARD — Chef Machiniste
 * Vue unique : cartes KPI + graphiques. Aucune action de saisie ici
 * (voir les composants Objectifs / Réalisations / Indicateurs pour cela).
 *
 * Note données backend :
 *  - `quantiteNetteBroyeeKg` / `pertesKg` ne sont renseignés qu'À LA CLÔTURE de la
 *    session (cf. ProductionService.cloturerSessionBroyage). En cours de journée ils
 *    valent `null`. Pour que les KPI du jour ne restent pas à 0, on retombe sur
 *    `totalRealiseKg` (réalisé cumulé, disponible en temps réel).
 */
@Component({
  selector: 'app-cm-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, RouterLink, MiniChartComponent, DonutChartComponent],
  templateUrl: './cm-dashboard.component.html',
  styleUrls: ['./cm-dashboard.component.css', '../_shared.css']
})
export class CmDashboardComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  today = new Date().toISOString().split('T')[0];
  loading = signal(true);
  error = signal('');

  machinistes = signal<EmployeBE[]>([]);
  sessionsJour = signal<SessionBroyageBE[]>([]);
  historique30j = signal<SessionBroyageBE[]>([]);
  classementHebdo = signal<ClassementMachinisteBE | null>(null);
  pphs = signal<PPHBE[]>([]);

  /**
   * Quantité broyée d'une session, exploitable en temps réel :
   * nette broyée si la session est clôturée, sinon réalisé cumulé.
   */
  private qteSession(s: SessionBroyageBE): number {
    return s.quantiteNetteBroyeeKg ?? s.totalRealiseKg ?? 0;
  }

  // ── KPI (Section "Cartes KPI" du document) ──
  // Total progressif du jour : net si clôturé, sinon réalisé cumulé (temps réel).
  poudreTotaleJour = computed(() => this.sessionsJour().reduce((acc, x) => acc + this.qteSession(x), 0));
  // Net réellement confirmé : uniquement les sessions clôturées (quantiteNetteBroyeeKg renseigné).
  netteBroyeeJour = computed(() =>
    this.sessionsJour().reduce((acc, x) => acc + (x.quantiteNetteBroyeeKg ?? 0), 0));
  maisJour = computed(() => this.parType('MAIS'));
  sojaJour = computed(() => this.parType('SOJA'));
  arachideJour = computed(() => this.parType('ARACHIDE'));
  private parType(type: string): number {
    return this.sessionsJour().filter(s => s.typePoudre === type).reduce((acc, x) => acc + this.qteSession(x), 0);
  }

  machinistesActifs = computed(() => {
    const matricules = new Set<string>();
    for (const s of this.sessionsJour()) {
      s.objectifsMachinistes.forEach(o => matricules.add(o.machinisteMatricule));
      s.realisations.forEach(r => matricules.add(r.machinisteMatricule));
    }
    return matricules.size;
  });

  objectifsJour = computed(() => this.sessionsJour().reduce((acc, x) => acc + x.objectifJournalierKg, 0));
  objectifsAtteints = computed(() => this.sessionsJour().filter(s => s.journeeValidee).length);
  tauxRealisationGlobal = computed(() => {
    const obj = this.objectifsJour();
    return obj > 0 ? Math.round((this.poudreTotaleJour() / obj) * 1000) / 10 : 0;
  });

  pertesJour = computed(() => this.sessionsJour().reduce((acc, x) => acc + (x.pertesKg ?? 0), 0));
  pctPertesJour = computed(() => {
    const total = this.poudreTotaleJour() + this.pertesJour();
    return total > 0 ? Math.round((this.pertesJour() / total) * 1000) / 10 : 0;
  });

  nbPphRecus = computed(() => this.pphs().filter(p => p.statut !== 'BROUILLON').length);

  // Une session est "terminée" dès que sa quantité nette est mesurée (donc clôturée),
  // indépendamment du fait qu'elle ait été validée ou non.
  productionsTerminees = computed(() => this.sessionsJour().filter(s => s.quantiteNetteBroyeeKg !== null).length);

  productiviteMoyenne = computed(() => {
    const c = this.classementHebdo()?.classements ?? [];
    if (!c.length) return 0;
    return Math.round((c.reduce((acc, x) => acc + x.productiviteKg, 0) / c.length) * 10) / 10;
  });

  // ── Graphiques ──
  private joursGlissants(n: number): string[] {
    const jours: string[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      jours.push(d.toISOString().split('T')[0]);
    }
    return jours;
  }

  labels7j = computed(() => this.joursGlissants(7).map(j => j.slice(5).split('-').reverse().join('/')));

  serieEvolutionJournaliere = computed<ChartSeries[]>(() => {
    const jours = this.joursGlissants(7);
    const h = this.historique30j();
    return [{
      name: 'Poudre broyée (kg)', color: 'var(--primary, #1976d2)',
      values: jours.map(j => h.filter(s => s.date === j).reduce((acc, x) => acc + this.qteSession(x), 0)),
    }];
  });

  serieEvolutionPertes = computed<ChartSeries[]>(() => {
    const jours = this.joursGlissants(7);
    const h = this.historique30j();
    return [{
      name: 'Pertes (kg)', color: 'var(--danger, #d32f2f)',
      values: jours.map(j => h.filter(s => s.date === j).reduce((acc, x) => acc + (x.pertesKg ?? 0), 0)),
    }];
  });

  serieObjectifsVsRealise = computed<ChartSeries[]>(() => {
    const jours = this.joursGlissants(7);
    const h = this.historique30j();
    return [
      { name: 'Objectif (kg)', color: 'var(--info, #0284c7)', values: jours.map(j => h.filter(s => s.date === j).reduce((acc, x) => acc + x.objectifJournalierKg, 0)) },
      { name: 'Réalisé (kg)', color: 'var(--success, #2e7d32)', values: jours.map(j => h.filter(s => s.date === j).reduce((acc, x) => acc + this.qteSession(x), 0)) },
    ];
  });

  donutRepartitionTypes = computed<DonutSlice[]>(() => {
    const couleurs: Record<string, string> = { MAIS: '#f9a825', SOJA: '#558b2f', ARACHIDE: '#6d4c41' };
    const h = this.historique30j();
    // Agrégation par CODE de poudre pour garantir la bonne couleur ; libellé conservé pour l'affichage.
    const agg = new Map<string, { libelle: string; value: number }>();
    for (const s of h) {
      const cur = agg.get(s.typePoudre) ?? { libelle: s.typePoudreLibelle, value: 0 };
      cur.value += this.qteSession(s);
      agg.set(s.typePoudre, cur);
    }
    return Array.from(agg.entries())
      .filter(([, v]) => v.value > 0)
      .map(([code, v]) => ({
        label: v.libelle,
        value: Math.round(v.value * 10) / 10,
        color: couleurs[code] ?? '#90a4ae',
      }));
  });

  serieProductiviteHebdo = computed<ChartSeries[]>(() => {
    const c = this.classementHebdo()?.classements ?? [];
    return [{ name: 'Productivité (kg)', color: 'var(--success, #2e7d32)', values: c.map(x => x.productiviteKg) }];
  });
  labelsMachinistesHebdo = computed(() => (this.classementHebdo()?.classements ?? []).map(c => c.nomMachiniste));

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.error.set('');
    const debut30j = this.joursGlissants(30)[0];
    forkJoin({
      machinistes: this.svc.getMachinistes(),
      sessionsJour: this.svc.getSessionsBroyage({ debut: this.today, fin: this.today }),
      historique30j: this.svc.getSessionsBroyage({ debut: debut30j, fin: this.today }),
      classementHebdo: this.svc.getClassementMachinistes(this.debutSemaine(), this.today),
      pphs: this.svc.getPPHs(),
    }).subscribe({
      next: ({ machinistes, sessionsJour, historique30j, classementHebdo, pphs }) => {
        this.machinistes.set(machinistes);
        this.sessionsJour.set(sessionsJour);
        this.historique30j.set(historique30j);
        this.classementHebdo.set(classementHebdo);
        this.pphs.set(pphs);
        this.loading.set(false);
      },
      error: () => { this.error.set('Erreur lors du chargement du tableau de bord'); this.loading.set(false); }
    });
  }

  private debutSemaine(): string {
    const d = new Date();
    const jour = d.getDay();
    const diff = d.getDate() - jour + (jour === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  }
}