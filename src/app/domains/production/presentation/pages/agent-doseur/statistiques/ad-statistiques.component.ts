import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, of } from 'rxjs';
import {
  ProductionService, StatistiquesFutsBE, SessionDosageBE,
} from '../../../../infrastructure/production.service';
import { MiniChartComponent, ChartSeries } from '../../../shared/charts/mini-chart.component';

type Periode = 'JOUR' | 'SEMAINE' | 'MOIS';

/** Date locale au format AAAA-MM-JJ (évite le décalage UTC de toISOString). */
function dateLocaleIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Ajoute n jours à une date AAAA-MM-JJ, en calendrier local. */
function ajouterJours(iso: string, n: number): string {
  const [y, m, j] = iso.split('-').map(Number);
  return dateLocaleIso(new Date(y, m - 1, j + n));
}

/** Code canonique d'une matière (« Maïs » → « MAIS ») pour regrouper les consommations. */
function codeMatiere(nom: string): string {
  return nom.normalize('NFD').replace(/\p{M}/gu, '').trim().toUpperCase();
}

/**
 * STATISTIQUES — Agent Doseur.
 * Fûts nets, fûts produits, sessions et matières consommées sur le jour, la semaine et le mois,
 * avec la variation par rapport à la période précédente (N-1), et l'évolution des 7 derniers jours.
 */
@Component({
  selector: 'app-ad-statistiques',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, RouterLink, MiniChartComponent],
  templateUrl: './ad-statistiques.component.html',
  styleUrls: ['./ad-statistiques.component.css'],
})
export class AdStatistiquesComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly aujourdhui = dateLocaleIso();
  readonly jours7 = Array.from({ length: 7 }, (_, i) => ajouterJours(this.aujourdhui, i - 6));

  readonly periodes: { code: Periode; libelle: string }[] = [
    { code: 'JOUR', libelle: 'Aujourd\'hui' },
    { code: 'SEMAINE', libelle: 'Cette semaine' },
    { code: 'MOIS', libelle: 'Ce mois' },
  ];

  readonly chargement = signal(true);
  readonly erreur = signal('');
  readonly sessionExpiree = signal(false);
  readonly erreurHistorique = signal('');
  readonly periodeChoisie = signal<Periode>('SEMAINE');

  readonly statsJour = signal<StatistiquesFutsBE | null>(null);
  readonly statsSemaine = signal<StatistiquesFutsBE | null>(null);
  readonly statsMois = signal<StatistiquesFutsBE | null>(null);
  readonly historique = signal<SessionDosageBE[]>([]);

  readonly statsChoisies = computed(() => {
    switch (this.periodeChoisie()) {
      case 'JOUR': return this.statsJour();
      case 'MOIS': return this.statsMois();
      default: return this.statsSemaine();
    }
  });

  /** Consommation de matières de la période choisie, regroupée par code (MAIS, SOJA…), la plus forte en tête. */
  readonly matieresChoisies = computed(() => {
    const s = this.statsChoisies();
    if (!s) return [];
    const cumul = new Map<string, number>();
    for (const m of s.matieresPremieres) {
      const code = codeMatiere(m.matierePremiere);
      cumul.set(code, (cumul.get(code) ?? 0) + m.quantiteKg);
    }
    const total = [...cumul.values()].reduce((t, v) => t + v, 0);
    return [...cumul.entries()]
      .map(([code, kg]) => ({ code, kg, part: total > 0 ? (kg / total) * 100 : 0 }))
      .sort((a, b) => b.kg - a.kg);
  });

  readonly labels7j = computed(() => this.jours7.map(j => j.slice(8, 10) + '/' + j.slice(5, 7)));

  readonly seriesFuts = computed<ChartSeries[]>(() => {
    const h = this.historique();
    return [{
      name: 'Fûts nets', color: '#2e7d32',
      values: this.jours7.map(j => h.filter(s => s.date === j).reduce((t, s) => t + s.nbFutsNets, 0)),
    }];
  });

  readonly seriesMatieres = computed<ChartSeries[]>(() => {
    const h = this.historique();
    const parCode = (code: string) => this.jours7.map(j =>
      h.filter(s => s.date === j)
        .flatMap(s => s.matieresUtilisees)
        .filter(m => codeMatiere(m.typeMatiere) === code)
        .reduce((t, m) => t + m.quantiteKg, 0));
    return [
      { name: 'Maïs', color: '#f9a825', values: parCode('MAIS') },
      { name: 'Soja', color: '#558b2f', values: parCode('SOJA') },
      { name: 'Arachide', color: '#6d4c41', values: parCode('ARACHIDE') },
    ];
  });

  readonly seriesSessions = computed<ChartSeries[]>(() => {
    const h = this.historique();
    return [{
      name: 'Sessions', color: '#1976d2',
      values: this.jours7.map(j => h.filter(s => s.date === j).length),
    }];
  });

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set('');
    const fin = this.aujourdhui;
    forkJoin({
      jour: this.statistiques(fin, fin),
      semaine: this.statistiques(this.debutSemaine(), fin),
      mois: this.statistiques(this.debutMois(), fin),
    }).subscribe(r => {
      this.statsJour.set(r.jour);
      this.statsSemaine.set(r.semaine);
      this.statsMois.set(r.mois);
      this.chargement.set(false);
    });

    this.erreurHistorique.set('');
    this.svc.getSessionsDosageParPeriode(this.jours7[0], fin).subscribe({
      next: h => this.historique.set(h),
      error: (e: unknown) => {
        this.noterErreur(e);
        this.erreurHistorique.set('L\'évolution sur 7 jours n\'a pas pu être chargée.');
      },
    });
  }

  /** Une période qui échoue ne bloque pas les autres : elle reste vide et l'erreur est signalée. */
  private statistiques(debut: string, fin: string): Observable<StatistiquesFutsBE | null> {
    return this.svc.getStatistiquesFuts(debut, fin).pipe(
      catchError((e: unknown) => {
        this.noterErreur(e);
        return of(null);
      }));
  }

  private noterErreur(e: unknown): void {
    const statut = (e as { status?: number })?.status;
    if (statut === 401) {
      this.sessionExpiree.set(true);
      this.erreur.set('Votre session a été fermée, probablement parce que ce compte a été ouvert ailleurs.');
    } else {
      this.erreur.set('Certaines statistiques n\'ont pas pu être chargées.');
    }
  }

  private debutSemaine(): string {
    const d = new Date();
    const decalage = (d.getDay() + 6) % 7; // lundi = 0
    return ajouterJours(this.aujourdhui, -decalage);
  }

  private debutMois(): string {
    const d = new Date();
    return dateLocaleIso(new Date(d.getFullYear(), d.getMonth(), 1));
  }
}
