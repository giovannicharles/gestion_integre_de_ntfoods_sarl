import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProductionService, PerformancePosteBE } from '../../../../infrastructure/production.service';
import { MiniChartComponent, ChartSeries } from '../../../shared/charts/mini-chart.component';

/** Date locale au format AAAA-MM-JJ (évite le décalage UTC de toISOString). */
function dateLocaleIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Seuils d'atteinte, en % de l'objectif (mêmes seuils que les autres pages de production). */
export const SEUIL_VIGILANCE = 50;
export const SEUIL_OBJECTIF_ATTEINT = 100;
export const SEUIL_DEPASSEMENT = 120;

/** Durée maximale d'une période, en jours (contrôle aussi fait côté serveur). */
const JOURS_MAX = 366;

export type Periode = 'jour' | 'semaine' | 'mois' | 'libre';
export type Niveau = 'attente' | 'bas' | 'moyen' | 'ok' | 'depasse';

/**
 * PERFORMANCES DES POSTES — Responsable de Salle.
 * Performance de chaque poste sur une période (jour, semaine, mois ou intervalle libre) : objectif, réalisé, taux,
 * rendement par personne. Les taux portent sur les journées saisies ; les quantités ne sont jamais mélangées entre
 * postes (chacun garde son unité).
 */
@Component({
  selector: 'app-rs-performances-postes',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, RouterLink, MiniChartComponent],
  templateUrl: './rs-performances-postes.component.html',
  styleUrls: ['./rs-performances-postes.component.css'],
})
export class RsPerformancesPostesComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly aujourdhui = new Date();
  readonly seuilVigilance = SEUIL_VIGILANCE;
  readonly seuilAtteint = SEUIL_OBJECTIF_ATTEINT;
  readonly seuilDepassement = SEUIL_DEPASSEMENT;

  readonly periode = signal<Periode>('semaine');
  readonly debutLibre = signal(dateLocaleIso());
  readonly finLibre = signal(dateLocaleIso());
  readonly chargement = signal(false);
  readonly performances = signal<PerformancePosteBE[] | null>(null);
  readonly erreur = signal('');
  readonly sessionExpiree = signal(false);

  /** Intervalle effectif de la période choisie. */
  readonly intervalle = computed(() => {
    const aujourdhui = new Date();
    switch (this.periode()) {
      case 'jour':
        return { debut: dateLocaleIso(aujourdhui), fin: dateLocaleIso(aujourdhui) };
      case 'semaine': {
        const decalage = (aujourdhui.getDay() + 6) % 7;
        const lundi = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() - decalage);
        return { debut: dateLocaleIso(lundi), fin: dateLocaleIso(aujourdhui) };
      }
      case 'mois':
        return { debut: dateLocaleIso(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1)), fin: dateLocaleIso(aujourdhui) };
      default:
        return { debut: this.debutLibre(), fin: this.finLibre() };
    }
  });

  readonly libelleIntervalle = computed(() => {
    const { debut, fin } = this.intervalle();
    return debut === fin ? `Le ${debut}` : `Du ${debut} au ${fin}`;
  });

  readonly lignes = computed<PerformancePosteBE[]>(() => {
    const p = this.performances() ?? [];
    return [...p].sort((a, b) => (a.rang ?? 999) - (b.rang ?? 999) || a.libelle.localeCompare(b.libelle, 'fr'));
  });
  readonly saisies = computed(() => this.lignes().filter(l => l.joursSaisis > 0));

  readonly nbAffectes = computed(() => this.lignes().length);
  readonly nbSaisis = computed(() => this.saisies().length);
  readonly tauxMoyen = computed(() => {
    const s = this.saisies();
    return s.length ? s.reduce((t, l) => t + l.tauxRealisation, 0) / s.length : null;
  });
  readonly nbAlertes = computed(() => this.saisies().filter(l => this.niveau(l.tauxRealisation) === 'bas').length);
  readonly meilleur = computed(() => this.saisies()[0] ?? null);

  readonly serieTaux = computed<ChartSeries[]>(() => [{
    name: 'Taux de réalisation (%)',
    color: 'var(--g, #14532D)',
    values: this.saisies().map(l => l.tauxRealisation),
  }]);
  readonly labelsTaux = computed<string[]>(() => this.saisies().map(l => l.libelle));

  ngOnInit(): void {
    this.charger();
  }

  choisirPeriode(p: Periode): void {
    this.periode.set(p);
    this.charger();
  }

  /** Intervalle libre : vérifie l'ordre des dates et la durée avant d'interroger le serveur. */
  appliquerIntervalle(): void {
    const { debut, fin } = this.intervalle();
    if (fin < debut) {
      this.erreur.set('La date de fin précède la date de début.');
      return;
    }
    const jours = (new Date(fin).getTime() - new Date(debut).getTime()) / 86400000 + 1;
    if (jours > JOURS_MAX) {
      this.erreur.set(`La période ne peut pas dépasser ${JOURS_MAX} jours.`);
      return;
    }
    this.charger();
  }

  charger(): void {
    const { debut, fin } = this.intervalle();
    if (fin < debut) {
      this.erreur.set('La date de fin précède la date de début.');
      return;
    }
    this.chargement.set(true);
    this.erreur.set('');
    this.svc.getPerformancesPostes(debut, fin).subscribe({
      next: list => { this.performances.set(list); this.chargement.set(false); },
      error: (e: unknown) => {
        this.chargement.set(false);
        this.performances.set(null);
        this.noterErreur(e, 'Les performances de la période n\'ont pas pu être chargées.');
      },
    });
  }

  niveau(taux: number): Niveau {
    if (taux >= SEUIL_DEPASSEMENT) return 'depasse';
    if (taux >= SEUIL_OBJECTIF_ATTEINT) return 'ok';
    if (taux >= SEUIL_VIGILANCE) return 'moyen';
    return 'bas';
  }

  libelleNiveau(n: Niveau): string {
    return ({ attente: 'Non saisi', bas: 'Sous le seuil', moyen: 'À surveiller', ok: 'Objectif atteint', depasse: 'Dépassement' } as const)[n];
  }

  medaille(rang: number | null): string {
    return rang === 1 ? '🥇' : rang === 2 ? '🥈' : rang === 3 ? '🥉' : '';
  }

  /** Borne un pourcentage entre 0 et 100 pour une barre. */
  borne(pct: number): number {
    return Math.max(0, Math.min(100, pct));
  }

  private noterErreur(e: unknown, repli: string): void {
    const err = e as { status?: number; error?: { erreur?: string; message?: string } };
    if (err?.status === 401) {
      this.sessionExpiree.set(true);
      this.erreur.set('Votre session a été fermée, probablement parce que ce compte a été ouvert ailleurs.');
      return;
    }
    this.erreur.set(err?.error?.erreur || err?.error?.message || repli);
  }
}
