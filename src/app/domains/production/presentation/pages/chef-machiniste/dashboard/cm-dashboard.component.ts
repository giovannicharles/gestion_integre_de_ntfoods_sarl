import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, of } from 'rxjs';
import {
  ProductionService, ApercuBroyageBE, SyntheseBroyageBE, ClassementMachinisteBE,
} from '../../../../infrastructure/production.service';
import { MiniChartComponent, ChartSeries } from '../../../shared/charts/mini-chart.component';
import { DonutChartComponent, DonutSlice } from '../../../shared/charts/donut-chart.component';

/** Date locale au format AAAA-MM-JJ (évite le décalage UTC de toISOString). */
function dateLocaleIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Ajoute n jours à une date AAAA-MM-JJ, en calendrier local. */
function ajouterJours(iso: string, n: number): string {
  const [y, m, j] = iso.split('-').map(Number);
  return dateLocaleIso(new Date(y, m - 1, j + n));
}

const COULEUR_POUDRE: Record<string, string> = { MAIS: '#f9a825', SOJA: '#558b2f', ARACHIDE: '#6d4c41' };
const LIBELLE_POUDRE: Record<string, string> = { MAIS: 'Maïs', SOJA: 'Soja', ARACHIDE: 'Arachide' };
/** Seuil de validation d'une journée (règle du backend). */
const SEUIL_VALIDATION = 85;
/** Au-delà de ce % de pertes, la journée est signalée. */
const SEUIL_PERTES = 5;

/**
 * VUE D'ENSEMBLE DU BROYAGE — Chef Machiniste.
 *
 * Tout le tableau de bord vient de l'endpoint `/production/broyage/apercu` : synthèse du jour, bilan des
 * 30 derniers jours, activité des 7 derniers jours, répartition par poudre, plan en cours. Le classement
 * de la semaine reste sur son propre endpoint. Aucun calcul de session n'est refait ici.
 */
@Component({
  selector: 'app-cm-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, RouterLink, MiniChartComponent, DonutChartComponent],
  templateUrl: './cm-dashboard.component.html',
  styleUrls: ['./cm-dashboard.component.css'],
})
export class CmDashboardComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly aujourdhui = dateLocaleIso();
  readonly chargement = signal(true);
  readonly erreurs = signal<string[]>([]);
  readonly sessionExpiree = signal(false);
  readonly derniereMaj = signal<Date | null>(null);

  readonly apercu = signal<ApercuBroyageBE | null>(null);
  readonly classement = signal<ClassementMachinisteBE | null>(null);

  readonly jour = computed<SyntheseBroyageBE | null>(() => this.apercu()?.duJour ?? null);
  readonly periode = computed<SyntheseBroyageBE | null>(() => this.apercu()?.periode ?? null);

  /** Sept derniers jours, pour l'activité récente. */
  readonly sept = computed(() => (this.apercu()?.jours ?? []).slice(-7));
  readonly labels7 = computed(() => this.sept().map(j => j.date.slice(8, 10) + '/' + j.date.slice(5, 7)));
  readonly serieActivite = computed<ChartSeries[]>(() => [
    { name: 'Objectif (kg)', color: '#0284c7', values: this.sept().map(j => j.objectif) },
    { name: 'Réalisé (kg)', color: '#2e7d32', values: this.sept().map(j => j.realise) },
  ]);
  readonly serieTaux = computed<ChartSeries[]>(() => [{
    name: 'Taux (%)', color: '#1E7A42', values: this.sept().map(j => j.taux ?? 0),
  }]);

  readonly donutPoudres = computed<DonutSlice[]>(() => (this.apercu()?.poudres ?? [])
    .filter(p => p.realise > 0)
    .map(p => ({
      label: LIBELLE_POUDRE[p.code] ?? p.code,
      value: Math.round(p.realise * 10) / 10,
      color: COULEUR_POUDRE[p.code] ?? '#90a4ae',
    })));

  readonly top5 = computed(() => [...(this.classement()?.classements ?? [])]
    .sort((a, b) => a.rang - b.rang).slice(0, 5));

  readonly alertes = computed(() => {
    const out: { type: 'danger' | 'warning' | 'info'; texte: string }[] = [];
    const j = this.jour();
    if (j && j.objectif > 0 && j.taux !== null && j.taux < SEUIL_VALIDATION) {
      out.push({ type: 'warning', texte: `Réalisé du jour à ${j.taux.toFixed(1)} % de l'objectif (seuil de validation : ${SEUIL_VALIDATION} %).` });
    }
    if (j && j.pctPertes !== null && j.pctPertes > SEUIL_PERTES) {
      out.push({ type: 'danger', texte: `Pertes du jour à ${j.pctPertes.toFixed(1)} % (au-delà de ${SEUIL_PERTES} %).` });
    }
    const p = this.periode();
    if (p && p.nbSessions > p.nbValidees) {
      out.push({ type: 'info', texte: `${p.nbSessions - p.nbValidees} journée(s) non validée(s) sur les 30 derniers jours.` });
    }
    return out;
  });

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreurs.set([]);
    this.sessionExpiree.set(false);
    forkJoin({
      apercu: this.tolerer(this.svc.getApercuBroyage(ajouterJours(this.aujourdhui, -29), this.aujourdhui), null, 'vue d\'ensemble'),
      classement: this.tolerer(this.svc.getClassementMachinistes(this.debutSemaine(), this.aujourdhui), null, 'classement'),
    }).subscribe(r => {
      this.apercu.set(r.apercu);
      this.classement.set(r.classement);
      this.derniereMaj.set(new Date());
      this.chargement.set(false);
    });
  }

  /** Une source qui échoue ne bloque pas les autres : elle reste vide et son nom est signalé. */
  private tolerer<T>(source: Observable<T>, repli: T, nom: string): Observable<T> {
    return source.pipe(catchError((e: unknown) => {
      if ((e as { status?: number })?.status === 401) {
        this.sessionExpiree.set(true);
      } else {
        this.erreurs.update(l => l.includes(nom) ? l : [...l, nom]);
      }
      return of(repli);
    }));
  }

  libelleTaux(t: number | null): string {
    return t === null ? '—' : `${t.toFixed(1)} %`;
  }

  private debutSemaine(): string {
    const decalage = (new Date().getDay() + 6) % 7; // lundi = 0
    return ajouterJours(this.aujourdhui, -decalage);
  }
}
