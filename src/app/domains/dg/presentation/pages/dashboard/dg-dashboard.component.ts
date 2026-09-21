import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import { AuthService } from '../../../../../core/auth/auth.service';
import { DgService, KpisDgBE, ClassementCommercialBE, TauxOccupationSecteurBE, AnomalieBE, ZonePerformanceBE } from '../../../infrastructure/dg.service';
import { fCFA } from '../../../../../shared/utils/format.utils';

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
  private charts: Chart[] = [];
  private readonly dgSvc = inject(DgService);
  private readonly auth = inject(AuthService);

  today = new Date();
  loading = signal(true);
  selectedPeriod = signal<'today' | 'week' | 'month'>('today');

  kpis = signal<KpisDgBE | null>(null);
  commerciaux = signal<ClassementCommercialBE[]>([]);
  occupation = signal<TauxOccupationSecteurBE[]>([]);
  anomalies = signal<AnomalieBE[]>([]);
  zones = signal<ZonePerformanceBE[]>([]);

  caMensuel = signal<{ mois: string; n: number; nMoins1: number }[]>([]);
  caZones = computed(() => this.zones().map(z => ({ zone: z.secteur, ca: z.caMoisCourantFCFA, objectif: 0 })));
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
    console.log("utilisateur connecter : ",this.auth.user())
    console.log("utilisateur connecter : ",this.auth.getToken())
    this.dgSvc.getKpis().subscribe({
      next: k => this.kpis.set(k),
      error: () => {},
    });
    this.dgSvc.getClassement().subscribe({
      next: c => this.commerciaux.set(c),
      error: () => {},
    });
    this.dgSvc.getTauxOccupationMarches().subscribe({
      next: o => this.occupation.set(o),
      error: () => {},
    });
    this.dgSvc.getAnomalies().subscribe({
      next: a => this.anomalies.set(a),
      error: () => {},
    });
    this.dgSvc.getZones().subscribe({
      next: z => this.zones.set(z),
      error: () => {},
    });
    setTimeout(() => this.loading.set(false), 600);
  }

  ngAfterViewInit() {
    setTimeout(() => this.buildCharts(), 700);
  }

  setPeriod(p: 'today' | 'week' | 'month') { this.selectedPeriod.set(p); }

  private buildCharts() {
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

  ngOnDestroy() { this.charts.forEach(c => c.destroy()); }
}
