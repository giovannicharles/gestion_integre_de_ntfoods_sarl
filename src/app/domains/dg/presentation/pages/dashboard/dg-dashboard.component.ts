import { Component, ChangeDetectionStrategy, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { DgService, KpisDgBE, ClassementCommercialBE, TauxOccupationSecteurBE, AnomalieBE, ZonePerformanceBE, VersementDuJourBE, RapportComparatifBE, ValidationEnAttenteBE } from '../../../infrastructure/dg.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { fCFA } from '../../../../../shared/utils/format.utils';

const PERIODE_API: Record<'today' | 'week' | 'month', string> = { today: 'JOUR', week: 'SEMAINE', month: 'MOIS' };
const PERIODE_LABEL: Record<'today' | 'week' | 'month', string> = { today: "aujourd'hui", week: 'cette semaine', month: 'ce mois' };
/** Rafraîchissement automatique des données vivantes (KPI, validations, anomalies) — tableau de bord réactif, pas une photo figée au chargement. */
const INTERVALLE_RAFRAICHISSEMENT_MS = 60_000;

Chart.register(...registerables);

@Component({
  selector: 'app-dg-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './dg-dashboard.component.html',
  styleUrls: ['./dg-dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DgDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('caZoneCanvas') caZoneCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('caMensuelCanvas') caMensuelCanvas!: ElementRef<HTMLCanvasElement>;
  private charts: Chart[] = [];
  private readonly dgSvc = inject(DgService);

  today = new Date();
  loading = signal(true);
  loadError = signal<string | null>(null);
  /** Échec d'un rafraîchissement périodique (pas bloquant — l'affichage précédent reste). */
  liveError = signal<string | null>(null);
  selectedPeriod = signal<'today' | 'week' | 'month'>('today');
  /** Onglets du bas de page : réduit le défilement (12+ cartes empilées avant) sans rien supprimer.
   *  Affichage par CSS (pas @if) pour ne jamais détruire les <canvas> Chart.js en changeant d'onglet. */
  activeTab = signal<'apercu' | 'commercial' | 'marches' | 'arbitrage'>('apercu');
  setTab(t: 'apercu' | 'commercial' | 'marches' | 'arbitrage') { this.activeTab.set(t); }

  kpis = signal<KpisDgBE | null>(null);
  commerciaux = signal<ClassementCommercialBE[]>([]);
  occupation = signal<TauxOccupationSecteurBE[]>([]);
  anomalies = signal<AnomalieBE[]>([]);
  zones = signal<ZonePerformanceBE[]>([]);
  versementsDuJour = signal<VersementDuJourBE[]>([]);
  comparatif = signal<RapportComparatifBE | null>(null);
  /** Vue unifiée (précommandes, dotations, BC, réceptions, versements, carburant) — jusqu'ici invisible depuis ce tableau de bord, il fallait déjà savoir aller sur /dg/arbitrage. */
  validationsEnAttente = signal<ValidationEnAttenteBE[]>([]);
  derniereMiseAJour = signal<Date | null>(null);
  private refreshHandle: ReturnType<typeof setInterval> | null = null;

  caZones = computed(() => this.zones().map(z => ({ zone: z.secteur, ca: z.caMoisCourantFCFA, objectif: 0 })));
  periodeLabel = computed(() => PERIODE_LABEL[this.selectedPeriod()]);
  Math = Math;

  caTotal = computed(() => this.kpis()?.caTotal ?? 0);
  tauxRecouvrement = computed(() => {
    const k = this.kpis();
    if (!k || k.caTotal === 0) return 0;
    return Math.round((k.tresorerie / k.caTotal) * 100);
  });
  versementsEnAttente = computed(() => this.kpis()?.ventesCount ?? 0);
  alertesRouges = computed(() => this.anomalies().length);

  margeGlobale = computed(() => this.kpis()?.margeGlobale ?? 0);
  valoStock = computed(() => {
    const k = this.kpis();
    if (!k) return 0;
    return (k.stockMatieresPremieres + k.stockConsommables + k.stockProduitsFinis);
  });
  occupationMoyenne = computed(() => {
    const list = this.occupation();
    if (list.length === 0) return 0;
    return Math.round(list.reduce((s, o) => s + o.tauxOccupationPourcent, 0) / list.length);
  });
  anomaliesElevees = computed(() => this.anomalies().length);

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

  ngOnInit() {
    this.chargerDonneesStatiques();
    this.chargerComparatif();
    this.chargerDonneesVivantes();
    this.refreshHandle = setInterval(() => this.chargerDonneesVivantes(), INTERVALLE_RAFRAICHISSEMENT_MS);
  }

  /** Chargé une fois (référentiel du jour) : classement, occupation, zones, versements. */
  chargerDonneesStatiques() {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      classement: this.dgSvc.getClassement(),
      occupation: this.dgSvc.getTauxOccupationMarches(),
      zones: this.dgSvc.getZones(),
      versements: this.dgSvc.getVersementsDuJour(),
    }).subscribe({
      next: ({ classement, occupation, zones, versements }) => {
        this.commerciaux.set(classement);
        this.occupation.set(occupation);
        this.zones.set(zones);
        this.versementsDuJour.set(versements);
        this.loading.set(false);
      },
      error: e => {
        this.loadError.set(extractApiError(e));
        this.loading.set(false);
      },
    });
  }

  /** Rechargé périodiquement : les chiffres qui changent en continu pendant la journée. */
  private chargerDonneesVivantes() {
    forkJoin({
      kpis: this.dgSvc.getKpis(),
      anomalies: this.dgSvc.getAnomalies(),
      validations: this.dgSvc.getValidationsEnAttente(),
    }).subscribe({
      next: ({ kpis, anomalies, validations }) => {
        this.kpis.set(kpis);
        this.anomalies.set(anomalies);
        this.validationsEnAttente.set(validations);
        this.liveError.set(null);
        this.derniereMiseAJour.set(new Date());
      },
      error: e => this.liveError.set(extractApiError(e)),
    });
  }

  private chargerComparatif() {
    this.dgSvc.getComparatif(PERIODE_API[this.selectedPeriod()]).subscribe({
      next: c => { this.comparatif.set(c); this.rebuildComparatifChart(); },
      error: () => this.comparatif.set(null),
    });
  }

  ngAfterViewInit() {
    setTimeout(() => this.buildCharts(), 700);
  }

  setPeriod(p: 'today' | 'week' | 'month') {
    this.selectedPeriod.set(p);
    this.chargerComparatif();
  }

  rafraichirMaintenant() {
    this.chargerDonneesVivantes();
  }

  /** Couleurs lues depuis les tokens CSS (var(--g)/var(--color-accent)) — cohérent avec le thème clair/sombre, jamais de hex en dur dans les graphiques. */
  private tokenColor(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#999';
  }

  private buildCharts() {
    const g = this.tokenColor('--color-primary');
    const accent = this.tokenColor('--color-accent');
    const zones = this.caZones();
    if (this.caZoneCanvas?.nativeElement && zones.length > 0) {
      const ctx = this.caZoneCanvas.nativeElement.getContext('2d')!;
      this.charts.push(new Chart(ctx, {
        type: 'bar',
        data: {
          labels: zones.map(z => z.zone),
          datasets: [
            { label: 'CA Réalisé', data: zones.map(z => z.ca), backgroundColor: g, borderRadius: 6 },
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { ticks: { callback: (v: any) => (v / 1000000).toFixed(1) + 'M' } } } }
      }));
    }
    this.rebuildComparatifChart();
  }

  /**
   * Comparaison N vs N-1 sur la période choisie (JOUR/SEMAINE/MOIS) — remplace un graphique
   * "Évolution CA mensuelle" qui affichait un tableau vide depuis le début : rien n'alimentait
   * jamais `caMensuel`, et l'API DG n'expose de toute façon qu'une comparaison à deux tranches
   * (actuelle vs précédente), pas une série de 12 mois (vérifié sur RapportComparatifResponse,
   * backend). Se reconstruit à chaque changement de période (le sélecteur Aujourd'hui/Semaine/
   * Mois ne faisait jusqu'ici rien d'autre que changer l'étiquette d'un bouton).
   */
  private rebuildComparatifChart() {
    const comp = this.comparatif();
    if (!this.caMensuelCanvas?.nativeElement || !comp) return;
    const existing = this.charts.find(c => c.canvas === this.caMensuelCanvas.nativeElement);
    if (existing) { existing.destroy(); this.charts = this.charts.filter(c => c !== existing); }
    const g = this.tokenColor('--color-primary');
    const accent = this.tokenColor('--color-accent');
    const ctx2 = this.caMensuelCanvas.nativeElement.getContext('2d')!;
    this.charts.push(new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: ['Période précédente', 'Période actuelle'],
        datasets: [{
          label: 'CA (FCFA)',
          data: [comp.precedente.caFCFA, comp.actuelle.caFCFA],
          backgroundColor: [accent, g],
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

  ngOnDestroy() {
    this.charts.forEach(c => c.destroy());
    if (this.refreshHandle) clearInterval(this.refreshHandle);
  }
}
