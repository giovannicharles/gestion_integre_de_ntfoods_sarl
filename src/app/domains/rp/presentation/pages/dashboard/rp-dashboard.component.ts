import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RpService, RpDashboard, PrimeResponse, GrandCompteResponse, OccupationMarcheResponse, PerformanceGammeResponse } from '../../../infrastructure/rp.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { fCFA, tauxAtteinte } from '../../../../../shared/utils/format.utils';

@Component({
  selector: 'app-rp-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './rp-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RpDashboardComponent implements OnInit {
  today = new Date();
  fCFA = fCFA;
  tauxAtteinte = tauxAtteinte;
  Math = Math;

  private readonly svc = inject(RpService);

  loading = signal(true);
  loadError = signal<string | null>(null);

  data = signal<RpDashboard | null>(null);
  primes = signal<PrimeResponse[]>([]);
  gammes = signal<PerformanceGammeResponse[]>([]);
  occupation = signal<OccupationMarcheResponse[]>([]);
  grandsComptes = signal<GrandCompteResponse[]>([]);

  nbEligibles = computed(() => this.data()?.nbEligibles ?? 0);
  totalPrimes = computed(() => this.data()?.totalPrimes ?? 0);
  occupationMoyenne = computed(() => this.data()?.occupationMoyenne ?? 0);
  grandsComptesActifs = computed(() => this.data()?.grandsComptesActifs ?? 0);
  relancesDues = computed(() => this.data()?.relancesDues ?? 0);
  caGrandsComptes = computed(() => this.data()?.caGrandsComptes ?? 0);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.svc.getDashboard().subscribe({
      next: d => {
        this.data.set(d);
        this.primes.set(d.primes);
        this.gammes.set(d.gammes);
        this.occupation.set(d.occupation);
        this.grandsComptes.set(d.grandsComptes);
        this.loading.set(false);
      },
      error: e => {
        this.loadError.set(extractApiError(e));
        this.loading.set(false);
      },
    });
  }

  tauxOccupation(o: { livrees: number; repertoriees: number }): number {
    return Math.round((o.livrees / o.repertoriees) * 100);
  }
  occupationClass(o: { livrees: number; repertoriees: number }): string {
    const t = this.tauxOccupation(o);
    return t >= 70 ? 'taux-ok' : t >= 45 ? 'taux-mid' : 'taux-warn';
  }
  gammeClass(g: { ca: number; objectif: number }): string {
    const t = tauxAtteinte(g.ca, g.objectif);
    return t >= 95 ? 'prog-g' : t >= 75 ? 'prog-y' : 'prog-r';
  }
}
