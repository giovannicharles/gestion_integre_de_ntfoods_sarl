import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  ProductionService, SessionDosageBE, PPHBE, StatistiquesFutsBE
} from '../../../../infrastructure/production.service';
import { MiniChartComponent, ChartSeries } from '../../../shared/charts/mini-chart.component';
import { DonutChartComponent, DonutSlice } from '../../../shared/charts/donut-chart.component';

/**
 * DASHBOARD — Agent Doseur
 *
 * Affiche les KPIs de production et les graphiques à partir des sessions de dosage
 * (GET /dosage/date/{date}, /dosage/periode) autorisées pour AGENT_DOSEUR.
 */
@Component({
  selector: 'app-ad-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, RouterLink, MiniChartComponent, DonutChartComponent],
  templateUrl: './ad-dashboard.component.html',
  styleUrls: ['./ad-dashboard.component.css', '../_shared.css']
})
export class AdDashboardComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  today = new Date().toISOString().split('T')[0];
  loading = signal(true);
  error = signal('');

  sessionsJour = signal<SessionDosageBE[]>([]);
  historique30j = signal<SessionDosageBE[]>([]);
  pphs = signal<PPHBE[]>([]);
  statsHebdo = signal<StatistiquesFutsBE | null>(null);
  statsMois = signal<StatistiquesFutsBE | null>(null);

  // ── KPI ──
  pphEnCours = computed(() => this.pphs().filter(p => p.statut === 'EN_COURS').length);
  sessionsOuvertes = computed(() => this.historique30j().filter(s => !s.cloturee).length);
  sessionsCloturees = computed(() => this.historique30j().filter(s => s.cloturee).length);
  futsJour = computed(() => this.sessionsJour().reduce((s, x) => s + x.nbFutsNets, 0));
  futsSemaine = computed(() => this.statsHebdo()?.nbFutsNets ?? 0);
  futsMois = computed(() => this.statsMois()?.nbFutsNets ?? 0);
  maisUtilise = computed(() => this.matiereJour('MAIS'));
  sojaUtilise = computed(() => this.matiereJour('SOJA'));
  arachideUtilise = computed(() => this.matiereJour('ARACHIDE'));
  private matiereJour(type: string): number {
    return this.sessionsJour().flatMap(s => s.matieresUtilisees).filter(m => m.typeMatiere === type).reduce((s, m) => s + m.quantiteKg, 0);
  }
  totalMatieresConsommees = computed(() => this.maisUtilise() + this.sojaUtilise() + this.arachideUtilise());
  nbMachinesUtilisees = computed(() => new Set(this.sessionsJour().flatMap(s => s.machinesMobilisees)).size);

  /** Classification Bouillie/Arachide dérivée du ratio réel soja/arachide de chaque session (formules du document). */
  private typeMelange(s: SessionDosageBE): 'BOUILLIE' | 'ARACHIDE' | 'INDETERMINE' {
    const soja = s.matieresUtilisees.find(m => m.typeMatiere === 'SOJA')?.quantiteKg ?? 0;
    const arachide = s.matieresUtilisees.find(m => m.typeMatiere === 'ARACHIDE')?.quantiteKg ?? 0;
    if (soja === 0 && arachide === 0) return 'INDETERMINE';
    return soja > arachide ? 'BOUILLIE' : 'ARACHIDE';
  }
  nbMelangesBouillie = computed(() => this.sessionsJour().filter(s => this.typeMelange(s) === 'BOUILLIE').length);
  nbMelangesArachide = computed(() => this.sessionsJour().filter(s => this.typeMelange(s) === 'ARACHIDE').length);

  pphEnCoursDetail = signal<PPHBE | null>(null);
  quantiteRestante = computed(() => {
    const p = this.pphEnCoursDetail();
    if (!p) return 0;
    return p.lignes.reduce((s, l) => s + Math.max(0, l.objectifSemaine - l.productionRealisee), 0);
  });
  tauxAvancementPph = computed(() => {
    const p = this.pphEnCoursDetail();
    if (!p || p.lignes.length === 0) return 0;
    const obj = p.lignes.reduce((s, l) => s + l.objectifSemaine, 0);
    const rea = p.lignes.reduce((s, l) => s + l.productionRealisee, 0);
    return obj > 0 ? Math.round((rea / obj) * 1000) / 10 : 0;
  });

  // ── Graphiques ──
  private joursGlissants(n: number): string[] {
    const jours: string[] = [];
    for (let i = n - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); jours.push(d.toISOString().split('T')[0]); }
    return jours;
  }
  labels7j = computed(() => this.joursGlissants(7).map(j => j.slice(5).split('-').reverse().join('/')));

  serieEvolutionFuts = computed<ChartSeries[]>(() => {
    const jours = this.joursGlissants(7); const h = this.historique30j();
    return [{ name: 'Fûts nets', color: 'var(--success, #2e7d32)', values: jours.map(j => h.filter(s => s.date === j).reduce((s, x) => s + x.nbFutsNets, 0)) }];
  });

  donutMatieres = computed<DonutSlice[]>(() => {
    const couleurs: Record<string, string> = { MAIS: '#f9a825', SOJA: '#558b2f', ARACHIDE: '#6d4c41' };
    const h = this.historique30j();
    const parType = new Map<string, number>();
    for (const s of h) for (const m of s.matieresUtilisees) parType.set(m.typeMatiere, (parType.get(m.typeMatiere) ?? 0) + m.quantiteKg);
    return Array.from(parType.entries()).map(([label, value]) => ({ label, value: Math.round(value * 10) / 10, color: couleurs[label] ?? '#999' }));
  });

  serieMelangeTypes = computed<ChartSeries[]>(() => {
    const jours = this.joursGlissants(7); const h = this.historique30j();
    return [
      { name: 'Bouillie', color: '#1976d2', values: jours.map(j => h.filter(s => s.date === j && this.typeMelange(s) === 'BOUILLIE').length) },
      { name: 'Mélange Arachide', color: '#7b1fa2', values: jours.map(j => h.filter(s => s.date === j && this.typeMelange(s) === 'ARACHIDE').length) },
    ];
  });

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.error.set('');
    const debut30j = this.joursGlissants(30)[0];
    const debutSemaine = this.debutSemaine();
    const debutMois = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    forkJoin({
      sessionsJour: this.svc.getSessionsDosageParDate(this.today),
      historique30j: this.svc.getSessionsDosageParPeriode(debut30j, this.today),
      pphs: this.svc.getPPHs(),
      statsHebdo: this.svc.getStatistiquesFuts(debutSemaine, this.today),
      statsMois: this.svc.getStatistiquesFuts(debutMois, this.today),
    }).subscribe({
      next: ({ sessionsJour, historique30j, pphs, statsHebdo, statsMois }) => {
        this.sessionsJour.set(sessionsJour);
        this.historique30j.set(historique30j);
        this.pphs.set(pphs);
        this.statsHebdo.set(statsHebdo);
        this.statsMois.set(statsMois);
        const enCours = pphs.find(p => p.statut === 'EN_COURS');
        this.pphEnCoursDetail.set(enCours ?? null);
        this.loading.set(false);
      },
      error: () => { this.error.set('Erreur lors du chargement du tableau de bord.'); this.loading.set(false); }
    });
  }

  private debutSemaine(): string {
    const d = new Date(); const jour = d.getDay();
    return new Date(d.setDate(d.getDate() - jour + (jour === 0 ? -6 : 1))).toISOString().split('T')[0];
  }
}
